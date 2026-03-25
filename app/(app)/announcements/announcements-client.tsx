'use client'

import { useState, useTransition } from 'react'
import {
  Megaphone, Send, CalendarDays, MapPin, Clock, CheckCircle2,
  XCircle, Loader2, ChevronDown, ChevronUp, History, Eye, ArrowRight,
} from 'lucide-react'
import { submitAnnouncement } from '@/lib/actions/announcements'
import { ANNOUNCEMENT_CATEGORIES } from '@/lib/announcement-categories'
import type { AnnouncementCategory } from '@/lib/announcement-categories'

interface AnnouncementRecord {
  id: string
  subject: string
  body: string
  category: string
  sent_by_name: string
  sent_at: string
  has_event: boolean
  event_title?: string
  event_date?: string
  event_end_date?: string
  event_time?: string
  event_location?: string
}

interface Props { history: AnnouncementRecord[] }

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function getCat(value: string) {
  return ANNOUNCEMENT_CATEGORIES.find(c => c.value === value) ?? ANNOUNCEMENT_CATEGORIES[0]
}

function CategoryBadge({ value }: { value: string }) {
  const cat = getCat(value)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cat.color}`}>
      {cat.emoji} {cat.label}
    </span>
  )
}

function EmailPreview({ category, subject, body, sentByName, hasEvent, eventTitle, eventDate, eventEndDate, eventTime, eventLocation }: {
  category: string; subject: string; body: string; sentByName: string
  hasEvent: boolean; eventTitle: string; eventDate: string; eventEndDate: string; eventTime: string; eventLocation: string
}) {
  const cat = getCat(category)
  const dateDisplay = hasEvent && eventDate
    ? (eventEndDate && eventEndDate !== eventDate ? `${fmtDate(eventDate)} → ${fmtDate(eventEndDate)}` : fmtDate(eventDate))
    : ''

  return (
    <div className="rounded-2xl border border-border overflow-hidden text-sm shadow-sm">
      <div className="bg-muted/50 border-b border-border px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-rose-400"/><div className="h-2.5 w-2.5 rounded-full bg-amber-400"/><div className="h-2.5 w-2.5 rounded-full bg-emerald-400"/></div>
        <span className="ml-2 text-xs text-muted-foreground font-mono">Email Preview — admin@yourcompany.com</span>
      </div>
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-6 py-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">StaffPortal</p>
          <p className="text-lg font-black text-white">Staff Announcement</p>
        </div>
        <div className="text-right space-y-1.5">
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 inline-block">
            <p className="text-[10px] text-gray-400">From</p>
            <p className="text-xs font-bold text-white">{sentByName || 'Your Name'}</p>
          </div>
          <div><span className="bg-white/10 rounded-full px-3 py-1 text-xs text-gray-300">{cat.emoji} {cat.label}</span></div>
        </div>
      </div>
      <div className="bg-blue-700 px-6 py-3">
        <p className="text-sm font-bold text-white">{subject ? `${cat.emoji} ${subject}` : 'Your subject will appear here'}</p>
      </div>
      <div className="bg-white px-6 py-5">
        {body ? body.split('\n').filter(Boolean).map((l, i) => (
          <p key={i} className="text-sm text-gray-700 leading-relaxed mb-3">{l}</p>
        )) : <p className="text-sm text-gray-400 italic">Your message will appear here...</p>}

        {hasEvent && eventTitle && eventDate && (
          <div className="mt-4 rounded-xl border-2 border-blue-200 overflow-hidden">
            <div className="flex">
              <div className="bg-blue-600 px-3 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-white" /></div>
              <div className="bg-blue-50 px-4 py-3 flex-1">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">Calendar Event</p>
                <p className="text-sm font-bold text-blue-900">{eventTitle}</p>
                <p className="text-xs text-blue-700 font-semibold mt-1">📆 {dateDisplay}</p>
                {eventTime && <p className="text-xs text-blue-700 font-semibold">⏰ {eventTime}</p>}
                {eventLocation && <p className="text-xs text-blue-700 font-semibold">📍 {eventLocation}</p>}
              </div>
            </div>
            <div className="bg-blue-100 px-4 py-2 text-center">
              <p className="text-[11px] text-blue-700 font-semibold">📎 Calendar invite attached — one click to add to Outlook, Google Calendar or Apple Calendar</p>
            </div>
          </div>
        )}
      </div>
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex justify-between">
        <p className="text-[11px] text-gray-400">Sent via <strong className="text-gray-500">StaffPortal</strong> by {sentByName || 'You'}</p>
        <p className="text-[11px] text-gray-400">your-staffportal-url.com</p>
      </div>
    </div>
  )
}

export default function AnnouncementsClient({ history }: Props) {
  const [category, setCategory] = useState<AnnouncementCategory>('general')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [hasEvent, setHasEvent] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventEndDate, setEventEndDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [localHistory, setLocalHistory] = useState(history)

  const selectedCat = getCat(category)
  const isOoo = category === 'ooo'

  function reset() {
    setSubject(''); setBody(''); setHasEvent(false); setCategory('general')
    setEventTitle(''); setEventDate(''); setEventEndDate(''); setEventTime('')
    setEventLocation(''); setEventDescription(''); setShowPreview(false)
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) { setResult({ ok: false, msg: 'Subject and message are required.' }); return }
    if (hasEvent && (!eventTitle.trim() || !eventDate)) { setResult({ ok: false, msg: 'Please fill in the calendar entry title and set a From Date.' }); return }
    startTransition(async () => {
      const r = await submitAnnouncement({
        category,
        subject: subject.trim(),
        body: body.trim(),
        hasEvent,
        eventTitle: eventTitle.trim() || undefined,
        eventDate: eventDate || undefined,
        eventEndDate: eventEndDate || undefined,
        eventTime: eventTime || undefined,
        eventLocation: eventLocation.trim() || undefined,
        eventDescription: eventDescription.trim() || undefined,
      })
      if (r.success) {
        setResult({ ok: true, msg: 'Announcement sent to all staff.' })
        setLocalHistory(prev => [{
          id: Date.now().toString(), subject: subject.trim(), body: body.trim(), category,
          sent_by_name: 'You', sent_at: new Date().toISOString(),
          has_event: hasEvent && !!eventTitle && !!eventDate,
          event_title: eventTitle || undefined, event_date: eventDate || undefined,
          event_end_date: eventEndDate || undefined, event_time: eventTime || undefined,
          event_location: eventLocation || undefined,
        }, ...prev])
        reset()
      } else {
        setResult({ ok: false, msg: r.error ?? 'Failed to send. Please try again.' })
      }
      setTimeout(() => setResult(null), 6000)
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-md">
          <Megaphone className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Staff Announcement</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send an email to <strong>admin@yourcompany.com</strong> — the whole team sees it instantly.
          </p>
        </div>
      </div>

      {/* Compose card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

        {/* From/to bar */}
        <div className="px-5 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-2 flex-wrap">
          <Send className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-mono text-xs bg-muted border border-border rounded px-2 py-0.5">notifications@sarmalinux.com</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="font-mono text-xs bg-muted border border-border rounded px-2 py-0.5">admin@yourcompany.com</span>
        </div>

        <div className="p-5 space-y-4">

          {/* Category picker */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Announcement Type</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {ANNOUNCEMENT_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => {
                    setCategory(cat.value as AnnouncementCategory)
                    if (cat.value === 'ooo') setHasEvent(true)
                  }}
                  className={`rounded-xl border-2 p-2.5 text-center transition-all ${
                    category === cat.value
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40 bg-muted/20'
                  }`}
                >
                  <div className="text-xl mb-1">{cat.emoji}</div>
                  <p className="text-[10px] font-bold text-foreground leading-tight">{cat.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Subject</label>
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedCat.emoji}</span>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={
                  category === 'ooo' ? 'e.g. Out of Office — Sarah (Dubai trip)' :
                  category === 'event' ? 'e.g. All-Staff Meeting — Friday 2pm' :
                  category === 'closure' ? 'e.g. Office Closed — Bank Holiday Monday' :
                  category === 'celebrate' ? 'e.g. Happy Birthday Jai! 🎂' :
                  category === 'newjoiner' ? 'e.g. Welcome to the team — Mark!' :
                  category === 'urgent' ? 'e.g. Action Required: Please Read' :
                  'e.g. Important Update for All Staff'
                }
                className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              placeholder={
                category === 'ooo' ? 'e.g. Hi everyone, I will be out of the office from Monday 24th March to Friday 28th March on a business trip to Dubai. For urgent matters please contact Sai.' :
                category === 'newjoiner' ? 'e.g. Please join me in welcoming Mark to the team! Mark joins us as...' :
                'Write your announcement here. Each new line becomes a separate paragraph in the email.'
              }
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none leading-relaxed"
            />
          </div>

          {/* Date range — always visible */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1 block">
                  <CalendarDays className="h-3 w-3" /> {isOoo ? 'First day away' : 'From Date'} <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1 block">
                  <CalendarDays className="h-3 w-3" /> {isOoo ? 'Last day away' : 'To Date'} <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={eventEndDate}
                  min={eventDate}
                  onChange={e => setEventEndDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            {!isOoo && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1 block"><Clock className="h-3 w-3" /> Time <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></label>
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1 block"><MapPin className="h-3 w-3" /> Location <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></label>
                  <input value={eventLocation} onChange={e => setEventLocation(e.target.value)}
                    placeholder="Board Room / Teams..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            )}
            {eventDate && (
              <p className="text-xs text-primary font-semibold">
                📅 {eventEndDate && eventEndDate !== eventDate ? `${fmtDate(eventDate)} → ${fmtDate(eventEndDate)}` : fmtDate(eventDate)}
                {eventTime && ` · ${eventTime}`}
              </p>
            )}
          </div>

          {/* Calendar invite toggle */}
          <div className={`rounded-xl border-2 transition-colors ${hasEvent ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20' : 'border-border bg-muted/10'}`}>
            <button
              onClick={() => setHasEvent(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${hasEvent ? 'bg-blue-600' : 'bg-muted'}`}>
                  <CalendarDays className={`h-4 w-4 ${hasEvent ? 'text-white' : 'text-muted-foreground'}`} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-bold ${hasEvent ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'}`}>
                    Send calendar invite (.ics)
                  </p>
                  <p className="text-xs text-muted-foreground">Recipients get a file — one click adds to Outlook or Google Calendar</p>
                </div>
              </div>
              <div className={`h-6 w-11 rounded-full transition-all duration-300 relative shrink-0 ${hasEvent ? 'bg-blue-600' : 'bg-muted-foreground/30'}`}>
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${hasEvent ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>

            {hasEvent && (
              <div className="px-4 pb-4 border-t border-blue-200 dark:border-blue-800 pt-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                    {isOoo ? 'Calendar entry title' : 'Event Title'} *
                  </label>
                  <input
                    value={eventTitle}
                    onChange={e => setEventTitle(e.target.value)}
                    placeholder={isOoo ? 'e.g. Sarah — Out of Office (Dubai)' : 'e.g. All-Staff Meeting'}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Calendar Notes <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></label>
                  <textarea value={eventDescription} onChange={e => setEventDescription(e.target.value)} rows={2}
                    placeholder="Any extra details for the calendar invite..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {eventDate ? `Dates used: ${eventEndDate && eventEndDate !== eventDate ? `${fmtDate(eventDate)} → ${fmtDate(eventEndDate)}` : fmtDate(eventDate)}` : 'Set dates above to include them in the calendar invite.'}
                </p>
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${result.ok ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800'}`}>
              {result.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <XCircle className="h-5 w-5 text-rose-600 shrink-0" />}
              <p className={`text-sm font-semibold ${result.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{result.msg}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors">
              <Eye className="h-4 w-4" />{showPreview ? 'Hide Preview' : 'Preview Email'}
            </button>
            <button onClick={handleSend} disabled={isPending || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 text-sm font-bold text-white transition-colors ml-auto">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isPending ? 'Sending…' : 'Send to All Staff'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      {showPreview && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Live Preview</p>
          <EmailPreview category={category} subject={subject} body={body} sentByName="You"
            hasEvent={hasEvent} eventTitle={eventTitle} eventDate={eventDate}
            eventEndDate={eventEndDate} eventTime={eventTime} eventLocation={eventLocation} />
        </div>
      )}

      {/* History */}
      {localHistory.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Sent Announcements</p>
          </div>
          <div className="space-y-2">
            {localHistory.map(a => (
              <div key={a.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  className="w-full px-5 py-4 flex items-start justify-between gap-4 text-left hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge value={a.category ?? 'general'} />
                      {a.has_event && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5">
                          <CalendarDays className="h-3 w-3" /> Event
                          {a.event_date && ` · ${fmtDate(a.event_date)}${a.event_end_date && a.event_end_date !== a.event_date ? ` → ${fmtDate(a.event_end_date)}` : ''}`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-foreground truncate">{a.subject}</p>
                    <p className="text-xs text-muted-foreground">By {a.sent_by_name} · {fmtDateTime(a.sent_at)}</p>
                  </div>
                  {expandedId === a.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                </button>
                {expandedId === a.id && (
                  <div className="px-5 pb-4 border-t border-border/50 pt-3 space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{a.body}</p>
                    {a.has_event && a.event_title && a.event_date && (
                      <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Calendar Event</p>
                        <p className="text-sm font-bold text-foreground">{a.event_title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {fmtDate(a.event_date)}
                          {a.event_end_date && a.event_end_date !== a.event_date && ` → ${fmtDate(a.event_end_date)}`}
                          {a.event_time && ` · ${a.event_time}`}
                          {a.event_location && ` · ${a.event_location}`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
