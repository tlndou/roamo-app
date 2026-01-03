"use client"

import { List, Map } from "lucide-react"
import { cn } from "@/lib/utils"

interface ViewToggleProps {
  view: "list" | "map"
  onViewChange: (view: "list" | "map") => void
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="relative inline-flex rounded-lg border border-border bg-muted/20 p-1">
      {/* Sliding background */}
      <div
        className={cn(
          "absolute inset-y-1 rounded-md bg-white shadow-sm transition-all duration-300 ease-in-out",
          view === "list" ? "left-1 right-[50%]" : "left-[50%] right-1"
        )}
      />

      {/* Buttons */}
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
