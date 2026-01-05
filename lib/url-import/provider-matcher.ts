import { ProviderType, ProviderMatch } from "@/types/providers"

export function detectProvider(url: URL): ProviderMatch {
  const hostname = url.hostname.toLowerCase()
  const pathname = url.pathname

  // Google Maps
  if (
    (hostname.includes("google.com") || hostname === "maps.app.goo.gl") &&
    (pathname.includes("/maps") || url.searchParams.has("q") || hostname === "maps.app.goo.gl")
  ) {
    const placeId =
      url.searchParams.get("place_id") ||
      url.searchParams.get("query_place_id") ||
      extractPlaceIdFromPath(pathname)
    return {
      type: "google_maps",
      confidence: placeId ? "high" : "medium",
      placeId: placeId || undefined,
    }
  }

  // Instagram
  if (hostname.includes("instagram.com")) {
    const handle = pathname.split("/")[1]
    return {
      type: "instagram",
      confidence: "low", // Social media = low confidence
      handle,
    }
  }

  // TikTok
  if (hostname.includes("tiktok.com")) {
    const handle = pathname.split("@")[1]?.split("/")[0]
    return {
      type: "tiktok",
      confidence: "low", // Social media = low confidence
      handle,
    }
  }

  // Official website (fallback)
  return {
    type: "official_website",
    confidence: "medium",
  }
}

function extractPlaceIdFromPath(pathname: string): string | null {
  // Extract from paths like /maps/place/Name/data=...!1s<PLACE_ID>
  // WARNING: Google Maps URLs can contain multiple `!1s...` segments.
  // Some of them are "feature ids" (e.g. `0x...:0x...`) which are NOT valid Place IDs.
  // Place IDs typically start with "ChI" (and sometimes "GhI").
  const candidates = [...pathname.matchAll(/!1s([^!]+)/g)].map((m) => m[1])
  const placeId = candidates.find((c) => /^ChI/.test(c) || /^GhI/.test(c))
  return placeId ?? null
}
