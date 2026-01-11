import type { SpotCategory, VisitTimeLabel } from "@/types/spot"

/**
 * Conservative, global-only visiting time inference.
 * Never returns exact times; only broad labels.
 */
export function inferVisitTimeLabel(category: SpotCategory): VisitTimeLabel | null {
  switch (category) {
    case "restaurant":
      // Broad meal-time label (still not an exact clock time).
      return "dinner"
    case "cafe":
      return "morning"
    case "bar":
      return "evening"
    case "club":
      return "late_night"
    case "museum":
      return "afternoon"
    case "park":
      return "daytime"
    case "attraction":
      return "daytime"
    // Explicitly no inference for these
    case "hotel":
    case "shop":
    case "event":
    case "activity":
    case "other":
      return null
    default:
      return null
  }
}

export function hasReliableOpeningHours(openingHours: any | undefined | null): boolean {
  const oh = openingHours as any
  if (!oh) return false
  const weekdayText = Array.isArray(oh.weekdayText) ? oh.weekdayText.filter((s: any) => typeof s === "string" && s.trim()) : []
  const periods = Array.isArray(oh.periods) ? oh.periods : []
  return weekdayText.length > 0 || periods.length > 0
}

export function applyInferredVisitTime<T extends { category: SpotCategory; openingHours?: any; recommendedVisitTime?: any; visitTimeSource?: any; visitTimeConfidence?: any }>(
  input: T,
): T {
  // Never override anything already set (user-edited or importer-set).
  if (input.recommendedVisitTime) return input
  if (hasReliableOpeningHours(input.openingHours)) return input

  if (!input.category || input.category === "other") return input

  const inferred = inferVisitTimeLabel(input.category)
  if (!inferred) return input

  return {
    ...input,
    recommendedVisitTime: inferred,
    visitTimeSource: "inferred",
    visitTimeConfidence: "low",
  }
}


