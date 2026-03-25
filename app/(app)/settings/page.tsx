import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import SettingsClient from "./settings-client"
import { getCurrentUser } from "@/lib/actions/auth"
import { getWorkSchedule } from "@/lib/actions/schedule"

export default async function SettingsPage() {
  const supabase = await createClient()
  const _authCtx = await getCurrentUser()
  const user = _authCtx!
  const { isAdmin, isReception, isAccounts } = _authCtx!

  const [
    { data: profile },
    { data: rolesData },
    { data: dept },
    { data: loc },
    { data: approversData },
    { data: allUsers },
    schedule,
  ] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("departments").select("id, name"),
    supabase.from("locations").select("id, name"),
    // Current user's approvers with their profile info
    supabase
      .from("user_approvers")
      .select("approver_id, priority, approver:user_profiles!user_approvers_approver_id_fkey(id, full_name, display_name, job_title)")
      .eq("user_id", user.id)
      .order("priority"),
    // All active users for the approver picker (excluding self)
    supabase
      .from("user_profiles")
      .select("id, full_name, display_name, job_title")
      .eq("is_active", true)
      .neq("id", user.id)
      .order("full_name"),
    getWorkSchedule(user.id),
  ])

  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)

  const currentApprovers = (approversData ?? []).map((a: any) => ({
    id: a.approver_id as string,
    name: (a.approver?.display_name || a.approver?.full_name || "Unknown") as string,
    job_title: (a.approver?.job_title ?? null) as string | null,
    priority: a.priority as number,
  }))

  return (
    <SettingsClient
      profile={profile}
      roles={roles}
      departments={dept ?? []}
      locations={loc ?? []}
      currentApprovers={currentApprovers}
      allUsers={(allUsers ?? []) as { id: string; full_name: string; display_name: string | null; job_title: string | null }[]}
      schedule={schedule}
    />
  )
}
