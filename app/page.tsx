"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddSpotDialog } from "@/components/add-spot-dialog"
import { ListView } from "@/components/list-view"
import { MapView } from "@/components/map-view"
import { ViewToggle } from "@/components/view-toggle"
import { SpotFilter, applySpotFilters, createDefaultFilter, type SpotFilterState } from "@/components/spot-filter"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocationResolutionContext } from "@/components/providers/location-resolution-provider"
import { fetchSpots, createSpot, deleteSpot, toggleSpotVisited, updateSpot } from "@/lib/api/spots"
import { toast } from "sonner"
import type { Spot } from "@/types/spot"
import { SpotDetailsDialog } from "@/components/spot-details-dialog"
import { getCountryContinent } from "@/lib/country-utils"
import {
  useLocationDiscovery,
  saveLastView,
  type NavigationState,
  type DiscoveryResult,
  type ViewType,
} from "@/hooks/use-location-discovery"
import { useHomeSuggestions } from "@/hooks/use-home-suggestions"
import { HomeSuggestionBanner } from "@/components/home-suggestion-banner"
import { usePushNotificationFlow } from "@/hooks/use-push-notification-flow"
import { PushPermissionDialog } from "@/components/push-permission-dialog"

function deriveInitialNavigation(spots: Spot[]): NavigationState {
  if (spots.length === 0) return { level: "continent" }

  const continentOf = (s: Spot) => s.continent || getCountryContinent(s.country)
  const cityIdOf = (s: Spot) => s.canonicalCityId || ""
  const cityNameOf = (s: Spot) => s.city

  const continents = Array.from(new Set(spots.map(continentOf).filter(Boolean)))
  if (continents.length !== 1) return { level: "continent" }

  const continent = continents[0]
  const continentSpots = spots.filter((s) => continentOf(s) === continent)
  const countries = Array.from(new Set(continentSpots.map((s) => s.country).filter(Boolean)))
  if (countries.length !== 1) return { level: "country", continent }

  const country = countries[0]
  const countrySpots = continentSpots.filter((s) => s.country === country)
  const cityIds = Array.from(new Set(countrySpots.map(cityIdOf).filter(Boolean)))
  if (cityIds.length !== 1) return { level: "city", continent, country }

  const cityId = cityIds[0]
  const cityName = countrySpots.find((s) => cityIdOf(s) === cityId)?.city || cityNameOf(countrySpots[0])
  return { level: "spots", continent, country, cityId, cityName }
}

export default function Home() {
  const { user, profile, loading: authLoading } = useAuth()
  const { homeAwayStatus } = useLocationResolutionContext()
  const userId = user?.id ?? null
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [view, setView] = useState<"list" | "map" | "explore">("list")
  const [spotFilter, setSpotFilter] = useState<SpotFilterState>(createDefaultFilter)
  const [navigation, setNavigation] = useState<NavigationState>({ level: "continent" })
  const [didInitNavigation, setDidInitNavigation] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [isSpotDetailsOpen, setIsSpotDetailsOpen] = useState(false)
  const hasUserNavigatedRef = useRef(false)

  useEffect(() => {
    // Avoid reloading (and showing the full-page skeleton) when Supabase refreshes the session
    // and the `user` object identity changes but the userId stays the same.
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
      setSpots(data)
      if (!didInitNavigation) {
        setNavigation(deriveInitialNavigation(data))
        setDidInitNavigation(true)
      }
    } catch (error) {
      console.error("Error loading spots:", error)
      toast.error("Failed to load spots")
    } finally {
      setLoading(false)
    }
  }

  const handleAddSpot = async (spot: Omit<Spot, "id" | "createdAt">) => {
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

  const handleToggleVisited = async (id: string, visited: boolean) => {
    try {
      await toggleSpotVisited(id, visited)
      setSpots(spots.map((s) => (s.id === id ? { ...s, visited } : s)))
      toast.success(visited ? "Marked as visited" : "Marked as not visited")
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
      setSpots(spots.map((s) => (s.id === updated.id ? updated : s)))
      setIsSpotDetailsOpen(false)
      setSelectedSpot(null)
      toast.success("Spot updated")
    } catch (error) {
      console.error("Error updating spot:", error)
      toast.error("Failed to update spot")
    }
  }

  // Spots filtered by current navigation context (for filter counts)
  const navigationFilteredSpots = useMemo(() => {
    let result = spots
    if (navigation.continent) {
      result = result.filter((s) => (s.continent || getCountryContinent(s.country)) === navigation.continent)
    }
    if (navigation.country) {
      result = result.filter((s) => s.country === navigation.country)
    }
    if (navigation.cityId) {
      result = result.filter((s) => s.canonicalCityId === navigation.cityId)
    }
    return result
  }, [spots, navigation])

  // Final filtered spots (navigation + status/category filters)
  const filteredSpots = useMemo(() => {
    return applySpotFilters(navigationFilteredSpots, spotFilter)
  }, [navigationFilteredSpots, spotFilter])

  // Location-based discovery callback
  const handleDiscovery = useCallback((result: DiscoveryResult) => {
    // Don't override if user has already manually navigated
    if (hasUserNavigatedRef.current) return

    setView(result.view)
    setNavigation(result.navigation)
    setDidInitNavigation(true)

    if (result.toastMessage) {
      toast(result.toastMessage, {
        duration: 6000,
        action: {
          label: "Add one",
          onClick: () => setIsAddDialogOpen(true),
        },
      })
    }
  }, [])

  // Location-based discovery hook
  useLocationDiscovery({
    spots,
    currentLocation: profile?.currentLocation ?? null,
    homeAwayStatus,
    spotsLoaded: !loading && !authLoading,
    onDiscover: handleDiscovery,
  })

  // Push notification permission flow
  const {
    shouldShowDialog: shouldShowPushDialog,
    onMapExploreView,
    onAccept: onPushAccept,
    onDecline: onPushDecline,
  } = usePushNotificationFlow({
    userId,
    pushPermission: profile?.pushPermission ?? "default",
    pushAsked: profile?.pushAsked ?? false,
    spotsCount: spots.length,
  })

  // View change handler with persistence
  const handleViewChange = useCallback((newView: "list" | "map" | "explore") => {
    hasUserNavigatedRef.current = true
    setView(newView)
    saveLastView(newView)
    // Track map/explore view for push notification eligibility
    if (newView === "map" || newView === "explore") {
      onMapExploreView()
    }
  }, [onMapExploreView])

  // Navigation change handler
  const handleNavigationChange = useCallback((nav: NavigationState) => {
    hasUserNavigatedRef.current = true
    setDidInitNavigation(true)
    setNavigation(nav)
  }, [])

  // Home suggestions navigation handler
  const handleSuggestionNavigate = useCallback(
    (newView: ViewType, filter: SpotFilterState, nav: NavigationState) => {
      hasUserNavigatedRef.current = true
      setView(newView)
      setSpotFilter(filter)
      setNavigation(nav)
      setDidInitNavigation(true)
      saveLastView(newView)
    },
    []
  )

  // Home city suggestions
  const { suggestion, handleAction, handleDismiss } = useHomeSuggestions({
    homeAwayStatus,
    currentLocation: profile?.currentLocation ?? null,
    spots,
    onNavigate: handleSuggestionNavigate,
  })

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

        {/* Home Suggestion Banner */}
        {suggestion && (
          <HomeSuggestionBanner
            suggestion={suggestion}
            onAction={handleAction}
            onDismiss={handleDismiss}
          />
        )}

        {/* Controls */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <SpotFilter filter={spotFilter} onFilterChange={setSpotFilter} spots={navigationFilteredSpots} />
          <ViewToggle view={view} onViewChange={handleViewChange} />
        </div>

        {/* Content */}
        {spots.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No spots added yet. Click "Add Spot" to get started.</p>
          </div>
        ) : view === "list" ? (
          <ListView
            spots={filteredSpots}
            onDeleteSpot={handleDeleteSpot}
            onToggleVisited={handleToggleVisited}
            navigation={navigation}
            onNavigationChange={handleNavigationChange}
            onSpotClick={handleSpotClick}
            mode="browse"
          />
        ) : view === "explore" ? (
          <ListView
            spots={filteredSpots}
            onDeleteSpot={handleDeleteSpot}
            onToggleVisited={handleToggleVisited}
            navigation={navigation}
            onNavigationChange={handleNavigationChange}
            onSpotClick={handleSpotClick}
            mode="all"
          />
        ) : (
          <MapView spots={filteredSpots} navigation={navigation} onSpotClick={handleSpotClick} />
        )}
      </div>

      <AddSpotDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onAddSpot={handleAddSpot} />
      <SpotDetailsDialog
        open={isSpotDetailsOpen}
        onOpenChange={(open) => {
          setIsSpotDetailsOpen(open)
          if (!open) setSelectedSpot(null)
        }}
        spot={selectedSpot}
        onSave={handleUpdateSpot}
      />
      <PushPermissionDialog
        open={shouldShowPushDialog}
        onAccept={onPushAccept}
        onDecline={onPushDecline}
      />
    </main>
  )
}
