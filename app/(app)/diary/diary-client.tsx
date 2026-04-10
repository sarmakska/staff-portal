"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { DeleteDiaryButton } from "@/components/shared/delete-diary-button"
import {
  Plus, ChevronLeft, ChevronRight, BookOpen,
  Bell, BellOff, CheckCircle2, CalendarDays, List,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Entry {
  id: string
  title: string
  content: string | null
  tags: string[]
  created_at: string
  reminder_at: string | null
  reminder_sent: boolean
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function ReminderPill({ reminderAt, reminderSent }: { reminderAt: string; reminderSent: boolean }) {
  const d = new Date(reminderAt)
  const now = new Date()
  const past = d <= now
  const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

  if (reminderSent) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="h-2.5 w-2.5" />Sent · {label}
    </span>
  )
  if (past) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
      <BellOff className="h-2.5 w-2.5" />Missed · {label}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
      <Bell className="h-2.5 w-2.5" />Reminder · {label}
    </span>
  )
}

function EntryCard({ entry }: { entry: Entry }) {
  const preview = entry.content ? stripHtml(entry.content).slice(0, 140) : null
  const displayDate = entry.reminder_at ? new Date(entry.reminder_at) : new Date(entry.created_at)
  return (
    <div className="group flex gap-3 bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all hover:border-primary/30">
      {/* Date block */}
      <div className="flex flex-col items-center justify-center w-12 shrink-0 bg-primary/5 border border-primary/15 rounded-xl py-2 px-1">
        <span className="text-[10px] font-semibold text-primary uppercase leading-none">
          {displayDate.toLocaleDateString("en-GB", { month: "short" })}
        </span>
        <span className="text-xl font-black text-foreground leading-tight">
          {displayDate.getDate()}
        </span>
        <span className="text-[9px] text-muted-foreground leading-none">
          {displayDate.toLocaleDateString("en-GB", { weekday: "short" })}
        </span>
      </div>

      {/* Content */}
      <Link href={`/diary/${entry.id}`} className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {entry.title}
        </p>
        {preview && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{preview}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {entry.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-2 rounded-md font-medium">
              {tag}
            </Badge>
          ))}
          {entry.reminder_at && (
            <ReminderPill reminderAt={entry.reminder_at} reminderSent={entry.reminder_sent} />
          )}
        </div>
      </Link>

      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <DeleteDiaryButton id={entry.id} />
      </div>
    </div>
  )
}

export function DiaryClient({ entries }: { entries: Entry[] }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [view, setView] = useState<"calendar" | "list">("calendar")
  const [filterYear, setFilterYear] = useState<number | "all">("all")
  const [filterMonth, setFilterMonth] = useState<number | "all">("all") // 0-indexed

  // Build lookup: "YYYY-MM-DD" → entries[]
  const entryByDay = useMemo(() => {
    const map: Record<string, Entry[]> = {}
    entries.forEach(e => {
      const d = new Date(e.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return map
  }, [entries])

  // Build lookup for reminders: "YYYY-MM-DD" → true
  const reminderByDay = useMemo(() => {
    const map: Record<string, boolean> = {}
    entries.forEach(e => {
      if (!e.reminder_at) return
      const d = new Date(e.reminder_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      map[key] = true
    })
    return map
  }, [entries])

  // Calendar grid days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    // Monday = 0
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(startDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewYear, viewMonth])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }

  // Filtered entries for the list
  const filteredEntries = useMemo(() => {
    if (view === "calendar") {
      if (selectedDay !== null) {
        const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
        return entryByDay[key] ?? []
      }
      // Show all entries for current month
      return entries.filter(e => {
        const d = new Date(e.created_at)
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth
      })
    } else {
      // List view with year/month filter
      return entries.filter(e => {
        const d = new Date(e.created_at)
        if (filterYear !== "all" && d.getFullYear() !== filterYear) return false
        if (filterMonth !== "all" && d.getMonth() !== filterMonth) return false
        return true
      })
    }
  }, [view, entries, entryByDay, viewYear, viewMonth, selectedDay, filterYear, filterMonth])

  // Year options for list filter
  const yearOptions = useMemo(() => {
    const years = new Set(entries.map(e => new Date(e.created_at).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [entries])

  const monthlyCounts = useMemo(() => {
    const m: Record<string, number> = {}
    entries.forEach(e => {
      const d = new Date(e.created_at)
      const k = `${d.getFullYear()}-${d.getMonth()}`
      m[k] = (m[k] ?? 0) + 1
    })
    return m
  }, [entries])

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diary</h1>
          <p className="text-sm text-muted-foreground">Your personal work diary</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setView("calendar")}
              className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                view === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <CalendarDays className="h-3.5 w-3.5" />Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-border",
                view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <List className="h-3.5 w-3.5" />All Entries
            </button>
          </div>
          <Button className="rounded-xl gap-2" asChild>
            <Link href="/diary/new"><Plus className="h-4 w-4" />New Entry</Link>
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-7 w-7 text-muted-foreground" />}
          title="No diary entries yet"
          description="Start logging your work diary entries."
          action={<Button asChild className="rounded-xl"><Link href="/diary/new">New Entry</Link></Button>}
        />
      ) : view === "calendar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

          {/* Calendar panel */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-center">
                <p className="font-bold text-foreground text-sm">{MONTHS[viewMonth]}</p>
                <p className="text-xs text-muted-foreground">{viewYear}</p>
              </div>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 p-2 gap-1">
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={i} />
                const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const hasEntry = !!entryByDay[key]
                const hasReminder = !!reminderByDay[key]
                const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day
                const isSelected = selectedDay === day
                const entryCount = entryByDay[key]?.length ?? 0

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-xl py-1.5 text-sm font-medium transition-all h-10 w-full",
                      isSelected && "bg-primary text-primary-foreground shadow-sm",
                      !isSelected && isToday && "bg-primary/10 text-primary font-bold",
                      !isSelected && !isToday && hasEntry && "bg-muted hover:bg-accent",
                      !isSelected && !isToday && !hasEntry && "text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    <span className="leading-none">{day}</span>
                    {/* Indicator dots */}
                    {(hasEntry || hasReminder) && (
                      <div className="flex gap-0.5 mt-0.5">
                        {hasEntry && (
                          <span className={cn("h-1.5 w-1.5 rounded-full",
                            isSelected ? "bg-primary-foreground" : "bg-primary")}
                          />
                        )}
                        {hasReminder && (
                          <span className={cn("h-1.5 w-1.5 rounded-full",
                            isSelected ? "bg-amber-200" : "bg-amber-500")}
                          />
                        )}
                      </div>
                    )}
                    {/* Entry count badge */}
                    {entryCount > 1 && (
                      <span className={cn(
                        "absolute -top-0.5 -right-0.5 text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center",
                        isSelected ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                      )}>
                        {entryCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block" />Entry</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />Reminder</span>
            </div>

            {/* Month summary */}
            <div className="px-4 py-3 border-t border-border">
              <p className="text-xs font-semibold text-foreground mb-2">This month</p>
              <div className="flex gap-3 text-xs">
                <div className="flex-1 bg-primary/5 border border-primary/15 rounded-xl p-2 text-center">
                  <p className="text-lg font-black text-primary">{monthlyCounts[`${viewYear}-${viewMonth}`] ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Entries</p>
                </div>
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
                  <p className="text-lg font-black text-amber-600">
                    {entries.filter(e => {
                      if (!e.reminder_at) return false
                      const d = new Date(e.reminder_at)
                      return d.getFullYear() === viewYear && d.getMonth() === viewMonth
                    }).length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Reminders</p>
                </div>
              </div>
            </div>
          </div>

          {/* Entry list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {selectedDay !== null
                  ? `${selectedDay} ${MONTHS[viewMonth]} ${viewYear}`
                  : `${MONTHS[viewMonth]} ${viewYear}`}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"})
                </span>
              </p>
              {selectedDay !== null && (
                <button onClick={() => setSelectedDay(null)} className="text-xs text-primary hover:underline">
                  Show all month
                </button>
              )}
            </div>

            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl">
                <BookOpen className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">No entries</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedDay !== null ? "No entries on this day." : "No entries this month."}
                </p>
                <Button asChild size="sm" className="rounded-xl mt-4 gap-1.5">
                  <Link href="/diary/new"><Plus className="h-3.5 w-3.5" />New Entry</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map(e => <EntryCard key={e.id} entry={e} />)}
              </div>
            )}
          </div>
        </div>

      ) : (
        /* ── List / All Entries view ── */
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterYear === "all" ? "all" : String(filterYear)}
              onChange={e => setFilterYear(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={filterMonth === "all" ? "all" : String(filterMonth)}
              onChange={e => setFilterMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All months</option>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <span className="text-xs text-muted-foreground ml-1">
              {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl">
              <BookOpen className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No entries found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map(e => <EntryCard key={e.id} entry={e} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
