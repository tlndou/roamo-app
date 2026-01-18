export interface BaseLocation {
  /** Canonical metro-level city name (e.g., "London"). */
  city: string
  country: string
  continent: string
  canonicalCityId: string
  coordinates: { lat: number; lng: number }
}

export type LocationPermission = "unknown" | "granted" | "denied"

export type HomeAwayStatus = "home" | "away" | "unknown"

export type PushPermission = "default" | "granted" | "denied" | "unsupported"

export interface CurrentLocation {
  city: string | null
  canonicalCityId: string | null
  country: string | null
  coordinates: { lat: number; lng: number } | null
  lastSeenCity: string | null
  updatedAt: string | null
}

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
  currentLocation: CurrentLocation | null
  /** Push notification permission status */
  pushPermission: PushPermission
  /** Whether user has been asked for push permission */
  pushAsked: boolean
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
