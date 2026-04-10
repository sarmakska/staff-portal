// ============================================================
// Audit Log Helper — Server-side only
// Uses service role to write immutable audit entries.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AuditAction } from '@/types/database'
import type { Json } from '@/types/database'

interface AuditLogParams {
    actorId: string | null
    actorEmail?: string | null
    action: AuditAction
    entityTable: string
    entityId?: string | null
    beforeData?: Json
    afterData?: Json
    ipAddress?: string
    userAgent?: string
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
    const { error } = await supabaseAdmin
        .from('audit_logs')
        .insert({
            actor_id: params.actorId,
            actor_email: params.actorEmail ?? null,
            action: params.action,
            entity_table: params.entityTable,
            entity_id: params.entityId ?? null,
            before_data: params.beforeData ?? null,
            after_data: params.afterData ?? null,
            ip_address: params.ipAddress ?? null,
            user_agent: params.userAgent ?? null,
        })

    if (error) {
        // Log but don't throw — audit failure should not break the main operation
        console.error('[AuditLog] Failed to write audit log:', error.message)
    }
}
