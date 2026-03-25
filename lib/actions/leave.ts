'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { sendLeaveSubmittedEmail } from '@/lib/email'
import { getEmailFlags } from '@/lib/actions/app-settings'
import { calcWorkingDays } from '@/lib/helpers'

export async function submitLeaveRequest(params: {
    leaveType: string
    startDate: string
    endDate: string
    dayType: string
    reason: string
}): Promise<{ success: boolean; error?: string }> {
    // Validate dates
    const startObj = new Date(params.startDate)
    const endObj = new Date(params.endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (endObj < startObj) {
        return { success: false, error: 'End date cannot be before start date.' }
    }
    if (startObj < today) {
        return { success: false, error: 'Cannot book leave in the past.' }
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Get user profile + department
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email, department_id, departments!user_profiles_department_id_fkey(name)')
        .eq('id', user.id)
        .single()

    if (!profile) return { success: false, error: 'Profile not found' }

    // Calculate days — excludes bank holidays + days not in employee's contracted schedule
    const daysCount = await calcWorkingDays(
        params.startDate,
        params.endDate,
        params.dayType as 'full' | 'half_am' | 'half_pm',
        user.id,
    )

    // Get primary approver — if none set, reject immediately
    const { data: approverRow } = await supabase
        .from('user_approvers')
        .select('approver_id, approver:user_profiles!user_approvers_approver_id_fkey(full_name, email, is_active)')
        .eq('user_id', user.id)
        .eq('priority', 1)
        .single()

    if (!approverRow?.approver_id) {
        return {
            success: false,
            error: 'You have no leave approver set. Please go to Settings → Leave Approvers and add an approver before submitting a request.',
        }
    }

    // Issue #6 fix: check approver is still active
    const approverProfile = approverRow?.approver as { full_name?: string; email?: string; is_active?: boolean } | null
    if (approverProfile?.is_active === false) {
        return {
            success: false,
            error: 'Your designated approver is no longer active. Please go to Settings → Leave Approvers and update your approver.',
        }
    }

    // Check leave balance — use supabaseAdmin to bypass RLS reliably
    const currentYear = new Date(params.startDate).getFullYear()
    const lastYear = currentYear - 1
    const [{ data: balance }, { data: lastYearBal }, { data: userCarryProfile }] = await Promise.all([
        supabaseAdmin
            .from('leave_balances')
            .select('total, used, pending')
            .eq('user_id', user.id)
            .eq('leave_type', params.leaveType as any)
            .eq('year', currentYear)
            .single(),
        supabaseAdmin
            .from('leave_balances')
            .select('total, used, pending')
            .eq('user_id', user.id)
            .eq('leave_type', 'annual' as any)
            .eq('year', lastYear)
            .single(),
        (supabaseAdmin as any)
            .from('user_profiles')
            .select('max_carry_forward, carry_forward_days')
            .eq('id', user.id)
            .single(),
    ])

    // Compute carry the same way the admin Leave Allowances page does
    const maxCarry = userCarryProfile?.max_carry_forward ?? 5
    let annualCarry = 0
    if (lastYearBal) {
        const remaining = Math.max(0, Number(lastYearBal.total) - Number(lastYearBal.used) - Number(lastYearBal.pending))
        annualCarry = Math.min(remaining, maxCarry)
    } else {
        annualCarry = userCarryProfile?.carry_forward_days ?? 0
    }

    // Validate: enough balance remaining? (skip for sick/unpaid which are unrestricted)
    const paidTypes = ['annual']
    if (paidTypes.includes(params.leaveType) && balance) {
        const effectiveTotal = Number(balance.total) + (params.leaveType === 'annual' ? annualCarry : 0)
        const remaining = effectiveTotal - Number(balance.used) - Number(balance.pending)
        if (daysCount > remaining) {
            return {
                success: false,
                error: `Insufficient leave balance. You have ${remaining.toFixed(1)} day(s) remaining but requested ${daysCount}.`,
            }
        }
    }

    // Insert leave request
    const { data: request, error: insertError } = await supabase
        .from('leave_requests')
        .insert({
            user_id: user.id,
            leave_type: params.leaveType as any,
            start_date: params.startDate,
            end_date: params.endDate,
            day_type: params.dayType as any,
            days_count: daysCount,
            reason: params.reason,
            status: 'pending',
            approver_id: approverRow?.approver_id ?? null,
        })
        .select()
        .single()

    if (insertError) return { success: false, error: insertError.message }

    // Update leave balance pending count — use supabaseAdmin to bypass RLS
    if (balance) {
        await supabaseAdmin
            .from('leave_balances')
            .update({ pending: Number(balance.pending) + daysCount })
            .eq('user_id', user.id)
            .eq('leave_type', params.leaveType as any)
            .eq('year', currentYear)
    }

    // Audit log
    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'leave_submitted',
        entityTable: 'leave_requests',
        entityId: request.id,
        afterData: { leave_type: params.leaveType, start_date: params.startDate, end_date: params.endDate, days_count: daysCount },
    })

    // Send email (non-blocking, respects admin toggle)
    if (profile.email) {
        const approverProfile = approverRow?.approver as { full_name?: string; email?: string } | null
        const effectiveTotal = balance ? Number(balance.total) + annualCarry : 0
        const remaining = balance ? Math.max(0, effectiveTotal - Number(balance.used) - Number(balance.pending) - daysCount) : 0
        const flags = await getEmailFlags()

        if (flags.email_leave_submitted) await sendLeaveSubmittedEmail({
            employeeEmail: profile.email,
            employeeName: profile.full_name ?? profile.email,
            leaveType: params.leaveType,
            startDate: params.startDate,
            endDate: params.endDate,
            daysCount,
            reason: params.reason,
            approverName: approverProfile?.full_name ?? 'Your Manager',
            approverEmail: approverProfile?.email ?? '',
            leaveBalanceRemaining: remaining,
        }).catch(console.error)
    }

    return { success: true }
}

export async function withdrawLeave(requestId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Verify ownership and get request details
    const { data: request } = await supabase
        .from('leave_requests')
        .select('*, user:user_profiles!leave_requests_user_id_fkey(full_name, email)')
        .eq('id', requestId)
        .eq('user_id', user.id)
        .single()

    if (!request) {
        return { success: false, error: 'Leave request not found or not authorized.' }
    }

    if (request.status !== 'pending' && request.status !== 'approved') {
        return { success: false, error: 'Only pending or approved requests can be withdrawn.' }
    }

    // Delete the request
    const { error: delError } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', requestId)

    if (delError) {
        return { success: false, error: delError.message }
    }

    // Reverse balance — use supabaseAdmin to bypass RLS
    const currentYear = new Date(request.start_date).getFullYear()
    const { data: balance } = await supabaseAdmin
        .from('leave_balances')
        .select('pending, used')
        .eq('user_id', user.id)
        .eq('leave_type', request.leave_type)
        .eq('year', currentYear)
        .single()

    if (balance) {
        const update = request.status === 'approved'
            ? { used: Math.max(0, Number(balance.used) - Number(request.days_count)) }
            : { pending: Math.max(0, Number(balance.pending) - Number(request.days_count)) }
        await supabaseAdmin
            .from('leave_balances')
            .update(update)
            .eq('user_id', user.id)
            .eq('leave_type', request.leave_type)
            .eq('year', currentYear)
    }

    await writeAuditLog({
        actorId: user.id,
        action: 'user_updated',
        entityTable: 'leave_requests',
        entityId: requestId,
        afterData: { status: 'withdrawn' } as any
    })

    return { success: true }
}
