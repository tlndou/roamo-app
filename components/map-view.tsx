"use client"

import { useMemo, useEffect, useRef, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import type { Spot } from "@/types/spot"
import type { LocationPermission } from "@/types/profile"
import { getCountryContinent } from "@/lib/country-utils"
import { useUserLocation } from "@/hooks/use-user-location"
import { useMapLocationTracking } from "@/hooks/use-map-location-tracking"
import { useAuth } from "@/components/providers/auth-provider"
import { updateLocationPermission } from "@/lib/api/profiles"
import { LocationButton } from "@/components/user-location/location-button"
import { LocationPermissionBanner } from "@/components/user-location/location-permission-banner"
import { UserLocationMarker } from "@/components/user-location/user-location-marker"

// Dynamically import Leaflet components with no SSR
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false })
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false })

interface NavigationState {
  level: "continent" | "country" | "city" | "spots"
  continent?: string
  country?: string
  cityId?: string
  cityName?: string
}

interface MapViewProps {
  spots: Spot[]
  navigation?: NavigationState
  onSpotClick?: (spot: Spot) => void
}

// Fix for default marker icons in Leaflet
const createCustomIcon = (count: number) => {
  if (typeof window === "undefined") return undefined
  const L = require("leaflet")
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        width: ${Math.max(32, 24 + count * 2)}px;
        height: ${Math.max(32, 24 + count * 2)}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 3px solid white;
      ">
        ${count}
      </div>
    `,
    iconSize: [Math.max(32, 24 + count * 2), Math.max(32, 24 + count * 2)],
    iconAnchor: [Math.max(16, 12 + count), Math.max(16, 12 + count)],
  })
}

const createSpotIcon = () => {
  if (typeof window === "undefined") return undefined
  const L = require("leaflet")
  return L.divIcon({
    className: "spot-marker",
    html: `
      <div style="
        background: hsl(var(--primary));
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        border: 2px solid white;
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

type Cluster = {
  key: string
  coords: { lat: number; lng: number }
  spots: Spot[]
  label?: string
}

function cityIdOf(spot: Spot): string {
  return spot.canonicalCityId || `${spot.city}|${spot.country}`
}

function cityLabelOf(spot: Spot): string {
  return `${spot.city}, ${spot.country}`
}

function computeCityClusters(spots: Spot[]): Cluster[] {
  const byCity: Record<string, { label: string; spots: Spot[] }> = {}
  for (const s of spots) {
    const id = cityIdOf(s)
    if (!byCity[id]) byCity[id] = { label: cityLabelOf(s), spots: [] }
    byCity[id].spots.push(s)
  }

  // Display-only centroid placement for city comparison markers.
  return Object.entries(byCity).map(([id, v]) => {
    const sum = v.spots.reduce(
      (acc, s) => ({ lat: acc.lat + Number(s.coordinates.lat), lng: acc.lng + Number(s.coordinates.lng) }),
      { lat: 0, lng: 0 },
    )
    const n = v.spots.length || 1
    return {
      key: `city:${id}`,
      coords: { lat: sum.lat / n, lng: sum.lng / n },
      spots: v.spots,
      label: v.label,
    }
  })
}

function computePixelClusters(spots: Spot[], map: any, thresholdPx: number): Cluster[] {
  if (!spots.length) return []
  const L = require("leaflet")
  const zoom = map.getZoom()
  const pts = spots.map((s) => {
    const lat = Number(s.coordinates.lat)
    const lng = Number(s.coordinates.lng)
    const p = map.project(L.latLng(lat, lng), zoom)
    return { spot: s, lat, lng, p }
  })

  const used = new Set<string>()
  const clusters: Cluster[] = []

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    if (used.has(a.spot.id)) continue
    used.add(a.spot.id)

    const members: typeof pts = [a]
    for (let j = i + 1; j < pts.length; j++) {
      const b = pts[j]
      if (used.has(b.spot.id)) continue
      const dx = a.p.x - b.p.x
      const dy = a.p.y - b.p.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= thresholdPx) {
        used.add(b.spot.id)
        members.push(b)
      }
    }

    const center = members.reduce((acc, m) => ({ lat: acc.lat + m.lat, lng: acc.lng + m.lng }), { lat: 0, lng: 0 })
    const n = members.length || 1
    clusters.push({
      key: members.length === 1 ? members[0].spot.id : `cluster:${members.map((m) => m.spot.id).join(",")}`,
      coords: { lat: center.lat / n, lng: center.lng / n },
      spots: members.map((m) => m.spot),
    })
  }

  return clusters
}

function MapBounds({ spots, navigation }: { spots: Spot[]; navigation?: NavigationState }) {
  const { useMap } = require("react-leaflet")
  const map = useMap()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!map || !map.getContainer()) return

    // Leaflet commonly needs a resize invalidation when its container becomes visible (e.g. switching tabs/views).
    // This helps avoid "blank/solid" map tiles until interaction.
    const timeoutId = window.setTimeout(() => {
      try {
        if (map && map.getContainer()) {
          map.invalidateSize()
        }
      } catch {
        // ignore - map may have been unmounted
      }
    }, 100)

    // Delay bounds fitting to ensure map is ready
    const boundsTimeoutId = window.setTimeout(() => {
      try {
        if (!map || !map.getContainer()) return

        if (spots.length > 0) {
          const L = require("leaflet")

          // Filter spots based on navigation
          let filteredSpots = spots
          if (navigation) {
            if (navigation.continent) {
              filteredSpots = spots.filter((s) => (s.continent || getCountryContinent(s.country)) === navigation.continent)
            }
            if (navigation.country) {
              filteredSpots = filteredSpots.filter((s) => s.country === navigation.country)
            }
            if (navigation.cityId) {
              filteredSpots = filteredSpots.filter((s) => cityIdOf(s) === navigation.cityId)
            }
          }

          if (filteredSpots.length > 0) {
            const coords = filteredSpots
              .map((spot: Spot) => [Number(spot.coordinates.lat), Number(spot.coordinates.lng)] as const)
              .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0))
            if (coords.length === 0) return

            const bounds = L.latLngBounds(coords)
            map.fitBounds(bounds, { padding: [50, 50] })
          }
        } else {
          // No spots for the current navigation filter: reset to world view.
          map.setView([20, 0], 2)
        }
      } catch {
        // ignore - map may have been unmounted or not ready
      }
    }, 150)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearTimeout(boundsTimeoutId)
    }
  }, [spots, navigation, map])

  return null
}

function MapCenterOnUser({
  coords,
  shouldCenter,
  onCentered,
}: {
  coords: { lat: number; lng: number } | null
  shouldCenter: boolean
  onCentered: () => void
}) {
  const { useMap } = require("react-leaflet")
  const map = useMap()

  useEffect(() => {
    if (shouldCenter && coords) {
      map.setView([coords.lat, coords.lng], 15, { animate: true })
      onCentered()
    }
  }, [shouldCenter, coords, map, onCentered])

  return null
}

export function MapView({ spots, navigation, onSpotClick }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [shouldCenterOnUser, setShouldCenterOnUser] = useState(false)

  const { user, profile, refreshProfile } = useAuth()

  // Get persisted permission from profile, default to 'unknown'
  const persistedPermission: LocationPermission = profile?.locationPermission ?? "unknown"

  // Handle permission changes by persisting to database
  const handlePermissionChange = useCallback(
    async (newPermission: LocationPermission) => {
      if (!user) return
      try {
        await updateLocationPermission(user.id, newPermission)
        await refreshProfile()
      } catch (error) {
        console.error("Failed to update location permission:", error)
      }
    },
    [user, refreshProfile]
  )

  // Permission handling hook (doesn't actively track position)
  const { permission, browserPermission, isLoading, requestPermission, retryPermission } =
    useUserLocation({
      persistedPermission,
      onPermissionChange: handlePermissionChange,
    })

  // Live location tracking for the map marker (only when map is active)
  const { coords: mapCoords, isTracking } = useMapLocationTracking({
    isMapActive: isMounted,
    locationPermission: permission,
  })

  useEffect(() => {
    // Generate a unique key on mount to avoid Leaflet container reuse issues
    setMapKey(Date.now())
    setIsMounted(true)
    // Check if banner was previously dismissed (only for 'unknown' state)
    if (typeof window !== "undefined") {
      setBannerDismissed(localStorage.getItem("location-banner-dismissed") === "true")
    }
  }, [])

  const visibleSpots = useMemo(() => {
    if (!navigation) return spots
    let filtered = spots
    if (navigation.continent) {
      filtered = filtered.filter((s) => (s.continent || getCountryContinent(s.country)) === navigation.continent)
    }
    if (navigation.country) {
      filtered = filtered.filter((s) => s.country === navigation.country)
    }
    if (navigation.cityId) {
      filtered = filtered.filter((s) => cityIdOf(s) === navigation.cityId)
    }
    return filtered
  }, [spots, navigation])

  const visibleSpotsWithCoords = useMemo(() => {
    return visibleSpots.filter((s) => !(s.coordinates.lat === 0 && s.coordinates.lng === 0))
  }, [visibleSpots])

  const missingCoordsCount = useMemo(() => {
    return visibleSpots.length - visibleSpotsWithCoords.length
  }, [visibleSpots, visibleSpotsWithCoords])

  const mode: "city_compare" | "city_detail" = navigation?.cityId ? "city_detail" : "city_compare"

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true)
    if (typeof window !== "undefined") {
      localStorage.setItem("location-banner-dismissed", "true")
    }
  }, [])

  const handleCenterOnUser = useCallback(() => {
    setShouldCenterOnUser(true)
  }, [])

  const handleCentered = useCallback(() => {
    setShouldCenterOnUser(false)
  }, [])

  if (!isMounted) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex h-[600px] items-center justify-center">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8">
      <div className="mb-6">
        <h3 className="text-lg font-medium">World Map</h3>
        <p className="mt-1 text-sm text-muted-foreground">Interactive map of your saved spots</p>
        {missingCoordsCount > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {missingCoordsCount} {missingCoordsCount === 1 ? "spot is" : "spots are"} missing map coordinates and won't appear on the map until a location is selected.
          </p>
        )}
        {visibleSpotsWithCoords.length === 0 && visibleSpots.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            No mappable spots for this view yet. Add or fix a spot by selecting a location so it has real coordinates.
          </p>
        )}
      </div>

      {/* Location permission banner */}
      {!bannerDismissed && (
        <LocationPermissionBanner
          permission={permission}
          onRequestPermission={requestPermission}
          onDismiss={handleDismissBanner}
        />
      )}

      {/* Interactive Leaflet Map */}
      <div className="relative h-[600px] overflow-hidden rounded-lg">
        {/* Location button overlay */}
        <LocationButton
          permission={permission}
          browserPermission={browserPermission}
          isLoading={isLoading || isTracking}
          hasLocation={!!mapCoords}
          onRequestPermission={requestPermission}
          onRetryPermission={retryPermission}
          onCenterOnUser={handleCenterOnUser}
        />

        <div id={`map-container-${mapKey}`} className="h-full w-full" style={{ background: "hsl(var(--muted))" }}>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            minZoom={2}
            maxZoom={18}
            scrollWheelZoom={true}
            maxBounds={[
              [-90, -180],
              [90, 180],
            ]}
            maxBoundsViscosity={1.0}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBounds spots={spots} navigation={navigation} />
            <MapMarkers mode={mode} spots={visibleSpotsWithCoords} onSpotClick={onSpotClick} />
            {mapCoords && <UserLocationMarker coords={mapCoords} />}
            <MapCenterOnUser
              coords={mapCoords}
              shouldCenter={shouldCenterOnUser}
              onCentered={handleCentered}
            />
          </MapContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 text-sm text-muted-foreground">
        {mode === "city_compare"
          ? "City totals view: one marker per city for easy comparison."
          : "City detail view: each spot is placed at its true coordinates; markers only cluster when overlapping visually."}
      </div>
    </div>
  )
}

function MapMarkers({
  mode,
  spots,
  onSpotClick,
}: {
  mode: "city_compare" | "city_detail"
  spots: Spot[]
  onSpotClick?: (spot: Spot) => void
}) {
  const { useMap } = require("react-leaflet")
  const map = useMap()
  const [mapTick, setMapTick] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!map || !map.getContainer()) return

    const bump = () => setMapTick((t) => t + 1)
    bump()

    try {
      map.on("zoomend", bump)
      map.on("moveend", bump)
    } catch {
      // ignore - map may not be ready
    }

    return () => {
      try {
        map.off("zoomend", bump)
        map.off("moveend", bump)
      } catch {
        // ignore - map may have been unmounted
      }
    }
  }, [map])

  const clusters: Cluster[] = useMemo(() => {
    if (mode === "city_compare") return computeCityClusters(spots)

    // Guard against invalid map state
    if (!map || !map.getContainer()) return computeCityClusters(spots)

    try {
      const z = map.getZoom?.() ?? 0
      const threshold = z >= 14 ? 14 : z >= 11 ? 22 : 30
      return computePixelClusters(spots, map, threshold)
    } catch {
      // Fallback to city clusters if pixel clustering fails
      return computeCityClusters(spots)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, spots, map, mapTick])

  return (
    <>
      {clusters.map((c) => {
        const count = c.spots.length
        const icon = mode === "city_compare" ? createCustomIcon(count) : count > 1 ? createCustomIcon(count) : createSpotIcon()
        const label = c.label || cityLabelOf(c.spots[0])
        return (
          <Marker key={c.key} position={[c.coords.lat, c.coords.lng]} icon={icon}>
            <Popup>
              {mode === "city_compare" ? (
                <div className="min-w-[220px]">
                  <div className="font-medium text-sm leading-tight">{label}</div>
                  <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {count} {count === 1 ? "spot" : "spots"}
                  </div>
                </div>
              ) : count > 1 ? (
                <div className="min-w-[220px]">
                  <h4 className="font-medium">{count} spots here</h4>
                  <div className="mt-2 space-y-1">
                    {c.spots.map((spot) => (
                      <button
                        key={spot.id}
                        type="button"
                        className="block w-full text-left hover:bg-muted/50 rounded px-2 py-1 transition-colors"
                        onClick={() => onSpotClick?.(spot)}
                      >
                        <div className="font-medium text-sm leading-tight">{spot.name}</div>
                        <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                          {spot.category.charAt(0).toUpperCase() + spot.category.slice(1)}
                        </div>
                        <div className="text-xs text-muted-foreground leading-tight">
                          {spot.city}, {spot.country}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="min-w-[220px]">
                  <div className="font-medium text-sm leading-tight">{c.spots[0]?.name}</div>
                  <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {c.spots[0]?.category ? c.spots[0].category.charAt(0).toUpperCase() + c.spots[0].category.slice(1) : ""}
                  </div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    {c.spots[0]?.city}, {c.spots[0]?.country}
                  </div>
                  <button
                    type="button"
                    className="mt-3 text-sm text-primary hover:underline"
                    onClick={() => c.spots[0] && onSpotClick?.(c.spots[0])}
                  >
                    View details
                  </button>
                </div>
              )}
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}
