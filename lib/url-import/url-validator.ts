const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal", // GCP metadata
]

const BLOCKED_IP_RANGES = [
  /^10\./, // Private
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private
  /^192\.168\./, // Private
]

export class URLValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "URLValidationError"
  }
}

export function validateURL(urlString: string): URL {
  // Parse URL
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw new URLValidationError("Invalid URL format")
  }

  // Only allow HTTP/HTTPS
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new URLValidationError(
      `Protocol ${url.protocol} not allowed. Use HTTP or HTTPS.`
    )
  }

  // Check blocked hosts
  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTS.includes(hostname)) {
    throw new URLValidationError(
      `Host ${hostname} is blocked for security reasons`
    )
  }

  // Check blocked IP ranges
  for (const range of BLOCKED_IP_RANGES) {
    if (range.test(hostname)) {
      throw new URLValidationError(`Private IP addresses are not allowed`)
    }
  }

  return url
}

export async function resolveShortLink(url: URL): Promise<URL> {
  // Include Google Maps short links. These often expand to google.com/maps/... URLs we can parse.
  const shortLinkDomains = ["bit.ly", "t.co", "goo.gl", "tinyurl.com", "ow.ly", "maps.app.goo.gl", "pin.it"]

  if (!shortLinkDomains.includes(url.hostname)) {
    return url // Not a short link
  }

  try {
    // Some short-link providers (notably maps.app.goo.gl) don't reliably support HEAD.
    // Try HEAD first, then fall back to GET to follow redirects.
    let response = await fetch(url.toString(), {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SpotBot/1.0)",
      },
    })

    if (!response.ok || response.status === 405) {
      response = await fetch(url.toString(), {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SpotBot/1.0)",
        },
      })
      try {
        response.body?.cancel()
      } catch {
        // ignore
      }
    }

    const resolvedUrl = new URL(response.url)
    validateURL(resolvedUrl.toString()) // Validate resolved URL
    return resolvedUrl
  } catch {
    // If resolution fails, return original
    return url
  }
}
