import { URLImportResult } from "@/types/url-import"
import { ProviderExtractor } from "@/types/providers"
import { getCountryContinent, normalizeCountryName } from "@/lib/country-utils"

export class GenericWebsiteExtractor implements ProviderExtractor {
  private googleApiKey?: string

  constructor(googleApiKey?: string) {
    this.googleApiKey = googleApiKey
  }

  canHandle(url: URL): boolean {
    return true // Fallback extractor
  }

  async extract(url: URL): Promise<URLImportResult> {
    const metadata = await this.extractMetadata(url)

    const rawCountry = metadata.country || "Unknown"
    const country = rawCountry !== "Unknown" ? normalizeCountryName(rawCountry) : "Unknown"
    const continent =
      rawCountry !== "Unknown" ? getCountryContinent(rawCountry) : "Unknown"

    return {
      draft: {
        name: metadata.title || url.hostname,
        address: metadata.address,
        city: metadata.city || "Unknown",
        country,
        continent,
        coordinates: metadata.coordinates || { lat: 0, lng: 0 },
        category: "other",
        link: url.toString(),
        comments: metadata.description,
        useCustomImage: false,
        iconColor: "grey",
        visited: false,
      },
      meta: {
        provider: "official_website",
        method: metadata.method,
        confidence: {
          name: metadata.title ? "medium" : "low",
          address: metadata.address ? "medium" : "low",
          coordinates: metadata.coordinates ? "medium" : "low",
          city: metadata.city ? "medium" : "low",
          country: metadata.country ? "medium" : "low",
          continent: metadata.country ? "medium" : "low",
          category: "low",
          link: "high",
        },
        // Always require confirmation for generic websites since data is unreliable
        requiresConfirmation: true,
        warnings: metadata.warnings,
        rawUrl: url.toString(),
        resolvedUrl: url.toString(),
      },
    }
  }

  private decodeHtmlEntities(input: string): string {
    // Minimal entity decoding for common title/meta cases.
    return input
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&mdash;", "—")
      .replaceAll("&ndash;", "–")
      .replaceAll("&nbsp;", " ")
  }

  private stripTags(html: string): string {
    return this.decodeHtmlEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
  }

  private cleanTitle(title: string | undefined, url: URL): string | undefined {
    if (!title) return undefined
    let t = this.decodeHtmlEntities(title).replace(/\s+/g, " ").trim()
    if (!t) return undefined

    // Ignore extremely generic titles
    const generic = new Set(["home", "homepage", "index", "welcome", "accueil"])
    if (generic.has(t.toLowerCase())) return undefined

    // Remove " — Site", " | Site", " - Site" suffixes when the suffix matches hostname-ish.
    const host = url.hostname.replace(/^www\./, "")
    const hostToken = host.split(".")[0]
    const suffixes = [host, hostToken].filter(Boolean)
    for (const s of suffixes) {
      const re = new RegExp(`\\s*[—–\\-|•:]\\s*${s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`, "i")
      t = t.replace(re, "").trim()
    }

    // Also handle duplicated site-name patterns (common on marketing sites):
    // "X — Brand" where Brand also appears earlier.
    const parts = t.split(/\s*[—–|•-]\s*/).map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2 && parts[0] && parts[1] && parts[0].toLowerCase() !== parts[1].toLowerCase()) {
      // Prefer the first segment as the "place/activity name".
      t = parts[0]
    }

    return t || undefined
  }

  private extractFirstH1(html: string): string | undefined {
    const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    if (!match?.[1]) return undefined
    const text = this.stripTags(match[1])
    return text.length ? text : undefined
  }

  private titleFromUrl(url: URL): string | undefined {
    // Prefer meaningful path segments over hostname.
    const parts = url.pathname.split("/").filter(Boolean).map((p) => p.split("?")[0])
    const ignore = new Set(["overview", "book", "booking", "tickets", "ticket", "en", "en-us", "fr", "de", "it", "pt", "es"])
    const pick = [...parts].reverse().find((p) => p && !ignore.has(p.toLowerCase()))
    if (!pick) return undefined
    const cleaned = pick
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (!cleaned) return undefined
    // Title-case-ish (keep small words)
    const small = new Set(["and", "or", "the", "a", "an", "of", "to", "in", "on", "for"])
    return cleaned
      .split(" ")
      .map((w) => (small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ")
  }

  private async placesSearchText(query: string): Promise<any | null> {
    if (!this.googleApiKey) return null
    const url = "https://places.googleapis.com/v1/places:searchText"
    const fieldMask = [
      "places.displayName",
      "places.formattedAddress",
      "places.location",
      "places.types",
      "places.addressComponents",
    ].join(",")

    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": this.googleApiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) return null
    const place = Array.isArray((data as any).places) ? (data as any).places[0] : undefined
    return place ?? null
  }

  private extractCityFromPlace(place: any): string | undefined {
    const comps = Array.isArray(place?.addressComponents) ? place.addressComponents : []
    const city = comps.find((c: any) => Array.isArray(c.types) && (c.types.includes("locality") || c.types.includes("postal_town")))
    return city?.longText || city?.shortText
  }

  private extractCountryFromPlace(place: any): string | undefined {
    const comps = Array.isArray(place?.addressComponents) ? place.addressComponents : []
    const country = comps.find((c: any) => Array.isArray(c.types) && c.types.includes("country"))
    return country?.longText || country?.shortText
  }

  private async extractMetadata(url: URL): Promise<any> {
    try {
      console.log(`[Generic Website] Fetching: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SpotBot/1.0)',
          "Accept-Language": "en-US,en;q=0.9",
        },
      })

      if (!response.ok) {
        console.error(`[Generic Website] HTTP error: ${response.status}`)
        // Some sites (e.g., Marriott) block automated fetching with 403.
        // In that case: derive a best-effort title from URL and optionally use Google Places search.
        const derivedTitle = this.titleFromUrl(url)
        const place = derivedTitle ? await this.placesSearchText(derivedTitle) : null
        if (place) {
          const country = this.extractCountryFromPlace(place)
          const city = this.extractCityFromPlace(place)
          return {
            title: place.displayName?.text || derivedTitle,
            address: place.formattedAddress,
            city,
            country,
            coordinates:
              place.location && typeof place.location.latitude === "number" && typeof place.location.longitude === "number"
                ? { lat: place.location.latitude, lng: place.location.longitude }
                : undefined,
            description: undefined,
            method: "places_search_text",
            warnings: [
              `Website blocked automated fetching (HTTP ${response.status}); used Google Places search — please confirm details`,
            ],
          }
        }

        return {
          title: derivedTitle,
          method: "http_error",
          warnings: [`Could not fetch website data: HTTP ${response.status}`],
        }
      }

      const html = await response.text()
      console.log(`[Generic Website] Fetched ${html.length} bytes of HTML`)

      // Try JSON-LD first (most structured)
      const jsonLd = this.extractJsonLd(html, url)
      if (jsonLd && jsonLd.title) {
        console.log(`[Generic Website] Found JSON-LD data: ${jsonLd.title}`)
        return { ...jsonLd, method: "json_ld", warnings: [] }
      }

      // Fallback to OpenGraph
      const og = this.extractOpenGraph(html, url)
      console.log(`[Generic Website] OpenGraph extraction: ${og.title || 'No title found'}`)

      // Heuristic address extraction from visible text when no JSON-LD address exists.
      const heuristic = this.extractAddressHeuristics(html)

      // Title fallback: if OG/meta title is missing or generic, try H1, then URL-derived title.
      const h1 = this.extractFirstH1(html)
      const title = og.title || (h1 ? this.cleanTitle(h1, url) : undefined) || this.titleFromUrl(url)

      return {
        ...og,
        title,
        ...heuristic,
        method: "opengraph",
        warnings: og.title
          ? ["Limited structured data available from website — please confirm details"]
          : ["Could not extract meaningful data from website — please confirm details"],
      }
    } catch (error) {
      console.error(`[Generic Website] Extraction failed:`, error)
      return {
        title: this.titleFromUrl(url),
        method: "none",
        warnings: [`Could not fetch website data: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }
    }
  }

  private extractJsonLd(html: string, url: URL): any | null {
    const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1]?.trim())
      .filter((s): s is string => Boolean(s))

    if (!scripts.length) return null

    const objects: any[] = []
    for (const raw of scripts) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) objects.push(...parsed)
        else objects.push(parsed)
      } catch {
        // ignore invalid JSON-LD blocks
      }
    }

    const flattened: any[] = []
    const pushObj = (o: any) => {
      if (!o || typeof o !== "object") return
      if (Array.isArray(o)) return o.forEach(pushObj)
      if (o["@graph"] && Array.isArray(o["@graph"])) o["@graph"].forEach(pushObj)
      flattened.push(o)
    }
    objects.forEach(pushObj)

    const isPlaceLike = (o: any): boolean => {
      const t = o?.["@type"]
      const types = Array.isArray(t) ? t : t ? [t] : []
      const hay = types.map((x: any) => String(x).toLowerCase()).join(" ")
      return (
        hay.includes("localbusiness") ||
        hay.includes("foodestablishment") ||
        hay.includes("restaurant") ||
        hay.includes("cafe") ||
        hay.includes("bar") ||
        hay.includes("hotel") ||
        hay.includes("lodgingbusiness") ||
        hay.includes("touristattraction") ||
        hay.includes("museum") ||
        hay.includes("sportsactivitylocation") ||
        hay.includes("skiresort") ||
        hay.includes("place")
      )
    }

    const score = (o: any): number => {
      const hasName = Boolean(o?.name)
      const hasAddress = Boolean(o?.address)
      const hasGeo = Boolean(o?.geo || o?.latitude || o?.longitude)
      return (isPlaceLike(o) ? 5 : 0) + (hasName ? 2 : 0) + (hasAddress ? 2 : 0) + (hasGeo ? 1 : 0)
    }

    const best = [...flattened].sort((a, b) => score(b) - score(a))[0]
    if (!best || score(best) === 0) return null

    const addr = best.address
    const addressLine =
      typeof addr === "string"
        ? addr
        : addr
          ? [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry]
              .filter(Boolean)
              .map((x: any) => (typeof x === "string" ? x : x?.name ?? ""))
              .filter(Boolean)
              .join(", ")
          : undefined

    const city =
      typeof addr === "object"
        ? addr.addressLocality || addr.addressRegion
        : undefined

    const country =
      typeof addr === "object"
        ? typeof addr.addressCountry === "string"
          ? addr.addressCountry
          : addr.addressCountry?.name
        : undefined

    const coords =
      best.geo && (best.geo.latitude || best.geo.longitude)
        ? { lat: Number(best.geo.latitude), lng: Number(best.geo.longitude) }
        : typeof best.latitude !== "undefined" && typeof best.longitude !== "undefined"
          ? { lat: Number(best.latitude), lng: Number(best.longitude) }
          : undefined

    const title = this.cleanTitle(best.name, url) ?? this.cleanTitle(best.headline, url) ?? undefined

    return {
      title,
      address: addressLine ? this.decodeHtmlEntities(addressLine) : undefined,
      city: city ? this.decodeHtmlEntities(String(city)) : undefined,
      country: country ? this.decodeHtmlEntities(String(country)) : undefined,
      coordinates:
        coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
          ? coords
          : undefined,
      description: best.description ? this.stripTags(String(best.description)) : undefined,
    }
  }

  private extractOpenGraph(html: string, url: URL): any {
    // Try OpenGraph tags first
    const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)
    const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/)
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)

    // Try regular meta tags
    const metaTitleMatch = html.match(/<meta name="title" content="([^"]+)"/)
    const metaDescMatch = html.match(/<meta name="description" content="([^"]+)"/)

    // Try title tag as last resort
    const titleTagMatch = html.match(/<title>([^<]+)<\/title>/)

    const title = ogTitleMatch?.[1] || metaTitleMatch?.[1] || titleTagMatch?.[1]
    const description = ogDescMatch?.[1] || metaDescMatch?.[1]

    console.log(`[Generic Website] Extracted title: ${title || 'None'}`)

    return {
      title: this.cleanTitle(title?.trim(), url),
      description: description ? this.decodeHtmlEntities(description.trim()) : undefined,
      image: ogImageMatch?.[1] ? this.decodeHtmlEntities(ogImageMatch[1].trim()) : undefined,
    }
  }

  private extractAddressHeuristics(html: string): {
    address?: string
    city?: string
    country?: string
    coordinates?: { lat: number; lng: number }
  } {
    // Very lightweight heuristics for sites without JSON-LD.
    const text = this.stripTags(html)

    // UK postcode pattern (captures a likely address line).
    const uk = text.match(
      /(\d{1,5}\s+[A-Za-z0-9 .'\-]+,\s*[A-Za-z .'\-]+,\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i
    )
    if (uk?.[1]) {
      const addr = uk[1].trim()
      const parts = addr.split(",").map((x) => x.trim())
      const city = parts.length >= 2 ? parts[parts.length - 2] : undefined
      // The presence of a UK postcode is a strong signal for country.
      return { address: addr, city, country: "United Kingdom" }
    }

    // US pattern: "123 Main St, City, ST 12345"
    const us = text.match(/(\d{1,6}\s+[^,]{3,},\s*[^,]{2,},\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/)
    if (us?.[1]) {
      const addr = us[1].trim()
      const parts = addr.split(",").map((x) => x.trim())
      const city = parts.length >= 2 ? parts[1] : undefined
      return { address: addr, city, country: "United States" }
    }

    // French-ish: "73700 Bourg-Saint-Maurice" (postal code + city)
    const fr = text.match(/\b(\d{5})\s+([A-Za-zÀ-ÖØ-öø-ÿ'\- ]{2,})\b/)
    if (fr?.[0]) {
      const addr = fr[0].trim()
      return { address: addr, city: fr[2]?.trim(), country: "France" }
    }

    return {}
  }
}
