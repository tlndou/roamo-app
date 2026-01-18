"use client"

import { Bell, MapPin, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface PushPermissionDialogProps {
  open: boolean
  onAccept: () => void
  onDecline: () => void
}

export function PushPermissionDialog({
  open,
  onAccept,
  onDecline,
}: PushPermissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDecline()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Stay in the loop</DialogTitle>
          <DialogDescription className="text-center">
            Get helpful reminders based on where you are.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-muted p-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Weekend ideas at home</p>
              <p className="text-sm text-muted-foreground">
                Get suggestions for nearby spots you've saved when you're planning your weekend.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-muted p-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Travel suggestions when away</p>
              <p className="text-sm text-muted-foreground">
                Remember those spots you saved for your trip? We'll remind you when you arrive.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onAccept} className="w-full">
            Enable notifications
          </Button>
          <Button variant="ghost" onClick={onDecline} className="w-full">
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
