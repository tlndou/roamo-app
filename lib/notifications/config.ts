/**
 * Notification copy configuration.
 * This can be fetched from a remote server in the future.
 * For MVP, it's stored locally but structured for easy remote replacement.
 */

export interface NotificationCopy {
  title: string
  body: string
  /** Optional action button text */
  action?: string
}

export interface NotificationConfig {
  home: {
    /** Shown when user is at home with unvisited spots */
    weekend_suggestion: NotificationCopy
    /** Shown when user has old unvisited spots */
    revisit_reminder: NotificationCopy
  }
  away: {
    /** Shown when user arrives in a city with saved spots */
    city_spots_available: NotificationCopy
    /** Shown when user is in a country with saved spots (but not current city) */
    nearby_spots: NotificationCopy
    /** Shown when user is somewhere with no saved spots */
    explore_prompt: NotificationCopy
  }
}

/**
 * Default notification copy.
 * In production, this would be fetched from a remote config endpoint.
 */
export const defaultNotificationConfig: NotificationConfig = {
  home: {
    weekend_suggestion: {
      title: "Weekend plans?",
      body: "You've got {count} spots saved nearby. Time to check one off the list?",
      action: "View spots",
    },
    revisit_reminder: {
      title: "Remember these spots?",
      body: "You saved some places a while ago. Did you get a chance to visit?",
      action: "Review spots",
    },
  },
  away: {
    city_spots_available: {
      title: "You're in {city}!",
      body: "You've got {count} spots saved here. Ready to explore?",
      action: "View spots",
    },
    nearby_spots: {
      title: "Spots nearby in {country}",
      body: "You have {count} saved spots in {country}. Worth a detour?",
      action: "See all",
    },
    explore_prompt: {
      title: "Exploring {location}?",
      body: "Save some spots for your trip so you don't forget them.",
      action: "Add spot",
    },
  },
}

/**
 * Interpolate variables in notification copy.
 * Variables are in the format {variableName}.
 */
export function interpolateCopy(
  copy: NotificationCopy,
  variables: Record<string, string | number>
): NotificationCopy {
  const interpolate = (text: string): string => {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key]?.toString() ?? match
    })
  }

  return {
    title: interpolate(copy.title),
    body: interpolate(copy.body),
    action: copy.action ? interpolate(copy.action) : undefined,
  }
}

// Cache for remote config (future use)
let cachedConfig: NotificationConfig | null = null
let configFetchedAt: number | null = null
const CONFIG_CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Get notification config.
 * Currently returns default config, but structured for future remote fetching.
 */
export async function getNotificationConfig(): Promise<NotificationConfig> {
  // Check cache
  if (cachedConfig && configFetchedAt && Date.now() - configFetchedAt < CONFIG_CACHE_TTL) {
    return cachedConfig
  }

  // Future: fetch from remote endpoint
  // try {
  //   const res = await fetch('/api/config/notifications')
  //   if (res.ok) {
  //     cachedConfig = await res.json()
  //     configFetchedAt = Date.now()
  //     return cachedConfig
  //   }
  // } catch {
  //   // Fall through to default
  // }

  // Return default config
  cachedConfig = defaultNotificationConfig
  configFetchedAt = Date.now()
  return defaultNotificationConfig
}
