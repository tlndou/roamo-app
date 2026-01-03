"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Spot } from "@/types/spot"

interface CategoryFilterProps {
  selectedCategory: string
  onCategoryChange: (category: string) => void
  spots: Spot[]
}

export function CategoryFilter({ selectedCategory, onCategoryChange, spots }: CategoryFilterProps) {
  const categoryCounts = spots.reduce(
    (acc, spot) => {
      acc[spot.category] = (acc[spot.category] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">Filter by:</span>
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[9999]">
          <SelectItem value="all">All Categories ({spots.length})</SelectItem>
          {Object.entries(categoryCounts).map(([category, count]) => (
            <SelectItem key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
