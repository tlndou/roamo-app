/**
 * Browser notification service.
 * Handles showing notifications with rate limiting.
 * MVP implementation using the Notifications API.
 */

import type { NotificationCopy } from "./config"

const LOG_PREFIX = "[NotificationService]"

// localStorage keys
const LAST_NOTIFICATION_KEY = "roamo:lastNotification"
const NOTIFICATION_HISTORY_KEY = "roamo:notificationHistory"

// Rate limit: 1 notification per day
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000

export type NotificationType =
  | "home_weekend_suggestion"
  | "home_revisit_reminder"
  | "away_city_spots"
  | "away_nearby_spots"
  | "away_explore_prompt"

interface NotificationRecord {
  type: NotificationType
  timestamp: number
}

/**
 * Check if notifications are supported and permission is granted.
 */
export function canShowNotifications(): boolean {
  if (typeof window === "undefined") return false
  if (!("Notification" in window)) return false
  return Notification.permission === "granted"
}

/**
 * Check if we're within the rate limit (1 per day).
 */
export function isWithinRateLimit(): boolean {
  if (typeof window === "undefined") return false

  try {
    const lastNotification = localStorage.getItem(LAST_NOTIFICATION_KEY)
    if (!lastNotification) return true

    const lastTime = parseInt(lastNotification, 10)
    return Date.now() - lastTime > RATE_LIMIT_MS
  } catch {
    return true
  }
}

/**
 * Record that a notification was shown.
 */
function recordNotification(type: NotificationType): void {
  if (typeof window === "undefined") return

  try {
    const now = Date.now()
    localStorage.setItem(LAST_NOTIFICATION_KEY, now.toString())

    // Also store in history for analytics/debugging
    const historyStr = localStorage.getItem(NOTIFICATION_HISTORY_KEY)
    const history: NotificationRecord[] = historyStr ? JSON.parse(historyStr) : []

    // Keep last 50 notifications
    history.push({ type, timestamp: now })
    if (history.length > 50) {
      history.shift()
    }

    localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get notification history for debugging.
 */
export function getNotificationHistory(): NotificationRecord[] {
  if (typeof window === "undefined") return []

  try {
    const historyStr = localStorage.getItem(NOTIFICATION_HISTORY_KEY)
    return historyStr ? JSON.parse(historyStr) : []
  } catch {
    return []
  }
}

/**
 * Show a browser notification.
 * Returns true if notification was shown, false otherwise.
 */
export async function showNotification(
  type: NotificationType,
  copy: NotificationCopy,
  options?: {
    /** Skip rate limit check (for testing) */
    skipRateLimit?: boolean
    /** Callback when notification is clicked */
    onClick?: () => void
    /** Icon URL */
    icon?: string
    /** Badge URL (for mobile) */
    badge?: string
  }
): Promise<boolean> {
  // Check if notifications are supported and permitted
  if (!canShowNotifications()) {
    // console.log(LOG_PREFIX, "Cannot show notification - not supported or not permitted")
    return false
  }

  // Check rate limit
  if (!options?.skipRateLimit && !isWithinRateLimit()) {
    // console.log(LOG_PREFIX, "Skipping notification - rate limited (1 per day)")
    return false
  }

  try {
    // console.log(LOG_PREFIX, "Showing notification:", type, copy.title)

    const notification = new Notification(copy.title, {
      body: copy.body,
      icon: options?.icon || "/icon-192.png",
      badge: options?.badge || "/icon-192.png",
      tag: `roamo-${type}`, // Prevents duplicate notifications of same type
      requireInteraction: false,
      silent: false,
    })

    // Handle click
    notification.onclick = () => {
      // console.log(LOG_PREFIX, "Notification clicked:", type)
      window.focus()
      notification.close()
      options?.onClick?.()
    }

    // Record the notification
    recordNotification(type)

    return true
  } catch (error) {
    console.error(LOG_PREFIX, "Failed to show notification:", error)
    return false
  }
}

/**
 * Clear rate limit (for testing).
 */
export function clearRateLimit(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(LAST_NOTIFICATION_KEY)
    // console.log(LOG_PREFIX, "Rate limit cleared")
  } catch {
    // Ignore
  }
}

/**
 * Get time until next notification is allowed.
 * Returns 0 if notification can be shown now.
 */
export function getTimeUntilNextAllowed(): number {
  if (typeof window === "undefined") return 0

  try {
    const lastNotification = localStorage.getItem(LAST_NOTIFICATION_KEY)
    if (!lastNotification) return 0

    const lastTime = parseInt(lastNotification, 10)
    const elapsed = Date.now() - lastTime
    const remaining = RATE_LIMIT_MS - elapsed

    return Math.max(0, remaining)
  } catch {
    return 0
  }
}
