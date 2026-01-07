"use client"

import { useState, useEffect, useRef } from "react"
import { MapPin, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface LocationResult {
  display_name: string
  address: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    country?: string
    country_code?: string
  }
  lat: string
  lon: string
}

interface LocationData {
  city: string
  country: string
  address?: string
  coordinates: {
    lat: number
    lng: number
  }
  displayName: string
}

interface LocationAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onLocationSelect: (location: LocationData) => void
  placeholder?: string
  required?: boolean
}

export function LocationAutocomplete({
  value,
  onChange,
  onLocationSelect,
  placeholder = "Search for a city or location...",
  required = false,
}: LocationAutocompleteProps) {
  const [results, setResults] = useState<LocationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    // Only search when the input is focused. This prevents "auto searching" / dropdown
    // flashes when the component mounts with a pre-filled value (e.g. in edit dialogs).
    if (!isFocused) {
      setShowResults(false)
      return
    }

    if (!value || value.length < 3) {
      setResults([])
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(value)}&` +
            `format=json&` +
            `addressdetails=1&` +
            `limit=5`,
          {
            headers: {
              "User-Agent": "TravelSpotsApp/1.0",
            },
          }
        )
        const data: LocationResult[] = await response.json()
        setResults(data)
        setShowResults(true)
      } catch (error) {
        console.error("Geocoding error:", error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [value, isFocused])

  const handleSelect = (result: LocationResult) => {
    const city = result.address.city || result.address.town || result.address.village || ""
    const country = result.address.country || ""

    // Extract street address if available for more precise locations
    const streetParts = [
      result.address.house_number,
      result.address.road,
    ].filter((part): part is string => Boolean(part))
    const streetAddress = streetParts.length > 0 ? streetParts.join(" ") : undefined

    onLocationSelect({
      city,
      country,
      address: streetAddress,
      coordinates: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      },
      displayName: result.display_name,
    })

    onChange(result.display_name)
    setShowResults(false)
    setResults([])
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="pl-9"
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            // If focus is moving to an element inside the results (a button), don't instantly close.
            const next = e.relatedTarget as Node | null
            if (next && wrapperRef.current?.contains(next)) return
            setIsFocused(false)
            setShowResults(false)
          }}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <div className="max-h-[300px] overflow-y-auto p-1">
            {results.map((result, index) => {
              // Split display_name to show primary location and full address
              const displayParts = result.display_name.split(", ")
              const primaryName = displayParts[0] // e.g., "Eiffel Tower"
              const secondaryInfo = displayParts.slice(1, 3).join(", ") // e.g., "Avenue Anatole France, 7th Arrondissement"
              const country = result.address.country

              return (
                <button
                  key={index}
                  type="button"
                  // Select on mousedown so the blur on the input doesn't dismiss the menu before click fires.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(result)
                  }}
                  className={cn(
                    "w-full rounded-sm px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground focus:outline-none"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium truncate">{primaryName}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {secondaryInfo}
                        {secondaryInfo && country && " • "}
                        {country}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showResults && results.length === 0 && !isLoading && value.length >= 3 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-3 text-center text-sm text-muted-foreground shadow-lg">
          No locations found
        </div>
      )}
    </div>
  )
}
