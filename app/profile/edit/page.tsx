"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProfileForm } from "@/components/profile/profile-form"
import { useAuth } from "@/components/providers/auth-provider"
import Link from "next/link"

export default function ProfilePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="space-y-8">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </main>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </Button>
          </Link>
          <h1 className="text-3xl font-semibold">Edit Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">Update your account information and preferences</p>
        </div>

        {/* Profile Form */}
        <div className="rounded-lg border border-border bg-card p-6">
          <ProfileForm profile={profile} />
        </div>
      </div>
    </main>
  )
}
