import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { StaffSummaryClient } from "./staff-summary-client"

const DAY_CODE_TO_DOW: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 }
const DEFAULT_WORK_DAYS = ["mon", "tue", "wed", "thu", "fri"]

function defaultRange() {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]
    return { from, to }
}

async function getUKBankHolidays(): Promise<Set<string>> {
    try {
        const res = await fetch("https://www.gov.uk/bank-holidays.json", { next: { revalidate: 86400 } })
        const data = await res.json()
        const dates = new Set<string>()
        for (const event of data["england-and-wales"]?.events ?? []) dates.add(event.date)
        return dates
    } catch { return new Set() }
}

function countWorkingDays(from: string, to: string, bankHolidays: Set<string>): number {
    let count = 0
    const cur = new Date(from + "T00:00:00Z")
    const end = new Date(to + "T00:00:00Z")
    while (cur <= end) {
        const dow = cur.getUTCDay()
        const dateStr = cur.toISOString().split("T")[0]
        if (dow >= 1 && dow <= 5 && !bankHolidays.has(dateStr)) count++
        cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return count
}

// Count contracted working days for a person in the period based on their schedule
function countContractedDays(from: string, to: string, bankHolidays: Set<string>, workDays: string[]): number {
    const dowSet = new Set(workDays.map(d => DAY_CODE_TO_DOW[d] ?? -1))
    let count = 0
    const cur = new Date(from + "T00:00:00Z")
    const end = new Date(to + "T00:00:00Z")
    while (cur <= end) {
        const dow = cur.getUTCDay()
        const dateStr = cur.toISOString().split("T")[0]
        if (dowSet.has(dow) && !bankHolidays.has(dateStr)) count++
        cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return count
}

export default async function StaffSummaryPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string }>
}) {
    const authCtx = await getCurrentUser()
    if (!authCtx) redirect("/login")
    if (!authCtx.isAccounts && !authCtx.isAdmin && !authCtx.isDirector) redirect("/")

    const params = await searchParams
    const { from: defaultFrom, to: defaultTo } = defaultRange()
    const from = params.from ?? defaultFrom
    const to = params.to ?? defaultTo

    const bankHolidays = await getUKBankHolidays()
    const workingDaysInPeriod = countWorkingDays(from, to, bankHolidays)
    const bankHolidaysInRange = Array.from(bankHolidays).filter(d => d >= from && d <= to).sort()

    // All active employees
    const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id, full_name, display_name, email")
        .eq("is_active", true)
        .order("full_name")

    const userIds = (profiles ?? []).map((p: any) => p.id)

    const [
        { data: attendance },
        { data: wfhRecords },
        { data: leaveRequests },
        { data: scheduleRows },
    ] = await Promise.all([
        supabaseAdmin
            .from("attendance")
            .select("user_id, work_date")
            .in("user_id", userIds)
            .gte("work_date", from)
            .lte("work_date", to)
            .not("clock_in", "is", null),
        (supabaseAdmin as any)
            .from("wfh_records")
            .select("user_id, wfh_date, wfh_type")
            .in("user_id", userIds)
            .gte("wfh_date", from)
            .lte("wfh_date", to),
        supabaseAdmin
            .from("leave_requests")
            .select("user_id, leave_type, start_date, end_date, days_count")
            .in("user_id", userIds)
            .eq("status", "approved")
            .lte("start_date", to)
            .gte("end_date", from),
        (supabaseAdmin as any)
            .from("work_schedules")
            .select("user_id, work_days, daily_hours, hours_by_day")
            .in("user_id", userIds),
    ])

    // Build schedule map: userId -> schedule info
    const scheduleMap = new Map<string, { workDays: string[]; hoursPerWeek: number }>()
    for (const s of scheduleRows ?? []) {
        const workDays: string[] = (s.work_days as string[]) ?? DEFAULT_WORK_DAYS
        const hByDay: Record<string, number> | null = s.hours_by_day ?? null
        const dailyHours: number = s.daily_hours ?? 7.5
        let hoursPerWeek: number
        if (hByDay && Object.keys(hByDay).length > 0) {
            hoursPerWeek = workDays.reduce((sum: number, d: string) => sum + (hByDay[d] ?? dailyHours), 0)
        } else {
            hoursPerWeek = workDays.length * dailyHours
        }
        scheduleMap.set(s.user_id, { workDays, hoursPerWeek })
    }

    // Build per-person summary
    const summaryMap = new Map<string, {
        id: string
        name: string
        email: string
        daysWorked: number
        wfhDays: number
        daysLeave: number
        leaveBreakdown: Record<string, number>
        contractedDays: number
        contractedDaysPerWeek: number
        hoursPerWeek: number
    }>()

    for (const p of profiles ?? []) {
        const sched = scheduleMap.get(p.id)
        const workDays = sched?.workDays ?? DEFAULT_WORK_DAYS
        const hoursPerWeek = sched?.hoursPerWeek ?? (workDays.length * 7.5)
        const contractedDays = countContractedDays(from, to, bankHolidays, workDays)
        summaryMap.set(p.id, {
            id: p.id,
            name: p.display_name || p.full_name || "—",
            email: p.email ?? "",
            daysWorked: 0,
            wfhDays: 0,
            daysLeave: 0,
            leaveBreakdown: {},
            contractedDays,
            contractedDaysPerWeek: workDays.length,
            hoursPerWeek,
        })
    }

    // Build half-day leave set
    const halfDayLeaveSet = new Set<string>()
    for (const lr of leaveRequests ?? []) {
        if (Number(lr.days_count) === 0.5 && lr.start_date === lr.end_date) {
            const dateStr = new Date(lr.start_date).toISOString().split("T")[0]
            halfDayLeaveSet.add(`${lr.user_id}|${dateStr}`)
        }
    }

    // Per-person per-day contribution map
    const dayContrib = new Map<string, number>()

    // Office days
    for (const a of attendance ?? []) {
        const dateStr = new Date(a.work_date).toISOString().split("T")[0]
        const key = `${a.user_id}|${dateStr}`
        const isHalfLeaveDay = halfDayLeaveSet.has(key)
        dayContrib.set(key, isHalfLeaveDay ? 0.5 : 1)
    }

    // WFH records
    const wfhDaySet = new Map<string, number>() // key -> wfhVal (for separate WFH count)
    for (const w of (wfhRecords as any[]) ?? []) {
        const dateStr = new Date(w.wfh_date).toISOString().split("T")[0]
        const key = `${w.user_id}|${dateStr}`
        const wfhVal = w.wfh_type === "full" ? 1 : 0.5
        const existing = dayContrib.get(key) ?? 0
        const isHalfLeaveDay = halfDayLeaveSet.has(key)
        const cap = isHalfLeaveDay ? 0.5 : 1
        dayContrib.set(key, Math.min(cap, existing + wfhVal))
        // Track WFH separately
        wfhDaySet.set(key, (wfhDaySet.get(key) ?? 0) + wfhVal)
    }

    // Sum contributions per person
    for (const [key, val] of dayContrib.entries()) {
        const userId = key.split("|")[0]
        const row = summaryMap.get(userId)
        if (row) row.daysWorked += val
    }

    // Sum WFH days per person
    for (const [key, val] of wfhDaySet.entries()) {
        const userId = key.split("|")[0]
        const row = summaryMap.get(userId)
        if (row) row.wfhDays += val
    }

    // Leave
    for (const lr of leaveRequests ?? []) {
        const row = summaryMap.get(lr.user_id)
        if (!row) continue
        const days = Number(lr.days_count)
        row.daysLeave += days
        row.leaveBreakdown[lr.leave_type] = (row.leaveBreakdown[lr.leave_type] ?? 0) + days
    }

    const summary = Array.from(summaryMap.values())

    return (
        <StaffSummaryClient
            summary={summary}
            from={from}
            to={to}
            workingDaysInPeriod={workingDaysInPeriod}
            bankHolidaysInRange={bankHolidaysInRange}
        />
    )
}
