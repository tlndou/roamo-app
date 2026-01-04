import { PartyPopper, Users } from "lucide-react"
import type { ProfileStats } from "@/lib/api/profile-stats"

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  iconColor: string
}

function StatCard({ icon, label, value, iconColor }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className={`mb-2 ${iconColor}`}>{icon}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  )
}

export function ProfileStats({ stats }: { stats: ProfileStats }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard
        icon={<PartyPopper className="h-5 w-5" />}
        label="Spots Saved"
        value={stats.spotsSaved}
        iconColor="text-purple-500"
      />
      <StatCard
        icon={<Users className="h-5 w-5" />}
        label="Spots Visited"
        value={stats.spotsVisited}
        iconColor="text-blue-500"
      />
      <StatCard
        icon={<Users className="h-5 w-5" />}
        label="Friends"
        value={stats.friends}
        iconColor="text-blue-500"
      />
    </div>
  )
}
