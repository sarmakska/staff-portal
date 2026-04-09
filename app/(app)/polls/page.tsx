import { getPolls, archiveExpiredPolls } from '@/lib/actions/polls'
import PollsClient from './polls-client'
export const dynamic = 'force-dynamic'

export default async function PollsPage() {
  await archiveExpiredPolls()
  const { polls } = await getPolls()
  return <PollsClient initialPolls={polls} />
}
