// ============================================================
// Visitor Reference Code Generator
// Format: MEM-YYYY-NNNN (e.g. MEM-2026-0421)
// Unique per day, sequential per day based on count.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase/admin'

export async function generateVisitorReferenceCode(visitDate: string): Promise<string> {
    const year = new Date(visitDate).getFullYear()

    // Count existing bookings for this date to make the sequence number
    const { count } = await supabaseAdmin
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .gte('visit_date', `${year}-01-01`)
        .lt('visit_date', `${year + 1}-01-01`)

    const seq = ((count ?? 0) + 1).toString().padStart(4, '0')
    return `MEM-${year}-${seq}`
}

// ── Date utilities ───────────────────────────────────────────

export function formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(typeof date === 'string' ? new Date(date) : date)
}

export function formatDateTime(date: string | Date): string {
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(typeof date === 'string' ? new Date(date) : date)
}

// Fetch England & Wales bank holidays from the UK Gov API.
// Returns a Set of date strings like "2026-04-03".
async function fetchBankHolidays(): Promise<Set<string>> {
    try {
        const res = await fetch('https://www.gov.uk/bank-holidays.json', { next: { revalidate: 86400 } })
        if (!res.ok) return new Set()
        const data = await res.json()
        const events: { date: string }[] = data['england-and-wales']?.events ?? []
        return new Set(events.map(e => e.date))
    } catch {
        return new Set()
    }
}

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// Fetch the employee's contracted days from work_schedules.
// Returns a Set of day keys they work (e.g. {"mon","tue","wed","thu"}).
// Falls back to Mon–Fri if no schedule exists.
async function fetchWorkedDays(userId: string): Promise<Set<string>> {
    const { data } = await (supabaseAdmin as any)
        .from('work_schedules')
        .select('hours_by_day')
        .eq('user_id', userId)
        .single()

    if (!data?.hours_by_day) {
        // No schedule — default to Mon–Fri
        return new Set(['mon', 'tue', 'wed', 'thu', 'fri'])
    }

    const hbd = data.hours_by_day as Record<string, number>
    return new Set(DOW_KEYS.filter(d => (hbd[d] ?? 0) > 0))
}

export async function calcWorkingDays(
    start: string,
    end: string,
    dayType: 'full' | 'half_am' | 'half_pm',
    userId?: string,
): Promise<number> {
    if (dayType !== 'full') return 0.5

    const [bankHolidays, workedDays] = await Promise.all([
        fetchBankHolidays(),
        userId ? fetchWorkedDays(userId) : Promise.resolve(new Set(['mon', 'tue', 'wed', 'thu', 'fri'])),
    ])

    const startDate = new Date(start)
    const endDate = new Date(end)
    let days = 0
    const current = new Date(startDate)

    while (current <= endDate) {
        const dayKey = DOW_KEYS[current.getDay()]
        const iso = current.toISOString().slice(0, 10)
        // Only count days the employee is contracted to work, and not bank holidays
        if (workedDays.has(dayKey) && !bankHolidays.has(iso)) days++
        current.setDate(current.getDate() + 1)
    }

    return days
}

export function calcHoursWorked(
    clockIn: string | null,
    clockOut: string | null,
    breakStart: string | null,
    breakEnd: string | null
): number {
    if (!clockIn || !clockOut) return 0

    const inMs = new Date(clockIn).getTime()
    const outMs = new Date(clockOut).getTime()
    let worked = outMs - inMs

    if (breakStart && breakEnd) {
        const bsMs = new Date(breakStart).getTime()
        const beMs = new Date(breakEnd).getTime()
        worked -= (beMs - bsMs)
    }

    return Math.max(0, worked / (1000 * 60 * 60))
}
