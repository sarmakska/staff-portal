'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export async function cancelVisitorBooking(visitorId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
        .from('visitors')
        .update({ status: 'cancelled' })
        .eq('id', visitorId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: null, // Receptionist action or system
        actorEmail: 'reception',
        action: 'visitor_cancelled',
        entityTable: 'visitors',
        entityId: visitorId,
        afterData: { status: 'cancelled' },
    })

    revalidatePath('/reception')
    revalidatePath('/visitors')
    return { success: true }
}
