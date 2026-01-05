import type { Spot, SpotCategory } from "@/types/spot"
import { getCountryContinent } from "@/lib/country-utils"

export type ImportedSpotDraft = Partial<Omit<Spot, "id">> & {
  link: string
}

export type ImportConfidenceLevel = "high" | "medium" | "low" | "none"

export type ImportMeta = {
  provider: "google_maps" | "yelp" | "opentable" | "tripadvisor" | "generic"
  source: "api" | "html"
  resolvedUrl: string
  confidence: {
    name: ImportConfidenceLevel
    location: ImportConfidenceLevel
    category: ImportConfidenceLevel
  }
  warnings: string[]
}

async function resolveFinalUrl(inputUrl: string): Promise<string> {
  // Resolve short links (e.g. maps.app.goo.gl) without downloading full bodies.
  try {
    const controller = new AbortController()
    const res = await fetch(inputUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })
    const finalUrl = res.url || inputUrl
    try {
      res.body?.cancel()
    } catch {
      // ignore
    }
    return finalUrl
  } catch {
    return inputUrl
  }
}

function computeConfidence(input: {
  name?: string
  nameSource?: "api" | "jsonld" | "meta" | "none"
  city?: string
  country?: string
  coords?: { lat?: number; lng?: number }
  locationSource?: "api" | "coords" | "jsonld_address" | "meta" | "none"
  category?: SpotCategory
  categorySource?: "api" | "jsonld_type" | "heuristic" | "none"
}): ImportMeta["confidence"] {
  const name =
    input.nameSource === "api" || input.nameSource === "jsonld"
      ? "high"
      : input.nameSource === "meta"
        ? "medium"
        : "none"

  const hasCoords = typeof input.coords?.lat === "number" && typeof input.coords?.lng === "number"
  const hasCityCountry = Boolean(toStr(input.city) && toStr(input.country))
  const location =
    input.locationSource === "api"
      ? "high"
      : input.locationSource === "coords" && hasCoords
        ? "high"
        : input.locationSource === "jsonld_address" && hasCityCountry
          ? "medium"
          : input.locationSource === "meta" && (hasCoords || hasCityCountry)
            ? "low"
            : "none"

  const category =
    input.categorySource === "api"
      ? "high"
      : input.categorySource === "jsonld_type"
        ? "high"
        : input.categorySource === "heuristic"
          ? input.category && input.category !== "other"
            ? "medium"
            : "low"
          : "none"

  return { name, location, category }
}

// Public entrypoint used by the API route.
// (Kept in this file to avoid a larger refactor, but the implementation now routes to provider strategies.)
export async function importSpotDraftFromUrl(url: string): Promise<{ draft: ImportedSpotDraft; meta: ImportMeta }> {
  const { matchProvider } = await import("@/lib/url-import/providers/match")
  const { importFromGoogleMaps } = await import("@/lib/url-import/providers/google-maps")
  const { importFromYelp } = await import("@/lib/url-import/providers/yelp")

  const resolvedUrl = await resolveFinalUrl(url)
  const match = matchProvider(resolvedUrl)
  const warnings: string[] = []

  // Prefer provider APIs when configured; fall back to HTML metadata extractor.
  try {
    if (match.kind === "google_maps") {
      const res = await importFromGoogleMaps(match)
      const confidence = computeConfidence({
        name: res.draft.name,
        nameSource: "api",
        city: res.draft.city,
        country: res.draft.country,
        coords: { lat: res.draft.coordinates?.lat, lng: res.draft.coordinates?.lng },
        locationSource: "api",
        category: res.draft.category,
        categorySource: "api",
      })
      return {
        draft: res.draft,
        meta: { provider: "google_maps", source: "api", resolvedUrl, confidence, warnings },
      }
    }
    if (match.kind === "yelp") {
      const res = await importFromYelp(match)
      const confidence = computeConfidence({
        name: res.draft.name,
        nameSource: "api",
        city: res.draft.city,
        country: res.draft.country,
        coords: { lat: res.draft.coordinates?.lat, lng: res.draft.coordinates?.lng },
        locationSource: "api",
        category: res.draft.category,
        categorySource: "api",
      })
      return { draft: res.draft, meta: { provider: "yelp", source: "api", resolvedUrl, confidence, warnings } }
    }
    // OpenTable / TripAdvisor strategy hooks exist but require partner credentials.
  } catch {
    // swallow and fall back to generic HTML extraction
  }

  const extracted = await extractSpotDraftFromUrl(resolvedUrl)
  const confidence = computeConfidence({
    name: extracted.name,
    nameSource: extracted.name ? "meta" : "none",
    city: extracted.city,
    country: extracted.country,
    coords: { lat: extracted.coordinates?.lat, lng: extracted.coordinates?.lng },
    locationSource: extracted.coordinates ? "coords" : extracted.city || extracted.country ? "meta" : "none",
    category: extracted.category,
    categorySource: "heuristic",
  })

  if (confidence.name !== "high") warnings.push("Name needs confirmation")
  if (confidence.location !== "high") warnings.push("Location needs confirmation")
  if (confidence.category === "low") warnings.push("Category is a guess — please confirm")

  return { draft: extracted, meta: { provider: match.kind, source: "html", resolvedUrl, confidence, warnings } }
}

type OgData = {
  title?: string
  description?: string
  image?: string
  url?: string
  siteName?: string
  type?: string
  // Twitter card fallbacks
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
  // Location-ish tags (used by some publishers)
  locality?: string
  region?: string
  countryName?: string
  lat?: string
  lng?: string
}

type JsonLdAddress = {
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string | { name?: string }
}

type JsonLdGeo = {
  latitude?: number | string
  longitude?: number | string
}

type JsonLdPlaceLike = {
  "@type"?: string | string[]
  name?: string
  description?: string
  url?: string
  image?: string | string[] | { url?: string } | { url?: string }[]
  address?: JsonLdAddress | string
  geo?: JsonLdGeo
  latitude?: number | string
  longitude?: number | string
  // Commerce-ish
  servesCuisine?: string | string[]
  priceRange?: string
  openingHours?: string | string[]
  openingHoursSpecification?: unknown
}

function toStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined
  const s = v.trim()
  return s.length ? s : undefined
}

function absUrl(url: string | undefined, baseUrl: string): string | undefined {
  const u = toStr(url)
  if (!u) return undefined
  try {
    return new URL(u, baseUrl).toString()
  } catch {
    return undefined
  }
}

function decodeHtmlEntities(input: string): string {
  // Minimal decoder for common cases in meta tags.
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
}

function firstNonEmpty(...vals: Array<string | undefined>): string | undefined {
  for (const v of vals) {
    const s = toStr(v)
    if (s) return s
  }
  return undefined
}

function parseMetaTags(html: string): { og: OgData; title?: string; description?: string } {
  const og: OgData = {}
  let title: string | undefined
  let description: string | undefined

  // <title> ... </title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch?.[1]) title = stripTags(titleMatch[1])

  // <meta ...>
  // Capture property/name and content.
  const metaRe = /<meta\s+[^>]*?>/gi
  const metas = html.match(metaRe) ?? []
  for (const tag of metas) {
    const prop = tag.match(/\bproperty\s*=\s*["']([^"']+)["']/i)?.[1]
    const name = tag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1]
    const key = (prop ?? name)?.toLowerCase()
    if (!key) continue
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1]
    const value = toStr(content ? decodeHtmlEntities(content) : undefined)
    if (!value) continue

    if (key === "description") description = description ?? value
    if (key === "og:title") og.title = og.title ?? value
    if (key === "og:description") og.description = og.description ?? value
    if (key === "og:image" || key === "og:image:url") og.image = og.image ?? value
    if (key === "og:url") og.url = og.url ?? value
    if (key === "og:site_name") og.siteName = og.siteName ?? value
    if (key === "og:type") og.type = og.type ?? value

    // Twitter cards often have better titles/descriptions than <title>.
    if (key === "twitter:title") og.twitterTitle = og.twitterTitle ?? value
    if (key === "twitter:description") og.twitterDescription = og.twitterDescription ?? value
    if (key === "twitter:image" || key === "twitter:image:src") og.twitterImage = og.twitterImage ?? value

    // Location-ish Open Graph tags (not standardized; used by some sites).
    if (key === "og:locality") og.locality = og.locality ?? value
    if (key === "og:region") og.region = og.region ?? value
    if (key === "og:country-name") og.countryName = og.countryName ?? value

    // Facebook "place" tags (commonly present on pages representing a location).
    if (key === "place:location:latitude" || key === "og:latitude") og.lat = og.lat ?? value
    if (key === "place:location:longitude" || key === "og:longitude") og.lng = og.lng ?? value
  }

  return { og, title, description }
}

function normalizeSiteToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .trim()
}

function cleanTitleCandidate(
  candidate: string | undefined,
  ctx: { siteName?: string; hostname?: string }
): string | undefined {
  const raw = toStr(candidate)
  if (!raw) return undefined

  const site = toStr(ctx.siteName)
  const host = toStr(ctx.hostname)

  let s = raw
  // Strip common " - SiteName" / " | SiteName" / " • SiteName" patterns.
  const tokens = [site, host].filter(Boolean) as string[]
  for (const token of tokens) {
    const t = token.trim()
    if (!t) continue
    const re = new RegExp(`\\s*[-–|•:]\\s*${t.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`, "i")
    s = s.replace(re, "").trim()
  }

  // Reject if it's basically just the site.
  const norm = normalizeSiteToken(s)
  const bad = new Set(
    [site, host, site ? normalizeSiteToken(site) : "", host ? normalizeSiteToken(host) : ""]
      .filter(Boolean)
      .map((x) => normalizeSiteToken(x))
  )
  if (bad.has(norm)) return undefined

  // Very common generic titles we should never treat as a spot name.
  if (["instagram", "tiktok", "facebook", "x", "twitter", "youtube"].includes(norm)) return undefined

  return s.length >= 2 ? s : undefined
}

function parseJsonLd(html: string): JsonLdPlaceLike[] {
  // Extract <script type="application/ld+json">...</script>
  const scripts: string[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(re)) {
    if (match[1]) scripts.push(match[1])
  }

  const out: JsonLdPlaceLike[] = []
  for (const raw of scripts) {
    const text = raw.trim()
    if (!text) continue
    try {
      const json = JSON.parse(text) as unknown
      const pushOne = (v: unknown) => {
        if (v && typeof v === "object") out.push(v as JsonLdPlaceLike)
      }
      if (Array.isArray(json)) json.forEach(pushOne)
      else pushOne(json)
    } catch {
      // Some pages include multiple JSON objects concatenated; ignore for now.
    }
  }
  return out
}

function pickJsonLdPlace(jsonlds: JsonLdPlaceLike[]): JsonLdPlaceLike | undefined {
  const score = (obj: JsonLdPlaceLike): number => {
    const types = Array.isArray(obj["@type"]) ? obj["@type"] : obj["@type"] ? [obj["@type"]] : []
    const t = types.map((x) => String(x).toLowerCase())
    const placeish = ["place", "localbusiness", "restaurant", "foodestablishment", "touristattraction", "hotel", "barorpub", "cafeorcoffeeshop"]
    const hasName = Boolean(toStr(obj.name))
    const hasAddr = Boolean(obj.address)
    const hasGeo = Boolean(obj.geo || obj.latitude || obj.longitude)
    const typeScore = t.some((x) => placeish.some((p) => x.includes(p))) ? 4 : 0
    return typeScore + (hasName ? 2 : 0) + (hasAddr ? 1 : 0) + (hasGeo ? 1 : 0)
  }

  return [...jsonlds].sort((a, b) => score(b) - score(a))[0]
}

function normalizeCountry(country: string | undefined): string | undefined {
  const c = toStr(country)
  if (!c) return undefined
  // Very light normalization; keep as-is otherwise.
  if (c.length === 2) return c.toUpperCase()
  return c
}

function inferCategory(input: { og?: OgData; jsonld?: JsonLdPlaceLike; text?: string }): SpotCategory {
  const jsonTypes = input.jsonld?.["@type"]
  const types = Array.isArray(jsonTypes) ? jsonTypes : jsonTypes ? [jsonTypes] : []
  const t = types.map((x) => String(x).toLowerCase()).join(" ")
  const hay = `${t} ${input.og?.type ?? ""} ${input.og?.title ?? ""} ${input.og?.description ?? ""} ${input.jsonld?.name ?? ""} ${input.jsonld?.description ?? ""} ${input.text ?? ""}`.toLowerCase()

  const has = (re: RegExp) => re.test(hay)

  if (has(/\brestaurant\b|foodestablishment|diner|bistro|steakhouse|pizzeria|ramen|sushi/)) return "restaurant"
  if (has(/\bcafe\b|coffee|cafeorcoffeeshop|espresso/)) return "cafe"
  if (has(/\bbar\b|pub|barorpub|cocktail|speakeasy/)) return "bar"
  if (has(/\bmuseum\b|gallery|exhibit/)) return "museum"
  if (has(/\bpark\b|garden|botanical/)) return "park"
  if (has(/touristattraction|attraction|landmark|monument|temple|church|cathedral|viewpoint/)) return "attraction"
  if (has(/\bhotel\b|hostel|resort|lodging/)) return "hotel"
  if (has(/\bclub\b|nightclub|dance/)) return "club"
  if (has(/\bshop\b|store|boutique|market/)) return "shop"
  if (has(/\bevent\b|festival|concert|show/)) return "event"
  if (has(/\bactivity\b|experience|tour\b|workshop/)) return "activity"
  return "other"
}

function pickImageUrl(image: JsonLdPlaceLike["image"], baseUrl: string): string | undefined {
  if (!image) return undefined
  if (typeof image === "string") return absUrl(image, baseUrl)
  if (Array.isArray(image)) {
    const first = image[0]
    if (typeof first === "string") return absUrl(first, baseUrl)
    if (first && typeof first === "object" && "url" in first) return absUrl((first as { url?: string }).url, baseUrl)
  }
  if (typeof image === "object" && "url" in image) return absUrl((image as { url?: string }).url, baseUrl)
  return undefined
}

function parseGeo(jsonld: JsonLdPlaceLike): { lat?: number; lng?: number } {
  const latRaw = jsonld.geo?.latitude ?? jsonld.latitude
  const lngRaw = jsonld.geo?.longitude ?? jsonld.longitude
  const lat = typeof latRaw === "number" ? latRaw : typeof latRaw === "string" ? Number(latRaw) : undefined
  const lng = typeof lngRaw === "number" ? lngRaw : typeof lngRaw === "string" ? Number(lngRaw) : undefined
  return {
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
  }
}

function parseAddress(jsonld: JsonLdPlaceLike): { address?: string; city?: string; country?: string } {
  const addr = jsonld.address
  if (!addr) return {}
  if (typeof addr === "string") return { address: toStr(addr) }

  const country =
    typeof addr.addressCountry === "string"
      ? addr.addressCountry
      : addr.addressCountry && typeof addr.addressCountry === "object"
        ? addr.addressCountry.name
        : undefined

  const parts = [
    toStr(addr.streetAddress),
    toStr(addr.addressLocality),
    toStr(addr.addressRegion),
    toStr(addr.postalCode),
    toStr(country),
  ].filter(Boolean) as string[]

  return {
    address: parts.length ? parts.join(", ") : undefined,
    city: toStr(addr.addressLocality),
    country: normalizeCountry(toStr(country)),
  }
}

function buildComments(input: { description?: string; jsonld?: JsonLdPlaceLike; sourceUrl: string }): string | undefined {
  const lines: string[] = []
  lines.push("Imported from link:")
  lines.push(input.sourceUrl)

  const desc = toStr(input.description ?? input.jsonld?.description)
  if (desc) {
    lines.push("")
    lines.push(desc)
  }

  const cuisine = input.jsonld?.servesCuisine
  const cuisineText = Array.isArray(cuisine) ? cuisine.map((x) => String(x)).join(", ") : toStr(cuisine)
  if (cuisineText) lines.push("", `Cuisine: ${cuisineText}`)

  const priceRange = toStr(input.jsonld?.priceRange)
  if (priceRange) lines.push(`Price range: ${priceRange}`)

  const openingHours = input.jsonld?.openingHours
  const openingText = Array.isArray(openingHours) ? openingHours.join("; ") : toStr(openingHours)
  if (openingText) lines.push(`Hours: ${openingText}`)

  const out = lines.join("\n").trim()
  return out.length ? out : undefined
}

export async function extractSpotDraftFromUrl(url: string): Promise<ImportedSpotDraft> {
  const parsedUrl = new URL(url)
  const baseUrl = parsedUrl.toString()
  const hostname = normalizeSiteToken(parsedUrl.hostname)

  const res = await fetch(baseUrl, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers: {
      // Many sites gate metadata behind a UA check.
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  })

  const contentType = res.headers.get("content-type") ?? ""
  if (!res.ok) throw new Error(`Failed to fetch (${res.status})`)
  if (!contentType.toLowerCase().includes("text/html")) {
    // Still try reading body; some servers mislabel.
  }

  const html = await res.text()

  const { og, title, description } = parseMetaTags(html)
  const jsonlds = parseJsonLd(html)
  const jsonld = pickJsonLdPlace(jsonlds)

  const name = firstNonEmpty(
    cleanTitleCandidate(jsonld?.name, { siteName: og.siteName, hostname }),
    cleanTitleCandidate(og.title, { siteName: og.siteName, hostname }),
    cleanTitleCandidate(og.twitterTitle, { siteName: og.siteName, hostname }),
    cleanTitleCandidate(title, { siteName: og.siteName, hostname })
  )
  const desc = firstNonEmpty(og.description, og.twitterDescription, description, jsonld?.description)
  const link = absUrl(og.url, baseUrl) ?? baseUrl

  const img = absUrl(og.image, baseUrl) ?? absUrl(og.twitterImage, baseUrl) ?? pickImageUrl(jsonld?.image, baseUrl)

  const { address, city, country } = jsonld ? parseAddress(jsonld) : {}
  const geo = jsonld ? parseGeo(jsonld) : {}
  const metaLat = typeof og.lat === "string" ? Number(og.lat) : undefined
  const metaLng = typeof og.lng === "string" ? Number(og.lng) : undefined
  const metaGeo = {
    lat: Number.isFinite(metaLat) ? metaLat : undefined,
    lng: Number.isFinite(metaLng) ? metaLng : undefined,
  }

  const fallbackCity = toStr(og.locality)
  const fallbackCountry = normalizeCountry(toStr(og.countryName))

  const category = inferCategory({ og, jsonld, text: desc })

  const finalCity = city ?? fallbackCity
  const finalCountry = country ?? fallbackCountry

  const continent =
    finalCountry && finalCity
      ? getCountryContinent(finalCountry)
      : finalCountry
        ? getCountryContinent(finalCountry)
        : undefined

  const comments = buildComments({ description: desc, jsonld, sourceUrl: link })

  const draft: ImportedSpotDraft = {
    link,
    name,
    category,
    address,
    city: finalCity,
    country: finalCountry,
    continent,
    comments,
    useCustomImage: Boolean(img),
    customImage: img,
    iconColor: "grey",
    visited: false,
    coordinates:
      typeof geo.lat === "number" && typeof geo.lng === "number"
        ? { lat: geo.lat, lng: geo.lng }
        : typeof metaGeo.lat === "number" && typeof metaGeo.lng === "number"
          ? { lat: metaGeo.lat, lng: metaGeo.lng }
          : undefined,
  }

  return draft
}


