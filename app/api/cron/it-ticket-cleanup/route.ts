export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Runs daily at 02:00 UTC via GitHub Actions
// Deletes IT tickets that have been resolved/closed for 30+ days
// Also removes associated attachments from Supabase Storage

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString()

  // Find tickets to delete
  const { data: ticketsToDelete } = await (supabaseAdmin as any)
    .from('it_tickets')
    .select('id')
    .in('status', ['resolved', 'closed'])
    .lte('resolved_at', cutoffStr)
    .is('deleted_at', null)

  if (!ticketsToDelete?.length) {
    return NextResponse.json({ success: true, deleted: 0, date: new Date().toISOString().split('T')[0] })
  }

  const ticketIds = ticketsToDelete.map((t: any) => t.id)

  // Remove attachments from storage first
  const { data: attachments } = await (supabaseAdmin as any)
    .from('it_ticket_attachments')
    .select('file_path')
    .in('ticket_id', ticketIds)

  if (attachments?.length) {
    const paths = attachments.map((a: any) => a.file_path)
    await supabaseAdmin.storage.from('it-attachments').remove(paths)
  }

  // Delete tickets (cascades to comments + attachments records)
  const { error } = await (supabaseAdmin as any)
    .from('it_tickets')
    .delete()
    .in('id', ticketIds)

  if (error) {
    console.error('[cron/it-ticket-cleanup] Delete error:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const date = new Date().toISOString().split('T')[0]
  console.log(`[cron/it-ticket-cleanup] ${date} — deleted ${ticketIds.length} tickets`)
  return NextResponse.json({ success: true, deleted: ticketIds.length, date })
}
