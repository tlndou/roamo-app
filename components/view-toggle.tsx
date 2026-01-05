"use client"

import { List, Map, Compass } from "lucide-react"
import { cn } from "@/lib/utils"

interface ViewToggleProps {
  view: "list" | "map" | "explore"
  onViewChange: (view: "list" | "map" | "explore") => void
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="relative grid grid-cols-3 rounded-lg border border-border bg-muted/20 p-1">
      {/* Sliding background (1/3 width, translates by segment) */}
      <div
        className={cn(
          // Container has p-1 (0.25rem) padding on each side.
          // Indicator should be exactly 1/3 of the *inner* width: (100% - 0.5rem) / 3.
          "absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-white shadow-sm transition-transform duration-300 ease-in-out",
          view === "explore" ? "translate-x-0" : view === "list" ? "translate-x-[100%]" : "translate-x-[200%]"
        )}
      />

      {/* Buttons */}
      <button
        onClick={() => onViewChange("explore")}
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-300",
          view === "explore" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Compass className="h-4 w-4" />
        Explore
      </button>
      <button
        onClick={() => onViewChange("list")}
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-300",
          view === "list" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="h-4 w-4" />
        List
      </button>
      <button
        onClick={() => onViewChange("map")}
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-300",
          view === "map" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Map className="h-4 w-4" />
        Map
      </button>
    </div>
  )
}
