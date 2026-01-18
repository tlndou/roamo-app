"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { PushPermission } from "@/types/profile"
import { updatePushPermission } from "@/lib/api/profiles"

const LOG_PREFIX = "[PushNotification]"

// localStorage key for tracking if user has viewed map/explore
const MAP_EXPLORE_VIEWED_KEY = "roamo:mapExploreViewed"

export interface UsePushNotificationFlowOptions {
  userId: string | null
  /** Current push permission from profile */
  pushPermission: PushPermission
  /** Whether user has been asked before (from profile) */
  pushAsked: boolean
  /** Number of spots user has saved */
  spotsCount: number
}

export interface UsePushNotificationFlowResult {
  /** Whether to show the permission dialog */
  shouldShowDialog: boolean
  /** Call when user opens map or explore view */
  onMapExploreView: () => void
  /** Call when user accepts the permission request */
  onAccept: () => Promise<void>
  /** Call when user declines the permission request */
  onDecline: () => Promise<void>
  /** Current permission status */
  permission: PushPermission
}

function hasViewedMapExplore(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(MAP_EXPLORE_VIEWED_KEY) === "true"
  } catch {
    return false
  }
}

function markMapExploreViewed(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(MAP_EXPLORE_VIEWED_KEY, "true")
  } catch {
    // Ignore storage errors
  }
}

function isPushSupported(): boolean {
  if (typeof window === "undefined") return false
  return "Notification" in window && "serviceWorker" in navigator
}

function getBrowserPermission(): PushPermission {
  if (!isPushSupported()) return "unsupported"
  return Notification.permission as PushPermission
}

export function usePushNotificationFlow({
  userId,
  pushPermission,
  pushAsked,
  spotsCount,
}: UsePushNotificationFlowOptions): UsePushNotificationFlowResult {
  const [hasViewedMap, setHasViewedMap] = useState(false)
  const [dialogDismissed, setDialogDismissed] = useState(false)
  const [currentPermission, setCurrentPermission] = useState<PushPermission>(pushPermission)

  // Check localStorage on mount
  useEffect(() => {
    setHasViewedMap(hasViewedMapExplore())
  }, [])

  // Sync permission from profile when it changes
  useEffect(() => {
    setCurrentPermission(pushPermission)
  }, [pushPermission])

  // Track map/explore view
  const onMapExploreView = useCallback(() => {
    if (!hasViewedMap) {
      // console.log(LOG_PREFIX, "User viewed map/explore")
      markMapExploreViewed()
      setHasViewedMap(true)
    }
  }, [hasViewedMap])

  // Determine if we should show the dialog
  const shouldShowDialog = useMemo(() => {
    // Don't show if not supported
    if (!isPushSupported()) {
      return false
    }

    // Don't show if already asked
    if (pushAsked) {
      return false
    }

    // Don't show if user dismissed this session
    if (dialogDismissed) {
      return false
    }

    // Don't show if permission already granted or denied at browser level
    const browserPerm = getBrowserPermission()
    if (browserPerm === "granted" || browserPerm === "denied") {
      return false
    }

    // Check eligibility criteria:
    // 1. User has saved at least one spot
    // 2. User has viewed map or explore view
    const hasSavedSpot = spotsCount > 0
    const hasViewedMapOrExplore = hasViewedMap

    const eligible = hasSavedSpot && hasViewedMapOrExplore

    if (eligible) {
      // console.log(LOG_PREFIX, "User eligible for push permission prompt", {
      //   spotsCount,
      //   hasViewedMap,
      // })
    }

    return eligible
  }, [pushAsked, dialogDismissed, spotsCount, hasViewedMap])

  // Handle accept
  const onAccept = useCallback(async () => {
    if (!userId) return

    // console.log(LOG_PREFIX, "User accepted push permission prompt")

    try {
      // Request browser permission
      const result = await Notification.requestPermission()
      const permission = result as PushPermission

      // console.log(LOG_PREFIX, "Browser permission result:", permission)

      // Update profile
      await updatePushPermission(userId, permission, true)
      setCurrentPermission(permission)
      setDialogDismissed(true)
    } catch (error) {
      console.error(LOG_PREFIX, "Error requesting permission:", error)
      // Still mark as asked to avoid repeated prompts
      await updatePushPermission(userId, "default", true)
      setDialogDismissed(true)
    }
  }, [userId])

  // Handle decline
  const onDecline = useCallback(async () => {
    if (!userId) return

    // console.log(LOG_PREFIX, "User declined push permission prompt")

    try {
      // Mark as asked but don't request browser permission
      await updatePushPermission(userId, "default", true)
      setDialogDismissed(true)
    } catch (error) {
      console.error(LOG_PREFIX, "Error updating permission:", error)
      setDialogDismissed(true)
    }
  }, [userId])

  return {
    shouldShowDialog,
    onMapExploreView,
    onAccept,
    onDecline,
    permission: currentPermission,
  }
}
