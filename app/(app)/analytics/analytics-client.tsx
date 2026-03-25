"use client"

import { useState, useMemo, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts"
import { X, Download, RefreshCw, Users, Clock, Home, CalendarDays, TrendingUp, TrendingDown, UserCheck, Building2, AlertTriangle, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type UserProfile = { id: string; full_name: string; display_name: string | null }
type AttendanceRecord = { id: string; user_id: string; work_date: string; clock_in: string | null; clock_out: string | null; total_hours: number | null; status: string; expected_arrival_time?: string | null; early_leave?: boolean | null; early_leave_reason?: string | null }
type WfhRecord = { user_id: string; wfh_date: string; wfh_type?: string }
type LeaveRequest = { user_id: string; leave_type: string; start_date: string; end_date: string; days_count: number; status: string }
type Visitor = { id: string; visitor_name: string; company: string | null; visit_date: string; checked_in_at: string | null; checked_out_at: string | null; status: string; guest_count: number }
type Complaint = { id: string; user_id: string | null; subject: string; severity: string; category: string; status: string; is_anonymous: boolean; created_at: string }
type FeedbackItem = { id: string; user_id: string; subject: string; category: string; status: string; created_at: string }
type ScheduleEntry = { user_id: string; work_days: string[]; daily_hours: number; hours_by_day: Record<string, number> | null }

interface Props {
  users: UserProfile[]
  attendance: AttendanceRecord[]
  wfhRecords: WfhRecord[]
  leaveRequests: LeaveRequest[]
  visitors: Visitor[]
  complaints: Complaint[]
  feedbackItems: FeedbackItem[]
  schedules: ScheduleEntry[]
  today: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DOW_KEYS = ["sun","mon","tue","wed","thu","fri","sat"]
const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
const DEFAULT_HOURS = 7.5
const DEFAULT_LATE_HOUR = 9
const DEFAULT_LATE_MINUTE = 30

const COLORS = {
  present: "#22c55e",
  wfh: "#6366f1",
  late: "#f59e0b",
  leave: "#8b5cf6",
  under: "#ef4444",
  over: "#3b82f6",
  visitors: "#ec4899",
  annual: "#7C6F5E",
  sick: "#ef4444",
  maternity: "#8b5cf6",
  unpaid: "#94a3b8",
}

const LEAVE_COLORS: Record<string,string> = { annual: COLORS.annual, sick: COLORS.sick, maternity: COLORS.maternity, unpaid: COLORS.unpaid }
const PIE_PALETTE = ["#6366f1","#f59e0b","#22c55e","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"]

const TT: any = {
  contentStyle: { background:"hsl(var(--card))", border:"1px solid hsl(var(--border))", borderRadius:12, fontSize:12, color:"hsl(var(--foreground))", boxShadow:"0 8px 30px rgba(0,0,0,0.12)", padding:"10px 14px" },
  labelStyle: { fontWeight:700, color:"hsl(var(--foreground))", marginBottom:4 },
  cursor: { fill:"hsl(var(--muted))", opacity:0.4 },
}
const AXIS = { fontSize:11, fill:"hsl(var(--muted-foreground))" }

// ── Drilldown panel ───────────────────────────────────────────────────────────

interface DrillRow { [key: string]: string | number }
interface Drilldown { title: string; subtitle: string; rows: DrillRow[]; cols: string[] }

function DrillPanel({ drill, onClose }: { drill: Drilldown; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-sm font-bold text-foreground">{drill.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{drill.subtitle}</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors ml-4 shrink-0">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {drill.rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No records to show</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b border-border">
                <tr>
                  {drill.cols.map(c => (
                    <th key={c} className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {drill.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    {drill.cols.map(c => (
                      <td key={c} className="px-4 py-2.5 text-foreground whitespace-nowrap">{row[c] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border shrink-0 text-xs text-muted-foreground">
          {drill.rows.length} record{drill.rows.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, bg, sub, onClick }: {
  label: string; value: string | number; icon: React.ReactNode
  color: string; bg: string; sub?: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm transition-all ${onClick ? "hover:shadow-md hover:border-border/80 cursor-pointer group" : "cursor-default"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xl font-black text-foreground leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 font-medium leading-snug">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${bg} ${color}`}>{icon}</div>
      </div>
      {onClick && <p className="text-[10px] text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">Click to see who <ChevronRight className="h-2.5 w-2.5" /></p>}
    </button>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border/50">
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Custom tooltip with "click to drill" hint ─────────────────────────────────

function DrillTooltip({ active, payload, label, hint }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={TT.contentStyle}>
      <p style={TT.labelStyle}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? "hsl(var(--foreground))", marginTop: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
      {hint && <p className="mt-2 text-[10px] opacity-60">🖱 {hint}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function AnalyticsClient({ users, attendance, wfhRecords, leaveRequests, visitors, complaints, feedbackItems, schedules, today }: Props) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year] = useState(now.getFullYear())
  const [drill, setDrill] = useState<Drilldown | null>(null)
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`
  const monthLabel = `${MONTHS[month]} ${year}`

  // ── Helpers ──────────────────────────────────────────────────────────────

  const scheduleMap = useMemo(() => {
    const m: Record<string, ScheduleEntry> = {}
    for (const s of schedules) m[s.user_id] = s
    return m
  }, [schedules])

  const userName = useCallback((uid: string | null) => {
    if (!uid) return "Anonymous"
    const u = users.find(u => u.id === uid)
    return u?.display_name || u?.full_name || "Unknown"
  }, [users])

  const contractedHoursForDate = useCallback((uid: string, workDate: string) => {
    const s = scheduleMap[uid]
    if (!s) return DEFAULT_HOURS
    if (s.hours_by_day) {
      const dow = new Date(workDate + "T12:00:00").getDay()
      const v = s.hours_by_day[DOW_KEYS[dow]]
      if (v !== undefined) return v
    }
    return s.daily_hours ?? DEFAULT_HOURS
  }, [scheduleMap])

  const contractedHoursAvg = useCallback((uid: string) => {
    return scheduleMap[uid]?.daily_hours ?? DEFAULT_HOURS
  }, [scheduleMap])

  const isLate = useCallback((record: AttendanceRecord) => {
    if (!record.clock_in || record.status === "wfh") return false
    const d = new Date(record.clock_in)
    const lateThreshold = record.expected_arrival_time
    if (lateThreshold) {
      const [lh, lm] = lateThreshold.split(":").map(Number)
      return d.getHours() > lh || (d.getHours() === lh && d.getMinutes() > lm)
    }
    return d.getHours() > DEFAULT_LATE_HOUR || (d.getHours() === DEFAULT_LATE_HOUR && d.getMinutes() >= DEFAULT_LATE_MINUTE)
  }, [])

  const fmtTime = (ts: string | null) => !ts ? "—" : new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  const fmtDateFull = (ts: string) => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  // ── Month slices ─────────────────────────────────────────────────────────

  const monthAtt = useMemo(() => attendance.filter(a => a.work_date.startsWith(monthStr)), [attendance, monthStr])
  const monthWfh = useMemo(() => wfhRecords.filter(w => w.wfh_date.startsWith(monthStr)), [wfhRecords, monthStr])
  const monthVis = useMemo(() => visitors.filter(v => v.visit_date.startsWith(monthStr)), [visitors, monthStr])
  const monthLeave = useMemo(() => {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return leaveRequests.filter(l =>
      l.start_date <= `${monthStr}-${String(lastDay).padStart(2, "0")}` &&
      l.end_date >= `${monthStr}-01`
    )
  }, [leaveRequests, monthStr, year, month])

  // Half-day leave set: "userId|date" → true (means contracted hours halved for that day)
  const halfDayLeaveSet = useMemo(() => {
    const s = new Set<string>()
    for (const l of monthLeave) {
      if (Number(l.days_count) === 0.5 && l.start_date === l.end_date) {
        s.add(`${l.user_id}|${l.start_date}`)
      }
    }
    return s
  }, [monthLeave])

  // Effective contracted hours for a date — halved if there's an approved half-day leave
  const effectiveContracted = useCallback((uid: string, date: string) => {
    const base = contractedHoursForDate(uid, date)
    return halfDayLeaveSet.has(`${uid}|${date}`) ? base * 0.5 : base
  }, [contractedHoursForDate, halfDayLeaveSet])

  // ── Today snapshot ───────────────────────────────────────────────────────

  const todaySnap = useMemo(() => {
    const inOffice = attendance.filter(a => a.work_date === today && a.clock_in && !a.clock_out && a.status !== "wfh")
    const wfhToday = wfhRecords.filter(w => w.wfh_date === today)
    const onLeave = leaveRequests.filter(l => l.start_date <= today && l.end_date >= today)
    const completedToday = attendance.filter(a => a.work_date === today && a.clock_out)

    // Contracted today
    const todayDow = new Date(today + "T12:00:00").getDay()
    const todayKey = DOW_KEYS[todayDow]
    const contractedToday = users.filter(u => {
      const s = scheduleMap[u.id]
      if (!s) return todayDow >= 1 && todayDow <= 5
      if (s.hours_by_day) return (s.hours_by_day[todayKey] ?? 0) > 0
      return s.work_days?.includes(todayKey) ?? (todayDow >= 1 && todayDow <= 5)
    })

    const accounted = new Set([
      ...inOffice.map(a => a.user_id),
      ...completedToday.map(a => a.user_id),
      ...wfhToday.map(w => w.user_id),
      ...onLeave.map(l => l.user_id),
    ])
    const notIn = contractedToday.filter(u => !accounted.has(u.id))

    return { inOffice, wfhToday, onLeave, notIn, contractedToday }
  }, [attendance, wfhRecords, leaveRequests, users, scheduleMap, today])

  // ── Per-employee metrics for the month ──────────────────────────────────

  const employeeMetrics = useMemo(() => {
    return users.map(u => {
      const attRows = monthAtt.filter(a => a.user_id === u.id && a.clock_in && a.status !== "wfh")
      const wfhDays = monthWfh.filter(w => w.user_id === u.id).length
      const leaveDays = monthLeave.filter(l => l.user_id === u.id).reduce((s, l) => s + l.days_count, 0)
      const officeDays = attRows.length
      const lateCount = monthAtt.filter(a => a.user_id === u.id && isLate(a)).length
      const totalH = attRows.reduce((s, a) => s + (a.total_hours ?? 0), 0)
      const avgH = officeDays > 0 ? +(totalH / officeDays).toFixed(1) : 0
      const contracted = contractedHoursAvg(u.id)

      // Contracted days in month
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      let contractedDays = 0
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${monthStr}-${String(d).padStart(2, "0")}`
        const dow = new Date(dateStr + "T12:00:00").getDay()
        const key = DOW_KEYS[dow]
        const s = scheduleMap[u.id]
        if (!s) { if (dow >= 1 && dow <= 5) contractedDays++; continue }
        if (s.hours_by_day) { if ((s.hours_by_day[key] ?? 0) > 0) contractedDays++ }
        else if (s.work_days?.includes(key)) contractedDays++
        else if (!s.work_days && dow >= 1 && dow <= 5) contractedDays++
      }

      const absent = Math.max(0, contractedDays - officeDays - wfhDays - leaveDays)
      const attendPct = contractedDays > leaveDays
        ? Math.round(((officeDays + wfhDays) / (contractedDays - leaveDays)) * 100)
        : 100

      return { u, officeDays, wfhDays, leaveDays, lateCount, avgH, contracted, contractedDays, absent, attendPct }
    }).filter(e => e.contractedDays > 0)
      .sort((a, b) => b.officeDays + b.wfhDays - (a.officeDays + a.wfhDays))
  }, [users, monthAtt, monthWfh, monthLeave, isLate, contractedHoursAvg, scheduleMap, month, year, monthStr])

  // ── Chart data ───────────────────────────────────────────────────────────

  const dailyTrend = useMemo(() => {
    const map: Record<string, { present: number; wfh: number; late: number }> = {}
    monthAtt.forEach(a => {
      const day = a.work_date.slice(8, 10)
      if (!map[day]) map[day] = { present: 0, wfh: 0, late: 0 }
      if (a.status === "wfh") map[day].wfh++
      else if (a.clock_in) {
        map[day].present++
        if (isLate(a)) map[day].late++
      }
    })
    return Object.entries(map).sort().map(([day, v]) => ({ day: parseInt(day), ...v }))
  }, [monthAtt, isLate])

  const lateByPerson = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {}
    monthAtt.filter(a => isLate(a)).forEach(a => {
      if (!map[a.user_id]) map[a.user_id] = []
      map[a.user_id].push(a)
    })
    return Object.entries(map)
      .map(([uid, rows]) => ({ name: userName(uid), count: rows.length, uid, rows }))
      .sort((a, b) => b.count - a.count)
  }, [monthAtt, isLate, userName])

  const hoursByPerson = useMemo(() => {
    return employeeMetrics
      .filter(e => e.officeDays > 0)
      .map(e => ({ name: userName(e.u.id), avgH: e.avgH, contracted: e.contracted, uid: e.u.id }))
      .sort((a, b) => b.avgH - a.avgH)
  }, [employeeMetrics, userName])

  const leaveByType = useMemo(() => {
    const map: Record<string, number> = {}
    monthLeave.forEach(l => { map[l.leave_type] = (map[l.leave_type] || 0) + l.days_count })
    return Object.entries(map).map(([name, value]) => ({ name: cap(name), value, key: name }))
  }, [monthLeave])

  const leaveByPerson = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    monthLeave.forEach(l => {
      if (!map[l.user_id]) map[l.user_id] = {}
      map[l.user_id][l.leave_type] = (map[l.user_id][l.leave_type] || 0) + l.days_count
    })
    return Object.entries(map).map(([uid, types]) => ({
      name: userName(uid), uid,
      Annual: types.annual || 0, Sick: types.sick || 0,
      Maternity: types.maternity || 0, Unpaid: types.unpaid || 0,
    })).sort((a, b) => (b.Annual + b.Sick + b.Maternity + b.Unpaid) - (a.Annual + a.Sick + a.Maternity + a.Unpaid))
  }, [monthLeave, userName])

  const wfhByPerson = useMemo(() => {
    const map: Record<string, WfhRecord[]> = {}
    monthWfh.forEach(w => {
      if (!map[w.user_id]) map[w.user_id] = []
      map[w.user_id].push(w)
    })
    return Object.entries(map)
      .map(([uid, rows]) => ({ name: userName(uid), days: rows.length, uid, rows }))
      .sort((a, b) => b.days - a.days)
  }, [monthWfh, userName])

  const wfhByDow = useMemo(() => {
    const map: Record<number, number> = {}
    monthWfh.forEach(w => { const d = new Date(w.wfh_date + "T12:00:00").getDay(); map[d] = (map[d] || 0) + 1 })
    return [1, 2, 3, 4, 5].map(d => ({ day: DOW_LABELS[d], count: map[d] || 0 }))
  }, [monthWfh])

  const visitorTrend = useMemo(() =>
    Array.from({ length: 12 }, (_, m) => ({
      month: MONTHS[m].slice(0, 3),
      count: visitors.filter(v => v.visit_date.startsWith(`${year}-${String(m + 1).padStart(2, "0")}`)).length,
    })),
  [visitors, year])

  const todayVisitors = useMemo(() => visitors.filter(v => v.visit_date === today), [visitors, today])

  // ── Drilldown builders ───────────────────────────────────────────────────

  const openTodayPanel = (type: "inOffice" | "wfh" | "leave" | "notIn") => {
    if (type === "inOffice") {
      setDrill({
        title: "In Office Right Now",
        subtitle: `${todaySnap.inOffice.length} people clocked in today`,
        cols: ["Employee", "Clock In", "Status"],
        rows: todaySnap.inOffice.map(a => ({
          "Employee": userName(a.user_id),
          "Clock In": fmtTime(a.clock_in),
          "Status": a.status,
        }))
      })
    } else if (type === "wfh") {
      setDrill({
        title: "Working From Home Today",
        subtitle: `${todaySnap.wfhToday.length} people WFH today`,
        cols: ["Employee", "WFH Type"],
        rows: todaySnap.wfhToday.map(w => ({
          "Employee": userName(w.user_id),
          "WFH Type": cap(w.wfh_type?.replace("_", " ") ?? "Full"),
        }))
      })
    } else if (type === "leave") {
      setDrill({
        title: "On Leave Today",
        subtitle: `${todaySnap.onLeave.length} approved leave requests covering today`,
        cols: ["Employee", "Leave Type", "From", "To", "Days"],
        rows: todaySnap.onLeave.map(l => ({
          "Employee": userName(l.user_id),
          "Leave Type": cap(l.leave_type),
          "From": fmtDate(l.start_date),
          "To": fmtDate(l.end_date),
          "Days": l.days_count,
        }))
      })
    } else {
      setDrill({
        title: "Not Yet Clocked In",
        subtitle: "Contracted to work today but no record yet",
        cols: ["Employee"],
        rows: todaySnap.notIn.map(u => ({ "Employee": u.display_name || u.full_name }))
      })
    }
  }

  const openEmployeeDrill = (uid: string, name: string) => {
    const attRows = monthAtt.filter(a => a.user_id === uid && a.clock_in)
    const wfhRows = monthWfh.filter(w => w.user_id === uid)
    const leaveRows = monthLeave.filter(l => l.user_id === uid)

    const rows: DrillRow[] = []

    // attendance
    attRows.forEach(a => rows.push({
      "Date": fmtDate(a.work_date),
      "Type": a.status === "wfh" ? "WFH" : "Office",
      "Clock In": fmtTime(a.clock_in),
      "Clock Out": fmtTime(a.clock_out),
      "Hours": a.total_hours ? `${a.total_hours.toFixed(1)}h` : "—",
      "Contracted": `${contractedHoursForDate(uid, a.work_date)}h`,
      "Late": isLate(a) ? "⚠ Late" : "—",
    }))
    // wfh-only rows
    wfhRows.filter(w => !attRows.find(a => a.work_date === w.wfh_date)).forEach(w => rows.push({
      "Date": fmtDate(w.wfh_date),
      "Type": "WFH",
      "Clock In": "—", "Clock Out": "—",
      "Hours": "—", "Contracted": `${contractedHoursForDate(uid, w.wfh_date)}h`,
      "Late": "—",
    }))
    // leave rows
    leaveRows.forEach(l => rows.push({
      "Date": `${fmtDate(l.start_date)}${l.start_date !== l.end_date ? ` – ${fmtDate(l.end_date)}` : ""}`,
      "Type": `Leave – ${cap(l.leave_type)}`,
      "Clock In": "—", "Clock Out": "—",
      "Hours": "—", "Contracted": "—",
      "Late": "—",
    }))

    rows.sort((a, b) => String(a["Date"]).localeCompare(String(b["Date"])))

    setDrill({
      title: name,
      subtitle: `All records for ${monthLabel}`,
      cols: ["Date", "Type", "Clock In", "Clock Out", "Hours", "Contracted", "Late"],
      rows,
    })
  }

  const openLateDrill = (uid: string, name: string, rows: AttendanceRecord[]) => {
    setDrill({
      title: `Late Arrivals — ${name}`,
      subtitle: `${rows.length} late arrival${rows.length !== 1 ? "s" : ""} in ${monthLabel}`,
      cols: ["Date", "Day", "Clock In", "Expected", "Mins Late"],
      rows: rows.map(a => {
        const ci = new Date(a.clock_in!)
        const lateThreshold = a.expected_arrival_time ?? `${DEFAULT_LATE_HOUR}:${String(DEFAULT_LATE_MINUTE).padStart(2, "0")}`
        const [lh, lm] = lateThreshold.split(":").map(Number)
        const minsLate = (ci.getHours() * 60 + ci.getMinutes()) - (lh * 60 + lm)
        return {
          "Date": fmtDate(a.work_date),
          "Day": DOW_LABELS[new Date(a.work_date + "T12:00:00").getDay()],
          "Clock In": fmtTime(a.clock_in),
          "Expected": lateThreshold,
          "Mins Late": `${minsLate} min`,
        }
      })
    })
  }

  const openWfhDrill = (uid: string, name: string, rows: WfhRecord[]) => {
    setDrill({
      title: `WFH Days — ${name}`,
      subtitle: `${rows.length} WFH day${rows.length !== 1 ? "s" : ""} in ${monthLabel}`,
      cols: ["Date", "Day", "Type"],
      rows: rows.map(w => ({
        "Date": fmtDate(w.wfh_date),
        "Day": DOW_LABELS[new Date(w.wfh_date + "T12:00:00").getDay()],
        "Type": cap(w.wfh_type?.replace("_", " ") ?? "Full"),
      }))
    })
  }

  const openLeaveTypeDrill = (key: string, label: string) => {
    const rows = monthLeave.filter(l => l.leave_type === key)
    setDrill({
      title: `${label} Leave — ${monthLabel}`,
      subtitle: `${rows.reduce((s, l) => s + l.days_count, 0)} days total`,
      cols: ["Employee", "From", "To", "Days"],
      rows: rows.map(l => ({
        "Employee": userName(l.user_id),
        "From": fmtDate(l.start_date),
        "To": fmtDate(l.end_date),
        "Days": l.days_count,
      }))
    })
  }

  const openUnderOverDrill = (type: "under" | "over") => {
    const rows = monthAtt.filter(a => {
      if (!a.clock_in || !a.total_hours || a.status === "wfh" || a.early_leave) return false
      const c = effectiveContracted(a.user_id, a.work_date)
      return type === "under" ? a.total_hours < c : a.total_hours > c
    })
    setDrill({
      title: type === "under" ? "Under Contracted Hours" : "Over Contracted Hours",
      subtitle: `${rows.length} day${rows.length !== 1 ? "s" : ""} in ${monthLabel}`,
      cols: ["Employee", "Date", "Worked", "Contracted", type === "under" ? "Deficit" : "Extra"],
      rows: rows.sort((a, b) => a.work_date.localeCompare(b.work_date)).map(a => {
        const c = effectiveContracted(a.user_id, a.work_date)
        const diff = Math.abs((a.total_hours ?? 0) - c).toFixed(1)
        return {
          "Employee": userName(a.user_id),
          "Date": fmtDate(a.work_date),
          "Worked": `${(a.total_hours ?? 0).toFixed(1)}h`,
          "Contracted": `${c}h`,
          [type === "under" ? "Deficit" : "Extra"]: `${diff}h`,
        }
      })
    })
  }

  // ── CSV export ───────────────────────────────────────────────────────────

  const exportCSV = () => {
    const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
    const rows: string[] = []
    rows.push(q(`StaffPortal Analytics — ${monthLabel}`), "")

    rows.push(q("TEAM OVERVIEW"))
    rows.push([q("Employee"), q("Contracted Days"), q("Office Days"), q("WFH Days"), q("Leave Days"), q("Absent"), q("Avg Hours"), q("Contracted Hours"), q("Late"), q("Attendance %")].join(","))
    employeeMetrics.forEach(e => rows.push([q(userName(e.u.id)), q(e.contractedDays), q(e.officeDays), q(e.wfhDays), q(e.leaveDays), q(e.absent), q(e.avgH), q(e.contracted), q(e.lateCount), q(e.attendPct + "%")].join(",")))

    rows.push("", q("LATE ARRIVALS"))
    rows.push([q("Employee"), q("Date"), q("Clock In"), q("Expected"), q("Mins Late")].join(","))
    monthAtt.filter(a => isLate(a)).forEach(a => {
      const lateThreshold = a.expected_arrival_time ?? `${DEFAULT_LATE_HOUR}:${String(DEFAULT_LATE_MINUTE).padStart(2, "0")}`
      const [lh, lm] = lateThreshold.split(":").map(Number)
      const ci = new Date(a.clock_in!)
      const minsLate = (ci.getHours() * 60 + ci.getMinutes()) - (lh * 60 + lm)
      rows.push([q(userName(a.user_id)), q(a.work_date), q(fmtTime(a.clock_in)), q(lateThreshold), q(minsLate)].join(","))
    })

    const blob = new Blob([rows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `analytics-${monthStr}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Summary numbers ───────────────────────────────────────────────────────
  const totalLate = monthAtt.filter(a => isLate(a)).length
  const totalUnder = monthAtt.filter(a => a.clock_in && a.total_hours && a.status !== "wfh" && !a.early_leave && a.total_hours < effectiveContracted(a.user_id, a.work_date)).length
  const totalOver = monthAtt.filter(a => a.clock_in && a.total_hours && a.status !== "wfh" && !a.early_leave && a.total_hours > effectiveContracted(a.user_id, a.work_date)).length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6">

      {drill && <DrillPanel drill={drill} onClose={() => setDrill(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Director view — click any number or chart bar to see who</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {MONTHS.map((m, i) => <option key={i} value={i}>{m} {year}</option>)}
          </select>
          <button
            onClick={() => exportCSV()}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={() => startRefresh(() => router.refresh())}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Today's Snapshot ── */}
      <Section title="Today's Snapshot" subtitle={new Date(today + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="In Office" value={todaySnap.inOffice.length}
            icon={<UserCheck className="h-5 w-5" />} color="text-emerald-600" bg="bg-emerald-100 dark:bg-emerald-900/30"
            sub="Clocked in, not yet out"
            onClick={() => openTodayPanel("inOffice")}
          />
          <StatCard
            label="Working From Home" value={todaySnap.wfhToday.length}
            icon={<Home className="h-5 w-5" />} color="text-indigo-600" bg="bg-indigo-100 dark:bg-indigo-900/30"
            onClick={() => openTodayPanel("wfh")}
          />
          <StatCard
            label="On Leave Today" value={todaySnap.onLeave.length}
            icon={<CalendarDays className="h-5 w-5" />} color="text-violet-600" bg="bg-violet-100 dark:bg-violet-900/30"
            onClick={() => openTodayPanel("leave")}
          />
          <StatCard
            label="Not Clocked In" value={todaySnap.notIn.length}
            icon={<AlertTriangle className="h-5 w-5" />} color="text-amber-600" bg="bg-amber-100 dark:bg-amber-900/30"
            sub="Contracted today, no record"
            onClick={() => openTodayPanel("notIn")}
          />
        </div>
      </Section>

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Office Days" value={monthAtt.filter(a => a.clock_in && a.status !== "wfh").length}
          icon={<UserCheck className="h-5 w-5" />} color="text-emerald-600" bg="bg-emerald-100 dark:bg-emerald-900/30"
          sub={monthLabel}
          onClick={() => setDrill({ title: "Office Days", subtitle: monthLabel, cols: ["Employee", "Date", "Clock In", "Clock Out", "Hours"], rows: monthAtt.filter(a => a.clock_in && a.status !== "wfh").sort((a, b) => a.work_date.localeCompare(b.work_date)).map(a => ({ "Employee": userName(a.user_id), "Date": fmtDate(a.work_date), "Clock In": fmtTime(a.clock_in), "Clock Out": fmtTime(a.clock_out), "Hours": a.total_hours ? `${a.total_hours.toFixed(1)}h` : "—" })) })} />
        <StatCard label="WFH Days" value={monthWfh.length}
          icon={<Home className="h-5 w-5" />} color="text-indigo-600" bg="bg-indigo-100 dark:bg-indigo-900/30"
          sub={monthLabel}
          onClick={() => setDrill({ title: "WFH Days", subtitle: monthLabel, cols: ["Employee", "Date", "Day", "Type"], rows: monthWfh.map(w => ({ "Employee": userName(w.user_id), "Date": fmtDate(w.wfh_date), "Day": DOW_LABELS[new Date(w.wfh_date + "T12:00:00").getDay()], "Type": cap(w.wfh_type?.replace("_", " ") ?? "Full") })) })} />
        <StatCard label="Leave Days" value={monthLeave.reduce((s, l) => s + l.days_count, 0)}
          icon={<CalendarDays className="h-5 w-5" />} color="text-violet-600" bg="bg-violet-100 dark:bg-violet-900/30"
          sub={monthLabel}
          onClick={() => setDrill({ title: "Leave Days", subtitle: monthLabel, cols: ["Employee", "Type", "From", "To", "Days"], rows: monthLeave.map(l => ({ "Employee": userName(l.user_id), "Type": cap(l.leave_type), "From": fmtDate(l.start_date), "To": fmtDate(l.end_date), "Days": l.days_count })) })} />
        <StatCard label="Late Arrivals" value={totalLate}
          icon={<Clock className="h-5 w-5" />} color="text-amber-600" bg="bg-amber-100 dark:bg-amber-900/30"
          sub="Past expected time"
          onClick={() => openUnderOverDrill("under")} />
        <StatCard label="Under Hours" value={totalUnder}
          icon={<TrendingDown className="h-5 w-5" />} color="text-red-600" bg="bg-red-100 dark:bg-red-900/30"
          sub="Days below contracted"
          onClick={() => openUnderOverDrill("under")} />
        <StatCard label="Over Hours" value={totalOver}
          icon={<TrendingUp className="h-5 w-5" />} color="text-blue-600" bg="bg-blue-100 dark:bg-blue-900/30"
          sub="Days above contracted"
          onClick={() => openUnderOverDrill("over")} />
      </div>

      {/* ── Team Attendance Table ── */}
      <Section
        title={`Team Overview — ${monthLabel}`}
        subtitle="Click any row to see the full day-by-day breakdown for that employee"
      >
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs min-w-[700px]">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {["Employee","Contracted","Office","WFH","Leave","Absent","Avg Hours","Late","Attend %"].map(c => (
                  <th key={c} className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {employeeMetrics.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No data for {monthLabel}</td></tr>
              )}
              {employeeMetrics.map(e => {
                const pct = e.attendPct
                const pctColor = pct >= 95 ? "text-emerald-600" : pct >= 80 ? "text-amber-600" : "text-red-600"
                const pctBg = pct >= 95 ? "bg-emerald-500" : pct >= 80 ? "bg-amber-500" : "bg-red-500"
                return (
                  <tr
                    key={e.u.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openEmployeeDrill(e.u.id, userName(e.u.id))}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-brand-taupe/10 text-brand-taupe flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(e.u.display_name || e.u.full_name).split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span className="font-semibold text-foreground whitespace-nowrap">{e.u.display_name || e.u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.contractedDays}d</td>
                    <td className="px-4 py-3"><span className="font-semibold text-emerald-600">{e.officeDays}</span></td>
                    <td className="px-4 py-3"><span className="font-semibold text-indigo-600">{e.wfhDays}</span></td>
                    <td className="px-4 py-3"><span className="font-semibold text-violet-600">{e.leaveDays}</span></td>
                    <td className="px-4 py-3">
                      {e.absent > 0
                        ? <span className="font-semibold text-red-600">{e.absent}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={e.avgH > 0 && e.avgH < e.contracted ? "text-amber-600 font-semibold" : "text-foreground"}>
                        {e.avgH > 0 ? `${e.avgH}h` : "—"}
                      </span>
                      <span className="text-muted-foreground ml-1 text-[10px]">/ {e.contracted}h</span>
                    </td>
                    <td className="px-4 py-3">
                      {e.lateCount > 0
                        ? <span className="font-semibold text-amber-600">{e.lateCount}×</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${pctBg}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className={`font-semibold ${pctColor}`}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Daily Attendance Trend + Hours vs Contracted ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title={`Daily Attendance — ${monthLabel}`} subtitle="Present in office vs WFH vs late arrivals">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyTrend} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
              <defs>
                {[["gradP","#22c55e"],["gradW","#6366f1"],["gradL","#f59e0b"]].map(([id, c]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={AXIS} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip content={<DrillTooltip hint="See team table above for detail" />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="present" stroke={COLORS.present} strokeWidth={2} fill="url(#gradP)" name="Office" />
              <Area type="monotone" dataKey="wfh" stroke={COLORS.wfh} strokeWidth={2} fill="url(#gradW)" name="WFH" />
              <Area type="monotone" dataKey="late" stroke={COLORS.late} strokeWidth={2} fill="url(#gradL)" name="Late" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Avg Hours vs Contracted" subtitle="Click a bar to see that employee's daily breakdown">
          {hoursByPerson.length === 0
            ? <div className="flex items-center justify-center h-60 text-sm text-muted-foreground">No office attendance data</div>
            : <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hoursByPerson} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={AXIS} domain={[0, "dataMax + 1"]} unit="h" />
                  <YAxis type="category" dataKey="name" tick={AXIS} width={90} />
                  <Tooltip content={<DrillTooltip hint="Click to see daily breakdown" />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="avgH" name="Avg Hours" fill={COLORS.present} radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(d: any) => openEmployeeDrill(d.uid, d.name)} />
                  <Bar dataKey="contracted" name="Contracted" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
          }
        </Section>
      </div>

      {/* ── Late Arrivals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Late Arrivals by Employee" subtitle={`Based on each person's expected arrival time — ${monthLabel}`}>
          {lateByPerson.length === 0
            ? <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No late arrivals in {monthLabel} 🎉</div>
            : <ResponsiveContainer width="100%" height={Math.max(180, lateByPerson.length * 44)}>
                <BarChart data={lateByPerson} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={AXIS} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={AXIS} width={90} />
                  <Tooltip content={<DrillTooltip hint="Click to see each late day" />} />
                  <Bar dataKey="count" name="Late Days" fill={COLORS.late} radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(d: any) => openLateDrill(d.uid, d.name, d.rows)}
                    label={{ position: "right", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                </BarChart>
              </ResponsiveContainer>
          }
        </Section>

        <Section title="Early Departures" subtitle={`Employees who left early with a reason — ${monthLabel}`}>
          {(() => {
            const earlyRows = monthAtt.filter(a => a.early_leave && a.clock_in)
            if (earlyRows.length === 0) return (
              <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">No early departures in {monthLabel} 🎉</div>
            )
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {["Employee","Date","Left At","Hours Worked","Reason"].map(c => (
                        <th key={c} className="text-left pb-2 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {earlyRows.sort((a, b) => a.work_date.localeCompare(b.work_date)).map(a => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="py-2.5 pr-4 font-semibold text-foreground whitespace-nowrap">{userName(a.user_id)}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{fmtDate(a.work_date)}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{fmtTime(a.clock_out)}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{a.total_hours ? `${a.total_hours.toFixed(1)}h` : "—"}</td>
                        <td className="py-2.5 text-muted-foreground">{a.early_leave_reason || <span className="italic opacity-50">No reason given</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-[11px] text-muted-foreground">{earlyRows.length} early departure{earlyRows.length !== 1 ? "s" : ""} this month</p>
              </div>
            )
          })()}
        </Section>

        <Section title="Under / Over Contracted Hours" subtitle={`Click either bar to see which days and who — ${monthLabel}`}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => openUnderOverDrill("under")}
              className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-left hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
            >
              <p className="text-2xl font-black text-red-600">{totalUnder}</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5 font-medium">Days under contracted hours</p>
              <p className="text-[10px] text-red-500 mt-1">Click to see who ›</p>
            </button>
            <button
              onClick={() => openUnderOverDrill("over")}
              className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-left hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
            >
              <p className="text-2xl font-black text-blue-600">{totalOver}</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5 font-medium">Days over contracted hours</p>
              <p className="text-[10px] text-blue-500 mt-1">Click to see who ›</p>
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Each employee's contracted hours are taken from their individual work schedule — not a fixed number. Hours are compared per date against their contracted hours for that specific day.</p>
        </Section>
      </div>

      {/* ── Leave ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Leave by Employee" subtitle={`Click a bar to see that person's leave details — ${monthLabel}`}>
          {leaveByPerson.length === 0
            ? <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No leave in {monthLabel}</div>
            : <ResponsiveContainer width="100%" height={Math.max(180, leaveByPerson.length * 44)}>
                <BarChart data={leaveByPerson} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={AXIS} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={AXIS} width={90} />
                  <Tooltip content={<DrillTooltip hint="Click to see leave breakdown" />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {["Annual","Sick","Maternity","Unpaid"].map(t => (
                    <Bar key={t} dataKey={t} stackId="a" fill={LEAVE_COLORS[t.toLowerCase()] ?? "#94a3b8"}
                      radius={t === "Unpaid" ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                      cursor="pointer"
                      onClick={(d: any) => { const rows = monthLeave.filter(l => l.user_id === d.uid && l.leave_type === t.toLowerCase()); if (rows.length) openLeaveTypeDrill(t.toLowerCase(), t) }}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
          }
        </Section>

        <Section title="Leave by Type" subtitle={`Click a slice to see who — ${monthLabel}`}>
          {leaveByType.length === 0
            ? <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No leave in {monthLabel}</div>
            : <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={leaveByType} cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                      dataKey="value" paddingAngle={3}
                      onClick={(d: any) => openLeaveTypeDrill(d.key, d.name)}
                      cursor="pointer"
                    >
                      {leaveByType.map((e, i) => <Cell key={i} fill={LEAVE_COLORS[e.key] ?? PIE_PALETTE[i]} />)}
                    </Pie>
                    <Tooltip {...TT} formatter={(v: number) => [`${v} days`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                  {leaveByType.map((e, i) => (
                    <button key={e.key} onClick={() => openLeaveTypeDrill(e.key, e.name)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: LEAVE_COLORS[e.key] ?? PIE_PALETTE[i] }} />
                      {e.name} — {e.value}d
                    </button>
                  ))}
                </div>
              </>
          }
        </Section>
      </div>

      {/* ── WFH ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="WFH by Employee" subtitle={`Click a bar to see exact dates — ${monthLabel}`}>
          {wfhByPerson.length === 0
            ? <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No WFH in {monthLabel}</div>
            : <ResponsiveContainer width="100%" height={Math.max(180, wfhByPerson.length * 44)}>
                <BarChart data={wfhByPerson} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={AXIS} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={AXIS} width={90} />
                  <Tooltip content={<DrillTooltip hint="Click to see each WFH date" />} />
                  <Bar dataKey="days" name="WFH Days" fill={COLORS.wfh} radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(d: any) => openWfhDrill(d.uid, d.name, d.rows)}
                    label={{ position: "right", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                </BarChart>
              </ResponsiveContainer>
          }
        </Section>

        <Section title="WFH by Day of Week" subtitle={`Which days are most popular for WFH — ${monthLabel}`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={wfhByDow} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={AXIS} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip content={<DrillTooltip />} />
              <Bar dataKey="count" name="WFH Days" fill={COLORS.wfh} radius={[4, 4, 0, 0]}
                label={{ position: "top", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* ── Visitors ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Visitor Traffic — Full Year" subtitle="Monthly visitor count across the year">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={visitorTrend} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={AXIS} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip content={<DrillTooltip />} />
              <Bar dataKey="count" name="Visitors" fill={COLORS.visitors} radius={[4, 4, 0, 0]}
                label={{ position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section
          title="Today's Visitors"
          subtitle={`${todayVisitors.length} visitor${todayVisitors.length !== 1 ? "s" : ""} booked or checked in today`}
        >
          {todayVisitors.length === 0
            ? <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No visitors today</div>
            : <div className="space-y-2">
                {todayVisitors.map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{v.visitor_name}</p>
                      {v.company && <p className="text-xs text-muted-foreground">{v.company}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {v.checked_in_at && <span>In: {fmtTime(v.checked_in_at)}</span>}
                      {v.checked_out_at && <span>Out: {fmtTime(v.checked_out_at)}</span>}
                      <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                        v.status === "checked_in" ? "bg-emerald-100 text-emerald-700" :
                        v.status === "checked_out" ? "bg-muted text-muted-foreground" :
                        "bg-blue-100 text-blue-700"
                      }`}>{cap(v.status.replace("_", " "))}</span>
                    </div>
                  </div>
                ))}
              </div>
          }
        </Section>
      </div>

    </div>
  )
}
