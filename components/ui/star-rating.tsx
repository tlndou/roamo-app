"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  max?: number
  size?: "sm" | "md" | "lg"
  disabled?: boolean
}

export function StarRating({ value, onChange, max = 5, size = "md", disabled = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }

  const displayValue = hoverValue !== null ? hoverValue : value

  const handleClick = (starIndex: number, isHalf: boolean) => {
    if (disabled) return
    const newValue = starIndex + (isHalf ? 0.5 : 1)
    onChange(newValue)
  }

  const handleMouseMove = (starIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isHalf = x < rect.width / 2
    setHoverValue(starIndex + (isHalf ? 0.5 : 1))
  }

  const handleMouseLeave = () => {
    setHoverValue(null)
  }

  const getStarFill = (starIndex: number): "full" | "half" | "empty" => {
    const starValue = starIndex + 1
    if (displayValue >= starValue) return "full"
    if (displayValue >= starValue - 0.5) return "half"
    return "empty"
  }

  return (
    <div className="flex items-center gap-1" onMouseLeave={handleMouseLeave}>
      {Array.from({ length: max }, (_, i) => {
        const fill = getStarFill(i)
        return (
          <div
            key={i}
            className={cn(
              "relative cursor-pointer transition-transform hover:scale-110",
              disabled && "cursor-not-allowed opacity-50"
            )}
            onMouseMove={(e) => handleMouseMove(i, e)}
          >
            {/* Left half (for 0.5 rating) */}
            <div
              className="absolute left-0 top-0 h-full w-1/2 z-10"
              onClick={() => handleClick(i, true)}
            />
            {/* Right half (for full rating) */}
            <div
              className="absolute right-0 top-0 h-full w-1/2 z-10"
              onClick={() => handleClick(i, false)}
            />

            {/* Empty star (background) */}
            <Star
              className={cn(
                sizeClasses[size],
                "text-muted-foreground/30 stroke-muted-foreground/30"
              )}
            />

            {/* Filled portion */}
            <div className="absolute inset-0 overflow-hidden" style={{ width: fill === "full" ? "100%" : fill === "half" ? "50%" : "0%" }}>
              <Star
                className={cn(
                  sizeClasses[size],
                  "fill-yellow-400 stroke-yellow-400"
                )}
              />
            </div>
          </div>
        )
      })}
      <span className="ml-2 text-sm text-muted-foreground">
        {displayValue > 0 ? displayValue.toFixed(1) : "No rating"}
      </span>
    </div>
  )
}
