import { URLImportResult } from "@/types/url-import"
import { ProviderExtractor } from "@/types/providers"

export class SocialMediaExtractor implements ProviderExtractor {
  canHandle(url: URL): boolean {
    return (
      url.hostname.includes("instagram.com") || url.hostname.includes("tiktok.com")
    )
  }

  async extract(url: URL): Promise<URLImportResult> {
    // Social media URLs are treated as low-signal inspiration sources
    // Extract minimal data from OpenGraph, require user confirmation

    const ogData = await this.fetchOpenGraph(url)

    return {
      draft: {
        name: ogData.title || "Untitled Spot",
        city: "Unknown", // Cannot reliably extract
        country: "Unknown",
        continent: "Unknown",
        coordinates: { lat: 0, lng: 0 }, // Cannot extract
        category: "other",
        link: url.toString(),
        comments: ogData.description,
        useCustomImage: false,
        iconColor: "grey",
        visited: false,
      },
      meta: {
        provider: url.hostname.includes("instagram") ? "instagram" : "tiktok",
        method: "opengraph",
        confidence: {
          name: "low",
          address: "low",
          coordinates: "low",
          city: "low",
          country: "low",
          continent: "low",
          category: "low",
          link: "high", // URL itself is valid
        },
        requiresConfirmation: true, // Force user to fill in details
        warnings: [
          "Social media URL detected - extracted data is unreliable",
          "Please manually verify all location details",
        ],
        rawUrl: url.toString(),
        resolvedUrl: url.toString(),
      },
    }
  }

  private async fetchOpenGraph(
    url: URL
  ): Promise<{ title?: string; description?: string }> {
    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10000),
      })
      const html = await response.text()

      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)
      const descMatch = html.match(
        /<meta property="og:description" content="([^"]+)"/
      )

      return {
        title: titleMatch ? titleMatch[1] : undefined,
        description: descMatch ? descMatch[1] : undefined,
      }
    } catch {
      return {}
    }
  }
}
