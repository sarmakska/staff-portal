import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { getTodayMoodCheckin, getMoodHistory, getWellnessEvents, getWellnessPrefs } from '@/lib/actions/wellness'
import WellnessHubClient from './wellness-hub-client'

export default async function WellnessHubPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [todayMood, moodHistory, upcomingEvents, prefs] = await Promise.all([
    getTodayMoodCheckin(),
    getMoodHistory(),
    getWellnessEvents(),
    getWellnessPrefs(),
  ])

  return (
    <WellnessHubClient
      userId={user.id}
      todayMood={todayMood}
      moodHistory={moodHistory.slice(0, 14)}
      upcomingEvents={upcomingEvents.slice(0, 3)}
      prefs={prefs}
    />
  )
}
