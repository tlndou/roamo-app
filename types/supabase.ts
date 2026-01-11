export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          display_name: string | null
          username: string | null
          bio: string | null
          avatar_url: string | null
          base_city: string | null
          base_country: string | null
          base_continent: string | null
          base_canonical_city_id: string | null
          base_lat: number | null
          base_lng: number | null
          birthdate: string | null
          zodiac_sign: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          display_name?: string | null
          username?: string | null
          bio?: string | null
          avatar_url?: string | null
          base_city?: string | null
          base_country?: string | null
          base_continent?: string | null
          base_canonical_city_id?: string | null
          base_lat?: number | null
          base_lng?: number | null
          birthdate?: string | null
          zodiac_sign?: string | null
        }
        Update: {
          email?: string | null
          full_name?: string | null
          display_name?: string | null
          username?: string | null
          bio?: string | null
          avatar_url?: string | null
          base_city?: string | null
          base_country?: string | null
          base_continent?: string | null
          base_canonical_city_id?: string | null
          base_lat?: number | null
          base_lng?: number | null
          birthdate?: string | null
          zodiac_sign?: string | null
          updated_at?: string
        }
      }
      spots: {
        Row: {
          id: string
          user_id: string
          category: string
          name: string
          city: string
          canonical_city: string | null
          canonical_city_id: string | null
          neighborhood: string | null
          admin_area: string | null
          country: string
          continent: string
          address: string | null
          comments: string | null
          use_custom_image: boolean
          custom_image: string | null
          icon_color: string
          link: string | null
          google_place_id: string | null
          opening_hours: Json | null
          opening_hours_source: string | null
          recommended_visit_time: string | null
          visit_time_source: string | null
          visit_time_confidence: string | null
          lat: number
          lng: number
          visited: boolean
          rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          category: string
          name: string
          city: string
          canonical_city?: string | null
          canonical_city_id?: string | null
          neighborhood?: string | null
          admin_area?: string | null
          country: string
          continent: string
          address?: string | null
          comments?: string | null
          use_custom_image?: boolean
          custom_image?: string | null
          icon_color?: string
          link?: string | null
          google_place_id?: string | null
          opening_hours?: Json | null
          opening_hours_source?: string | null
          recommended_visit_time?: string | null
          visit_time_source?: string | null
          visit_time_confidence?: string | null
          lat: number
          lng: number
          visited?: boolean
          rating?: number | null
        }
        Update: {
          category?: string
          name?: string
          city?: string
          canonical_city?: string | null
          canonical_city_id?: string | null
          neighborhood?: string | null
          admin_area?: string | null
          country?: string
          continent?: string
          address?: string | null
          comments?: string | null
          use_custom_image?: boolean
          custom_image?: string | null
          icon_color?: string
          link?: string | null
          google_place_id?: string | null
          opening_hours?: Json | null
          opening_hours_source?: string | null
          recommended_visit_time?: string | null
          visit_time_source?: string | null
          visit_time_confidence?: string | null
          lat?: number
          lng?: number
          visited?: boolean
          rating?: number | null
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
