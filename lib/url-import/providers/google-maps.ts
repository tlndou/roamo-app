import type { ProviderResult } from "@/lib/url-import/providers/types"
import type { ImportedSpotDraft } from "@/lib/url-import/extract-spot-from-url"
import { getCountryContinent } from "@/lib/country-utils"

type GooglePlaceDetails = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  websiteUri?: string
  types?: string[]
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  priceLevel?: string
  photos?: Array<{ name?: string }>
}

function mapGoogleTypesToCategory(types: string[] | undefined): ImportedSpotDraft["category"] {
  const t = (types ?? []).map((x) => x.toLowerCase())
  const has = (s: string) => t.includes(s)

  if (has("restaurant") || has("food") || has("meal_takeaway") || has("meal_delivery")) return "restaurant"
  if (has("cafe") || has("coffee_shop")) return "cafe"
  if (has("bar")) return "bar"
  if (has("museum") || has("art_gallery")) return "museum"
  if (has("park")) return "park"
  if (has("tourist_attraction") || has("point_of_interest") || has("landmark")) return "attraction"
  if (has("lodging") || has("hotel")) return "hotel"
  if (has("night_club")) return "club"
  if (has("store") || has("shopping_mall")) return "shop"
  return "other"
}

function parseCityCountryFromFormattedAddress(formattedAddress: string | undefined): { city?: string; country?: string } {
  const a = formattedAddress?.trim()
  if (!a) return {}
  // Heuristic: take last token as country, and the token before as city-ish.
  const parts = a.split(",").map((x) => x.trim()).filter(Boolean)
  if (parts.length < 2) return {}
  const country = parts[parts.length - 1]
  const city = parts[parts.length - 2]
  return { city, country }
}

export async function importFromGoogleMaps(match: { url: URL; placeId?: string }): Promise<ProviderResult> {
  // Uses Google Places API (New) only when configured; otherwise caller should fallback to HTML importer.
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey || !match.placeId) {
    throw new Error("Google Maps API not configured or placeId missing")
  }

  const fields = [
    "id",
    "displayName",
    "formattedAddress",
    "location",
    "websiteUri",
    "types",
    "regularOpeningHours",
    "priceLevel",
    "photos",
  ].join(",")

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(match.placeId)}?fields=${encodeURIComponent(fields)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields,
    },
    cache: "no-store",
  })

  if (!res.ok) throw new Error(`Google Places API failed (${res.status})`)
  const data = (await res.json()) as GooglePlaceDetails

  const { city, country } = parseCityCountryFromFormattedAddress(data.formattedAddress)
  const continent = country ? getCountryContinent(country) : undefined

  const hours = data.regularOpeningHours?.weekdayDescriptions?.join("\n")
  const commentsLines: string[] = []
  commentsLines.push("Imported from Google Maps:")
  commentsLines.push(match.url.toString())
  if (hours) commentsLines.push("", "Hours:", hours)
  if (data.priceLevel) commentsLines.push("", `Price level: ${data.priceLevel}`)
  const comments = commentsLines.join("\n")

  const draft: ImportedSpotDraft = {
    link: data.websiteUri ?? match.url.toString(),
    name: data.displayName?.text,
    address: data.formattedAddress,
    city,
    country,
    continent,
    category: mapGoogleTypesToCategory(data.types),
    comments,
    visited: false,
    iconColor: "grey",
    useCustomImage: false,
    coordinates:
      typeof data.location?.latitude === "number" && typeof data.location?.longitude === "number"
        ? { lat: data.location.latitude, lng: data.location.longitude }
        : undefined,
  }

  return { kind: "google_maps", draft, source: "api" }
}


