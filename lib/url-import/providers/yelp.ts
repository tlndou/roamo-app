import type { ProviderResult } from "@/lib/url-import/providers/types"
import type { ImportedSpotDraft } from "@/lib/url-import/extract-spot-from-url"
import { getCountryContinent } from "@/lib/country-utils"

type YelpBusiness = {
  name?: string
  url?: string
  image_url?: string
  categories?: Array<{ alias?: string; title?: string }>
  location?: { address1?: string; city?: string; country?: string; display_address?: string[] }
  coordinates?: { latitude?: number; longitude?: number }
  price?: string
}

function mapYelpCategoriesToCategory(categories: YelpBusiness["categories"]): ImportedSpotDraft["category"] {
  const titles = (categories ?? []).map((c) => (c.title ?? "").toLowerCase())
  const has = (re: RegExp) => titles.some((t) => re.test(t))
  if (has(/restaurant|diner|bistro|sushi|ramen|pizza|steak/)) return "restaurant"
  if (has(/cafe|coffee|tea/)) return "cafe"
  if (has(/bar|pub|cocktail|brewery/)) return "bar"
  if (has(/museum|gallery/)) return "museum"
  if (has(/park|garden/)) return "park"
  if (has(/hotel|hostel|resort/)) return "hotel"
  if (has(/nightlife|club/)) return "club"
  if (has(/shopping|store|market/)) return "shop"
  return "other"
}

export async function importFromYelp(match: { url: URL; businessId?: string }): Promise<ProviderResult> {
  const apiKey = process.env.YELP_API_KEY
  if (!apiKey || !match.businessId) {
    throw new Error("Yelp API not configured or businessId missing")
  }

  const res = await fetch(`https://api.yelp.com/v3/businesses/${encodeURIComponent(match.businessId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Yelp API failed (${res.status})`)
  const data = (await res.json()) as YelpBusiness

  const address = data.location?.display_address?.join(", ") ?? data.location?.address1
  const draft: ImportedSpotDraft = {
    link: data.url ?? match.url.toString(),
    name: data.name,
    address,
    city: data.location?.city,
    country: data.location?.country,
    continent: data.location?.country ? getCountryContinent(data.location.country) : undefined,
    category: mapYelpCategoriesToCategory(data.categories),
    useCustomImage: Boolean(data.image_url),
    customImage: data.image_url,
    iconColor: "grey",
    visited: false,
    comments: ["Imported from Yelp:", match.url.toString(), data.price ? `\nPrice: ${data.price}` : ""].filter(Boolean).join("\n"),
    coordinates:
      typeof data.coordinates?.latitude === "number" && typeof data.coordinates?.longitude === "number"
        ? { lat: data.coordinates.latitude, lng: data.coordinates.longitude }
        : undefined,
  }

  return { kind: "yelp", draft, source: "api" }
}


