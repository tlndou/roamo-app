import type { ProviderResult } from "@/lib/url-import/providers/types"
import type { ImportedSpotDraft } from "@/lib/url-import/extract-spot-from-url"

/**
 * OpenTable does not offer a generally-available public place details API for arbitrary clients.
 * We keep this strategy as a future extension point (partner API / private key), and otherwise rely on HTML metadata.
 */
export async function importFromOpenTable(_match: { url: URL; restaurantId?: string; slug?: string }): Promise<ProviderResult> {
  throw new Error("OpenTable API not configured")
}


