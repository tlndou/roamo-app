"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { LocationPermission, CurrentLocation } from "@/types/profile"
import { reverseGeocodeNominatim } from "@/lib/geo/reverse-geocode"
import { canonicalizeCity } from "@/lib/geo/canonical-city"
import { updateCurrentLocation, type CurrentLocationUpdate } from "@/lib/api/profiles"
import { canonicalizeCountryName } from "@/lib/country-utils"

const LOG_PREFIX = "[LocationResolution]"

// Minimum interval between full location checks (20 minutes)
const MIN_CHECK_INTERVAL_MS = 20 * 60 * 1000

// Minimum distance to trigger update even within time interval (~1km)
const MIN_DISTANCE_KM = 1

export type ResolutionReason = "first_run" | "time+distance" | "city_change" | "distance_exceeded" | "time_exceeded"

export interface UseLocationResolutionOptions {
  userId: string | null
  locationPermission: LocationPermission
  currentLocation: CurrentLocation | null
  onLocationResolved?: (location: CurrentLocationUpdate) => void
}

export interface UseLocationResolutionResult {
  isResolving: boolean
  lastError: string | null
  resolvedLocation: CurrentLocationUpdate | null
  lastResolutionReason: ResolutionReason | null
}

/**
 * Calculate approximate distance between two coordinates in kilometers.
 * Uses Haversine formula for accuracy.
 */
function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

export function useLocationResolution({
  userId,
  locationPermission,
  currentLocation,
  onLocationResolved,
}: UseLocationResolutionOptions): UseLocationResolutionResult {
  const [isResolving, setIsResolving] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [resolvedLocation, setResolvedLocation] = useState<CurrentLocationUpdate | null>(null)
  const [lastResolutionReason, setLastResolutionReason] = useState<ResolutionReason | null>(null)
  const isResolvingRef = useRef(false)

  const resolveLocation = useCallback(async () => {
    // Prevent concurrent resolution
    if (isResolvingRef.current) {
      console.log(LOG_PREFIX, "Already resolving, skipping")
      return
    }

    // Gate: must have userId and granted permission
    if (!userId) {
      console.log(LOG_PREFIX, "No userId, skipping resolution")
      return
    }

    if (locationPermission !== "granted") {
      console.log(LOG_PREFIX, `Permission is '${locationPermission}', skipping resolution`)
      return
    }

    // Check browser support
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      console.log(LOG_PREFIX, "Geolocation not available")
      return
    }

    // Step 1: Get current position (quick check with cached allowed)
    let position: GeolocationPosition
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 120000, // Accept cached position up to 2 minutes
        })
      })
    } catch (error) {
      const geoError = error as GeolocationPositionError
      const errorMessage = geoError?.code
        ? getGeolocationErrorMessage(geoError)
        : "Position unavailable"
      console.error(LOG_PREFIX, "Position check failed:", errorMessage)
      setLastError(errorMessage)
      return
    }

    const { latitude: lat, longitude: lng } = position.coords
    const lastCoords = currentLocation?.coordinates
    const hasLastLocation = currentLocation?.updatedAt && lastCoords

    // Determine resolution reason
    let reason: ResolutionReason
    let shouldResolve = true

    if (!hasLastLocation) {
      // First run - no previous data
      reason = "first_run"
      console.log(LOG_PREFIX, "Resolving", { reason, lat, lng })
    } else {
      const lastUpdate = new Date(currentLocation.updatedAt!).getTime()
      const now = Date.now()
      const timeSinceUpdate = now - lastUpdate
      const distance = calculateDistanceKm(lastCoords.lat, lastCoords.lng, lat, lng)
      const timeExceeded = timeSinceUpdate >= MIN_CHECK_INTERVAL_MS
      const distanceExceeded = distance >= MIN_DISTANCE_KM

      console.log(LOG_PREFIX, "Checking thresholds", {
        timeSinceUpdate: `${Math.round(timeSinceUpdate / 60000)} min`,
        distance: `${distance.toFixed(2)} km`,
        timeExceeded,
        distanceExceeded,
      })

      if (timeExceeded) {
        reason = "time_exceeded"
        console.log(LOG_PREFIX, "Resolving", { reason, timeSinceUpdate: `${Math.round(timeSinceUpdate / 60000)} min` })
      } else if (distanceExceeded) {
        reason = "distance_exceeded"
        console.log(LOG_PREFIX, "Resolving", { reason, distance: `${distance.toFixed(2)} km` })
      } else {
        // Within time+distance thresholds - do quick reverse geocode to check city/country
        console.log(LOG_PREFIX, "Within thresholds, checking for city/country change...")

        try {
          const quickGeocode = await reverseGeocodeNominatim(lat, lng, { zoom: 10 })
          const newCity = quickGeocode.canonicalCity || null
          const newCountry = quickGeocode.country ? canonicalizeCountryName(quickGeocode.country) : null

          const cityChanged = currentLocation.city !== newCity
          const countryChanged = currentLocation.country !== newCountry

          if (cityChanged || countryChanged) {
            reason = "city_change"
            console.log(LOG_PREFIX, "Resolving", {
              reason,
              oldCity: currentLocation.city,
              newCity,
              oldCountry: currentLocation.country,
              newCountry,
            })
          } else {
            reason = "time+distance"
            shouldResolve = false
            console.log(LOG_PREFIX, "Skipping", {
              reason,
              message: "Within time+distance thresholds and city/country unchanged",
            })
          }
        } catch (geocodeError) {
          // If geocode fails, skip to avoid unnecessary updates
          console.log(LOG_PREFIX, "Quick geocode failed, skipping", { error: geocodeError })
          return
        }
      }
    }

    if (!shouldResolve) {
      return
    }

    // Full resolution
    console.log(LOG_PREFIX, "Starting full location resolution...", { reason })
    isResolvingRef.current = true
    setIsResolving(true)
    setLastError(null)

    try {
      // Get fresh position for final update
      const freshPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 0, // Force fresh position
        })
      })

      const freshLat = freshPosition.coords.latitude
      const freshLng = freshPosition.coords.longitude

      // Reverse geocode
      const geocodeResult = await reverseGeocodeNominatim(freshLat, freshLng, { zoom: 10 })

      const city = geocodeResult.canonicalCity || null
      const country = geocodeResult.country ? canonicalizeCountryName(geocodeResult.country) : null

      // Compute canonical city ID for deterministic comparisons
      const canonicalCityId =
        city && country ? canonicalizeCity({ city, country }).canonicalCityId : null

      console.log(LOG_PREFIX, "Reverse geocode result", {
        city,
        country,
        canonicalCityId,
        raw: geocodeResult.raw?.display_name,
      })

      const locationUpdate: CurrentLocationUpdate = {
        city,
        canonicalCityId,
        country,
        lat: freshLat,
        lng: freshLng,
      }

      // Update database
      await updateCurrentLocation(userId, locationUpdate)

      setResolvedLocation(locationUpdate)
      setLastResolutionReason(reason)

      console.log(LOG_PREFIX, "Location resolution complete", {
        reason,
        city,
        country,
        previousCity: currentLocation?.city,
        cityChanged: currentLocation?.city !== city,
      })

      onLocationResolved?.(locationUpdate)
    } catch (error) {
      let errorMessage: string
      if (error instanceof GeolocationPositionError) {
        errorMessage = getGeolocationErrorMessage(error)
      } else if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === "object" && error !== null && "message" in error) {
        errorMessage = String((error as { message: unknown }).message)
      } else {
        errorMessage = String(error) || "Unknown error"
      }

      console.error(LOG_PREFIX, "Location resolution failed:", errorMessage)
      setLastError(errorMessage)
    } finally {
      isResolvingRef.current = false
      setIsResolving(false)
    }
  }, [userId, locationPermission, currentLocation, onLocationResolved])

  // Run on mount and when visibility changes (app resume)
  useEffect(() => {
    // Initial resolution on mount
    resolveLocation()

    // Listen for visibility changes (app coming to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log(LOG_PREFIX, "App resumed (visibility change)")
        resolveLocation()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [resolveLocation])

  return {
    isResolving,
    lastError,
    resolvedLocation,
    lastResolutionReason,
  }
}

function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied"
    case error.POSITION_UNAVAILABLE:
      return "Location unavailable"
    case error.TIMEOUT:
      return "Location request timed out"
    default:
      return error.message || "Geolocation error"
  }
}
