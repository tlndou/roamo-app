"use client"

import { useEffect, useRef, useState } from "react"
import { Upload, Image as ImageIcon, ExternalLink } from "lucide-react"
import type { Spot, SpotCategory, IconColor } from "@/types/spot"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LocationAutocomplete } from "@/components/location-autocomplete"
import { IconColorPicker } from "@/components/icon-color-picker"
import { StarRating } from "@/components/ui/star-rating"
import { categoryIcons, iconColorBgClasses, iconColorClasses } from "@/lib/category-icons"
import { getCountryContinent } from "@/lib/country-utils"
import { cn } from "@/lib/utils"

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

interface SpotDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  spot: Spot | null
  onSave: (spot: Spot) => Promise<void> | void
}

export function SpotDetailsDialog({ open, onOpenChange, spot, onSave }: SpotDetailsDialogProps) {
  const [locationSearch, setLocationSearch] = useState("")
  const [draft, setDraft] = useState<Spot | null>(spot)
  const [saving, setSaving] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(spot)
    if (!spot) {
      setLocationSearch("")
      return
    }
    const parts = [spot.address, spot.city, spot.country].filter(Boolean)
    setLocationSearch(parts.join(", "))
  }, [spot])

  if (!draft) return null

  const hasValidLocation =
    draft.city.trim().length > 0 &&
    draft.country.trim().length > 0 &&
    Number.isFinite(draft.coordinates.lat) &&
    Number.isFinite(draft.coordinates.lng) &&
    !(draft.coordinates.lat === 0 && draft.coordinates.lng === 0)

  const handleSave = async () => {
    if (!hasValidLocation) return
    setSaving(true)
    try {
      await onSave(draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Spot</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as SpotCategory })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={draft.visited ? "visited" : "to-visit"}
                onValueChange={(v) => {
                  const isVisited = v === "visited"
                  setDraft({
                    ...draft,
                    visited: isVisited,
                    // Clear rating if changing to "To visit"
                    rating: isVisited ? draft.rating : undefined
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to-visit">To visit</SelectItem>
                  <SelectItem value="visited">Visited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {draft.visited && (
            <div className="space-y-2">
              <Label>Rating</Label>
              <StarRating
                value={draft.rating ?? 0}
                onChange={(value) => setDraft({ ...draft, rating: value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <LocationAutocomplete
              value={locationSearch}
              onChange={setLocationSearch}
              onLocationSelect={(location) => {
                const continent = getCountryContinent(location.country)
                setDraft({
                  ...draft,
                  city: location.city,
                  country: location.country,
                  continent,
                  address: location.address ?? draft.address,
                  coordinates: location.coordinates,
                })
              }}
              placeholder="Search for a city or address..."
              required
            />
            {draft.city && draft.country && (
              <p className="text-xs text-muted-foreground">
                Selected: {draft.city}, {draft.country} ({draft.continent})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              value={draft.comments ?? ""}
              onChange={(e) => setDraft({ ...draft, comments: e.target.value })}
              rows={4}
              placeholder="Add comments..."
            />
          </div>

          <div className="space-y-2">
            <Label>Website/Link</Label>
            <div className="flex gap-2">
              <Input
                value={draft.link ?? ""}
                onChange={(e) => setDraft({ ...draft, link: e.target.value })}
                placeholder="https://..."
              />
              {draft.link && (
                <Button type="button" variant="outline" size="icon" asChild>
                  <a href={draft.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Label>Icon or Image</Label>

            <div className="flex gap-2 rounded-lg border border-border p-1">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, useCustomImage: false })}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  !draft.useCustomImage
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Category Icon
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, useCustomImage: true })}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  draft.useCustomImage
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Custom Image
              </button>
            </div>

            {!draft.useCustomImage && (
              <div className="space-y-3">
                <IconColorPicker value={draft.iconColor} onChange={(color) => setDraft({ ...draft, iconColor: color as IconColor })} />
                <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                  <div
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-lg",
                      iconColorBgClasses[draft.iconColor]
                    )}
                  >
                    {(() => {
                      const Icon = categoryIcons[draft.category]
                      return <Icon className={cn("h-8 w-8", iconColorClasses[draft.iconColor])} />
                    })()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Preview</div>
                    <div className="text-xs text-muted-foreground">
                      {draft.category.charAt(0).toUpperCase() + draft.category.slice(1)} icon
                    </div>
                  </div>
                </div>
              </div>
            )}

            {draft.useCustomImage && (
              <div className="space-y-3">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onloadend = () => {
                      setDraft({ ...draft, customImage: reader.result as string, useCustomImage: true })
                    }
                    reader.readAsDataURL(file)
                  }}
                />
                <Button type="button" variant="outline" className="w-full" onClick={() => imageInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Image
                </Button>

                {draft.customImage ? (
                  <div className="relative overflow-hidden rounded-lg border border-border">
                    <img src={draft.customImage} alt="Preview" className="h-40 w-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute right-2 top-2"
                      onClick={() => setDraft({ ...draft, customImage: undefined })}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50">
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-xs text-muted-foreground">No image selected</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={handleSave} disabled={!hasValidLocation || saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


