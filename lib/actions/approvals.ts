'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail, sendCorrectionReviewedEmail, sendLeaveSubmittedEmail } from '@/lib/email'
import { getEmailFlags } from '@/lib/actions/app-settings'

export async function approveLeave(leaveId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: leave } = await supabaseAdmin
        .from('leave_requests')
        .select('user_id, days_count, leave_type, approver_id, start_date, end_date, status')
        .eq('id', leaveId)
        .single()

    // Only the designated approver for this request can approve — admin can view/resend but not approve
    if (leave?.approver_id !== user.id) return { success: false, error: 'Not authorised to approve this request' }

    // Prevent double-approval (balance would be incremented twice)
    if (leave?.status === 'approved') return { success: true }

    await supabaseAdmin
        .from('leave_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', leaveId)

    if (leave) {
        const year = new Date(leave.start_date).getFullYear()
        // Use supabaseAdmin to bypass RLS — approver is updating employee's balance
        const { data: balance } = await supabaseAdmin
            .from('leave_balances')
            .select('used, pending, total')
            .eq('user_id', leave.user_id)
            .eq('leave_type', leave.leave_type)
            .eq('year', year)
            .single()

        let newUsed = 0
        let newPending = 0
        if (balance) {
            newUsed = Number(balance.used) + Number(leave.days_count)
            newPending = Math.max(0, Number(balance.pending) - Number(leave.days_count))
            await supabaseAdmin
                .from('leave_balances')
                .update({ used: newUsed, pending: newPending })
                .eq('user_id', leave.user_id)
                .eq('leave_type', leave.leave_type)
                .eq('year', year)
        }

        // Send email — outside balance check so sick/unpaid/maternity get emails too
        const [{ data: employeeProfile }, { data: approverProfile }, { data: accountsUserIds }, { data: lastYearBal }, { data: userCarryProfile }] = await Promise.all([
            supabaseAdmin.from('user_profiles').select('full_name, email').eq('id', leave.user_id).single(),
            supabaseAdmin.from('user_profiles').select('full_name, email').eq('id', user.id).single(),
            supabaseAdmin.from('user_roles').select('user_id').eq('role', 'accounts'),
            supabaseAdmin.from('leave_balances').select('total, used, pending').eq('user_id', leave.user_id).eq('leave_type', 'annual').eq('year', year - 1).single(),
            (supabaseAdmin as any).from('user_profiles').select('max_carry_forward, carry_forward_days').eq('id', leave.user_id).single(),
        ])

        // Compute carry forward the same way the rest of the site does
        const maxCarry = userCarryProfile?.max_carry_forward ?? 5
        let annualCarry = 0
        if (lastYearBal) {
            const lastRemaining = Math.max(0, Number(lastYearBal.total) - Number(lastYearBal.used) - Number(lastYearBal.pending))
            annualCarry = Math.min(lastRemaining, maxCarry)
        } else {
            annualCarry = userCarryProfile?.carry_forward_days ?? 0
        }

        // Get all accounts emails (exclude employee so they don't get a duplicate)
        const accountsEmails: string[] = []
        if (accountsUserIds && accountsUserIds.length > 0) {
            const { data: acctProfiles } = await supabaseAdmin
                .from('user_profiles').select('email').in('id', accountsUserIds.map((r: any) => r.user_id))
            acctProfiles?.forEach((p: any) => {
                if (p.email && p.email !== employeeProfile?.email) accountsEmails.push(p.email)
            })
        }
        if (accountsEmails.length === 0) {
            const fallback = process.env.ACCOUNTS_NOTIFY_EMAIL ?? 'accounts@yourcompany.com'
            if (fallback !== employeeProfile?.email) accountsEmails.push(fallback)
        }

        if (employeeProfile?.email) {
            const effectiveTotal = balance ? Number(balance.total) + (leave.leave_type === 'annual' ? annualCarry : 0) : 0
            const remaining = balance ? Math.max(0, effectiveTotal - newUsed - newPending) : 0
            const flags = await getEmailFlags()
            if (flags.email_leave_approved) await sendLeaveApprovedEmail({
                employeeEmail: employeeProfile.email,
                accountsEmails,
                employeeName: employeeProfile.full_name ?? '',
                leaveType: leave.leave_type,
                startDate: leave.start_date,
                endDate: leave.end_date,
                daysCount: Number(leave.days_count),
                approverName: approverProfile?.full_name ?? 'Your Manager',
                approverEmail: approverProfile?.email ?? user.email ?? '',
                leaveBalanceRemaining: remaining,
            }).catch(console.error)
        }
    }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'leave_approved',
        entityTable: 'leave_requests',
        entityId: leaveId,
        afterData: { status: 'approved' },
    })

    revalidatePath('/manager/approvals')
    revalidatePath('/leave')
    return { success: true }
}

export async function rejectLeave(leaveId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: leave } = await supabaseAdmin
        .from('leave_requests')
        .select('user_id, days_count, leave_type, approver_id, start_date, end_date')
        .eq('id', leaveId)
        .single()

    // Only the designated approver for this request can reject
    if (leave?.approver_id !== user.id) return { success: false, error: 'Not authorised to reject this request' }

    await supabaseAdmin
        .from('leave_requests')
        .update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
        .eq('id', leaveId)

    if (leave) {
        const year = new Date(leave.start_date).getFullYear()
        // Use supabaseAdmin to bypass RLS — approver is updating employee's balance
        const { data: balance } = await supabaseAdmin
            .from('leave_balances')
            .select('pending, total, used')
            .eq('user_id', leave.user_id)
            .eq('leave_type', leave.leave_type)
            .eq('year', year)
            .single()

        let newPending = 0
        if (balance) {
            newPending = Math.max(0, Number(balance.pending) - Number(leave.days_count))
            await supabaseAdmin
                .from('leave_balances')
                .update({ pending: newPending })
                .eq('user_id', leave.user_id)
                .eq('leave_type', leave.leave_type)
                .eq('year', year)
        }

        // Send email — outside balance check so sick/unpaid/maternity get emails too
        const [{ data: employeeProfile }, { data: approverProfile }] = await Promise.all([
            supabaseAdmin.from('user_profiles').select('full_name, email').eq('id', leave.user_id).single(),
            supabaseAdmin.from('user_profiles').select('full_name').eq('id', user.id).single(),
        ])

        if (employeeProfile?.email) {
            const remaining = balance ? Math.max(0, Number(balance.total) - Number(balance.used) - newPending) : 0
            const flags = await getEmailFlags()
            if (flags.email_leave_rejected) await sendLeaveRejectedEmail({
                employeeEmail: employeeProfile.email,
                employeeName: employeeProfile.full_name ?? '',
                leaveType: leave.leave_type,
                startDate: leave.start_date,
                endDate: leave.end_date,
                daysCount: Number(leave.days_count),
                approverName: approverProfile?.full_name ?? 'Your Manager',
                rejectionReason: reason,
                leaveBalanceRemaining: remaining,
            }).catch(console.error)
        }
    }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'leave_rejected',
        entityTable: 'leave_requests',
        entityId: leaveId,
        afterData: { status: 'rejected', rejection_reason: reason },
    })

    revalidatePath('/manager/approvals')
    revalidatePath('/leave')
    return { success: true }
}

export async function approveCorrection(correctionId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: rolesData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('reception')) return { success: false, error: 'Not authorised to approve corrections' }

    // Fetch correction via admin (bypass RLS)
    const { data: correction } = await supabaseAdmin
        .from('attendance_corrections')
        .select('attendance_id, field, proposed_value, original_value, user_id')
        .eq('id', correctionId)
        .single()

    if (!correction) return { success: false, error: 'Correction not found' }

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

    await supabaseAdmin
        .from('attendance')
        .update({ [correction.field]: proposedISO })
        .eq('id', correction.attendance_id)

    // Mark applied via admin (bypass RLS)
    await supabaseAdmin
        .from('attendance_corrections')
        .update({ status: 'applied', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', correctionId)

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'correction_approved',
        entityTable: 'attendance_corrections',
        entityId: correctionId,
        afterData: { status: 'applied', field: correction.field, applied_value: proposedISO },
    })

    // Email employee
    const [flags, { data: reviewerProfile }, { data: empProfile }] = await Promise.all([
        getEmailFlags(),
        supabaseAdmin.from('user_profiles').select('full_name').eq('id', user.id).single(),
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
            reviewerName: reviewerProfile?.full_name ?? user.email ?? 'Your manager',
        }).catch(console.error)
    }

    revalidatePath('/manager/approvals')
    revalidatePath('/corrections')
    revalidatePath('/attendance')
    revalidatePath('/timesheets')
    return { success: true }
}

export async function rejectCorrection(correctionId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: rolesData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('reception')) return { success: false, error: 'Not authorised to reject corrections' }

    // Fetch correction details before rejecting (for email)
    const { data: correction } = await supabaseAdmin
        .from('attendance_corrections')
        .select('attendance_id, field, proposed_value, original_value, user_id')
        .eq('id', correctionId)
        .single()

    // Mark rejected via admin (bypass RLS)
    await supabaseAdmin
        .from('attendance_corrections')
        .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', correctionId)

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'correction_rejected',
        entityTable: 'attendance_corrections',
        entityId: correctionId,
        afterData: { status: 'rejected' },
    })

    // Email employee
    if (correction) {
        const [flags, { data: attendanceRow }, { data: reviewerProfile }, { data: empProfile }] = await Promise.all([
            getEmailFlags(),
            supabaseAdmin.from('attendance').select('work_date').eq('id', correction.attendance_id).single(),
            supabaseAdmin.from('user_profiles').select('full_name').eq('id', user.id).single(),
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
                reviewerName: reviewerProfile?.full_name ?? user.email ?? 'Your manager',
            }).catch(console.error)
        }
    }

    revalidatePath('/manager/approvals')
    revalidatePath('/corrections')
    return { success: true }
}

export async function resendLeaveNotification(leaveId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Admin only
    const { data: rolesData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('director')) return { success: false, error: 'Not authorised' }

    const { data: leave } = await supabaseAdmin
        .from('leave_requests')
        .select('user_id, leave_type, start_date, end_date, days_count, reason, approver_id')
        .eq('id', leaveId)
        .single()

    if (!leave) return { success: false, error: 'Leave request not found' }
    if (!leave.approver_id) return { success: false, error: 'No approver set on this request' }

    const leaveYear = new Date(leave.start_date).getFullYear()
    const [{ data: empProfile }, { data: approverProfile }, { data: balance }, { data: lastYearBalR }, { data: userCarryR }] = await Promise.all([
        supabaseAdmin.from('user_profiles').select('full_name, email').eq('id', leave.user_id).single(),
        supabaseAdmin.from('user_profiles').select('full_name, email').eq('id', leave.approver_id).single(),
        supabaseAdmin.from('leave_balances').select('total, used, pending').eq('user_id', leave.user_id).eq('leave_type', leave.leave_type).eq('year', leaveYear).single(),
        supabaseAdmin.from('leave_balances').select('total, used, pending').eq('user_id', leave.user_id).eq('leave_type', 'annual').eq('year', leaveYear - 1).single(),
        (supabaseAdmin as any).from('user_profiles').select('max_carry_forward, carry_forward_days').eq('id', leave.user_id).single(),
    ])

    if (!empProfile?.email) return { success: false, error: 'Employee email not found' }
    if (!approverProfile?.email) return { success: false, error: 'Approver email not found' }

    const maxCarryR = userCarryR?.max_carry_forward ?? 5
    let annualCarryR = 0
    if (lastYearBalR) {
        const lastRem = Math.max(0, Number(lastYearBalR.total) - Number(lastYearBalR.used) - Number(lastYearBalR.pending))
        annualCarryR = Math.min(lastRem, maxCarryR)
    } else {
        annualCarryR = userCarryR?.carry_forward_days ?? 0
    }
    const effectiveTotalR = balance ? Number(balance.total) + (leave.leave_type === 'annual' ? annualCarryR : 0) : 0
    const remaining = balance ? Math.max(0, effectiveTotalR - Number(balance.used) - Number(balance.pending)) : 0

    await sendLeaveSubmittedEmail({
        employeeEmail: empProfile.email,
        employeeName: empProfile.full_name ?? empProfile.email,
        leaveType: leave.leave_type,
        startDate: leave.start_date,
        endDate: leave.end_date,
        daysCount: Number(leave.days_count),
        reason: leave.reason ?? '',
        approverName: approverProfile.full_name ?? approverProfile.email,
        approverEmail: approverProfile.email,
        leaveBalanceRemaining: remaining,
    })

    return { success: true }
}

export async function resendLeaveApprovalEmail(leaveId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: rolesData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('director')) return { success: false, error: 'Not authorised' }

    const { data: leave } = await supabaseAdmin
        .from('leave_requests')
        .select('user_id, leave_type, start_date, end_date, days_count, approver_id, status')
        .eq('id', leaveId)
        .single()

    if (!leave) return { success: false, error: 'Leave request not found' }
    if (leave.status !== 'approved') return { success: false, error: 'Leave is not approved' }

    const leaveYear = new Date(leave.start_date).getFullYear()
    const [{ data: empProfile }, { data: approverProfile }, { data: balance }, { data: lastYearBal }, { data: userCarry }, { data: accountsUserIds }] = await Promise.all([
        supabaseAdmin.from('user_profiles').select('full_name, email').eq('id', leave.user_id).single(),
        supabaseAdmin.from('user_profiles').select('full_name, email').eq('id', leave.approver_id).single(),
        supabaseAdmin.from('leave_balances').select('total, used, pending').eq('user_id', leave.user_id).eq('leave_type', leave.leave_type).eq('year', leaveYear).single(),
        supabaseAdmin.from('leave_balances').select('total, used, pending').eq('user_id', leave.user_id).eq('leave_type', 'annual').eq('year', leaveYear - 1).single(),
        (supabaseAdmin as any).from('user_profiles').select('max_carry_forward, carry_forward_days').eq('id', leave.user_id).single(),
        supabaseAdmin.from('user_roles').select('user_id').eq('role', 'accounts'),
    ])

    if (!empProfile?.email) return { success: false, error: 'Employee email not found' }

    const maxCarry = userCarry?.max_carry_forward ?? 5
    let annualCarry = 0
    if (lastYearBal) {
        const lastRem = Math.max(0, Number(lastYearBal.total) - Number(lastYearBal.used) - Number(lastYearBal.pending))
        annualCarry = Math.min(lastRem, maxCarry)
    } else {
        annualCarry = userCarry?.carry_forward_days ?? 0
    }
    const effectiveTotal = balance ? Number(balance.total) + (leave.leave_type === 'annual' ? annualCarry : 0) : 0
    const remaining = balance ? Math.max(0, effectiveTotal - Number(balance.used) - Number(balance.pending)) : 0

    const accountsEmails: string[] = []
    if (accountsUserIds && accountsUserIds.length > 0) {
        const { data: acctProfiles } = await supabaseAdmin
            .from('user_profiles').select('email').in('id', accountsUserIds.map((r: any) => r.user_id))
        acctProfiles?.forEach((p: any) => {
            if (p.email && p.email !== empProfile.email) accountsEmails.push(p.email)
        })
    }
    if (accountsEmails.length === 0) {
        const fallback = process.env.ACCOUNTS_NOTIFY_EMAIL ?? 'accounts@yourcompany.com'
        if (fallback !== empProfile.email) accountsEmails.push(fallback)
    }

    await sendLeaveApprovedEmail({
        employeeEmail: empProfile.email,
        accountsEmails,
        employeeName: empProfile.full_name ?? empProfile.email,
        leaveType: leave.leave_type,
        startDate: leave.start_date,
        endDate: leave.end_date,
        daysCount: Number(leave.days_count),
        approverName: approverProfile?.full_name ?? 'Your Manager',
        approverEmail: approverProfile?.email ?? '',
        leaveBalanceRemaining: remaining,
    })

    return { success: true }
}
