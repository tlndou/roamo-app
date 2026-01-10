export type ReverseGeocodeResult = {
  canonicalCity: string | null
  neighborhood: string | null
  adminArea: string | null
  country: string | null
  raw?: any
}

function pickFirst(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

/**
 * Reverse geocode coordinates using Nominatim.
 *
 * NOTE: reverse results depend heavily on `zoom`. For metro-city resolution,
 * we default to a lower zoom (8) to avoid borough-level "cities".
 */
export async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
  opts?: { zoom?: number }
): Promise<ReverseGeocodeResult> {
  const zoom = typeof opts?.zoom === "number" ? opts.zoom : 8
  const url =
    `https://nominatim.openstreetmap.org/reverse?` +
    `lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&` +
    `format=json&addressdetails=1&zoom=${encodeURIComponent(String(zoom))}`

  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(8000),
    headers: {
      "User-Agent": "Roamo/1.0 (canonical-city)",
    },
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || !data) {
    return { canonicalCity: null, neighborhood: null, adminArea: null, country: null, raw: data }
  }

  const a = data.address || {}

  const canonicalCity = pickFirst(a, ["city", "town", "municipality", "village", "hamlet"])
  const neighborhood = pickFirst(a, ["neighbourhood", "suburb", "quarter", "city_district", "borough", "ward"])
  const adminArea = pickFirst(a, ["state_district", "state", "region", "province", "county"])
  const country = pickFirst(a, ["country"])

  return { canonicalCity, neighborhood, adminArea, country, raw: data }
}

