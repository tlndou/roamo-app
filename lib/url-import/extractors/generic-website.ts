import { URLImportResult } from "@/types/url-import"
import { ProviderExtractor } from "@/types/providers"
import { getCountryContinent, normalizeCountryName } from "@/lib/country-utils"
import type { SpotCategory } from "@/types/spot"

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

    const categoryFromUrl = this.inferCategoryFromUrl(url)
    const categoryFromSemantics = this.inferCategoryFromPageSemantics(metadata.title, metadata.description)
    const category = categoryFromUrl ?? categoryFromSemantics ?? "other"

    const isPlaces = String(metadata.method || "").includes("places")
    const isJsonLd = String(metadata.method || "").includes("json_ld")

    return {
      draft: {
        name: metadata.title || url.hostname,
        address: metadata.address,
        city: metadata.city || "Unknown",
        country,
        continent,
        coordinates: metadata.coordinates || { lat: 0, lng: 0 },
        category,
        link: url.toString(),
        googlePlaceId: metadata.googlePlaceId,
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
          // Never treat a "complete-looking" address (postcode + city) as high confidence.
          // Elevate only when it comes from Places or JSON-LD.
          address: metadata.address ? (isPlaces || isJsonLd ? "high" : "low") : "low",
          coordinates: metadata.coordinates ? (isPlaces || isJsonLd ? "high" : "low") : "low",
          city: metadata.city ? (isPlaces || isJsonLd ? "high" : "low") : "low",
          country: metadata.country ? (isPlaces || isJsonLd ? "high" : "low") : "low",
          continent: metadata.country ? (isPlaces || isJsonLd ? "high" : "low") : "low",
          category: categoryFromUrl ? "high" : categoryFromSemantics ? "medium" : "low",
          link: "high",
        },
        // Always require confirmation for generic websites since data is unreliable
        requiresConfirmation: true,
        warnings: metadata.warnings,
        flags: metadata.flags,
        signals: {
          ...(metadata.jsonLdTypes ? { jsonLdTypes: metadata.jsonLdTypes as string[] } : {}),
          ...(metadata.openGraph ? { openGraph: metadata.openGraph as Record<string, string> } : {}),
        },
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

  private async placesSearchText(query: string): Promise<any[] | null> {
    if (!this.googleApiKey) return null
    const url = "https://places.googleapis.com/v1/places:searchText"
    const fieldMask = [
      "places.id",
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
      body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) return null
    const places = Array.isArray((data as any).places) ? (data as any).places : []
    if (places.length === 0) return null
    // Caller will choose a best match.
    return places
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
        const signals = this.buildSoftLocationSignals(url, derivedTitle)
        const places = derivedTitle ? await this.placesSearchText(this.buildPlacesQuery(derivedTitle, signals)) : null
        const selection = Array.isArray(places) ? this.selectPlaceCandidate(places, signals) : null
        if (selection?.place) {
          const place = selection.place
          const country = this.extractCountryFromPlace(place)
          const city = this.extractCityFromPlace(place)
          return {
            title: place.displayName?.text || derivedTitle,
            address: place.formattedAddress,
            city,
            country,
              googlePlaceId: place.id,
            coordinates:
              place.location && typeof place.location.latitude === "number" && typeof place.location.longitude === "number"
                ? { lat: place.location.latitude, lng: place.location.longitude }
                : undefined,
            description: undefined,
            method: "places_search_text",
            flags: selection.flags,
            warnings: [
              `Website blocked automated fetching (HTTP ${response.status}); used Google Places search — please confirm details`,
              ...selection.warnings,
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
        const signals = this.buildSoftLocationSignals(url, jsonLd.title)
        // If JSON-LD exists but lacks a reliable location, we can optionally use Places to fill gaps.
        const needsPlaces =
          this.googleApiKey &&
          (!jsonLd.address || !jsonLd.city || !jsonLd.country || !jsonLd.coordinates) &&
          Boolean(jsonLd.title)

        if (needsPlaces) {
          const places = await this.placesSearchText(this.buildPlacesQuery(jsonLd.title, signals))
          const selection = Array.isArray(places) ? this.selectPlaceCandidate(places, signals) : null
          if (selection?.place) {
            const place = selection.place
            return {
              title: jsonLd.title,
              address: place.formattedAddress,
              city: this.extractCityFromPlace(place) ?? jsonLd.city,
              country: this.extractCountryFromPlace(place) ?? jsonLd.country,
              googlePlaceId: place.id,
              coordinates:
                place.location && typeof place.location.latitude === "number" && typeof place.location.longitude === "number"
                  ? { lat: place.location.latitude, lng: place.location.longitude }
                  : jsonLd.coordinates,
              description: jsonLd.description,
              method: "json_ld+places_search_text",
              flags: selection.flags,
              warnings: [
                "Filled missing location details via Google Places search; please confirm details.",
                ...selection.warnings,
              ],
              jsonLdTypes: jsonLd.jsonLdTypes,
            }
          }
        }

        // Even if JSON-LD has an address, try to resolve a Google Place ID using name+address
        // so we can fetch authoritative opening hours from Google.
        if (this.googleApiKey && jsonLd.address && !jsonLd.googlePlaceId) {
          const places = await this.placesSearchText(`${jsonLd.title} ${jsonLd.address}`)
          const selection = Array.isArray(places)
            ? this.selectPlaceCandidateByNameAddress(places, {
                title: jsonLd.title,
                address: jsonLd.address,
              })
            : null
          if (selection?.place) {
            const place = selection.place
            return {
              title: jsonLd.title,
              address: place.formattedAddress ?? jsonLd.address,
              city: this.extractCityFromPlace(place) ?? jsonLd.city,
              country: this.extractCountryFromPlace(place) ?? jsonLd.country,
              googlePlaceId: place.id,
              coordinates:
                place.location && typeof place.location.latitude === "number" && typeof place.location.longitude === "number"
                  ? { lat: place.location.latitude, lng: place.location.longitude }
                  : jsonLd.coordinates,
              description: jsonLd.description,
              method: "json_ld+places_search_name_address",
              flags: selection.flags,
              warnings: [
                "Matched this website to a Google Place ID to fetch authoritative opening hours — please confirm details.",
                ...selection.warnings,
              ],
              jsonLdTypes: jsonLd.jsonLdTypes,
            }
          }
        }

        return { ...jsonLd, method: "json_ld", warnings: [], jsonLdTypes: jsonLd.jsonLdTypes }
      }

      // Fallback to OpenGraph
      const og = this.extractOpenGraph(html, url)
      console.log(`[Generic Website] OpenGraph extraction: ${og.title || 'No title found'}`)

      // Title fallback: if OG/meta title is missing or generic, try H1, then URL-derived title.
      const h1 = this.extractFirstH1(html)
      const title = og.title || (h1 ? this.cleanTitle(h1, url) : undefined) || this.titleFromUrl(url)

      // Build signals AFTER we know the best title — important for sites like louvre.fr/en where the URL path is generic.
      const signals = this.buildSoftLocationSignals(url, title)

      // Heuristic address extraction from visible text when no JSON-LD address exists.
      const heuristic = this.extractAddressHeuristics(html, signals.tokens)
      const heuristicWarnings: string[] = []
      if ((heuristic as any)?._ambiguous === true) {
        heuristicWarnings.push(
          "This page appears to list multiple locations/addresses. Roamo couldn’t confidently pick the right branch from the page content."
        )
      }

      // If URL/title includes branch-like tokens (e.g. "mayfair") but extracted location doesn't reflect them,
      // treat this as a contradiction and avoid accepting the heuristic address/city as truth.
      const contradiction =
        signals.tokens.length > 0 &&
        title &&
        this.hasTokenSignal(title, signals.tokens) &&
        this.locationMismatch({ address: heuristic.address, city: heuristic.city }, signals.tokens)

      if (contradiction) {
        ;(heuristic as any)._ambiguous = true
        heuristicWarnings.push(
          "This place likely has multiple branches (URL implies a specific area). Please confirm the correct location."
        )
      }

      // If we still don't have a confident location, try Places search with URL tokens as disambiguation.
      const missingLocation =
        this.googleApiKey &&
        title &&
        (
          !heuristic.address ||
          !heuristic.city ||
          !heuristic.country ||
          (heuristic as any)?._ambiguous === true
        )

      if (missingLocation && title) {
        const places = await this.placesSearchText(this.buildPlacesQuery(title, signals))
        const selection = Array.isArray(places) ? this.selectPlaceCandidate(places, signals) : null
        if (selection?.place) {
          const place = selection.place
          const country = this.extractCountryFromPlace(place)
          const city = this.extractCityFromPlace(place)
          return {
            ...og,
            title,
            address: place.formattedAddress,
            city,
            country,
            googlePlaceId: place.id,
            coordinates:
              place.location && typeof place.location.latitude === "number" && typeof place.location.longitude === "number"
                ? { lat: place.location.latitude, lng: place.location.longitude }
                : undefined,
            description: og.description,
            method: "opengraph+places_search_text",
            warnings: [
              "Location details were filled via Google Places search; please confirm details (multi-location brands may match a different branch).",
              ...heuristicWarnings,
              ...selection.warnings,
            ],
            flags: selection.flags,
          }
        }

        // Places search couldn't confidently disambiguate — don't guess.
        if ((heuristic as any)?._ambiguous === true) {
          return {
            ...og,
            title,
            method: "opengraph",
            warnings: [
              ...heuristicWarnings,
              "Could not confidently match a specific branch. Please select the correct location manually.",
            ],
            flags: {
              ...(contradiction ? { location_conflict: true } : {}),
              multi_location_brand: true,
            },
            openGraph: og.openGraph,
          }
        }
      }

      // NEW: Even if we extracted an address/city/country heuristically, try to resolve a Google Place ID
      // using name + address so we can fetch authoritative opening hours.
      const canResolvePlaceId =
        this.googleApiKey &&
        title &&
        heuristic.address &&
        !(heuristic as any)?._ambiguous &&
        !("googlePlaceId" in heuristic)

      if (canResolvePlaceId && title) {
        const places = await this.placesSearchText(`${title} ${heuristic.address}`)
        const selection = Array.isArray(places)
          ? this.selectPlaceCandidateByNameAddress(places, { title, address: heuristic.address })
          : null
        if (selection?.place) {
          const place = selection.place
          return {
            ...og,
            title,
            address: place.formattedAddress ?? heuristic.address,
            city: this.extractCityFromPlace(place) ?? heuristic.city,
            country: this.extractCountryFromPlace(place) ?? heuristic.country,
            googlePlaceId: place.id,
            coordinates:
              place.location && typeof place.location.latitude === "number" && typeof place.location.longitude === "number"
                ? { lat: place.location.latitude, lng: place.location.longitude }
                : heuristic.coordinates,
            description: og.description,
            method: "opengraph+places_search_name_address",
            warnings: [
              "Matched this website to a Google Place ID to fetch authoritative opening hours — please confirm details.",
              ...heuristicWarnings,
              ...(selection?.warnings ?? []),
            ],
            flags: selection.flags,
          }
        }
      }

      return {
        ...og,
        title,
        ...heuristic,
        method: "opengraph",
        warnings: [
          ...(og.title
          ? ["Limited structured data available from website — please confirm details"]
          : ["Could not extract meaningful data from website — please confirm details"]),
          ...heuristicWarnings,
        ],
        flags: contradiction ? { location_conflict: true } : undefined,
        openGraph: og.openGraph,
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


    const rawTypes = best?.["@type"]
    const jsonLdTypes = Array.isArray(rawTypes)
      ? rawTypes.map((t: any) => String(t))
      : rawTypes
        ? [String(rawTypes)]
        : []

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
      jsonLdTypes,
    }
  }

  private selectPlaceCandidateByNameAddress(
    places: any[],
    input: { title: string; address: string }
  ): { place: any | null; flags: any; warnings: string[] } {
    const flags: any = {}
    const warnings: string[] = []
    if (!Array.isArray(places) || places.length === 0) {
      flags.insufficient_signals = true
      return { place: null, flags, warnings }
    }

    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()

    const titleTokens = norm(input.title)
      .split(" ")
      .filter((t) => t.length >= 3)
      .slice(0, 8)

    const addrTokens = norm(input.address)
      .split(" ")
      .filter((t) => t.length >= 3 || /^\d+$/.test(t))
      .slice(0, 16)

    const scorePlace = (p: any) => {
      const hay = norm(`${p?.displayName?.text ?? ""} ${p?.formattedAddress ?? ""}`)
      let score = 0
      for (const t of titleTokens) if (hay.includes(t)) score += 2
      for (const t of addrTokens) {
        if (hay.includes(t)) score += /^\d+$/.test(t) ? 5 : 3
      }
      return score
    }

    const ranked = places.map((p) => ({ p, s: scorePlace(p) })).sort((a, b) => b.s - a.s)
    const top = ranked[0]
    const second = ranked[1]

    if (!top || top.s < 10) {
      flags.insufficient_signals = true
      warnings.push("Could not confidently match this address to a Google Place ID.")
      return { place: null, flags, warnings }
    }

    if (second && top.s - second.s < 4) {
      flags.multi_location_brand = true
      warnings.push("Google Places match was ambiguous; please confirm the correct place.")
      return { place: null, flags, warnings }
    }

    if (!top.p?.id) {
      flags.insufficient_signals = true
      return { place: null, flags, warnings }
    }

    return { place: top.p, flags, warnings }
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
      openGraph: {
        ...(ogTitleMatch?.[1] ? { "og:title": this.decodeHtmlEntities(ogTitleMatch[1].trim()) } : {}),
        ...(ogDescMatch?.[1] ? { "og:description": this.decodeHtmlEntities(ogDescMatch[1].trim()) } : {}),
        ...(ogImageMatch?.[1] ? { "og:image": this.decodeHtmlEntities(ogImageMatch[1].trim()) } : {}),
        ...(metaTitleMatch?.[1] ? { "meta:title": this.decodeHtmlEntities(metaTitleMatch[1].trim()) } : {}),
        ...(metaDescMatch?.[1] ? { "meta:description": this.decodeHtmlEntities(metaDescMatch[1].trim()) } : {}),
      },
    }
  }

  private extractAddressHeuristics(
    html: string,
    preferTokens: string[]
  ): {
    address?: string
    city?: string
    country?: string
    coordinates?: { lat: number; lng: number }
  } {
    // Very lightweight heuristics for sites without JSON-LD.
    const text = this.stripTags(html)

    const windowMatchesTokens = (idx: number) => {
      if (!preferTokens.length) return 0
      const start = Math.max(0, idx - 200)
      const end = Math.min(text.length, idx + 200)
      const window = text.slice(start, end).toLowerCase()
      let score = 0
      for (const t of preferTokens) {
        if (t.length >= 3 && window.includes(t.toLowerCase())) score++
      }
      return score
    }

    // UK postcode pattern (captures likely address lines). We intentionally do NOT take the first match
    // because multi-location brands often list many addresses on one page.
    const ukRe = /(\d{1,5}\s+[A-Za-z0-9 .'\-]+,\s*[A-Za-z .'\-]+,\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/gi
    const ukMatches = [...text.matchAll(ukRe)].slice(0, 8)
    if (ukMatches.length > 0) {
      const scored = ukMatches
        .map((m) => ({ addr: m[1].trim(), idx: m.index ?? 0, score: windowMatchesTokens(m.index ?? 0) }))
        .sort((a, b) => b.score - a.score)

      // If we have multiple addresses and none align with the URL location tokens, don't guess.
      if (ukMatches.length > 1 && scored[0].score === 0) {
        return { _ambiguous: true } as any
      }

      const best = scored[0]
      const parts = best.addr.split(",").map((x) => x.trim())
      const city = parts.length >= 2 ? parts[parts.length - 2] : undefined
      return { address: best.addr, city, country: "United Kingdom" }
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

  private hasTokenSignal(text: string, tokens: string[]): boolean {
    const hay = text.toLowerCase()
    return tokens.some((t) => t.length >= 3 && hay.includes(t.toLowerCase()))
  }

  private locationMismatch(
    location: { address?: string; city?: string },
    preferTokens: string[]
  ): boolean {
    if (preferTokens.length === 0) return false
    const hay = `${location.city ?? ""} ${location.address ?? ""}`.toLowerCase()
    // If we have a concrete city/address but it contains none of the expanded tokens,
    // treat it as a mismatch (likely wrong branch for multi-location brands).
    const hasAny = preferTokens.some((t) => t.length >= 3 && hay.includes(t.toLowerCase()))
    const hasConcrete = Boolean((location.city && location.city.toLowerCase() !== "unknown") || location.address)
    return hasConcrete && !hasAny
  }

  private inferCategoryFromUrl(url: URL): SpotCategory | null {
    const p = url.pathname.toLowerCase()
    if (p.includes("/restaurants") || p.includes("/restaurant") || p.includes("/dining") || p.includes("/menu")) return "restaurant"
    if (p.includes("/cafes") || p.includes("/cafe")) return "cafe"
    if (p.includes("/bars") || p.includes("/bar")) return "bar"
    if (p.includes("/hotels") || p.includes("/hotel")) return "hotel"
    if (p.includes("/museums") || p.includes("/museum")) return "museum"
    if (p.includes("/parks") || p.includes("/park")) return "park"
    if (p.includes("/attractions") || p.includes("/attraction")) return "attraction"
    if (p.includes("/activities") || p.includes("/activity")) return "activity"
    if (p.includes("/events") || p.includes("/event")) return "event"
    if (p.includes("/shops") || p.includes("/shop")) return "shop"
    return null
  }

  private inferCategoryFromPageSemantics(title?: string, description?: string): SpotCategory | null {
    const t = `${title ?? ""} ${description ?? ""}`.toLowerCase()
    if (!t.trim()) return null
    // Strong, explicit signals
    if (/\bmuseum\b/.test(t) || /\bmusée\b/.test(t)) return "museum"
    if (/\bpark\b/.test(t) || /\bgarden\b/.test(t)) return "park"
    if (/\bhotel\b/.test(t) || /\brooms\b/.test(t) || /\bcheck-?in\b/.test(t)) return "hotel"
    if (/\bmenu\b/.test(t) || /\brestaurant\b/.test(t) || /\bdining\b/.test(t)) return "restaurant"
    if (/\bcafe\b/.test(t) || /\bcoffee\b/.test(t)) return "cafe"
    if (/\bbar\b/.test(t) || /\bcocktail\b/.test(t)) return "bar"
    if (/\bshop\b/.test(t) || /\bstore\b/.test(t) || /\bbuy\b/.test(t)) return "shop"
    if (/\btickets\b/.test(t) || /\bbook a ticket\b/.test(t)) return "attraction"
    return null
  }

  private extractLocationTokensFromUrl(url: URL): string[] {
    const rawSegments = url.pathname
      .split("/")
      .filter(Boolean)
      .slice(0, 10)
      .flatMap((seg) => seg.split("?")[0].split("#")[0].split(/[-_]+/g))
      .map((s) => decodeURIComponent(s).toLowerCase().trim())
      .filter(Boolean)

    const stop = new Set([
      "the",
      "and",
      "or",
      "a",
      "an",
      "of",
      "to",
      "in",
      "on",
      "for",
      "en",
      "en-us",
      "fr",
      "de",
      "it",
      "es",
      "pt",
      "restaurants",
      "restaurant",
      "locations",
      "location",
      "overview",
      "home",
    ])

    // Prefer the last meaningful segment tokens (often the branch slug), but keep a few others.
    const filtered = rawSegments.filter((t) => t.length >= 3 && !stop.has(t))
    const lastSeg = url.pathname.split("/").filter(Boolean).pop() ?? ""
    const lastTokens = lastSeg
      .split(/[-_]+/g)
      .map((t) => decodeURIComponent(t).toLowerCase().trim())
      .filter((t) => t.length >= 3 && !stop.has(t))

    const combined = [...new Set([...lastTokens, ...filtered])].slice(0, 10)
    return combined
  }

  private buildPlacesQuery(baseTitle: string, signals: { tokens: string[] }): string {
    // Branch-aware query: append URL/title-derived tokens to disambiguate multi-location brands.
    const tokenStr = signals.tokens.length ? ` ${signals.tokens.join(" ")}` : ""
    return `${baseTitle}${tokenStr}`.trim()
  }

  private buildSoftLocationSignals(url: URL, title?: string): { tokens: string[]; domainTokens: string[] } {
    const urlTokens = this.extractLocationTokensFromUrl(url)
    const titleTokens =
      title
        ? title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, " ")
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length >= 3)
            .slice(0, 12)
        : []

    const domain = url.hostname.replace(/^www\./, "").toLowerCase()
    const domainTokens = domain.split(".").flatMap((p) => p.split(/[-_]/g)).filter((t) => t.length >= 3)

    const stop = new Set([
      "the",
      "and",
      "for",
      "with",
      "from",
      "restaurant",
      "restaurants",
      "dining",
      "menu",
      "home",
      "homepage",
      "overview",
      "book",
      "booking",
      "tickets",
      "ticket",
      "location",
      "locations",
      "contact",
    ])

    const combined = [...new Set([...urlTokens, ...titleTokens])]
      .filter((t) => !stop.has(t))
      .slice(0, 10)

    return { tokens: combined, domainTokens }
  }

  private selectPlaceCandidate(
    places: any[],
    signals: { tokens: string[]; domainTokens: string[] }
  ): { place: any | null; flags: any; warnings: string[] } {
    const flags: any = {}
    const warnings: string[] = []
    if (!Array.isArray(places) || places.length === 0) {
      flags.insufficient_signals = true
      return { place: null, flags, warnings }
    }

    if (!signals.tokens.length) {
      // Without any tokens, choosing a branch is risky for global multi-location brands.
      flags.insufficient_signals = true
      warnings.push("Not enough location signals in URL/title to confidently choose a branch from Places results.")
      return { place: null, flags, warnings }
    }

    const tokens = signals.tokens.map((t) => t.toLowerCase())
    const domainTokens = new Set(signals.domainTokens.map((t) => t.toLowerCase()))

    const weight = (t: string) => (domainTokens.has(t) ? 1 : 3)

    const scorePlace = (p: any) => {
      const hay = `${p?.displayName?.text ?? ""} ${p?.formattedAddress ?? ""}`.toLowerCase()
      let score = 0
      for (const t of tokens) {
        if (hay.includes(t)) score += weight(t)
      }
      return score
    }

    const ranked = places
      .map((p) => ({ p, s: scorePlace(p) }))
      .sort((a, b) => b.s - a.s)

    const top = ranked[0]
    const second = ranked[1]

    if (!top || top.s === 0) {
      flags.insufficient_signals = true
      warnings.push("Places results did not align with URL/title signals; location was not auto-filled.")
      return { place: null, flags, warnings }
    }

    const tied = ranked.filter((r) => r.s === top.s)
    if (tied.length > 1) {
      flags.multi_location_brand = true
      warnings.push("Multiple Places results matched equally well; please confirm the correct branch.")
      return { place: null, flags, warnings }
    }

    if (second && top.s - second.s < 2) {
      flags.multi_location_brand = true
      warnings.push("Places results were ambiguous; please confirm the correct branch.")
      return { place: null, flags, warnings }
    }

    return { place: top.p, flags, warnings }
  }
}
