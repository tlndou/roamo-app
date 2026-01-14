"use client"

import { Crosshair, Loader2, LocateOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { LocationPermission } from "@/types/profile"
import type { BrowserPermissionState } from "@/hooks/use-user-location"

interface LocationButtonProps {
  permission: LocationPermission
  browserPermission: BrowserPermissionState
  isLoading: boolean
  hasLocation: boolean
  onRequestPermission: () => void
  onRetryPermission: () => void
  onCenterOnUser: () => void
}

export function LocationButton({
  permission,
  browserPermission,
  isLoading,
  hasLocation,
  onRequestPermission,
  onRetryPermission,
  onCenterOnUser,
}: LocationButtonProps) {
  // Don't show button if geolocation is unavailable
  if (browserPermission === "unavailable") {
    return null
  }

  const handleClick = () => {
    if (permission === "denied") {
      toast("Location access is blocked", {
        description: "To enable, update your browser's location permissions for this site, then try again.",
        duration: 5000,
        action: {
          label: "Try Again",
          onClick: onRetryPermission,
        },
      })
      return
    }

    if (hasLocation) {
      onCenterOnUser()
    } else {
      onRequestPermission()
    }
  }

  const isDisabled = permission === "denied"

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleClick}
      disabled={isLoading}
      className={`absolute bottom-4 right-4 z-[1000] bg-card shadow-md ${
        isDisabled ? "opacity-50 cursor-not-allowed" : ""
      } ${hasLocation ? "text-blue-500" : ""}`}
      title={
        isDisabled
          ? "Location access denied - click to retry"
          : hasLocation
            ? "Center on my location"
            : "Show my location"
      }
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isDisabled ? (
        <LocateOff className="h-4 w-4" />
      ) : (
        <Crosshair className={`h-4 w-4 ${hasLocation ? "fill-current" : ""}`} />
      )}
    </Button>
  )
}
