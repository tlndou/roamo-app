import type { BaseLocation, CurrentLocation, HomeAwayStatus } from "@/types/profile"

/**
 * Compute whether the user is "home" or "away" based on their
 * declared home location and current detected location.
 *
 * Rules (deterministic, uses canonicalCityId when available):
 * - If both home and current city exist and canonicalCityId matches → "home"
 * - If both cities exist and canonicalCityId differs → "away"
 * - If city is missing but country differs from home country → "away"
 * - If city is missing but country matches home country → "unknown"
 * - If home location or current location is missing → "unknown"
 */
export function computeHomeAwayStatus(
  homeLocation: BaseLocation | null,
  currentLocation: CurrentLocation | null
): HomeAwayStatus {
  // No home location set - can't determine
  if (!homeLocation) {
    return "unknown"
  }

  // No current location detected - can't determine
  if (!currentLocation) {
    return "unknown"
  }

  const homeCityId = homeLocation.canonicalCityId
  const homeCountry = homeLocation.country
  const currentCityId = currentLocation.canonicalCityId
  const currentCountry = currentLocation.country

  // Both canonical city IDs are known - compare them
  if (currentCityId && homeCityId) {
    return currentCityId === homeCityId ? "home" : "away"
  }

  // City is missing but country is known
  if (!currentCityId && currentCountry) {
    // Country differs from home → away
    if (currentCountry !== homeCountry) {
      return "away"
    }
    // Country matches home but city unknown → unknown
    return "unknown"
  }

  // Not enough info to determine
  return "unknown"
}
