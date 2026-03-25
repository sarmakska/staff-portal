"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  ChevronLeft, ChevronRight, Plus, X,
  Plane, Home, Sun, Users, Clock, Briefcase, Calendar, Thermometer,
} from "lucide-react"
import { toast } from "sonner"
import { deleteCalendarEvent } from "@/lib/actions/calendar"
import { deleteWfhByEventId } from "@/lib/actions/attendance"

type CalendarEvent = {
  id: string; title: string; event_type: string
  description: string | null; canDelete: boolean; deleteType: "wfh" | "calendar"
}
type CalendarDay = {
  date: string; isCurrentMonth: boolean; isToday: boolean; events: CalendarEvent[]
}
interface Props {
  calendarDays: CalendarDay[]; prevMonth: string; nextMonth: string
  currentMonthLabel: string; canCreateEvents: boolean; todayStr: string
}

/* ─── Palette ─────────────────────────────────────────────── */
type Swatch = { grad: string; soft: string; dot: string; ring: string; badge: string }
const EV: Record<string, Swatch> = {
  leave:       { grad: "linear-gradient(135deg,#f43f5e,#e11d48)", soft: "bg-rose-50 dark:bg-rose-950/40",   dot: "bg-rose-400",    ring: "ring-rose-300 dark:ring-rose-700",   badge: "text-rose-600 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 border-rose-200 dark:border-rose-800" },
  sick:        { grad: "linear-gradient(135deg,#0ea5e9,#0284c7)", soft: "bg-sky-50 dark:bg-sky-950/40",     dot: "bg-sky-400",     ring: "ring-sky-300 dark:ring-sky-700",     badge: "text-sky-600 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 border-sky-200 dark:border-sky-800" },
  wfh:         { grad: "linear-gradient(135deg,#10b981,#059669)", soft: "bg-emerald-50 dark:bg-emerald-950/40", dot: "bg-emerald-400", ring: "ring-emerald-300 dark:ring-emerald-700", badge: "text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800" },
  holiday:     { grad: "linear-gradient(135deg,#6366f1,#4f46e5)", soft: "bg-indigo-50 dark:bg-indigo-950/40", dot: "bg-indigo-400",  ring: "ring-indigo-300 dark:ring-indigo-700",  badge: "text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800" },
  team:        { grad: "linear-gradient(135deg,#8b5cf6,#7c3aed)", soft: "bg-violet-50 dark:bg-violet-950/40", dot: "bg-violet-400",  ring: "ring-violet-300 dark:ring-violet-700",  badge: "text-violet-600 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/60 border-violet-200 dark:border-violet-800" },
  early_leave: { grad: "linear-gradient(135deg,#f59e0b,#d97706)", soft: "bg-amber-50 dark:bg-amber-950/40",  dot: "bg-amber-400",   ring: "ring-amber-300 dark:ring-amber-700",   badge: "text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 border-amber-200 dark:border-amber-800" },
  visitor:     { grad: "linear-gradient(135deg,#64748b,#475569)", soft: "bg-slate-50 dark:bg-slate-900/40",  dot: "bg-slate-400",   ring: "ring-slate-300 dark:ring-slate-700",   badge: "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700" },
}
const DEVS: Swatch = { grad: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/.7))", soft: "bg-primary/5", dot: "bg-primary/60", ring: "ring-primary/30", badge: "text-primary bg-primary/10 border-primary/20" }

const ICONS: Record<string, React.ElementType> = {
  leave: Plane, sick: Thermometer, wfh: Home, holiday: Sun,
  team: Users, early_leave: Clock, visitor: Briefcase,
}
const LEGEND = [
  { type: "leave",       label: "Annual Leave" },
  { type: "sick",        label: "Sick Leave" },
  { type: "wfh",         label: "Work From Home" },
  { type: "holiday",     label: "Public Holiday" },
  { type: "team",        label: "Team Event" },
  { type: "early_leave", label: "Early Departure" },
  { type: "visitor",     label: "Visitor" },
]
const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
const MINI_H     = ["M","T","W","T","F","S","S"]

/* ─── Keyframes ───────────────────────────────────────────── */
const CSS = `
  @keyframes _kfade { from{opacity:0} to{opacity:1} }
  @keyframes _kup   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes _kleft { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes _krt   { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes _kchip { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
  @keyframes _kring { 0%,100%{box-shadow:0 0 0 0 hsl(var(--primary)/.5)} 55%{box-shadow:0 0 0 8px hsl(var(--primary)/0)} }
  @keyframes _kbar  { from{width:0%} to{width:var(--bw)} }
  @keyframes _kpop  { 0%{opacity:0;transform:scale(.94) translateY(8px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
  ._sl  { animation:_kleft .38s cubic-bezier(.22,1,.36,1) both }
  ._sr  { animation:_krt   .38s cubic-bezier(.22,1,.36,1) both }
  ._sc  { animation:_kfade .22s ease both }
  ._ch  { animation:_kchip .18s ease both }
  ._rg  { animation:_kring 3s ease-in-out infinite }
  ._br  { animation:_kbar  .9s  cubic-bezier(.22,1,.36,1) both }
  ._pop { animation:_kpop  .3s  cubic-bezier(.22,1,.36,1) both }
  ._up  { animation:_kup   .3s  cubic-bezier(.22,1,.36,1) both }
`

/* ─── Helpers ─────────────────────────────────────────────── */
function fmt(d: string, o: Intl.DateTimeFormatOptions) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", o)
}
function sw(t: string): Swatch { return EV[t] ?? DEVS }

const AVC = ["bg-rose-400","bg-sky-500","bg-emerald-500","bg-violet-500","bg-amber-500","bg-indigo-500","bg-pink-500","bg-teal-500"]
function Avatar({ name, size = "h-7 w-7" }: { name: string; size?: string }) {
  const clean = name.replace(/ \(.*\)/, "")
  const init  = clean.split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
  return (
    <span className={`flex items-center justify-center rounded-full text-white font-bold text-[10px] shrink-0 ring-2 ring-white dark:ring-[#0b0c11] ${AVC[(clean.charCodeAt(0)||0) % AVC.length]} ${size}`}>
      {init || "?"}
    </span>
  )
}

/* ─── Component ───────────────────────────────────────────── */
export function CalendarClient({
  calendarDays, prevMonth, nextMonth, currentMonthLabel, todayStr,
}: Props) {
  const [selDay, setSelDay] = useState<CalendarDay | null>(null)
  const [detEvt, setDetEvt] = useState<(CalendarEvent & { date: string }) | null>(null)
  const [pending, startT]   = useTransition()

  function del(e: CalendarEvent) {
    if (!confirm(`Delete "${e.title}"?`)) return
    startT(async () => {
      const r = e.deleteType === "wfh" ? await deleteWfhByEventId(e.id) : await deleteCalendarEvent(e.id)
      if (r.success) { toast.success("Deleted"); setDetEvt(null) }
      else toast.error(r.error || "Failed")
    })
  }

  const monthDays   = calendarDays.filter(d => d.isCurrentMonth)
  const totalEvs    = monthDays.reduce((s, d) => s + d.events.length, 0)
  const leaveEvs    = monthDays.reduce((s, d) => s + d.events.filter(e => ["leave","sick"].includes(e.event_type)).length, 0)
  const wfhEvs      = monthDays.reduce((s, d) => s + d.events.filter(e => e.event_type === "wfh").length, 0)
  const legCounts   = Object.fromEntries(LEGEND.map(l => [l.type, monthDays.reduce((s,d)=>s+d.events.filter(e=>e.event_type===l.type).length,0)]))

  const todayEvents = calendarDays.find(d => d.date === todayStr)?.events ?? []
  const offToday    = todayEvents.filter(e => ["leave","sick"].includes(e.event_type))
  const wfhToday    = todayEvents.filter(e => e.event_type === "wfh")

  const todayIdx = calendarDays.findIndex(d => d.date === todayStr)
  const wkStart  = todayIdx >= 0 ? Math.floor(todayIdx / 7) * 7 : 0
  const thisWeek = calendarDays.slice(wkStart, wkStart + 7)
  const upcoming = calendarDays.filter(d => d.date > todayStr && d.events.length > 0).slice(0, 5)

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div className="flex bg-muted/30 dark:bg-[#07080c]" style={{ minHeight: "calc(100dvh - 4rem)" }}>
      <style>{CSS}</style>

      {/* ══ LEFT SIDEBAR ══════════════════════════════════════ */}
      <aside
        className="_sl hidden lg:flex w-[230px] shrink-0 flex-col gap-3 p-3 border-r border-border dark:border-white/[0.08] bg-background dark:bg-[#0b0c12] sticky top-0 self-start overflow-y-auto"
        style={{ height: "calc(100dvh - 4rem)" }}
      >
        {/* New event */}
        <Link href="/calendar/new"
          className="relative flex items-center justify-center gap-2 w-full rounded-2xl h-11 text-[13px] font-bold text-primary-foreground shadow-lg overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.97] bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Event
        </Link>

        {/* Mini calendar card */}
        <div className="rounded-2xl border border-border dark:border-white/[0.09] bg-card dark:bg-white/[0.03] p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-foreground">{currentMonthLabel}</span>
            <div className="flex gap-0.5">
              <Link href={`/calendar?month=${prevMonth}`} className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link href={`/calendar?month=${nextMonth}`} className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-7">
            {MINI_H.map((h, i) => (
              <div key={i} className="h-6 flex items-center justify-center text-[9px] font-bold text-muted-foreground uppercase">{h}</div>
            ))}
            {calendarDays.map(day => {
              const n = parseInt(day.date.split("-")[2])
              const isSel = selDay?.date === day.date
              return (
                <div key={day.date} className="h-7 flex items-center justify-center">
                  <button
                    onClick={() => setSelDay(isSel ? null : day)}
                    className={[
                      "relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-150",
                      day.isToday ? "_rg bg-primary text-primary-foreground shadow-md" : "",
                      isSel && !day.isToday ? "bg-primary/15 text-primary font-bold ring-1 ring-primary/40" : "",
                      !day.isToday && !isSel && day.isCurrentMonth ? "text-foreground/75 hover:bg-muted" : "",
                      !day.isCurrentMonth ? "text-muted-foreground/30" : "",
                    ].join(" ")}
                  >
                    {n}
                    {day.events.length > 0 && !day.isToday && !isSel && day.isCurrentMonth && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full bg-primary/60" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Events", val: totalEvs, color: "text-primary", bg: "bg-primary/10 dark:bg-primary/15" },
            { label: "Leave",  val: leaveEvs, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950/50" },
            { label: "WFH",    val: wfhEvs,   color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-2.5 text-center ${s.bg}`}>
              <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="rounded-2xl border border-border dark:border-white/[0.09] bg-card dark:bg-white/[0.03] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-foreground/60 mb-3">Event Types</p>
          <div className="space-y-2">
            {LEGEND.map(({ type, label }) => {
              const s    = sw(type)
              const Icon = ICONS[type] ?? Calendar
              const cnt  = legCounts[type] ?? 0
              return (
                <div key={type} className="flex items-center gap-2 group/l">
                  <span
                    className="h-5 w-5 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover/l:scale-110"
                    style={{ background: s.grad }}
                  >
                    <Icon className="h-2.5 w-2.5 text-white" />
                  </span>
                  <span className="text-[10.5px] font-medium text-foreground/75 flex-1">{label}</span>
                  {cnt > 0 && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${s.badge}`}>{cnt}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      {/* ══ MAIN CALENDAR ═════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border dark:border-white/[0.08] bg-background/95 dark:bg-[#07080c]/95 backdrop-blur-md sticky top-0 z-20">
          <Link href="/calendar"
            className="h-8 px-4 flex items-center rounded-lg border border-border dark:border-white/[0.12] text-[13px] font-semibold text-foreground hover:bg-muted transition-all active:scale-[0.97]"
          >Today</Link>
          <div className="flex">
            <Link href={`/calendar?month=${prevMonth}`} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4 text-foreground/60" />
            </Link>
            <Link href={`/calendar?month=${nextMonth}`} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4 text-foreground/60" />
            </Link>
          </div>
          <h2 className="text-[17px] font-extrabold text-foreground tracking-tight">{currentMonthLabel}</h2>
          <div className="flex-1" />
          <Link href="/calendar/new"
            className="lg:hidden flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-[12px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          ><Plus className="h-3.5 w-3.5" /> New</Link>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border dark:border-white/[0.08] bg-muted/40 dark:bg-[#07080c]">
          {DAYS_SHORT.map((d, i) => (
            <div key={d} className={[
              "py-3 text-center text-[10px] font-extrabold uppercase tracking-widest select-none",
              i < 6 ? "border-r border-border dark:border-white/[0.07]" : "",
              i >= 5 ? "text-muted-foreground/50 bg-muted/60 dark:bg-white/[0.02]" : "text-muted-foreground/80",
            ].join(" ")}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 flex-1 bg-background dark:bg-[#07080c]">
          {calendarDays.map((day, idx) => {
            const col     = idx % 7
            const isWknd  = col >= 5
            const notLast = col < 6
            const n       = parseInt(day.date.split("-")[2])
            const isSel   = selDay?.date === day.date

            return (
              <div
                key={day.date}
                onClick={() => setSelDay(isSel ? null : day)}
                style={{ animationDelay: `${idx * 5}ms` }}
                className={[
                  "_sc min-h-[100px] flex flex-col border-b border-border dark:border-white/[0.07] cursor-pointer select-none",
                  notLast ? "border-r border-border dark:border-white/[0.07]" : "",
                  !day.isCurrentMonth ? "opacity-40 bg-muted/30 dark:bg-white/[0.01]" : "",
                  isWknd && day.isCurrentMonth && !day.isToday && !isSel ? "bg-muted/50 dark:bg-white/[0.02]" : "",
                  day.isCurrentMonth && !isWknd && !day.isToday && !isSel ? "bg-background dark:bg-[#07080c]" : "",
                  day.isToday && !isSel ? "bg-primary/[0.05] dark:bg-primary/[0.10]" : "",
                  isSel ? "bg-primary/[0.08] dark:bg-primary/[0.16] ring-2 ring-inset ring-primary/40" : "hover:bg-muted/60 dark:hover:bg-white/[0.04]",
                  "transition-colors duration-150",
                ].join(" ")}
              >
                {/* Date + count */}
                <div className="flex items-start justify-between px-2.5 pt-2.5 pb-2">
                  <span className={[
                    "h-7 w-7 flex items-center justify-center rounded-full text-[12.5px] font-bold transition-all duration-150",
                    day.isToday ? "_rg text-primary-foreground shadow-lg" : "",
                    isSel && !day.isToday ? "bg-primary/15 text-primary font-black" : "",
                    !day.isToday && !isSel && day.isCurrentMonth ? isWknd ? "text-muted-foreground/60" : "text-foreground" : "",
                    !day.isCurrentMonth ? "text-muted-foreground/35" : "",
                  ].join(" ")}
                  style={day.isToday ? { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/.75))" } : {}}
                  >
                    {n}
                  </span>
                  {day.events.length > 0 && (
                    <span className="text-[9px] font-bold text-muted-foreground/60 mt-1.5 tabular-nums">{day.events.length}</span>
                  )}
                </div>

                {/* Event chips */}
                <div className="flex flex-col gap-[3px] px-1.5 pb-2 flex-1">
                  {day.events.slice(0, 3).map((e, ei) => {
                    const s    = sw(e.event_type)
                    const Icon = ICONS[e.event_type] ?? Calendar
                    return (
                      <button
                        key={e.id}
                        onClick={ev => { ev.stopPropagation(); setDetEvt({ ...e, date: day.date }) }}
                        style={{ background: s.grad, animationDelay: `${idx * 5 + ei * 20 + 40}ms` }}
                        className="_ch w-full text-left flex items-center gap-1.5 rounded-lg px-2 py-[4px] text-[10px] font-semibold text-white truncate shadow-sm hover:shadow-md hover:scale-[1.015] active:scale-[0.98] transition-all duration-100"
                      >
                        <Icon className="h-2.5 w-2.5 shrink-0 opacity-90" />
                        <span className="truncate">{e.title}</span>
                      </button>
                    )
                  })}
                  {day.events.length > 3 && (
                    <button
                      onClick={ev => { ev.stopPropagation(); setSelDay(day) }}
                      className="text-left text-[9px] font-bold text-muted-foreground/60 hover:text-foreground px-2 py-[2px] w-fit transition-colors"
                    >
                      +{day.events.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {/* ══ MOBILE SIDEBAR CONTENT ═══════════════════════════ */}
        <div className="lg:hidden flex flex-col gap-3 p-3 pb-28 bg-muted/10 border-t border-border">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Events", val: totalEvs, color: "text-primary", bg: "bg-primary/10" },
              { label: "Leave",  val: leaveEvs, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950/50" },
              { label: "WFH",    val: wfhEvs,   color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
            ].map(s => (
              <div key={s.label} className={`rounded-xl p-3 text-center ${s.bg}`}>
                <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Today card */}
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 relative overflow-hidden bg-foreground/[0.88]">
              <div className="absolute inset-0 opacity-[0.08]" style={{ background: "radial-gradient(circle at 80% 30%, white, transparent 55%)" }} />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-background/60 mb-1">Today</p>
              <p className="text-[15px] font-black text-background">{fmt(todayStr, { weekday: "long" })}</p>
              <p className="text-[11px] font-medium text-background/65">{fmt(todayStr, { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div className="bg-card divide-y divide-border/40">
              {todayEvents.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic px-4 py-3">Nothing on today</p>
              ) : todayEvents.slice(0, 4).map(e => {
                const s = sw(e.event_type)
                const Icon = ICONS[e.event_type] ?? Calendar
                return (
                  <button key={e.id} onClick={() => setDetEvt({ ...e, date: todayStr })}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <span className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.grad }}>
                      <Icon className="h-3 w-3 text-white" />
                    </span>
                    <span className="text-[11px] font-semibold text-foreground/85 truncate">{e.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* People Today */}
          {(offToday.length > 0 || wfhToday.length > 0) && (
            <SideCard title="People Today">
              <div className="p-3 space-y-3">
                {offToday.length > 0 && (
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-wide text-foreground/55 mb-2">On Leave</p>
                    <div className="space-y-2">
                      {offToday.map(e => (
                        <div key={e.id} className="flex items-center gap-2.5">
                          <Avatar name={e.title} size="h-7 w-7" />
                          <span className="text-[11px] font-semibold text-foreground/80 truncate flex-1">{e.title.replace(/ \(.*\)/, "")}</span>
                          <span className={`h-2 w-2 rounded-full shrink-0 ${e.event_type === "sick" ? "bg-sky-400" : "bg-rose-400"}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {wfhToday.length > 0 && (
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-wide text-foreground/55 mb-2">WFH</p>
                    <div className="space-y-2">
                      {wfhToday.map(e => (
                        <div key={e.id} className="flex items-center gap-2.5">
                          <Avatar name={e.title} size="h-7 w-7" />
                          <span className="text-[11px] font-semibold text-foreground/80 truncate flex-1">{e.title.replace(/ \(WFH.*\)/, "")}</span>
                          <span className="h-2 w-2 rounded-full shrink-0 bg-emerald-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SideCard>
          )}

          {/* This Week */}
          <SideCard title="This Week">
            <div className="divide-y divide-border/30">
              {thisWeek.map(day => {
                const isToday = day.date === todayStr
                const n = parseInt(day.date.split("-")[2])
                return (
                  <button key={day.date + "-mw"}
                    onClick={() => setSelDay(selDay?.date === day.date ? null : day)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isToday ? "bg-primary/[0.05]" : "hover:bg-muted/30"}`}
                  >
                    <div className="flex flex-col items-center w-8 shrink-0">
                      <span className={`text-[8px] font-black uppercase ${isToday ? "text-primary" : "text-muted-foreground/60"}`}>
                        {fmt(day.date, { weekday: "short" })}
                      </span>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black mt-0.5 ${isToday ? "text-primary-foreground" : "text-foreground/70"}`}
                        style={isToday ? { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/.7))" } : {}}
                      >{n}</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {day.events.length === 0
                        ? <p className="text-[9.5px] text-muted-foreground/35">No events</p>
                        : day.events.slice(0, 2).map(e => {
                            const s = sw(e.event_type)
                            return (
                              <div key={e.id} className="flex items-center gap-1.5 min-w-0">
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.grad }} />
                                <span className="text-[10px] font-medium text-foreground/75 truncate">{e.title}</span>
                              </div>
                            )
                          })
                      }
                      {day.events.length > 2 && <p className="text-[9px] text-muted-foreground/40 pl-3">+{day.events.length - 2}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </SideCard>

          {/* Coming Up */}
          {upcoming.length > 0 && (
            <SideCard title="Coming Up">
              <div className="p-3 space-y-3">
                {upcoming.map(day => (
                  <div key={day.date + "-mc"}>
                    <p className="text-[8px] font-bold uppercase tracking-wide text-foreground/50 mb-1.5">
                      {fmt(day.date, { weekday: "short", day: "numeric", month: "short" })}
                    </p>
                    {day.events.slice(0, 2).map(e => {
                      const s = sw(e.event_type)
                      const Icon = ICONS[e.event_type] ?? Calendar
                      return (
                        <button key={e.id} onClick={() => setDetEvt({ ...e, date: day.date })}
                          className="w-full mb-1 text-left flex items-center gap-2 rounded-xl px-3 py-2 text-[10.5px] font-semibold text-white transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.97]"
                          style={{ background: s.grad }}
                        >
                          <Icon className="h-3 w-3 shrink-0 opacity-85" />
                          <span className="truncate">{e.title}</span>
                        </button>
                      )
                    })}
                    {day.events.length > 2 && <p className="text-[8.5px] text-muted-foreground/40 pl-1">+{day.events.length - 2} more</p>}
                  </div>
                ))}
              </div>
            </SideCard>
          )}

          {/* Mini calendar */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-foreground">{currentMonthLabel}</span>
              <div className="flex gap-0.5">
                <Link href={`/calendar?month=${prevMonth}`} className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <Link href={`/calendar?month=${nextMonth}`} className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-7">
              {MINI_H.map((h, i) => (
                <div key={i} className="h-6 flex items-center justify-center text-[9px] font-bold text-muted-foreground uppercase">{h}</div>
              ))}
              {calendarDays.map(day => {
                const n = parseInt(day.date.split("-")[2])
                const isSel = selDay?.date === day.date
                return (
                  <div key={day.date + "-mm"} className="h-7 flex items-center justify-center">
                    <button
                      onClick={() => setSelDay(isSel ? null : day)}
                      className={[
                        "relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-150",
                        day.isToday ? "_rg text-primary-foreground shadow-md" : "",
                        isSel && !day.isToday ? "bg-primary/15 text-primary font-bold ring-1 ring-primary/40" : "",
                        !day.isToday && !isSel && day.isCurrentMonth ? "text-foreground/75 hover:bg-muted" : "",
                        !day.isCurrentMonth ? "text-muted-foreground/30" : "",
                      ].join(" ")}
                      style={day.isToday ? { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/.75))" } : {}}
                    >
                      {n}
                      {day.events.length > 0 && !day.isToday && !isSel && day.isCurrentMonth && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full bg-primary/60" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-foreground/60 mb-3">Event Types</p>
            <div className="grid grid-cols-2 gap-2">
              {LEGEND.map(({ type, label }) => {
                const s = sw(type)
                const Icon = ICONS[type] ?? Calendar
                const cnt = legCounts[type] ?? 0
                return (
                  <div key={type + "-ml"} className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md flex items-center justify-center shrink-0" style={{ background: s.grad }}>
                      <Icon className="h-2.5 w-2.5 text-white" />
                    </span>
                    <span className="text-[10px] font-medium text-foreground/75 flex-1 truncate">{label}</span>
                    {cnt > 0 && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${s.badge}`}>{cnt}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ══ RIGHT SIDEBAR ═════════════════════════════════════ */}
      <aside
        className="_sr hidden lg:flex w-[272px] shrink-0 flex-col gap-3 p-3 border-l border-border dark:border-white/[0.08] bg-background dark:bg-[#0b0c12] sticky top-0 self-start overflow-y-auto"
        style={{ height: "calc(100dvh - 4rem)" }}
      >

        {/* ── DAY DETAIL (when a day is selected) ── */}
        {selDay ? (
          <div className="_pop flex flex-col gap-3">
            {/* Day header */}
            <div className="rounded-2xl border border-border/50 dark:border-white/[0.07] overflow-hidden">
              <div
                className="px-4 py-4 relative"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/.65))" }}
              >
                <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 80% 20%, white, transparent 60%)" }} />
                <button onClick={() => setSelDay(null)} className="absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30 transition-colors">
                  <X className="h-3.5 w-3.5 text-primary-foreground" />
                </button>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary-foreground/55 mb-1">Selected</p>
                <p className="text-[22px] font-black text-primary-foreground leading-none">{fmt(selDay.date, { day: "numeric" })}</p>
                <p className="text-[12px] font-semibold text-primary-foreground/70 mt-0.5">{fmt(selDay.date, { weekday: "long", month: "long", year: "numeric" })}</p>
              </div>

              {/* Events for selected day */}
              {selDay.events.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <Calendar className="h-7 w-7 text-muted-foreground/25 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground/50">No events this day</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 dark:divide-white/[0.05]">
                  {selDay.events.map(e => {
                    const s    = sw(e.event_type)
                    const Icon = ICONS[e.event_type] ?? Calendar
                    return (
                      <button key={e.id}
                        onClick={() => setDetEvt({ ...e, date: selDay.date })}
                        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/30 dark:hover:bg-white/[0.04] transition-colors group/di"
                      >
                        <span className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: s.grad }}>
                          <Icon className="h-4 w-4 text-white" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-bold text-foreground truncate">{e.title}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{e.event_type.replace(/_/g, " ")}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <Link href="/calendar/new"
              className="flex items-center justify-center gap-2 w-full h-10 rounded-xl text-[13px] font-bold text-primary-foreground shadow-md transition-all hover:scale-[1.01] hover:shadow-lg active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/.7))" }}
            ><Plus className="h-4 w-4" /> Add Event</Link>
          </div>

        ) : (
          /* ── OVERVIEW ── */
          <>
            {/* Today card */}
            <div className="rounded-2xl border border-border/50 dark:border-white/[0.07] overflow-hidden">
              <div className="px-4 py-3.5 relative overflow-hidden bg-foreground/[0.88]">
                <div className="absolute inset-0 opacity-[0.08]" style={{ background: "radial-gradient(circle at 80% 30%, white, transparent 55%)" }} />
                <p className="text-[8.5px] font-black uppercase tracking-[0.2em] text-background/50 mb-1">Today</p>
                <p className="text-[15px] font-black text-background">{fmt(todayStr, { weekday: "long" })}</p>
                <p className="text-[11px] font-medium text-background/65">{fmt(todayStr, { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <div className="bg-card divide-y divide-border/40 dark:divide-white/[0.05]">
                {todayEvents.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic px-4 py-3">Nothing on today</p>
                ) : todayEvents.slice(0, 4).map(e => {
                  const s    = sw(e.event_type)
                  const Icon = ICONS[e.event_type] ?? Calendar
                  return (
                    <button key={e.id} onClick={() => setDetEvt({ ...e, date: todayStr })}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.grad }}>
                        <Icon className="h-3 w-3 text-white" />
                      </span>
                      <span className="text-[11px] font-semibold text-foreground/85 truncate">{e.title}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* People today */}
            {(offToday.length > 0 || wfhToday.length > 0) && (
              <SideCard title="People Today">
                <div className="p-3 space-y-3">
                  {offToday.length > 0 && (
                    <div>
                      <p className="text-[8.5px] font-bold uppercase tracking-wide text-foreground/55 mb-2">On Leave</p>
                      <div className="space-y-2">
                        {offToday.map(e => (
                          <div key={e.id} className="flex items-center gap-2.5">
                            <Avatar name={e.title} size="h-7 w-7" />
                            <span className="text-[11px] font-semibold text-foreground/80 truncate flex-1">{e.title.replace(/ \(.*\)/, "")}</span>
                            <span className={`h-2 w-2 rounded-full shrink-0 ${e.event_type === "sick" ? "bg-sky-400" : "bg-rose-400"}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {wfhToday.length > 0 && (
                    <div>
                      <p className="text-[8.5px] font-bold uppercase tracking-wide text-foreground/55 mb-2">WFH</p>
                      <div className="space-y-2">
                        {wfhToday.map(e => (
                          <div key={e.id} className="flex items-center gap-2.5">
                            <Avatar name={e.title} size="h-7 w-7" />
                            <span className="text-[11px] font-semibold text-foreground/80 truncate flex-1">{e.title.replace(/ \(WFH.*\)/, "")}</span>
                            <span className="h-2 w-2 rounded-full shrink-0 bg-emerald-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </SideCard>
            )}

            {/* This week */}
            <SideCard title="This Week">
              <div className="divide-y divide-border/30 dark:divide-white/[0.04]">
                {thisWeek.map((day: CalendarDay) => {
                  const isToday = day.date === todayStr
                  const n = parseInt(day.date.split("-")[2])
                  return (
                    <button key={day.date}
                      onClick={() => setSelDay(prev => prev?.date === day.date ? null : day)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isToday ? "bg-primary/[0.05] dark:bg-primary/[0.10]" : "hover:bg-muted/30 dark:hover:bg-white/[0.03]"}`}
                    >
                      <div className="flex flex-col items-center w-8 shrink-0">
                        <span className={`text-[8px] font-black uppercase ${isToday ? "text-primary" : "text-muted-foreground/60"}`}>
                          {fmt(day.date, { weekday: "short" })}
                        </span>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black mt-0.5 ${isToday ? "text-primary-foreground" : "text-foreground/70"}`}
                          style={isToday ? { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/.7))" } : {}}
                        >{n}</span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        {day.events.length === 0
                          ? <p className="text-[9.5px] text-muted-foreground/35">No events</p>
                          : day.events.slice(0, 2).map(e => {
                              const s = sw(e.event_type)
                              return (
                                <div key={e.id} className="flex items-center gap-1.5 min-w-0">
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.grad }} />
                                  <span className="text-[10px] font-medium text-foreground/75 truncate">{e.title}</span>
                                </div>
                              )
                            })
                        }
                        {day.events.length > 2 && <p className="text-[9px] text-muted-foreground/40 pl-3">+{day.events.length - 2}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </SideCard>

            {/* Coming up */}
            {upcoming.length > 0 && (
              <SideCard title="Coming Up">
                <div className="p-3 space-y-3">
                  {upcoming.map(day => (
                    <div key={day.date}>
                      <p className="text-[8px] font-bold uppercase tracking-wide text-foreground/50 mb-1.5">
                        {fmt(day.date, { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      {day.events.slice(0, 2).map(e => {
                        const s    = sw(e.event_type)
                        const Icon = ICONS[e.event_type] ?? Calendar
                        return (
                          <button key={e.id} onClick={() => setDetEvt({ ...e, date: day.date })}
                            className="w-full mb-1 text-left flex items-center gap-2 rounded-xl px-3 py-2 text-[10.5px] font-semibold text-white transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.97]"
                            style={{ background: s.grad }}
                          >
                            <Icon className="h-3 w-3 shrink-0 opacity-85" />
                            <span className="truncate">{e.title}</span>
                          </button>
                        )
                      })}
                      {day.events.length > 2 && <p className="text-[8.5px] text-muted-foreground/40 pl-1">+{day.events.length - 2} more</p>}
                    </div>
                  ))}
                </div>
              </SideCard>
            )}
          </>
        )}
      </aside>

      {/* ══ MOBILE NEW EVENT FAB ═════════════════════════════ */}
      <div className="lg:hidden fixed bottom-5 right-5 z-30">
        <Link href="/calendar/new"
          className="flex items-center gap-2 h-12 px-5 rounded-2xl text-[13px] font-bold text-primary-foreground shadow-2xl bg-primary hover:bg-primary/90 active:scale-[0.97] transition-all"
        ><Plus className="h-4 w-4" /> New Event</Link>
      </div>
      {/* ══ MOBILE DAY SHEET ══════════════════════════════════ */}
      {selDay && (
        <div className="lg:hidden fixed inset-0 z-40 flex items-end" onClick={() => setSelDay(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="_pop relative w-full bg-background dark:bg-[#0b0c12] rounded-t-3xl border-t border-border/60 dark:border-white/[0.08] max-h-[80dvh] flex flex-col shadow-2xl pb-safe"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1"><div className="h-1 w-10 rounded-full bg-muted-foreground/25" /></div>
            <div className="px-5 pb-4 border-b border-border/50 dark:border-white/[0.06] shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-foreground/50">{fmt(selDay.date, { weekday: "long" })}</p>
                  <p className="text-[24px] font-black text-foreground leading-tight mt-0.5">{fmt(selDay.date, { day: "numeric", month: "long" })}</p>
                </div>
                <button onClick={() => setSelDay(null)} className="h-8 w-8 flex items-center justify-center rounded-full bg-muted/60 dark:bg-white/[0.08] mt-1">
                  <X className="h-4 w-4 text-foreground/60" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {selDay.events.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground/50">No events</p>
                </div>
              ) : selDay.events.map(e => {
                const s    = sw(e.event_type)
                const Icon = ICONS[e.event_type] ?? Calendar
                return (
                  <div key={e.id} onClick={() => setDetEvt({ ...e, date: selDay.date })}
                    className="rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="h-1 w-full" style={{ background: s.grad }} />
                    <div className={`px-4 py-3 border border-t-0 border-border/50 dark:border-white/[0.07] rounded-b-2xl ${s.soft}`}>
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: s.grad }}>
                          <Icon className="h-4.5 w-4.5 text-white" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-foreground truncate">{e.title}</p>
                          {e.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{e.description}</p>}
                        </div>
                      </div>
                      {e.canDelete && (
                        <div className="mt-2.5 pt-2 border-t border-border/40 dark:border-white/[0.06]">
                          <button onClick={ev => { ev.stopPropagation(); del(e) }} disabled={pending}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive/70 hover:text-destructive"
                          ><X className="h-3 w-3" />{pending ? "Deleting…" : "Delete"}</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ EVENT DETAIL DIALOG ═══════════════════════════════ */}
      <Dialog open={!!detEvt} onOpenChange={o => { if (!o) setDetEvt(null) }}>
        <DialogContent className="rounded-3xl max-w-sm border-border/60 shadow-2xl">
          {detEvt && (() => {
            const s    = sw(detEvt.event_type)
            const Icon = ICONS[detEvt.event_type] ?? Calendar
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg" style={{ background: s.grad }}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 pt-1">
                      <DialogTitle className="text-[15px] font-bold">{detEvt.title}</DialogTitle>
                      <p className="text-xs text-muted-foreground mt-1">{fmt(detEvt.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${s.badge}`}>
                    <Icon className="h-3 w-3" />{detEvt.event_type.replace(/_/g, " ")}
                  </span>
                  {detEvt.description && <p className="text-sm text-muted-foreground leading-relaxed">{detEvt.description}</p>}
                  {detEvt.canDelete && (
                    <div className="pt-3 border-t border-border/60">
                      <button onClick={() => del(detEvt)} disabled={pending}
                        className="flex items-center gap-2 text-sm font-semibold text-destructive hover:opacity-70 transition-opacity disabled:opacity-40"
                      ><X className="h-4 w-4" />{pending ? "Deleting…" : "Delete Event"}</button>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border dark:border-white/[0.09] overflow-hidden bg-card dark:bg-white/[0.02]">
      <div className="px-4 py-2.5 border-b border-border/40 dark:border-white/[0.05] bg-muted/30 dark:bg-white/[0.025]">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-foreground/65">{title}</p>
      </div>
      {children}
    </div>
  )
}
