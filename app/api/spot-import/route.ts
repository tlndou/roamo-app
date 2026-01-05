import { NextRequest, NextResponse } from "next/server"
import { URLExtractor } from "@/lib/url-import/extractor"
import { URLValidationError } from "@/lib/url-import/url-validator"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Google Maps extraction is API-backed (recommended), but other URLs should still be importable
    // without a Google key.
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    console.log("[spot-import] GOOGLE_MAPS_API_KEY configured:", Boolean(googleApiKey))
    const extractor = new URLExtractor(googleApiKey)
    const result = await extractor.extractFromURL(url)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof URLValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("URL import error:", error)
    return NextResponse.json(
      { error: "Failed to import URL" },
      { status: 500 }
    )
  }
}
