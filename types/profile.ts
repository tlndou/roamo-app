export interface BaseLocation {
  /** Canonical metro-level city name (e.g., "London"). */
  city: string
  country: string
  continent: string
  canonicalCityId: string
  coordinates: { lat: number; lng: number }
}

export type LocationPermission = "unknown" | "granted" | "denied"

export interface Profile {
  id: string
  email: string | null
  displayName: string | null
  username: string
  baseLocation: BaseLocation | null
  bio: string | null
  avatarUrl: string | null
  birthdate: string | null
  zodiacSign: string | null
  locationPermission: LocationPermission
  createdAt: string
  updatedAt: string
}

export interface ProfileUpdate {
  displayName?: string
  username?: string
  baseLocation?: BaseLocation | null
  bio?: string
  avatarUrl?: string | null
  birthdate?: string
  zodiacSign?: string
}
