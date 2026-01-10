import { canonicalizeCountryName } from "@/lib/country-utils"

export type CanonicalCityResult = {
  canonicalCity: string
  canonicalCityId: string
  evidence: string[]
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function cleanCityName(raw: string): { value: string; evidence: string[] } {
  const evidence: string[] = []
  let v = (raw || "").trim()
  if (!v) return { value: "", evidence }

  // Remove parenthetical qualifiers.
  v = v.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim()

  // Generic administrative shells/prefixes (global, rule-based).
  const prefixRe =
    /^(city of|greater|metropolitan|metropolitan borough of|borough of|district of|municipality of|commune de|ville de|region of|province of)\s+/i
  if (prefixRe.test(v)) {
    v = v.replace(prefixRe, "").trim()
    evidence.push("city_clean:strip_admin_prefix")
  }

  // Pattern: "<City> Borough of X" -> "X"
  const boroughInfix = /\s+borough\s+of\s+/i
  if (boroughInfix.test(v)) {
    const parts = v.split(boroughInfix).map((p) => p.trim()).filter(Boolean)
    if (parts.length === 2) {
      v = parts[1]
      evidence.push("city_clean:strip_city_borough_of_x")
    }
  }

  // If comma-separated, keep first segment.
  if (v.includes(",")) {
    v = v.split(",")[0].trim()
    evidence.push("city_clean:strip_commas")
  }

  return { value: v, evidence }
}

/**
 * Canonicalize a provider city/admin string into a user-recognizable metro city.
 * This is global + rule-based (no city lists).
 */
export function canonicalizeCity(input: { city: string; country: string }): CanonicalCityResult {
  const evidence: string[] = []
  const cleaned = cleanCityName(input.city)
  evidence.push(...cleaned.evidence)

  const canonicalCity = cleaned.value || (input.city || "").trim() || "Unknown"
  const country = canonicalizeCountryName(input.country || "")
  const canonicalCityId = slugify(`${canonicalCity}-${country}`)
  evidence.push("city_id:slugify(city+normalized_country)")

  return { canonicalCity, canonicalCityId, evidence }
}
