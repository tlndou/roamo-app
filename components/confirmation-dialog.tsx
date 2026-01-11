"use client"

import { useRef, useState } from "react"
import { URLImportResult } from "@/types/url-import"
import { Spot, VisitTimeLabel } from "@/types/spot"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Image as ImageIcon, Upload } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { IconColorPicker } from "@/components/icon-color-picker"
import { categoryIcons, iconColorBgClasses, iconColorClasses } from "@/lib/category-icons"
import { cn } from "@/lib/utils"
import { LocationAutocomplete } from "@/components/location-autocomplete"
import { getCountryContinent } from "@/lib/country-utils"
import { formatOpeningHours } from "@/lib/opening-hours/format"
import { isVisitTimeAllowedToday } from "@/lib/visit-time/availability"

const visitTimeOptions: { value: VisitTimeLabel; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "daytime", label: "Daytime" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "evening", label: "Evening" },
  { value: "late_night", label: "Late night" },
]

interface ConfirmationDialogProps {
  result: URLImportResult
  onConfirm: (draft: Omit<Spot, "id">) => void
  onCancel: () => void
}

export function ConfirmationDialog({
  result,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const [editedDraft, setEditedDraft] = useState(result.draft)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [locationSearch, setLocationSearch] = useState(() => {
    const parts = [result.draft.address, result.draft.city, result.draft.country].filter(Boolean)
    return parts.join(", ")
  })

  const hasValidLocation =
    editedDraft.city !== "Unknown" &&
    editedDraft.country !== "Unknown" &&
    !(editedDraft.coordinates.lat === 0 && editedDraft.coordinates.lng === 0)

  const hasOpeningHours = Boolean(
    (editedDraft.openingHours?.weekdayText && editedDraft.openingHours.weekdayText.length > 0) ||
      (editedDraft.openingHours?.periods && editedDraft.openingHours.periods.length > 0)
  )

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: "bg-green-500",
      medium: "bg-yellow-500",
      low: "bg-red-500",
    }
    return (
      <Badge
        className={`${colors[confidence as keyof typeof colors]} text-white text-xs`}
      >
        {confidence}
      </Badge>
    )
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Spot Details</DialogTitle>
          <DialogDescription>
            Some information could not be extracted reliably. Please verify and
            fill in missing details.
          </DialogDescription>
        </DialogHeader>

        {result.meta.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <div className="space-y-1">
                {result.meta.warnings.map((warning, i) => (
                  <p key={i} className="text-sm text-yellow-800">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Match Manual Add order: Category first */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Category</Label>
              {getConfidenceBadge(result.meta.confidence.category)}
            </div>
            <Select
              value={editedDraft.category}
              onValueChange={(value: any) =>
                setEditedDraft({ ...editedDraft, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="cafe">Cafe</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="museum">Museum</SelectItem>
                <SelectItem value="park">Park</SelectItem>
                <SelectItem value="attraction">Attraction</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="club">Club</SelectItem>
                <SelectItem value="hotel">Hotel</SelectItem>
                <SelectItem value="shop">Shop</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Name</Label>
              {getConfidenceBadge(result.meta.confidence.name)}
            </div>
            <Input
              value={editedDraft.name}
              onChange={(e) =>
                setEditedDraft({ ...editedDraft, name: e.target.value })
              }
            />
          </div>

          {/* Location (same UX as Manual Add) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Location</Label>
              {getConfidenceBadge(result.meta.confidence.coordinates)}
            </div>
            <LocationAutocomplete
              value={locationSearch}
              onChange={setLocationSearch}
              onLocationSelect={(location) => {
                const continent = getCountryContinent(location.country)
                setEditedDraft({
                  ...editedDraft,
                  city: location.city || editedDraft.city,
                  canonicalCityId: location.canonicalCityId,
                  neighborhood: location.neighborhood ?? editedDraft.neighborhood,
                  adminArea: location.adminArea ?? editedDraft.adminArea,
                  country: location.country || editedDraft.country,
                  continent,
                  address: location.address || editedDraft.address,
                  coordinates: location.coordinates,
                })
              }}
              placeholder="Search for a city or address..."
              required
            />
            {editedDraft.city && editedDraft.country && (
              <p className="text-xs text-muted-foreground">
                Selected: {editedDraft.city}, {editedDraft.country} ({editedDraft.continent})
              </p>
            )}
          </div>

          {/* Comments (maps to Spot.comments) */}
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              value={editedDraft.comments || ""}
              onChange={(e) =>
                setEditedDraft({ ...editedDraft, comments: e.target.value })
              }
              placeholder="Add comments..."
              rows={4}
            />
          </div>

          {/* Opening hours (factual) */}
          {hasOpeningHours && (
            <div className="space-y-2">
              <Label>Opening hours</Label>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <ul className="space-y-1">
                  {formatOpeningHours(editedDraft.openingHours).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Suggested visiting time (always visible; constrained by hours when available) */}
          <div className="space-y-2">
            <Label>Suggested time</Label>
            <Select
              value={(editedDraft.recommendedVisitTime as any) || "none"}
              onValueChange={(v) => {
                if (v === "none") {
                  setEditedDraft({
                    ...editedDraft,
                    recommendedVisitTime: undefined,
                    visitTimeSource: undefined,
                    visitTimeConfidence: undefined,
                  })
                  return
                }
                setEditedDraft({
                  ...editedDraft,
                  recommendedVisitTime: v as VisitTimeLabel,
                  visitTimeSource: "user",
                  visitTimeConfidence: "high",
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="No suggestion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No suggestion</SelectItem>
                {visitTimeOptions.map((o) => {
                  const allowed = isVisitTimeAllowedToday(editedDraft.openingHours, o.value)
                  return (
                    <SelectItem key={o.value} value={o.value} disabled={!allowed}>
                      {o.label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Usually best — based on similar places. If opening hours are known, unavailable times are disabled.
            </p>
            {editedDraft.visitTimeSource === "inferred" && (
              <p className="text-xs text-muted-foreground">Suggestion was auto-filled (low confidence).</p>
            )}
          </div>

          <div className="space-y-4">
            <Label>Icon or Image</Label>

            <div className="flex gap-2 rounded-lg border border-border p-1">
              <button
                type="button"
                onClick={() => setEditedDraft({ ...editedDraft, useCustomImage: false })}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  !editedDraft.useCustomImage
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Category Icon
              </button>
              <button
                type="button"
                onClick={() => setEditedDraft({ ...editedDraft, useCustomImage: true })}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  editedDraft.useCustomImage
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Custom Image
              </button>
            </div>

            {!editedDraft.useCustomImage && (
              <div className="space-y-3">
                <IconColorPicker
                  value={editedDraft.iconColor}
                  onChange={(color) => setEditedDraft({ ...editedDraft, iconColor: color })}
                />

                <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                  <div
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-lg",
                      iconColorBgClasses[editedDraft.iconColor]
                    )}
                  >
                    {(() => {
                      const Icon = categoryIcons[editedDraft.category]
                      return <Icon className={cn("h-8 w-8", iconColorClasses[editedDraft.iconColor])} />
                    })()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Preview</div>
                    <div className="text-xs text-muted-foreground">
                      {editedDraft.category.charAt(0).toUpperCase() + editedDraft.category.slice(1)} icon
                    </div>
                  </div>
                </div>
              </div>
            )}

            {editedDraft.useCustomImage && (
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
                      setEditedDraft({
                        ...editedDraft,
                        customImage: reader.result as string,
                        useCustomImage: true,
                      })
                    }
                    reader.readAsDataURL(file)
                  }}
                />

                <Button type="button" variant="outline" className="w-full" onClick={() => imageInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Image
                </Button>

                {editedDraft.customImage ? (
                  <div className="relative overflow-hidden rounded-lg border border-border">
                    <img src={editedDraft.customImage} alt="Preview" className="h-40 w-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute right-2 top-2"
                      onClick={() => setEditedDraft({ ...editedDraft, customImage: undefined })}
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
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(editedDraft)} disabled={!hasValidLocation}>
            Confirm & Add Spot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
