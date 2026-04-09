// Pure sync helpers for work schedule calculations.
// No 'use server' — safe to import anywhere (server components, actions, etc.)

import type { WorkDayCode, WorkSchedule } from '@/types/database'

const DOW_CODE: WorkDayCode[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// England & Wales bank holidays — extend each year
const UK_BANK_HOLIDAYS = new Set([
    // 2025
    '2025-01-01', '2025-04-18', '2025-04-21', '2025-05-05',
    '2025-05-26', '2025-08-25', '2025-12-25', '2025-12-26',
    // 2026
    '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04',
    '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
])

function getWeekMonday(): Date {
    const now = new Date()
    const mon = new Date(now)
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    mon.setHours(0, 0, 0, 0)
    return mon
}

function toDateStr(d: Date): string {
    return d.toISOString().split('T')[0]
}

/** Check whether a YYYY-MM-DD string falls on a UK bank holiday */
export function isBankHoliday(dateStr: string): boolean {
    return UK_BANK_HOLIDAYS.has(dateStr)
}

// Expected contracted hours from Mon up to and including today, minus bank holidays
export function calcExpectedHoursThisWeek(schedule: WorkSchedule): number {
    const todayDow = new Date().getDay() // 0=Sun, 6=Sat
    const monday = getWeekMonday()
    let expected = 0
    for (let d = 1; d <= todayDow; d++) {
        if (!schedule.work_days.includes(DOW_CODE[d])) continue
        const date = new Date(monday)
        date.setDate(monday.getDate() + (d - 1))
        if (UK_BANK_HOLIDAYS.has(toDateStr(date))) continue
        expected += schedule.daily_hours
    }
    return expected
}

// How many scheduled days have passed this week, and total scheduled days — both excluding bank holidays
export function scheduledDaysPassedThisWeek(schedule: WorkSchedule): { passed: number; total: number } {
    const todayDow = new Date().getDay()
    const monday = getWeekMonday()
    let passed = 0
    let total = 0
    for (let d = 1; d <= 7; d++) {
        const code = DOW_CODE[d % 7]
        if (!schedule.work_days.includes(code)) continue
        const date = new Date(monday)
        date.setDate(monday.getDate() + (d - 1))
        if (UK_BANK_HOLIDAYS.has(toDateStr(date))) continue
        total++
        if (todayDow !== 0 && d <= todayDow) passed++
    }
    return { passed, total }
}

// Full contracted hours for this week, minus any bank holidays that fall on work days
export function contractedHoursThisWeek(schedule: WorkSchedule): number {
    const monday = getWeekMonday()
    let hours = 0
    for (let d = 1; d <= 7; d++) {
        const code = DOW_CODE[d % 7]
        if (!schedule.work_days.includes(code)) continue
        const date = new Date(monday)
        date.setDate(monday.getDate() + (d - 1))
        if (UK_BANK_HOLIDAYS.has(toDateStr(date))) continue
        hours += schedule.daily_hours
    }
    return hours
}
