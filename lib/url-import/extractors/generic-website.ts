import { URLImportResult } from "@/types/url-import"
import { ProviderExtractor } from "@/types/providers"
import { getCountryContinent, normalizeCountryName } from "@/lib/country-utils"

export class GenericWebsiteExtractor implements ProviderExtractor {
  canHandle(url: URL): boolean {
    return true // Fallback extractor
  }

  async extract(url: URL): Promise<URLImportResult> {
    const metadata = await this.extractMetadata(url)

    const rawCountry = metadata.country || "Unknown"
    const country = rawCountry !== "Unknown" ? normalizeCountryName(rawCountry) : "Unknown"
    const continent =
      rawCountry !== "Unknown" ? getCountryContinent(rawCountry) : "Unknown"

    return {
      draft: {
        name: metadata.title || url.hostname,
        address: metadata.address,
        city: metadata.city || "Unknown",
        country,
        continent,
        coordinates: metadata.coordinates || { lat: 0, lng: 0 },
        category: "other",
        link: url.toString(),
        comments: metadata.description,
        useCustomImage: false,
        iconColor: "grey",
        visited: false,
      },
      meta: {
        provider: "official_website",
        method: metadata.method,
        confidence: {
          name: metadata.title ? "medium" : "low",
          address: metadata.address ? "medium" : "low",
          coordinates: metadata.coordinates ? "medium" : "low",
          city: metadata.city ? "medium" : "low",
          country: metadata.country ? "medium" : "low",
          continent: metadata.country ? "medium" : "low",
          category: "low",
          link: "high",
        },
        // Always require confirmation for generic websites since data is unreliable
        requiresConfirmation: true,
        warnings: metadata.warnings,
        rawUrl: url.toString(),
        resolvedUrl: url.toString(),
      },
    }
  }

  private async extractMetadata(url: URL): Promise<any> {
    try {
      console.log(`[Generic Website] Fetching: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SpotBot/1.0)',
        },
      })

      if (!response.ok) {
        console.error(`[Generic Website] HTTP error: ${response.status}`)
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()
      console.log(`[Generic Website] Fetched ${html.length} bytes of HTML`)

      // Try JSON-LD first (most structured)
      const jsonLd = this.extractJsonLd(html)
      if (jsonLd && jsonLd.title) {
        console.log(`[Generic Website] Found JSON-LD data: ${jsonLd.title}`)
        return { ...jsonLd, method: "json_ld", warnings: [] }
      }

      // Fallback to OpenGraph
      const og = this.extractOpenGraph(html)
      console.log(`[Generic Website] OpenGraph extraction: ${og.title || 'No title found'}`)

      return {
        ...og,
        method: "opengraph",
        warnings: og.title ? ["Limited data available from website"] : ["Could not extract meaningful data from website"],
      }
    } catch (error) {
      console.error(`[Generic Website] Extraction failed:`, error)
      return {
        method: "none",
        warnings: [`Could not fetch website data: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }
    }
  }

  private extractJsonLd(html: string): any | null {
    const match = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    )
    if (!match) return null

    try {
      const data = JSON.parse(match[1])

      // Handle LocalBusiness schema
      if (
        data["@type"] === "LocalBusiness" ||
        data["@type"] === "Restaurant"
      ) {
        return {
          title: data.name,
          address: data.address?.streetAddress,
          city: data.address?.addressLocality,
          country: data.address?.addressCountry,
          coordinates: data.geo
            ? {
                lat: parseFloat(data.geo.latitude),
                lng: parseFloat(data.geo.longitude),
              }
            : undefined,
          description: data.description,
        }
      }
    } catch {
      return null
    }

    return null
  }

  private extractOpenGraph(html: string): any {
    // Try OpenGraph tags first
    const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)
    const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/)

    // Try regular meta tags
    const metaTitleMatch = html.match(/<meta name="title" content="([^"]+)"/)
    const metaDescMatch = html.match(/<meta name="description" content="([^"]+)"/)

    // Try title tag as last resort
    const titleTagMatch = html.match(/<title>([^<]+)<\/title>/)

    const title = ogTitleMatch?.[1] || metaTitleMatch?.[1] || titleTagMatch?.[1]
    const description = ogDescMatch?.[1] || metaDescMatch?.[1]

    console.log(`[Generic Website] Extracted title: ${title || 'None'}`)

    return {
      title: title?.trim(),
      description: description?.trim(),
    }
  }
}
