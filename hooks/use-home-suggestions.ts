"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { Spot } from "@/types/spot"
import type { CurrentLocation, HomeAwayStatus } from "@/types/profile"
import type { SpotFilterState } from "@/components/spot-filter"
import type { NavigationState, ViewType } from "@/hooks/use-location-discovery"
import { getCountryContinent } from "@/lib/country-utils"

const LOG_PREFIX = "[HomeSuggestions]"

export type SuggestionType = "weekend_planning" | "mark_visited"

export interface HomeSuggestion {
  type: SuggestionType
  message: string
  ctaLabel: string
}

export interface UseHomeSuggestionsOptions {
  homeAwayStatus: HomeAwayStatus
  currentLocation: CurrentLocation | null
  spots: Spot[]
  onNavigate: (view: ViewType, filter: SpotFilterState, navigation: NavigationState) => void
}

export interface UseHomeSuggestionsResult {
  suggestion: HomeSuggestion | null
  handleAction: () => void
  handleDismiss: () => void
}

// Rate limits in milliseconds
const RATE_LIMITS: Record<SuggestionType, number> = {
  weekend_planning: 7 * 24 * 60 * 60 * 1000, // 1 week
  mark_visited: 14 * 24 * 60 * 60 * 1000, // 2 weeks
}

// localStorage keys
const getStorageKey = (type: SuggestionType) => `roamo:suggestion:${type}:lastShown`

function canShowSuggestion(type: SuggestionType): boolean {
  if (typeof window === "undefined") return false
  try {
    const key = getStorageKey(type)
    const lastShown = localStorage.getItem(key)
    if (!lastShown) return true
    return Date.now() - parseInt(lastShown, 10) > RATE_LIMITS[type]
  } catch {
    return true
  }
}

function markSuggestionShown(type: SuggestionType): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(getStorageKey(type), Date.now().toString())
  } catch {
    // Ignore storage errors
  }
}

function isWeekendDay(): boolean {
  const day = new Date().getDay()
  // Thu=4, Fri=5, Sat=6
  return day >= 4 && day <= 6
}

function isOlderThan30Days(createdAt: string): boolean {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(createdAt).getTime() > thirtyDaysMs
}

export function useHomeSuggestions({
  homeAwayStatus,
  currentLocation,
  spots,
  onNavigate,
}: UseHomeSuggestionsOptions): UseHomeSuggestionsResult {
  const [activeSuggestion, setActiveSuggestion] = useState<HomeSuggestion | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Get spots in the user's current (home) city
  const homeCitySpots = useMemo(() => {
    if (!currentLocation?.canonicalCityId) return []
    return spots.filter((s) => s.canonicalCityId === currentLocation.canonicalCityId)
  }, [spots, currentLocation])

  const unvisitedHomeCitySpots = useMemo(() => {
    return homeCitySpots.filter((s) => !s.visited)
  }, [homeCitySpots])

  const oldUnvisitedSpots = useMemo(() => {
    return unvisitedHomeCitySpots.filter((s) => isOlderThan30Days(s.createdAt))
  }, [unvisitedHomeCitySpots])

  // Compute which suggestion to show
  const computeSuggestion = useCallback((): HomeSuggestion | null => {
    // Only show when user is at home
    if (homeAwayStatus !== "home") {
      return null
    }

    // Need spots in home city
    if (homeCitySpots.length === 0) {
      return null
    }

    // A. Weekend planning - Thu-Sat with unvisited spots
    if (
      isWeekendDay() &&
      unvisitedHomeCitySpots.length > 0 &&
      canShowSuggestion("weekend_planning")
    ) {
      // console.log(LOG_PREFIX, "Showing weekend_planning suggestion", {
      //   unvisitedCount: unvisitedHomeCitySpots.length,
      //   city: currentLocation?.city,
      // })
      return {
        type: "weekend_planning",
        message: "Need weekend plans? You've got a few saved spots nearby.",
        ctaLabel: "View spots",
      }
    }

    // B. Mark as visited - has old unvisited spots
    if (oldUnvisitedSpots.length > 0 && canShowSuggestion("mark_visited")) {
      // console.log(LOG_PREFIX, "Showing mark_visited suggestion", {
      //   oldUnvisitedCount: oldUnvisitedSpots.length,
      //   city: currentLocation?.city,
      // })
      return {
        type: "mark_visited",
        message: "Did you end up going anywhere you saved?",
        ctaLabel: "Mark visited",
      }
    }

    return null
  }, [homeAwayStatus, homeCitySpots, unvisitedHomeCitySpots, oldUnvisitedSpots, currentLocation])

  // Check for suggestion on mount and visibility change
  useEffect(() => {
    if (dismissed) return

    const suggestion = computeSuggestion()
    if (suggestion) {
      setActiveSuggestion(suggestion)
      markSuggestionShown(suggestion.type)
      // console.log(LOG_PREFIX, "suggestion_shown", { type: suggestion.type, city: currentLocation?.city })
    }
  }, [computeSuggestion, dismissed, currentLocation?.city])

  // Re-check on visibility change (app resume)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !dismissed && !activeSuggestion) {
        const suggestion = computeSuggestion()
        if (suggestion) {
          setActiveSuggestion(suggestion)
          markSuggestionShown(suggestion.type)
          // console.log(LOG_PREFIX, "suggestion_shown (resume)", { type: suggestion.type, city: currentLocation?.city })
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [computeSuggestion, dismissed, activeSuggestion, currentLocation?.city])

  // Handle CTA action
  const handleAction = useCallback(() => {
    if (!activeSuggestion || !currentLocation) return

    // console.log(LOG_PREFIX, "suggestion_clicked", { type: activeSuggestion.type, city: currentLocation.city })

    const cityId = currentLocation.canonicalCityId
    const country = currentLocation.country
    const city = currentLocation.city

    if (activeSuggestion.type === "weekend_planning" && cityId && country && city) {
      // Navigate to List view filtered to city + unvisited
      const continent = getCountryContinent(country)
      onNavigate(
        "list",
        { visited: false, unvisited: true, categories: new Set() },
        { level: "spots", continent, country, cityId, cityName: city }
      )
    } else if (activeSuggestion.type === "mark_visited") {
      // Navigate to List view filtered to unvisited (all cities in home)
      onNavigate(
        "list",
        { visited: false, unvisited: true, categories: new Set() },
        { level: "continent" }
      )
    }

    setActiveSuggestion(null)
  }, [activeSuggestion, currentLocation, onNavigate])

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    if (activeSuggestion) {
      // console.log(LOG_PREFIX, "suggestion_dismissed", { type: activeSuggestion.type, city: currentLocation?.city })
    }
    setDismissed(true)
    setActiveSuggestion(null)
  }, [activeSuggestion, currentLocation?.city])

  return {
    suggestion: activeSuggestion,
    handleAction,
    handleDismiss,
  }
}
