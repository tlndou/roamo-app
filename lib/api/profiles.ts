import { createClient } from "@/lib/supabase/client"
import { calculateZodiacSign } from "@/lib/zodiac-utils"
import type { Profile, ProfileUpdate } from "@/types/profile"
import type { Database } from "@/types/supabase"

type DbProfile = Database["public"]["Tables"]["profiles"]["Row"]

// Transform DB profile to app Profile type
export function transformDbProfile(dbProfile: DbProfile): Profile {
  return {
    id: dbProfile.id,
    email: dbProfile.email,
    displayName: dbProfile.display_name,
    username: dbProfile.username || "",
    bio: dbProfile.bio,
    avatarUrl: dbProfile.avatar_url,
    birthdate: dbProfile.birthdate,
    zodiacSign: dbProfile.zodiac_sign,
    createdAt: dbProfile.created_at,
    updatedAt: dbProfile.updated_at,
  }
}

// Fetch user's profile
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient()

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

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
  if (updates.birthdate !== undefined) {
    dbUpdates.birthdate = updates.birthdate
    dbUpdates.zodiac_sign = calculateZodiacSign(updates.birthdate)
  } else if (updates.zodiacSign !== undefined) {
    dbUpdates.zodiac_sign = updates.zodiacSign
  }

  // @ts-expect-error - Supabase type inference issue with optional fields
  const { data, error } = await supabase.from("profiles").update(dbUpdates).eq("id", userId).select().single()

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
