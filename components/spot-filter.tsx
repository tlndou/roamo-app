"use client"

import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Spot, SpotCategory } from "@/types/spot"

const ALL_CATEGORIES: SpotCategory[] = [
  "restaurant",
  "cafe",
  "bar",
  "museum",
  "park",
  "attraction",
  "activity",
  "event",
  "club",
  "hotel",
  "shop",
  "other",
]

export interface SpotFilterState {
  visited: boolean
  unvisited: boolean
  categories: Set<SpotCategory>
}

interface SpotFilterProps {
  filter: SpotFilterState
  onFilterChange: (filter: SpotFilterState) => void
  spots: Spot[]
}

export function SpotFilter({ filter, onFilterChange, spots }: SpotFilterProps) {
  const visitedCount = spots.filter((s) => s.visited).length
  const unvisitedCount = spots.filter((s) => !s.visited).length

  const categoryCounts = spots.reduce(
    (acc, spot) => {
      acc[spot.category] = (acc[spot.category] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Count active filters for badge
  const activeFilterCount = getActiveFilterCount(filter)

  const handleVisitedChange = (checked: boolean) => {
    onFilterChange({ ...filter, visited: checked })
  }

  const handleUnvisitedChange = (checked: boolean) => {
    onFilterChange({ ...filter, unvisited: checked })
  }

  const handleCategoryChange = (category: SpotCategory, checked: boolean) => {
    const newCategories = new Set(filter.categories)
    if (checked) {
      newCategories.add(category)
    } else {
      newCategories.delete(category)
    }
    onFilterChange({ ...filter, categories: newCategories })
  }

  const handleSelectAllCategories = () => {
    onFilterChange({ ...filter, categories: new Set(ALL_CATEGORIES) })
  }

  const handleClearAllCategories = () => {
    onFilterChange({ ...filter, categories: new Set() })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={filter.visited} onCheckedChange={handleVisitedChange}>
          Visited ({visitedCount})
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={filter.unvisited} onCheckedChange={handleUnvisitedChange}>
          Unvisited ({unvisitedCount})
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Categories</DropdownMenuLabel>
          <div className="flex gap-1">
            <button
              onClick={handleSelectAllCategories}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              All
            </button>
            <span className="text-xs text-muted-foreground">/</span>
            <button
              onClick={handleClearAllCategories}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              None
            </button>
          </div>
        </div>

        {ALL_CATEGORIES.map((category) => {
          const count = categoryCounts[category] || 0
          if (count === 0) return null
          return (
            <DropdownMenuCheckboxItem
              key={category}
              checked={filter.categories.has(category)}
              onCheckedChange={(checked) => handleCategoryChange(category, checked)}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getActiveFilterCount(filter: SpotFilterState): number {
  let count = 0

  // Status filter active if any selected
  if (filter.visited || filter.unvisited) {
    count++
  }

  // Category filter active if any selected
  if (filter.categories.size > 0) {
    count++
  }

  return count
}

/**
 * Apply filters to spots array.
 * When nothing is selected, show all spots.
 * When something is selected, filter to only show those.
 */
export function applySpotFilters(spots: Spot[], filter: SpotFilterState): Spot[] {
  let result = spots

  // Apply visited filter (if nothing selected, show all)
  const { visited, unvisited } = filter
  const hasStatusFilter = visited || unvisited
  if (hasStatusFilter) {
    result = result.filter((s) => {
      if (visited && s.visited) return true
      if (unvisited && !s.visited) return true
      return false
    })
  }

  // Apply category filter (if nothing selected, show all)
  if (filter.categories.size > 0) {
    result = result.filter((s) => filter.categories.has(s.category))
  }

  return result
}

/**
 * Create default filter state (nothing selected = show all)
 */
export function createDefaultFilter(): SpotFilterState {
  return {
    visited: false,
    unvisited: false,
    categories: new Set(),
  }
}
