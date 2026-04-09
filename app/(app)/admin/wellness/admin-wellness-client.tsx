'use client'

import Link from 'next/link'
import type { WellnessEvent } from '@/lib/actions/wellness'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Heart, TrendingUp, Users, Calendar, BarChart3, Star, Smile } from 'lucide-react'

const MOODS = [
  { rating: 1, emoji: '😞', label: 'Struggling', color: 'bg-red-400' },
  { rating: 2, emoji: '😕', label: 'Low', color: 'bg-orange-400' },
  { rating: 3, emoji: '😐', label: 'Okay', color: 'bg-amber-400' },
  { rating: 4, emoji: '😊', label: 'Good', color: 'bg-green-400' },
  { rating: 5, emoji: '🌟', label: 'Great', color: 'bg-emerald-500' },
]

const getMoodEmoji = (avg: number) => {
  if (avg >= 4.5) return '🌟'
  if (avg >= 3.5) return '😊'
  if (avg >= 2.5) return '😐'
  if (avg >= 1.5) return '😕'
  return '😞'
}

const getMoodColor = (avg: number) => {
  if (avg >= 4.5) return 'text-emerald-600'
  if (avg >= 3.5) return 'text-green-600'
  if (avg >= 2.5) return 'text-amber-600'
  if (avg >= 1.5) return 'text-orange-600'
  return 'text-red-600'
}

interface Props {
  stats: {
    today: { avg: number; count: number }
    week: { avg: number; count: number }
    byUser: { name: string; avg: number; count: number }[]
    trend: { date: string; avg: number; count: number }[]
  }
  upcomingEvents: WellnessEvent[]
}

export default function AdminWellnessClient({ stats, upcomingEvents }: Props) {
  const maxTrend = Math.max(...stats.trend.map(t => t.avg), 5)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Heart className="h-5 w-5 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Wellness Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-[52px]">Team mood trends and wellbeing overview</p>
          </div>
          <Link href="/wellness" className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1.5 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-xl">
            <Heart className="h-4 w-4" />
            My Wellness
          </Link>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: "Today's avg mood",
              value: stats.today.count > 0 ? `${stats.today.avg.toFixed(1)}/5` : 'No data',
              emoji: stats.today.count > 0 ? getMoodEmoji(stats.today.avg) : '—',
              sub: `${stats.today.count} check-in${stats.today.count !== 1 ? 's' : ''}`,
              color: stats.today.count > 0 ? getMoodColor(stats.today.avg) : 'text-muted-foreground',
              bg: 'bg-green-50 dark:bg-green-950/30',
            },
            {
              label: "This week's avg",
              value: stats.week.count > 0 ? `${stats.week.avg.toFixed(1)}/5` : 'No data',
              emoji: stats.week.count > 0 ? getMoodEmoji(stats.week.avg) : '—',
              sub: `${stats.week.count} check-ins`,
              color: stats.week.count > 0 ? getMoodColor(stats.week.avg) : 'text-muted-foreground',
              bg: 'bg-blue-50 dark:bg-blue-950/30',
            },
            {
              label: 'Active participants',
              value: stats.byUser.length.toString(),
              emoji: '👥',
              sub: 'staff with check-ins (30d)',
              color: 'text-indigo-600',
              bg: 'bg-indigo-50 dark:bg-indigo-950/30',
            },
            {
              label: 'Upcoming events',
              value: upcomingEvents.length.toString(),
              emoji: '📅',
              sub: 'wellness activities',
              color: 'text-amber-600',
              bg: 'bg-amber-50 dark:bg-amber-950/30',
            },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl px-4 py-4 border border-border/50', s.bg)}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{s.emoji}</span>
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              </div>
              <p className="text-xs font-medium text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Mood trend chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Team mood trend (last 30 days)
            </h3>
            {stats.trend.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No mood data yet.</div>
            ) : (
              <>
                <div className="flex items-end gap-1 h-32">
                  {stats.trend.map(t => {
                    const heightPct = (t.avg / maxTrend) * 100
                    const mood = MOODS.find(m => m.rating === Math.round(t.avg)) ?? MOODS[2]
                    return (
                      <div key={t.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div
                          className={cn('w-full rounded-t transition-all', mood.color)}
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                        />
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-foreground text-background text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                          {mood.emoji} {t.avg.toFixed(1)} · {format(new Date(t.date), 'd MMM')} ({t.count})
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{format(new Date(stats.trend[0].date), 'd MMM')}</span>
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Note: Individual staff mood ratings are anonymous. Only team averages are shown here.
            </p>
          </div>

          {/* Upcoming events */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-500" />
                Events
              </h3>
              <Link href="/wellness/events" className="text-xs text-green-600 hover:text-green-700 font-medium">View all</Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming events.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center shrink-0 text-sm">📅</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(e.event_date), 'EEE d MMM')} · {e.rsvp_count ?? 0} going</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Per-user breakdown */}
        <div className="mt-6 bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            Participation (last 30 days)
          </h3>
          {stats.byUser.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No check-ins in the last 30 days.</p>
          ) : (
            <div className="space-y-2">
              {stats.byUser.map(u => (
                <div key={u.name} className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{u.name}</span>
                      <span className={cn('text-sm font-bold', getMoodColor(u.avg))}>
                        {getMoodEmoji(u.avg)} {u.avg.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${(u.avg / 5) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.count} check-ins</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
            Individual mood notes and daily ratings remain private to each staff member.
          </p>
        </div>
      </div>
    </div>
  )
}
