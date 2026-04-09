export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendMissingAttendanceEmail, sendMissingAttendanceAccountsEmail } from '@/lib/email'
import { getEmailFlags } from '@/lib/actions/app-settings'
import { fetchBankHolidays } from '@/lib/helpers'
import { isBankHoliday } from '@/lib/schedule-helpers'

// Runs Mon–Fri at 7pm UK time
// Finds staff with NO record for the day (no clock-in, no leave, no calendar leave, no WFH)
// Sends personal email to each + summary to accounts

const ACCOUNTS_EMAIL = process.env.ACCOUNTS_NOTIFY_EMAIL ?? 'accounts@yourcompany.com'

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const flags = await getEmailFlags()
    if (!flags.email_missing_attendance) {
        return NextResponse.json({ success: true, skipped: 'email_missing_attendance flag is off' })
    }

    const today = new Date().toISOString().split('T')[0]
    const todayLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

    // Skip bank holidays
    const govHolidays = await fetchBankHolidays()
    if (govHolidays.has(today) || isBankHoliday(today)) {
        console.log(`[cron/missing-attendance] ${today} is a bank holiday — skipping`)
        return NextResponse.json({ success: true, skipped: 'bank holiday' })
    }

    // 1. All active staff who are NOT directors and NOT excluded from reminders
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

    // Filter out staff who don't work today
    const workingToday = eligibleStaff.filter(s => {
        const days = scheduleMap.get(s.id) ?? ['mon', 'tue', 'wed', 'thu', 'fri']
        return days.includes(todayCode)
    })

    if (!workingToday.length) {
        console.log(`[cron/missing-attendance] ${today} (${todayCode}) — no staff scheduled to work`)
        return NextResponse.json({ success: true, sent: 0, date: today, skipped: 'no staff working today' })
    }

    const workingIds = workingToday.map(s => s.id)

    // 2. Who clocked in today (any attendance record)
    const { data: attendanceRaw } = await supabaseAdmin
        .from('attendance')
        .select('user_id')
        .eq('work_date', today)
        .in('user_id', workingIds)
        .returns<any[]>()

    const clockedInIds = new Set<string>((attendanceRaw ?? []).map((r: any) => r.user_id))

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

    // 6. Get reception name
    const { data: receptionRaw } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'reception')
        .returns<any[]>()

    let receptionName = 'Reception'
    if (receptionRaw?.length) {
        const { data: recProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('full_name')
            .eq('id', receptionRaw[0].user_id)
            .eq('is_active', true)
            .single()
        if (recProfile?.full_name) receptionName = recProfile.full_name
    }

    // 7. Find completely unaccounted staff
    const missing: { name: string; firstName: string; email: string; fullName: string }[] = []

    for (const staff of workingToday) {
        if (clockedInIds.has(staff.id)) continue
        if (onLeaveIds.has(staff.id)) continue
        if (wfhIds.has(staff.id)) continue
        if (calLeaveIds.has(staff.id)) continue

        const name = staff.display_name || staff.full_name || 'there'
        missing.push({
            name,
            firstName: name.split(' ')[0],
            email: staff.email,
            fullName: staff.full_name,
        })
    }

    if (missing.length === 0) {
        console.log(`[cron/missing-attendance] ${today} — no missing records`)
        return NextResponse.json({ success: true, sent: 0, date: today })
    }

    // 8. Send individual emails
    let sent = 0
    for (const person of missing) {
        try {
            await sendMissingAttendanceEmail({
                employeeEmail: person.email,
                employeeName: person.firstName,
                dateLabel: todayLabel,
                receptionName,
            })
            sent++
            console.log(`[cron/missing-attendance] Sent to ${person.email}`)
        } catch (err) {
            console.error(`[cron/missing-attendance] Failed for ${person.email}:`, err)
        }
    }

    // 9. Send accounts summary
    try {
        const names = missing.map(m => m.fullName)
        await sendMissingAttendanceAccountsEmail({
            accountsEmail: ACCOUNTS_EMAIL,
            dateLabel: todayLabel,
            missingNames: names,
        })
        console.log(`[cron/missing-attendance] Accounts summary sent (${names.length} missing)`)
    } catch (err) {
        console.error(`[cron/missing-attendance] Failed to send accounts summary:`, err)
    }

    console.log(`[cron/missing-attendance] ${today} — sent ${sent} individual + accounts summary`)
    return NextResponse.json({ success: true, sent, missing: missing.map(m => m.fullName), date: today })
}
