import type { OpeningHours, SpotCategory, IconColor, VisitTimeConfidence, VisitTimeLabel, VisitTimeSource } from "./spot"

export type ConfidenceLevel = "high" | "medium" | "low"

export interface AISuggestedField<T> {
  value: T | null
  confidence: number // 0..1
  evidence: string[]
}

export interface AISuggestions {
  name?: AISuggestedField<string>
  category?: AISuggestedField<SpotCategory>
  city?: AISuggestedField<string>
  country?: AISuggestedField<string>
}

export interface ImportSignals {
  provider?: string
  url?: string
  resolvedUrl?: string
  domain?: string
  tld?: string
  urlTokens?: string[]
  detectedPostcodes?: string[]
  jsonLdTypes?: string[]
  openGraph?: Record<string, string>
  googleTypes?: string[]
  tripContext?: {
    city?: string
    country?: string
  }
  pinterest?: {
    pinTitle?: string
    pinDescription?: string
    destinationUrl?: string
    inferredEvidence?: string[]
  }
}

export interface FieldConfidence {
  name: ConfidenceLevel
  address: ConfidenceLevel
  coordinates: ConfidenceLevel
  city: ConfidenceLevel
  country: ConfidenceLevel
  continent: ConfidenceLevel
  category: ConfidenceLevel
  link: ConfidenceLevel
}

export interface ExtractionMetadata {
  provider: string
  method: string
  confidence: FieldConfidence
  requiresConfirmation: boolean
  warnings: string[]
  rawUrl: string
  resolvedUrl: string
  flags?: {
    location_conflict?: boolean
    multi_location_brand?: boolean
    insufficient_signals?: boolean
  }
  signals?: ImportSignals
  ai?: {
    model: string
    suggestions: AISuggestions
    applied: Partial<Record<keyof AISuggestions, boolean>>
  }
}

export interface SpotDraft {
  name: string
  address?: string
  city: string
  canonicalCityId?: string
  neighborhood?: string
  adminArea?: string
  country: string
  continent: string
  coordinates: {
    lat: number
    lng: number
  }
  category: SpotCategory
  link: string
  comments?: string
  useCustomImage: boolean
  customImage?: string
  iconColor: IconColor
  visited: boolean
  rating?: number
  openingHours?: OpeningHours
  recommendedVisitTime?: VisitTimeLabel
  visitTimeSource?: VisitTimeSource
  visitTimeConfidence?: VisitTimeConfidence
}

export interface URLImportResult {
  draft: SpotDraft
  meta: ExtractionMetadata
}
