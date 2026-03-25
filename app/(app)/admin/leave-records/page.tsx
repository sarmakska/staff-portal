import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { LeaveRecordsClient } from "./leave-records-client"

export default async function LeaveRecordsPage() {
  const supabase = await createClient()
  const _authCtx = await getCurrentUser()
  if (!_authCtx) redirect("/login")

  const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", _authCtx.id)
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
  if (!roles.includes("admin") && !roles.includes("director") && !roles.includes("accounts")) redirect("/")

  const { data: requests } = await supabaseAdmin
    .from("leave_requests")
    .select(`
      id, leave_type, start_date, end_date, days_count, day_type, status, reviewed_at, created_at,
      employee:user_profiles!leave_requests_user_id_fkey(full_name, display_name, email),
      approver:user_profiles!leave_requests_approver_id_fkey(full_name, display_name)
    `)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(200)

  return (
    <LeaveRecordsClient requests={(requests ?? []) as any} />
  )
}
