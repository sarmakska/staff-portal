'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface NoticePost {
  id: string
  content: string
  link_url: string | null
  link_label: string | null
  colour: string
  created_by: string
  created_by_name: string
  expires_at: string | null
  created_at: string
}

// ── Get all notice board posts ───────────────────────────────
export async function getNoticePosts(): Promise<{ posts: NoticePost[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { posts: [], error: 'Unauthorized' }

  const { data, error } = await (supabaseAdmin as any)
    .from('notice_board_posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { posts: [], error: error.message }
  return { posts: data ?? [] }
}

// ── Create a notice post ──────────────────────────────────────
export async function createNoticePost(data: {
  content: string
  link_url?: string
  link_label?: string
  colour: string
  expires_at?: string
}): Promise<{ success: boolean; post?: NoticePost; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (!data.content.trim()) return { success: false, error: 'Content is required.' }

  const { data: profile } = await supabase.from('user_profiles').select('full_name, display_name').eq('id', user.id).single()
  const creatorName = profile?.display_name || profile?.full_name || 'Someone'

  const { data: post, error } = await (supabaseAdmin as any)
    .from('notice_board_posts')
    .insert({
      content: data.content.trim(),
      link_url: data.link_url?.trim() || null,
      link_label: data.link_label?.trim() || null,
      colour: data.colour,
      created_by: user.id,
      created_by_name: creatorName,
      expires_at: data.expires_at ? new Date(data.expires_at).toISOString() : null,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/notice-board')
  return { success: true, post }
}

// ── Delete a notice post (anyone can delete any post) ─────────
export async function deleteNoticePost(postId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await (supabaseAdmin as any)
    .from('notice_board_posts')
    .delete()
    .eq('id', postId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/notice-board')
  return { success: true }
}
