import { getAnnouncements } from '@/lib/actions/announcements'
import AnnouncementsClient from './announcements-client'

export default async function AnnouncementsPage() {
  const history = (await getAnnouncements()) as any[]
  return <AnnouncementsClient history={history} />
}
