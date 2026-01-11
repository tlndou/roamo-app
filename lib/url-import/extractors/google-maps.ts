import { URLImportResult } from "@/types/url-import"
import { ProviderExtractor } from "@/types/providers"
import { getCountryContinent, normalizeCountryName } from "@/lib/country-utils"
import { SpotCategory } from "@/types/spot"

export class GoogleMapsExtractor implements ProviderExtractor {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  canHandle(url: URL): boolean {
    return (
      url.hostname.includes("google.com") && url.pathname.includes("/maps")
    )
  }

  async extract(url: URL): Promise<URLImportResult> {
    const placeId = this.extractPlaceId(url)

    if (!placeId) {
      // Many Google Maps share URLs don't contain a Place ID. In that case, we can still
      // do a highly accurate lookup using coordinates + the parsed name via Places API (New) searchText.
      const name = this.extractNameFallback(url) ?? "Google Maps"
      const coords = this.extractLatLng(url)

      if (coords && name !== "Google Maps") {
        const place = await this.searchByTextNear(name, coords.lat, coords.lng)
        if (place) {
          return this.toResultFromPlace(url, place, "places_api_new_search_text", true)
        }
      }

      // Fallback: confirmation-required minimal draft
      return {
        draft: {
          name,
          address: undefined,
          city: "Unknown",
          country: "Unknown",
          continent: "Unknown",
          coordinates: coords ?? { lat: 0, lng: 0 },
          category: "other",
          link: url.toString(),
          comments:
            "Google Maps link imported, but place details could not be extracted from the URL format.",
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
            coordinates: coords ? "medium" : "low",
            city: "low",
            country: "low",
            continent: "low",
            category: "low",
            link: "high",
          },
          requiresConfirmation: true,
          warnings: [
            "Google Maps link didn’t include a Place ID, and lookup via Places Search could not be completed.",
            "Please confirm details manually.",
          ],
          rawUrl: url.toString(),
          resolvedUrl: url.toString(),
        },
      }
    }

    // Use Places API (New)
    const placeDetails = await this.fetchPlaceDetails(placeId)

    const rawCountry = this.extractCountry(placeDetails.addressComponents)
    const country = normalizeCountryName(rawCountry)
    const continent = getCountryContinent(rawCountry)

    return this.toResultFromPlace(url, placeDetails, "places_api_new", false)
  }

  private extractPlaceId(url: URL): string | null {
    console.log(`[Google Maps] Extracting place_id from URL: ${url.toString()}`)

    const isPlaceId = (value: string) => /^ChI/.test(value) || /^GhI/.test(value)

    // Try query param first (e.g., ?place_id=ChIJ...)
    const qpPlaceId = url.searchParams.get("place_id") || url.searchParams.get("query_place_id")
    if (qpPlaceId && isPlaceId(qpPlaceId)) {
      console.log(`[Google Maps] Found place_id in query param: ${qpPlaceId}`)
      return qpPlaceId
    }

    // Some URLs use q=place_id:<PLACE_ID>
    const q = url.searchParams.get("q")
    if (q) {
      const qMatch = q.match(/^place_id:([^&]+)/i)
      if (qMatch?.[1] && isPlaceId(qMatch[1])) {
        console.log(`[Google Maps] Found place_id in q param: ${qMatch[1]}`)
        return qMatch[1]
      }
    }

    // Google often stores the place id inside the `data` query param, not the pathname.
    const dataParam = url.searchParams.get("data")
    if (dataParam) {
      const decoded = decodeURIComponent(dataParam)
      const dataCandidates = [...decoded.matchAll(/!1s([^!&]+)/g)].map((m) => m[1])
      const dataPlaceId = dataCandidates.find((c) => isPlaceId(c))
      if (dataPlaceId) {
        console.log(`[Google Maps] Found place_id in data param: ${dataPlaceId}`)
        return dataPlaceId
      }
    }

    // Try pathname extraction (e.g., /maps/place/...!1sChIJ...)
    const pathCandidates = [...url.pathname.matchAll(/!1s([^!]+)/g)].map((m) => m[1])
    const pathPlaceId = pathCandidates.find((c) => isPlaceId(c))
    if (pathPlaceId) {
      console.log(`[Google Maps] Found place_id in path: ${pathPlaceId}`)
      return pathPlaceId
    }

    // Try hash fragment (some Google Maps URLs use hash)
    const hash = url.hash
    if (hash) {
      const hashCandidates = [...hash.matchAll(/!1s([^!]+)/g)].map((m) => m[1])
      const hashPlaceId = hashCandidates.find((c) => isPlaceId(c))
      if (hashPlaceId) {
        console.log(`[Google Maps] Found place_id in hash: ${hashPlaceId}`)
        return hashPlaceId
      }
    }

    // Final fallback: scan full URL for any !1sChI... segment.
    const fullCandidates = [...url.toString().matchAll(/!1s([^!&]+)/g)].map((m) => m[1])
    const fullPlaceId = fullCandidates.find((c) => isPlaceId(c))
    if (fullPlaceId) {
      console.log(`[Google Maps] Found place_id in full URL: ${fullPlaceId}`)
      return fullPlaceId
    }

    console.error(`[Google Maps] Could not extract place_id. URL: ${url.toString()}`)
    return null
  }

  private extractNameFallback(url: URL): string | undefined {
    // Prefer /maps/place/<NAME>/...
    const placeMatch = url.pathname.match(/\/maps\/place\/([^\/]+)/i)
    const searchMatch = url.pathname.match(/\/maps\/search\/([^\/]+)/i)
    const raw = placeMatch?.[1] ?? searchMatch?.[1]
    if (raw) {
      try {
        const decoded = decodeURIComponent(raw.replaceAll("+", " ")).trim()
        if (decoded) return decoded
      } catch {
        const s = raw.replaceAll("+", " ").trim()
        if (s) return s
      }
    }

    const q = url.searchParams.get("q") ?? url.searchParams.get("query")
    if (q && !/^place_id:/i.test(q)) return q.trim() || undefined

    return undefined
  }

  private async fetchPlaceDetails(placeId: string): Promise<any> {
    // Places API (New): https://places.googleapis.com/v1/places/{placeId}
    // Requires Places API (New) enabled on the project.
    const fieldMask = [
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "types",
      "addressComponents",
      // Opening hours (if enabled for the Places (New) API project)
      // We will retry without this field if the API rejects the mask.
      "regularOpeningHours",
    ].join(",")

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=${encodeURIComponent(fieldMask)}`

    console.log(`[Google Maps] Fetching place details (Places API New) for: ${placeId}`)

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message =
        (data && typeof data === "object" && "error" in data && (data as any).error?.message) ||
        `HTTP ${response.status}`
      // If opening hours field isn't supported/allowed, retry with a minimal field mask
      const msgLower = String(message || "").toLowerCase()
      const looksLikeFieldMaskIssue =
        msgLower.includes("fieldmask") ||
        msgLower.includes("field mask") ||
        msgLower.includes("unknown field") ||
        msgLower.includes("invalid") ||
        msgLower.includes("regularopeninghours")
      if (looksLikeFieldMaskIssue) {
        const fallbackFieldMask = ["id", "displayName", "formattedAddress", "location", "types", "addressComponents"].join(",")
        const fallbackUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=${encodeURIComponent(
          fallbackFieldMask
        )}`
        const retry = await fetch(fallbackUrl, {
          signal: AbortSignal.timeout(10000),
          headers: {
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask": fallbackFieldMask,
          },
        })
        const retryData = await retry.json().catch(() => ({}))
        if (!retry.ok) {
          const retryMessage =
            (retryData && typeof retryData === "object" && "error" in retryData && (retryData as any).error?.message) ||
            `HTTP ${retry.status}`
          console.error(`[Google Maps] Places API (New) retry error:`, retryData)
          throw new Error(`Google Places API error: ${retry.status} - ${retryMessage}`)
        }
        return retryData
      }

      console.error(`[Google Maps] Places API (New) error:`, data)
      throw new Error(`Google Places API error: ${response.status} - ${message}`)
    }

    console.log(`[Google Maps] Successfully extracted: ${data?.displayName?.text || data?.name}`)
    return data
  }

  private toResultFromPlace(
    url: URL,
    place: any,
    method: "places_api_new" | "places_api_new_search_text",
    requiresConfirmation: boolean
  ): URLImportResult {
    const rawCountry = this.extractCountry(place.addressComponents)
    const country = normalizeCountryName(rawCountry)
    const continent = getCountryContinent(rawCountry)

    return {
      draft: {
        name: place.displayName?.text || place.name || "Unknown",
        address: place.formattedAddress,
        city: this.extractCity(place.addressComponents),
        country,
        continent,
        coordinates: {
          lat: place.location.latitude,
          lng: place.location.longitude,
        },
        category: this.inferCategory(place.types || []),
        openingHours: this.extractOpeningHours(place) ?? undefined,
        link: url.toString(),
        googlePlaceId: place.id || undefined,
        useCustomImage: false,
        iconColor: "grey",
        visited: false,
      },
      meta: {
        provider: "google_maps",
        method,
        confidence: {
          name: "high",
          address: "high",
          coordinates: "high",
          city: "high",
          country: "high",
          continent: "high",
          category: method === "places_api_new" ? "medium" : "medium",
          link: "high",
        },
        requiresConfirmation,
        warnings: requiresConfirmation
          ? ["Place details were found via search; please confirm they match the intended spot."]
          : [],
        signals: {
          googleTypes: Array.isArray(place.types) ? place.types : [],
        },
        rawUrl: url.toString(),
        resolvedUrl: url.toString(),
      },
    }
  }

  private extractOpeningHours(place: any): any | null {
    const roh = place?.regularOpeningHours
    if (!roh || typeof roh !== "object") return null

    const weekdayText = Array.isArray(roh.weekdayDescriptions)
      ? roh.weekdayDescriptions.filter((s: any) => typeof s === "string" && s.trim())
      : undefined

    const periodsRaw = Array.isArray(roh.periods) ? roh.periods : []
    const periods = periodsRaw
      .map((p: any) => {
        const open = p?.open
        const close = p?.close
        const openDay = typeof open?.day === "number" ? open.day : typeof open?.day === "string" ? Number(open.day) : null
        const openTime = typeof open?.time === "string" ? open.time : null
        if (openDay == null || !openTime) return null
        const out: any = { open: { day: openDay, time: openTime } }
        const closeDay = typeof close?.day === "number" ? close.day : typeof close?.day === "string" ? Number(close.day) : null
        const closeTime = typeof close?.time === "string" ? close.time : null
        if (closeDay != null && closeTime) out.close = { day: closeDay, time: closeTime }
        return out
      })
      .filter(Boolean)

    if ((!weekdayText || weekdayText.length === 0) && periods.length === 0) return null

    return { source: "google_places", ...(weekdayText ? { weekdayText } : {}), ...(periods.length ? { periods } : {}) }
  }

  private extractLatLng(url: URL): { lat: number; lng: number } | undefined {
    // From /@lat,lng,zoomz
    const atMatch = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (atMatch) {
      const lat = Number(atMatch[1])
      const lng = Number(atMatch[2])
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    }

    // From !3dLAT!4dLNG segments (can appear in path or query `data`)
    const full = url.toString()
    const dMatch = full.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    if (dMatch) {
      const lat = Number(dMatch[1])
      const lng = Number(dMatch[2])
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    }

    return undefined
  }

  private async searchByTextNear(textQuery: string, lat: number, lng: number): Promise<any | null> {
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
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        textQuery,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 500.0,
          },
        },
        maxResultCount: 1,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message =
        (data && typeof data === "object" && "error" in data && (data as any).error?.message) ||
        `HTTP ${response.status}`
      throw new Error(`Google Places API error: ${response.status} - ${message}`)
    }

    const place = Array.isArray((data as any).places) ? (data as any).places[0] : undefined
    return place ?? null
  }

  private extractCity(addressComponents: any[] | undefined): string {
    const components = Array.isArray(addressComponents) ? addressComponents : []
    const cityComponent = components.find((c: any) =>
      Array.isArray(c.types) &&
      (c.types.includes("locality") ||
        c.types.includes("postal_town") ||
        c.types.includes("administrative_area_level_2") ||
        c.types.includes("administrative_area_level_1"))
    )
    return cityComponent?.longText || cityComponent?.shortText || "Unknown"
  }

  private extractCountry(addressComponents: any[] | undefined): string {
    const components = Array.isArray(addressComponents) ? addressComponents : []
    const countryComponent = components.find((c: any) =>
      Array.isArray(c.types) && c.types.includes("country")
    )
    return countryComponent?.longText || countryComponent?.shortText || "Unknown"
  }

  private inferCategory(types: string[]): SpotCategory {
    // Map Google Place types to SpotCategory
    const categoryMap: Record<string, SpotCategory> = {
      restaurant: "restaurant",
      cafe: "cafe",
      bar: "bar",
      night_club: "club",
      museum: "museum",
      park: "park",
      tourist_attraction: "attraction",
      lodging: "hotel",
      store: "shop",
    }

    for (const type of types) {
      if (categoryMap[type]) {
        return categoryMap[type]
      }
    }

    return "other"
  }
}
