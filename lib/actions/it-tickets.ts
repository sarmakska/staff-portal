'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/actions/auth'
import { revalidatePath } from 'next/cache'
import {
  sendITTicketSubmittedEmail,
  sendITTicketStatusEmail,
  sendITTicketCommentEmail,
} from '@/lib/email'

// ── Types ─────────────────────────────────────────────────────

export interface ITTicket {
  id: string
  ticket_number: number
  user_id: string
  title: string
  description: string
  category: string
  priority: string
  status: string
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  user_profile?: { full_name: string; display_name: string | null; email: string }
  assigned_profile?: { full_name: string; display_name: string | null } | null
  comment_count?: number
  attachment_count?: number
}

export interface ITTicketComment {
  id: string
  ticket_id: string
  user_id: string
  body: string
  is_internal: boolean
  created_at: string
  user_profile?: { full_name: string; display_name: string | null; avatar_url: string | null }
}

export interface ITTicketAttachment {
  id: string
  ticket_id: string
  comment_id: string | null
  user_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

// ── Get admin user for IT notifications ──────────────────────

async function getAdminEmail(): Promise<{ email: string; name: string } | null> {
  const { data } = await (supabaseAdmin as any)
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1)
    .single()
  if (!data) return null

  const { data: profile } = await (supabaseAdmin as any)
    .from('user_profiles')
    .select('email, full_name, display_name')
    .eq('id', data.user_id)
    .single()

  if (!profile?.email) return null
  return {
    email: profile.email,
    name: profile.display_name || profile.full_name || 'IT Admin',
  }
}

// ── Fetch tickets (staff: own; admin: all) ────────────────────

export async function getITTickets(showAll = false): Promise<ITTicket[]> {
  const user = await getCurrentUser()
  if (!user) return []

  let query = (supabaseAdmin as any)
    .from('it_tickets')
    .select(`
      *,
      user_profile:user_profiles!it_tickets_user_id_fkey(full_name, display_name, email),
      assigned_profile:user_profiles!it_tickets_assigned_to_fkey(full_name, display_name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!showAll) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) {
    console.error('[it-tickets] getITTickets error:', error.message)
    return []
  }

  // Get comment + attachment counts
  const ids: string[] = (data ?? []).map((t: any) => t.id)
  const [{ data: commentCounts }, { data: attachCounts }] = await Promise.all([
    (supabaseAdmin as any)
      .from('it_ticket_comments')
      .select('ticket_id')
      .in('ticket_id', ids),
    (supabaseAdmin as any)
      .from('it_ticket_attachments')
      .select('ticket_id')
      .in('ticket_id', ids),
  ])

  const ccMap: Record<string, number> = {}
  const acMap: Record<string, number> = {}
  for (const c of (commentCounts ?? [])) ccMap[c.ticket_id] = (ccMap[c.ticket_id] ?? 0) + 1
  for (const a of (attachCounts ?? [])) acMap[a.ticket_id] = (acMap[a.ticket_id] ?? 0) + 1

  return (data ?? []).map((t: any) => ({
    ...t,
    comment_count: ccMap[t.id] ?? 0,
    attachment_count: acMap[t.id] ?? 0,
  }))
}

// ── Fetch single ticket ───────────────────────────────────────

export async function getITTicket(id: string): Promise<ITTicket | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('it_tickets')
    .select(`
      *,
      user_profile:user_profiles!it_tickets_user_id_fkey(full_name, display_name, email),
      assigned_profile:user_profiles!it_tickets_assigned_to_fkey(full_name, display_name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('[it-tickets] getITTicket error:', error.message)
    return null
  }
  return data
}

// ── Fetch comments for a ticket ───────────────────────────────

export async function getITTicketComments(ticketId: string, isAdmin = false): Promise<ITTicketComment[]> {
  let query = (supabaseAdmin as any)
    .from('it_ticket_comments')
    .select(`*, user_profile:user_profiles!it_ticket_comments_user_id_fkey(full_name, display_name, avatar_url)`)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (!isAdmin) {
    query = query.eq('is_internal', false)
  }

  const { data } = await query
  return data ?? []
}

// ── Fetch attachments for a ticket ────────────────────────────

export async function getITTicketAttachments(ticketId: string): Promise<ITTicketAttachment[]> {
  const { data } = await (supabaseAdmin as any)
    .from('it_ticket_attachments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  return data ?? []
}

// ── Submit new ticket ─────────────────────────────────────────

export async function submitITTicket(formData: {
  title: string
  description: string
  category: string
  priority: string
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: ticket, error } = await (supabaseAdmin as any)
    .from('it_tickets')
    .insert({
      user_id: user.id,
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      priority: formData.priority,
    })
    .select()
    .single()

  if (error) {
    console.error('[it-tickets] submitITTicket error:', error.message)
    return { success: false, error: 'Failed to submit ticket. Please try again.' }
  }

  // Get user profile for email
  const { data: profile } = await (supabaseAdmin as any)
    .from('user_profiles')
    .select('full_name, display_name, email')
    .eq('id', user.id)
    .single()

  const admin = await getAdminEmail()
  if (admin && profile?.email) {
    const name = profile.display_name || profile.full_name || 'Staff'
    await sendITTicketSubmittedEmail({
      adminEmail: admin.email,
      adminName: admin.name,
      submitterName: name,
      submitterEmail: profile.email,
      ticketNumber: ticket.ticket_number,
      title: ticket.title,
      category: ticket.category,
      priority: ticket.priority,
      description: ticket.description,
    }).catch(() => {})
  }

  revalidatePath('/it')
  return { success: true, id: ticket.id }
}

// ── Add comment ───────────────────────────────────────────────

export async function addITTicketComment(
  ticketId: string,
  body: string,
  isInternal = false
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await (supabaseAdmin as any)
    .from('it_ticket_comments')
    .insert({ ticket_id: ticketId, user_id: user.id, body: body.trim(), is_internal: isInternal })

  if (error) return { success: false, error: error.message }

  // Notify ticket owner if admin is commenting (and not internal)
  if (!isInternal) {
    const ticket = await getITTicket(ticketId)
    if (ticket && ticket.user_id !== user.id && ticket.user_profile?.email) {
      const { data: commenterProfile } = await (supabaseAdmin as any)
        .from('user_profiles')
        .select('full_name, display_name')
        .eq('id', user.id)
        .single()
      const commenterName = commenterProfile?.display_name || commenterProfile?.full_name || 'IT Admin'
      await sendITTicketCommentEmail({
        to: ticket.user_profile.email,
        recipientName: ticket.user_profile.display_name || ticket.user_profile.full_name,
        ticketNumber: ticket.ticket_number,
        ticketTitle: ticket.title,
        commenterName,
        commentBody: body.trim(),
      }).catch(() => {})
    }
  }

  // Update ticket updated_at
  await (supabaseAdmin as any)
    .from('it_tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  revalidatePath(`/it/${ticketId}`)
  revalidatePath(`/admin/it`)
  return { success: true }
}

// ── Update ticket status (admin) ──────────────────────────────

export async function updateITTicketStatus(
  ticketId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'resolved' || status === 'closed') {
    updates.resolved_at = new Date().toISOString()
  }

  const { error } = await (supabaseAdmin as any)
    .from('it_tickets')
    .update(updates)
    .eq('id', ticketId)

  if (error) return { success: false, error: error.message }

  // Notify ticket submitter
  const ticket = await getITTicket(ticketId)
  if (ticket?.user_profile?.email) {
    await sendITTicketStatusEmail({
      to: ticket.user_profile.email,
      recipientName: ticket.user_profile.display_name || ticket.user_profile.full_name,
      ticketNumber: ticket.ticket_number,
      ticketTitle: ticket.title,
      newStatus: status,
    }).catch(() => {})
  }

  revalidatePath(`/it/${ticketId}`)
  revalidatePath(`/admin/it`)
  revalidatePath('/it')
  return { success: true }
}

// ── Update ticket priority/assigned_to (admin) ────────────────

export async function updateITTicketMeta(
  ticketId: string,
  updates: { priority?: string; assigned_to?: string | null; category?: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabaseAdmin as any)
    .from('it_tickets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/it/${ticketId}`)
  revalidatePath(`/admin/it`)
  return { success: true }
}

// ── Soft-delete attachment ────────────────────────────────────

export async function deleteITAttachment(attachmentId: string): Promise<{ success: boolean }> {
  const { data: att } = await (supabaseAdmin as any)
    .from('it_ticket_attachments')
    .select('file_path, ticket_id')
    .eq('id', attachmentId)
    .single()

  if (!att) return { success: false }

  // Remove from storage
  await supabaseAdmin.storage.from('it-attachments').remove([att.file_path])

  const { error } = await (supabaseAdmin as any)
    .from('it_ticket_attachments')
    .delete()
    .eq('id', attachmentId)

  if (error) return { success: false }

  revalidatePath(`/it/${att.ticket_id}`)
  return { success: true }
}

// ── Get all staff for assignment dropdown (admin) ─────────────

export async function getITStaffList(): Promise<{ id: string; name: string }[]> {
  const { data } = await (supabaseAdmin as any)
    .from('user_profiles')
    .select('id, full_name, display_name')
    .eq('is_active', true)
    .order('full_name')

  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.display_name || p.full_name,
  }))
}

// ── Get ticket stats (admin dashboard) ───────────────────────

export async function getITTicketStats(): Promise<{
  open: number
  in_progress: number
  resolved: number
  closed: number
  total: number
}> {
  const { data } = await (supabaseAdmin as any)
    .from('it_tickets')
    .select('status')
    .is('deleted_at', null)

  const stats = { open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 }
  for (const t of (data ?? [])) {
    const s = t.status as keyof typeof stats
    if (s in stats) stats[s]++
    stats.total++
  }
  return stats
}

// ── Upload attachment (server action) ─────────────────────────

export async function saveAttachmentRecord(params: {
  ticketId: string
  commentId?: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
}): Promise<{ success: boolean; id?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false }

  const { data, error } = await (supabaseAdmin as any)
    .from('it_ticket_attachments')
    .insert({
      ticket_id: params.ticketId,
      comment_id: params.commentId ?? null,
      user_id: user.id,
      file_name: params.fileName,
      file_path: params.filePath,
      file_size: params.fileSize,
      mime_type: params.mimeType,
    })
    .select('id')
    .single()

  if (error) return { success: false }
  revalidatePath(`/it/${params.ticketId}`)
  return { success: true, id: data.id }
}

// ── Get signed URL for attachment ─────────────────────────────

export async function getAttachmentUrl(filePath: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from('it-attachments')
    .createSignedUrl(filePath, 3600)
  return data?.signedUrl ?? null
}
