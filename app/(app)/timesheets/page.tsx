import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { UserSelector } from "./user-selector"
import { TimesheetsClient } from "./timesheets-client"
import { DateRangeSelector } from "./date-range-selector"

function defaultRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]
  return { from, to }
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; from?: string; to?: string }>
}) {
  const _authCtx = await getCurrentUser()
  if (!_authCtx) redirect("/login")
  const currentUser = _authCtx

  const isAdmin = currentUser.isAdmin || currentUser.isDirector
  const isAccounts = currentUser.isAccounts
  // Accounts can browse all staff timesheets (read-only) but cannot edit times
  const canViewAll = isAdmin || isAccounts

  const params = await searchParams
  const { from: defaultFrom, to: defaultTo } = defaultRange()
  const from = params.from ?? defaultFrom
  const to = params.to ?? defaultTo

  // For canViewAll: default to first employee (not themselves) if no user selected
  // Admins view their own timesheet via /admin/timesheets
  let targetUserId = canViewAll && params.user ? params.user : currentUser.id

  // Fetch all users for the picker
  let allUsers: { id: string; name: string }[] = []
  if (canViewAll) {
    const { data } = await supabaseAdmin
      .from("user_profiles")
      .select("id, full_name, display_name")
      .eq("is_active", true)
      .order("full_name")
    allUsers = (data ?? []).map((u: any) => ({ id: u.id, name: u.display_name || u.full_name || "Unknown" }))

    // If admin and no user selected, default to first employee (not themselves)
    if (currentUser.isAdmin && !params.user) {
      const firstOther = allUsers.find(u => u.id !== currentUser.id)
      if (firstOther) targetUserId = firstOther.id
    }
  }

  const targetUser = canViewAll ? (allUsers.find(u => u.id === targetUserId) ?? { id: targetUserId, name: "Unknown" }) : null
  const viewingName = targetUser?.name ?? "Me"

  const [{ data: records }, { data: wfhRecords }, { data: scheduleData }] = await Promise.all([
    supabaseAdmin
      .from("attendance")
      .select("id, work_date, clock_in, clock_out, total_hours, status, running_late, late_reason, expected_arrival_time, late_logged_by")
      .eq("user_id", targetUserId)
      .gte("work_date", from)
      .lte("work_date", to) as any,
    supabaseAdmin
      .from("wfh_records")
      .select("wfh_date, wfh_type")
      .eq("user_id", targetUserId)
      .gte("wfh_date", from)
      .lte("wfh_date", to),
    (supabaseAdmin as any)
      .from("work_schedules")
      .select("hours_by_day, daily_hours")
      .eq("user_id", targetUserId)
      .single(),
  ])

  const DOW_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
  function contractedHours(dateStr: string, wfhType: string): number {
    const dow = new Date(dateStr + "T00:00:00Z").getUTCDay()
    const dayCode = DOW_CODES[dow]
    const full = scheduleData?.hours_by_day?.[dayCode] ?? scheduleData?.daily_hours ?? 7.5
    return (wfhType === "half_am" || wfhType === "half_pm") ? full / 2 : full
  }

  // Build WFH date map: date -> wfh_type
  const wfhDateMap = new Map<string, string>((wfhRecords ?? []).map((w: any) => [w.wfh_date as string, w.wfh_type ?? "full"]))

  // Add WFH-only rows with contracted hours
  const attendanceDates = new Set((records ?? []).map((r: any) => r.work_date))
  const wfhOnlyRows = (wfhRecords ?? [])
    .filter((w: any) => !attendanceDates.has(w.wfh_date))
    .map((w: any) => ({
      id: `wfh-only-${w.wfh_date}`,
      work_date: w.wfh_date,
      clock_in: null,
      clock_out: null,
      total_hours: contractedHours(w.wfh_date, w.wfh_type ?? "full"),
      status: "wfh",
    }))

  // If an attendance record exists on a WFH day, override status; fill hours from schedule if missing
  const mergedRecords = (records ?? []).map((r: any) => {
    const wType = wfhDateMap.get(r.work_date)
    if (!wType) return r
    return {
      ...r,
      status: "wfh",
      total_hours: (r.total_hours == null || r.total_hours === 0) ? contractedHours(r.work_date, wType) : r.total_hours,
    }
  })

  const allRecords = [...mergedRecords, ...wfhOnlyRows]
    .sort((a, b) => b.work_date.localeCompare(a.work_date))

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Timesheets</h1>
          <p className="text-sm text-muted-foreground">
            {canViewAll && targetUser ? `Viewing: ${targetUser.name}` : "Your attendance records"}
            {" · "}{from} to {to}
          </p>
        </div>
        {canViewAll && (
          <UserSelector users={allUsers} selectedId={targetUserId} />
        )}
      </div>

      {/* Date range selector */}
      <DateRangeSelector userId={targetUserId} from={from} to={to} />

      {/* Privacy notice — shown to regular employees only */}
      {!canViewAll && <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
        <span className="mt-0.5 text-base">🔒</span>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Privacy &amp; Data Access Policy.</span>{" "}
          You can only view your own timesheet records. Clock-in and clock-out times are accessible to the <span className="font-medium text-foreground">Director</span> and <span className="font-medium text-foreground">Accounts</span> roles for payroll and reporting purposes. Attendance analytics is restricted to the <span className="font-medium text-foreground">Director</span> role only. The <span className="font-medium text-foreground">Office Manager</span> role has access to a roll call view with entry times solely for fire evacuation procedures, in compliance with standard health and safety requirements. This policy has been reviewed and agreed upon by company management and is designed to protect the privacy of every individual in the workplace.
        </p>
      </div>}

      <TimesheetsClient
        key={`${targetUserId}-${from}-${to}`}
        records={allRecords}
        isAdmin={isAdmin}
        canExport={canViewAll}
        viewingName={viewingName}
        viewingUserId={targetUserId}
        from={from}
        to={to}
      />
    </div>
  )
}
