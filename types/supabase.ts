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
        }
        Update: {
          email?: string | null
          full_name?: string | null
          display_name?: string | null
          username?: string | null
          bio?: string | null
          avatar_url?: string | null
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
          country: string
          continent: string
          address: string | null
          comments: string | null
          use_custom_image: boolean
          custom_image: string | null
          icon_color: string
          link: string | null
          lat: number
          lng: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          category: string
          name: string
          city: string
          country: string
          continent: string
          address?: string | null
          comments?: string | null
          use_custom_image?: boolean
          custom_image?: string | null
          icon_color?: string
          link?: string | null
          lat: number
          lng: number
        }
        Update: {
          category?: string
          name?: string
          city?: string
          country?: string
          continent?: string
          address?: string | null
          comments?: string | null
          use_custom_image?: boolean
          custom_image?: string | null
          icon_color?: string
          link?: string | null
          lat?: number
          lng?: number
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
