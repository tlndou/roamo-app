"use client"

import { X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { HomeSuggestion } from "@/hooks/use-home-suggestions"

interface HomeSuggestionBannerProps {
  suggestion: HomeSuggestion
  onAction: () => void
  onDismiss: () => void
}

export function HomeSuggestionBanner({ suggestion, onAction, onDismiss }: HomeSuggestionBannerProps) {
  return (
    <div className="relative z-10 mb-6 rounded-lg border border-border bg-muted/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{suggestion.message}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2 pl-11">
        <Button size="sm" onClick={onAction}>
          {suggestion.ctaLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Maybe later
        </Button>
      </div>
    </div>
  )
}
