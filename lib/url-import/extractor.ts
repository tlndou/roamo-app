import { validateURL, resolveShortLink } from "./url-validator"
import { detectProvider } from "./provider-matcher"
import { GoogleMapsExtractor } from "./extractors/google-maps"
import { GoogleMapsUrlOnlyExtractor } from "./extractors/google-maps-url-only"
import { SocialMediaExtractor } from "./extractors/social-media"
import { PinterestExtractor } from "./extractors/pinterest"
import { GenericWebsiteExtractor } from "./extractors/generic-website"
import { URLImportResult } from "@/types/url-import"
import { ProviderExtractor } from "@/types/providers"
import { enrichSpotDraft } from "./ai-enrichment"
import { applyInferredVisitTime } from "@/lib/visit-time/infer"

export class URLExtractor {
  private extractors: Map<string, ProviderExtractor>
  private fallbackExtractor: ProviderExtractor
  private googleApiKeyConfigured: boolean

  constructor(googleApiKey?: string) {
    this.googleApiKeyConfigured = Boolean(googleApiKey)
    this.extractors = new Map<string, ProviderExtractor>([
      // Always handle Google Maps with a provider-specific extractor.
      // If we don't have an API key, we still do URL-only parsing and require confirmation.
      ["google_maps", googleApiKey ? new GoogleMapsExtractor(googleApiKey) : new GoogleMapsUrlOnlyExtractor(false)],
      ["pinterest", new PinterestExtractor(googleApiKey)],
      ["instagram", new SocialMediaExtractor()],
      ["tiktok", new SocialMediaExtractor()],
    ])

    // Generic websites can optionally use Google Places search as a fallback when sites block scraping (403).
    this.fallbackExtractor = new GenericWebsiteExtractor(googleApiKey)
  }

  async extractFromURL(urlString: string): Promise<URLImportResult> {
    // Step 1: Validate URL
    const url = validateURL(urlString)

    // Step 2: Resolve short links
    const resolvedUrl = await resolveShortLink(url)

    // Step 3: Detect provider
    const providerMatch = detectProvider(resolvedUrl)

    // Step 4: Get appropriate extractor
    const extractor =
      this.extractors.get(providerMatch.type) || this.fallbackExtractor

    // Step 5: Extract data
    try {
      const result = await extractor.extract(resolvedUrl)

      // Step 6: Update metadata with resolved URL
      result.meta.rawUrl = urlString
      result.meta.resolvedUrl = resolvedUrl.toString()

      // Step 7: AI enrichment (clean titles, infer category)
      result.draft = await enrichSpotDraft(result.draft, result.meta)

      // Step 8: Conservative suggested visit time (only when hours are missing)
      result.draft = applyInferredVisitTime(result.draft as any) as any

      return result
    } catch (error) {
      // If provider-specific extraction fails:
      // - for Google Maps, fall back to URL-only (never generic HTML scraping, which yields "Google Maps"/Unknown)
      // - otherwise, fall back to generic
      if (providerMatch.type === "google_maps") {
        const message = error instanceof Error ? error.message : String(error)
        const urlOnly = new GoogleMapsUrlOnlyExtractor(this.googleApiKeyConfigured, message)
        const result = await urlOnly.extract(resolvedUrl)
        result.meta.rawUrl = urlString
        result.meta.resolvedUrl = resolvedUrl.toString()
        result.draft = await enrichSpotDraft(result.draft, result.meta)
        result.draft = applyInferredVisitTime(result.draft as any) as any
        return result
      }

      if (extractor !== this.fallbackExtractor) {
        console.warn(
          `Provider extraction failed for ${providerMatch.type}, falling back to generic`,
          error
        )
        const result = await this.fallbackExtractor.extract(resolvedUrl)
        result.meta.rawUrl = urlString
        result.meta.resolvedUrl = resolvedUrl.toString()

        // AI enrichment for fallback results too
        result.draft = await enrichSpotDraft(result.draft, result.meta)
        result.draft = applyInferredVisitTime(result.draft as any) as any

        return result
      }
      throw error
    }
  }
}
