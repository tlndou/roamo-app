"use client"

import { useEffect, useRef, useCallback } from "react"
import type { Spot } from "@/types/spot"
import type { CurrentLocation, HomeAwayStatus } from "@/types/profile"
import { getCountryContinent } from "@/lib/country-utils"

export interface NavigationState {
  level: "continent" | "country" | "city" | "spots"
  continent?: string
  country?: string
  cityId?: string
  cityName?: string
}

export type ViewType = "list" | "map" | "explore"

export interface DiscoveryResult {
  view: ViewType
  navigation: NavigationState
  reason: "city_match" | "country_match" | "no_match"
  toastMessage?: string
}

export interface UseLocationDiscoveryOptions {
  spots: Spot[]
  currentLocation: CurrentLocation | null
  homeAwayStatus: HomeAwayStatus
  spotsLoaded: boolean
  onDiscover: (result: DiscoveryResult) => void
}

const LAST_VIEW_KEY = "roamo:lastView"

function getLastView(): ViewType {
  if (typeof window === "undefined") return "explore"
  const stored = localStorage.getItem(LAST_VIEW_KEY)
  if (stored === "list" || stored === "map" || stored === "explore") return stored
  return "explore"
}

export function saveLastView(view: ViewType): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LAST_VIEW_KEY, view)
}

export function useLocationDiscovery({
  spots,
  currentLocation,
  homeAwayStatus,
  spotsLoaded,
  onDiscover,
}: UseLocationDiscoveryOptions) {
  const hasAppliedRef = useRef(false)
  const lastLocationKeyRef = useRef<string | null>(null)

  const computeDiscovery = useCallback((): DiscoveryResult | null => {
    // Only apply when user is "away" from home
    if (homeAwayStatus !== "away") return null

    // Need current location info
    if (!currentLocation?.city && !currentLocation?.country) return null

    const currentCityId = currentLocation.canonicalCityId
    const currentCountry = currentLocation.country
    const currentCity = currentLocation.city

    // Check for spots in current city
    if (currentCityId) {
      const citySpots = spots.filter(
        (s) => s.canonicalCityId === currentCityId || (s.city === currentCity && s.country === currentCountry)
      )

      if (citySpots.length > 0) {
        const continent = citySpots[0].continent || getCountryContinent(citySpots[0].country)
        return {
          view: "list",
          navigation: {
            level: "spots",
            continent,
            country: currentCountry!,
            cityId: currentCityId,
            cityName: currentCity!,
          },
          reason: "city_match",
        }
      }
    }

    // Check for spots in current country
    if (currentCountry) {
      const countrySpots = spots.filter((s) => s.country === currentCountry)

      if (countrySpots.length > 0) {
        const continent = countrySpots[0].continent || getCountryContinent(countrySpots[0].country)
        return {
          view: "explore",
          navigation: {
            level: "city",
            continent,
            country: currentCountry,
          },
          reason: "country_match",
        }
      }
    }

    // No spots in city or country - show last view with toast
    const locationName = currentCity || currentCountry || "your location"
    return {
      view: getLastView(),
      navigation: { level: "continent" },
      reason: "no_match",
      toastMessage: `No spots saved for ${locationName} yet — want to add one?`,
    }
  }, [spots, currentLocation, homeAwayStatus])

  useEffect(() => {
    if (!spotsLoaded) return

    // Create a key from current location to detect changes
    const locationKey = currentLocation
      ? `${currentLocation.canonicalCityId}|${currentLocation.country}`
      : null

    // Skip if already applied for this location
    if (hasAppliedRef.current && locationKey === lastLocationKeyRef.current) {
      return
    }

    const result = computeDiscovery()
    if (result) {
      hasAppliedRef.current = true
      lastLocationKeyRef.current = locationKey
      onDiscover(result)
    }
  }, [spotsLoaded, currentLocation, computeDiscovery, onDiscover])

  // Allow reset (e.g., when user manually navigates)
  const resetDiscovery = useCallback(() => {
    hasAppliedRef.current = false
  }, [])

  return { resetDiscovery }
}
