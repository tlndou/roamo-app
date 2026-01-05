import type { ProviderResult } from "@/lib/url-import/providers/types"
import type { ImportedSpotDraft } from "@/lib/url-import/extract-spot-from-url"

/**
 * TripAdvisor has partner APIs; there isn't a stable public API for arbitrary clients.
 * This module exists as a strategy hook for when credentials are available.
 */
export async function importFromTripAdvisor(_match: { url: URL; locationId?: string }): Promise<ProviderResult> {
  throw new Error("TripAdvisor API not configured")
}


