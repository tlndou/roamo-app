"use client"

import { UserMenu } from "@/components/auth/user-menu"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { Skeleton } from "@/components/ui/skeleton"

export function Header() {
  const { user, loading } = useAuth()
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Roamo</h1>
          </div>

          <div>
            {loading ? (
              <Skeleton className="h-10 w-10 rounded-full" />
            ) : user ? (
              <UserMenu />
            ) : (
              <Button onClick={() => setShowAuthDialog(true)}>Sign In</Button>
            )}
          </div>
        </div>
      </header>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  )
}
