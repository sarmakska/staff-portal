// ============================================================
// GDPR data export — bundle assembly.
// Pure helpers that shape the per-user data export into the
// portable JSON document we hand back under Article 20 (right
// to data portability). The database fetch lives in the route
// handler; the shaping logic lives here so it can be tested
// without a live Supabase project.
// ============================================================

export interface GdprSection {
    table: string
    description: string
    records: unknown[]
}

export interface GdprBundle {
    schemaVersion: string
    generatedAt: string
    subject: {
        userId: string
        email: string
        fullName: string | null
    }
    sections: GdprSection[]
    recordCount: number
}

export interface GdprInput {
    userId: string
    email: string
    fullName: string | null
    generatedAt?: Date
    sources: { table: string; description: string; records: unknown[] | null | undefined }[]
}

export const GDPR_SCHEMA_VERSION = '1.0'

// The set of tables that hold personal data for a staff member.
// Centralised so the export route and the documentation stay in
// step and no personal table is silently forgotten.
export const GDPR_TABLES = [
    'user_profiles',
    'user_roles',
    'attendance',
    'wfh_records',
    'leave_requests',
    'leave_balances',
    'attendance_corrections',
    'expenses',
    'purchase_requests',
    'diary_entries',
    'visitors',
    'feedback',
    'complaints',
    'audit_logs',
] as const

export function buildGdprBundle(input: GdprInput): GdprBundle {
    const generatedAt = (input.generatedAt ?? new Date()).toISOString()

    const sections: GdprSection[] = input.sources.map(s => ({
        table: s.table,
        description: s.description,
        records: Array.isArray(s.records) ? s.records : [],
    }))

    const recordCount = sections.reduce((sum, s) => sum + s.records.length, 0)

    return {
        schemaVersion: GDPR_SCHEMA_VERSION,
        generatedAt,
        subject: {
            userId: input.userId,
            email: input.email,
            fullName: input.fullName,
        },
        sections,
        recordCount,
    }
}

// Suggested download filename for a subject's export.
export function gdprFilename(email: string, generatedAt: Date = new Date()): string {
    const safe = (email || 'user').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const stamp = generatedAt.toISOString().slice(0, 10)
    return `staff-portal-export-${safe}-${stamp}.json`
}
