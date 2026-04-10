'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import type { CalendarEventType } from '@/types/database'

export async function createCalendarEvent(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim() || null
    const eventDate = String(formData.get('event_date') ?? '').trim()
    const eventEndDate = String(formData.get('event_end_date') ?? '').trim() || null
    const eventType = String(formData.get('event_type') ?? 'team') as CalendarEventType
    const isCompanyWide = formData.get('is_company_wide') === 'true'

    if (!title) return { success: false, error: 'Title is required' }
    if (!eventDate) return { success: false, error: 'Date is required' }

    const { data: event, error } = await supabase
        .from('calendar_events')
        .insert({
            user_id: user.id,
            title,
            description,
            event_date: eventDate,
            event_end_date: eventEndDate || null,
            event_type: eventType,
            is_all_day: true,
            is_company_wide: isCompanyWide,
        })
        .select()
        .single()

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'calendar_event_created',
        entityTable: 'calendar_events',
        entityId: event.id,
        afterData: { title, event_date: eventDate, event_type: eventType, is_company_wide: isCompanyWide },
    })

    revalidatePath('/calendar')
    return { success: true }
}

export async function deleteCalendarEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
    const isAdmin = roles.includes('admin')

    // Verify ownership before deleting (admin can delete any)
    const { data: existing } = await (supabaseAdmin as any).from('calendar_events').select('user_id').eq('id', eventId).single()
    if (!existing) return { success: false, error: 'Event not found' }
    if (!isAdmin && existing.user_id !== user.id) return { success: false, error: 'Unauthorised' }

    const { error } = await (supabaseAdmin as any).from('calendar_events').delete().eq('id', eventId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'calendar_event_deleted',
        entityTable: 'calendar_events',
        entityId: eventId,
    })

    revalidatePath('/calendar')
    return { success: true }
}
