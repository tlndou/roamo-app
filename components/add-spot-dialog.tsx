"use client"

import { useState } from "react"
import { LinkIcon } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ManualSpotForm } from "@/components/manual-spot-form"
import { QuickAddForm } from "@/components/quick-add-form"
import type { Spot } from "@/types/spot"
import { cn } from "@/lib/utils"

interface AddSpotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddSpot: (spot: Spot) => void
}

export function AddSpotDialog({ open, onOpenChange, onAddSpot }: AddSpotDialogProps) {
  const [mode, setMode] = useState<"manual" | "quick">("manual")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">Add New Spot</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Mode Toggle */}
          <div className="relative mb-4 inline-flex w-full rounded-lg border border-border bg-muted/20 p-1">
            {/* Sliding background */}
            <div
              className={cn(
                "absolute inset-y-1 rounded-md bg-white shadow-sm transition-all duration-300 ease-in-out",
                mode === "manual" ? "left-1 right-[50%]" : "left-[50%] right-1"
              )}
            />

            {/* Buttons */}
            <button
              onClick={() => setMode("manual")}
              className={cn(
                "relative z-10 inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-300",
                mode === "manual" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Manual
            </button>
            <button
              onClick={() => setMode("quick")}
              className={cn(
                "relative z-10 inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-300",
                mode === "quick" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              Quick Add
            </button>
          </div>

          {/* Forms */}
          <div>
            {mode === "manual" ? <ManualSpotForm onSubmit={onAddSpot} /> : <QuickAddForm onSubmit={onAddSpot} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
