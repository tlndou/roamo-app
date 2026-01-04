import { getZodiacEmoji, type ZodiacSign } from "@/lib/zodiac-utils"

export function StarSignCard({ zodiacSign }: { zodiacSign: string | null }) {
  if (!zodiacSign) return null

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Star Sign</h3>
      <div className="flex items-center gap-3">
        <span className="text-4xl">{getZodiacEmoji(zodiacSign as ZodiacSign)}</span>
        <span className="text-2xl font-semibold">{zodiacSign}</span>
      </div>
    </div>
  )
}
