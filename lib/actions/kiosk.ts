'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'

// Returns an error string if WFH blocks clock-in, null if allowed
async function checkWfhBlock(userId: string, today: string): Promise<string | null> {
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

    // Get current UK hour
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

export async function authenticateKioskPin(pin: string): Promise<{
    success: boolean
    user?: { id: string; full_name: string; is_clocked_in: boolean; wfh_block?: string }
    error?: string
}> {
    if (!pin || pin.trim().length !== 4) return { success: false, error: 'Invalid PIN. Must be 4 digits.' }

    // Find user by PIN using Admin client to bypass RLS
    const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, is_active')
        .eq('kiosk_pin', pin.trim())
        .limit(1)

    if (!profiles || profiles.length === 0) {
        return { success: false, error: 'Incorrect PIN' }
    }

    const user = profiles[0]
    if (!user.is_active) {
        return { success: false, error: 'Account is inactive' }
    }

    // Check if currently clocked in today
    const today = new Date().toISOString().split('T')[0]
    const { data: attendance } = await supabaseAdmin
        .from('attendance')
        .select('clock_in, clock_out')
        .eq('user_id', user.id)
        .eq('work_date', today)
        .limit(1)

    const isClockedIn = attendance && attendance.length > 0 && attendance[0].clock_in && !attendance[0].clock_out

    // Check WFH block so kiosk can show the right message upfront
    const wfhBlock = !isClockedIn ? await checkWfhBlock(user.id, today) : null

    return {
        success: true,
        user: {
            id: user.id,
            full_name: user.full_name,
            is_clocked_in: !!isClockedIn,
            wfh_block: wfhBlock ?? undefined,
        }
    }
}

export async function submitKioskAttendance(userId: string, action: 'in' | 'out'): Promise<{
    success: boolean
    error?: string
}> {
    const today = new Date().toISOString().split('T')[0]
    const nowISO = new Date().toISOString()

    if (action === 'in') {
        const wfhBlock = await checkWfhBlock(userId, today)
        if (wfhBlock) return { success: false, error: wfhBlock }

        const { error } = await supabaseAdmin.from('attendance').upsert({
            user_id: userId,
            work_date: today,
            clock_in: nowISO
        }, { onConflict: 'user_id, work_date' })

        if (error) return { success: false, error: error.message }
    } else {
        // Clock out logic - calculate hours
        const { data: record, error: fetchErr } = await supabaseAdmin
            .from('attendance')
            .select('clock_in')
            .eq('user_id', userId)
            .eq('work_date', today)
            .single()

        if (fetchErr || !record || !record.clock_in) return { success: false, error: 'No clock-in record found for today' }

        // Calc total hours
        const clockInDate = new Date(record.clock_in)
        const clockOutDate = new Date(nowISO)
        let diffHours = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60)

        const { error: updErr } = await supabaseAdmin
            .from('attendance')
            .update({
                clock_out: nowISO,
                total_hours: parseFloat(diffHours.toFixed(2))
            })
            .eq('user_id', userId)
            .eq('work_date', today)

        if (updErr) return { success: false, error: updErr.message }
    }

    await writeAuditLog({
        actorId: userId,
        actorEmail: 'kiosk',
        action: action === 'in' ? 'kiosk_clock_in' : 'kiosk_clock_out',
        entityTable: 'attendance',
        entityId: userId,
        afterData: { action, time: nowISO }
    })

    return { success: true }
}
