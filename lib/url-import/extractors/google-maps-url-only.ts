import { URLImportResult } from "@/types/url-import"
import { ProviderExtractor } from "@/types/providers"

function decodeNameFromPath(pathname: string): string | undefined {
  // Common shapes:
  // /maps/place/<NAME>/...
  // /maps/search/<QUERY>/...
  const placeMatch = pathname.match(/\/maps\/place\/([^\/]+)/i)
  const searchMatch = pathname.match(/\/maps\/search\/([^\/]+)/i)
  const raw = placeMatch?.[1] ?? searchMatch?.[1]
  if (!raw) return undefined

  try {
    const decoded = decodeURIComponent(raw.replaceAll("+", " ")).trim()
    return decoded.length ? decoded : undefined
  } catch {
    return raw.replaceAll("+", " ").trim() || undefined
  }
}

function decodeNameFromQuery(url: URL): string | undefined {
  // Some URLs include q=<text> or query=<text>
  const q = url.searchParams.get("q") ?? url.searchParams.get("query") ?? undefined
  if (!q) return undefined
  // If it's a "place_id:" form, don't treat it as a name.
  if (/^place_id:/i.test(q)) return undefined
  return q.trim().length ? q.trim() : undefined
}

export class GoogleMapsUrlOnlyExtractor implements ProviderExtractor {
  private hasApiKey: boolean
  private apiError?: string

  constructor(hasApiKey: boolean, apiError?: string) {
    this.hasApiKey = hasApiKey
    this.apiError = apiError
  }

  canHandle(url: URL): boolean {
    return (
      url.hostname.includes("google.com") ||
      url.hostname === "maps.app.goo.gl"
    )
  }

  async extract(url: URL): Promise<URLImportResult> {
    const name = decodeNameFromPath(url.pathname) ?? decodeNameFromQuery(url) ?? "Google Maps"

    const warnings: string[] = []
    if (!this.hasApiKey) {
      warnings.push("Google Places API key not configured on server (GOOGLE_MAPS_API_KEY).")
    } else if (this.apiError) {
      warnings.push(`Google Places API call failed: ${this.apiError}`)
    } else {
      warnings.push("Google Maps link did not yield place details via API; please confirm location details.")
    }
    warnings.push("Please confirm location details.")

    return {
      draft: {
        name,
        address: undefined,
        city: "Unknown",
        country: "Unknown",
        continent: "Unknown",
        coordinates: { lat: 0, lng: 0 },
        category: "other",
        link: url.toString(),
        comments:
          "Google Maps link imported without Places API details. Please confirm the location and other fields.",
        useCustomImage: false,
        iconColor: "grey",
        visited: false,
      },
      meta: {
        provider: "google_maps",
        method: "url_only",
        confidence: {
          name: name === "Google Maps" ? "low" : "medium",
          address: "low",
          coordinates: "low",
          city: "low",
          country: "low",
          continent: "low",
          category: "low",
          link: "high",
        },
        requiresConfirmation: true,
        warnings,
        rawUrl: url.toString(),
        resolvedUrl: url.toString(),
      },
    }
  }
}


