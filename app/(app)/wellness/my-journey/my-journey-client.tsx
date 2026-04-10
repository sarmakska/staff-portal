'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MoodCheckin, StretchCompletion, BreathingSession, WellnessPrefs } from '@/lib/actions/wellness'
import { saveWellnessPrefs } from '@/lib/actions/wellness'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
  ArrowLeft, TrendingUp, Dumbbell, Wind, Settings,
  Star, Heart, Flame, Bell, CheckCircle2, Loader2,
} from 'lucide-react'

const MOODS = [
  { rating: 1, emoji: '😞', label: 'Struggling', color: 'bg-red-400' },
  { rating: 2, emoji: '😕', label: 'Low', color: 'bg-orange-400' },
  { rating: 3, emoji: '😐', label: 'Okay', color: 'bg-amber-400' },
  { rating: 4, emoji: '😊', label: 'Good', color: 'bg-green-400' },
  { rating: 5, emoji: '🌟', label: 'Great', color: 'bg-emerald-500' },
]

const getMoodInfo = (r: number) => MOODS.find(m => m.rating === r) ?? MOODS[2]

interface Props {
  userId: string
  moodHistory: MoodCheckin[]
  stretchHistory: StretchCompletion[]
  breathingHistory: BreathingSession[]
  prefs: WellnessPrefs
}

export default function MyJourneyClient({ userId, moodHistory, stretchHistory, breathingHistory, prefs: initialPrefs }: Props) {
  const [tab, setTab] = useState<'mood' | 'activity' | 'settings'>('mood')
  const [prefs, setPrefs] = useState(initialPrefs)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const totalStretchMins = stretchHistory.reduce((t, s) => t + Math.round(s.duration_secs / 60), 0)
  const totalBreathingMins = breathingHistory.reduce((t, b) => t + Math.round(b.duration_secs / 60), 0)
  const avgMood = moodHistory.length ? (moodHistory.reduce((s, m) => s + m.rating, 0) / moodHistory.length).toFixed(1) : null

  const streak = (() => {
    if (!moodHistory.length) return 0
    let s = 0
    const d = new Date()
    for (let i = 0; i < 60; i++) {
      const dateStr = d.toISOString().split('T')[0]
      if (moodHistory.find(m => m.date === dateStr)) { s++; d.setDate(d.getDate() - 1) }
      else break
    }
    return s
  })()

  async function savePrefs() {
    setSaving(true)
    await saveWellnessPrefs(prefs)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/wellness" className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-600" />
              My Wellness Journey
            </h1>
            <p className="text-sm text-muted-foreground">Your personal wellbeing history and preferences</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Star, label: 'Streak', value: `${streak}d`, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
            { icon: Heart, label: 'Avg mood', value: avgMood ? `${avgMood}/5` : '—', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
            { icon: Dumbbell, label: 'Stretch time', value: `${totalStretchMins}m`, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { icon: Wind, label: 'Breathing', value: `${breathingHistory.length} sessions`, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl px-4 py-3 border border-border/50', s.bg)}>
              <s.icon className={cn('h-4 w-4 mb-1', s.color)} />
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'mood', label: 'Mood History', icon: Heart },
            { key: 'activity', label: 'Activity', icon: Flame },
            { key: 'settings', label: 'Notifications', icon: Settings },
          ].map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                  tab === t.key ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Mood history */}
        {tab === 'mood' && (
          <div>
            {moodHistory.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">No mood check-ins yet. Start from the Wellness Hub.</p>
              </div>
            ) : (
              <>
                {/* Mini chart */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-5">
                  <h3 className="font-semibold text-foreground mb-4">Mood over time (last 30 days)</h3>
                  <div className="flex items-end gap-1 h-20">
                    {moodHistory.slice(0, 30).reverse().map(m => {
                      const info = getMoodInfo(m.rating)
                      return (
                        <div key={m.id} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          <div
                            className={cn('w-full rounded-t min-h-[4px] transition-all', info.color)}
                            style={{ height: `${(m.rating / 5) * 100}%` }}
                          />
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-foreground text-background text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                            {info.emoji} {format(new Date(m.date), 'd MMM')}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{moodHistory.length >= 30 ? format(new Date(moodHistory[29].date), 'd MMM') : ''}</span>
                    <span className="text-xs text-muted-foreground">Today</span>
                  </div>
                </div>

                {/* Log list */}
                <div className="space-y-2">
                  {moodHistory.map(m => {
                    const info = getMoodInfo(m.rating)
                    return (
                      <div key={m.id} className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3">
                        <span className="text-xl">{info.emoji}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{info.label}</span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className={cn('h-1.5 w-1.5 rounded-full', i <= m.rating ? info.color : 'bg-border')} />
                              ))}
                            </div>
                          </div>
                          {m.note && <p className="text-xs text-muted-foreground italic mt-0.5">"{m.note}"</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(m.date), 'EEE d MMM')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Activity */}
        {tab === 'activity' && (
          <div className="space-y-5">
            {/* Stretch history */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-blue-600" />
                Stretch Sessions
              </h3>
              {stretchHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stretch sessions yet. <Link href="/wellness/stretches" className="text-blue-600 underline">Try one now.</Link></p>
              ) : (
                <div className="space-y-2">
                  {stretchHistory.slice(0, 15).map(s => (
                    <div key={s.id} className="flex items-center gap-4 py-2 border-b border-border/50 last:border-0">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                        <Dumbbell className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground capitalize">{s.session_type} session</p>
                        <p className="text-xs text-muted-foreground">{s.stretches_done} stretches · {Math.round(s.duration_secs / 60)} min</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(s.completed_at), 'd MMM')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Breathing history */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Wind className="h-4 w-4 text-purple-600" />
                Breathing Sessions
              </h3>
              {breathingHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No breathing sessions yet. <Link href="/wellness/breathing" className="text-purple-600 underline">Try one now.</Link></p>
              ) : (
                <div className="space-y-2">
                  {breathingHistory.slice(0, 15).map(b => (
                    <div key={b.id} className="flex items-center gap-4 py-2 border-b border-border/50 last:border-0">
                      <div className="h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                        <Wind className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{b.technique === '4-7-8' ? '4-7-8 Breathing' : b.technique === 'box' ? 'Box Breathing' : b.technique === 'diaphragmatic' ? 'Deep Belly' : 'Energizing Breath'}</p>
                        <p className="text-xs text-muted-foreground">{Math.round(b.duration_secs / 60)} min</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(b.completed_at), 'd MMM')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notification settings */}
        {tab === 'settings' && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <Bell className="h-4 w-4 text-green-500" />
              Wellness Notifications
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Control which emails you receive from the Wellness Hub.</p>

            <div className="space-y-4">
              {[
                { key: 'new_event', label: 'New Event Created', desc: 'When anyone adds a new wellness event' },
                { key: 'event_joined', label: 'Someone joined your event', desc: 'When staff RSVP to your events' },
                { key: 'event_starting_soon', label: 'Event starting soon', desc: 'Reminder an hour before an event you joined' },
                { key: 'stretch_reminder', label: 'Stretch reminders', desc: 'Midday and afternoon nudges to take a break' },
                { key: 'weekly_summary', label: 'Weekly wellness summary', desc: 'Monday morning recap of your week' },
              ].map(item => (
                <label key={item.key} className="flex items-start gap-4 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={prefs[item.key as keyof WellnessPrefs] as boolean}
                      onChange={e => setPrefs(p => ({ ...p, [item.key]: e.target.checked }))}
                      className="sr-only"
                    />
                    <div className={cn(
                      'w-10 h-5 rounded-full transition-colors',
                      prefs[item.key as keyof WellnessPrefs] ? 'bg-green-600' : 'bg-muted'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                        prefs[item.key as keyof WellnessPrefs] ? 'translate-x-5' : 'translate-x-0.5'
                      )} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <button
                onClick={savePrefs}
                disabled={saving}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : null}
                {saved ? 'Saved!' : 'Save preferences'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
