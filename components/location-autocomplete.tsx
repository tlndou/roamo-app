"use client"

import { useState, useEffect, useRef } from "react"
import { MapPin, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { reverseGeocodeNominatim } from "@/lib/geo/reverse-geocode"
import { canonicalizeCity } from "@/lib/geo/canonical-city"
import { canonicalizeCountryName } from "@/lib/country-utils"

interface LocationResult {
  display_name: string
  class?: string
  type?: string
  address: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state_district?: string
    state?: string
    region?: string
    suburb?: string
    city_district?: string
    country?: string
    country_code?: string
  }
  lat: string
  lon: string
}

interface LocationData {
  city: string
  canonicalCityId: string
  country: string
  neighborhood?: string
  adminArea?: string
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
  /**
   * - "place": allow selecting specific places/addresses (default; used for spots)
   * - "city": restrict to city/town-level selections (used for base location; no street addresses)
   */
  mode?: "place" | "city"
}

export function LocationAutocomplete({
  value,
  onChange,
  onLocationSelect,
  placeholder = "Search for a city or location...",
  required = false,
  mode = "place",
}: LocationAutocompleteProps) {
  const [results, setResults] = useState<LocationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
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
      setSearchError(null)
      try {
        const cityOnly = mode === "city"
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(value)}&` +
            `format=jsonv2&` +
            `addressdetails=1&` +
            // IMPORTANT: do NOT use `featuretype=city` here. Major cities (e.g. London)
            // are often returned as administrative boundaries, and this filter can make them disappear.
            `limit=${cityOnly ? 8 : 5}`,
          {
            headers: {
              "User-Agent": "TravelSpotsApp/1.0",
            },
          }
        )
        const json = await response.json().catch(() => null)
        const raw: LocationResult[] = Array.isArray(json) ? (json as LocationResult[]) : []

        if (!response.ok) {
          const msg =
            (json && typeof json === "object" && "error" in (json as any) && String((json as any).error)) ||
            `HTTP ${response.status}`
          throw new Error(msg)
        }

        // Post-filter for city-only mode: allow city/town/admin boundary results,
        // but avoid detailed street addresses.
        const data: LocationResult[] = cityOnly
          ? raw.filter((r) => {
              const country = r.address.country || ""
              if (!country) return false

              // Reject street-level results
              if (r.address.road || r.address.house_number) return false

              const cityLike =
                r.address.city ||
                r.address.town ||
                r.address.village ||
                r.address.municipality ||
                r.address.county ||
                r.address.state_district ||
                r.address.region ||
                r.address.state ||
                ""
              return Boolean(cityLike)
            })
          : raw
        // If the user is typing a city-level query (no digits), de-dupe to one canonical metro city per country.
        const isCityQuery = cityOnly ? true : !/\d/.test(value.trim())
        if (!isCityQuery) {
          setResults(data)
        } else {
          const seen = new Set<string>()
          const deduped: LocationResult[] = []
          for (const r of data) {
            const cityLike =
              r.address.city ||
              r.address.town ||
              r.address.village ||
              r.address.municipality ||
              r.address.county ||
              r.address.state_district ||
              r.address.region ||
              r.address.state ||
              ""
            const country = r.address.country || ""
            if (!cityLike || !country) continue
            const canon = canonicalizeCity({ city: cityLike, country: canonicalizeCountryName(country) })
            if (seen.has(canon.canonicalCityId)) continue
            seen.add(canon.canonicalCityId)
            deduped.push(r)
          }
          setResults(deduped.length ? deduped : data)
        }
        setShowResults(true)
      } catch (error) {
        console.error("Geocoding error:", error)
        setResults([])
        setSearchError("Couldn’t load location suggestions. Check your connection and try again.")
        setShowResults(true)
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
    const country = canonicalizeCountryName(result.address.country || "")

    // Extract street address if available for more precise locations (disabled for city-only mode)
    const streetAddress =
      mode === "city"
        ? undefined
        : (() => {
            const streetParts = [result.address.house_number, result.address.road].filter(
              (part): part is string => Boolean(part),
            )
            return streetParts.length > 0 ? streetParts.join(" ") : undefined
          })()

    const coords = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) }

    ;(async () => {
      setIsLoading(true)
      try {
        // Always resolve metro city from coordinates, then canonicalize admin-style names (Greater London -> London).
        const rev = await reverseGeocodeNominatim(coords.lat, coords.lng, { zoom: 8 })
        const metroRaw = rev.canonicalCity || ""
        const metro = canonicalizeCity({ city: metroRaw || value, country }).canonicalCity
        const canon = canonicalizeCity({ city: metro, country })

        const isCityQuery = mode === "city" ? true : !/\d/.test(value.trim())
        const nextValue = isCityQuery ? `${metro}, ${country}` : result.display_name

        // IMPORTANT: call onChange before onLocationSelect so parent handlers that "clear"
        // form state on typing don't wipe the selection we are about to apply.
        onChange(nextValue)
        onLocationSelect({
          city: metro,
          canonicalCityId: canon.canonicalCityId,
          country,
          neighborhood: rev.neighborhood ?? undefined,
          adminArea: rev.adminArea ?? undefined,
          address: streetAddress,
          coordinates: coords,
          displayName: result.display_name,
        })
      } catch {
        // Fallback: use best-effort city-like label, still canonicalized.
        const cityLike =
          result.address.city ||
          result.address.town ||
          result.address.village ||
          result.address.municipality ||
          result.address.county ||
          result.address.state_district ||
          result.address.region ||
          result.address.state ||
          ""
        const metro = canonicalizeCity({ city: cityLike || value, country }).canonicalCity
        const canon = canonicalizeCity({ city: metro, country })
        const nextValue = mode === "city" ? `${metro}, ${country}` : result.display_name
        onChange(nextValue)
        onLocationSelect({
          city: metro,
          canonicalCityId: canon.canonicalCityId,
          country,
          address: streetAddress,
          coordinates: coords,
          displayName: result.display_name,
        })
      } finally {
        setIsLoading(false)
      }
    })()

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
              const isCityQuery = mode === "city" ? true : !/\d/.test(value.trim())
              const cityLike =
                result.address.city ||
                result.address.town ||
                result.address.village ||
                result.address.municipality ||
                result.address.county ||
                result.address.state_district ||
                result.address.region ||
                result.address.state ||
                ""
              // Split display_name to show primary location and full address
              const displayParts = result.display_name.split(", ")
              const normalizedCountry = canonicalizeCountryName(result.address.country || "")
              const primaryName =
                isCityQuery && cityLike && normalizedCountry
                  ? canonicalizeCity({ city: cityLike, country: normalizedCountry }).canonicalCity
                  : displayParts[0] // e.g., "Eiffel Tower"
              const secondaryInfo = displayParts.slice(1, 3).join(", ") // e.g., "Avenue Anatole France, 7th Arrondissement"
              const country = normalizedCountry

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
          {searchError ? searchError : "No locations found"}
        </div>
      )}
    </div>
  )
}
