import type { OpeningHours } from "@/types/spot"

export type DayIntervals = Array<{ startMin: number; endMin: number }>

function toMinutes(t: string): number | null {
  const s = String(t || "").trim()
  // "HHMM" or "HH:MM"
  const m1 = s.match(/^(\d{2})(\d{2})$/)
  if (m1) return Number(m1[1]) * 60 + Number(m1[2])
  const m2 = s.match(/^(\d{1,2}):(\d{2})$/)
  if (m2) return Number(m2[1]) * 60 + Number(m2[2])
  return null
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function fmt(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440
  const hh = Math.floor(m / 60)
  const mm = m % 60
  return `${pad2(hh)}:${pad2(mm)}`
}

/**
 * Returns open intervals for a given local day-of-week (0=Sun..6=Sat),
 * using structured periods. Intervals may extend past midnight (endMin > 1440).
 */
export function getOpenIntervalsForDay(openingHours: OpeningHours | undefined, day: number): DayIntervals {
  const oh = openingHours
  if (!oh?.periods?.length) return []

  const d = Math.max(0, Math.min(6, Math.floor(day)))
  const dayStartAbs = d * 1440
  const dayEndAbs = dayStartAbs + 1440

  const intervals: DayIntervals = []

  for (const p of oh.periods) {
    const o = p?.open
    if (!o || typeof o.day !== "number" || typeof o.time !== "string") continue
    const oMin = toMinutes(o.time)
    if (oMin == null) continue

    const openAbs = o.day * 1440 + oMin

    let closeAbs: number | null = null
    const c = p?.close
    if (c && typeof c.day === "number" && typeof c.time === "string") {
      const cMin = toMinutes(c.time)
      if (cMin != null) closeAbs = c.day * 1440 + cMin
    }

    // If close is missing, don't try to “guess”; treat as unknown duration (skip for constraints).
    if (closeAbs == null) continue

    // Handle wrap-around (e.g. close day earlier than open day in week representation)
    while (closeAbs <= openAbs) closeAbs += 7 * 1440

    // If this period overlaps the day window, include it.
    if (closeAbs <= dayStartAbs || openAbs >= dayEndAbs + 1440) continue
    if (closeAbs > dayStartAbs && openAbs < dayEndAbs + 1440) {
      const startRel = Math.max(0, openAbs - dayStartAbs)
      const endRel = closeAbs - dayStartAbs
      // clamp to a max of +48h; enough for overnight handling
      intervals.push({ startMin: startRel, endMin: Math.min(endRel, 2880) })
    }
  }

  // Merge overlapping intervals
  intervals.sort((a, b) => a.startMin - b.startMin)
  const merged: DayIntervals = []
  for (const it of intervals) {
    const last = merged[merged.length - 1]
    if (!last || it.startMin > last.endMin) merged.push({ ...it })
    else last.endMin = Math.max(last.endMin, it.endMin)
  }

  return merged
}

export function formatTodayHours(openingHours: OpeningHours | undefined, now = new Date()): string | null {
  const oh = openingHours
  if (!oh) return null

  const day = now.getDay()
  const intervals = getOpenIntervalsForDay(oh, day)
  if (intervals.length) {
    return intervals.map((it) => `${fmt(it.startMin)}–${fmt(it.endMin)}`).join(", ")
  }

  // Fallback: try to pick the right line from weekdayText if present.
  const weekdayText = Array.isArray(oh.weekdayText) ? oh.weekdayText : []
  if (!weekdayText.length) return null

  const dayLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]
  const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]
  const line =
    weekdayText.find((l) => typeof l === "string" && l.toLowerCase().startsWith(dayLong.toLowerCase())) ||
    weekdayText.find((l) => typeof l === "string" && l.toLowerCase().startsWith(dayShort.toLowerCase())) ||
    null

  return line ? String(line) : null
}


