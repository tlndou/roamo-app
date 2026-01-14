"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { LocationPermission } from "@/types/profile"

const LOG_PREFIX = "[MapLocationTracking]"

export interface UseMapLocationTrackingOptions {
  /** Whether the map view is currently active/visible */
  isMapActive: boolean
  /** The persisted permission from the user's profile */
  locationPermission: LocationPermission
}

export interface UseMapLocationTrackingResult {
  /** Current coordinates for the user marker */
  coords: { lat: number; lng: number } | null
  /** Accuracy in meters */
  accuracy: number | null
  /** Whether we're actively tracking */
  isTracking: boolean
  /** Last error message */
  lastError: string | null
}

/**
 * Hook for live location tracking on the map view.
 * Uses watchPosition when map is active, stops when map is not visible.
 * This is separate from the general location resolution to avoid battery drain.
 */
export function useMapLocationTracking({
  isMapActive,
  locationPermission,
}: UseMapLocationTrackingOptions): UseMapLocationTrackingResult {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const startTracking = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      console.log(LOG_PREFIX, "Geolocation not available")
      return
    }

    if (watchIdRef.current !== null) {
      console.log(LOG_PREFIX, "Already tracking, skipping start")
      return
    }

    console.log(LOG_PREFIX, "Starting live location tracking for map")
    setIsTracking(true)
    setLastError(null)

    const handleSuccess = (position: GeolocationPosition) => {
      const newCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      setCoords(newCoords)
      setAccuracy(position.coords.accuracy)
    }

    const handleError = (error: GeolocationPositionError) => {
      console.error(LOG_PREFIX, "Watch position error", { code: error.code, message: error.message })
      setLastError(getErrorMessage(error))

      // Don't stop tracking on transient errors
      if (error.code === error.PERMISSION_DENIED) {
        stopTracking()
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true, // Use high accuracy for map marker
      timeout: 30000,
      maximumAge: 10000, // Accept slightly stale data for smoother updates
    })
  }, [])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      console.log(LOG_PREFIX, "Stopping live location tracking")
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      setIsTracking(false)
    }
  }, [])

  // Start/stop tracking based on map visibility and permission
  useEffect(() => {
    const shouldTrack = isMapActive && locationPermission === "granted"

    if (shouldTrack && !watchIdRef.current) {
      startTracking()
    } else if (!shouldTrack && watchIdRef.current) {
      stopTracking()
    }

    // Cleanup on unmount
    return () => {
      stopTracking()
    }
  }, [isMapActive, locationPermission, startTracking, stopTracking])

  // Also pause tracking when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && watchIdRef.current) {
        console.log(LOG_PREFIX, "Tab hidden, pausing tracking")
        stopTracking()
      } else if (
        document.visibilityState === "visible" &&
        isMapActive &&
        locationPermission === "granted" &&
        !watchIdRef.current
      ) {
        console.log(LOG_PREFIX, "Tab visible, resuming tracking")
        startTracking()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [isMapActive, locationPermission, startTracking, stopTracking])

  return {
    coords,
    accuracy,
    isTracking,
    lastError,
  }
}

function getErrorMessage(error: GeolocationPositionError): string {
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
