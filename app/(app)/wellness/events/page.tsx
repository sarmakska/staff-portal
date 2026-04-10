import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { getWellnessEvents, getPastWellnessEvents } from '@/lib/actions/wellness'
import WellnessEventsClient from './wellness-events-client'

export default async function WellnessEventsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [upcoming, past] = await Promise.all([
    getWellnessEvents(),
    getPastWellnessEvents(),
  ])

  return <WellnessEventsClient userId={user.id} upcomingEvents={upcoming} pastEvents={past} />
}
