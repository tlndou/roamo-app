import type { OpeningHours, VisitTimeLabel } from "@/types/spot"
import { getOpenIntervalsForDay } from "@/lib/opening-hours/today"

type Range = { startMin: number; endMin: number }

const LABEL_RANGES: Record<VisitTimeLabel, Range> = {
  morning: { startMin: 6 * 60, endMin: 12 * 60 },
  lunch: { startMin: 11 * 60, endMin: 14 * 60 },
  afternoon: { startMin: 12 * 60, endMin: 17 * 60 },
  daytime: { startMin: 9 * 60, endMin: 17 * 60 },
  dinner: { startMin: 18 * 60, endMin: 22 * 60 },
  evening: { startMin: 17 * 60, endMin: 23 * 60 },
  late_night: { startMin: 22 * 60, endMin: 28 * 60 }, // spans past midnight
}

function overlaps(a: Range, b: Range): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin
}

/**
 * Returns true if a visit-time label is compatible with today's opening hours.
 * Only enforces constraints when we have structured `periods` for today.
 * If hours are missing/unstructured, returns true (don't block user choice).
 */
export function isVisitTimeAllowedToday(openingHours: OpeningHours | undefined, label: VisitTimeLabel, now = new Date()): boolean {
  const oh = openingHours
  if (!oh?.periods?.length) return true
  const day = now.getDay()
  const intervals = getOpenIntervalsForDay(oh, day)
  if (!intervals.length) return true

  const target = LABEL_RANGES[label]
  if (!target) return true

  return intervals.some((it) => overlaps(it, target))
}


