'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/actions/auth'
import { revalidatePath } from 'next/cache'
import { sendWellnessEventEmail } from '@/lib/email'

// ── Types ─────────────────────────────────────────────────────

export interface MoodCheckin {
  id: string
  user_id: string
  date: string
  rating: number
  note: string | null
  created_at: string
}

export interface WellnessEvent {
  id: string
  user_id: string
  title: string
  description: string | null
  type: string
  event_date: string
  event_time: string | null
  duration_mins: number
  location: string | null
  image_url: string | null
  max_participants: number | null
  recurring: string
  created_at: string
  organiser?: { full_name: string; display_name: string | null }
  rsvp_count?: number
  user_rsvp?: boolean
}

export interface StretchCompletion {
  id: string
  user_id: string
  session_type: string
  stretches_done: number
  duration_secs: number
  completed_at: string
}

export interface BreathingSession {
  id: string
  user_id: string
  technique: string
  duration_secs: number
  completed_at: string
}

// ── Mood checkins ─────────────────────────────────────────────

export async function getTodayMoodCheckin(): Promise<MoodCheckin | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const today = new Date().toISOString().split('T')[0]

  const { data } = await (supabaseAdmin as any)
    .from('mood_checkins')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  return data ?? null
}

export async function submitMoodCheckin(rating: number, note?: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  if (rating < 1 || rating > 5) return { success: false, error: 'Invalid rating' }

  const today = new Date().toISOString().split('T')[0]

  const { error } = await (supabaseAdmin as any)
    .from('mood_checkins')
    .upsert({ user_id: user.id, date: today, rating, note: note?.trim() || null }, { onConflict: 'user_id,date' })

  if (error) return { success: false, error: error.message }
  revalidatePath('/wellness')
  revalidatePath('/wellness/my-journey')
  return { success: true }
}

export async function getMoodHistory(userId?: string): Promise<MoodCheckin[]> {
  const user = await getCurrentUser()
  if (!user) return []
  const targetId = userId ?? user.id

  const { data } = await (supabaseAdmin as any)
    .from('mood_checkins')
    .select('*')
    .eq('user_id', targetId)
    .order('date', { ascending: false })
    .limit(90)

  return data ?? []
}

export async function getAllMoodTrends(): Promise<{ date: string; avg: number; count: number }[]> {
  const { data } = await (supabaseAdmin as any)
    .from('mood_checkins')
    .select('date, rating')
    .order('date', { ascending: false })
    .limit(500)

  const byDate: Record<string, number[]> = {}
  for (const r of (data ?? [])) {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r.rating)
  }

  return Object.entries(byDate)
    .map(([date, ratings]) => ({
      date,
      avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      count: ratings.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
}

// ── Wellness events ───────────────────────────────────────────

export async function getWellnessEvents(): Promise<WellnessEvent[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const { data: events } = await (supabaseAdmin as any)
    .from('wellness_events')
    .select(`*, organiser:user_profiles!wellness_events_user_id_fkey(full_name, display_name)`)
    .gte('event_date', new Date().toISOString().split('T')[0])
    .order('event_date', { ascending: true })

  if (!events?.length) return []

  const ids = events.map((e: any) => e.id)
  const { data: rsvps } = await (supabaseAdmin as any)
    .from('wellness_event_rsvps')
    .select('event_id, user_id')
    .in('event_id', ids)

  const countMap: Record<string, number> = {}
  const userRsvpSet = new Set<string>()
  for (const r of (rsvps ?? [])) {
    countMap[r.event_id] = (countMap[r.event_id] ?? 0) + 1
    if (r.user_id === user.id) userRsvpSet.add(r.event_id)
  }

  return events.map((e: any) => ({
    ...e,
    rsvp_count: countMap[e.id] ?? 0,
    user_rsvp: userRsvpSet.has(e.id),
  }))
}

export async function getPastWellnessEvents(): Promise<WellnessEvent[]> {
  const user = await getCurrentUser()
  if (!user) return []
  const today = new Date().toISOString().split('T')[0]

  const { data } = await (supabaseAdmin as any)
    .from('wellness_events')
    .select(`*, organiser:user_profiles!wellness_events_user_id_fkey(full_name, display_name)`)
    .lt('event_date', today)
    .order('event_date', { ascending: false })
    .limit(20)

  return data ?? []
}

export async function createWellnessEvent(form: {
  title: string
  description?: string
  type: string
  event_date: string
  event_time?: string
  duration_mins?: number
  location?: string
  max_participants?: number
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: event, error } = await (supabaseAdmin as any)
    .from('wellness_events')
    .insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      type: form.type,
      event_date: form.event_date,
      event_time: form.event_time || null,
      duration_mins: form.duration_mins ?? 30,
      location: form.location?.trim() || null,
      max_participants: form.max_participants || null,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Notify all active staff
  const { data: organiser } = await (supabaseAdmin as any)
    .from('user_profiles')
    .select('full_name, display_name, email')
    .eq('id', user.id)
    .single()

  const organiserName = organiser?.display_name || organiser?.full_name || 'A colleague'
  const dateFormatted = new Date(form.event_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Get all active staff who want event notifications
  const { data: allStaff } = await (supabaseAdmin as any)
    .from('user_profiles')
    .select('id, email, full_name, display_name')
    .eq('is_active', true)
    .neq('id', user.id)

  const staffWithPrefs = allStaff ?? []

  // Check wellness_notification_prefs for new_event flag
  const staffIds = staffWithPrefs.map((s: any) => s.id)
  const { data: prefs } = await (supabaseAdmin as any)
    .from('wellness_notification_prefs')
    .select('user_id, new_event')
    .in('user_id', staffIds)

  const prefMap: Record<string, boolean> = {}
  for (const p of (prefs ?? [])) prefMap[p.user_id] = p.new_event

  for (const staff of staffWithPrefs) {
    const wantsEmail = prefMap[staff.id] !== false // default true if no pref row
    if (!wantsEmail || !staff.email) continue

    await sendWellnessEventEmail({
      to: staff.email,
      recipientName: staff.display_name || staff.full_name || 'there',
      eventTitle: form.title,
      eventDate: dateFormatted,
      eventTime: form.event_time ?? null,
      location: form.location ?? null,
      description: form.description ?? null,
      organiserName,
      eventId: event.id,
    }).catch(() => {})
  }

  revalidatePath('/wellness/events')
  return { success: true, id: event.id }
}

export async function toggleEventRsvp(eventId: string): Promise<{ success: boolean; joined: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, joined: false }

  const { data: existing } = await (supabaseAdmin as any)
    .from('wellness_event_rsvps')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    const { error } = await (supabaseAdmin as any).from('wellness_event_rsvps').delete().eq('id', existing.id)
    if (error) return { success: false, joined: true }
    revalidatePath('/wellness/events')
    return { success: true, joined: false }
  } else {
    const { error } = await (supabaseAdmin as any).from('wellness_event_rsvps').insert({ event_id: eventId, user_id: user.id })
    if (error) return { success: false, joined: false }
    revalidatePath('/wellness/events')
    return { success: true, joined: true }
  }
}

export async function deleteWellnessEvent(eventId: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { success: false }

  const { error } = await (supabaseAdmin as any)
    .from('wellness_events')
    .delete()
    .eq('id', eventId)
    .eq('user_id', user.id) // can only delete own events (admins bypass via separate check)

  if (error) return { success: false }
  revalidatePath('/wellness/events')
  return { success: true }
}

// ── Stretch completions ───────────────────────────────────────

export async function logStretchSession(params: {
  session_type: string
  stretches_done: number
  duration_secs: number
}): Promise<{ success: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { success: false }

  const { error } = await (supabaseAdmin as any)
    .from('stretch_completions')
    .insert({ user_id: user.id, ...params })

  if (error) return { success: false }
  revalidatePath('/wellness/my-journey')
  return { success: true }
}

export async function getStretchHistory(): Promise<StretchCompletion[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const { data } = await (supabaseAdmin as any)
    .from('stretch_completions')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })
    .limit(50)

  return data ?? []
}

// ── Breathing sessions ────────────────────────────────────────

export async function logBreathingSession(params: {
  technique: string
  duration_secs: number
}): Promise<{ success: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { success: false }

  const { error } = await (supabaseAdmin as any)
    .from('breathing_sessions')
    .insert({ user_id: user.id, ...params })

  if (error) return { success: false }
  revalidatePath('/wellness/my-journey')
  return { success: true }
}

export async function getBreathingHistory(): Promise<BreathingSession[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const { data } = await (supabaseAdmin as any)
    .from('breathing_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })
    .limit(30)

  return data ?? []
}

// ── Wellness notification prefs ───────────────────────────────

export interface WellnessPrefs {
  new_event: boolean
  event_joined: boolean
  stretch_reminder: boolean
  stretch_reminder_times: string[]
  weekly_summary: boolean
  event_starting_soon: boolean
}

export async function getWellnessPrefs(): Promise<WellnessPrefs> {
  const user = await getCurrentUser()
  const defaults: WellnessPrefs = {
    new_event: true,
    event_joined: true,
    stretch_reminder: true,
    stretch_reminder_times: ['11:00', '15:00'],
    weekly_summary: true,
    event_starting_soon: true,
  }
  if (!user) return defaults

  const { data } = await (supabaseAdmin as any)
    .from('wellness_notification_prefs')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data ? { ...defaults, ...data } : defaults
}

export async function saveWellnessPrefs(prefs: Partial<WellnessPrefs>): Promise<{ success: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { success: false }

  const { error } = await (supabaseAdmin as any)
    .from('wellness_notification_prefs')
    .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) return { success: false }
  revalidatePath('/wellness')
  return { success: true }
}

// ── Admin: wellness notification prefs per person ─────────────

export async function adminGetStaffWellnessPrefs(): Promise<{
  id: string
  full_name: string
  display_name: string | null
  email: string
  stretch_reminder: boolean
}[]> {
  const { data: staff } = await (supabaseAdmin as any)
    .from('user_profiles')
    .select('id, full_name, display_name, email')
    .eq('is_active', true)
    .order('full_name')

  if (!staff?.length) return []

  const staffIds = staff.map((s: any) => s.id)
  const { data: prefs } = await (supabaseAdmin as any)
    .from('wellness_notification_prefs')
    .select('user_id, stretch_reminder')
    .in('user_id', staffIds)

  const prefMap: Record<string, boolean> = {}
  for (const p of (prefs ?? [])) {
    prefMap[p.user_id] = p.stretch_reminder !== false
  }

  return staff.map((s: any) => ({
    id: s.id,
    full_name: s.full_name,
    display_name: s.display_name,
    email: s.email,
    stretch_reminder: prefMap[s.id] !== false,
  }))
}

export async function adminSetStretchReminder(userId: string, enabled: boolean): Promise<{ success: boolean }> {
  const { error } = await (supabaseAdmin as any)
    .from('wellness_notification_prefs')
    .upsert({ user_id: userId, stretch_reminder: enabled, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) return { success: false }
  return { success: true }
}

// ── Admin: mood stats ─────────────────────────────────────────

export async function getAdminMoodStats(): Promise<{
  today: { avg: number; count: number }
  week: { avg: number; count: number }
  byUser: { name: string; avg: number; count: number }[]
  trend: { date: string; avg: number; count: number }[]
}> {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  const { data: allCheckins } = await (supabaseAdmin as any)
    .from('mood_checkins')
    .select(`*, user_profile:user_profiles!mood_checkins_user_id_fkey(full_name, display_name)`)
    .order('date', { ascending: false })
    .limit(1000)

  const all = allCheckins ?? []

  const todayData = all.filter((c: any) => c.date === today)
  const weekData = all.filter((c: any) => c.date >= weekAgoStr)

  const avg = (arr: any[]) => arr.length ? arr.reduce((s: number, c: any) => s + c.rating, 0) / arr.length : 0

  // By user (last 30 days)
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)
  const monthAgoStr = monthAgo.toISOString().split('T')[0]
  const monthData = all.filter((c: any) => c.date >= monthAgoStr)
  const byUserMap: Record<string, { name: string; ratings: number[] }> = {}
  for (const c of monthData) {
    if (!byUserMap[c.user_id]) {
      byUserMap[c.user_id] = {
        name: c.user_profile?.display_name || c.user_profile?.full_name || 'Unknown',
        ratings: [],
      }
    }
    byUserMap[c.user_id].ratings.push(c.rating)
  }

  const byUser = Object.values(byUserMap)
    .map(u => ({ name: u.name, avg: u.ratings.reduce((a, b) => a + b, 0) / u.ratings.length, count: u.ratings.length }))
    .sort((a, b) => b.count - a.count)

  // Trend (last 30 days)
  const byDate: Record<string, number[]> = {}
  for (const c of monthData) {
    if (!byDate[c.date]) byDate[c.date] = []
    byDate[c.date].push(c.rating)
  }
  const trend = Object.entries(byDate)
    .map(([date, ratings]) => ({ date, avg: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    today: { avg: avg(todayData), count: todayData.length },
    week: { avg: avg(weekData), count: weekData.length },
    byUser,
    trend,
  }
}
