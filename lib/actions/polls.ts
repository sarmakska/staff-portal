'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getEmailFlags } from '@/lib/actions/app-settings'
import { sendPollCreatedEmail } from '@/lib/email'

export interface Poll {
  id: string
  question: string
  options: string[]
  created_by: string
  created_by_name: string
  deadline: string
  is_archived: boolean
  created_at: string
  votes?: PollVote[]
  my_vote?: number | null
}

export interface PollVote {
  poll_id: string
  user_id: string
  option_index: number
  created_at: string
}

// ── Get all polls (active + archived) ────────────────────────
export async function getPolls(): Promise<{ polls: Poll[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { polls: [], error: 'Unauthorized' }

  const [{ data: pollsRaw }, { data: votesRaw }] = await Promise.all([
    (supabaseAdmin as any).from('polls').select('*').order('created_at', { ascending: false }),
    (supabaseAdmin as any).from('poll_votes').select('poll_id, user_id, option_index, created_at'),
  ])

  const polls: Poll[] = (pollsRaw ?? []).map((p: any) => {
    const votes: PollVote[] = (votesRaw ?? []).filter((v: any) => v.poll_id === p.id)
    const myVote = votes.find((v: any) => v.user_id === user.id)
    return {
      ...p,
      options: p.options ?? [],
      votes,
      my_vote: myVote ? myVote.option_index : null,
    }
  })

  return { polls }
}

// ── Create a poll ─────────────────────────────────────────────
export async function createPoll(data: {
  question: string
  options: string[]
  deadline: string
}): Promise<{ success: boolean; poll?: Poll; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (!data.question.trim()) return { success: false, error: 'Question is required.' }
  if (data.options.filter(o => o.trim()).length < 2) return { success: false, error: 'At least 2 options required.' }
  if (!data.deadline) return { success: false, error: 'Deadline is required.' }

  const { data: profile } = await supabase.from('user_profiles').select('full_name, display_name').eq('id', user.id).single()
  const creatorName = profile?.display_name || profile?.full_name || 'Someone'

  const cleanOptions = data.options.map(o => o.trim()).filter(Boolean)

  const { data: poll, error } = await (supabaseAdmin as any)
    .from('polls')
    .insert({
      question: data.question.trim(),
      options: cleanOptions,
      created_by: user.id,
      created_by_name: creatorName,
      deadline: new Date(data.deadline).toISOString(),
      is_archived: false,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/polls')

  // Send email to all staff except directors
  try {
    const flags = await getEmailFlags()
    if (flags.email_poll_created !== false) {
      const { data: activeUsers } = await (supabaseAdmin as any)
        .from('user_profiles')
        .select('email, full_name, display_name, id')
        .eq('is_active', true)
        .not('email', 'is', null)

      // Exclude directors
      const { data: directorRoles } = await (supabaseAdmin as any)
        .from('user_roles')
        .select('user_id')
        .eq('role', 'director')

      const directorIds = new Set((directorRoles ?? []).map((r: any) => r.user_id))
      // Exclude poll creator too (they already know)
      const recipients = (activeUsers ?? [])
        .filter((u: any) => !directorIds.has(u.id) && u.id !== user.id && u.email)
        .map((u: any) => u.email as string)

      if (recipients.length > 0) {
        await sendPollCreatedEmail({
          recipients,
          question: data.question.trim(),
          options: cleanOptions,
          deadline: data.deadline,
          creatorName,
          pollId: poll.id,
        })
      }
    }
  } catch (e) {
    console.error('[polls] Email send error:', e)
  }

  return { success: true, poll }
}

// ── Cast a vote ───────────────────────────────────────────────
export async function castVote(pollId: string, optionIndex: number): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Check poll is still active
  const { data: poll } = await (supabaseAdmin as any).from('polls').select('deadline, is_archived').eq('id', pollId).single()
  if (!poll) return { success: false, error: 'Poll not found.' }
  if (poll.is_archived || new Date(poll.deadline) < new Date()) return { success: false, error: 'This poll has closed.' }

  // Upsert vote (change vote if already voted) — use admin to bypass missing UPDATE RLS policy
  const { error } = await (supabaseAdmin as any)
    .from('poll_votes')
    .upsert({ poll_id: pollId, user_id: user.id, option_index: optionIndex }, { onConflict: 'poll_id,user_id' })

  if (error) return { success: false, error: error.message }

  revalidatePath('/polls')
  return { success: true }
}

// ── Archive expired polls (called on page load) ───────────────
export async function archiveExpiredPolls(): Promise<void> {
  await (supabaseAdmin as any)
    .from('polls')
    .update({ is_archived: true })
    .lt('deadline', new Date().toISOString())
    .eq('is_archived', false)
}
