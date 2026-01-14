"use client"

import { createContext, useContext, useCallback } from "react"
import { useAuth } from "./auth-provider"
import { useLocationResolution, type UseLocationResolutionResult } from "@/hooks/use-location-resolution"
import type { CurrentLocationUpdate } from "@/lib/api/profiles"

type LocationResolutionContextType = UseLocationResolutionResult

const LocationResolutionContext = createContext<LocationResolutionContextType>({
  isResolving: false,
  lastError: null,
  resolvedLocation: null,
})

export function LocationResolutionProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, refreshProfile } = useAuth()

  const handleLocationResolved = useCallback(
    async (location: CurrentLocationUpdate) => {
      // Refresh profile to get updated currentLocation
      await refreshProfile()
    },
    [refreshProfile]
  )

  const result = useLocationResolution({
    userId: user?.id ?? null,
    locationPermission: profile?.locationPermission ?? "unknown",
    currentLocation: profile?.currentLocation ?? null,
    onLocationResolved: handleLocationResolved,
  })

  return (
    <LocationResolutionContext.Provider value={result}>
      {children}
    </LocationResolutionContext.Provider>
  )
}

export const useLocationResolutionContext = () => useContext(LocationResolutionContext)
