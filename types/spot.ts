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

export type VisitTimeLabel = "morning" | "afternoon" | "evening" | "late_night" | "daytime" | "lunch" | "dinner"
export type VisitTimeSource = "user" | "hours" | "inferred"
export type VisitTimeConfidence = "high" | "low"

export type OpeningHours = {
  /**
   * Human-readable, provider-provided lines (e.g. Google "Monday: 9am–5pm" or JSON-LD "Mo-Fr 10:00-18:00").
   * Prefer displaying this when present.
   */
  weekdayText?: string[]
  /**
   * Structured open/close periods (per day when available).
   * day: 0=Sunday ... 6=Saturday.
   * time: "HH:MM"
   */
  periods?: Array<{
    open: { day: number; time: string }
    close?: { day: number; time: string }
  }>
  source: "google_places" | "json_ld" | "user"
}

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
  /** Optional second link (e.g., menu link + Instagram). */
  link2?: string
  /**
   * Google Places (New) place id when known (authoritative key for opening hours).
   * This is populated by URL importers and (in the future) a Google-powered place picker.
   */
  googlePlaceId?: string
  visited: boolean
  rating?: number // 0-5 with 0.5 increments, only when visited
  /** Verified opening hours when available (never inferred). */
  openingHours?: OpeningHours
  /**
   * Suggested visiting time label, shown ONLY when opening hours are missing/incomplete.
   * May be user-chosen or category-inferred (low confidence).
   */
  recommendedVisitTime?: VisitTimeLabel
  visitTimeSource?: VisitTimeSource
  visitTimeConfidence?: VisitTimeConfidence
  coordinates: {
    lat: number
    lng: number
  }
}
