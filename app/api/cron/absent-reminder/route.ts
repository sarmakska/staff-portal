export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendAbsentReminderEmail } from '@/lib/email'
import { getEmailFlags } from '@/lib/actions/app-settings'
import { fetchBankHolidays } from '@/lib/helpers'
import { isBankHoliday } from '@/lib/schedule-helpers'

// Runs Mon–Fri at 10am UK time (9am UTC during BST, 10am UTC during GMT)
// Sends a reminder to any active staff member who:
//   - has NOT clocked in today
//   - has NO approved leave today
//   - has NOT logged WFH today
//   - has NOT flagged running late today
//   - is NOT a director

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const flags = await getEmailFlags()
    if (!flags.email_absent_reminder) {
        return NextResponse.json({ success: true, skipped: 'email_absent_reminder flag is off' })
    }

    const today = new Date().toISOString().split('T')[0]

    // Skip bank holidays — check gov.uk API first, fall back to hardcoded list
    const govHolidays = await fetchBankHolidays()
    if (govHolidays.has(today) || isBankHoliday(today)) {
        console.log(`[cron/absent-reminder] ${today} is a bank holiday — skipping`)
        return NextResponse.json({ success: true, skipped: 'bank holiday' })
    }

    // 1. All active staff who are NOT excluded from reminders
    const { data: allStaffRaw } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, display_name, email')
        .eq('is_active', true)
        .eq('exclude_from_reminders', false)
        .returns<any[]>()

    const allStaff = (allStaffRaw ?? []) as any[]

    // Get director user IDs
    const { data: directorRolesRaw } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'director')
        .returns<any[]>()

    const directorIds = new Set((directorRolesRaw ?? []).map((r: any) => r.user_id))

    const eligibleStaff = allStaff.filter(s => !directorIds.has(s.id) && s.email)

    if (!eligibleStaff.length) {
        return NextResponse.json({ success: true, sent: 0 })
    }

    const staffIds = eligibleStaff.map(s => s.id)

    // 1b. Check work schedules — skip staff who don't work today
    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const todayCode = dayMap[new Date(today + 'T12:00:00').getDay()]

    const { data: schedulesRaw } = await supabaseAdmin
        .from('work_schedules')
        .select('user_id, work_days')
        .in('user_id', staffIds)
        .returns<any[]>()

    const scheduleMap = new Map<string, string[]>()
    for (const s of (schedulesRaw ?? []) as any[]) {
        scheduleMap.set(s.user_id, s.work_days ?? ['mon', 'tue', 'wed', 'thu', 'fri'])
    }

    const workingToday = eligibleStaff.filter(s => {
        const days = scheduleMap.get(s.id) ?? ['mon', 'tue', 'wed', 'thu', 'fri']
        return days.includes(todayCode)
    })

    if (!workingToday.length) {
        console.log(`[cron/absent-reminder] ${today} (${todayCode}) — no staff scheduled to work`)
        return NextResponse.json({ success: true, sent: 0, date: today, skipped: 'no staff working today' })
    }

    const workingIds = workingToday.map(s => s.id)

    // 2. Who clocked in today
    const { data: attendanceRaw } = await supabaseAdmin
        .from('attendance')
        .select('user_id, running_late')
        .eq('work_date', today)
        .in('user_id', workingIds)
        .returns<any[]>()

    const clockedInIds = new Set<string>()
    const runningLateIds = new Set<string>()
    for (const row of (attendanceRaw ?? []) as any[]) {
        if (row.running_late) runningLateIds.add(row.user_id)
        else clockedInIds.add(row.user_id)
    }

    // 3. Who has approved leave today
    const { data: leaveRaw } = await (supabaseAdmin as any)
        .from('leave_requests')
        .select('user_id')
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today)
        .in('user_id', workingIds)

    const onLeaveIds = new Set<string>((leaveRaw ?? []).map((r: any) => r.user_id))

    // 4. Who has WFH today
    const { data: wfhRaw } = await (supabaseAdmin as any)
        .from('wfh_records')
        .select('user_id')
        .eq('wfh_date', today)
        .in('user_id', workingIds)

    const wfhIds = new Set<string>((wfhRaw ?? []).map((r: any) => r.user_id))

    // 5. Who has leave/holiday on their calendar
    const { data: calLeaveRaw } = await (supabaseAdmin as any)
        .from('calendar_events')
        .select('user_id')
        .in('event_type', ['leave', 'holiday'])
        .lte('event_date', today)
        .or(`event_end_date.gte.${today},and(event_end_date.is.null,event_date.eq.${today})`)
        .in('user_id', workingIds)

    const calLeaveIds = new Set<string>((calLeaveRaw ?? []).map((r: any) => r.user_id))

    // 6. Send to staff who are unaccounted for
    let sent = 0
    const skippedReasons: string[] = []

    for (const staff of workingToday) {
        if (clockedInIds.has(staff.id)) { skippedReasons.push(`${staff.full_name}: clocked in`); continue }
        if (runningLateIds.has(staff.id)) { skippedReasons.push(`${staff.full_name}: running late`); continue }
        if (onLeaveIds.has(staff.id)) { skippedReasons.push(`${staff.full_name}: on leave`); continue }
        if (wfhIds.has(staff.id)) { skippedReasons.push(`${staff.full_name}: WFH`); continue }
        if (calLeaveIds.has(staff.id)) { skippedReasons.push(`${staff.full_name}: calendar leave`); continue }

        const name = staff.display_name || staff.full_name || 'there'
        const firstName = name.split(' ')[0]

        try {
            await sendAbsentReminderEmail({ employeeEmail: staff.email, employeeName: firstName })
            sent++
            console.log(`[cron/absent-reminder] Sent to ${staff.email}`)
        } catch (err) {
            console.error(`[cron/absent-reminder] Failed for ${staff.email}:`, err)
        }
    }

    console.log(`[cron/absent-reminder] ${today} — sent ${sent}, skipped ${skippedReasons.length}`)
    return NextResponse.json({ success: true, sent, date: today, skipped: skippedReasons })
}
