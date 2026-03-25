'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin')) return null
    return { supabase, user }
}

async function requireAdminOrDirector() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('director')) return null
    return { supabase, user }
}

async function requireAttendanceEditor() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('director') && !roles.includes('reception')) return null
    return { supabase, user }
}

// ── Departments ──────────────────────────────────────────────

export async function createDepartment(formData: FormData): Promise<void> {
    const ctx = await requireAdminOrDirector()
    if (!ctx) return

    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim() || null
    if (!name) return

    const { data, error } = await ctx.supabase
        .from('departments')
        .insert({ name, description })
        .select()
        .single()

    if (!error && data) {
        await writeAuditLog({
            actorId: ctx.user.id,
            actorEmail: ctx.user.email ?? '',
            action: 'department_created',
            entityTable: 'departments',
            entityId: data.id,
            afterData: { name },
        })
    }

    revalidatePath('/admin/org')
}

export async function deleteDepartment(deptId: string): Promise<void> {
    const ctx = await requireAdminOrDirector()
    if (!ctx) return

    await ctx.supabase.from('departments').delete().eq('id', deptId)

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'department_deleted',
        entityTable: 'departments',
        entityId: deptId,
        afterData: { deleted: true },
    })

    revalidatePath('/admin/org')
}

export async function updateDepartmentHead(deptId: string, headId: string | null): Promise<{ error?: string }> {
    const ctx = await requireAdminOrDirector()
    if (!ctx) return { error: "Not authorized" }

    const { error } = await ctx.supabase
        .from('departments')
        .update({ head_user_id: headId })
        .eq('id', deptId)

    if (error) return { error: error.message }

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'department_updated',
        entityTable: 'departments',
        entityId: deptId,
        afterData: { head_user_id: headId },
    })

    revalidatePath('/admin/org')
    return {}
}

// ── Locations ────────────────────────────────────────────────

export async function createLocation(formData: FormData): Promise<void> {
    const ctx = await requireAdminOrDirector()
    if (!ctx) return

    const name = String(formData.get('name') ?? '').trim()
    const address = String(formData.get('address') ?? '').trim() || null
    const city = String(formData.get('city') ?? '').trim() || null
    if (!name) return

    const { data, error } = await ctx.supabase
        .from('locations')
        .insert({ name, address, city })
        .select()
        .single()

    if (!error && data) {
        await writeAuditLog({
            actorId: ctx.user.id,
            actorEmail: ctx.user.email ?? '',
            action: 'location_created',
            entityTable: 'locations',
            entityId: data.id,
            afterData: { name },
        })
    }

    revalidatePath('/admin/org')
}

export async function deleteLocation(locationId: string): Promise<void> {
    const ctx = await requireAdminOrDirector()
    if (!ctx) return

    await ctx.supabase.from('locations').delete().eq('id', locationId)

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'location_deleted',
        entityTable: 'locations',
        entityId: locationId,
        afterData: { deleted: true },
    })

    revalidatePath('/admin/org')
}

// ── User Roles ───────────────────────────────────────────────

export async function assignRole(formData: FormData): Promise<void> {
    const ctx = await requireAdmin()
    if (!ctx) return

    const userId = String(formData.get('userId') ?? '').trim()
    const role = String(formData.get('role') ?? '').trim() as any
    const ALLOWED_ROLES = ['employee', 'admin', 'director', 'accounts', 'reception']
    if (!userId || !role || !ALLOWED_ROLES.includes(role)) return

    await ctx.supabase
        .from('user_roles')
        .upsert({ user_id: userId, role, assigned_by: ctx.user.id }, { onConflict: 'user_id,role' })

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'role_assigned',
        entityTable: 'user_roles',
        entityId: userId,
        afterData: { role, action: 'assigned' },
    })

    revalidatePath('/admin/users')
}

export async function removeRole(userId: string, role: string): Promise<void> {
    const ctx = await requireAdmin()
    if (!ctx) return

    await ctx.supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role as any)

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'user_updated',
        entityTable: 'user_roles',
        entityId: userId,
        afterData: { role, action: 'removed' },
    })

    revalidatePath('/admin/users')
}

// ── Leave Balance Management ──────────────────────────────────

async function requirePrivileged() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('director') && !roles.includes('accounts')) return null
    return { supabase, user }
}

export async function setLeaveBalance(formData: FormData): Promise<{ error?: string }> {
    const ctx = await requirePrivileged()
    if (!ctx) return { error: 'Not authorized' }

    const userId = String(formData.get('user_id') ?? '').trim()
    const leaveType = String(formData.get('leave_type') ?? '').trim()
    const total = Number(formData.get('total') ?? 0)
    const year = Number(formData.get('year') ?? new Date().getFullYear())

    if (!userId || !leaveType || isNaN(total) || total < 0) return { error: 'Invalid values' }

    const { error } = await supabaseAdmin
        .from('leave_balances')
        .upsert({
            user_id: userId,
            leave_type: leaveType as any,
            total,
            year,
        }, { onConflict: 'user_id,leave_type,year' })

    if (error) return { error: error.message }

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'user_updated',
        entityTable: 'leave_balances',
        entityId: userId,
        afterData: { leave_type: leaveType, total, year },
    })

    revalidatePath('/admin/leave')
    return {}
}

export async function setLeaveUsed(formData: FormData): Promise<{ error?: string }> {
    const ctx = await requirePrivileged()
    if (!ctx) return { error: 'Not authorized' }

    const userId = String(formData.get('user_id') ?? '').trim()
    const leaveType = String(formData.get('leave_type') ?? '').trim()
    const used = Number(formData.get('used') ?? 0)
    const year = Number(formData.get('year') ?? new Date().getFullYear())

    if (!userId || !leaveType || isNaN(used) || used < 0) return { error: 'Invalid values' }

    const { data: existing } = await supabaseAdmin
        .from('leave_balances')
        .select('id')
        .eq('user_id', userId)
        .eq('leave_type', leaveType as any)
        .eq('year', year)
        .single()

    if (!existing) return { error: 'No balance row exists yet — set the Contracted amount first to create the row.' }

    const { error } = await supabaseAdmin
        .from('leave_balances')
        .update({ used })
        .eq('user_id', userId)
        .eq('leave_type', leaveType as any)
        .eq('year', year)

    if (error) return { error: error.message }

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'user_updated',
        entityTable: 'leave_balances',
        entityId: userId,
        afterData: { leave_type: leaveType, used, year },
    })

    revalidatePath('/admin/leave')
    return {}
}

export async function setMaxCarryForward(userId: string, days: number): Promise<{ error?: string }> {
    const ctx = await requirePrivileged()
    if (!ctx) return { error: 'Not authorized' }

    if (isNaN(days) || days < 0 || days > 30) return { error: 'Must be 0–30 days' }

    const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ max_carry_forward: days } as any)
        .eq('id', userId)

    if (error) return { error: error.message }

    revalidatePath('/admin/leave')
    return {}
}

export async function setCarryForward(userId: string, days: number): Promise<{ error?: string }> {
    const ctx = await requirePrivileged()
    if (!ctx) return { error: 'Not authorized' }

    if (isNaN(days) || days < 0 || days > 30) return { error: 'Must be 0–30 days' }

    const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ carry_forward_days: days } as any)
        .eq('id', userId)

    if (error) return { error: error.message }

    revalidatePath('/admin/leave')
    return {}
}

// ── Create User ───────────────────────────────────────────────

export async function createUser(data: {
    full_name: string
    email: string
    password: string
    kiosk_pin?: string
    display_name?: string
    job_title?: string
    phone?: string
    department_id?: string
    is_active: boolean
    roles: string[]
    leave_annual?: number
    leave_sick?: number
    leave_maternity?: number
    max_carry_forward?: number
}): Promise<{ success: boolean; error?: string }> {
    const ctx = await requireAdmin()
    if (!ctx) return { success: false, error: 'Not authorized' }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        email_confirm: true,
    })
    if (authError || !authData.user) return { success: false, error: authError?.message ?? 'Failed to create auth user' }

    const userId = authData.user.id

    // 2. Insert profile
    const profileInsert: Record<string, any> = {
        id: userId,
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        is_active: data.is_active,
    }
    if (data.display_name?.trim()) profileInsert.display_name = data.display_name.trim()
    if (data.job_title?.trim()) profileInsert.job_title = data.job_title.trim()
    if (data.phone?.trim()) profileInsert.phone = data.phone.trim()
    if (data.department_id?.trim()) profileInsert.department_id = data.department_id.trim()
    if (data.kiosk_pin?.trim()) profileInsert.kiosk_pin = data.kiosk_pin.trim()
    if (data.max_carry_forward !== undefined) profileInsert.max_carry_forward = data.max_carry_forward

    const { error: profileError } = await (supabaseAdmin as any).from('user_profiles').upsert(profileInsert, { onConflict: 'id' })
    if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return { success: false, error: profileError.message }
    }

    // 3. Insert roles — always include 'employee'
    const allRoles = Array.from(new Set(['employee', ...data.roles]))
    const roleRows = allRoles.map(role => ({ user_id: userId, role, assigned_by: ctx.user.id }))
    await supabaseAdmin.from('user_roles').insert(roleRows as any)

    // 4. Insert leave balances if provided
    const currentYear = new Date().getFullYear()
    const leaveInserts: any[] = []
    if (data.leave_annual !== undefined && data.leave_annual > 0)
        leaveInserts.push({ user_id: userId, leave_type: 'annual', total: data.leave_annual, used: 0, pending: 0, year: currentYear })
    if (data.leave_sick !== undefined && data.leave_sick > 0)
        leaveInserts.push({ user_id: userId, leave_type: 'sick', total: data.leave_sick, used: 0, pending: 0, year: currentYear })
    if (data.leave_maternity !== undefined && data.leave_maternity > 0)
        leaveInserts.push({ user_id: userId, leave_type: 'maternity', total: data.leave_maternity, used: 0, pending: 0, year: currentYear })
    if (leaveInserts.length > 0)
        await supabaseAdmin.from('leave_balances').insert(leaveInserts)

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'user_created',
        entityTable: 'user_profiles',
        entityId: userId,
        afterData: { full_name: data.full_name, email: data.email, roles: allRoles },
    })

    revalidatePath('/admin/users')
    revalidatePath('/admin/leave')
    return { success: true }
}

// ── Email Templates ──────────────────────────────────────────

export async function updateTemplate(id: string, data: { subject: string, html_body: string }): Promise<{ error?: string }> {
    const ctx = await requireAdminOrDirector()
    if (!ctx) return { error: "Not authorized" }

    const { error } = await ctx.supabase
        .from('email_templates')
        .update({
            subject: data.subject,
            html_body: data.html_body,
            updated_by: ctx.user.id
        })
        .eq('id', id)

    if (error) return { error: error.message }

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'user_updated',
        entityTable: 'email_templates',
        entityId: id,
        afterData: data,
    })

    revalidatePath('/admin/templates')
    return {}
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<void> {
    const ctx = await requireAdminOrDirector()
    if (!ctx) return

    await ctx.supabase
        .from('user_profiles')
        .update({ is_active: isActive })
        .eq('id', userId)

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'user_updated',
        entityTable: 'user_profiles',
        entityId: userId,
    })

    revalidatePath('/admin/users')
    revalidatePath('/admin/leave')
}

export async function updateUserProfile(
    userId: string,
    data: {
        full_name?: string
        display_name?: string
        job_title?: string
        phone?: string
        department_id?: string | null
    }
): Promise<{ success: boolean; error?: string }> {
    const ctx = await requireAdmin()
    if (!ctx) return { success: false, error: 'Unauthorized' }

    const { error } = await supabaseAdmin
        .from('user_profiles')
        .update(data)
        .eq('id', userId)

    if (error) return { success: false, error: error.message }

    await writeAuditLog({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email ?? '',
        action: 'user_updated',
        entityTable: 'user_profiles',
        entityId: userId,
        afterData: data,
    })

    revalidatePath('/admin/users')
    return { success: true }
}

// ── Attendance Admin ──────────────────────────────────────────────

export async function updateAttendanceEntry(
    id: string,
    clockIn: string | null,
    clockOut: string | null,
    status: string,
): Promise<{ error?: string }> {
    const ctx = await requireAttendanceEditor()
    if (!ctx) return { error: 'Unauthorized' }

    let totalHours: number | null = null
    if (clockIn && clockOut) {
        const diff = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000
        totalHours = Math.max(0, Math.round(diff * 100) / 100)
    }

    const { error } = await supabaseAdmin
        .from('attendance')
        .update({ clock_in: clockIn, clock_out: clockOut, status: status as any, total_hours: totalHours })
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/timesheets')
    return {}
}

export async function deleteAttendanceEntry(id: string): Promise<{ error?: string }> {
    const ctx = await requireAttendanceEditor()
    if (!ctx) return { error: 'Unauthorized' }

    const { error } = await supabaseAdmin.from('attendance').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/timesheets')
    return {}
}

export async function getAllEmployeesTimesheetData(weeksBack = 4): Promise<{ error?: string; data?: any[] }> {
    const ctx = await requireAdminOrDirector()
    if (!ctx) return { error: 'Unauthorized' }

    const since = new Date()
    since.setDate(since.getDate() - weeksBack * 7)

    const { data, error } = await supabaseAdmin
        .from('attendance')
        .select('id, work_date, clock_in, clock_out, total_hours, status, user:user_profiles!attendance_user_id_fkey(full_name, display_name, email)')
        .gte('work_date', since.toISOString().split('T')[0])
        .order('work_date', { ascending: false })

    if (error) return { error: error.message }
    return { data: data ?? [] }
}
