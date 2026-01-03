"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { IconColor } from "@/types/spot"

interface IconColorPickerProps {
  value: IconColor
  onChange: (color: IconColor) => void
}

const colors: { value: IconColor; label: string; bgClass: string }[] = [
  { value: "grey", label: "Grey", bgClass: "bg-gray-400" },
  { value: "pink", label: "Pink", bgClass: "bg-pink-500" },
  { value: "pink-pastel", label: "Pink Pastel", bgClass: "bg-pink-300" },
  { value: "purple", label: "Purple", bgClass: "bg-purple-500" },
  { value: "purple-pastel", label: "Purple Pastel", bgClass: "bg-purple-300" },
  { value: "blue", label: "Blue", bgClass: "bg-blue-500" },
  { value: "blue-pastel", label: "Blue Pastel", bgClass: "bg-blue-300" },
  { value: "green", label: "Green", bgClass: "bg-green-500" },
  { value: "green-pastel", label: "Green Pastel", bgClass: "bg-green-300" },
  { value: "yellow", label: "Yellow", bgClass: "bg-yellow-500" },
  { value: "yellow-pastel", label: "Yellow Pastel", bgClass: "bg-yellow-300" },
  { value: "orange", label: "Orange", bgClass: "bg-orange-500" },
  { value: "orange-pastel", label: "Orange Pastel", bgClass: "bg-orange-300" },
  { value: "red", label: "Red", bgClass: "bg-red-500" },
  { value: "red-pastel", label: "Red Pastel", bgClass: "bg-red-300" },
]

export function IconColorPicker({ value, onChange }: IconColorPickerProps) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Icon Color</div>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onChange(color.value)}
            className={cn(
              "relative h-7 w-7 rounded-full border-2 transition-all shrink-0",
              color.bgClass,
              value === color.value
                ? "border-foreground ring-2 ring-ring ring-offset-1"
                : "border-border hover:border-foreground/50"
            )}
            title={color.label}
          >
            {value === color.value && (
              <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow-md" />
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Selected: {colors.find((c) => c.value === value)?.label}</p>
    </div>
  )
}
