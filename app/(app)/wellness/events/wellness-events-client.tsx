'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { WellnessEvent } from '@/lib/actions/wellness'
import { createWellnessEvent, toggleEventRsvp, deleteWellnessEvent } from '@/lib/actions/wellness'
import { cn } from '@/lib/utils'
import { format, isPast } from 'date-fns'
import {
  ArrowLeft, Calendar, Plus, X, Users, MapPin, Clock,
  CheckCircle2, Loader2, AlertTriangle, Trash2, Heart,
} from 'lucide-react'

const EVENT_TYPES = [
  { value: 'team', label: 'Team Activity', emoji: '👥' },
  { value: 'workout', label: 'Workout', emoji: '🏋️' },
  { value: 'meditation', label: 'Meditation', emoji: '🧘' },
  { value: 'walk', label: 'Walk / Run', emoji: '🚶' },
  { value: 'social', label: 'Social', emoji: '☕' },
  { value: 'workshop', label: 'Workshop', emoji: '📚' },
  { value: 'other', label: 'Other', emoji: '🌟' },
]

const getTypeInfo = (t: string) => EVENT_TYPES.find(e => e.value === t) ?? EVENT_TYPES[EVENT_TYPES.length - 1]

interface Props {
  userId: string
  upcomingEvents: WellnessEvent[]
  pastEvents: WellnessEvent[]
}

export default function WellnessEventsClient({ userId, upcomingEvents: initial, pastEvents }: Props) {
  const router = useRouter()
  const [events, setEvents] = useState(initial)
  const [showNew, setShowNew] = useState(false)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [submitting, setSubmitting] = useState(false)
  const [rsvping, setRsvping] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [_, startTransition] = useTransition()

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'team',
    event_date: '',
    event_time: '',
    duration_mins: 30,
    location: '',
    max_participants: '',
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.event_date) { setError('Title and date are required.'); return }
    setSubmitting(true)
    setError('')
    const result = await createWellnessEvent({
      ...form,
      duration_mins: Number(form.duration_mins),
      max_participants: form.max_participants ? Number(form.max_participants) : undefined,
    })
    setSubmitting(false)
    if (!result.success) { setError(result.error ?? 'Something went wrong.'); return }
    setShowNew(false)
    startTransition(() => router.refresh())
  }

  async function handleRsvp(eventId: string) {
    setRsvping(eventId)
    const result = await toggleEventRsvp(eventId)
    setRsvping(null)
    if (result.success) {
      setEvents(prev => prev.map(e =>
        e.id === eventId
          ? { ...e, user_rsvp: result.joined, rsvp_count: (e.rsvp_count ?? 0) + (result.joined ? 1 : -1) }
          : e
      ))
    }
  }

  async function handleDelete(eventId: string) {
    const result = await deleteWellnessEvent(eventId)
    if (!result.success) return
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }

  const EventCard = ({ event }: { event: WellnessEvent }) => {
    const typeInfo = getTypeInfo(event.type)
    const isOwner = event.user_id === userId
    const isFull = event.max_participants && (event.rsvp_count ?? 0) >= event.max_participants && !event.user_rsvp

    return (
      <div className="bg-card border border-border rounded-2xl p-5 hover:border-green-300 transition-all group">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0 text-2xl">
            {typeInfo.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-foreground leading-snug">{event.title}</h3>
              {isOwner && (
                <button
                  onClick={() => handleDelete(event.id)}
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(event.event_date), 'EEE, d MMM')}
                {event.event_time && ` · ${event.event_time.slice(0, 5)}`}
              </span>
              {event.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {event.duration_mins} min
              </span>
            </div>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
            )}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {event.rsvp_count ?? 0} going
                  {event.max_participants && ` / ${event.max_participants}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  by {event.organiser?.display_name || event.organiser?.full_name}
                </span>
              </div>
              {!isPast(new Date(event.event_date)) && (
                <button
                  onClick={() => handleRsvp(event.id)}
                  disabled={!!rsvping || (!!isFull)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                    event.user_rsvp
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600'
                      : isFull
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                  )}
                >
                  {rsvping === event.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : event.user_rsvp ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" />Joined</>
                  ) : isFull ? (
                    'Full'
                  ) : (
                    <><Heart className="h-3.5 w-3.5" />Join</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/wellness" className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-6 w-6 text-green-600" />
                Wellness Events
              </h1>
              <p className="text-sm text-muted-foreground">Team activities, walks, workshops and more</p>
            </div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add event
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['upcoming', 'past'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize',
                tab === t ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {t} {t === 'upcoming' ? `(${events.length})` : `(${pastEvents.length})`}
            </button>
          ))}
        </div>

        {/* Events list */}
        {tab === 'upcoming' && (
          <>
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="text-5xl mb-4">🌱</span>
                <h3 className="font-semibold text-foreground mb-1">No upcoming events</h3>
                <p className="text-sm text-muted-foreground mb-4">Be the first to organise something!</p>
                <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                  <Plus className="h-4 w-4" /> Create event
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </>
        )}

        {tab === 'past' && (
          <>
            {pastEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">No past events.</p>
            ) : (
              <div className="space-y-4 opacity-75">
                {pastEvents.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </>
        )}

        {/* New event modal */}
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">New Wellness Event</h2>
                <button onClick={() => { setShowNew(false); setError('') }} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {EVENT_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, type: t.value }))}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all',
                          form.type === t.value
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        <span className="text-lg">{t.emoji}</span>
                        <span className="leading-tight text-center">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Event title <span className="text-red-500">*</span></label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="E.g. Morning walk around the park" className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Date <span className="text-red-500">*</span></label>
                    <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Time</label>
                    <input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Duration (mins)</label>
                    <input type="number" value={form.duration_mins} onChange={e => setForm(f => ({ ...f, duration_mins: Number(e.target.value) }))} min={5} max={480} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Max participants</label>
                    <input type="number" value={form.max_participants} onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))} placeholder="Unlimited" min={1} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="E.g. Meeting room 1, Park entrance, Online" className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Tell people what to expect..." rows={3} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none" />
                </div>

                {error && <p className="text-sm text-red-500 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setShowNew(false); setError('') }} className="flex-1 px-4 py-2.5 text-sm font-semibold border border-border rounded-xl hover:bg-muted transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                    Create event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
