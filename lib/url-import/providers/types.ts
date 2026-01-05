import type { ImportedSpotDraft } from "@/lib/url-import/extract-spot-from-url"

export type ProviderKind = "google_maps" | "yelp" | "opentable" | "tripadvisor" | "generic"

export type ProviderMatch =
  | { kind: "google_maps"; url: URL; placeId?: string; cid?: string }
  | { kind: "yelp"; url: URL; businessId?: string }
  | { kind: "opentable"; url: URL; restaurantId?: string; slug?: string }
  | { kind: "tripadvisor"; url: URL; locationId?: string }
  | { kind: "generic"; url: URL }

export type ProviderResult = {
  kind: ProviderKind
  draft: ImportedSpotDraft
  // Where the data came from (API vs scrape). Helpful for UX/debugging.
  source: "api" | "html"
}


