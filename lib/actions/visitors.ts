'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { generateVisitorReferenceCode } from '@/lib/helpers'
import { sendVisitorBookingEmail } from '@/lib/email'

export async function lookupVisitorByName(name: string): Promise<{
    found: boolean
    visitors?: { id: string; visitor_name: string; company: string | null; host_name: string }[]
    error?: string
}> {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabaseAdmin
        .from('visitors')
        .select('id, visitor_name, company, status, host:user_profiles!visitors_host_user_id_fkey(full_name)')
        .eq('visit_date', today)
        .eq('status', 'booked')
        .ilike('visitor_name', `%${name.trim()}%`)
        .limit(5)

    if (!data || data.length === 0) return { found: false, error: 'No booking found for that name today' }

    return {
        found: true,
        visitors: data.map((v: any) => ({
            id: v.id,
            visitor_name: v.visitor_name,
            company: v.company,
            host_name: v.host?.full_name ?? '—',
        })),
    }
}

export async function lookupVisitorByRef(refCode: string): Promise<{
    found: boolean
    visitor?: { id: string; visitor_name: string; company: string | null; host_name: string; status: string }
    error?: string
}> {
    const { data: visitor } = await supabaseAdmin
        .from('visitors')
        .select('id, visitor_name, company, status, host:user_profiles!visitors_host_user_id_fkey(full_name)')
        .eq('reference_code', refCode.trim().toUpperCase())
        .eq('visit_date', new Date().toISOString().split('T')[0])
        .single()

    if (!visitor) return { found: false, error: 'Reference code not found for today' }
    if (visitor.status === 'checked_in') return { found: false, error: 'Already checked in' }
    if (visitor.status === 'cancelled') return { found: false, error: 'Booking has been cancelled' }

    return {
        found: true,
        visitor: {
            id: visitor.id,
            visitor_name: visitor.visitor_name,
            company: visitor.company,
            host_name: (visitor.host as any)?.full_name ?? '—',
            status: visitor.status,
        },
    }
}

export async function checkinVisitor(visitorId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
        .from('visitors')
        .update({
            status: 'checked_in',
            checked_in_at: new Date().toISOString(),
        })
        .eq('id', visitorId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: null,
        actorEmail: 'kiosk',
        action: 'visitor_checked_in',
        entityTable: 'visitors',
        entityId: visitorId,
        afterData: { status: 'checked_in' },
    })

    return { success: true }
}

export async function getStaffForKiosk(): Promise<{ id: string; full_name: string; is_clocked_in: boolean; is_wfh: boolean }[]> {
    const todayStr = new Date().toISOString().split('T')[0]

    // 1. Get all staff enabled for kiosk
    const { data: staff } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .eq('show_on_kiosk', true)
        .order('full_name')

    if (!staff) return []

    // 2. Get today's attendance and WFH records in parallel
    const [{ data: attendance }, { data: wfhRecords }] = await Promise.all([
        supabaseAdmin.from('attendance').select('user_id, clock_in, clock_out').eq('work_date', todayStr),
        supabaseAdmin.from('wfh_records').select('user_id').eq('wfh_date', todayStr),
    ])

    const attendanceMap = new Map(attendance?.map(a => [a.user_id, a]) || [])
    const wfhSet = new Set(wfhRecords?.map((w: any) => w.user_id) || [])

    return staff.map(s => {
        const todayRecord = attendanceMap.get(s.id)
        const is_clocked_in = !!(todayRecord && todayRecord.clock_in && !todayRecord.clock_out)
        return {
            id: s.id,
            full_name: s.full_name,
            is_clocked_in,
            is_wfh: wfhSet.has(s.id),
        }
    })
}

export async function getAllStaffForKioskSettings(): Promise<{ id: string; full_name: string; show_on_kiosk: boolean; kiosk_pin: string | null }[]> {
    const { data } = await (supabaseAdmin as any)
        .from('user_profiles')
        .select('id, full_name, show_on_kiosk, kiosk_pin')
        .eq('is_active', true)
        .order('full_name')
    return data ?? []
}

export async function setKioskPinForUser(userId: string, pin: string): Promise<{ success: boolean; error?: string }> {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorised' }
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('reception')) return { success: false, error: 'Unauthorised' }
    if (pin && !/^\d{4,6}$/.test(pin)) return { success: false, error: 'PIN must be 4-6 digits' }
    const { error } = await (supabaseAdmin as any)
        .from('user_profiles')
        .update({ kiosk_pin: pin || null })
        .eq('id', userId)
    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function toggleKioskVisibility(userId: string, show: boolean): Promise<{ success: boolean; error?: string }> {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorised' }
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('reception')) return { success: false, error: 'Unauthorised' }

    const { error } = await (supabaseAdmin as any)
        .from('user_profiles')
        .update({ show_on_kiosk: show })
        .eq('id', userId)
    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function getActiveVisitorsForCheckout(): Promise<{ id: string; visitor_name: string; company: string | null; host_name: string }[]> {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data } = await supabaseAdmin
        .from('visitors')
        .select('id, visitor_name, company, host:user_profiles!visitors_host_user_id_fkey(full_name)')
        .eq('visit_date', todayStr)
        .eq('status', 'checked_in')
        .order('visitor_name')

    if (!data) return []

    return data.map((v: any) => ({
        id: v.id,
        visitor_name: v.visitor_name,
        company: v.company,
        host_name: v.host?.full_name || 'Unknown Host',
    }))
}

export async function checkoutVisitor(visitorId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
        .from('visitors')
        .update({
            status: 'checked_out',
            checked_out_at: new Date().toISOString(),
        })
        .eq('id', visitorId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: null,
        actorEmail: 'kiosk',
        action: 'visitor_checked_out',
        entityTable: 'visitors',
        entityId: visitorId,
        afterData: { status: 'checked_out' },
    })

    return { success: true }
}

export async function registerWalkInVisitor(params: {
    visitor_name: string
    visitor_email?: string
    visitor_phone?: string
    company?: string
    host_user_id: string
}): Promise<{ success: boolean; visitorId?: string; error?: string }> {
    const today = new Date().toISOString().split('T')[0]
    const nowISO = new Date().toISOString()
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false })
    const refCode = await generateVisitorReferenceCode(today)

    const { data: v, error } = await supabaseAdmin
        .from('visitors')
        .insert({
            host_user_id: params.host_user_id,
            visitor_name: params.visitor_name,
            visitor_email: params.visitor_email || "",
            visitor_phone: params.visitor_phone || null,
            company: params.company || null,
            purpose: 'Walk-In Meeting',
            visit_date: today,
            time_window_start: nowTime,
            time_window_end: '23:59:00',
            reference_code: refCode,
            status: 'checked_in',
            checked_in_at: nowISO,
        })
        .select()
        .single()

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: null,
        actorEmail: 'kiosk',
        action: 'visitor_checked_in', // Audit as normal check-in
        entityTable: 'visitors',
        entityId: v.id,
        afterData: { status: 'checked_in', reference_code: refCode },
    })

    return { success: true, visitorId: v.id }
}

export async function bookVisitor(params: {
    visitorName: string
    visitorEmail: string
    company: string
    purpose: string
    visitDate: string
    timeWindowStart: string
    timeWindowEnd: string
    guestCount: number
    requiresId: boolean
    accessibilityNotes: string
    sendConfirmationEmail: boolean
}): Promise<{ success: boolean; referenceCode?: string; visitorId?: string; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Generate unique reference code
    const referenceCode = await generateVisitorReferenceCode(params.visitDate)

    // Insert visitor record
    const { data: visitor, error } = await supabaseAdmin
        .from('visitors')
        .insert({
            host_user_id: user.id,
            visitor_name: params.visitorName,
            visitor_email: params.visitorEmail,
            company: params.company || null,
            purpose: params.purpose,
            visit_date: params.visitDate,
            time_window_start: params.timeWindowStart,
            time_window_end: params.timeWindowEnd,
            guest_count: params.guestCount,
            requires_id: params.requiresId,
            accessibility_notes: params.accessibilityNotes || null,
            reference_code: referenceCode,
            status: 'booked',
        })
        .select()
        .single()

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'visitor_booked',
        entityTable: 'visitors',
        entityId: visitor.id,
        afterData: { visitor_name: params.visitorName, visit_date: params.visitDate, reference_code: referenceCode },
    })

    // Send booking confirmation email to the visitor (only if opted in)
    if (params.sendConfirmationEmail && params.visitorEmail) {
        const { data: hostProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('full_name, display_name')
            .eq('id', user.id)
            .single()
        const hostName = (hostProfile as any)?.display_name || (hostProfile as any)?.full_name || 'Your Host'
        const visitDateFmt = new Date(params.visitDate + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        const timeWindowFmt = `${params.timeWindowStart.slice(0, 5)} – ${params.timeWindowEnd.slice(0, 5)}`
        await sendVisitorBookingEmail({
            visitorEmail: params.visitorEmail,
            visitorName: params.visitorName,
            hostName,
            visitDate: visitDateFmt,
            timeWindow: timeWindowFmt,
            referenceCode,
            purpose: params.purpose,
            company: params.company || undefined,
        })
    }

    return { success: true, referenceCode, visitorId: visitor.id }
}

export async function deleteVisitor(visitorId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('reception')) {
        return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabaseAdmin.from('visitors').delete().eq('id', visitorId)
    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'visitor_cancelled',
        entityTable: 'visitors',
        entityId: visitorId,
    })

    return { success: true }
}
