"use server"

import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type NotificationItem = {
  id: string
  kind: "leave_approved" | "leave_rejected" | "leave_pending" | "team_leave_pending" | "visitor_checkin" | "expense_approved" | "expense_rejected" | "expense_pending" | "expense_pending_approval"
  label: string
  sub?: string
  timestamp: string
  link: string
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export async function getNotifications(): Promise<{ notifications: NotificationItem[]; badgeCount: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { notifications: [], badgeCount: 0 }

  const today = new Date().toISOString().split("T")[0]
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString()

  const [{ data: rolesData }, { data: ownLeave }, { data: ownExpenses }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days_count, status, created_at, updated_at")
      .eq("user_id", user.id)
      .gte("updated_at", thirtyDaysAgoStr)
      .order("updated_at", { ascending: false })
      .limit(6),
    (supabase as any)
      .from("expenses")
      .select("id, description, converted_gbp, amount, currency, status, created_at, updated_at")
      .eq("user_id", user.id)
      .gte("updated_at", thirtyDaysAgoStr)
      .order("updated_at", { ascending: false })
      .limit(6),
  ])

  const roles = (rolesData ?? []).map((r: any) => r.role)
  const isAdmin = roles.includes("admin")
  const isDirector = roles.includes("director")
  const isReception = roles.includes("reception")
  const canApproveExpenses = isAdmin || isDirector || roles.includes("manager")

  // Team pending leave — admins/directors see all; approvers see their assigned people
  let teamPending: any[] = []
  if (isAdmin || isDirector) {
    const { data } = await supabaseAdmin
      .from("leave_requests")
      .select("id, leave_type, start_date, days_count, created_at, user_profiles!leave_requests_user_id_fkey(display_name, full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10)
    teamPending = data ?? []
  } else {
    // Find all users for whom this person is a designated approver (use admin to bypass RLS)
    const { data: approverRows } = await supabaseAdmin
      .from("user_approvers")
      .select("user_id")
      .eq("approver_id", user.id)
    const approvedUserIds = (approverRows ?? []).map((r: any) => r.user_id)

    // Fetch pending leave where: user is in approver list OR approver_id on the request matches
    const filter = approvedUserIds.length > 0
      ? `approver_id.eq.${user.id},user_id.in.(${approvedUserIds.join(",")})`
      : `approver_id.eq.${user.id}`

    const { data } = await supabaseAdmin
      .from("leave_requests")
      .select("id, leave_type, start_date, days_count, created_at, user_profiles!leave_requests_user_id_fkey(display_name, full_name)")
      .eq("status", "pending")
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(10)
    teamPending = data ?? []
  }

  // Expenses pending my approval (admin/director/manager)
  let pendingExpenses: any[] = []
  if (canApproveExpenses) {
    const { data } = await (supabaseAdmin as any)
      .from("expenses")
      .select("id, description, converted_gbp, amount, currency, created_at, user_profiles!expenses_user_id_fkey(display_name, full_name)")
      .eq("status", "submitted")
      .eq("direct_approver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
    pendingExpenses = data ?? []
  }

  // Visitor check-ins today (admin/reception)
  let recentCheckins: any[] = []
  if (isAdmin || isReception) {
    const { data } = await supabase
      .from("visitors")
      .select("id, visitor_name, company, checked_in_at")
      .eq("visit_date", today)
      .not("checked_in_at", "is", null)
      .order("checked_in_at", { ascending: false })
      .limit(3)
    recentCheckins = data ?? []
  }

  const notifications: NotificationItem[] = []

  // Own leave requests
  for (const lr of ownLeave ?? []) {
    const type = lr.leave_type.charAt(0).toUpperCase() + lr.leave_type.slice(1)
    const range = lr.start_date === lr.end_date
      ? fmtDate(lr.start_date)
      : `${fmtDate(lr.start_date)} – ${fmtDate(lr.end_date)}`
    const days = `${lr.days_count} day${lr.days_count !== 1 ? "s" : ""}`
    if (lr.status === "approved") {
      notifications.push({ id: lr.id, kind: "leave_approved", label: `${type} leave approved`, sub: `${days} · ${range}`, timestamp: lr.updated_at, link: "/leave" })
    } else if (lr.status === "rejected") {
      notifications.push({ id: lr.id, kind: "leave_rejected", label: `${type} leave declined`, sub: `${days} · ${range}`, timestamp: lr.updated_at, link: "/leave" })
    } else {
      notifications.push({ id: lr.id, kind: "leave_pending", label: `${type} leave awaiting approval`, sub: `${days} · ${range}`, timestamp: lr.created_at, link: "/leave" })
    }
  }

  // Own expense updates
  for (const exp of ownExpenses ?? []) {
    const amt = exp.converted_gbp != null
      ? `£${Number(exp.converted_gbp).toFixed(2)}`
      : `${exp.currency ?? ''} ${Number(exp.amount ?? 0).toFixed(2)}`
    const label = exp.description ? `${exp.description}` : 'Expense'
    if (exp.status === "approved") {
      notifications.push({ id: `exp-${exp.id}`, kind: "expense_approved", label: `${label} approved`, sub: amt, timestamp: exp.updated_at, link: "/expenses" })
    } else if (exp.status === "rejected") {
      notifications.push({ id: `exp-${exp.id}`, kind: "expense_rejected", label: `${label} rejected`, sub: amt, timestamp: exp.updated_at, link: "/expenses" })
    } else if (exp.status === "submitted") {
      notifications.push({ id: `exp-${exp.id}`, kind: "expense_pending", label: `${label} awaiting approval`, sub: amt, timestamp: exp.created_at, link: "/expenses" })
    }
  }

  // Expenses needing my approval
  for (const exp of pendingExpenses) {
    const name = (exp.user_profiles as any)?.display_name || (exp.user_profiles as any)?.full_name || "Someone"
    const amt = exp.converted_gbp != null ? `£${Number(exp.converted_gbp).toFixed(2)}` : `${exp.currency ?? ''} ${Number(exp.amount ?? 0).toFixed(2)}`
    notifications.push({
      id: `expa-${exp.id}`,
      kind: "expense_pending_approval",
      label: `${name} submitted an expense`,
      sub: `${amt}${exp.description ? ' · ' + exp.description : ''}`,
      timestamp: exp.created_at,
      link: "/expenses",
    })
  }

  // Team pending (admin/approver)
  for (const lr of teamPending) {
    const name = (lr.user_profiles as any)?.display_name || (lr.user_profiles as any)?.full_name || "Someone"
    const type = (lr.leave_type as string).charAt(0).toUpperCase() + (lr.leave_type as string).slice(1)
    const days = `${lr.days_count} day${lr.days_count !== 1 ? "s" : ""}`
    notifications.push({
      id: `tp-${lr.id}`,
      kind: "team_leave_pending",
      label: `${name} requested ${type} leave`,
      sub: `${days} from ${fmtDate(lr.start_date)}`,
      timestamp: lr.created_at,
      link: "/manager/approvals",
    })
  }

  // Visitor check-ins
  for (const v of recentCheckins) {
    const time = new Date(v.checked_in_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    notifications.push({
      id: `vi-${v.id}`,
      kind: "visitor_checkin",
      label: `${v.visitor_name} checked in`,
      sub: `${v.company ? v.company + " · " : ""}${time}`,
      timestamp: v.checked_in_at,
      link: "/reception/today",
    })
  }

  notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const top = notifications.slice(0, 8)

  // Badge count = items needing action or attention
  const badgeCount = top.filter(n =>
    n.kind === "team_leave_pending" ||
    n.kind === "leave_approved" ||
    n.kind === "leave_rejected" ||
    n.kind === "expense_pending_approval" ||
    n.kind === "expense_approved" ||
    n.kind === "expense_rejected"
  ).length

  return { notifications: top, badgeCount }
}
