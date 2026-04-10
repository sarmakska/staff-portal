'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WorkDayCode, WorkSchedule, HoursByDay } from '@/types/database'

const DEFAULT_WORK_DAYS: WorkDayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri']
const DEFAULT_DAILY_HOURS = 7.5

function avgHours(workDays: WorkDayCode[], hoursByDay: HoursByDay): number {
    const vals = workDays.map(d => hoursByDay[d] ?? DEFAULT_DAILY_HOURS)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : DEFAULT_DAILY_HOURS
}

function parseScheduleRow(d: any): WorkSchedule {
    return {
        user_id: d.user_id,
        work_days: (d.work_days as WorkDayCode[]) ?? DEFAULT_WORK_DAYS,
        daily_hours: Number(d.daily_hours) || DEFAULT_DAILY_HOURS,
        hours_by_day: d.hours_by_day ?? null,
        updated_at: d.updated_at,
    }
}

// ── Get schedule for any user (admin / server-side use) ──────
export async function getWorkSchedule(userId: string): Promise<WorkSchedule> {
    const { data } = await supabaseAdmin
        .from('work_schedules')
        .select('user_id, work_days, daily_hours, hours_by_day, updated_at')
        .eq('user_id', userId)
        .single()

    if (!data) return {
        user_id: userId,
        work_days: DEFAULT_WORK_DAYS,
        daily_hours: DEFAULT_DAILY_HOURS,
        hours_by_day: null,
        updated_at: '',
    }
    return parseScheduleRow(data)
}

// ── Get schedules for all users (analytics) ──────────────────
export async function getAllWorkSchedules(): Promise<WorkSchedule[]> {
    const { data } = await supabaseAdmin
        .from('work_schedules')
        .select('user_id, work_days, daily_hours, hours_by_day, updated_at')
    return (data ?? []).map(parseScheduleRow)
}

// ── Get contracted hours for a specific employee on a specific date ──
export async function contractedHoursForDate(schedule: WorkSchedule | null, workDate: string): Promise<number> {
    if (!schedule) return DEFAULT_DAILY_HOURS
    if (schedule.hours_by_day) {
        const dow = new Date(workDate + 'T12:00:00').getDay()
        const dayCode = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dow] as WorkDayCode
        const perDay = (schedule.hours_by_day as HoursByDay)[dayCode]
        if (perDay !== undefined) return perDay
    }
    return schedule.daily_hours ?? DEFAULT_DAILY_HOURS
}

// ── Save schedule for any user (admin use) ───────────────────
export async function saveWorkScheduleForUser(
    userId: string,
    workDays: WorkDayCode[],
    hoursByDay: HoursByDay,
): Promise<{ success: boolean; error?: string }> {
    if (workDays.length === 0) return { success: false, error: 'Select at least one working day' }

    const vals = workDays.map(d => hoursByDay[d] ?? DEFAULT_DAILY_HOURS)
    if (vals.some(v => v < 0.5 || v > 24)) return { success: false, error: 'Invalid daily hours' }

    const dailyHoursAvg = avgHours(workDays, hoursByDay)

    const { error } = await supabaseAdmin
        .from('work_schedules')
        .upsert(
            {
                user_id: userId,
                work_days: workDays,
                daily_hours: dailyHoursAvg,
                hours_by_day: hoursByDay,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
        )

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/users')
    revalidatePath('/analytics')
    return { success: true }
}

// ── Save own schedule (called from settings) ─────────────────
export async function saveWorkSchedule(
    workDays: WorkDayCode[],
    hoursByDay: HoursByDay,
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (workDays.length === 0) return { success: false, error: 'Select at least one working day' }

    const vals = workDays.map(d => hoursByDay[d] ?? DEFAULT_DAILY_HOURS)
    if (vals.some(v => v < 0.5 || v > 24)) return { success: false, error: 'Invalid daily hours' }

    const dailyHoursAvg = avgHours(workDays, hoursByDay)

    const { error } = await supabaseAdmin
        .from('work_schedules')
        .upsert(
            {
                user_id: user.id,
                work_days: workDays,
                daily_hours: dailyHoursAvg,
                hours_by_day: hoursByDay,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
        )

    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    revalidatePath('/')
    return { success: true }
}
