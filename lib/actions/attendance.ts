"use server"

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendWfhEmail, sendEarlyClockOutEmail, sendRunningLateEmail } from '@/lib/email'
import { getEmailFlags } from '@/lib/actions/app-settings'

export async function getLiveStaffAttendance(): Promise<{
    id: string
    full_name: string
    department_name: string | null
    is_clocked_in: boolean
    clock_in_time: string | null
    attendance_record_id: string | null
}[]> {
    // Issue #1 fix: role check inside the action, not just on the page
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data: roleRows } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (roleRows ?? []).map((r: any) => r.role as string)
    if (!roles.includes('admin') && !roles.includes('reception') && !roles.includes('director')) return []

    const todayStr = new Date().toISOString().split('T')[0]

    // Get all staff profiles with departments
    const { data: staff } = await supabaseAdmin
        .from('user_profiles')
        .select(`
            id,
            full_name,
            departments!user_profiles_department_id_fkey(name)
        `)
        .order('full_name')

    if (!staff) return []

    // Get today's attendance
    const { data: attendance } = await supabaseAdmin
        .from('attendance')
        .select('id, user_id, clock_in, clock_out')
        .eq('work_date', todayStr)

    const attendanceMap = new Map(attendance?.map((a: any) => [a.user_id, a]) || [])

    return staff.map((s: any) => {
        const todayRecord: any = attendanceMap.get(s.id)
        const is_clocked_in = !!(todayRecord && todayRecord.clock_in && !todayRecord.clock_out)

        return {
            id: s.id,
            full_name: s.full_name,
            department_name: s.departments?.name || 'Unassigned',
            is_clocked_in,
            clock_in_time: todayRecord?.clock_in || null,
            attendance_record_id: todayRecord?.id || null
        }
    })
}

async function getNotifyEmail(userId: string): Promise<{ employeeName: string; departmentName: string; notifyEmail: string; employeeEmail: string }> {
    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name, email, departments!user_profiles_department_id_fkey(name)')
        .eq('id', userId)
        .single()

    const employeeEmail = (profile as any)?.email ?? ''
    const employeeName = (profile as any)?.full_name || employeeEmail || 'Unknown'
    const departmentName = (profile as any)?.departments?.name ?? 'Unassigned'

    const notifyEmail = process.env.WFH_NOTIFY_EMAIL ?? 'admin@yourcompany.com'
    return { employeeName, departmentName, notifyEmail, employeeEmail }
}

export async function checkWfhClockInBlock(userId: string, today: string): Promise<string | null> {
    const { data: wfh } = await supabaseAdmin
        .from('wfh_records')
        .select('wfh_type')
        .eq('user_id', userId)
        .eq('wfh_date', today)
        .maybeSingle()

    if (!wfh) return null

    if (wfh.wfh_type === 'full') {
        return 'You are working from home today — no clock-in required.'
    }

    const ukHour = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false })
    const hour = parseInt(ukHour)

    if (wfh.wfh_type === 'half_am' && hour < 12) {
        return 'You are working from home this morning — you can clock in after 12:00.'
    }
    if (wfh.wfh_type === 'half_pm' && hour >= 12) {
        return 'You are working from home this afternoon — no clock-in required after 12:00.'
    }

    return null
}

export async function toggleWfh(userId: string, today: string, enable: boolean, reason?: string, wfhType: 'full' | 'half_am' | 'half_pm' = 'full'): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    if (enable) {
        const { error } = await supabase.from('wfh_records').upsert({ user_id: userId, wfh_date: today, wfh_type: wfhType, notes: reason ?? null })
        if (error) return { success: false, error: error.message }

        // Auto-create attendance record if none exists for today
        const { data: existingAtt } = await supabaseAdmin
            .from('attendance')
            .select('id')
            .eq('user_id', userId)
            .eq('work_date', today)
            .maybeSingle()
        if (!existingAtt) {
            const noteLabel = wfhType === 'full' ? 'WFH - Full day' : wfhType === 'half_am' ? 'WFH - Half day AM' : 'WFH - Half day PM'
            await supabaseAdmin.from('attendance').insert({
                user_id: userId,
                work_date: today,
                status: 'present' as any,
                notes: noteLabel,
            })
        }

        const { employeeName, departmentName, notifyEmail } = await getNotifyEmail(userId)
        if (notifyEmail) {
            const dateLabel = new Date(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
            const flags = await getEmailFlags()
            if (flags.email_wfh) await sendWfhEmail({ employeeName, departmentName, wfhDate: dateLabel, wfhNotifyEmail: notifyEmail, reason, wfhType }).catch(() => {})
        }
    } else {
        const { error } = await supabase.from('wfh_records').delete().eq('user_id', userId).eq('wfh_date', today)
        if (error) return { success: false, error: error.message }

        // Remove the auto-created attendance record only if it has no clock-in (i.e. was WFH-only)
        await supabaseAdmin
            .from('attendance')
            .delete()
            .eq('user_id', userId)
            .eq('work_date', today)
            .is('clock_in', null)
            .like('notes', 'WFH%')
    }

    revalidatePath('/attendance')
    return { success: true }
}

export async function submitEarlyLeave(
    userId: string,
    today: string,
    reason: string,
    clockIn: string | null,
    breakStart: string | null,
    breakEnd: string | null
): Promise<{ success: boolean; error?: string; totalHours?: number }> {
    const supabase = await createClient()

    const now = new Date()
    const nowIso = now.toISOString()
    let totalHours = 0

    if (clockIn) {
        let workedMs = now.getTime() - new Date(clockIn).getTime()
        if (breakStart && breakEnd) workedMs -= new Date(breakEnd).getTime() - new Date(breakStart).getTime()
        totalHours = Math.max(0, workedMs / (1000 * 60 * 60))
    }

    const { error } = await supabase
        .from('attendance')
        .update({ clock_out: nowIso, status: 'present', total_hours: parseFloat(totalHours.toFixed(2)), early_leave: true, early_leave_reason: reason })
        .eq('user_id', userId)
        .eq('work_date', today)

    if (error) return { success: false, error: error.message }

    const { employeeName, departmentName, notifyEmail } = await getNotifyEmail(userId)
    if (notifyEmail) {
        const clockOutTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        const workDate = new Date(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
        const flags = await getEmailFlags()
        if (flags.email_early_clockout) await sendEarlyClockOutEmail({ notifyEmail, employeeName, departmentName, workDate, clockOutTime, hoursWorked: totalHours, reason }).catch(() => {})
    }

    revalidatePath('/attendance')
    return { success: true, totalHours }
}

export async function deleteAttendanceRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
        .from('attendance')
        .delete()
        .eq('id', recordId)

    if (error) {
        console.error('Error deleting attendance:', error)
        return { success: false, error: 'Failed to delete record.' }
    }

    revalidatePath('/admin/attendance')
    return { success: true }
}


export async function adminGetAllStaffWfh(date: string): Promise<{
    id: string
    full_name: string
    department_name: string | null
    is_wfh: boolean
    wfh_type: 'full' | 'half_am' | 'half_pm' | null
}[]> {
    const { data: staff } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, departments!user_profiles_department_id_fkey(name)')
        .order('full_name')

    if (!staff) return []

    const { data: wfhData } = await supabaseAdmin
        .from('wfh_records')
        .select('user_id, wfh_type')
        .eq('wfh_date', date)

    const wfhMap = new Map(wfhData?.map((w: any) => [w.user_id, w.wfh_type as 'full' | 'half_am' | 'half_pm']) || [])

    return staff.map((s: any) => ({
        id: s.id,
        full_name: s.full_name,
        department_name: (s.departments as any)?.name ?? null,
        is_wfh: wfhMap.has(s.id),
        wfh_type: wfhMap.get(s.id) ?? null,
    }))
}

export async function adminSetWfh(userId: string, date: string, enable: boolean): Promise<{ success: boolean; error?: string }> {
    if (enable) {
        const { error } = await supabaseAdmin.from('wfh_records').upsert({ user_id: userId, wfh_date: date })
        if (error) return { success: false, error: error.message }
    } else {
        const { error } = await supabaseAdmin.from('wfh_records').delete().eq('user_id', userId).eq('wfh_date', date)
        if (error) return { success: false, error: error.message }
    }
    revalidatePath('/admin/attendance')
    revalidatePath('/calendar')
    return { success: true }
}

export async function deleteWfhByEventId(eventId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('reception')) {
        return { success: false, error: 'Unauthorised' }
    }

    // eventId format: wfh-{uuid}-{YYYY-MM-DD}
    // UUID is always 36 chars: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const withoutPrefix = eventId.replace(/^wfh-/, '')
    const userId = withoutPrefix.substring(0, 36)
    const date = withoutPrefix.substring(37)

    const { error } = await supabaseAdmin
        .from('wfh_records')
        .delete()
        .eq('user_id', userId)
        .eq('wfh_date', date)

    if (error) return { success: false, error: error.message }
    revalidatePath('/calendar')
    return { success: true }
}

export async function logRunningLate(
    userId: string,
    reason?: string,
    expectedArrival?: string,
    loggedBy?: string
): Promise<{ success: boolean; error?: string }> {
    const today = new Date().toISOString().split('T')[0]

    const { data: existing } = await supabaseAdmin
        .from('attendance')
        .select('id')
        .eq('user_id', userId)
        .eq('work_date', today)
        .single()

    const lateFields = {
        running_late: true,
        late_reason: reason || null,
        expected_arrival_time: expectedArrival || null,
        late_logged_by: loggedBy || 'self',
    }

    let dbError: any
    if (existing) {
        const { error } = await supabaseAdmin
            .from('attendance')
            .update(lateFields as any)
            .eq('id', existing.id)
        dbError = error
    } else {
        const { error } = await supabaseAdmin
            .from('attendance')
            .insert({ user_id: userId, work_date: today, status: 'present', ...lateFields } as any)
        dbError = error
    }

    if (dbError) return { success: false, error: dbError.message }

    const flags = await getEmailFlags()
    if (flags.email_running_late) {
        const { employeeName, departmentName, notifyEmail } = await getNotifyEmail(userId)
        const dateLabel = new Date(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
        await sendRunningLateEmail({ notifyEmail, employeeName, departmentName, date: dateLabel, reason, expectedArrival, loggedBy: loggedBy || 'Self' }).catch(() => {})
    }

    revalidatePath('/attendance')
    revalidatePath('/timesheets')
    revalidatePath('/reception')
    return { success: true }
}

export async function forceClockOut(recordId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
        .from('attendance')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', recordId)

    if (error) {
        console.error('Error forcing clock out:', error)
        return { success: false, error: 'Failed to clock out user.' }
    }

    revalidatePath('/admin/attendance')
    return { success: true }
}
