"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { LocationPermission } from "@/types/profile"

export type BrowserPermissionState = "prompt" | "granted" | "denied" | "unavailable"

export interface UseUserLocationOptions {
  /** The persisted permission from the user's profile */
  persistedPermission: LocationPermission
  /** Callback to update the persisted permission in the database */
  onPermissionChange?: (permission: LocationPermission) => void
}

export interface UseUserLocationResult {
  /** The effective permission state (combines persisted + browser state) */
  permission: LocationPermission
  /** Browser's actual permission state */
  browserPermission: BrowserPermissionState
  isLoading: boolean
  /** Request location permission (only works if not denied) */
  requestPermission: () => void
  /** Re-attempt permission after user manually enables in browser settings */
  retryPermission: () => void
}

/**
 * Hook for managing location permission state.
 * Does NOT actively track position - use useMapLocationTracking for that.
 */
export function useUserLocation({
  persistedPermission,
  onPermissionChange,
}: UseUserLocationOptions): UseUserLocationResult {
  const [browserPermission, setBrowserPermission] = useState<BrowserPermissionState>("prompt")
  const [isLoading, setIsLoading] = useState(false)
  const hasAttemptedRef = useRef(false)

  // Check browser permission state without triggering prompt
  useEffect(() => {
    if (typeof window === "undefined") return

    if (!("geolocation" in navigator)) {
      setBrowserPermission("unavailable")
      return
    }

    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setBrowserPermission(result.state as BrowserPermissionState)

          const handleChange = () => {
            const newState = result.state as BrowserPermissionState
            setBrowserPermission(newState)

            // If browser permission was revoked, update persisted state
            if (newState === "denied" && persistedPermission === "granted") {
              onPermissionChange?.("denied")
            }
          }
          result.addEventListener("change", handleChange)

          return () => result.removeEventListener("change", handleChange)
        })
        .catch(() => {
          setBrowserPermission("prompt")
        })
    }
  }, [persistedPermission, onPermissionChange])

  // Sync persisted permission with browser state on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("geolocation" in navigator)) return

    // If persisted says granted but browser says denied, update persisted
    if (persistedPermission === "granted" && browserPermission === "denied") {
      onPermissionChange?.("denied")
    }
  }, [persistedPermission, browserPermission, onPermissionChange])

  // Request permission - only allowed if not already denied
  const requestPermission = useCallback(() => {
    if (typeof window === "undefined") return
    if (!("geolocation" in navigator)) {
      setBrowserPermission("unavailable")
      return
    }

    // Don't request if already denied (persisted or browser)
    if (persistedPermission === "denied") return

    // Only allow one request per session for 'unknown' state
    if (persistedPermission === "unknown" && hasAttemptedRef.current) return
    hasAttemptedRef.current = true

    setIsLoading(true)

    navigator.geolocation.getCurrentPosition(
      () => {
        setBrowserPermission("granted")
        setIsLoading(false)
        // Persist the granted permission
        onPermissionChange?.("granted")
      },
      (error) => {
        setIsLoading(false)
        if (error.code === error.PERMISSION_DENIED) {
          setBrowserPermission("denied")
          // Persist the denied permission
          onPermissionChange?.("denied")
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }, [persistedPermission, onPermissionChange])

  // Retry permission - for when user manually re-enables in browser settings
  const retryPermission = useCallback(() => {
    if (typeof window === "undefined") return
    if (!("geolocation" in navigator)) return

    // Reset the attempt flag to allow a new request
    hasAttemptedRef.current = false

    setIsLoading(true)

    navigator.geolocation.getCurrentPosition(
      () => {
        setBrowserPermission("granted")
        setIsLoading(false)
        // Update persisted permission to granted
        onPermissionChange?.("granted")
      },
      (error) => {
        setIsLoading(false)
        if (error.code === error.PERMISSION_DENIED) {
          setBrowserPermission("denied")
          // Keep as denied
          if (persistedPermission !== "denied") {
            onPermissionChange?.("denied")
          }
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [persistedPermission, onPermissionChange])

  // Compute effective permission state
  const effectivePermission: LocationPermission =
    browserPermission === "unavailable"
      ? "denied"
      : browserPermission === "denied"
        ? "denied"
        : persistedPermission

  return {
    permission: effectivePermission,
    browserPermission,
    isLoading,
    requestPermission,
    retryPermission,
  }
}
