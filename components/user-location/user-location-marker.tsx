"use client"

import { useEffect, useState } from "react"

interface UserLocationMarkerProps {
  coords: { lat: number; lng: number }
}

// Create a distinct blue pulsing dot icon for user location
const createUserLocationIcon = () => {
  if (typeof window === "undefined") return undefined
  const L = require("leaflet")
  return L.divIcon({
    className: "user-location-marker",
    html: `
      <div style="
        position: relative;
        width: 20px;
        height: 20px;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
          z-index: 2;
        "></div>
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 20px;
          height: 20px;
          background: rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          animation: user-location-pulse 2s infinite;
          z-index: 1;
        "></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

export function UserLocationMarker({ coords }: UserLocationMarkerProps) {
  const [Marker, setMarker] = useState<any>(null)

  useEffect(() => {
    // Dynamically import Marker to avoid SSR issues
    import("react-leaflet").then((mod) => {
      setMarker(() => mod.Marker)
    })
  }, [])

  if (!Marker) return null

  const icon = createUserLocationIcon()
  if (!icon) return null

  return <Marker position={[coords.lat, coords.lng]} icon={icon} zIndexOffset={1000} />
}
