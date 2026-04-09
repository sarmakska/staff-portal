import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { getITTicket, getITTicketComments, getITTicketAttachments, getITStaffList } from '@/lib/actions/it-tickets'
import ITTicketDetailClient from './it-ticket-detail-client'

export default async function ITTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params

  const supabase = await createClient()
  const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (rolesData ?? []).map(r => r.role as string)
  const isAdmin = roles.includes('admin')

  const [ticket, comments, attachments, staffList] = await Promise.all([
    getITTicket(id),
    getITTicketComments(id, isAdmin),
    getITTicketAttachments(id),
    isAdmin ? getITStaffList() : Promise.resolve([]),
  ])

  if (!ticket) notFound()
  if (!isAdmin && ticket.user_id !== user.id) notFound()

  return (
    <ITTicketDetailClient
      userId={user.id}
      isAdmin={isAdmin}
      ticket={ticket}
      initialComments={comments}
      attachments={attachments}
      staffList={staffList}
    />
  )
}
