'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'

// Step 1: generate a signed upload URL — browser uploads directly to Supabase (bypasses Vercel)
export async function getAvatarUploadUrl(contentType: string): Promise<{ success: boolean; signedUrl?: string; path?: string; publicUrl?: string; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Not authenticated' }

        const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
        const path = `${user.id}/avatar.${ext}`

        const { data, error } = await supabaseAdmin.storage
            .from('avatars')
            .createSignedUploadUrl(path, { upsert: true })

        if (error) return { success: false, error: error.message }

        const { data: { publicUrl } } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)

        return { success: true, signedUrl: data.signedUrl, path, publicUrl }
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Failed to prepare upload' }
    }
}

// Step 2: save the public URL to the database after the browser has uploaded
export async function saveAvatarUrl(publicUrl: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Not authenticated' }

        const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`

        await supabaseAdmin
            .from('user_profiles')
            .update({ avatar_url: urlWithCacheBuster })
            .eq('id', user.id)

        revalidatePath('/settings')
        revalidatePath('/directory')

        return { success: true, url: urlWithCacheBuster }
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Failed to save photo' }
    }
}

export async function updateProfile(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const fullName = String(formData.get('full_name') ?? '').trim()
    const displayName = String(formData.get('display_name') ?? '').trim() || null
    const phone = String(formData.get('phone') ?? '').trim() || null
    const jobTitle = String(formData.get('job_title') ?? '').trim() || null
    let gender = String(formData.get('gender') ?? '').trim() || null
    const deskExtension = String(formData.get('desk_extension') ?? '').trim() || null
    let departmentId = String(formData.get('department_id') ?? '').trim() || null
    const birthday = String(formData.get('birthday') ?? '').trim() || null

    if (departmentId === 'none') departmentId = null
    if (gender === 'none') gender = 'prefer_not_to_say'

    if (!fullName) return { success: false, error: 'Full name is required' }

    // Get previous gender before updating
    const { data: prevProfile } = await supabase
        .from('user_profiles')
        .select('gender')
        .eq('id', user.id)
        .single()

    const { error } = await supabase
        .from('user_profiles')
        .update({
            full_name: fullName,
            display_name: displayName,
            phone,
            job_title: jobTitle,
            gender: gender,
            desk_extension: deskExtension,
            department_id: departmentId,
            birthday: birthday as any
        })
        .eq('id', user.id)

    if (error) return { success: false, error: error.message }

    // Handle maternity leave based on gender change
    const currentYear = new Date().getFullYear()
    const wasFemaleBefore = prevProfile?.gender === 'female'
    const isNowFemale = gender === 'female'

    if (!wasFemaleBefore && isNowFemale) {
        // Changed to female — add maternity leave if not already present
        await supabaseAdmin
            .from('leave_balances')
            .upsert({ user_id: user.id, leave_type: 'maternity', total: 260, year: currentYear }, { onConflict: 'user_id,leave_type,year', ignoreDuplicates: true })
    } else if (wasFemaleBefore && !isNowFemale) {
        // Changed away from female — remove maternity leave
        await supabaseAdmin
            .from('leave_balances')
            .delete()
            .eq('user_id', user.id)
            .eq('leave_type', 'maternity')
    }

    revalidatePath('/settings')
    revalidatePath('/leave')
    return { success: true }
}

export async function setApprovers(approverIds: string[]): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (approverIds.length > 3) return { success: false, error: 'Maximum 3 approvers allowed' }

    // Delete existing approvers for this user (use admin to bypass RLS — no write policy for users)
    await supabaseAdmin.from('user_approvers').delete().eq('user_id', user.id)

    // Insert new approvers with priority order
    if (approverIds.length > 0) {
        const inserts = approverIds.map((approverId, idx) => ({
            user_id: user.id,
            approver_id: approverId,
            priority: idx + 1,
        }))
        const { error } = await supabaseAdmin.from('user_approvers').insert(inserts)
        if (error) return { success: false, error: error.message }
    }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'approver_updated',
        entityTable: 'user_approvers',
        entityId: user.id,
        afterData: { approver_count: approverIds.length },
    })

    revalidatePath('/settings')
    return { success: true }
}

export async function updateKioskPin(pin: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (!/^\d{4,6}$/.test(pin)) return { success: false, error: 'PIN must be 4–6 digits' }

    const { error } = await supabase
        .from('user_profiles')
        .update({ kiosk_pin: pin })
        .eq('id', user.id)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: user.id,
        actorEmail: user.email ?? '',
        action: 'kiosk_pin_updated',
        entityTable: 'user_profiles',
        entityId: user.id,
    })

    revalidatePath('/settings')
    return { success: true }
}

export async function clearKioskPin(): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
        .from('user_profiles')
        .update({ kiosk_pin: null })
        .eq('id', user.id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/settings')
    return { success: true }
}
