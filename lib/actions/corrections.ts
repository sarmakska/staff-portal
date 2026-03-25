'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { sendCorrectionSubmittedEmail, sendCorrectionReviewedEmail } from '@/lib/email'
import { getEmailFlags } from '@/lib/actions/app-settings'
import { revalidatePath } from 'next/cache'

// ── Helpers ──────────────────────────────────────────────────

async function getCallerRoles(userId: string): Promise<string[]> {
    const { data } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId)
    return (data ?? []).map((r: { role: string }) => r.role)
}

async function getReceptionRecipient(): Promise<{ email: string; name: string }> {
    const email = process.env.RECEPTION_NOTIFY_EMAIL ?? 'reception@yourcompany.com'
    const { data } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'reception')
        .limit(1)
    if (data?.[0]) {
        const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('full_name')
            .eq('id', data[0].user_id)
            .single()
        if (profile?.full_name) {
            return { email, name: profile.full_name.split(' ')[0] }
        }
    }
    return { email, name: 'Reception' }
}

// ── Privileged reads (bypass RLS via supabaseAdmin) ──────────

export async function getTeamCorrections(): Promise<{ data: any[]; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: 'Not authenticated' }

    const roles = await getCallerRoles(user.id)
    if (!roles.includes('admin') && !roles.includes('reception')) return { data: [], error: 'Not authorised' }

    const { data, error } = await supabaseAdmin
        .from('attendance_corrections')
        .select('*, attendance(work_date), user:user_profiles!attendance_corrections_user_id_fkey(full_name, email)')
        .eq('status', 'submitted')
        .order('created_at', { ascending: true })
        .limit(50)

    return { data: data ?? [], error: error?.message }
}

export async function getStaffAttendance(targetUserId: string): Promise<{ data: any[]; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: 'Not authenticated' }

    const roles = await getCallerRoles(user.id)
    if (!roles.includes('admin') && !roles.includes('reception')) return { data: [], error: 'Not authorised' }

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const { data, error } = await supabaseAdmin
        .from('attendance')
        .select('id, work_date, clock_in, clock_out, break_start, break_end, total_hours, status')
        .eq('user_id', targetUserId)
        .gte('work_date', since.toISOString().split('T')[0])
        .order('work_date', { ascending: false })
        .limit(30)

    return { data: data ?? [], error: error?.message }
}

// ── Submit correction (employee requests a change) ────────────

export async function submitCorrection(params: {
    workDate: string
    field: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
    proposedValue: string
    reason: string
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: record } = await supabase
        .from('attendance')
        .select('id, clock_in, clock_out, break_start, break_end')
        .eq('user_id', user.id)
        .eq('work_date', params.workDate)
        .single()

    let attendanceId: string
    if (!record) {
        const { data: newRecord, error: createErr } = await supabase
            .from('attendance')
            .insert({ user_id: user.id, work_date: params.workDate, status: 'present' })
            .select('id')
            .single()
        if (createErr || !newRecord) return { success: false, error: createErr?.message ?? 'Could not create attendance record' }
        attendanceId = newRecord.id
    } else {
        attendanceId = record.id
    }

    const originalValue = record ? (record[params.field] as string | null) ?? null : null

    const { data: correction, error } = await supabase
        .from('attendance_corrections')
        .insert({
            attendance_id: attendanceId,
            user_id: user.id,
            field: params.field,
            original_value: originalValue,
            proposed_value: params.proposedValue,
            reason: params.reason,
            status: 'submitted',
        })
        .select()
        .single()

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'correction_submitted',
        entityTable: 'attendance_corrections',
        entityId: correction.id,
        afterData: { field: params.field, work_date: params.workDate, proposed_value: params.proposedValue },
    })

    // Notify reception (fire-and-forget, check flag)
    const [{ data: profile }, flags, reception] = await Promise.all([
        supabase.from('user_profiles').select('full_name, email').eq('id', user.id).single(),
        getEmailFlags(),
        getReceptionRecipient(),
    ])

    if (flags.email_correction_submitted) {
        await sendCorrectionSubmittedEmail({
            employeeName: profile?.full_name ?? user.email ?? 'Unknown',
            employeeEmail: profile?.email ?? user.email ?? '',
            workDate: params.workDate,
            field: params.field,
            originalValue,
            proposedValue: params.proposedValue,
            reason: params.reason,
            recipientName: reception.name,
        }).catch(console.error)
    }

    return { success: true }
}

// ── Direct correction (admin/reception applies without request) ─

export async function directCorrection(params: {
    targetUserId: string
    workDate: string
    field: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
    proposedValue: string
    reason: string
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const roles = await getCallerRoles(user.id)
    if (!roles.includes('admin') && !roles.includes('reception')) {
        return { success: false, error: 'Not authorised' }
    }

    const { data: record } = await supabaseAdmin
        .from('attendance')
        .select('id')
        .eq('user_id', params.targetUserId)
        .eq('work_date', params.workDate)
        .single()

    if (!record) return { success: false, error: 'No attendance record found for that date' }

    // Issue #5 fix: validate time is within reasonable bounds (05:00–23:00)
    if (params.field !== 'break_start' && params.field !== 'break_end') {
        const timeMatch = params.proposedValue.match(/^(\d{2}):(\d{2})/)
        if (timeMatch) {
            const hours = parseInt(timeMatch[1])
            if (hours < 5 || hours >= 23) {
                return { success: false, error: 'Time must be between 05:00 and 23:00' }
            }
        }
    }

    const { error: updateErr } = await supabaseAdmin
        .from('attendance')
        .update({ [params.field]: params.proposedValue })
        .eq('id', record.id)

    if (updateErr) return { success: false, error: updateErr.message }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'direct_correction_applied',
        entityTable: 'attendance',
        entityId: record.id,
        afterData: {
            target_user_id: params.targetUserId,
            field: params.field,
            work_date: params.workDate,
            applied_value: params.proposedValue,
            reason: params.reason,
        },
    })

    revalidatePath('/corrections')
    revalidatePath('/attendance')
    revalidatePath('/timesheets')
    return { success: true }
}

// ── Review correction (approve/reject from Team Queue) ────────

export async function reviewCorrection(params: {
    correctionId: string
    action: 'approve' | 'reject'
    comment?: string
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const roles = await getCallerRoles(user.id)
    if (!roles.includes('admin') && !roles.includes('reception')) {
        return { success: false, error: 'Not authorised' }
    }

    // Fetch correction via admin (bypass RLS)
    const { data: correction } = await supabaseAdmin
        .from('attendance_corrections')
        .select('attendance_id, field, proposed_value, original_value, user_id')
        .eq('id', params.correctionId)
        .single()

    if (!correction) return { success: false, error: 'Correction not found' }

    const { data: reviewerProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    const reviewerName = reviewerProfile?.full_name ?? user.email ?? 'Your manager'

    if (params.action === 'approve') {
        const { data: attendanceRow } = await supabaseAdmin
            .from('attendance')
            .select('work_date')
            .eq('id', correction.attendance_id)
            .single()

        // Normalise legacy "HH:MM" values
        let proposedISO = correction.proposed_value
        if (!proposedISO.includes('T') && attendanceRow?.work_date) {
            const [h, m] = proposedISO.split(':').map(Number)
            const dt = new Date(`${attendanceRow.work_date}T00:00:00.000Z`)
            dt.setUTCHours(h, m, 0, 0)
            proposedISO = dt.toISOString()
        }

        const { error: attendanceError } = await supabaseAdmin
            .from('attendance')
            .update({ [correction.field]: proposedISO })
            .eq('id', correction.attendance_id)

        if (attendanceError) return { success: false, error: attendanceError.message }

        // Mark applied via admin (bypass RLS)
        const { error } = await supabaseAdmin
            .from('attendance_corrections')
            .update({ status: 'applied', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
            .eq('id', params.correctionId)

        if (error) return { success: false, error: error.message }

        await writeAuditLog({
            actorId: user.id,
            actorEmail: user.email ?? '',
            action: 'correction_approved',
            entityTable: 'attendance_corrections',
            entityId: params.correctionId,
            afterData: { status: 'applied', field: correction.field, applied_value: proposedISO, comment: params.comment },
        })

        // Email employee
        const [flags, { data: empProfile }] = await Promise.all([
            getEmailFlags(),
            supabaseAdmin.from('user_profiles').select('full_name, email').eq('id', correction.user_id).single(),
        ])

        if (flags.email_correction_reviewed && empProfile?.email && attendanceRow?.work_date) {
            await sendCorrectionReviewedEmail({
                employeeEmail: empProfile.email,
                employeeName: empProfile.full_name ?? '',
                workDate: attendanceRow.work_date,
                field: correction.field,
                originalValue: correction.original_value,
                proposedValue: proposedISO,
                action: 'approved',
                reviewerName,
                comment: params.comment,
            }).catch(console.error)
        }

        revalidatePath('/corrections')
        revalidatePath('/attendance')
        revalidatePath('/timesheets')
    } else {
        // Mark rejected via admin (bypass RLS)
        const { error } = await supabaseAdmin
            .from('attendance_corrections')
            .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
            .eq('id', params.correctionId)

        if (error) return { success: false, error: error.message }

        await writeAuditLog({
            actorId: user.id,
            actorEmail: user.email ?? '',
            action: 'correction_rejected',
            entityTable: 'attendance_corrections',
            entityId: params.correctionId,
            afterData: { status: 'rejected', comment: params.comment },
        })

        // Fetch work_date for the email
        const { data: attendanceRow } = await supabaseAdmin
            .from('attendance')
            .select('work_date')
            .eq('id', correction.attendance_id)
            .single()

        const [flags, { data: empProfile }] = await Promise.all([
            getEmailFlags(),
            supabaseAdmin.from('user_profiles').select('full_name, email').eq('id', correction.user_id).single(),
        ])

        if (flags.email_correction_reviewed && empProfile?.email && attendanceRow?.work_date) {
            await sendCorrectionReviewedEmail({
                employeeEmail: empProfile.email,
                employeeName: empProfile.full_name ?? '',
                workDate: attendanceRow.work_date,
                field: correction.field,
                originalValue: correction.original_value,
                proposedValue: correction.proposed_value,
                action: 'rejected',
                reviewerName,
                comment: params.comment,
            }).catch(console.error)
        }

        revalidatePath('/corrections')
    }

    return { success: true }
}
