export type GooglePlaceOpeningHours = {
  weekdayText?: string[]
  periods?: Array<{
    open: { day: number; time: string }
    close?: { day: number; time: string }
  }>
}

export async function fetchPlaceOpeningHours(placeId: string, apiKey: string): Promise<GooglePlaceOpeningHours | null> {
  const fieldMask = ["id", "regularOpeningHours"].join(",")
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=${encodeURIComponent(fieldMask)}`

  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && (data as any).error?.message) || `HTTP ${res.status}`
    throw new Error(`Google Places API error: ${res.status} - ${msg}`)
  }

  const roh = (data as any)?.regularOpeningHours
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

  return { ...(weekdayText ? { weekdayText } : {}), ...(periods.length ? { periods } : {}) }
}


