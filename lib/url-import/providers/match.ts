import type { ProviderMatch } from "@/lib/url-import/providers/types"

function hostEndsWith(host: string, suffix: string) {
  return host === suffix || host.endsWith(`.${suffix}`)
}

function findFirstMatch(text: string, re: RegExp): string | undefined {
  const m = text.match(re)
  return m?.[1]
}

export function matchProvider(inputUrl: string): ProviderMatch {
  const url = new URL(inputUrl)
  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  const path = url.pathname

  // Google Maps
  // - place_id sometimes appears as query param
  // - URLs can include "!1s<placeId>" fragments; we support a couple common shapes
  if (
    (hostEndsWith(host, "google.com") && (path.startsWith("/maps") || host.startsWith("maps."))) ||
    host === "maps.app.goo.gl"
  ) {
    const placeId = url.searchParams.get("place_id") ?? undefined
    const cid = url.searchParams.get("cid") ?? undefined
    const altPlaceId =
      placeId ??
      findFirstMatch(url.toString(), /[?&]q=place_id:([^&]+)/i) ??
      findFirstMatch(url.toString(), /!1s(ChI[^!&]+)/) // common Google place_id prefix

    return { kind: "google_maps", url, placeId: altPlaceId, cid }
  }

  // Yelp business pages are usually /biz/<id>
  // Yelp has many country domains (e.g. yelp.co.uk). Treat any yelp.<tld> host as Yelp.
  if (host === "yelp.com" || host.startsWith("yelp.") || host.includes(".yelp.")) {
    const biz = findFirstMatch(path, /^\/biz\/([^\/?#]+)/i)
    return { kind: "yelp", url, businessId: biz ?? undefined }
  }

  // OpenTable: multiple variants by region; often /r/<slug> or /restaurant/profile/<id>
  if (hostEndsWith(host, "opentable.com")) {
    const profileId = findFirstMatch(path, /\/restaurant\/profile\/(\d+)/i)
    const slug = findFirstMatch(path, /^\/r\/([^\/?#]+)/i)
    return { kind: "opentable", url, restaurantId: profileId ?? undefined, slug: slug ?? undefined }
  }

  // TripAdvisor: location-ish pages often contain d<id> in the path.
  if (hostEndsWith(host, "tripadvisor.com")) {
    const dId = findFirstMatch(path, /-d(\d+)-/i) ?? findFirstMatch(path, /^\/.+_d(\d+)\.html$/i)
    return { kind: "tripadvisor", url, locationId: dId ?? undefined }
  }

  return { kind: "generic", url }
}


