"use server"

import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const DEFAULT_CAP = 5

// ── Auth helper ──────────────────────────────────────────────

async function requireAdminOrAccounts(): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('accounts')) {
        return { ok: false, error: 'Admin or Accounts access required' }
    }
    return { ok: true }
}

// ── Public actions ───────────────────────────────────────────

export interface RolloverPreviewRow {
    userId: string
    name: string
    email: string
    currentTotal: number
    used: number
    pending: number
    remaining: number
    cap: number
    willCarry: number
    nextYearBase: number
    nextYearTotal: number
    alreadyExists: boolean
}

export async function previewYearEndRollover(fromYear: number): Promise<{
    rows: RolloverPreviewRow[]
    toYear: number
    error?: string
}> {
    const auth = await requireAdminOrAccounts()
    if (!auth.ok) return { rows: [], toYear: fromYear + 1, error: auth.error }

    const toYear = fromYear + 1

    // Get all annual leave balances for fromYear
    const { data: balances, error: balErr } = await supabaseAdmin
        .from('leave_balances')
        .select('user_id, total, used, pending, carried_forward')
        .eq('leave_type', 'annual')
        .eq('year', fromYear)

    if (balErr) {
        // Likely means carried_forward column doesn't exist yet
        return { rows: [], toYear, error: 'Database migration pending. Please run migration 013+014 in the Supabase SQL Editor first.' }
    }

    if (!balances || balances.length === 0) {
        return { rows: [], toYear, error: `No annual leave records found for ${fromYear}` }
    }

    // Get next year's existing rows
    const { data: nextYearRows } = await supabaseAdmin
        .from('leave_balances')
        .select('user_id')
        .eq('leave_type', 'annual')
        .eq('year', toYear)

    const nextYearSet = new Set((nextYearRows ?? []).map((r: any) => r.user_id))

    // Get user profiles with per-employee max_carry_forward
    const userIds = balances.map((b: any) => b.user_id)
    const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, email, max_carry_forward')
        .in('id', userIds)
        .order('full_name')

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    const rows: RolloverPreviewRow[] = []

    for (const b of balances as any[]) {
        const profile = profileMap.get(b.user_id)
        if (!profile) continue

        const cap = profile.max_carry_forward ?? DEFAULT_CAP
        const remaining = Math.max(0, b.total - b.used - b.pending)
        const willCarry = Math.min(remaining, cap)
        const nextYearBase = b.total - (b.carried_forward ?? 0)
        const nextYearTotal = nextYearBase + willCarry

        rows.push({
            userId: b.user_id,
            name: profile.full_name ?? profile.email ?? 'Unknown',
            email: profile.email ?? '',
            currentTotal: b.total,
            used: b.used,
            pending: b.pending,
            remaining,
            cap,
            willCarry,
            nextYearBase,
            nextYearTotal,
            alreadyExists: nextYearSet.has(b.user_id),
        })
    }

    rows.sort((a, b) => a.name.localeCompare(b.name))
    return { rows, toYear }
}

export async function runYearEndRollover(fromYear: number): Promise<{ success: boolean; error?: string; count?: number }> {
    const auth = await requireAdminOrAccounts()
    if (!auth.ok) return { success: false, error: auth.error }

    const { rows, error } = await previewYearEndRollover(fromYear)
    if (error) return { success: false, error }

    const toYear = fromYear + 1
    let count = 0

    for (const row of rows) {
        const { error: upsertError } = await supabaseAdmin
            .from('leave_balances')
            .upsert(
                {
                    user_id: row.userId,
                    leave_type: 'annual',
                    year: toYear,
                    total: row.nextYearTotal,
                    carried_forward: row.willCarry,
                    used: 0,
                    pending: 0,
                },
                { onConflict: 'user_id,leave_type,year' }
            )

        if (upsertError) {
            console.error(`Rollover failed for ${row.name}:`, upsertError)
        } else {
            count++
        }
    }

    revalidatePath('/admin/leave')
    return { success: true, count }
}
