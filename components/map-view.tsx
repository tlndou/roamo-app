"use client"

import { useMemo } from "react"
import { MapPin } from "lucide-react"
import type { Spot } from "@/types/spot"

interface MapViewProps {
  spots: Spot[]
}

// Approximate coordinates for major cities (in production, use a geocoding API)
const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  paris: { lat: 48.8566, lng: 2.3522 },
  barcelona: { lat: 41.3874, lng: 2.1686 },
  rome: { lat: 41.9028, lng: 12.4964 },
  "new york": { lat: 40.7128, lng: -74.006 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  sydney: { lat: -33.8688, lng: 151.2093 },
}

function getCityCoordinates(city: string): { lat: number; lng: number } {
  return cityCoordinates[city.toLowerCase()] || { lat: 0, lng: 0 }
}

export function MapView({ spots }: MapViewProps) {
  const citySpotCounts = useMemo(() => {
    const counts: Record<string, { count: number; coords: { lat: number; lng: number } }> = {}

    spots.forEach((spot) => {
      const key = `${spot.city}, ${spot.country}`
      if (!counts[key]) {
        counts[key] = {
          count: 0,
          coords: getCityCoordinates(spot.city),
        }
      }
      counts[key].count++
    })

    return counts
  }, [spots])

  // Convert lat/lng to SVG coordinates
  const toSvgCoords = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 1000
    const y = ((90 - lat) / 180) * 500
    return { x, y }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8">
      <div className="mb-6">
        <h3 className="text-lg font-medium">World Map</h3>
        <p className="mt-1 text-sm text-muted-foreground">Density visualization of your saved spots</p>
      </div>

      {/* Simple world map visualization */}
      <div className="relative aspect-[2/1] overflow-hidden rounded-lg bg-muted">
        <svg viewBox="0 0 1000 500" className="h-full w-full" style={{ background: "var(--muted)" }}>
          {/* Simple continents outline (simplified) */}
          <rect x="0" y="0" width="1000" height="500" fill="var(--muted)" />

          {/* Plot spots */}
          {Object.entries(citySpotCounts).map(([city, data]) => {
            const { x, y } = toSvgCoords(data.coords.lat, data.coords.lng)
            const radius = Math.min(30, 8 + data.count * 3)

            return (
              <g key={city}>
                {/* Pulse effect */}
                <circle cx={x} cy={y} r={radius + 10} fill="var(--primary)" opacity="0.1" className="animate-pulse" />
                {/* Main pin */}
                <circle cx={x} cy={y} r={radius} fill="var(--primary)" opacity="0.8" />
                <circle cx={x} cy={y} r={radius * 0.4} fill="var(--background)" />
                {/* Count label */}
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-medium"
                  fill="var(--foreground)"
                  fontSize="10"
                >
                  {data.count}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-6 space-y-3">
        <div className="text-sm font-medium">Locations</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(citySpotCounts).map(([city, data]) => (
            <div key={city} className="flex items-center gap-3 rounded-md bg-muted px-3 py-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div className="flex-1 text-sm">
                <div className="font-medium">{city}</div>
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
