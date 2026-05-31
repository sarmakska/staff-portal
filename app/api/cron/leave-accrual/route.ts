export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { computeAccrual, accrualStamp } from '@/lib/leave-accrual'

// Vercel Cron: runs on the first of every month at 00:10 UTC.
// Schedule set in vercel.json. Tops every accruing leave balance up
// by its monthly accrual_rate, capped at the configured total.

interface BalanceRow {
    id: string
    user_id: string
    leave_type: string
    total: number
    accrual_rate: number
    accrued_to_date: number
    last_accrued_on: string | null
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const asOf = new Date()
    const year = asOf.getFullYear()

    try {
        const { data: balances, error } = await (supabaseAdmin as any)
            .from('leave_balances')
            .select('id, user_id, leave_type, total, accrual_rate, accrued_to_date, last_accrued_on')
            .eq('year', year)
            .gt('accrual_rate', 0)

        if (error) {
            console.error('[cron/leave-accrual] Query failed:', error.message)
            return NextResponse.json({ error: 'Query failed' }, { status: 500 })
        }
        if (!balances || balances.length === 0) {
            return NextResponse.json({ success: true, count: 0, granted: 0 })
        }

        const stamp = accrualStamp(asOf)
        let count = 0
        let granted = 0

        for (const balance of balances as BalanceRow[]) {
            const result = computeAccrual({
                accrualRate: Number(balance.accrual_rate),
                accruedToDate: Number(balance.accrued_to_date),
                lastAccruedOn: balance.last_accrued_on,
                asOf,
                annualCap: Number(balance.total),
            })
            if (result.daysToGrant <= 0) continue

            const { error: updErr } = await (supabaseAdmin as any)
                .from('leave_balances')
                .update({
                    total: balance.total + result.daysToGrant,
                    accrued_to_date: result.newAccruedToDate,
                    last_accrued_on: stamp,
                })
                .eq('id', balance.id)

            if (updErr) {
                console.error(`[cron/leave-accrual] Failed for ${balance.id}:`, updErr.message)
                continue
            }
            count++
            granted += result.daysToGrant

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
                } as never,
            })
        }

        console.log(`[cron/leave-accrual] Topped up ${count} balances, granted ${granted.toFixed(2)} days`)
        return NextResponse.json({ success: true, count, granted: Math.round(granted * 100) / 100 })
    } catch (err) {
        console.error('[cron/leave-accrual] Error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
