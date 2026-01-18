"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { updateNotificationsEnabled, updatePushPermission } from "@/lib/api/profiles"
import { useAuth } from "@/components/providers/auth-provider"
import { toast } from "sonner"
import type { PushPermission } from "@/types/profile"

const LOG_PREFIX = "[NotificationSettings]"

interface NotificationSettingsProps {
  notificationsEnabled: boolean
  pushPermission: PushPermission
}

function isPushSupported(): boolean {
  if (typeof window === "undefined") return false
  return "Notification" in window && "serviceWorker" in navigator
}

function getBrowserPermission(): PushPermission {
  if (!isPushSupported()) return "unsupported"
  return Notification.permission as PushPermission
}

export function NotificationSettings({
  notificationsEnabled: initialEnabled,
  pushPermission: initialPushPermission,
}: NotificationSettingsProps) {
  const { user, refreshProfile } = useAuth()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pushPermission, setPushPermission] = useState<PushPermission>(initialPushPermission)
  const [isUpdating, setIsUpdating] = useState(false)

  // Sync browser permission on mount
  useEffect(() => {
    const browserPerm = getBrowserPermission()
    if (browserPerm !== pushPermission) {
      setPushPermission(browserPerm)
    }
  }, [])

  // Sync props when they change
  useEffect(() => {
    setEnabled(initialEnabled)
  }, [initialEnabled])

  useEffect(() => {
    setPushPermission(initialPushPermission)
  }, [initialPushPermission])

  const handleToggle = useCallback(async (newEnabled: boolean) => {
    if (!user) return
    if (isUpdating) return

    const browserPerm = getBrowserPermission()

    // Case A: Browser permission is "default" (never asked) and user wants to enable
    if (newEnabled && browserPerm === "default") {
      setIsUpdating(true)
      try {
        console.log(LOG_PREFIX, "Requesting browser permission")
        const result = await Notification.requestPermission()
        const permission = result as PushPermission
        console.log(LOG_PREFIX, "Browser permission result:", permission)

        // Update permission in DB
        await updatePushPermission(user.id, permission, true)
        setPushPermission(permission)

        if (permission === "granted") {
          // Enable notifications
          await updateNotificationsEnabled(user.id, true)
          setEnabled(true)
          toast.success("Notifications enabled")
          console.log(LOG_PREFIX, "User enabled notifications from settings")
        } else {
          // Permission denied
          setEnabled(false)
          toast.info("Notifications not enabled")
          console.log(LOG_PREFIX, "User denied notification permission")
        }

        await refreshProfile()
      } catch (error) {
        console.error(LOG_PREFIX, "Error requesting permission:", error)
        toast.error("Failed to update notification settings")
      } finally {
        setIsUpdating(false)
      }
      return
    }

    // Case B: Browser permission is "denied" and user wants to enable
    if (newEnabled && browserPerm === "denied") {
      // Can't enable - show toast with guidance
      toast.info("Turn on notifications in your device settings to enable them here.", {
        duration: 5000,
      })
      console.log(LOG_PREFIX, "Permission status mismatch - enabled in app but denied on device")
      return
    }

    // Case C: Browser permission is "granted" - just toggle app preference
    setIsUpdating(true)
    try {
      await updateNotificationsEnabled(user.id, newEnabled)
      setEnabled(newEnabled)
      await refreshProfile()

      if (newEnabled) {
        toast.success("Notifications enabled")
        console.log(LOG_PREFIX, "User enabled notifications from settings")
      } else {
        toast.success("Notifications disabled")
        console.log(LOG_PREFIX, "User disabled notifications from settings")
      }
    } catch (error) {
      console.error(LOG_PREFIX, "Error updating notification setting:", error)
      toast.error("Failed to update notification settings")
    } finally {
      setIsUpdating(false)
    }
  }, [user, isUpdating, refreshProfile])

  const isDisabled = pushPermission === "denied" || pushPermission === "unsupported" || isUpdating
  const effectiveEnabled = pushPermission === "denied" || pushPermission === "unsupported" ? false : enabled

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-medium">Notifications</h3>
      </div>

      <div className="space-y-4">
        {/* Push Notifications Toggle */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="push-notifications" className="text-sm font-medium">
              Push notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Get reminders and suggestions based on where you are.
            </p>
            {pushPermission === "denied" && (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                Notifications are disabled in your device settings.
              </p>
            )}
            {pushPermission === "unsupported" && (
              <p className="text-sm text-muted-foreground">
                Notifications are not supported on this device.
              </p>
            )}
          </div>
          <Switch
            id="push-notifications"
            checked={effectiveEnabled}
            onCheckedChange={handleToggle}
            disabled={isDisabled}
          />
        </div>
      </div>
    </div>
  )
}
