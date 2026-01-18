import { createClient } from "@/lib/supabase/client"
import { calculateZodiacSign } from "@/lib/zodiac-utils"
import type { Profile, ProfileUpdate, LocationPermission, CurrentLocation, PushPermission } from "@/types/profile"
import type { Database } from "@/types/supabase"
import { canonicalizeCity } from "@/lib/geo/canonical-city"
import { canonicalizeCountryName, getCountryContinent } from "@/lib/country-utils"

type DbProfile = Database["public"]["Tables"]["profiles"]["Row"]
type InsertProfile = Database["public"]["Tables"]["profiles"]["Insert"]

// Transform DB profile to app Profile type
export function transformDbProfile(dbProfile: DbProfile): Profile {
  const baseCity = (dbProfile.base_city || "").trim()
  const baseCountry = canonicalizeCountryName(dbProfile.base_country || "")
  const hasBaseCoords = dbProfile.base_lat != null && dbProfile.base_lng != null
  const baseCanonical =
    baseCity && baseCountry
      ? canonicalizeCity({ city: baseCity, country: baseCountry }).canonicalCityId
      : ""

  return {
    id: dbProfile.id,
    email: dbProfile.email,
    displayName: dbProfile.display_name,
    username: dbProfile.username || "",
    baseLocation:
      baseCity && baseCountry && hasBaseCoords
        ? {
            city: baseCity,
            country: baseCountry,
            continent: dbProfile.base_continent || getCountryContinent(baseCountry),
            canonicalCityId: dbProfile.base_canonical_city_id || baseCanonical,
            coordinates: { lat: Number(dbProfile.base_lat), lng: Number(dbProfile.base_lng) },
          }
        : null,
    bio: dbProfile.bio,
    avatarUrl: dbProfile.avatar_url,
    birthdate: dbProfile.birthdate,
    zodiacSign: dbProfile.zodiac_sign,
    locationPermission: dbProfile.location_permission || "unknown",
    currentLocation: buildCurrentLocation(dbProfile),
    pushPermission: ((dbProfile as any).push_permission as PushPermission) || "default",
    pushAsked: (dbProfile as any).push_asked ?? false,
    notificationsEnabled: (dbProfile as any).notifications_enabled ?? true, // Default to true for backwards compat
    createdAt: dbProfile.created_at,
    updatedAt: dbProfile.updated_at,
  }
}

function buildCurrentLocation(dbProfile: DbProfile): CurrentLocation | null {
  const hasCoords = dbProfile.current_lat != null && dbProfile.current_lng != null
  const hasAnyData = dbProfile.current_city || dbProfile.current_country || hasCoords

  if (!hasAnyData) return null

  return {
    city: dbProfile.current_city,
    canonicalCityId: dbProfile.current_canonical_city_id,
    country: dbProfile.current_country,
    coordinates: hasCoords
      ? { lat: Number(dbProfile.current_lat), lng: Number(dbProfile.current_lng) }
      : null,
    lastSeenCity: dbProfile.last_seen_city,
    updatedAt: dbProfile.location_updated_at,
  }
}

// Fetch user's profile
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient()

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()

  if (error) throw error
  return data ? transformDbProfile(data) : null
}

/**
 * Ensures the user has a `profiles` row (some Supabase setups don't auto-create it).
 * If missing, attempts to insert a minimal row.
 */
export async function ensureProfile(user: { id: string; email?: string | null }): Promise<Profile | null> {
  const supabase = createClient()

  const existing = await fetchProfile(user.id)
  if (existing) return existing

  const insert: InsertProfile = {
    id: user.id,
    email: user.email ?? null,
  }

  // @ts-expect-error - Supabase type inference issue with optional fields
  const { data, error } = await supabase.from("profiles").insert(insert).select("*").single()

  if (error) throw error
  return data ? transformDbProfile(data) : null
}

// Update user's profile
export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
  const supabase = createClient()

  type DbProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]
  const dbUpdates: DbProfileUpdate = {
    updated_at: new Date().toISOString(),
  }

  if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName
  if (updates.username !== undefined) dbUpdates.username = updates.username.toLowerCase()
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl
  if (updates.baseLocation !== undefined) {
    if (updates.baseLocation === null) {
      dbUpdates.base_city = null
      dbUpdates.base_country = null
      dbUpdates.base_continent = null
      dbUpdates.base_canonical_city_id = null
      dbUpdates.base_lat = null
      dbUpdates.base_lng = null
    } else {
      const city = updates.baseLocation.city?.trim() || "Unknown"
      const country = canonicalizeCountryName(updates.baseLocation.country || "")
      const continent = updates.baseLocation.continent || getCountryContinent(country)
      const canon = updates.baseLocation.canonicalCityId || canonicalizeCity({ city, country }).canonicalCityId
      const lat = Number(updates.baseLocation.coordinates?.lat)
      const lng = Number(updates.baseLocation.coordinates?.lng)
      dbUpdates.base_city = city
      dbUpdates.base_country = country
      dbUpdates.base_continent = continent
      dbUpdates.base_canonical_city_id = canon
      dbUpdates.base_lat = Number.isFinite(lat) ? lat : null
      dbUpdates.base_lng = Number.isFinite(lng) ? lng : null
    }
  }
  if (updates.birthdate !== undefined) {
    dbUpdates.birthdate = updates.birthdate
    dbUpdates.zodiac_sign = calculateZodiacSign(updates.birthdate)
  } else if (updates.zodiacSign !== undefined) {
    dbUpdates.zodiac_sign = updates.zodiacSign
  }

  // Upsert so profile updates work even if the profile row wasn't created yet.
  // (RLS must allow insert/update for the current user.)
  const upsertPayload: any = { id: userId, ...dbUpdates }

  const { data, error } = await supabase.from("profiles").upsert(upsertPayload).select().single()

  if (error) throw error
  return transformDbProfile(data)
}

// Check if username is available
export async function checkUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
  const supabase = createClient()

  let query = supabase.from("profiles").select("id").eq("username", username.toLowerCase())

  if (currentUserId) {
    query = query.neq("id", currentUserId)
  }

  const { data } = await query.single()
  return !data
}

// Upload avatar to Supabase Storage
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = createClient()

  const fileExt = file.name.split(".").pop()
  const fileName = `${userId}/${Date.now()}.${fileExt}`

  const { data, error } = await supabase.storage.from("avatars").upload(fileName, file, {
    cacheControl: "3600",
    upsert: true,
  })

  if (error) throw error

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(fileName)

  return publicUrl
}

// Delete old avatar from storage
export async function deleteAvatar(avatarUrl: string): Promise<void> {
  const supabase = createClient()

  const path = avatarUrl.split("/avatars/")[1]
  if (!path) return

  await supabase.storage.from("avatars").remove([path])
}

// Update location permission setting
export async function updateLocationPermission(
  userId: string,
  permission: LocationPermission
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from("profiles")
    // @ts-ignore - Supabase type inference issue
    .update({
      location_permission: permission,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) throw error
}

// Update current location from reverse geocoding
export interface CurrentLocationUpdate {
  city: string | null
  canonicalCityId: string | null
  country: string | null
  lat: number
  lng: number
}

export async function updateCurrentLocation(
  userId: string,
  location: CurrentLocationUpdate
): Promise<void> {
  const supabase = createClient()

  // First fetch current city to set as last_seen_city if it changes
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("current_city")
    .eq("id", userId)
    .single() as { data: { current_city: string | null } | null; error: any }

  const previousCity = currentProfile?.current_city
  const cityChanged = previousCity && previousCity !== location.city

  const { error } = await supabase
    .from("profiles")
    // @ts-ignore - Supabase type inference issue
    .update({
      current_city: location.city,
      current_canonical_city_id: location.canonicalCityId,
      current_country: location.country,
      current_lat: location.lat,
      current_lng: location.lng,
      last_seen_city: cityChanged ? previousCity : undefined,
      location_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) throw error
}

// Update push notification permission status
export async function updatePushPermission(
  userId: string,
  permission: PushPermission,
  asked: boolean
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from("profiles")
    // @ts-ignore - Supabase type inference issue
    .update({
      push_permission: permission,
      push_asked: asked,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) throw error
}

// Update notifications enabled preference (app-level toggle)
export async function updateNotificationsEnabled(
  userId: string,
  enabled: boolean
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from("profiles")
    // @ts-ignore - Supabase type inference issue
    .update({
      notifications_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) throw error
}
