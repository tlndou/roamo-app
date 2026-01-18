"use client"

import { useEffect, useRef, useCallback } from "react"
import type { Spot } from "@/types/spot"
import type { CurrentLocation, HomeAwayStatus, PushPermission } from "@/types/profile"
import {
  getNotificationConfig,
  interpolateCopy,
  type NotificationCopy,
} from "@/lib/notifications/config"
import {
  showNotification,
  canShowNotifications,
  isWithinRateLimit,
  type NotificationType,
} from "@/lib/notifications/notification-service"

const LOG_PREFIX = "[AppNotifications]"

// localStorage key for tracking app opens
const LAST_APP_OPEN_KEY = "roamo:lastAppOpen"
const APP_OPEN_RECENCY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface UseAppNotificationsOptions {
  /** User's push permission status from profile */
  pushPermission: PushPermission
  /** Current home/away status */
  homeAwayStatus: HomeAwayStatus
  /** User's current location */
  currentLocation: CurrentLocation | null
  /** User's spots */
  spots: Spot[]
  /** Whether spots have finished loading */
  spotsLoaded: boolean
  /** Callback when notification action is clicked */
  onNotificationAction?: (type: NotificationType) => void
}

/**
 * Check if app has been opened recently.
 */
function hasRecentAppOpen(): boolean {
  if (typeof window === "undefined") return false

  try {
    const lastOpen = localStorage.getItem(LAST_APP_OPEN_KEY)
    if (!lastOpen) return false

    const lastTime = parseInt(lastOpen, 10)
    return Date.now() - lastTime < APP_OPEN_RECENCY_MS
  } catch {
    return false
  }
}

/**
 * Record app open.
 */
function recordAppOpen(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(LAST_APP_OPEN_KEY, Date.now().toString())
  } catch {
    // Ignore
  }
}

/**
 * Check if it's a good time to show notifications (Thu-Sun for weekend, anytime for away).
 */
function isGoodTimeForNotification(homeAwayStatus: HomeAwayStatus): boolean {
  if (homeAwayStatus === "away") {
    // Always a good time when traveling
    return true
  }

  // For home, prefer Thu-Sun (planning time)
  const day = new Date().getDay()
  return day >= 4 || day === 0 // Thu=4, Fri=5, Sat=6, Sun=0
}

/**
 * Hook to handle app notifications based on location and user context.
 * Notifications only fire when:
 * - User has granted push permission
 * - App has been opened recently
 * - Rate limit allows (1 per day)
 */
export function useAppNotifications({
  pushPermission,
  homeAwayStatus,
  currentLocation,
  spots,
  spotsLoaded,
  onNotificationAction,
}: UseAppNotificationsOptions) {
  const hasTriggeredRef = useRef(false)
  const lastStatusRef = useRef<string | null>(null)

  // Record app open on mount
  useEffect(() => {
    recordAppOpen()
  }, [])

  // Main notification logic
  const checkAndTriggerNotification = useCallback(async () => {
    // Skip if already triggered this session
    if (hasTriggeredRef.current) return

    // Skip if permission not granted
    if (pushPermission !== "granted") {
      // console.log(LOG_PREFIX, "Skipping - push permission not granted")
      return
    }

    // Skip if notifications not supported
    if (!canShowNotifications()) {
      // console.log(LOG_PREFIX, "Skipping - notifications not supported")
      return
    }

    // Skip if no recent app opens
    if (!hasRecentAppOpen()) {
      // console.log(LOG_PREFIX, "Skipping - no recent app open")
      return
    }

    // Skip if rate limited
    if (!isWithinRateLimit()) {
      // console.log(LOG_PREFIX, "Skipping - rate limited")
      return
    }

    // Skip if not a good time
    if (!isGoodTimeForNotification(homeAwayStatus)) {
      // console.log(LOG_PREFIX, "Skipping - not optimal timing")
      return
    }

    // Skip if status unknown
    if (homeAwayStatus === "unknown") {
      // console.log(LOG_PREFIX, "Skipping - home/away status unknown")
      return
    }

    // Create status key to detect changes
    const statusKey = `${homeAwayStatus}|${currentLocation?.canonicalCityId || ""}|${currentLocation?.country || ""}`

    // Skip if same status as last check
    if (statusKey === lastStatusRef.current) {
      return
    }
    lastStatusRef.current = statusKey

    // Get notification config
    const config = await getNotificationConfig()

    // Determine which notification to show based on context
    let notificationType: NotificationType | null = null
    let copy: NotificationCopy | null = null
    let variables: Record<string, string | number> = {}

    if (homeAwayStatus === "home") {
      // Home notifications
      const homeCitySpots = currentLocation?.canonicalCityId
        ? spots.filter((s) => s.canonicalCityId === currentLocation.canonicalCityId)
        : []

      const unvisitedHomeSpots = homeCitySpots.filter((s) => !s.visited)

      if (unvisitedHomeSpots.length > 0) {
        // Has unvisited spots at home
        const oldSpots = unvisitedHomeSpots.filter((s) => {
          const age = Date.now() - new Date(s.createdAt).getTime()
          return age > 30 * 24 * 60 * 60 * 1000 // 30 days
        })

        if (oldSpots.length > 0) {
          // Old unvisited spots - revisit reminder
          notificationType = "home_revisit_reminder"
          copy = config.home.revisit_reminder
          variables = { count: oldSpots.length }
        } else {
          // Recent unvisited spots - weekend suggestion
          notificationType = "home_weekend_suggestion"
          copy = config.home.weekend_suggestion
          variables = { count: unvisitedHomeSpots.length }
        }
      }
    } else if (homeAwayStatus === "away") {
      // Away notifications
      const currentCity = currentLocation?.city
      const currentCountry = currentLocation?.country
      const currentCityId = currentLocation?.canonicalCityId

      // Check for spots in current city
      const citySpots = currentCityId
        ? spots.filter((s) => s.canonicalCityId === currentCityId)
        : []

      if (citySpots.length > 0) {
        // Has spots in current city
        notificationType = "away_city_spots"
        copy = config.away.city_spots_available
        variables = {
          city: currentCity || "this city",
          count: citySpots.length,
        }
      } else if (currentCountry) {
        // Check for spots in current country
        const countrySpots = spots.filter((s) => s.country === currentCountry)

        if (countrySpots.length > 0) {
          // Has spots in current country
          notificationType = "away_nearby_spots"
          copy = config.away.nearby_spots
          variables = {
            country: currentCountry,
            count: countrySpots.length,
          }
        } else {
          // No spots in current location
          notificationType = "away_explore_prompt"
          copy = config.away.explore_prompt
          variables = {
            location: currentCity || currentCountry || "this area",
          }
        }
      }
    }

    // Show notification if we have one to show
    if (notificationType && copy) {
      const interpolatedCopy = interpolateCopy(copy, variables)

      // console.log(LOG_PREFIX, "Triggering notification:", notificationType, interpolatedCopy)

      const shown = await showNotification(notificationType, interpolatedCopy, {
        onClick: () => onNotificationAction?.(notificationType!),
      })

      if (shown) {
        hasTriggeredRef.current = true
      }
    }
  }, [pushPermission, homeAwayStatus, currentLocation, spots, onNotificationAction])

  // Trigger check when data is ready
  useEffect(() => {
    if (!spotsLoaded) return

    // Small delay to let other hooks settle
    const timeoutId = setTimeout(() => {
      checkAndTriggerNotification()
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [spotsLoaded, checkAndTriggerNotification])

  // Re-check on visibility change (app resume)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recordAppOpen()
        // Reset trigger flag on app resume to allow new notification
        // (rate limit will still apply)
        hasTriggeredRef.current = false
        checkAndTriggerNotification()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [checkAndTriggerNotification])
}
