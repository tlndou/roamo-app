// Comprehensive country to continent mapping
// This covers all countries and their common name variations
const countryToContinentMap: Record<string, string> = {
  // Africa
  algeria: "Africa",
  angola: "Africa",
  benin: "Africa",
  botswana: "Africa",
  "burkina faso": "Africa",
  burundi: "Africa",
  cameroon: "Africa",
  "cape verde": "Africa",
  "central african republic": "Africa",
  chad: "Africa",
  comoros: "Africa",
  congo: "Africa",
  "democratic republic of the congo": "Africa",
  djibouti: "Africa",
  egypt: "Africa",
  "equatorial guinea": "Africa",
  eritrea: "Africa",
  ethiopia: "Africa",
  gabon: "Africa",
  gambia: "Africa",
  ghana: "Africa",
  guinea: "Africa",
  "guinea-bissau": "Africa",
  "ivory coast": "Africa",
  kenya: "Africa",
  lesotho: "Africa",
  liberia: "Africa",
  libya: "Africa",
  madagascar: "Africa",
  malawi: "Africa",
  mali: "Africa",
  mauritania: "Africa",
  mauritius: "Africa",
  morocco: "Africa",
  mozambique: "Africa",
  namibia: "Africa",
  niger: "Africa",
  nigeria: "Africa",
  rwanda: "Africa",
  "sao tome and principe": "Africa",
  senegal: "Africa",
  seychelles: "Africa",
  "sierra leone": "Africa",
  somalia: "Africa",
  "south africa": "Africa",
  "south sudan": "Africa",
  sudan: "Africa",
  tanzania: "Africa",
  togo: "Africa",
  tunisia: "Africa",
  uganda: "Africa",
  zambia: "Africa",
  zimbabwe: "Africa",

  // Asia
  afghanistan: "Asia",
  armenia: "Asia",
  azerbaijan: "Asia",
  bahrain: "Asia",
  bangladesh: "Asia",
  bhutan: "Asia",
  brunei: "Asia",
  cambodia: "Asia",
  china: "Asia",
  georgia: "Asia",
  india: "Asia",
  indonesia: "Asia",
  iran: "Asia",
  iraq: "Asia",
  israel: "Asia",
  japan: "Asia",
  jordan: "Asia",
  kazakhstan: "Asia",
  kuwait: "Asia",
  kyrgyzstan: "Asia",
  laos: "Asia",
  lebanon: "Asia",
  malaysia: "Asia",
  maldives: "Asia",
  mongolia: "Asia",
  myanmar: "Asia",
  nepal: "Asia",
  "north korea": "Asia",
  oman: "Asia",
  pakistan: "Asia",
  palestine: "Asia",
  philippines: "Asia",
  qatar: "Asia",
  russia: "Asia",
  "saudi arabia": "Asia",
  singapore: "Asia",
  "south korea": "Asia",
  korea: "Asia",
  "sri lanka": "Asia",
  syria: "Asia",
  taiwan: "Asia",
  tajikistan: "Asia",
  thailand: "Asia",
  "timor-leste": "Asia",
  turkey: "Asia",
  turkmenistan: "Asia",
  "united arab emirates": "Asia",
  uae: "Asia",
  uzbekistan: "Asia",
  vietnam: "Asia",
  yemen: "Asia",

  // Europe
  albania: "Europe",
  andorra: "Europe",
  austria: "Europe",
  belarus: "Europe",
  belgium: "Europe",
  "bosnia and herzegovina": "Europe",
  bulgaria: "Europe",
  croatia: "Europe",
  cyprus: "Europe",
  "czech republic": "Europe",
  czechia: "Europe",
  denmark: "Europe",
  estonia: "Europe",
  finland: "Europe",
  france: "Europe",
  germany: "Europe",
  greece: "Europe",
  hungary: "Europe",
  iceland: "Europe",
  ireland: "Europe",
  italy: "Europe",
  kosovo: "Europe",
  latvia: "Europe",
  liechtenstein: "Europe",
  lithuania: "Europe",
  luxembourg: "Europe",
  malta: "Europe",
  moldova: "Europe",
  monaco: "Europe",
  montenegro: "Europe",
  netherlands: "Europe",
  "north macedonia": "Europe",
  norway: "Europe",
  poland: "Europe",
  portugal: "Europe",
  romania: "Europe",
  "san marino": "Europe",
  serbia: "Europe",
  slovakia: "Europe",
  slovenia: "Europe",
  spain: "Europe",
  sweden: "Europe",
  switzerland: "Europe",
  ukraine: "Europe",
  "united kingdom": "Europe",
  uk: "Europe",
  gb: "Europe",
  "great britain": "Europe",
  britain: "Europe",
  england: "Europe",
  scotland: "Europe",
  wales: "Europe",
  "northern ireland": "Europe",
  "vatican city": "Europe",

  // North America
  "antigua and barbuda": "North America",
  bahamas: "North America",
  barbados: "North America",
  belize: "North America",
  canada: "North America",
  "costa rica": "North America",
  cuba: "North America",
  dominica: "North America",
  "dominican republic": "North America",
  "el salvador": "North America",
  grenada: "North America",
  guatemala: "North America",
  haiti: "North America",
  honduras: "North America",
  jamaica: "North America",
  mexico: "North America",
  nicaragua: "North America",
  panama: "North America",
  "saint kitts and nevis": "North America",
  "saint lucia": "North America",
  "saint vincent and the grenadines": "North America",
  "trinidad and tobago": "North America",
  "united states": "North America",
  "united states of america": "North America",
  usa: "North America",
  us: "North America",
  america: "North America",

  // South America
  argentina: "South America",
  bolivia: "South America",
  brazil: "South America",
  chile: "South America",
  colombia: "South America",
  ecuador: "South America",
  guyana: "South America",
  paraguay: "South America",
  peru: "South America",
  suriname: "South America",
  uruguay: "South America",
  venezuela: "South America",

  // Oceania
  australia: "Oceania",
  fiji: "Oceania",
  kiribati: "Oceania",
  "marshall islands": "Oceania",
  micronesia: "Oceania",
  nauru: "Oceania",
  "new zealand": "Oceania",
  palau: "Oceania",
  "papua new guinea": "Oceania",
  samoa: "Oceania",
  "solomon islands": "Oceania",
  tonga: "Oceania",
  tuvalu: "Oceania",
  vanuatu: "Oceania",
}

export function getCountryContinent(country: string): string {
  const canonical = canonicalizeCountryName(country)
  const normalized = canonical.toLowerCase().trim()
  return countryToContinentMap[normalized] || "Other"
}

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/\p{Diacritic}+/gu, "")
}

function cleanToken(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .trim()
    .replace(/[.]/g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
}

// Global, rule-based aliases (not city-specific).
const countryAliases: Record<string, string> = {
  // UK
  uk: "United Kingdom",
  "u k": "United Kingdom",
  gb: "United Kingdom",
  "great britain": "United Kingdom",
  britain: "United Kingdom",
  "united kingdom of great britain and northern ireland": "United Kingdom",

  // US
  us: "United States",
  usa: "United States",
  "u s": "United States",
  "united states of america": "United States",

  // Common non-English/alt spellings
  brasil: "Brazil",
  "cote d ivoire": "Côte d’Ivoire",
  "cote d'ivoire": "Côte d’Ivoire",
  "ivory coast": "Côte d’Ivoire",
}

/**
 * Canonicalize country strings globally.
 * - Handles common aliases (UK/GB/USA/etc)
 * - Handles ISO-3166 alpha-2 codes via Intl.DisplayNames when available
 * - Normalizes punctuation/diacritics for alias matching
 */
export function canonicalizeCountryName(country: string): string {
  const raw = (country || "").trim()
  if (!raw) return "Unknown"

  const token = cleanToken(raw)
  if (countryAliases[token]) return countryAliases[token]

  // ISO alpha-2 code support (e.g. "GB" -> "United Kingdom")
  const code = token.replace(/\s+/g, "").toUpperCase()
  const alpha2 = /^[A-Z]{2}$/.test(code) ? code : null
  if (alpha2) {
    const normalizedCode = alpha2 === "UK" ? "GB" : alpha2
    try {
      // In Node this is available; in browsers it is usually available too.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dn = new (Intl as any).DisplayNames(["en"], { type: "region" })
      const name = dn.of(normalizedCode)
      if (typeof name === "string" && name.trim() && name.toUpperCase() !== normalizedCode) {
        return name.trim()
      }
    } catch {
      // ignore
    }
  }

  // If it's already a plain English country name, leave it as-is.
  // (We do not attempt fuzzy matching here to avoid surprising rewrites.)
  return raw
}

// Backwards compatibility: keep old export name, but return canonical values.
export function normalizeCountryName(country: string): string {
  return canonicalizeCountryName(country)
}
