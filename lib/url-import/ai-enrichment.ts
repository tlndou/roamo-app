import { z } from "zod"
import type { SpotDraft, ExtractionMetadata, AISuggestions, AISuggestedField, ImportSignals } from "@/types/url-import"
import type { SpotCategory } from "@/types/spot"
import Anthropic from "@anthropic-ai/sdk"

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const categories = [
  "restaurant",
  "cafe",
  "bar",
  "museum",
  "park",
  "attraction",
  "activity",
  "event",
  "club",
  "hotel",
  "shop",
  "other",
] as const

const suggestedFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema.nullable(),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()).default([]),
  })

const aiOutputSchema = z.object({
  name: suggestedFieldSchema(z.string()).optional(),
  category: suggestedFieldSchema(z.enum(categories)).optional(),
  city: suggestedFieldSchema(z.string()).optional(),
  country: suggestedFieldSchema(z.string()).optional(),
})

export async function enrichSpotDraft(
  draft: SpotDraft,
  meta: ExtractionMetadata
): Promise<SpotDraft> {
  const signals = buildSignals(draft, meta)
  meta.signals = { ...(meta.signals ?? {}), ...signals }

  // Determine which fields are missing or low-confidence and eligible for inference.
  const wants = {
    name: meta.confidence.name === "low" || isMissingText(draft.name),
    category: meta.confidence.category === "low" || draft.category === "other",
    city: meta.confidence.city === "low" || isUnknown(draft.city),
    country: meta.confidence.country === "low" || isUnknown(draft.country),
  }

  // 1) Deterministic inference pass (safe, explainable)
  const deterministic: AISuggestions = {}
  const detApplied: Partial<Record<keyof AISuggestions, boolean>> = {}

  const countryDet = inferCountryDeterministic(draft, meta)
  if (countryDet && wants.country) {
    deterministic.country = countryDet
  }

  // Apply deterministic suggestions first
  let nextDraft = { ...draft }
  nextDraft = applySuggestions({
    draft: nextDraft,
    meta,
    suggestions: deterministic,
    appliedOut: detApplied,
    allowPrefill: true,
    model: "deterministic",
  })

  // Recompute wants after deterministic fill
  const wantsAfterDet = {
    name: meta.confidence.name === "low" || isMissingText(nextDraft.name),
    category: meta.confidence.category === "low" || nextDraft.category === "other",
    city: meta.confidence.city === "low" || isUnknown(nextDraft.city),
    country: meta.confidence.country === "low" || isUnknown(nextDraft.country),
  }

  const shouldCallAI = Object.values(wantsAfterDet).some(Boolean)
  if (!shouldCallAI) {
    recomputeRequiresConfirmation(meta)
    return nextDraft
  }

  if (!ANTHROPIC_API_KEY) {
    console.warn("[ai-enrichment] Skipping Claude enrichment: ANTHROPIC_API_KEY is not set")
    recomputeRequiresConfirmation(meta)
    return nextDraft
  }

  // 2) AI inference pass (only for remaining missing/low-confidence fields)
  try {
    const ai = await callClaudeInference({
      draft: nextDraft,
      meta,
      wants: wantsAfterDet,
      signals: meta.signals ?? signals,
    })

    const applied: Partial<Record<keyof AISuggestions, boolean>> = {}
    const outDraft = applySuggestions({
      draft: nextDraft,
      meta,
      suggestions: ai,
      appliedOut: applied,
      allowPrefill: true,
      model: "claude-3-5-haiku-20241022",
    })

    meta.ai = {
      model: "claude-3-5-haiku-20241022",
      suggestions: ai,
      applied,
    }

    recomputeRequiresConfirmation(meta)
    return outDraft
  } catch (error) {
    console.error("AI enrichment failed:", error)
    recomputeRequiresConfirmation(meta)
    return nextDraft
  }
}

function confidenceLevel(score: number): ExtractionMetadata["confidence"][keyof ExtractionMetadata["confidence"]] {
  if (score >= 0.8) return "high"
  if (score >= 0.4) return "medium"
  return "low"
}

function isUnknown(v: string | undefined): boolean {
  return !v || v.trim().length === 0 || v.trim().toLowerCase() === "unknown"
}

function isMissingText(v: string | undefined): boolean {
  if (!v) return true
  const s = v.trim()
  if (!s) return true
  return s.toLowerCase() === "unknown" || s.toLowerCase() === "untitled spot"
}

function tokenizeUrl(url: string): string[] {
  try {
    const u = new URL(url)
    const raw = `${u.hostname} ${u.pathname} ${u.search}`
    return raw
      .replace(/[%_+]/g, " ")
      .replace(/[^a-zA-Z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && t.length <= 40)
      .slice(0, 60)
  } catch {
    return []
  }
}

function buildSignals(draft: SpotDraft, meta: ExtractionMetadata): ImportSignals {
  const resolved = meta.resolvedUrl || meta.rawUrl
  let domain = ""
  let tld = ""
  try {
    const u = new URL(resolved)
    domain = u.hostname.replace(/^www\./, "")
    const parts = domain.split(".")
    tld = parts.length >= 2 ? parts.slice(-2).join(".") : domain
  } catch {
    // ignore
  }

  const postcodes: string[] = []
  const hay = `${draft.address ?? ""} ${draft.comments ?? ""} ${draft.name ?? ""}`
  const uk = hay.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)
  if (uk?.[1]) postcodes.push(uk[1].toUpperCase().replace(/\s+/g, " ").trim())

  return {
    provider: meta.provider,
    url: meta.rawUrl,
    resolvedUrl: meta.resolvedUrl,
    domain,
    tld,
    urlTokens: tokenizeUrl(resolved),
    detectedPostcodes: postcodes.length ? postcodes : undefined,
  }
}

function inferCountryDeterministic(draft: SpotDraft, meta: ExtractionMetadata): AISuggestedField<string> | null {
  // Only infer if country is missing/unknown.
  if (!isUnknown(draft.country)) return null

  const signals = meta.signals
  const evidence: string[] = []

  const postcodes = signals?.detectedPostcodes ?? []
  if (postcodes.length) evidence.push(`postcode=${postcodes[0]}`)

  // UK postcode evidence
  const hasUkPostcode = postcodes.some((p) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(p.replace(/\s+/g, "")))
  if (hasUkPostcode) {
    evidence.push("signal:UK_postcode")
    return { value: "United Kingdom", confidence: 0.92, evidence }
  }

  // TLD evidence (we treat this as weaker than postcode)
  const tld = signals?.tld?.toLowerCase()
  if (tld === "co.uk" || tld === "uk") {
    evidence.push(`signal:tld=${tld}`)
    return { value: "United Kingdom", confidence: 0.6, evidence }
  }

  return null
}

function applySuggestions(opts: {
  draft: SpotDraft
  meta: ExtractionMetadata
  suggestions: AISuggestions
  appliedOut: Partial<Record<keyof AISuggestions, boolean>>
  allowPrefill: boolean
  model: string
}): SpotDraft {
  const { meta, appliedOut } = opts
  let draft = { ...opts.draft }

  const maybeApply = <K extends keyof AISuggestions>(
    key: K,
    getCurrent: () => any,
    setValue: (v: any) => void,
    canOverride: () => boolean
  ) => {
    const suggestion = opts.suggestions[key]
    if (!suggestion) return
    if (!canOverride()) return
    if (suggestion.value == null) return

    // Threshold behavior
    if (suggestion.confidence >= 0.8) {
      setValue(suggestion.value)
      meta.warnings = meta.warnings ?? []
      appliedOut[key] = true
      return
    }

    if (opts.allowPrefill && suggestion.confidence >= 0.4) {
      setValue(suggestion.value)
      meta.warnings = meta.warnings ?? []
      meta.warnings.push(
        `Please confirm ${String(key)} (AI confidence ${suggestion.confidence.toFixed(2)}): ${suggestion.evidence.join(", ")}`
      )
      appliedOut[key] = true
      return
    }
  }

  // Never override high/medium extractor data; only fill if missing or low confidence.
  maybeApply(
    "name",
    () => draft.name,
    (v) => {
      draft.name = String(v)
      meta.confidence.name = confidenceLevel((opts.suggestions.name?.confidence ?? 0.0))
    },
    () => meta.confidence.name === "low" || isMissingText(draft.name)
  )

  maybeApply(
    "category",
    () => draft.category,
    (v) => {
      draft.category = v as SpotCategory
      meta.confidence.category = confidenceLevel((opts.suggestions.category?.confidence ?? 0.0))
    },
    () => meta.confidence.category === "low" || draft.category === "other"
  )

  maybeApply(
    "city",
    () => draft.city,
    (v) => {
      draft.city = String(v)
      meta.confidence.city = confidenceLevel((opts.suggestions.city?.confidence ?? 0.0))
    },
    () => meta.confidence.city === "low" || isUnknown(draft.city)
  )

  maybeApply(
    "country",
    () => draft.country,
    (v) => {
      draft.country = String(v)
      meta.confidence.country = confidenceLevel((opts.suggestions.country?.confidence ?? 0.0))
      // continent can be derived later; never guess it here.
    },
    () => meta.confidence.country === "low" || isUnknown(draft.country)
  )

  return draft
}

function recomputeRequiresConfirmation(meta: ExtractionMetadata) {
  // Confirmation gating focuses on *location correctness*:
  // - If name/city/country are not high confidence, confirm.
  // - If coordinates are not high confidence, confirm.
  // Category is still shown/adjustable, but does not block auto-import on its own.
  const c = meta.confidence
  const locationCrit = [c.name, c.city, c.country]
  const needsConfirm = locationCrit.some((x) => x !== "high") || c.coordinates !== "high"
  meta.requiresConfirmation = needsConfirm
}

async function callClaudeInference(input: {
  draft: SpotDraft
  meta: ExtractionMetadata
  wants: { name: boolean; category: boolean; city: boolean; country: boolean }
  signals: ImportSignals
}): Promise<AISuggestions> {
  const client = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  })

  const prompt = `You are an AI enrichment layer for a "URL → Spot" importer.
Your job is to help fill MISSING or LOW-CONFIDENCE fields only when supported by provided signals.

FIELDS YOU MAY SUGGEST (do not invent anything else):
- name (string)
- category (one of: ${categories.join(", ")})
- city (string)
- country (string)

FOR EACH FIELD, RETURN:
- value: the suggested value OR null if not supported
- confidence: number between 0 and 1
- evidence: array of strings citing specific signals that justify the suggestion

CRITICAL RULES:
- NEVER invent addresses, coordinates, postcodes, phone numbers, or opening hours.
- NEVER invent a place name or location if the input signals do not contain strong hints.
- NEVER override hard extracted values: only suggest values for fields that are missing/unknown/low-confidence (see "wants").
- If evidence is weak, return null and low confidence.

CATEGORY CLASSIFICATION (REQUIRED GUIDANCE):
You are a classification assistant that assigns a single best category to a place based on provided signals.
- Choose only from the allowed categories (enum above).
- Base decisions only on evidence in the input.
- Return "other" if evidence is weak, ambiguous, or conflicting.
- Do NOT infer based on fame or name alone.

Priority order (strongest to weakest):
1) Authoritative types (highest confidence)
   - Google Places types (signals.googleTypes)
   - JSON-LD @type (signals.jsonLdTypes)
   Map directly when possible. Examples:
   - Restaurant, FoodEstablishment → restaurant
   - CafeOrCoffeeShop, cafe → cafe
   - BarOrPub → bar
   - NightClub → club
   - Museum → museum
   - Park → park
   - TouristAttraction, Landmark → attraction
   - Hotel, LodgingBusiness → hotel
   - Store, Shop → shop
   - Event, Festival, ExhibitionEvent → event
   - SportsActivityLocation, EntertainmentBusiness → activity

2) URL + page semantics (medium confidence)
   Use when authoritative types are missing.
   Examples:
   - URL/path tokens include /restaurant(s)/, /dining/, /menu/ → restaurant
   - /cafe/, "coffee" → cafe
   - /bar/, "cocktails" → bar
   - /club/, "nightlife", "DJ" → club
   - /visit/, /things-to-do/, "tickets" → attraction/event depending on "dates/one night only"
   - "museum", "gallery", "exhibition" → museum
   - "park", "garden" → park
   - "stay", "rooms", "check-in" → hotel
   - "shop", "store", "buy online" → shop
   - "experience", "workshop", "class", "tour" → activity
   Require at least two agreeing signals for medium confidence.

INPUT (JSON):
${JSON.stringify(
  {
    provider: input.meta.provider,
    url: input.meta.rawUrl,
    resolvedUrl: input.meta.resolvedUrl,
    extracted: {
      name: input.draft.name,
      category: input.draft.category,
      city: input.draft.city,
      country: input.draft.country,
      comments: input.draft.comments ?? null,
      address: input.draft.address ?? null,
    },
    extractorConfidence: input.meta.confidence,
    wants: input.wants,
    signals: input.signals,
  },
  null,
  2
)}

OUTPUT (STRICT JSON ONLY):
{
  "name": { "value": string|null, "confidence": 0-1, "evidence": [string] },
  "category": { "value": ${categories.map((c) => `"${c}"`).join(" | ")}|null, "confidence": 0-1, "evidence": [string] },
  "city": { "value": string|null, "confidence": 0-1, "evidence": [string] },
  "country": { "value": string|null, "confidence": 0-1, "evidence": [string] }
}
You may omit fields not requested in wants, but do not add extra keys.`

  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 700,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  })

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : ""

  // Extract JSON from response (handle markdown code blocks)
  let jsonText = responseText.trim()
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```\n?$/, "")
  }

  const result = JSON.parse(jsonText)
  const parsed = aiOutputSchema.safeParse(result)
  if (!parsed.success) {
    throw new Error(`Invalid AI output: ${parsed.error.message}`)
  }
  return parsed.data as AISuggestions
}
