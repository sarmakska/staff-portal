'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'
import { computeAccrual, accrualStamp, type AccrualResult } from '@/lib/leave-accrual'
import { revalidatePath } from 'next/cache'

// ── Auth helper ──────────────────────────────────────────────

async function requireAdminOrAccounts(): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
    if (!roles.includes('admin') && !roles.includes('accounts')) {
        return { ok: false, error: 'Admin or Accounts access required' }
    }
    return { ok: true }
}

export interface AccrualPreviewRow {
    userId: string
    name: string
    email: string
    leaveType: string
    accrualRate: number
    currentTotal: number
    daysToGrant: number
    newTotal: number
}

interface BalanceRow {
    id: string
    user_id: string
    leave_type: string
    total: number
    accrual_rate: number
    accrued_to_date: number
    last_accrued_on: string | null
}

// Shared core: walk every accruing balance for the year and compute
// the grant. Returns the rows plus the per-balance accrual results so
// the runner can persist them without recomputing.
async function gatherAccruals(year: number, asOf: Date): Promise<{
    rows: AccrualPreviewRow[]
    plan: { balance: BalanceRow; result: AccrualResult }[]
    error?: string
}> {
    const { data: balances, error } = await (supabaseAdmin as any)
        .from('leave_balances')
        .select('id, user_id, leave_type, total, accrual_rate, accrued_to_date, last_accrued_on')
        .eq('year', year)
        .gt('accrual_rate', 0)

    if (error) {
        return { rows: [], plan: [], error: 'Database migration pending. Run migration 025 in the Supabase SQL Editor first.' }
    }
    if (!balances || balances.length === 0) {
        return { rows: [], plan: [] }
    }

    const userIds = [...new Set((balances as BalanceRow[]).map(b => b.user_id))]
    const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds)

    const profileMap = new Map((profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p]))

    const rows: AccrualPreviewRow[] = []
    const plan: { balance: BalanceRow; result: AccrualResult }[] = []

    for (const balance of balances as BalanceRow[]) {
        // The annual cap is the configured total: accrual tops the
        // balance up towards its full entitlement but never beyond it.
        const annualCap = Number(balance.total)
        const result = computeAccrual({
            accrualRate: Number(balance.accrual_rate),
            accruedToDate: Number(balance.accrued_to_date),
            lastAccruedOn: balance.last_accrued_on,
            asOf,
            annualCap,
        })

        if (result.daysToGrant <= 0) continue

        const profile = profileMap.get(balance.user_id)
        rows.push({
            userId: balance.user_id,
            name: profile?.full_name ?? profile?.email ?? 'Unknown',
            email: profile?.email ?? '',
            leaveType: balance.leave_type,
            accrualRate: Number(balance.accrual_rate),
            currentTotal: Number(balance.total),
            daysToGrant: result.daysToGrant,
            newTotal: Number(balance.total),
        })
        plan.push({ balance, result })
    }

    rows.sort((a, b) => a.name.localeCompare(b.name))
    return { rows, plan }
}

// Admin preview: what the accrual job would grant if run now.
export async function previewAccruals(year?: number): Promise<{
    rows: AccrualPreviewRow[]
    year: number
    error?: string
}> {
    const auth = await requireAdminOrAccounts()
    const targetYear = year ?? new Date().getFullYear()
    if (!auth.ok) return { rows: [], year: targetYear, error: auth.error }

    const { rows, error } = await gatherAccruals(targetYear, new Date())
    return { rows, year: targetYear, error }
}

// Run the accrual for every accruing balance in the given year.
// Idempotent within a calendar month: re-running on the same day
// grants nothing further because accrued_to_date already covers it.
export async function runAccruals(year?: number, asOf: Date = new Date()): Promise<{
    success: boolean
    error?: string
    granted?: number
    count?: number
}> {
    const auth = await requireAdminOrAccounts()
    if (!auth.ok) return { success: false, error: auth.error }

    const targetYear = year ?? asOf.getFullYear()
    const { plan, error } = await gatherAccruals(targetYear, asOf)
    if (error) return { success: false, error }

    const stamp = accrualStamp(asOf)
    let granted = 0
    let count = 0

    for (const { balance, result } of plan) {
        const { error: updErr } = await (supabaseAdmin as any)
            .from('leave_balances')
            .update({
                total: balance.total + result.daysToGrant,
                accrued_to_date: result.newAccruedToDate,
                last_accrued_on: stamp,
            })
            .eq('id', balance.id)

        if (updErr) {
            console.error(`[accrual] Failed for balance ${balance.id}:`, updErr.message)
            continue
        }
        granted += result.daysToGrant
        count++

        await writeAuditLog({
            actorId: balance.user_id,
            actorEmail: 'system',
            action: 'leave_accrued',
            entityTable: 'leave_balances',
            entityId: balance.id,
            afterData: {
                leave_type: balance.leave_type,
                granted: result.daysToGrant,
                months: result.monthsCredited,
                accrued_to_date: result.newAccruedToDate,
            } as never,
        })
    }

    revalidatePath('/admin/leave')
    return { success: true, granted: Math.round(granted * 100) / 100, count }
}
