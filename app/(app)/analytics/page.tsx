export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { AnalyticsClient } from "./analytics-client"
import { getAllWorkSchedules } from "@/lib/actions/schedule"

export default async function AnalyticsPage() {
  const ctx = await getCurrentUser()
  if (!ctx) redirect("/login")

  const { data: rolesData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.id)
  const roles = (rolesData ?? []).map((r: any) => r.role)
  if (!roles.includes("admin") && !roles.includes("director")) redirect("/")

  const year = new Date().getFullYear()
  const yearStart = year + "-01-01"
  const yearEnd = year + "-12-31"
  const today = new Date().toISOString().split("T")[0]

  const [
    { data: users },
    { data: attendance },
    { data: wfhRecords },
    { data: leaveRequests },
    { data: visitors },
    { data: complaints },
    { data: feedbackItems },
    schedules,
  ] = await Promise.all([
    supabaseAdmin
      .from("user_profiles")
      .select("id, full_name, display_name")
      .eq("is_active", true)
      .order("full_name"),
    supabaseAdmin
      .from("attendance")
      .select("id, user_id, work_date, clock_in, clock_out, total_hours, status, expected_arrival_time, early_leave, early_leave_reason")
      .gte("work_date", yearStart)
      .lte("work_date", yearEnd)
      .order("work_date"),
    supabaseAdmin
      .from("wfh_records")
      .select("user_id, wfh_date, wfh_type")
      .gte("wfh_date", yearStart)
      .lte("wfh_date", yearEnd),
    supabaseAdmin
      .from("leave_requests")
      .select("user_id, leave_type, start_date, end_date, days_count, status")
      .lte("start_date", yearEnd)
      .gte("end_date", yearStart)
      .eq("status", "approved"),
    supabaseAdmin
      .from("visitors")
      .select("id, visitor_name, company, visit_date, checked_in_at, checked_out_at, status, guest_count")
      .gte("visit_date", yearStart)
      .lte("visit_date", yearEnd)
      .order("visit_date"),
    supabaseAdmin
      .from("complaints")
      .select("id, user_id, subject, severity, category, status, is_anonymous, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("feedback")
      .select("id, user_id, subject, category, status, created_at")
      .order("created_at", { ascending: false }),
    getAllWorkSchedules(),
  ])

  return (
    <AnalyticsClient
      users={(users ?? []) as any}
      attendance={(attendance ?? []) as any}
      wfhRecords={(wfhRecords ?? []) as any}
      leaveRequests={leaveRequests ?? []}
      visitors={visitors ?? []}
      complaints={complaints ?? []}
      feedbackItems={feedbackItems ?? []}
      schedules={schedules}
      today={today}
    />
  )
}
