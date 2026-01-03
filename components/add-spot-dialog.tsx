"use client"

import { useState } from "react"
import { LinkIcon } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ManualSpotForm } from "@/components/manual-spot-form"
import { QuickAddForm } from "@/components/quick-add-form"
import type { Spot } from "@/types/spot"

interface AddSpotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddSpot: (spot: Spot) => void
}

export function AddSpotDialog({ open, onOpenChange, onAddSpot }: AddSpotDialogProps) {
  const [mode, setMode] = useState<"manual" | "quick">("manual")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">Add New Spot</DialogTitle>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 rounded-lg bg-muted p-1">
          <Button
            variant={mode === "manual" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => setMode("manual")}
          >
            Manual
          </Button>
          <Button
            variant={mode === "quick" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 gap-2"
            onClick={() => setMode("quick")}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Quick Add
          </Button>
        </div>

        {/* Forms */}
        <div className="mt-2">
          {mode === "manual" ? <ManualSpotForm onSubmit={onAddSpot} /> : <QuickAddForm onSubmit={onAddSpot} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
