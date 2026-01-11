"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ensureProfile } from "@/lib/api/profiles"
import type { User } from "@supabase/supabase-js"
import type { Profile } from "@/types/profile"

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // IMPORTANT: create the Supabase client once.
  // If we recreate it on every render, the auth subscriptions re-initialize repeatedly,
  // which can cause brief loading flashes (and unmount UI like dialogs).
  const supabase = useMemo(() => createClient(), [])

  const loadProfile = async (u: User) => {
    try {
      const profileData = await ensureProfile({ id: u.id, email: u.email })
      setProfile(profileData)
    } catch (error) {
      const e: any = error
      console.error("Error loading profile:", {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        status: e?.status,
        raw: e,
      })
      setProfile(null)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
