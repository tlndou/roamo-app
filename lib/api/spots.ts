import { createClient } from "@/lib/supabase/client"
import type { Spot } from "@/types/spot"
import type { Database } from "@/types/supabase"

type DbSpot = Database["public"]["Tables"]["spots"]["Row"]
type InsertSpot = Database["public"]["Tables"]["spots"]["Insert"]

// Transform DB spot to app Spot type
export function transformDbSpot(dbSpot: DbSpot): Spot {
  return {
    id: dbSpot.id,
    category: dbSpot.category as Spot["category"],
    name: dbSpot.name,
    city: dbSpot.city,
    country: dbSpot.country,
    continent: dbSpot.continent,
    address: dbSpot.address ?? undefined,
    comments: dbSpot.comments ?? undefined,
    useCustomImage: dbSpot.use_custom_image,
    customImage: dbSpot.custom_image ?? undefined,
    iconColor: dbSpot.icon_color as Spot["iconColor"],
    link: dbSpot.link ?? undefined,
    visited: dbSpot.visited,
    coordinates: {
      lat: Number(dbSpot.lat),
      lng: Number(dbSpot.lng),
    },
  }
}

// Transform app Spot to DB insert format
export function transformToDbSpot(spot: Spot, userId: string): InsertSpot {
  return {
    user_id: userId,
    category: spot.category,
    name: spot.name,
    city: spot.city,
    country: spot.country,
    continent: spot.continent,
    address: spot.address ?? null,
    comments: spot.comments ?? null,
    use_custom_image: spot.useCustomImage,
    custom_image: spot.customImage ?? null,
    icon_color: spot.iconColor,
    link: spot.link ?? null,
    lat: spot.coordinates.lat,
    lng: spot.coordinates.lng,
    visited: spot.visited,
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

  return transformDbSpot(data)
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
