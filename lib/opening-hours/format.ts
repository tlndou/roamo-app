import type { OpeningHours } from "@/types/spot"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function toHHMM(input: string): string {
  // Accept "HHMM" or "HH:MM"; normalize to "HH:MM"
  const s = String(input || "").trim()
  const m1 = s.match(/^(\d{1,2}):(\d{2})$/)
  if (m1) return `${m1[1].padStart(2, "0")}:${m1[2]}`
  const m2 = s.match(/^(\d{2})(\d{2})$/)
  if (m2) return `${m2[1]}:${m2[2]}`
  return s
}

/**
 * Prefer provider-provided weekdayText if available; otherwise format periods into readable lines.
 */
export function formatOpeningHours(oh: OpeningHours | undefined): string[] {
  if (!oh) return []
  const weekdayText = Array.isArray(oh.weekdayText)
    ? oh.weekdayText.filter((s) => typeof s === "string" && s.trim())
    : []
  if (weekdayText.length) return weekdayText

  const periods = Array.isArray(oh.periods) ? oh.periods : []
  if (!periods.length) return []

  const byDay: Record<number, string[]> = {}
  for (const p of periods) {
    const openDay = p?.open?.day
    const openTime = p?.open?.time
    if (typeof openDay !== "number" || typeof openTime !== "string") continue

    const closeTime = typeof p?.close?.time === "string" ? p.close.time : null
    const range = closeTime ? `${toHHMM(openTime)}–${toHHMM(closeTime)}` : `${toHHMM(openTime)}–?`
    byDay[openDay] = byDay[openDay] || []
    byDay[openDay].push(range)
  }

  const lines: string[] = []
  for (let d = 0; d <= 6; d++) {
    const ranges = byDay[d]
    if (!ranges || ranges.length === 0) continue
    lines.push(`${DAY_NAMES[d]}: ${ranges.join(", ")}`)
  }
  return lines
}


