"use client"

import { useMemo } from "react"
import { ChevronRight, ExternalLink, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Spot } from "@/types/spot"
import { getCountryContinent } from "@/lib/country-utils"
import { categoryIcons, iconColorBgClasses, iconColorClasses } from "@/lib/category-icons"
import { cn } from "@/lib/utils"
import { formatTodayHours } from "@/lib/opening-hours/today"

interface NavigationState {
  level: "continent" | "country" | "city" | "spots"
  continent?: string
  country?: string
  cityId?: string
  cityName?: string
}

interface ListViewProps {
  spots: Spot[]
  onDeleteSpot: (id: string) => void
  onToggleVisited: (id: string, visited: boolean) => void
  navigation: NavigationState
  onNavigationChange: (nav: NavigationState) => void
  onSpotClick: (spot: Spot) => void
  mode: "browse" | "all"
}

interface GroupedSpots {
  [continent: string]: {
    [country: string]: {
      [cityId: string]: { name: string; spots: Spot[] }
    }
  }
}

function cityKey(spot: Spot): { id: string; name: string } {
  const id = spot.canonicalCityId || `${spot.city}|${spot.country}`
  return { id, name: spot.city }
}

export function ListView({
  spots,
  onDeleteSpot,
  onToggleVisited,
  navigation,
  onNavigationChange,
  onSpotClick,
  mode,
}: ListViewProps) {

  const groupedSpots = useMemo(() => {
    const grouped: GroupedSpots = {}

    spots.forEach((spot) => {
      // Use the spot's continent field if available, otherwise determine from country
      const continent = spot.continent || getCountryContinent(spot.country)
      if (!grouped[continent]) grouped[continent] = {}
      if (!grouped[continent][spot.country]) grouped[continent][spot.country] = {}
      const c = cityKey(spot)
      if (!grouped[continent][spot.country][c.id]) grouped[continent][spot.country][c.id] = { name: c.name, spots: [] }
      grouped[continent][spot.country][c.id].spots.push(spot)
    })

    return grouped
  }, [spots])

  const breadcrumbs = useMemo(() => {
    const crumbs = [{ label: "Continents", onClick: () => onNavigationChange({ level: "continent" }) }]

    if (navigation.continent) {
      crumbs.push({
        label: navigation.continent,
        onClick: () => onNavigationChange({ level: "country", continent: navigation.continent }),
      })
    }

    if (navigation.country) {
      crumbs.push({
        label: navigation.country,
        onClick: () => onNavigationChange({ level: "city", continent: navigation.continent, country: navigation.country }),
      })
    }

    if (navigation.cityId) {
      crumbs.push({ label: navigation.cityName || "City", onClick: () => {} })
    }

    return crumbs
  }, [navigation, onNavigationChange])

  const BreadcrumbNav = () => (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.label} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          <button
            onClick={crumb.onClick}
            className={index === breadcrumbs.length - 1 ? "text-foreground" : "hover:text-foreground"}
          >
            {crumb.label}
          </button>
        </div>
      ))}
    </nav>
  )

  const filteredByScope = useMemo(() => {
    const continentOf = (s: Spot) => s.continent || getCountryContinent(s.country)
    let out = spots
    if (navigation.continent) out = out.filter((s) => continentOf(s) === navigation.continent)
    if (navigation.country) out = out.filter((s) => s.country === navigation.country)
    if (navigation.cityId) out = out.filter((s) => cityKey(s).id === navigation.cityId)
    return out
  }, [spots, navigation])

  const SpotCards = ({ items }: { items: Spot[] }) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((spot) => (
        <div
          key={spot.id}
          className="group relative flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
          role="button"
          tabIndex={0}
          onClick={() => onSpotClick(spot)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSpotClick(spot)
          }}
        >
          {/* Icon or Image */}
          {spot.useCustomImage && spot.customImage ? (
            <img src={spot.customImage} alt={spot.name} className="h-16 w-16 rounded-md object-cover" />
          ) : (
            <div className={cn("flex h-16 w-16 items-center justify-center rounded-md", iconColorBgClasses[spot.iconColor])}>
              {(() => {
                const Icon = categoryIcons[spot.category]
                return <Icon className={cn("h-7 w-7", iconColorClasses[spot.iconColor])} />
              })()}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium leading-none">{spot.name}</h4>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {spot.category.charAt(0).toUpperCase() + spot.category.slice(1)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {spot.city}, {spot.country}
                </p>
                {(() => {
                  const today = formatTodayHours(spot.openingHours)
                  if (!today) return null
                  const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()]
                  return (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dayShort}: {today}
                    </p>
                  )
                })()}
              </div>

              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {spot.link && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
                    <a href={spot.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteSpot(spot.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Intentionally do not show comments/description in List/Explore cards */}
          </div>

          {/* Visited indicator */}
          {spot.visited && (
            <div className="absolute bottom-2 right-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )

  if (mode === "all") {
    return (
      <div className="space-y-6">
        <BreadcrumbNav />

        {filteredByScope.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No spots in this scope.
          </div>
        ) : (
          <SpotCards items={filteredByScope} />
        )}
      </div>
    )
  }

  if (navigation.level === "continent") {
    const continents = Object.entries(groupedSpots).map(([continent, countries]) => {
      const spotCount = Object.values(countries)
        .flatMap((cities) => Object.values(cities).map((x) => x.spots))
        .flat().length

      return { name: continent, count: spotCount }
    })

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {continents.map(({ name, count }) => (
            <button
              key={name}
              onClick={() => onNavigationChange({ level: "country", continent: name })}
              className="group flex items-center justify-between rounded-lg border border-border bg-card p-6 text-left transition-all hover:border-foreground/20 hover:bg-accent/50"
            >
              <div>
                <h3 className="font-medium">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {count} {count === 1 ? "spot" : "spots"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (navigation.level === "country" && navigation.continent) {
    const countries = Object.entries(groupedSpots[navigation.continent] || {}).map(([country, cities]) => {
      const spotCount = Object.values(cities).reduce((n, x) => n + x.spots.length, 0)
      return { name: country, count: spotCount }
    })

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <BreadcrumbNav />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map(({ name, count }) => (
            <button
              key={name}
              onClick={() => onNavigationChange({ level: "city", continent: navigation.continent, country: name })}
              className="group flex items-center justify-between rounded-lg border border-border bg-card p-6 text-left transition-all hover:border-foreground/20 hover:bg-accent/50"
            >
              <div>
                <h3 className="font-medium">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {count} {count === 1 ? "spot" : "spots"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (navigation.level === "city" && navigation.continent && navigation.country) {
    const cities = Object.entries(groupedSpots[navigation.continent]?.[navigation.country] || {}).map(([cityId, data]) => {
      return { id: cityId, name: data.name, count: data.spots.length }
    })

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <BreadcrumbNav />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map(({ id, name, count }) => (
            <button
              key={id}
              onClick={() =>
                onNavigationChange({
                  level: "spots",
                  continent: navigation.continent,
                  country: navigation.country,
                  cityId: id,
                  cityName: name,
                })
              }
              className="group flex items-center justify-between rounded-lg border border-border bg-card p-6 text-left transition-all hover:border-foreground/20 hover:bg-accent/50"
            >
              <div>
                <h3 className="font-medium">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {count} {count === 1 ? "spot" : "spots"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (navigation.level === "spots" && navigation.continent && navigation.country && navigation.cityId) {
    const citySpots = groupedSpots[navigation.continent]?.[navigation.country]?.[navigation.cityId]?.spots || []

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <BreadcrumbNav />

        <SpotCards items={citySpots} />
      </div>
    )
  }

  return null
}
