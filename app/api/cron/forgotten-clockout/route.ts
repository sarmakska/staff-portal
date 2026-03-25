import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendForgottenClockoutEmail } from '@/lib/email'
import { getEmailFlags } from '@/lib/actions/app-settings'

const RECEPTION_EMAIL = process.env.RECEPTION_NOTIFY_EMAIL ?? 'reception@yourcompany.com'

// Called by GitHub Actions Mon–Fri at 19:00 UK time
// Finds employees who clocked in today but never clocked out
// Sends reminder to employee + reception, logs to forgotten_clockout_alerts

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const flags = await getEmailFlags()
    if (!flags.email_forgotten_clockout) {
        return NextResponse.json({ success: true, skipped: 'email_forgotten_clockout flag is off' })
    }

    const today = new Date().toISOString().split('T')[0]

    // Find attendance rows for today: clocked in but no clock out
    const { data: recordsRaw, error } = await supabaseAdmin
        .from('attendance')
        .select('id, user_id, clock_in, user_profiles!attendance_user_id_fkey(full_name, email, department_id)')
        .eq('work_date', today)
        .not('clock_in', 'is', null)
        .is('clock_out', null)
        .returns<any[]>()

    const records = recordsRaw as any[] | null

    if (error) {
        console.error('[cron/forgotten-clockout] Query error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!records || records.length === 0) {
        console.log('[cron/forgotten-clockout] No forgotten clock-outs today')
        return NextResponse.json({ success: true, sent: 0 })
    }

    // Find which ones already got notified today (avoid duplicates if cron runs twice)
    const userIds = records!.map((r: any) => r.user_id)
    const { data: alreadyNotified } = await (supabaseAdmin as any)
        .from('forgotten_clockout_alerts')
        .select('user_id')
        .eq('work_date', today)
        .in('user_id', userIds)

    const notifiedSet = new Set((alreadyNotified ?? []).map((r: any) => r.user_id))

    let sent = 0
    const newAlerts: { user_id: string; work_date: string }[] = []

    for (const record of records!) {
        if (notifiedSet.has(record.user_id)) continue

        const profile = record.user_profiles
        const employeeEmail = profile?.email
        const employeeName = profile?.full_name ?? employeeEmail ?? 'Unknown'
        const departmentName = 'Your Company'

        if (!employeeEmail) continue

        const clockInTime = new Date(record.clock_in).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/London',
        })
        const workDateLabel = new Date(today).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })

        try {
            await sendForgottenClockoutEmail({
                employeeEmail,
                receptionEmail: RECEPTION_EMAIL,
                employeeName,
                departmentName,
                workDate: workDateLabel,
                clockInTime,
            })
            newAlerts.push({ user_id: record.user_id, work_date: today })
            sent++
        } catch (err) {
            console.error(`[cron/forgotten-clockout] Failed for ${employeeEmail}:`, err)
        }
    }

    // Log alerts to DB for analytics
    if (newAlerts.length > 0) {
        await (supabaseAdmin as any)
            .from('forgotten_clockout_alerts')
            .upsert(newAlerts, { onConflict: 'user_id,work_date' })
    }

    console.log(`[cron/forgotten-clockout] Sent ${sent} alerts for ${today}`)
    return NextResponse.json({ success: true, sent, date: today })
}
