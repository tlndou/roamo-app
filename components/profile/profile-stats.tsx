import { PartyPopper, Users } from "lucide-react"
import Link from "next/link"
import type { ProfileStats } from "@/lib/api/profile-stats"

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  iconColor: string
  href?: string
}

function StatCard({ icon, label, value, iconColor, href }: StatCardProps) {
  const content = (
    <>
      <div className={`mb-2 ${iconColor}`}>{icon}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="block rounded-lg border border-border bg-card p-6 transition-colors hover:bg-accent/50">
        {content}
      </Link>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {content}
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
        href="/"
      />
      <StatCard
        icon={<Users className="h-5 w-5" />}
        label="Spots Visited"
        value={stats.spotsVisited}
        iconColor="text-blue-500"
        href="/visited"
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
