import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { getITTickets } from '@/lib/actions/it-tickets'
import ITTicketsClient from './it-tickets-client'

export default async function ITTicketsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (rolesData ?? []).map(r => r.role as string)
  const isAdmin = roles.includes('admin')

  const tickets = await getITTickets(isAdmin)

  return (
    <ITTicketsClient
      userId={user.id}
      isAdmin={isAdmin}
      initialTickets={tickets}
    />
  )
}
