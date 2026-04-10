import { getNoticePosts } from '@/lib/actions/notice-board'
import NoticeBoardClient from './notice-board-client'
export const dynamic = 'force-dynamic'

export default async function NoticeBoardPage() {
  const { posts } = await getNoticePosts()
  return <NoticeBoardClient initialPosts={posts} />
}
