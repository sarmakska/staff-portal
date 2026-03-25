import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import ApprovalsClient from "./approvals-client"

export default async function ApprovalsPage() {
  const _authCtx = await getCurrentUser()
  if (!_authCtx) redirect("/login")
  const user = _authCtx

  const supabase = await createClient()
  const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)

  const isAdminOrDirector = roles.some(r => ["admin", "director"].includes(r))

  // Admin/Director see all pending leave. Everyone else only sees requests assigned to them.
  let leaveQuery = supabase
    .from("leave_requests")
    .select("*, user:user_profiles!leave_requests_user_id_fkey(full_name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  if (!isAdminOrDirector) {
    leaveQuery = leaveQuery.eq("approver_id", user.id)
  }

  // Corrections: admin/director only
  const correctionsQuery = supabase
    .from("attendance_corrections")
    .select("*, user:user_profiles!attendance_corrections_user_id_fkey(full_name, email), attendance(work_date)")
    .eq("status", "submitted")
    .order("created_at", { ascending: true })

  const [{ data: leaveRequests }, { data: corrections }] = await Promise.all([
    leaveQuery,
    isAdminOrDirector ? correctionsQuery : Promise.resolve({ data: [] })
  ])

  return <ApprovalsClient leaveRequests={leaveRequests ?? []} corrections={corrections ?? []} isAdmin={isAdminOrDirector} />
}
