"use client"

import { useState, useEffect } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ListView } from "@/components/list-view"
import { MapView } from "@/components/map-view"
import { ViewToggle } from "@/components/view-toggle"
import { CategoryFilter } from "@/components/category-filter"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/components/providers/auth-provider"
import { fetchSpots, deleteSpot, toggleSpotVisited, updateSpot } from "@/lib/api/spots"
import { toast } from "sonner"
import type { Spot } from "@/types/spot"
import { SpotDetailsDialog } from "@/components/spot-details-dialog"
import { getCountryContinent } from "@/lib/country-utils"
import { useRouter } from "next/navigation"

interface NavigationState {
  level: "continent" | "country" | "city" | "spots"
  continent?: string
  country?: string
  city?: string
}

function deriveInitialNavigation(spots: Spot[]): NavigationState {
  if (spots.length === 0) return { level: "continent" }

  const continentOf = (s: Spot) => s.continent || getCountryContinent(s.country)

  const continents = Array.from(new Set(spots.map(continentOf).filter(Boolean)))
  if (continents.length !== 1) return { level: "continent" }

  const continent = continents[0]
  const continentSpots = spots.filter((s) => continentOf(s) === continent)
  const countries = Array.from(new Set(continentSpots.map((s) => s.country).filter(Boolean)))
  if (countries.length !== 1) return { level: "country", continent }

  const country = countries[0]
  const countrySpots = continentSpots.filter((s) => s.country === country)
  const cities = Array.from(new Set(countrySpots.map((s) => s.city).filter(Boolean)))
  if (cities.length !== 1) return { level: "city", continent, country }

  const city = cities[0]
  return { level: "spots", continent, country, city }
}

export default function VisitedPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"list" | "map" | "explore">("list")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [navigation, setNavigation] = useState<NavigationState>({ level: "continent" })
  const [didInitNavigation, setDidInitNavigation] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [isSpotDetailsOpen, setIsSpotDetailsOpen] = useState(false)

  useEffect(() => {
    if (userId) {
      loadSpots()
    } else if (!authLoading) {
      setSpots([])
      setLoading(false)
      setNavigation({ level: "continent" })
      setDidInitNavigation(false)
    }
  }, [userId, authLoading])

  const loadSpots = async () => {
    try {
      setLoading(true)
      const data = await fetchSpots()
      // Filter to only visited spots
      const visitedSpots = data.filter((spot) => spot.visited)
      setSpots(visitedSpots)
      if (!didInitNavigation) {
        setNavigation(deriveInitialNavigation(visitedSpots))
        setDidInitNavigation(true)
      }
    } catch (error) {
      console.error("Error loading spots:", error)
      toast.error("Failed to load spots")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSpot = async (id: string) => {
    try {
      await deleteSpot(id)
      setSpots(spots.filter((s) => s.id !== id))
      toast.success("Spot deleted")
    } catch (error) {
      console.error("Error deleting spot:", error)
      toast.error("Failed to delete spot")
    }
  }

  const handleToggleVisited = async (id: string, visited: boolean) => {
    try {
      await toggleSpotVisited(id, visited)
      // If unmarking as visited, remove from this view
      if (!visited) {
        setSpots(spots.filter((s) => s.id !== id))
        toast.success("Marked as not visited")
      } else {
        setSpots(spots.map((s) => (s.id === id ? { ...s, visited } : s)))
        toast.success("Marked as visited")
      }
    } catch (error) {
      console.error("Error toggling visited:", error)
      toast.error("Failed to update spot")
    }
  }

  const handleSpotClick = (spot: Spot) => {
    setDidInitNavigation(true)
    setSelectedSpot(spot)
    setIsSpotDetailsOpen(true)
  }

  const handleUpdateSpot = async (spot: Spot) => {
    try {
      const updated = await updateSpot(spot)
      // If spot is no longer visited, remove it from the list
      if (!updated.visited) {
        setSpots(spots.filter((s) => s.id !== updated.id))
        toast.success("Spot updated and removed from visited list")
      } else {
        setSpots(spots.map((s) => (s.id === updated.id ? updated : s)))
        toast.success("Spot updated")
      }
      setIsSpotDetailsOpen(false)
      setSelectedSpot(null)
    } catch (error) {
      console.error("Error updating spot:", error)
      toast.error("Failed to update spot")
    }
  }

  const filteredSpots = selectedCategory === "all" ? spots : spots.filter((s) => s.category === selectedCategory)

  // Loading state
  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </main>
    )
  }

  // Not authenticated state
  if (!user) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-6 py-12 flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold">Welcome to Roamo</h2>
            <p className="text-muted-foreground">Sign in to view your visited spots</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-balance">Visited Spots</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {spots.length} {spots.length === 1 ? "place" : "places"} you've visited
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} spots={spots} />
          <ViewToggle view={view} onViewChange={setView} />
        </div>

        {/* Content */}
        {spots.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No visited spots yet. Mark spots as visited to see them here.</p>
          </div>
        ) : view === "list" ? (
          <ListView
            spots={filteredSpots}
            onDeleteSpot={handleDeleteSpot}
            onToggleVisited={handleToggleVisited}
            navigation={navigation}
            onNavigationChange={(nav) => {
              setDidInitNavigation(true)
              setNavigation(nav)
            }}
            onSpotClick={handleSpotClick}
            mode="browse"
          />
        ) : view === "explore" ? (
          <ListView
            spots={filteredSpots}
            onDeleteSpot={handleDeleteSpot}
            onToggleVisited={handleToggleVisited}
            navigation={navigation}
            onNavigationChange={(nav) => {
              setDidInitNavigation(true)
              setNavigation(nav)
            }}
            onSpotClick={handleSpotClick}
            mode="all"
          />
        ) : (
          <MapView spots={filteredSpots} navigation={navigation} onSpotClick={handleSpotClick} />
        )}
      </div>

      <SpotDetailsDialog
        open={isSpotDetailsOpen}
        onOpenChange={(open) => {
          setIsSpotDetailsOpen(open)
          if (!open) setSelectedSpot(null)
        }}
        spot={selectedSpot}
        onSave={handleUpdateSpot}
      />
    </main>
  )
}
