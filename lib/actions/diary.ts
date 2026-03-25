'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateDiaryEntry(
  id: string,
  data: { title: string; content: string; tags: string[]; reminder_at: string | null }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('diary_entries')
    .update({
      title: data.title,
      content: data.content,
      tags: data.tags,
      reminder_at: data.reminder_at,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/diary')
  revalidatePath(`/diary/${id}`)
  return { success: true }
}

export async function deleteDiaryEntry(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // RLS ensures they can only delete their own entries
    const { error } = await supabase
        .from('diary_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/diary')
    return { success: true }
}
