export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { buildGdprBundle, gdprFilename, assertGdprCoverage } from '@/lib/gdpr'

// GDPR Article 20 — right to data portability.
// A signed-in member can export their own personal data as a single
// portable JSON document. Admins may export any user by passing
// ?userId=<id>. Every export is recorded in the audit log.

// Each entry pairs a table with the column it is keyed on and a
// human-readable description for the exported document.
const SOURCES: { table: string; column: string; description: string }[] = [
    { table: 'user_profiles', column: 'id', description: 'Profile, contact details and work settings.' },
    { table: 'user_roles', column: 'user_id', description: 'Roles assigned to your account.' },
    { table: 'attendance', column: 'user_id', description: 'Clock in and clock out records.' },
    { table: 'wfh_records', column: 'user_id', description: 'Work-from-home declarations.' },
    { table: 'leave_requests', column: 'user_id', description: 'Leave requests and their status.' },
    { table: 'leave_balances', column: 'user_id', description: 'Leave entitlements and balances.' },
    { table: 'attendance_corrections', column: 'user_id', description: 'Attendance correction requests.' },
    { table: 'expenses', column: 'user_id', description: 'Expense claims you have submitted.' },
    { table: 'purchase_requests', column: 'user_id', description: 'Purchase requests you have submitted.' },
    { table: 'diary_entries', column: 'user_id', description: 'Personal diary notes.' },
    { table: 'visitors', column: 'host_user_id', description: 'Visits you have hosted.' },
    { table: 'feedback', column: 'user_id', description: 'Feedback you have submitted.' },
    { table: 'complaints', column: 'user_id', description: 'Complaints you have submitted.' },
    { table: 'audit_logs', column: 'actor_id', description: 'System events attributed to your account.' },
]

// Fail fast if a personal-data table declared in GDPR_TABLES is not
// wired into SOURCES above. This keeps the documented set of personal
// data and the data actually exported in lockstep.
assertGdprCoverage(SOURCES.map(s => s.table))

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedId = searchParams.get('userId')

    // Resolve the subject. By default a user exports their own data.
    let subjectId = user.id
    if (requestedId && requestedId !== user.id) {
        const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
        const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
        if (!roles.includes('admin')) {
            return NextResponse.json({ error: 'Only administrators can export another user.' }, { status: 403 })
        }
        subjectId = requestedId
    }

    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('email, full_name')
        .eq('id', subjectId)
        .single()

    // Pull every personal-data table for the subject in parallel.
    const fetched = await Promise.all(
        SOURCES.map(async (s) => {
            const { data, error } = await (supabaseAdmin as any)
                .from(s.table)
                .select('*')
                .eq(s.column, subjectId)
            if (error) {
                console.error(`[gdpr] Failed to read ${s.table}:`, error.message)
            }
            return { table: s.table, description: s.description, records: data ?? [] }
        }),
    )

    const generatedAt = new Date()
    const bundle = buildGdprBundle({
        userId: subjectId,
        email: profile?.email ?? user.email ?? '',
        fullName: profile?.full_name ?? null,
        generatedAt,
        sources: fetched,
    })

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: 'gdpr_export',
        entityTable: 'user_profiles',
        entityId: subjectId,
        afterData: { record_count: bundle.recordCount, self: subjectId === user.id } as never,
    })

    const filename = gdprFilename(profile?.email ?? user.email ?? 'user', generatedAt)

    return new NextResponse(JSON.stringify(bundle, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    })
}
