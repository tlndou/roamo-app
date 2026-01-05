"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Upload, Image as ImageIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LocationAutocomplete } from "@/components/location-autocomplete"
import { IconColorPicker } from "@/components/icon-color-picker"
import { categoryIcons, iconColorClasses, iconColorBgClasses } from "@/lib/category-icons"
import type { Spot, SpotCategory, IconColor } from "@/types/spot"
import { getCountryContinent } from "@/lib/country-utils"
import { cn } from "@/lib/utils"

interface ManualSpotFormProps {
  onSubmit: (spot: Spot) => void
}

const MANUAL_DRAFT_KEY = "roamo:addSpot:manualDraft:v1"

const categories: { value: SpotCategory; label: string }[] = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "bar", label: "Bar" },
  { value: "museum", label: "Museum" },
  { value: "park", label: "Park" },
  { value: "attraction", label: "Attraction" },
  { value: "activity", label: "Activity" },
  { value: "event", label: "Event" },
  { value: "club", label: "Club" },
  { value: "hotel", label: "Hotel" },
  { value: "shop", label: "Shop" },
  { value: "other", label: "Other" },
]

export function ManualSpotForm({ onSubmit }: ManualSpotFormProps) {
  const [locationSearch, setLocationSearch] = useState("")
  const [formData, setFormData] = useState({
    category: "restaurant" as SpotCategory,
    name: "",
    city: "",
    country: "",
    continent: "",
    address: "",
    coordinates: { lat: 0, lng: 0 },
    comments: "",
    useCustomImage: false,
    customImage: "",
    iconColor: "grey" as IconColor,
    link: "",
    visited: false,
  })

  const canSubmit =
    formData.name.trim().length > 0 &&
    formData.city.trim().length > 0 &&
    formData.country.trim().length > 0 &&
    Number.isFinite(formData.coordinates.lat) &&
    Number.isFinite(formData.coordinates.lng) &&
    !(formData.coordinates.lat === 0 && formData.coordinates.lng === 0)

  const hydratedRef = useRef(false)

  // Restore draft after tab switch / refresh.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(MANUAL_DRAFT_KEY)
      if (!raw) {
        hydratedRef.current = true
        return
      }
      const parsed = JSON.parse(raw) as { locationSearch?: string; formData?: Partial<typeof formData> }
      if (parsed.locationSearch) setLocationSearch(parsed.locationSearch)
      if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }))
    } catch {
      // ignore
    } finally {
      hydratedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    try {
      window.sessionStorage.setItem(MANUAL_DRAFT_KEY, JSON.stringify({ locationSearch, formData }))
    } catch {
      // ignore
    }
  }, [locationSearch, formData])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData({ ...formData, customImage: reader.result as string, useCustomImage: true })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleLocationSelect = (location: {
    city: string
    country: string
    address?: string
    coordinates: { lat: number; lng: number }
  }) => {
    // Get continent from country
    const continent = getCountryContinent(location.country)

    setFormData({
      ...formData,
      city: location.city,
      country: location.country,
      continent,
      address: location.address || "",
      coordinates: location.coordinates,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      id: Date.now().toString(),
      ...formData,
    })
    try {
      window.sessionStorage.removeItem(MANUAL_DRAFT_KEY)
    } catch {
      // ignore
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value as SpotCategory })}
        >
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Moeder"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <LocationAutocomplete
          value={locationSearch}
          onChange={(value) => {
            // If the user types without selecting a suggestion, keep preventing submit.
            setLocationSearch(value)
            if (formData.city || formData.country) {
              setFormData({
                ...formData,
                city: "",
                country: "",
                continent: "",
                coordinates: { lat: 0, lng: 0 },
              })
            }
          }}
          onLocationSelect={handleLocationSelect}
          placeholder="Search for a city or address..."
          required
        />
        {formData.city && formData.country && (
          <p className="text-xs text-muted-foreground">
            Selected: {formData.city}, {formData.country} ({formData.continent})
          </p>
        )}
      </div>

      {formData.city && (
        <div className="space-y-2">
          <Label htmlFor="address">Street Address (optional)</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="123 Main Street"
          />
          <p className="text-xs text-muted-foreground">
            Add a specific address for more precise map location
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="comments">Comments</Label>
        <Textarea
          id="comments"
          value={formData.comments}
          onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
          placeholder="Order the soup"
          rows={3}
        />
      </div>

      <div className="space-y-4">
        <Label>Icon or Image</Label>

        {/* Toggle between icon and custom image */}
        <div className="flex gap-2 rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, useCustomImage: false })}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              !formData.useCustomImage
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Category Icon
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, useCustomImage: true })}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              formData.useCustomImage
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Custom Image
          </button>
        </div>

        {/* Icon color picker */}
        {!formData.useCustomImage && (
          <div className="space-y-3">
            <IconColorPicker value={formData.iconColor} onChange={(color) => setFormData({ ...formData, iconColor: color })} />

            {/* Icon preview */}
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-lg",
                  iconColorBgClasses[formData.iconColor]
                )}
              >
                {(() => {
                  const Icon = categoryIcons[formData.category]
                  return <Icon className={cn("h-8 w-8", iconColorClasses[formData.iconColor])} />
                })()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Preview</div>
                <div className="text-xs text-muted-foreground">
                  {formData.category.charAt(0).toUpperCase() + formData.category.slice(1)} icon
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image upload */}
        {formData.useCustomImage && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById("image-upload")?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </Button>
            </div>

            {formData.customImage && (
              <div className="relative overflow-hidden rounded-lg border border-border">
                <img src={formData.customImage} alt="Preview" className="h-32 w-full object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute right-2 top-2"
                  onClick={() => setFormData({ ...formData, customImage: "" })}
                >
                  Remove
                </Button>
              </div>
            )}

            {!formData.customImage && (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">No image uploaded</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="link">Website/Link (optional)</Label>
        <Input
          id="link"
          type="url"
          value={formData.link}
          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
        Add Spot
      </Button>
    </form>
  )
}
