"use client"

import { useMemo, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { MapPin } from "lucide-react"
import type { Spot } from "@/types/spot"
import { getCountryContinent } from "@/lib/country-utils"

// Dynamically import Leaflet components with no SSR
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false })
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false })

interface NavigationState {
  level: "continent" | "country" | "city" | "spots"
  continent?: string
  country?: string
  city?: string
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

function MapBounds({ spots, navigation }: { spots: Spot[]; navigation?: NavigationState }) {
  const { useMap } = require("react-leaflet")
  const map = useMap()

  useEffect(() => {
    if (typeof window === "undefined") return

    // Leaflet commonly needs a resize invalidation when its container becomes visible (e.g. switching tabs/views).
    // This helps avoid "blank/solid" map tiles until interaction.
    const timeoutId = window.setTimeout(() => {
      try {
        map.invalidateSize()
      } catch {
        // ignore
      }
    }, 0)

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
        if (navigation.city) {
          filteredSpots = filteredSpots.filter((s) => s.city === navigation.city)
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

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [spots, navigation, map])

  return null
}

export function MapView({ spots, navigation, onSpotClick }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Leaflet can throw "Map container is being reused by another instance" in dev
  // when this component is mounted/unmounted quickly (e.g. view toggles, React strict mode, HMR).
  // Forcing the MapContainer to remount onto a fresh DOM node avoids reusing an old Leaflet container.
  useEffect(() => {
    if (!isMounted) return
    setMapKey((k) => k + 1)
  }, [isMounted, navigation?.continent, navigation?.country, navigation?.city])

  // Defensive cleanup: in dev/HMR/StrictMode Leaflet can leave a stale map instance on the same container.
  // Explicitly remove the map and clear Leaflet's internal container id to prevent "Map container is being reused".
  useEffect(() => {
    return () => {
      const map = mapRef.current
      if (!map) return
      try {
        map.off?.()
        map.remove?.()
        const container = map.getContainer?.()
        if (container) {
          // Leaflet uses this marker to detect reuse.
          ;(container as any)._leaflet_id = null
        }
      } catch {
        // ignore
      } finally {
        mapRef.current = null
      }
    }
  }, [mapKey])

  const visibleSpots = useMemo(() => {
    if (!navigation) return spots
    let filtered = spots
    if (navigation.continent) {
      filtered = filtered.filter((s) => (s.continent || getCountryContinent(s.country)) === navigation.continent)
    }
    if (navigation.country) {
      filtered = filtered.filter((s) => s.country === navigation.country)
    }
    if (navigation.city) {
      filtered = filtered.filter((s) => s.city === navigation.city)
    }
    return filtered
  }, [spots, navigation])

  const visibleSpotsWithCoords = useMemo(() => {
    return visibleSpots.filter((s) => !(s.coordinates.lat === 0 && s.coordinates.lng === 0))
  }, [visibleSpots])

  const missingCoordsCount = useMemo(() => {
    return visibleSpots.length - visibleSpotsWithCoords.length
  }, [visibleSpots, visibleSpotsWithCoords])

  const citySpotCounts = useMemo(() => {
    const counts: Record<
      string,
      {
        count: number
        coords: { lat: number; lng: number }
        cityName: string
        spots: Spot[]
        categorySummary: string
      }
    > = {}

    visibleSpotsWithCoords.forEach((spot) => {
      const key = `${spot.city}, ${spot.country}`
      if (!counts[key]) {
        counts[key] = {
          count: 0,
          coords: spot.coordinates,
          cityName: key,
          spots: [],
          categorySummary: "",
        }
      }
      counts[key].count++
      counts[key].spots.push(spot)
    })

    // Build a category summary for each city marker
    for (const key of Object.keys(counts)) {
      const byCategory = counts[key].spots.reduce((acc, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const parts = Object.entries(byCategory).map(([cat, n]) => {
        const label = cat.charAt(0).toUpperCase() + cat.slice(1)
        return n === 1 ? label : `${label} (${n})`
      })
      counts[key].categorySummary = parts.join(", ")
    }

    return counts
  }, [visibleSpotsWithCoords])

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
            {missingCoordsCount} {missingCoordsCount === 1 ? "spot is" : "spots are"} missing map coordinates and won’t appear on the map until a location is selected.
          </p>
        )}
        {Object.keys(citySpotCounts).length === 0 && visibleSpots.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            No mappable spots for this view yet. Add or fix a spot by selecting a location so it has real coordinates.
          </p>
        )}
      </div>

      {/* Interactive Leaflet Map */}
      <div className="relative h-[600px] overflow-hidden rounded-lg">
        <MapContainer
          key={mapKey}
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxZoom={18}
          scrollWheelZoom={true}
          whenCreated={(map) => {
            mapRef.current = map
          }}
          maxBounds={[
            [-90, -180],
            [90, 180],
          ]}
          maxBoundsViscosity={1.0}
          className="h-full w-full"
          style={{ background: "hsl(var(--muted))" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds spots={spots} navigation={navigation} />
          {Object.entries(citySpotCounts).map(([key, data]) => (
            <Marker
              key={key}
              position={[data.coords.lat, data.coords.lng]}
              icon={createCustomIcon(data.count)}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h4 className="mb-2 font-semibold">{data.cityName}</h4>
                  <p className="mb-2 text-sm text-muted-foreground">{data.categorySummary}</p>
                  <div className="space-y-1">
                    {data.spots.map((spot) => (
                      <button
                        key={spot.id}
                        type="button"
                        className="block w-full text-left text-sm hover:underline"
                        onClick={() => onSpotClick?.(spot)}
                      >
                        • {spot.name}
                      </button>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="mt-6 space-y-3">
        <div className="text-sm font-medium">Locations</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(citySpotCounts).map(([key, data]) => (
            <div key={key} className="flex items-center gap-3 rounded-md bg-muted px-3 py-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div className="flex-1 text-sm">
                <div className="font-medium">{data.cityName}</div>
                <div className="text-xs text-muted-foreground">
                  {data.count} {data.count === 1 ? "spot" : "spots"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
