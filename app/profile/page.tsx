"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileStats } from "@/components/profile/profile-stats"
import { StarSignCard } from "@/components/profile/star-sign-card"
import { ProfileMenu } from "@/components/profile/profile-menu"
import { useAuth } from "@/components/providers/auth-provider"
import { fetchProfileStats, type ProfileStats as Stats } from "@/lib/api/profile-stats"
import Link from "next/link"

export default function ProfilePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

  useEffect(() => {
    async function loadStats() {
      if (user) {
        try {
          const profileStats = await fetchProfileStats(user.id)
          setStats(profileStats)
        } catch (error) {
          console.error("Error loading stats:", error)
        } finally {
          setLoadingStats(false)
        }
      }
    }

    loadStats()
  }, [user])

  if (loading || loadingStats) {
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

  const displayName = profile.displayName || profile.username || "User"
  const initials =
    profile.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || profile.username?.slice(0, 2).toUpperCase() || "U"

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Spots
            </Button>
          </Link>
          <ProfileMenu />
        </div>

        {/* Profile Header */}
        <div className="mb-8 flex items-center gap-6">
          <Avatar className="h-24 w-24">
            {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={displayName} />}
            <AvatarFallback className="text-2xl font-semibold text-muted-foreground ring-1 ring-border">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-semibold">{displayName}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-8">
            <ProfileStats stats={stats} />
          </div>
        )}

        {/* Star Sign */}
        {profile.zodiacSign && (
          <div className="mb-8">
            <StarSignCard zodiacSign={profile.zodiacSign} />
          </div>
        )}
      </div>
    </main>
  )
}
