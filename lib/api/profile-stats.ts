import { createClient } from "@/lib/supabase/client"

export interface ProfileStats {
  spotsSaved: number
  spotsVisited: number
  friends: number
}

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const supabase = createClient()

  // Get total spots count
  const { count: totalSpots } = await supabase
    .from("spots")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  // Get visited spots count
  const { count: visitedSpots } = await supabase
    .from("spots")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("visited", true)

  return {
    spotsSaved: totalSpots || 0,
    spotsVisited: visitedSpots || 0,
    friends: 0, // TODO: Implement friends feature
  }
}
