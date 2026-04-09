import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { getMoodHistory, getStretchHistory, getBreathingHistory, getWellnessPrefs } from '@/lib/actions/wellness'
import MyJourneyClient from './my-journey-client'

export default async function MyJourneyPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [moodHistory, stretchHistory, breathingHistory, prefs] = await Promise.all([
    getMoodHistory(),
    getStretchHistory(),
    getBreathingHistory(),
    getWellnessPrefs(),
  ])

  return (
    <MyJourneyClient
      userId={user.id}
      moodHistory={moodHistory}
      stretchHistory={stretchHistory}
      breathingHistory={breathingHistory}
      prefs={prefs}
    />
  )
}
