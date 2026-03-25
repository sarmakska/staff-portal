// Pure sync helpers for work schedule calculations.
// No 'use server' — safe to import anywhere (server components, actions, etc.)

import type { WorkDayCode, WorkSchedule } from '@/types/database'

const DOW_CODE: WorkDayCode[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Expected contracted hours from Mon up to and including today
export function calcExpectedHoursThisWeek(schedule: WorkSchedule): number {
    const todayDow = new Date().getDay() // 0=Sun, 6=Sat
    let expected = 0
    for (let d = 1; d <= todayDow; d++) {
        if (schedule.work_days.includes(DOW_CODE[d])) {
            expected += schedule.daily_hours
        }
    }
    return expected
}

// How many scheduled days have passed this week, and total scheduled days
export function scheduledDaysPassedThisWeek(schedule: WorkSchedule): { passed: number; total: number } {
    const todayDow = new Date().getDay()
    let passed = 0
    let total = 0
    for (let d = 1; d <= 7; d++) {
        const code = DOW_CODE[d % 7]
        if (schedule.work_days.includes(code)) {
            total++
            if (todayDow === 0 || d <= todayDow) passed++
        }
    }
    return { passed, total }
}
