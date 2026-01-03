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
  city: string
  country: string
  continent: string
  address?: string
  comments?: string
  // Icon/Image options
  useCustomImage: boolean
  customImage?: string // URL or base64 for uploaded image
  iconColor: IconColor
  link?: string
  coordinates: {
    lat: number
    lng: number
  }
}
