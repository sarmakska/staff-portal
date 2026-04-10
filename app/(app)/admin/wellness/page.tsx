import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { getAdminMoodStats, getWellnessEvents } from '@/lib/actions/wellness'
import AdminWellnessClient from './admin-wellness-client'

export default async function AdminWellnessPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (rolesData ?? []).map(r => r.role as string)
  if (!roles.includes('admin') && !roles.includes('director')) redirect('/wellness')

  const [stats, events] = await Promise.all([
    getAdminMoodStats(),
    getWellnessEvents(),
  ])

  return <AdminWellnessClient stats={stats} upcomingEvents={events} />
}
