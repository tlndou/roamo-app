import { URLImportResult, ConfidenceLevel, FieldConfidence } from "@/types/url-import"
import { ProviderExtractor } from "@/types/providers"

interface PinMetadata {
  title?: string
  description?: string
  image?: string
  destinationUrl?: string
}

export class PinterestExtractor implements ProviderExtractor {
  private googleApiKey?: string

  constructor(googleApiKey?: string) {
    this.googleApiKey = googleApiKey
  }

  canHandle(url: URL): boolean {
    return url.hostname.includes("pinterest.com") || url.hostname.includes("pin.it")
  }

  async extract(url: URL): Promise<URLImportResult> {
    // STEP 1: Extract Pinterest metadata
    let pinData: PinMetadata
    try {
      pinData = await this.fetchPinMetadata(url)
    } catch (error) {
      // Can't fetch Pinterest - return error result
      return this.createErrorResult(url, error instanceof Error ? error.message : String(error))
    }

    // STEP 2: Check for destination URL
    const destinationUrl = pinData.destinationUrl

    if (!destinationUrl) {
      // No destination - return Pinterest-only result (low confidence)
      return this.createPinterestOnlyResult(url, pinData)
    }

    // STEP 3: Extract from destination URL
    let destinationResult: URLImportResult
    try {
      // Dynamically import URLExtractor to avoid circular dependency
      const { URLExtractor } = await import("../extractor")
      const urlExtractor = new URLExtractor(this.googleApiKey)
      destinationResult = await urlExtractor.extractFromURL(destinationUrl)
    } catch (error) {
      // Destination extraction failed - fall back to Pinterest-only
      return this.createPinterestOnlyResult(url, pinData, {
        destinationUrl,
        destinationError: error instanceof Error ? error.message : String(error),
      })
    }

    // STEP 4: Merge Pinterest + Destination data
    return this.mergeResults(url, pinData, destinationResult)
  }

  private stripScriptsAndStyles(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
  }

  private stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  }

  private cleanPinTitle(raw: string | undefined): string | undefined {
    if (!raw) return undefined
    let t = this.decodeHtmlEntities(raw).replace(/\s+/g, " ").trim()
    if (!t) return undefined
    // Pinterest titles often include extra UI/board context after separators like "|".
    t = t.split("|")[0]?.trim() ?? t
    t = t.split("—")[0]?.trim() ?? t
    // Avoid returning generic chrome
    if (!t || ["pinterest", "log in", "sign up"].includes(t.toLowerCase())) return undefined
    return t
  }

  private cleanPinText(raw: string | undefined): string | undefined {
    if (!raw) return undefined
    let t = this.decodeHtmlEntities(raw).replace(/\s+/g, " ").trim()
    if (!t) return undefined
    // Drop obvious injected JS fragments if they somehow leak into text
    if (/\b(document\.addEventListener|let\s+\w+\s*=|function\s*\(|securitypoli|cspReportsCount)\b/i.test(t)) {
      t = t.split("document.addEventListener")[0]?.trim() ?? t
      t = t.split("let cspReportsCount")[0]?.trim() ?? t
    }
    // Cap length to avoid dumping whole pages into comments
    if (t.length > 600) t = t.slice(0, 600).trim() + "…"
    return t || undefined
  }

  private async fetchPinMetadata(url: URL): Promise<PinMetadata> {
    let html: string | null = null
    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SpotBot/1.0)",
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      })

      // Pinterest sometimes blocks automated fetching (403/999/etc.). We'll fall back to oEmbed.
      if (response.ok) {
        html = await response.text()
      }
    } catch {
      // fall through to oEmbed
    }

    // Fallback: Pinterest oEmbed (often works when HTML is blocked)
    if (!html) {
      const oembed = await this.fetchOEmbed(url)
      return {
        title: oembed.title,
        description: oembed.description,
        image: oembed.image,
        destinationUrl: oembed.destinationUrl,
      }
    }

    const safeHtml = this.stripScriptsAndStyles(html)

    // Extract OpenGraph metadata
    const ogTitle = safeHtml.match(/<meta property="og:title" content="([^"]+)"/)?.[1]
    const ogDesc = safeHtml.match(/<meta property="og:description" content="([^"]+)"/)?.[1]
    const ogImage = safeHtml.match(/<meta property="og:image" content="([^"]+)"/)?.[1]

    // Fallbacks: <title> and <h1> (Pinterest often renders text without OG when logged-out)
    const titleTag = safeHtml.match(/<title>([^<]+)<\/title>/i)?.[1]
    const h1 = safeHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    const metaDesc = safeHtml.match(/<meta name="description" content="([^"]+)"/i)?.[1]

    const text = this.stripTags(safeHtml)
    const guessDesc = (() => {
      // Pick the first "sentence-like" fragment that isn't generic UI chrome.
      const banned = ["skip to content", "log in", "sign up", "download image", "comments", "more about this pin", "search"]
      const parts = text.split(" ").join(" ")
      // Try to find a snippet around a strong keyword.
      const m = parts.match(/.{0,40}\b(restaurant|cafe|coffee|bar|hotel|museum|tickets)\b.{0,120}/i)
      if (m?.[0]) {
        const snippet = m[0].trim()
        if (!banned.some((b) => snippet.toLowerCase().includes(b))) return snippet
      }
      return undefined
    })()

    // Extract destination URL from Pinterest
    const destinationUrl = this.extractDestinationUrl(safeHtml)

    return {
      title: this.cleanPinTitle(ogTitle) ?? this.cleanPinTitle(h1 ? this.stripTags(h1) : undefined) ?? this.cleanPinTitle(titleTag),
      description: this.cleanPinText(ogDesc) ?? this.cleanPinText(metaDesc) ?? this.cleanPinText(guessDesc),
      image: ogImage ? this.decodeHtmlEntities(ogImage.trim()) : undefined,
      destinationUrl,
    }
  }

  private async fetchOEmbed(url: URL): Promise<PinMetadata> {
    // Pinterest oEmbed endpoint (unauthenticated)
    const endpoint = new URL("https://www.pinterest.com/oembed.json")
    endpoint.searchParams.set("url", url.toString())
    endpoint.searchParams.set("omit_script", "true")

    const response = await fetch(endpoint.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SpotBot/1.0)",
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Pinterest fetch failed (HTML blocked and oEmbed failed): HTTP ${response.status}`)
    }

    const data: any = await response.json().catch(() => ({}))
    const title = typeof data?.title === "string" ? data.title : undefined
    const description = typeof data?.author_name === "string" ? `Pinned by ${data.author_name}` : undefined
    const image = typeof data?.thumbnail_url === "string" ? data.thumbnail_url : undefined

    // Some oEmbed payloads include provider_url/url which are Pinterest; destination is often not provided.
    // We keep destinationUrl null unless we can extract it from HTML later.
    return { title, description, image }
  }

  private extractDestinationUrl(html: string): string | undefined {
    // Try JSON-LD first
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1])
        // Pinterest often includes the destination as "url" or "contentUrl"
        if (jsonLd.url && !jsonLd.url.includes("pinterest.com")) {
          return jsonLd.url
        }
        if (jsonLd.contentUrl && !jsonLd.contentUrl.includes("pinterest.com")) {
          return jsonLd.contentUrl
        }
        // Some pages use "mainEntityOfPage" / "sameAs" / "citation"
        const candidates = [
          jsonLd.mainEntityOfPage,
          jsonLd.sameAs,
          jsonLd.citation,
          jsonLd.relatedLink,
          jsonLd.isBasedOn,
        ].flat().filter(Boolean)
        for (const c of candidates) {
          if (typeof c === "string" && c.startsWith("http") && !c.includes("pinterest.com")) return c
        }
      } catch {
        // JSON parse failed, continue to other methods
      }
    }

    // Try meta tags
    const seeAlso = html.match(/<meta property="og:see_also" content="([^"]+)"/)?.[1]
    if (seeAlso && !seeAlso.includes("pinterest.com")) {
      return seeAlso
    }

    // Try canonical link (external destinations)
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
    if (canonical && !canonical.includes("pinterest.com")) {
      return canonical
    }

    // Common embedded fields
    const directFields = [
      /"sourceUrl":"(https?:\/\/[^"]+)"/g,
      /"originUrl":"(https?:\/\/[^"]+)"/g,
      /"source_url":"(https?:\/\/[^"]+)"/g,
      /"website_url":"(https?:\/\/[^"]+)"/g,
    ]
    for (const re of directFields) {
      const m = re.exec(html)
      if (m?.[1]) {
        const u = m[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/")
        if (!u.includes("pinterest.com") && !u.includes("pinimg.com")) return u
      }
    }

    // Try to find external links in the pin data
    const urlMatch = html.match(/"link":"(https?:\/\/[^"]+)"/g)
    if (urlMatch) {
      // Find first non-Pinterest URL
      for (const match of urlMatch) {
        const urlCandidate = match.match(/"link":"([^"]+)"/)?.[1]
        if (urlCandidate && !urlCandidate.includes("pinterest.com") && !urlCandidate.includes("pinimg.com")) {
          // Unescape the URL
          return urlCandidate.replace(/\\u002F/g, "/").replace(/\\\//g, "/")
        }
      }
    }

    return undefined
  }

  private mergeResults(url: URL, pinData: PinMetadata, destinationResult: URLImportResult): URLImportResult {
    return {
      draft: {
        // DESTINATION takes precedence for structured fields
        name: destinationResult.draft.name,
        address: destinationResult.draft.address,
        city: destinationResult.draft.city,
        country: destinationResult.draft.country,
        continent: destinationResult.draft.continent,
        coordinates: destinationResult.draft.coordinates,
        category: destinationResult.draft.category,

        // PINTEREST image overrides destination (user's chosen visual)
        customImage: pinData.image,
        useCustomImage: Boolean(pinData.image),

        // Link points to original Pinterest URL
        link: url.toString(),

        // Merge comments: Pinterest context + destination comments
        comments: this.mergeComments(pinData, destinationResult.draft),

        iconColor: destinationResult.draft.iconColor,
        visited: destinationResult.draft.visited,
        rating: destinationResult.draft.rating,
      },
      meta: {
        provider: "pinterest",
        method: `pinterest+${destinationResult.meta.method}`,

        // Confidence: downgrade based on destination quality
        confidence: this.downgradeConfidence(destinationResult.meta.confidence),

        // Pinterest is a proxy/curation source — always require confirmation.
        requiresConfirmation: true,

        warnings: [
          "Pinterest pin imported - destination URL extracted and processed",
          ...destinationResult.meta.warnings,
        ],

        rawUrl: url.toString(),
        resolvedUrl: url.toString(),

        signals: {
          ...destinationResult.meta.signals,
          pinterest: {
            pinTitle: pinData.title,
            pinDescription: pinData.description,
            destinationUrl: destinationResult.meta.resolvedUrl,
          },
        },

        flags: destinationResult.meta.flags,
        ai: destinationResult.meta.ai,
      },
    }
  }

  private mergeComments(pinData: PinMetadata, destinationDraft: any): string | undefined {
    const parts: string[] = []

    // Pinterest context first (user's curation)
    if (pinData.title && pinData.title !== destinationDraft.name) {
      parts.push(`Pinterest: ${pinData.title}`)
    }
    if (pinData.description) {
      parts.push(pinData.description)
    }

    // Destination comments
    if (destinationDraft.comments) {
      parts.push(destinationDraft.comments)
    }

    return parts.length ? parts.join("\n\n") : undefined
  }

  private downgradeConfidence(destinationConfidence: FieldConfidence): FieldConfidence {
    // Pinterest as a proxy slightly downgrades confidence
    // because we're one step removed from the source
    const downgrade = (level: ConfidenceLevel): ConfidenceLevel => {
      if (level === "high") return "medium"
      return level // medium stays medium, low stays low
    }

    return {
      name: downgrade(destinationConfidence.name),
      address: downgrade(destinationConfidence.address),
      coordinates: downgrade(destinationConfidence.coordinates),
      city: downgrade(destinationConfidence.city),
      country: downgrade(destinationConfidence.country),
      continent: downgrade(destinationConfidence.continent),
      category: downgrade(destinationConfidence.category),
      link: "high", // Pinterest URL itself is valid
    }
  }

  private createPinterestOnlyResult(
    url: URL,
    pinData: PinMetadata,
    fallbackContext?: {
      destinationUrl?: string
      destinationError?: string
    }
  ): URLImportResult {
    const inferred = this.inferFromPinText(pinData)
    const warnings: string[] = []

    if (fallbackContext?.destinationUrl) {
      warnings.push(
        `Pinterest destination URL found (${fallbackContext.destinationUrl}) but extraction failed: ${fallbackContext.destinationError}`
      )
    } else {
      warnings.push("Pinterest pin imported without a destination website link.")
    }
    warnings.push("Please confirm location details before saving.")

    if (inferred.name || inferred.category || inferred.city || inferred.country) {
      warnings.push("Some fields were prefilled from the pin text and may be incomplete.")
    }

    return {
      draft: {
        name: inferred.name || pinData.title || "Untitled Spot",
        city: inferred.city || "Unknown",
        country: inferred.country || "Unknown",
        continent: "Unknown",
        coordinates: { lat: 0, lng: 0 },
        category: inferred.category || "other",
        link: url.toString(),
        comments: pinData.description,
        customImage: pinData.image,
        useCustomImage: Boolean(pinData.image),
        iconColor: "grey",
        visited: false,
      },
      meta: {
        provider: "pinterest",
        method: "pinterest_only",
        confidence: {
          name: inferred.name ? "medium" : pinData.title ? "low" : "low",
          address: "low",
          coordinates: "low",
          city: inferred.city ? "low" : "low",
          country: inferred.country ? "low" : "low",
          continent: "low",
          category: inferred.category ? "medium" : "low",
          link: "high",
        },
        requiresConfirmation: true,
        warnings,
        rawUrl: url.toString(),
        resolvedUrl: url.toString(),
        signals: {
          pinterest: {
            pinTitle: pinData.title,
            pinDescription: pinData.description,
            destinationUrl: fallbackContext?.destinationUrl,
            inferredEvidence: inferred.evidence.length ? inferred.evidence : undefined,
          },
        },
      },
    }
  }

  private inferFromPinText(pinData: PinMetadata): {
    name?: string
    category?: any
    city?: string
    country?: string
    evidence: string[]
  } {
    const evidence: string[] = []
    const title = (this.cleanPinTitle(pinData.title) || "").trim()
    const desc = (pinData.description || "").trim()
    const text = `${title}\n${desc}`.toLowerCase()

    // Category inference from explicit words only (no guessing).
    let category: any | undefined
    if (/\brestaurant\b/.test(text)) {
      category = "restaurant"
      evidence.push('pin_text:contains("restaurant")')
    } else if (/\bcafe\b|\bcoffee\b/.test(text)) {
      category = "cafe"
      evidence.push('pin_text:contains("cafe/coffee")')
    } else if (/\bbar\b|\bcocktail\b/.test(text)) {
      category = "bar"
      evidence.push('pin_text:contains("bar/cocktail")')
    } else if (/\bmuseum\b|\bmusée\b/.test(text)) {
      category = "museum"
      evidence.push('pin_text:contains("museum")')
    } else if (/\bhotel\b|\brooms\b|\bcheck-?in\b/.test(text)) {
      category = "hotel"
      evidence.push('pin_text:contains("hotel/rooms")')
    }

    // Name cleanup: remove obvious prefixes like "restaurant "
    let name: string | undefined
    if (title) {
      name = title
        .replace(/^restaurant\s+/i, "")
        .trim()
      if (name && name.toLowerCase() !== "restaurant") {
        evidence.push("pin_title:cleaned")
      } else {
        name = undefined
      }
    }

    // Scalable location extraction (no city list):
    // 1) Look for "in <city>, <country>" patterns.
    let city: string | undefined
    let country: string | undefined

    const rawText = `${title}\n${desc}`
    const inCode = rawText.match(/\bin\s+([A-Za-z][A-Za-z\s'’\-]{2,50})\s*,\s*([A-Za-z]{2,3})\b/i)
    const inName = rawText.match(/\bin\s+([A-Za-z][A-Za-z\s'’\-]{2,50})\s*,\s*([A-Za-z][A-Za-z\s'’\-]{2,50})(?=[\s.,!]|$)/i)
    const inMatch = inCode ?? inName
    if (inMatch?.[1]) {
      city = inMatch[1].trim()
      evidence.push("pin_text:pattern=in <city>, <country>")
      if (inMatch[2]) {
        const c = inMatch[2].trim().split(/\b(with|and|for|near|at|in)\b/i)[0]?.trim()
        country = c || undefined
      }
    }

    // 2) If title ends with ", <token>" treat that as a city hint.
    if (!city && title) {
      const comma = title.match(/,\s*([A-Za-z][A-Za-z\s'’\-]{2,40})\s*$/)
      if (comma?.[1]) {
        city = comma[1].trim()
        evidence.push("pin_title:trailing_comma_token")
      }
    }

    // 3) Country abbreviation hint: if text contains ", XX" (2-3 letters), use as country (low confidence).
    if (!country) {
      const abbr = `${title} ${desc}`.match(/,\s*([A-Za-z]{2,3})\b/)
      if (abbr?.[1]) {
        country = abbr[1].toUpperCase()
        evidence.push("pin_text:country_abbr_token")
      }
    }

    // Normalize capitalization (best-effort)
    const titleCase = (s: string) =>
      s
        .split(/\s+/)
        .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join(" ")

    return {
      name,
      category,
      city: city ? titleCase(city) : undefined,
      country: country ? titleCase(country) : undefined,
      evidence,
    }
  }

  private createErrorResult(url: URL, errorMessage: string): URLImportResult {
    return {
      draft: {
        name: "Pinterest Pin",
        city: "Unknown",
        country: "Unknown",
        continent: "Unknown",
        coordinates: { lat: 0, lng: 0 },
        category: "other",
        link: url.toString(),
        comments: "Pinterest pin could not be fetched",
        useCustomImage: false,
        iconColor: "grey",
        visited: false,
      },
      meta: {
        provider: "pinterest",
        method: "error",
        confidence: {
          name: "low",
          address: "low",
          coordinates: "low",
          city: "low",
          country: "low",
          continent: "low",
          category: "low",
          link: "high",
        },
        requiresConfirmation: true,
        warnings: [`Pinterest fetch failed: ${errorMessage}`],
        rawUrl: url.toString(),
        resolvedUrl: url.toString(),
      },
    }
  }

  private decodeHtmlEntities(input: string): string {
    return input
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&mdash;", "—")
      .replaceAll("&ndash;", "–")
      .replaceAll("&nbsp;", " ")
  }
}
