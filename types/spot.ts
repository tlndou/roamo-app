export type SpotCategory = "restaurant" | "cafe" | "bar" | "museum" | "park" | "attraction" | "hotel" | "shop" | "other"

export interface Spot {
  id: string
  category: SpotCategory
  name: string
  city: string
  country: string
  comments?: string
  thumbnail?: string
  link?: string
}
