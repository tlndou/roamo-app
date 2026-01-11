import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchPlaceOpeningHours } from "@/lib/google/places-details"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const spotId = typeof body?.spotId === "string" ? body.spotId : ""

    if (!spotId) {
      return NextResponse.json({ error: "spotId is required" }, { status: 400 })
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 501 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { data: spot, error: spotError } = await supabase
      .from("spots")
      .select("id, user_id, google_place_id, opening_hours_source")
      .eq("id", spotId)
      .single()

    if (spotError || !spot) {
      return NextResponse.json({ error: "Spot not found" }, { status: 404 })
    }

    if (spot.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const placeId = (spot as any).google_place_id as string | null
    if (!placeId) {
      return NextResponse.json({ error: "Spot has no google_place_id" }, { status: 400 })
    }

    const opening = await fetchPlaceOpeningHours(placeId, googleApiKey)
    if (!opening) {
      // Don't overwrite existing values; just report.
      return NextResponse.json({ ok: true, updated: false, reason: "no_opening_hours_returned" })
    }

    const openingHours = { source: "google_places" as const, ...opening }

    const { data: updated, error: updateError } = await supabase
      .from("spots")
      .update({
        opening_hours: openingHours as any,
        opening_hours_source: "google_places",
        updated_at: new Date().toISOString(),
      })
      .eq("id", spotId)
      .select("*")
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to update spot hours" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: true, spot: updated })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to enrich opening hours", message: e?.message || String(e) },
      { status: 500 }
    )
  }
}


