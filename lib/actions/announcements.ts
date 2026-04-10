'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendStaffAnnouncement } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import { ANNOUNCEMENT_CATEGORIES, type AnnouncementCategory } from '@/lib/announcement-categories'

export interface AnnouncementFormData {
  category: AnnouncementCategory
  subject: string
  body: string
  hasEvent: boolean
  eventTitle?: string
  eventDate?: string
  eventEndDate?: string
  eventTime?: string
  eventLocation?: string
  eventDescription?: string
}

export async function submitAnnouncement(data: AnnouncementFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, display_name')
    .eq('id', user.id)
    .single()

  const sentByName = (profile as any)?.display_name || (profile as any)?.full_name || 'A colleague'
  const cat = ANNOUNCEMENT_CATEGORIES.find(c => c.value === data.category)
  const subjectWithEmoji = `${cat?.emoji ?? '📢'} ${data.subject}`

  const result = await sendStaffAnnouncement({
    subject: subjectWithEmoji,
    body: data.body,
    sentByName,
    category: cat?.label ?? 'General Notice',
    categoryEmoji: cat?.emoji ?? '📢',
    event: data.hasEvent && data.eventTitle && data.eventDate ? {
      title: data.eventTitle,
      date: data.eventDate,
      endDate: data.eventEndDate || undefined,
      time: data.eventTime || undefined,
      location: data.eventLocation || undefined,
      description: data.eventDescription || undefined,
    } : undefined,
  })

  if (!result.success) return { success: false, error: result.error }

  await (supabaseAdmin as any).from('announcements').insert({
    subject: data.subject,
    body: data.body,
    category: data.category,
    sent_by: user.id,
    sent_by_name: sentByName,
    has_event: data.hasEvent && !!data.eventTitle && !!data.eventDate,
    event_title: data.eventTitle || null,
    event_date: data.eventDate || null,
    event_end_date: data.eventEndDate || null,
    event_time: data.eventTime || null,
    event_location: data.eventLocation || null,
    event_description: data.eventDescription || null,
  })

  revalidatePath('/announcements')
  return { success: true }
}

export async function getAnnouncements() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await (supabaseAdmin as any)
    .from('announcements')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(50)

  return data ?? []
}

export async function getRecentAnnouncements(limit = 3) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await (supabaseAdmin as any)
    .from('announcements')
    .select('id, subject, category, sent_by_name, sent_at, has_event, event_date, event_end_date')
    .order('sent_at', { ascending: false })
    .limit(limit)

  return data ?? []
}
