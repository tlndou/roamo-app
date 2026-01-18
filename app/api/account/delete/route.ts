import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const confirmUsername = typeof body?.confirmUsername === "string" ? body.confirmUsername.trim() : ""

    const supabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Fetch current username from DB (source of truth)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single() as { data: { username: string | null; avatar_url: string | null } | null; error: any }

    if (profileError || !profile?.username) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (!confirmUsername || confirmUsername.toLowerCase() !== profile.username.toLowerCase()) {
      return NextResponse.json({ error: "Username confirmation does not match" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error: "Server is missing SUPABASE_SERVICE_ROLE_KEY",
          message: "Set SUPABASE_SERVICE_ROLE_KEY on the server to enable account deletion.",
        },
        { status: 500 }
      )
    }

    const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Best-effort cleanup:
    // - delete spots
    // - delete avatar file from storage (if possible)
    // - delete profile row
    await admin.from("spots").delete().eq("user_id", user.id)

    if (profile.avatar_url) {
      const path = profile.avatar_url.split("/avatars/")[1]
      if (path) {
        await admin.storage.from("avatars").remove([path])
      }
    }

    await admin.from("profiles").delete().eq("id", user.id)

    // Delete auth user (requires service role)
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteUserError) throw deleteUserError

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[account-delete] error:", error)
    return NextResponse.json(
      { error: "Failed to delete account", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}


