import { createClient } from "@/lib/supabase/server"
export const dynamic = "force-dynamic"

import { supabaseAdmin } from "@/lib/supabase/admin"
import DashboardClient from "./dashboard-client"
import type { NotificationItem } from "@/lib/actions/notifications"
import { getWorkSchedule } from "@/lib/actions/schedule"
import { calcExpectedHoursThisWeek, scheduledDaysPassedThisWeek } from "@/lib/schedule-helpers"

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const today = new Date().toISOString().split("T")[0]
  const currentYear = new Date().getFullYear()
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const weekStartStr = weekStart.toISOString().split("T")[0]

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString()
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const sevenDaysFromNowStr = sevenDaysFromNow.toISOString()

  // Fetch user profile + roles + schedule in parallel
  const [{ data: profile }, { data: rolesData }, userSchedule] = await Promise.all([
    supabase.from("user_profiles").select("full_name, display_name").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    getWorkSchedule(user.id),
  ])

  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
  const isAdmin = roles.includes("admin")
  const isDirector = roles.includes("director")
  const isReception = roles.includes("reception")

  const displayName =
    profile?.display_name || profile?.full_name || user.email?.split("@")[0] || "User"

  // Find all users for whom this person is a designated approver (any priority)
  const { data: myApproverRows } = await supabase
    .from("user_approvers")
    .select("user_id")
    .eq("approver_id", user.id)
  const approvedUserIds = (myApproverRows ?? []).map((r: any) => r.user_id as string)
  const isLeaveApprover = approvedUserIds.length > 0

  // Fetch ALL dashboard data in one parallel round-trip
  const [
    { data: todayAttArr },
    { data: weekAtt },
    { data: balances },
    { data: lastYearAnnualBal },
    { data: userCarryProfile },
    { count: pendingLeave },
    { count: myPendingLeave },
    { data: ownLeave },
    { count: visitorsCount },
    { data: teamPendingRaw },
    { data: recentCheckinsRaw },
    { data: diaryRemindersRaw },
  ] = await Promise.all([
    supabase.from("attendance").select("clock_in, clock_out, work_date").eq("user_id", user.id).eq("work_date", today).order("clock_in", { ascending: false }).limit(1),
    supabase.from("attendance").select("total_hours").eq("user_id", user.id).gte("work_date", weekStartStr),
    supabase.from("leave_balances").select("leave_type, total, used, pending, carried_forward").eq("user_id", user.id).eq("year", currentYear),
    supabaseAdmin.from("leave_balances").select("total, used, pending").eq("user_id", user.id).eq("leave_type", "annual" as any).eq("year", currentYear - 1).single(),
    (supabaseAdmin as any).from("user_profiles").select("max_carry_forward, carry_forward_days").eq("id", user.id).single(),
    // Approval widget count — only show for designated approvers, not blanket admin
    isLeaveApprover
      ? supabaseAdmin.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending").in("user_id", approvedUserIds)
      : Promise.resolve({ count: 0, data: null, error: null }),
    supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
    // Own leave requests — last 30 days
    supabase.from("leave_requests")
      .select("id, leave_type, start_date, end_date, days_count, status, created_at, updated_at")
      .eq("user_id", user.id)
      .gte("updated_at", thirtyDaysAgoStr)
      .order("updated_at", { ascending: false })
      .limit(6),
    // Visitors count
    (isAdmin || isDirector || isReception)
      ? supabase.from("visitors").select("*", { count: "exact", head: true }).eq("visit_date", today)
      : Promise.resolve({ count: 0, data: null, error: null }),
    // Team pending leave — all users who have this person as an approver at any priority
    isLeaveApprover
      ? supabaseAdmin
          .from("leave_requests")
          .select("id, leave_type, start_date, days_count, created_at, user_profiles!leave_requests_user_id_fkey(display_name, full_name)")
          .eq("status", "pending")
          .in("user_id", approvedUserIds)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    // Recent visitor check-ins
    (isAdmin || isDirector || isReception)
      ? supabase
          .from("visitors")
          .select("id, visitor_name, company, checked_in_at")
          .eq("visit_date", today)
          .not("checked_in_at", "is", null)
          .order("checked_in_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [], error: null }),
    // Diary reminders — next 7 days
    supabase
      .from("diary_entries")
      .select("id, title, reminder_at, tags")
      .eq("user_id", user.id)
      .eq("reminder_sent", false as any)
      .not("reminder_at", "is", null)
      .gte("reminder_at", new Date().toISOString())
      .lte("reminder_at", sevenDaysFromNowStr)
      .order("reminder_at", { ascending: true })
      .limit(5),
  ])

  // Compute annual carry forward same way admin Leave Allowances page does
  const maxCarry = (userCarryProfile as any)?.max_carry_forward ?? 5
  let annualCarry = 0
  if (lastYearAnnualBal) {
    const remaining = Math.max(0, Number((lastYearAnnualBal as any).total) - Number((lastYearAnnualBal as any).used) - Number((lastYearAnnualBal as any).pending))
    annualCarry = Math.min(remaining, maxCarry)
  } else {
    annualCarry = (userCarryProfile as any)?.carry_forward_days ?? 0
  }
  const enrichedBalances = (balances ?? []).map((b: any) =>
    b.leave_type === "annual" ? { ...b, carried_forward: annualCarry } : b
  )

  const visitorsToday = visitorsCount ?? 0
  const teamPending: any[] = teamPendingRaw ?? []
  const recentCheckins: any[] = recentCheckinsRaw ?? []
  const diaryReminders: any[] = diaryRemindersRaw ?? []

  const todayAtt = todayAttArr?.[0] ?? null
  const clockedIn = !!todayAtt?.clock_in && !todayAtt?.clock_out
  const clockInTime = todayAtt?.clock_in
    ? new Date(todayAtt.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null
  const completedWeekHours = (weekAtt ?? []).reduce((s: number, r: { total_hours: number | null }) => s + (r.total_hours ?? 0), 0)
  const clockInIso = todayAtt?.clock_in ?? null
  const weekHours = completedWeekHours
  const expectedHoursThisWeek = calcExpectedHoursThisWeek(userSchedule)
  const contractedWeeklyHours = userSchedule.daily_hours * userSchedule.work_days.length
  const { passed: scheduledDaysPassed, total: scheduledDaysTotal } = scheduledDaysPassedThisWeek(userSchedule)

  // ── Build notifications ──────────────────────────────────────────

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

  // Team pending leave (admin/approver)
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

  return (
    <DashboardClient
      userId={user.id}
      clockedIn={clockedIn}
      clockInTime={clockInTime}
      clockInIso={clockInIso}
      completedWeekHours={completedWeekHours}
      weekHours={weekHours}
      expectedHoursThisWeek={expectedHoursThisWeek}
      contractedWeeklyHours={contractedWeeklyHours}
      scheduledDaysPassed={scheduledDaysPassed}
      scheduledDaysTotal={scheduledDaysTotal}
      leaveBalances={enrichedBalances}
      pendingApprovals={pendingLeave ?? 0}
      myPendingLeave={myPendingLeave ?? 0}
      visitorsToday={visitorsToday}
      notifications={notifications.slice(0, 8)}
      isAdmin={isAdmin || isDirector}
      isReception={isReception}
      displayName={displayName}
      diaryReminders={diaryReminders}
      leaveRequests={ownLeave ?? []}
    />
  )
}
