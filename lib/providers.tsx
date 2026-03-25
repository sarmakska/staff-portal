"use client"

// ============================================================
// Real Supabase Auth Provider
// Replaces the old mock AuthProvider and RoleProvider.
// Wraps the app and exposes session + user profile + roles.
// ============================================================

import React, { createContext, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User, Session } from "@supabase/supabase-js"
import type { UserRole } from "@/types/database"

interface UserProfile {
  id: string
  email: string
  full_name: string
  display_name: string | null
  job_title: string | null
  department_id: string | null
  location_id: string | null
  desk_extension: string | null
  avatar_url: string | null
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  roles: UserRole[]
  isAdmin: boolean
  isDirector: boolean
  isAccounts: boolean
  isReception: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  isAdmin: false,
  isDirector: false,
  isAccounts: false,
  isReception: false,
  loading: true,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("id, email, full_name, display_name, job_title, department_id, location_id, desk_extension, avatar_url, is_active")
      .eq("id", userId)
      .single()

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)

    if (profileData) setProfile(profileData as UserProfile)
    if (rolesData) setRoles((rolesData as { role: UserRole }[]).map(r => r.role))
  }

  useEffect(() => {
    // Re-evaluate session when pathname changes (e.g. redirected after server action login)
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser)
      if (currentUser) {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
        // Only load if profile missing or user changed
        if (!profile || profile.id !== currentUser.id) {
          loadProfile(currentUser.id).finally(() => setLoading(false))
        } else {
          setLoading(false)
        }
      } else {
        setProfile(null)
        setRoles([])
        setLoading(false)
      }
    })

    // Listen for auth changes (logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          loadProfile(session.user.id)
        } else {
          setProfile(null)
          setRoles([])
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [pathname]) // Trigger auth check whenever navigation occurs

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      roles,
      isAdmin: roles.includes("admin"),
      isDirector: roles.includes("director"),
      isAccounts: roles.includes("accounts"),
      isReception: roles.includes("reception"),
      loading,
      refreshProfile: async () => { if (user) await loadProfile(user.id) },
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// ── Convenience hook ──────────────────────────────────────────
// Returns display name: prefer display_name, fallback to full_name, fallback to email prefix
export function useDisplayName(): string {
  const { profile, user } = useAuth()
  if (profile?.display_name) return profile.display_name
  if (profile?.full_name) return profile.full_name
  if (user?.email) return user.email.split("@")[0]
  return "User"
}
