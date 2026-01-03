"use client"

import { useMemo, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { MapPin } from "lucide-react"
import type { Spot } from "@/types/spot"

// Dynamically import Leaflet components with no SSR
const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false })
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false })

interface MapViewProps {
  spots: Spot[]
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

function MapBounds({ spots }: { spots: Spot[] }) {
  const { useMap } = require("react-leaflet")
  const map = useMap()

  useEffect(() => {
    if (spots.length > 0 && typeof window !== "undefined") {
      const L = require("leaflet")
      const bounds = L.latLngBounds(spots.map((spot: Spot) => [spot.coordinates.lat, spot.coordinates.lng]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [spots, map])

  return null
}

export function MapView({ spots }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const citySpotCounts = useMemo(() => {
    const counts: Record<
      string,
      { count: number; coords: { lat: number; lng: number }; cityName: string; spots: Spot[] }
    > = {}

    spots.forEach((spot) => {
      const key = `${spot.city}, ${spot.country}`
      if (!counts[key]) {
        counts[key] = {
          count: 0,
          coords: spot.coordinates,
          cityName: key,
          spots: [],
        }
      }
      counts[key].count++
      counts[key].spots.push(spot)
    })

    return counts
  }, [spots])

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
      </div>

      {/* Interactive Leaflet Map */}
      <div className="relative h-[600px] overflow-hidden rounded-lg">
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
          className="h-full w-full"
          style={{ background: "hsl(var(--muted))" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds spots={spots} />
          {Object.entries(citySpotCounts).map(([key, data]) => (
            <Marker
              key={key}
              position={[data.coords.lat, data.coords.lng]}
              icon={createCustomIcon(data.count)}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h4 className="mb-2 font-semibold">{data.cityName}</h4>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {data.count} {data.count === 1 ? "spot" : "spots"}
                  </p>
                  <div className="space-y-1">
                    {data.spots.map((spot) => (
                      <div key={spot.id} className="text-sm">
                        • {spot.name}
                      </div>
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
