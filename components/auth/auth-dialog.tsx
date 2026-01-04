"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
      toast.success("Check your email for the magic link")
    }

    setLoading(false)
  }

  const resetDialog = () => {
    setSent(false)
    setEmail("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={resetDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sent ? "Check your email" : "Sign in to Roamo"}</DialogTitle>
          <DialogDescription>
            {sent ? `We sent a magic link to ${email}. Click the link to sign in.` : "Enter your email to receive a magic link"}
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send magic link"}
            </Button>
          </form>
        ) : (
          <Button onClick={resetDialog} variant="outline">
            Close
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
