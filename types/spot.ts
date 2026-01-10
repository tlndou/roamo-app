export type SpotCategory = "restaurant" | "cafe" | "bar" | "museum" | "park" | "attraction" | "activity" | "event" | "club" | "hotel" | "shop" | "other"

export type IconColor =
  | "grey"
  | "pink"
  | "pink-pastel"
  | "purple"
  | "purple-pastel"
  | "blue"
  | "blue-pastel"
  | "green"
  | "green-pastel"
  | "yellow"
  | "yellow-pastel"
  | "orange"
  | "orange-pastel"
  | "red"
  | "red-pastel"

export interface Spot {
  id: string
  category: SpotCategory
  name: string
  /**
   * Canonical metro city name (user-facing for browsing).
   * Borough/district names should not be stored here.
   */
  city: string
  /**
   * Stable metro city identifier used for grouping/searching.
   */
  canonicalCityId?: string
  /**
   * Stored internally for possible future use; must NOT affect browsing/grouping.
   */
  neighborhood?: string
  /**
   * Stored internally for possible future use; must NOT affect browsing/grouping.
   */
  adminArea?: string
  country: string
  continent: string
  address?: string
  comments?: string
  // Icon/Image options
  useCustomImage: boolean
  customImage?: string // URL or base64 for uploaded image
  iconColor: IconColor
  link?: string
  visited: boolean
  rating?: number // 0-5 with 0.5 increments, only when visited
  coordinates: {
    lat: number
    lng: number
  }
}
