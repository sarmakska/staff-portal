'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MoodCheckin, WellnessEvent, WellnessPrefs } from '@/lib/actions/wellness'
import { submitMoodCheckin } from '@/lib/actions/wellness'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
  Heart, Leaf, Wind, Calendar, TrendingUp, Dumbbell,
  ChevronRight, Loader2, CheckCircle2, Star,
  Sparkles, Users, Clock, MapPin,
} from 'lucide-react'

// ── Mood data ─────────────────────────────────────────────────

const MOODS = [
  { rating: 1, emoji: '😞', label: 'Struggling', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800/40' },
  { rating: 2, emoji: '😕', label: 'Low', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800/40' },
  { rating: 3, emoji: '😐', label: 'Okay', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/40' },
  { rating: 4, emoji: '😊', label: 'Good', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800/40' },
  { rating: 5, emoji: '🌟', label: 'Great', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/40' },
]

const getMoodInfo = (r: number) => MOODS.find(m => m.rating === r) ?? MOODS[2]

interface Props {
  userId: string
  todayMood: MoodCheckin | null
  moodHistory: MoodCheckin[]
  upcomingEvents: WellnessEvent[]
  prefs: WellnessPrefs
}

export default function WellnessHubClient({ userId, todayMood, moodHistory, upcomingEvents, prefs }: Props) {
  const router = useRouter()
  const [selectedMood, setSelectedMood] = useState<number | null>(todayMood?.rating ?? null)
  const [moodNote, setMoodNote] = useState(todayMood?.note ?? '')
  const [checkedIn, setCheckedIn] = useState(!!todayMood)
  const [submitting, setSubmitting] = useState(false)
  const [showNote, setShowNote] = useState(false)

  const today = format(new Date(), 'EEEE, d MMMM')
  const moodInfo = selectedMood ? getMoodInfo(selectedMood) : null

  const streak = (() => {
    if (!moodHistory.length) return 0
    let s = 0
    const d = new Date()
    for (let i = 0; i < 30; i++) {
      const dateStr = d.toISOString().split('T')[0]
      if (moodHistory.find(m => m.date === dateStr)) { s++; d.setDate(d.getDate() - 1) }
      else break
    }
    return s
  })()

  async function handleMoodSubmit() {
    if (!selectedMood) return
    setSubmitting(true)
    const result = await submitMoodCheckin(selectedMood, moodNote)
    setSubmitting(false)
    if (result.success) {
      setCheckedIn(true)
      router.refresh()
    }
  }

  const avgMood = moodHistory.length
    ? (moodHistory.reduce((s, m) => s + m.rating, 0) / moodHistory.length).toFixed(1)
    : null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Heart className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Wellness Hub</h1>
              <p className="text-sm text-muted-foreground">{today}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">

            {/* Mood check-in */}
            <div className={cn(
              'rounded-2xl border p-6',
              checkedIn
                ? 'bg-gradient-to-br from-green-50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/10 border-green-200 dark:border-green-800/40'
                : 'bg-card border-border'
            )}>
              {checkedIn ? (
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{moodInfo?.emoji}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700 dark:text-green-400">Mood logged for today</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{moodInfo?.label}</p>
                    {moodNote && <p className="text-sm text-muted-foreground mt-1 italic">"{moodNote}"</p>}
                    <button
                      onClick={() => setCheckedIn(false)}
                      className="text-xs text-muted-foreground hover:text-foreground underline mt-2 transition-colors"
                    >
                      Update
                    </button>
                  </div>
                  {streak > 1 && (
                    <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-xl">
                      <Star className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">{streak} day streak</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-foreground">How are you feeling today?</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Anonymous — only you see your personal ratings</p>
                    </div>
                    {streak > 0 && (
                      <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-xl">
                        <Star className="h-3.5 w-3.5" />
                        <span className="text-xs font-bold">{streak}d</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mb-4">
                    {MOODS.map(m => (
                      <button
                        key={m.rating}
                        onClick={() => setSelectedMood(m.rating)}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all duration-200',
                          selectedMood === m.rating
                            ? cn(m.bg, m.border, 'scale-105 shadow-sm')
                            : 'border-border hover:bg-muted/50 hover:scale-105'
                        )}
                      >
                        <span className="text-2xl">{m.emoji}</span>
                        <span className={cn('text-[10px] font-semibold', selectedMood === m.rating ? m.color : 'text-muted-foreground')}>
                          {m.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {selectedMood && (
                    <div className="space-y-3">
                      {!showNote ? (
                        <button onClick={() => setShowNote(true)} className="text-xs text-muted-foreground hover:text-foreground underline transition-colors">
                          + Add a note (optional)
                        </button>
                      ) : (
                        <textarea
                          value={moodNote}
                          onChange={e => setMoodNote(e.target.value)}
                          placeholder="What's on your mind? (optional)"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none"
                        />
                      )}
                      <button
                        onClick={handleMoodSubmit}
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
                        Log mood
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Mood history mini chart */}
            {moodHistory.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Last 14 days
                  </h3>
                  <Link href="/wellness/my-journey" className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                    Full journey <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="flex items-end gap-1.5 h-16">
                  {moodHistory.slice(0, 14).reverse().map((m, i) => {
                    const info = getMoodInfo(m.rating)
                    const height = `${(m.rating / 5) * 100}%`
                    return (
                      <div key={m.id} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div
                          className={cn('w-full rounded-t-sm transition-all', info.bg)}
                          style={{ height }}
                        />
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none bg-foreground text-background text-xs px-2 py-1 rounded-lg whitespace-nowrap transition-opacity z-10">
                          {info.emoji} {format(new Date(m.date), 'd MMM')}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {moodHistory.slice(0, 14).reverse().filter((_, i) => i === 0 || i === 6 || i === 13).map(m => (
                    <span key={m.date} className="text-[10px] text-muted-foreground">{format(new Date(m.date), 'd MMM')}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick access tiles */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { href: '/wellness/stretches', icon: Dumbbell, label: 'Stretching', sub: 'Guided exercises', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                { href: '/wellness/breathing', icon: Wind, label: 'Breathing', sub: 'Calm your mind', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                { href: '/wellness/events', icon: Calendar, label: 'Events', sub: `${upcomingEvents.length} upcoming`, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group bg-card border border-border hover:border-green-300 rounded-2xl p-4 flex flex-col items-center text-center gap-2 transition-all hover:shadow-sm"
                >
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', item.bg)}>
                    <item.icon className={cn('h-5 w-5', item.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* Stats */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Your Stats
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Check-in streak</span>
                  <span className="font-bold text-foreground">{streak} {streak === 1 ? 'day' : 'days'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg mood (2 weeks)</span>
                  <span className="font-bold text-foreground">{avgMood ? `${avgMood}/5` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total check-ins</span>
                  <span className="font-bold text-foreground">{moodHistory.length}</span>
                </div>
              </div>
              <Link
                href="/wellness/my-journey"
                className="mt-4 flex items-center justify-center gap-2 w-full py-2 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                View my journey <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Upcoming events */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-500" />
                  Events
                </h3>
                <Link href="/wellness/events" className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                  All <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No upcoming events.</p>
                  <Link href="/wellness/events" className="text-xs text-green-600 hover:underline">Create one</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(e => (
                    <Link
                      key={e.id}
                      href={`/wellness/events/${e.id}`}
                      className="block group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                          <Calendar className="h-4.5 w-4.5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground group-hover:text-green-600 transition-colors line-clamp-1">{e.title}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(e.event_date), 'd MMM')}{e.event_time ? ` · ${e.event_time.slice(0, 5)}` : ''}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {e.rsvp_count && e.rsvp_count > 0 ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />{e.rsvp_count} going
                              </span>
                            ) : null}
                            {e.user_rsvp && (
                              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />You're in
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/10 border border-green-200 dark:border-green-800/40 rounded-2xl p-5">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
                <Leaf className="h-4 w-4" />
                Wellness tip
              </h3>
              <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">
                Taking a 2-minute stretch break every 90 minutes can reduce muscle tension by up to 30% and boost focus significantly.
              </p>
              <Link href="/wellness/stretches" className="mt-3 block text-xs font-semibold text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 flex items-center gap-1 transition-colors">
                Try a stretch now <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
