import { ConfidenceLevel, URLImportResult } from "./url-import"

export type ProviderType =
  | "google_maps"
  | "instagram"
  | "tiktok"
  | "pinterest"
  | "official_website"
  | "unknown"

export interface ProviderMatch {
  type: ProviderType
  confidence: ConfidenceLevel
  placeId?: string
  businessId?: string
  handle?: string
}

export interface ProviderExtractor {
  canHandle(url: URL): boolean
  extract(url: URL): Promise<URLImportResult>
}
