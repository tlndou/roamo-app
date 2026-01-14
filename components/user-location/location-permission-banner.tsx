"use client"

import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LocationPermission } from "@/types/profile"

interface LocationPermissionBannerProps {
  permission: LocationPermission
  onRequestPermission: () => void
  onDismiss: () => void
}

export function LocationPermissionBanner({
  permission,
  onRequestPermission,
  onDismiss,
}: LocationPermissionBannerProps) {
  // Only show when permission is unknown (not yet decided)
  if (permission !== "unknown") {
    return null
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
        <MapPin className="h-4 w-4 text-blue-500" />
      </div>
      <p className="flex-1 text-sm text-muted-foreground">
        Enable location to see your position on the map.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDismiss}>
          Maybe Later
        </Button>
        <Button size="sm" onClick={onRequestPermission}>
          Enable Location
        </Button>
      </div>
    </div>
  )
}
