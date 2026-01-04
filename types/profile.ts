export interface Profile {
  id: string
  email: string | null
  displayName: string | null
  username: string
  bio: string | null
  avatarUrl: string | null
  birthdate: string | null
  zodiacSign: string | null
  createdAt: string
  updatedAt: string
}

export interface ProfileUpdate {
  displayName?: string
  username?: string
  bio?: string
  avatarUrl?: string
  birthdate?: string
  zodiacSign?: string
}
