import { SpotCategory, IconColor } from "./spot"

export type ConfidenceLevel = "high" | "medium" | "low"

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
}

export interface SpotDraft {
  name: string
  address?: string
  city: string
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
}

export interface URLImportResult {
  draft: SpotDraft
  meta: ExtractionMetadata
}
