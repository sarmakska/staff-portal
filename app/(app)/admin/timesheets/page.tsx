import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { TimesheetsClient } from "@/app/(app)/timesheets/timesheets-client"
import { DateRangeSelector } from "@/app/(app)/timesheets/date-range-selector"

function defaultRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]
  return { from, to }
}

export default async function AdminMyTimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const _authCtx = await getCurrentUser()
  if (!_authCtx) redirect("/login")
  if (!_authCtx.isAdmin) redirect("/")

  const params = await searchParams
  const { from: defaultFrom, to: defaultTo } = defaultRange()
  const from = params.from ?? defaultFrom
  const to = params.to ?? defaultTo
  const userId = _authCtx.id

  const [{ data: records }, { data: wfhRecords }, { data: scheduleData }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from("attendance")
      .select("id, work_date, clock_in, clock_out, total_hours, status, running_late, late_reason, expected_arrival_time, late_logged_by")
      .eq("user_id", userId)
      .gte("work_date", from)
      .lte("work_date", to) as any,
    supabaseAdmin
      .from("wfh_records")
      .select("wfh_date, wfh_type")
      .eq("user_id", userId)
      .gte("wfh_date", from)
      .lte("wfh_date", to),
    (supabaseAdmin as any)
      .from("work_schedules")
      .select("hours_by_day, daily_hours")
      .eq("user_id", userId)
      .single(),
    supabaseAdmin
      .from("user_profiles")
      .select("full_name, display_name")
      .eq("id", userId)
      .single(),
  ])

  const DOW_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
  function contractedHours(dateStr: string, wfhType: string): number {
    const dow = new Date(dateStr + "T00:00:00Z").getUTCDay()
    const dayCode = DOW_CODES[dow]
    const full = scheduleData?.hours_by_day?.[dayCode] ?? scheduleData?.daily_hours ?? 7.5
    return (wfhType === "half_am" || wfhType === "half_pm") ? full / 2 : full
  }

  const wfhDateMap = new Map<string, string>((wfhRecords ?? []).map((w: any) => [w.wfh_date as string, w.wfh_type ?? "full"]))
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

  const myName = profile?.display_name || profile?.full_name || "Me"

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Timesheet</h1>
        <p className="text-sm text-muted-foreground">{myName} · {from} to {to}</p>
      </div>

      <DateRangeSelector userId={userId} from={from} to={to} basePath="/admin/timesheets" />

      {/* Privacy notice — shown to all users */}
      <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
        <span className="mt-0.5 text-base">🔒</span>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Privacy &amp; Data Access Policy.</span>{" "}
          You can only view your own timesheet records. Detailed clock-in and clock-out times, along with attendance analytics, are strictly restricted to the <span className="font-medium text-foreground">Director</span> role only — this applies to all staff members without exception, including management and technical personnel. The <span className="font-medium text-foreground">Office Manager</span> role has access to a roll call view with entry times solely for fire evacuation procedures, in compliance with standard health and safety requirements. This policy has been reviewed and agreed upon by company management and is designed to protect the privacy of every individual in the workplace. No further access to this data will be granted beyond what is outlined above.
        </p>
      </div>

      <TimesheetsClient
        key={`${userId}-${from}-${to}`}
        records={allRecords}
        isAdmin={false}
        viewingName={myName}
        viewingUserId={userId}
        from={from}
        to={to}
        hideExportAll
      />
    </div>
  )
}
