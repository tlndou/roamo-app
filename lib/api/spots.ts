import { createClient } from "@/lib/supabase/client"
import type { Spot } from "@/types/spot"
import type { Database } from "@/types/supabase"
import { canonicalizeCity } from "@/lib/geo/canonical-city"

type DbSpot = Database["public"]["Tables"]["spots"]["Row"]
type InsertSpot = Database["public"]["Tables"]["spots"]["Insert"]
type UpdateSpot = Database["public"]["Tables"]["spots"]["Update"]

function normalizeLink(value: string | undefined | null): string | null {
  const v = typeof value === "string" ? value.trim() : ""
  return v.length ? v : null
}

async function enrichOpeningHoursIfPossible(spot: Spot): Promise<Spot> {
  if (!spot.googlePlaceId) return spot
  // If we already have Google-sourced hours, don't re-fetch.
  if (spot.openingHours?.source === "google_places") return spot

  try {
    const res = await fetch("/api/spots/enrich-opening-hours", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spotId: spot.id }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok || !data) return spot
    if (data?.spot) return transformDbSpot(data.spot as DbSpot)
    return spot
  } catch {
    return spot
  }
}

// Transform DB spot to app Spot type
export function transformDbSpot(dbSpot: DbSpot): Spot {
  const canon = canonicalizeCity({ city: dbSpot.canonical_city ?? dbSpot.city, country: dbSpot.country })
  return {
    id: dbSpot.id,
    category: dbSpot.category as Spot["category"],
    name: dbSpot.name,
    city: dbSpot.city,
    canonicalCityId: dbSpot.canonical_city_id ?? canon.canonicalCityId,
    neighborhood: dbSpot.neighborhood ?? undefined,
    adminArea: dbSpot.admin_area ?? undefined,
    country: dbSpot.country,
    continent: dbSpot.continent,
    address: dbSpot.address ?? undefined,
    comments: dbSpot.comments ?? undefined,
    useCustomImage: dbSpot.use_custom_image,
    customImage: dbSpot.custom_image ?? undefined,
    iconColor: dbSpot.icon_color as Spot["iconColor"],
    link: dbSpot.link ?? undefined,
    link2: dbSpot.link2 ?? undefined,
    googlePlaceId: dbSpot.google_place_id ?? undefined,
    openingHours: (dbSpot.opening_hours as any) ?? undefined,
    recommendedVisitTime: (dbSpot.recommended_visit_time as any) ?? undefined,
    visitTimeSource: (dbSpot.visit_time_source as any) ?? undefined,
    visitTimeConfidence: (dbSpot.visit_time_confidence as any) ?? undefined,
    visited: dbSpot.visited,
    rating: dbSpot.rating != null ? Number(dbSpot.rating) : undefined,
    coordinates: {
      lat: Number(dbSpot.lat),
      lng: Number(dbSpot.lng),
    },
  }
}

// Transform app Spot to DB insert format
export function transformToDbSpot(spot: Spot, userId: string): InsertSpot {
  const canon = canonicalizeCity({ city: spot.city, country: spot.country })
  return {
    user_id: userId,
    category: spot.category,
    name: spot.name,
    city: spot.city,
    canonical_city: spot.city,
    canonical_city_id: spot.canonicalCityId ?? canon.canonicalCityId,
    neighborhood: spot.neighborhood ?? null,
    admin_area: spot.adminArea ?? null,
    country: spot.country,
    continent: spot.continent,
    address: spot.address ?? null,
    comments: spot.comments ?? null,
    use_custom_image: spot.useCustomImage,
    custom_image: spot.customImage ?? null,
    icon_color: spot.iconColor,
    link: normalizeLink(spot.link),
    link2: normalizeLink(spot.link2),
    google_place_id: spot.googlePlaceId ?? null,
    opening_hours: (spot.openingHours as any) ?? null,
    opening_hours_source: spot.openingHours?.source ?? null,
    recommended_visit_time: spot.recommendedVisitTime ?? null,
    visit_time_source: spot.visitTimeSource ?? null,
    visit_time_confidence: spot.visitTimeConfidence ?? null,
    lat: spot.coordinates.lat,
    lng: spot.coordinates.lng,
    visited: spot.visited,
    rating: spot.rating ?? null,
  }
}

export function transformToDbSpotUpdate(spot: Spot): UpdateSpot {
  const canon = canonicalizeCity({ city: spot.city, country: spot.country })
  return {
    category: spot.category,
    name: spot.name,
    city: spot.city,
    canonical_city: spot.city,
    canonical_city_id: spot.canonicalCityId ?? canon.canonicalCityId,
    neighborhood: spot.neighborhood ?? null,
    admin_area: spot.adminArea ?? null,
    country: spot.country,
    continent: spot.continent,
    address: spot.address ?? null,
    comments: spot.comments ?? null,
    use_custom_image: spot.useCustomImage,
    custom_image: spot.customImage ?? null,
    icon_color: spot.iconColor,
    link: normalizeLink(spot.link),
    link2: normalizeLink(spot.link2),
    google_place_id: spot.googlePlaceId ?? null,
    opening_hours: (spot.openingHours as any) ?? null,
    opening_hours_source: spot.openingHours?.source ?? null,
    recommended_visit_time: spot.recommendedVisitTime ?? null,
    visit_time_source: spot.visitTimeSource ?? null,
    visit_time_confidence: spot.visitTimeConfidence ?? null,
    lat: spot.coordinates.lat,
    lng: spot.coordinates.lng,
    visited: spot.visited,
    rating: spot.rating ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function fetchSpots(): Promise<Spot[]> {
  const supabase = createClient()

  const { data, error } = await supabase.from("spots").select("*").order("created_at", { ascending: false })

  if (error) throw error

  return data.map(transformDbSpot)
}

export async function createSpot(spot: Omit<Spot, "id">): Promise<Spot> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Create a temporary spot with ID for transformation
  const spotWithId = { ...spot, id: "temp" }
  const dbSpot = transformToDbSpot(spotWithId, user.id)

  // @ts-expect-error - Supabase type inference issue with optional fields
  const { data, error } = await supabase.from("spots").insert(dbSpot).select().single()

  if (error) throw error

  const created = transformDbSpot(data)
  return await enrichOpeningHoursIfPossible(created)
}

export async function deleteSpot(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from("spots").delete().eq("id", id)

  if (error) throw error
}

export async function toggleSpotVisited(id: string, visited: boolean): Promise<void> {
  const supabase = createClient()

  // @ts-ignore - Supabase type inference issue with update method
  const { error } = await supabase.from("spots").update({ visited, updated_at: new Date().toISOString() }).eq("id", id)

  if (error) throw error
}

export async function updateSpot(spot: Spot): Promise<Spot> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const dbUpdate = transformToDbSpotUpdate(spot)

  // @ts-ignore - Supabase type inference issue with update method
  const { data, error } = await supabase.from("spots").update(dbUpdate).eq("id", spot.id).select().single()

  if (error) throw error

  const updated = transformDbSpot(data)
  return await enrichOpeningHoursIfPossible(updated)
}
