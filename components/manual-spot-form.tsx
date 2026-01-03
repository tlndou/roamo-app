"use client"

import type React from "react"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LocationAutocomplete } from "@/components/location-autocomplete"
import type { Spot, SpotCategory } from "@/types/spot"
import { getCountryContinent } from "@/lib/country-utils"

interface ManualSpotFormProps {
  onSubmit: (spot: Spot) => void
}

const categories: { value: SpotCategory; label: string }[] = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "bar", label: "Bar" },
  { value: "museum", label: "Museum" },
  { value: "park", label: "Park" },
  { value: "attraction", label: "Attraction" },
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
    thumbnail: "",
    link: "",
  })

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
    onSubmit({
      id: Date.now().toString(),
      ...formData,
    })
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
          onChange={setLocationSearch}
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

      <div className="space-y-2">
        <Label htmlFor="thumbnail">Photo URL (optional)</Label>
        <Input
          id="thumbnail"
          type="url"
          value={formData.thumbnail}
          onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
          placeholder="https://..."
        />
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

      <Button type="submit" className="w-full" size="lg">
        Add Spot
      </Button>
    </form>
  )
}
