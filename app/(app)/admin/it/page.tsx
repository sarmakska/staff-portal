import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { getITTickets, getITTicketStats, getITStaffList } from '@/lib/actions/it-tickets'
import ITAdminClient from './it-admin-client'

export default async function ITAdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (rolesData ?? []).map(r => r.role as string)
  if (!roles.includes('admin')) redirect('/it')

  const [tickets, stats, staffList] = await Promise.all([
    getITTickets(true),
    getITTicketStats(),
    getITStaffList(),
  ])

  return <ITAdminClient tickets={tickets} stats={stats} staffList={staffList} userId={user.id} />
}
