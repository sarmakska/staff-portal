import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_CAP = 5

// Vercel Cron: runs automatically on Jan 1st at 00:05 UTC
// Schedule set in vercel.json

export async function GET(request: Request) {
    // Verify the request is from Vercel Cron (or a secure internal call)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    // Rollover: previous year → current year
    const fromYear = now.getFullYear() - 1
    const toYear = now.getFullYear()

    try {
        // Get all annual leave balances from previous year
        const { data: balances, error: balErr } = await supabaseAdmin
            .from('leave_balances')
            .select('user_id, total, used, pending, carried_forward')
            .eq('leave_type', 'annual')
            .eq('year', fromYear)

        if (balErr || !balances || balances.length === 0) {
            console.log(`[cron/year-end-rollover] No annual balances for ${fromYear}`)
            return NextResponse.json({ success: true, count: 0, message: `No data for ${fromYear}` })
        }

        // Get per-employee max carry caps
        const userIds = balances.map((b: any) => b.user_id)
        const { data: profiles } = await supabaseAdmin
            .from('user_profiles')
            .select('id, max_carry_forward')
            .in('id', userIds)

        const capMap = new Map(
            (profiles ?? []).map((p: any) => [p.id, p.max_carry_forward ?? DEFAULT_CAP])
        )

        let count = 0
        for (const b of balances as any[]) {
            const cap = capMap.get(b.user_id) ?? DEFAULT_CAP
            const remaining = Math.max(0, b.total - b.used - b.pending)
            const willCarry = Math.min(remaining, cap)
            const nextYearBase = b.total - (b.carried_forward ?? 0)
            const nextYearTotal = nextYearBase + willCarry

            const { error } = await supabaseAdmin
                .from('leave_balances')
                .upsert(
                    {
                        user_id: b.user_id,
                        leave_type: 'annual',
                        year: toYear,
                        total: nextYearTotal,
                        carried_forward: willCarry,
                        used: 0,
                        pending: 0,
                    },
                    { onConflict: 'user_id,leave_type,year' }
                )

            if (!error) count++
            else console.error(`[cron] Rollover failed for user ${b.user_id}:`, error)
        }

        console.log(`[cron/year-end-rollover] Rolled over ${count}/${balances.length} employees from ${fromYear} to ${toYear}`)
        return NextResponse.json({ success: true, count, fromYear, toYear })
    } catch (err) {
        console.error('[cron/year-end-rollover] Error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
