"use client"

import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddSpotDialog } from "@/components/add-spot-dialog"
import { ListView } from "@/components/list-view"
import { MapView } from "@/components/map-view"
import { ViewToggle } from "@/components/view-toggle"
import { CategoryFilter } from "@/components/category-filter"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/components/providers/auth-provider"
import { fetchSpots, createSpot, deleteSpot } from "@/lib/api/spots"
import { toast } from "sonner"
import type { Spot } from "@/types/spot"

interface NavigationState {
  level: "continent" | "country" | "city" | "spots"
  continent?: string
  country?: string
  city?: string
}

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [view, setView] = useState<"list" | "map">("list")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [navigation, setNavigation] = useState<NavigationState>({ level: "continent" })

  useEffect(() => {
    if (user) {
      loadSpots()
    } else if (!authLoading) {
      setSpots([])
      setLoading(false)
    }
  }, [user, authLoading])

  const loadSpots = async () => {
    try {
      setLoading(true)
      const data = await fetchSpots()
      setSpots(data)
    } catch (error) {
      console.error("Error loading spots:", error)
      toast.error("Failed to load spots")
    } finally {
      setLoading(false)
    }
  }

  const handleAddSpot = async (spot: Spot) => {
    try {
      const newSpot = await createSpot(spot)
      setSpots([newSpot, ...spots])
      setIsAddDialogOpen(false)
      toast.success("Spot added successfully")
    } catch (error) {
      console.error("Error adding spot:", error)
      toast.error("Failed to add spot")
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
            <p className="text-muted-foreground">Sign in to start saving your favorite travel spots</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-balance">Travel Spots</h1>
            <p className="mt-2 text-sm text-muted-foreground">Save and organize your favorite places</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Spot
          </Button>
        </div>

        {/* Controls */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <CategoryFilter selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} spots={spots} />
          <ViewToggle view={view} onViewChange={setView} />
        </div>

        {/* Content */}
        {spots.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No spots added yet. Click "Add Spot" to get started.</p>
          </div>
        ) : view === "list" ? (
          <ListView spots={filteredSpots} onDeleteSpot={handleDeleteSpot} navigation={navigation} onNavigationChange={setNavigation} />
        ) : (
          <MapView spots={filteredSpots} navigation={navigation} />
        )}
      </div>

      <AddSpotDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onAddSpot={handleAddSpot} />
    </main>
  )
}
