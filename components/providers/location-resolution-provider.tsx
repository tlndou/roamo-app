"use client"

import { createContext, useContext, useCallback, useMemo } from "react"
import { useAuth } from "./auth-provider"
import { useLocationResolution, type UseLocationResolutionResult } from "@/hooks/use-location-resolution"
import { computeHomeAwayStatus } from "@/lib/home-away"
import type { CurrentLocationUpdate } from "@/lib/api/profiles"
import type { HomeAwayStatus } from "@/types/profile"

type LocationResolutionContextType = UseLocationResolutionResult & {
  homeAwayStatus: HomeAwayStatus
}

const LocationResolutionContext = createContext<LocationResolutionContextType>({
  isResolving: false,
  lastError: null,
  resolvedLocation: null,
  lastResolutionReason: null,
  homeAwayStatus: "unknown",
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

  const homeAwayStatus = useMemo(
    () => computeHomeAwayStatus(profile?.baseLocation ?? null, profile?.currentLocation ?? null),
    [profile?.baseLocation, profile?.currentLocation]
  )

  const contextValue = useMemo(
    () => ({ ...result, homeAwayStatus }),
    [result, homeAwayStatus]
  )

  return (
    <LocationResolutionContext.Provider value={contextValue}>
      {children}
    </LocationResolutionContext.Provider>
  )
}

export const useLocationResolutionContext = () => useContext(LocationResolutionContext)
