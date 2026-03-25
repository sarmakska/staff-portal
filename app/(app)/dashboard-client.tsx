"use client"

import React, { useState, useEffect, useRef, useTransition } from "react"
import {
  Clock, CalendarDays, UserPlus, CheckCircle, LogIn, LogOut, ArrowRight,
  AlertCircle, TrendingUp, Zap, Coffee, FileText, XCircle, Bell, BookOpen, Users, HelpCircle,
  ChevronLeft, ChevronRight, LayoutGrid, Check, GripVertical, Maximize2, Minimize2, X, Plus,
  Plane, ClipboardList, MapPin, Receipt, Megaphone,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { NotificationItem } from "@/lib/actions/notifications"
import { logRunningLate } from "@/lib/actions/attendance"
import { toast } from "sonner"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type LeaveBalance = { leave_type: string; total: number; used: number; pending: number; carried_forward?: number }

interface DashboardClientProps {
  userId: string
  clockedIn: boolean
  clockInTime: string | null
  clockInIso: string | null
  weekHours: number
  completedWeekHours: number
  expectedHoursThisWeek: number
  contractedWeeklyHours: number
  scheduledDaysPassed: number
  scheduledDaysTotal: number
  leaveBalances: LeaveBalance[]
  pendingApprovals: number
  myPendingLeave: number
  visitorsToday: number
  notifications: NotificationItem[]
  isAdmin: boolean
  isReception: boolean
  displayName: string
  diaryReminders: any[]
  leaveRequests: any[]
}

// ── Widget config types ────────────────────────────────────
type WidgetId = "quick-actions" | "leave-balances" | "notifications" | "calendar" | "diary" | "week-summary" | "help" | "upcoming-leave" | "approvals" | "expenses" | "announcements"
type WidgetSize = "small" | "medium" | "large"

interface WidgetConfig {
  id: WidgetId
  size: WidgetSize
  visible: boolean
}

// small  = half width, compact
// medium = half width, normal
// large  = full width
const DEFAULT_CONFIG: WidgetConfig[] = [
  { id: "quick-actions",  size: "medium", visible: true },
  { id: "leave-balances", size: "medium", visible: true },
  { id: "notifications",  size: "large",  visible: true },
  { id: "calendar",       size: "medium", visible: true },
  { id: "diary",          size: "medium", visible: true },
  { id: "week-summary",   size: "small",  visible: true },
  { id: "upcoming-leave", size: "medium", visible: true },
  { id: "approvals",      size: "medium", visible: true },
  { id: "expenses",       size: "medium", visible: true },
  { id: "announcements",  size: "medium", visible: true },
  { id: "help",           size: "medium", visible: true },
]

const WIDGET_META: Record<WidgetId, { label: string; icon: React.ElementType }> = {
  "quick-actions":  { label: "Quick Actions",    icon: Zap },
  "leave-balances": { label: "Leave Balances",   icon: CalendarDays },
  "notifications":  { label: "Notifications",    icon: Bell },
  "calendar":       { label: "My Calendar",      icon: CalendarDays },
  "diary":          { label: "Diary Reminders",  icon: BookOpen },
  "week-summary":   { label: "Week Summary",     icon: TrendingUp },
  "help":           { label: "How to Use",       icon: HelpCircle },
  "upcoming-leave": { label: "Upcoming Leave",   icon: Plane },
  "approvals":      { label: "Approvals",        icon: ClipboardList },
  "expenses":       { label: "My Expenses",      icon: Receipt },
  "announcements":  { label: "Announcements",    icon: Megaphone },
}

// ── useWidgetConfig hook ───────────────────────────────────
function useWidgetConfig() {
  const [config, setConfig] = useState<WidgetConfig[]>(DEFAULT_CONFIG)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dashboard_widgets_v7")
      if (stored) {
        const parsed = JSON.parse(stored) as WidgetConfig[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = DEFAULT_CONFIG.map(d => {
            const found = parsed.find(p => p.id === d.id)
            return found ?? d
          })
          const ordered = parsed
            .map(p => merged.find(m => m.id === p.id))
            .filter(Boolean) as WidgetConfig[]
          const missing = merged.filter(m => !ordered.find(o => o.id === m.id))
          setConfig([...ordered, ...missing])
        }
      }
    } catch { /* ignore */ }
    setReady(true)
  }, [])

  const save = (newConfig: WidgetConfig[]) => {
    setConfig(newConfig)
    try { localStorage.setItem("dashboard_widgets_v7", JSON.stringify(newConfig)) } catch { /* ignore */ }
  }

  const reorder = (activeId: string, overId: string) => {
    setConfig(prev => {
      const oldIdx = prev.findIndex(c => c.id === activeId)
      const newIdx = prev.findIndex(c => c.id === overId)
      const next = arrayMove(prev, oldIdx, newIdx)
      try { localStorage.setItem("dashboard_widgets_v7", JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const setSize = (id: string, size: WidgetSize) => {
    save(config.map(c => c.id === id ? { ...c, size } : c))
  }

  const remove = (id: string) => {
    save(config.map(c => c.id === id ? { ...c, visible: false } : c))
  }

  const restore = (id: string) => {
    save(config.map(c => c.id === id ? { ...c, visible: true } : c))
  }

  return { config, ready, reorder, setSize, remove, restore }
}

// ── SortableWidget component ───────────────────────────────
const SIZE_CYCLE: WidgetSize[] = ["small", "medium", "large"]
const SIZE_LABELS: Record<WidgetSize, string> = { small: "S", medium: "M", large: "L" }

function SortableWidget({ id, size, editMode, onRemove, onResize, children, isOverlay = false }: {
  id: string
  size: WidgetSize
  editMode: boolean
  onRemove: () => void
  onResize: (s: WidgetSize) => void
  children: React.ReactNode
  isOverlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const [showSizePicker, setShowSizePicker] = useState(false)

  const colSpan = size === "large" ? "lg:col-span-2" : "lg:col-span-1"

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? "transform 200ms cubic-bezier(0.25,1,0.5,1)" }}
      className={`
        relative col-span-1 ${colSpan}
        ${isDragging && !isOverlay ? "opacity-0" : "opacity-100"}
        ${isOverlay ? "rotate-2 scale-105 shadow-2xl cursor-grabbing" : ""}
        ${editMode && !isDragging && !isOverlay ? "animate-jiggle" : ""}
      `}
    >
      {/* Edit mode overlay ring */}
      {editMode && !isOverlay && (
        <div className="absolute inset-0 z-10 rounded-2xl ring-2 ring-primary/50 ring-offset-1 ring-offset-background pointer-events-none" />
      )}

      {/* Drag handle — top-left */}
      {editMode && !isOverlay && (
        <div
          {...attributes} {...listeners}
          className="absolute top-2 left-2 z-30 h-8 w-8 rounded-full bg-foreground/85 backdrop-blur-sm flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-background" />
        </div>
      )}

      {/* Size picker button + popup */}
      {editMode && !isOverlay && (
        <div className="absolute top-2 left-12 z-30">
          <button
            onClick={() => setShowSizePicker(v => !v)}
            className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors text-white text-[10px] font-black"
            title="Change size"
          >
            {SIZE_LABELS[size]}
          </button>
          {showSizePicker && (
            <div className="absolute top-10 left-0 z-40 flex gap-1 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md p-1.5 shadow-2xl">
              {SIZE_CYCLE.map(s => (
                <button
                  key={s}
                  onClick={() => { onResize(s); setShowSizePicker(false) }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${
                    size === s
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remove button — top-right */}
      {editMode && !isOverlay && (
        <button
          onClick={onRemove}
          className="absolute -top-2.5 -right-2.5 z-30 h-7 w-7 rounded-full bg-destructive flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>
      )}

      <div className={`h-full ${editMode && !isOverlay ? "pointer-events-none select-none" : ""}`}>
        {children}
      </div>
    </div>
  )
}

// ── Constants ──────────────────────────────────────────────
const LEAVE_ACCENT: Record<string, { bar: string; num: string; dot: string }> = {
  annual:    { bar: "bg-blue-500",   num: "text-blue-500 dark:text-blue-400",   dot: "bg-blue-500"   },
  sick:      { bar: "bg-rose-500",   num: "text-rose-500 dark:text-rose-400",   dot: "bg-rose-500"   },
  unpaid:    { bar: "bg-slate-400",  num: "text-slate-500 dark:text-slate-400", dot: "bg-slate-400"  },
  maternity: { bar: "bg-purple-500", num: "text-purple-500 dark:text-purple-400", dot: "bg-purple-500" },
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    let start = 0
    const end = value
    if (start === end) { setDisplayed(end); return }
    const duration = 800
    const step = Math.ceil(duration / Math.max(end, 1))
    const timer = setInterval(() => {
      start = Math.min(start + Math.max(1, Math.ceil(end / 20)), end)
      setDisplayed(start)
      if (start >= end) clearInterval(timer)
    }, step)
    return () => clearInterval(timer)
  }, [value])
  return <>{displayed}{suffix}</>
}

const NOTIF_CONFIG: Record<NotificationItem["kind"], { icon: React.ElementType; iconClass: string; bgClass: string }> = {
  leave_approved:          { icon: CheckCircle, iconClass: "text-emerald-400", bgClass: "bg-emerald-500/10 border-emerald-500/20" },
  leave_rejected:          { icon: XCircle,     iconClass: "text-rose-400",    bgClass: "bg-rose-500/10 border-rose-500/20"    },
  leave_pending:           { icon: Clock,       iconClass: "text-amber-400",   bgClass: "bg-amber-500/10 border-amber-500/20"  },
  team_leave_pending:      { icon: AlertCircle, iconClass: "text-amber-400",   bgClass: "bg-amber-500/10 border-amber-500/20"  },
  visitor_checkin:         { icon: UserPlus,    iconClass: "text-violet-400",  bgClass: "bg-violet-500/10 border-violet-500/20"},
  expense_approved:        { icon: CheckCircle, iconClass: "text-emerald-400", bgClass: "bg-emerald-500/10 border-emerald-500/20" },
  expense_rejected:        { icon: XCircle,     iconClass: "text-rose-400",    bgClass: "bg-rose-500/10 border-rose-500/20"    },
  expense_pending:         { icon: Clock,       iconClass: "text-amber-400",   bgClass: "bg-amber-500/10 border-amber-500/20"  },
  expense_pending_approval:{ icon: AlertCircle, iconClass: "text-blue-400",    bgClass: "bg-blue-500/10 border-blue-500/20"   },
}

// ── Widget: Quick Actions ──────────────────────────────────
function QuickActionsWidget({
  clockedIn, isAdmin, isReception, onRunningLate,
  showLateModal, setShowLateModal, lateReason, setLateReason,
  isLatePending, handleRunningLateSubmit,
}: {
  clockedIn: boolean
  isAdmin: boolean
  isReception: boolean
  onRunningLate: () => void
  showLateModal: boolean
  setShowLateModal: (v: boolean) => void
  lateReason: string
  setLateReason: (v: string) => void
  isLatePending: boolean
  handleRunningLateSubmit: () => void
}) {
  const quickActions = [
    { href: "/attendance", icon: clockedIn ? LogOut : LogIn, label: clockedIn ? "Clock Out" : "Clock In", grad: "from-emerald-400 to-emerald-600" },
    { href: "/leave/new",  icon: CalendarDays, label: "Request Leave",  grad: "from-blue-400 to-blue-600"   },
    { href: "/visitors/new", icon: UserPlus,   label: "Book Visitor",   grad: "from-violet-400 to-violet-600" },
    { href: "/timesheets", icon: FileText,     label: "Timesheets",     grad: "from-orange-400 to-orange-500" },
    { href: "/directory",     icon: Users,      label: "Directory",      grad: "from-teal-400 to-teal-600"   },
    { href: "/expenses",      icon: Receipt,    label: "Add Expense",    grad: "from-emerald-500 to-emerald-700" },
    { href: "/announcements", icon: Megaphone,  label: "Announce",       grad: "from-blue-500 to-blue-700" },
    ...(isAdmin ? [{ href: "/manager/approvals", icon: CheckCircle, label: "Approvals", grad: "from-rose-400 to-rose-600" }] : []),
    ...(isAdmin || isReception ? [{ href: "/reception/today", icon: Coffee, label: "Reception", grad: "from-amber-400 to-amber-500" }] : []),
  ]

  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden flex flex-col h-full">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />Quick Actions
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 pb-4 flex-1 content-start">
        {quickActions.map((a) => (
          <Link key={a.href} href={a.href}
            className="flex flex-col items-center gap-2 group">
            <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${a.grad} flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-200`}>
              <a.icon className="h-6 w-6 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{a.label}</span>
          </Link>
        ))}
        <button onClick={onRunningLate} className="flex flex-col items-center gap-2 group">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-200">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <span className="text-[11px] font-semibold text-foreground text-center leading-tight">Running Late</span>
        </button>
      </div>

      {/* Running Late Modal */}
      {showLateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-2">Log Running Late</h3>
            <p className="text-sm text-muted-foreground mb-4">Your manager will be notified. Optionally let them know why.</p>
            <textarea
              className="w-full h-24 p-3 rounded-xl border border-border bg-muted/30 mb-4 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
              placeholder="e.g. Delayed train, heavy traffic... (optional)"
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowLateModal(false); setLateReason("") }}
                disabled={isLatePending}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRunningLateSubmit}
                disabled={isLatePending}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isLatePending ? "Logging…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Widget: Leave Balances ─────────────────────────────────
const LEAVE_CARD: Record<string, { bg: string; num: string; bar: string; label: string }> = {
  annual:    { bg: "bg-blue-500/10",   num: "text-blue-600 dark:text-blue-400",   bar: "bg-blue-500",   label: "Annual"    },
  sick:      { bg: "bg-rose-500/10",   num: "text-rose-600 dark:text-rose-400",   bar: "bg-rose-500",   label: "Sick"      },
  unpaid:    { bg: "bg-slate-500/10",  num: "text-slate-600 dark:text-slate-400", bar: "bg-slate-400",  label: "Unpaid"    },
  maternity: { bg: "bg-purple-500/10", num: "text-purple-600 dark:text-purple-400", bar: "bg-purple-500", label: "Maternity" },
}

function LeaveBalancesWidget({
  leaveBalances, pendingApprovals, myPendingLeave,
}: {
  leaveBalances: LeaveBalance[]
  pendingApprovals: number
  myPendingLeave: number
}) {
  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden flex flex-col h-full">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />Leave Balances
        </h2>
        <Link href="/leave" className="text-xs font-semibold text-primary hover:opacity-75 flex items-center gap-1">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {leaveBalances.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">No balances found.</div>
      ) : (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3 flex-1 content-start">
          {leaveBalances.map((lb) => {
            const effectiveTotal = Number(lb.total) + Number(lb.carried_forward ?? 0)
            const remaining = Math.max(0, effectiveTotal - lb.used - lb.pending)
            const pct = effectiveTotal > 0 ? Math.min(100, ((lb.used + lb.pending) / effectiveTotal) * 100) : 0
            const card = LEAVE_CARD[lb.leave_type] ?? { bg: "bg-zinc-500/10", num: "text-zinc-600 dark:text-zinc-400", bar: "bg-zinc-400", label: lb.leave_type }
            return (
              <div key={lb.leave_type} className={`rounded-2xl ${card.bg} p-4 flex flex-col gap-2`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</p>
                <p className={`text-3xl font-black tabular-nums leading-none ${card.num}`}>{remaining}<span className="text-base font-semibold ml-0.5">d</span></p>
                <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ease-out ${card.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">{lb.used}d used · {effectiveTotal}d total</p>
              </div>
            )
          })}
        </div>
      )}

      {(pendingApprovals > 0 || myPendingLeave > 0) && (
        <div className="px-4 pb-4 space-y-2">
          {pendingApprovals > 0 && (
            <Link href="/manager/approvals"
              className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 hover:bg-amber-500/20 transition-colors">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {pendingApprovals} awaiting approval
                </span>
              </div>
              <ArrowRight className="h-3 w-3 text-amber-500" />
            </Link>
          )}
          {myPendingLeave > 0 && (
            <Link href="/leave"
              className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 hover:bg-blue-500/20 transition-colors">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {myPendingLeave} pending approval
                </span>
              </div>
              <ArrowRight className="h-3 w-3 text-blue-500" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ── Widget: Notifications ──────────────────────────────────
const NOTIF_BORDER: Record<NotificationItem["kind"], string> = {
  leave_approved:          "border-l-emerald-500",
  leave_rejected:          "border-l-rose-500",
  leave_pending:           "border-l-amber-500",
  team_leave_pending:      "border-l-amber-500",
  visitor_checkin:         "border-l-violet-500",
  expense_approved:        "border-l-emerald-500",
  expense_rejected:        "border-l-rose-500",
  expense_pending:         "border-l-amber-500",
  expense_pending_approval:"border-l-blue-500",
}

function NotificationsWidget({ notifications }: { notifications: NotificationItem[] }) {
  const recent = notifications.slice(0, 8)

  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden flex flex-col h-full min-h-[240px]">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />Notifications
        </h2>
        {recent.length > 0 && (
          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{recent.length} recent</span>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center ring-1 ring-emerald-500/20">
            <Bell className="h-7 w-7 text-emerald-500/60" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px]">Leave approvals, visitor check-ins and team requests will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-3 px-4 space-y-1.5">
          {recent.map((n) => {
            const cfg = NOTIF_CONFIG[n.kind]
            const border = NOTIF_BORDER[n.kind]
            const Icon = cfg.icon
            return (
              <Link key={n.id} href={n.link}
                className={`flex items-center gap-3 px-3 py-3 border-l-[3px] ${border} rounded-r-xl bg-muted/25 hover:bg-muted/50 transition-colors`}>
                <div className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center ${cfg.bgClass}`}>
                  <Icon className={`h-4 w-4 ${cfg.iconClass}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{n.label}</p>
                  {n.sub && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.sub}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                  {new Date(n.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── MiniCalendar ───────────────────────────────────────────
function MiniCalendar({ leaveRequests }: { leaveRequests: any[] }) {
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const leaveMap = new Map<string, "approved" | "pending">()
  for (const lr of leaveRequests) {
    if (lr.status !== "approved" && lr.status !== "pending") continue
    const start = new Date(lr.start_date + "T12:00:00")
    const end = new Date(lr.end_date + "T12:00:00")
    const cur = new Date(start)
    while (cur <= end) {
      const key = cur.toISOString().split("T")[0]
      if (lr.status === "approved") leaveMap.set(key, "approved")
      else if (!leaveMap.has(key)) leaveMap.set(key, "pending")
      cur.setDate(cur.getDate() + 1)
    }
  }

  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden flex flex-col h-full min-h-[320px]">
      {/* Gradient header strip */}
      <div className="bg-gradient-to-r from-primary/90 to-primary px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-primary-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary-foreground/70" />My Calendar
          </h2>
          <Link href="/calendar" className="text-[11px] font-semibold text-primary-foreground/70 hover:text-primary-foreground flex items-center gap-1 transition-colors">
            Full view <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="h-7 w-7 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center justify-center text-primary-foreground/70 hover:text-primary-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-extrabold text-primary-foreground tracking-tight">
            {viewDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="h-7 w-7 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center justify-center text-primary-foreground/70 hover:text-primary-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-2 pb-1 grid grid-cols-7 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <p key={i} className={`text-[10px] font-bold uppercase ${i >= 5 ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{d}</p>
        ))}
      </div>

      <div className="px-4 pb-4 grid grid-cols-7 gap-y-0.5 text-center flex-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
          const isToday = dateStr === todayStr
          const leaveStatus = leaveMap.get(dateStr)
          const isWeekend = ((firstDayOfWeek + d - 1) % 7) >= 5
          return (
            <div key={dateStr} className="flex flex-col items-center gap-0.5 py-0.5">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                isToday
                  ? "bg-primary text-primary-foreground"
                  : leaveStatus === "approved"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : leaveStatus === "pending"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : isWeekend
                  ? "text-muted-foreground/50"
                  : "text-foreground hover:bg-muted"
              }`}>
                {d}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-5 pb-4 pt-1 border-t border-border/40 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[10px] text-muted-foreground">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-muted-foreground">Approved leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-[10px] text-muted-foreground">Pending</span>
        </div>
      </div>
    </div>
  )
}

// ── Widget: Diary ──────────────────────────────────────────
function DiaryWidget({ diaryReminders }: { diaryReminders: any[] }) {
  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden flex flex-col h-full min-h-[240px]">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />Reminders This Week
        </h2>
        <Link href="/diary" className="text-xs font-semibold text-primary hover:opacity-75 flex items-center gap-1">
          Diary <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {diaryReminders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-violet-500/60" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No reminders this week</p>
            <p className="text-xs text-muted-foreground mt-0.5">Set a reminder when adding a diary entry.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
          {diaryReminders.map((r: any) => {
            const d = new Date(r.reminder_at)
            const isToday = d.toDateString() === new Date().toDateString()
            const isTomorrow = d.toDateString() === new Date(Date.now() + 86400000).toDateString()
            const dayLabel = isToday ? "TODAY" : isTomorrow ? "TOMORROW" : d.toLocaleDateString("en-GB", { weekday: "long" })
            const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
            const tags: string[] = Array.isArray(r.tags) ? r.tags : []
            const borderColor = isToday ? "border-amber-500" : "border-violet-500"
            const dotColor = isToday ? "bg-amber-500" : "bg-violet-500"
            return (
              <Link key={r.id} href="/diary"
                className={`flex items-start gap-3 pl-3 pr-3 py-3 border-l-[3px] ${borderColor} rounded-r-xl bg-muted/30 hover:bg-muted/60 transition-colors`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? "text-amber-600 dark:text-amber-400" : "text-violet-600 dark:text-violet-400"}`}>{dayLabel}</p>
                    <span className="text-[10px] text-muted-foreground ml-auto">{time}</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate">{r.title}</p>
                  {tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {tags.slice(0, 3).map(t => (
                        <span key={t} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Widget: Week Summary ───────────────────────────────────
function WeekSummaryWidget({ weekHours, expectedHoursThisWeek, contractedWeeklyHours }: { weekHours: number; expectedHoursThisWeek: number; contractedWeeklyHours: number }) {
  const target = contractedWeeklyHours > 0 ? contractedWeeklyHours : 40
  const pct = Math.min(100, (weekHours / target) * 100)
  const radius = 38
  const circ = 2 * Math.PI * radius
  const dash = (pct / 100) * circ
  const over = weekHours >= target

  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden h-full">
      <div className="flex items-center gap-4 p-5 h-full">
        {/* SVG ring */}
        <div className="relative shrink-0 h-[90px] w-[90px]">
          <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
            <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
            <circle
              cx="48" cy="48" r={radius} fill="none"
              stroke="url(#ringGrad)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={over ? "#34d399" : "#10b981"} />
                <stop offset="100%" stopColor={over ? "#6ee7b7" : "#34d399"} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className="text-xl font-black tabular-nums text-foreground leading-none">
              {weekHours.toFixed(1)}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">hrs</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">This Week</p>
          <p className="text-2xl font-black tabular-nums text-foreground leading-none">
            {weekHours.toFixed(1)}<span className="text-sm font-medium text-muted-foreground">/{target}h</span>
          </p>
          <p className={`text-xs font-semibold mt-1.5 ${over ? "text-emerald-500" : "text-amber-500"}`}>
            {over ? `+${(weekHours - target).toFixed(1)}h over target` : `${(target - weekHours).toFixed(1)}h to go`}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${over ? "bg-emerald-400" : "bg-emerald-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Widget: Team Calendar ──────────────────────────────────
function TeamCalendarWidget() {
  return (
    <Link href="/calendar" className="relative rounded-2xl overflow-hidden shadow hover:shadow-md transition-all group bg-primary h-full flex">
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white, transparent 55%)" }} />
      <div className="relative flex items-center gap-4 p-5 w-full">
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary-foreground/15 flex items-center justify-center">
          <CalendarDays className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/60 mb-0.5">Team Calendar</p>
          <p className="text-sm font-bold text-primary-foreground">See who&apos;s in &amp; off today</p>
        </div>
        <ArrowRight className="h-5 w-5 text-primary-foreground/70 shrink-0 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}

// ── Widget: Help ───────────────────────────────────────────
function HelpWidget() {
  return (
    <Link href="/help" className="rounded-2xl bg-card shadow overflow-hidden hover:shadow-md transition-all group h-full flex">
      <div className="flex items-center gap-4 p-5 w-full">
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-muted flex items-center justify-center">
          <HelpCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground mb-0.5">New here?</p>
          <p className="text-base font-bold text-foreground">How to use StaffPortal</p>
          <p className="text-xs text-muted-foreground mt-0.5">Attendance · Leave · Timesheets</p>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}

// ── Widget: Upcoming Leave ─────────────────────────────────
const LEAVE_TYPE_GRAD: Record<string, { bg: string; text: string; month: string }> = {
  annual:    { bg: "bg-blue-500",   text: "text-white", month: "text-blue-100"   },
  sick:      { bg: "bg-rose-500",   text: "text-white", month: "text-rose-100"   },
  unpaid:    { bg: "bg-slate-500",  text: "text-white", month: "text-slate-200"  },
  maternity: { bg: "bg-purple-500", text: "text-white", month: "text-purple-100" },
}

function UpcomingLeaveWidget({ leaveRequests }: { leaveRequests: any[] }) {
  const today = new Date().toISOString().split("T")[0]
  const upcoming = leaveRequests
    .filter(r => r.status === "approved" && r.start_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 4)

  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plane className="h-4 w-4 text-muted-foreground" />Upcoming Leave
        </h2>
        <Link href="/leave" className="text-xs font-semibold text-primary hover:opacity-75 flex items-center gap-1">
          All leave <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Plane className="h-6 w-6 text-blue-500/60" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No upcoming leave</p>
            <p className="text-xs text-muted-foreground mt-0.5">Approved leave will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 px-4 pb-4 space-y-2">
          {upcoming.map((r: any) => {
            const start = new Date(r.start_date + "T12:00:00")
            const end = new Date(r.end_date + "T12:00:00")
            const isHalfDay = Number(r.days_count) === 0.5
            const days = r.days_count ?? (Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
            const startFmt = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            const endFmt   = end.toLocaleDateString("en-GB",   { day: "numeric", month: "short" })
            const style = LEAVE_TYPE_GRAD[r.leave_type] ?? { bg: "bg-zinc-500", text: "text-white", month: "text-zinc-200" }
            return (
              <Link key={r.id} href="/leave"
                className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30 hover:bg-muted/60 transition-colors group">
                {/* Date badge */}
                <div className={`h-12 w-12 shrink-0 rounded-2xl ${style.bg} flex flex-col items-center justify-center shadow-sm`}>
                  <span className={`text-lg font-black leading-none ${style.text}`}>{start.getDate()}</span>
                  <span className={`text-[9px] font-bold uppercase ${style.month}`}>{start.toLocaleDateString("en-GB", { month: "short" })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground capitalize">{r.leave_type} leave</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isHalfDay ? "Half day" : start.toDateString() === end.toDateString() ? startFmt : `${startFmt} – ${endFmt}`}
                  </p>
                  <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {isHalfDay ? "0.5" : days} day{Number(days) !== 1 ? "s" : ""}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Widget: Approvals ──────────────────────────────────────
function ApprovalsWidget({ pendingApprovals, myPendingLeave }: { pendingApprovals: number; myPendingLeave: number }) {
  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />Approvals
        </h2>
      </div>
      <div className="px-5 pb-5 flex-1 space-y-3">
        {/* Team requests */}
        <Link href="/manager/approvals"
          className={`flex items-center justify-between rounded-xl border p-4 transition-colors group ${
            pendingApprovals > 0
              ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20"
              : "border-border/40 bg-muted/20 hover:bg-muted/40"
          }`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${pendingApprovals > 0 ? "bg-amber-500/20" : "bg-muted"}`}>
              <ClipboardList className={`h-5 w-5 ${pendingApprovals > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Team Requests</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {pendingApprovals > 0 ? `${pendingApprovals} awaiting your approval` : "All caught up"}
              </p>
            </div>
          </div>
          {pendingApprovals > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white">{pendingApprovals}</span>
              <ArrowRight className="h-4 w-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </Link>

        {/* My leave requests */}
        <Link href="/leave"
          className={`flex items-center justify-between rounded-xl border p-4 transition-colors group ${
            myPendingLeave > 0
              ? "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20"
              : "border-border/40 bg-muted/20 hover:bg-muted/40"
          }`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${myPendingLeave > 0 ? "bg-blue-500/20" : "bg-muted"}`}>
              <CalendarDays className={`h-5 w-5 ${myPendingLeave > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">My Leave Requests</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {myPendingLeave > 0 ? `${myPendingLeave} pending approval` : "No pending requests"}
              </p>
            </div>
          </div>
          {myPendingLeave > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">{myPendingLeave}</span>
              <ArrowRight className="h-4 w-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </Link>
      </div>
    </div>
  )
}

// ── Expenses Widget ─────────────────────────────────────────
function ExpensesWidget() {
  const supabase = createClient()
  const [stats, setStats] = useState<{ total: number; pending: number; approved: number } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const supabaseAny = supabase as any
      const { data } = await supabaseAny
        .from('expenses')
        .select('status, converted_gbp, amount, payment_method')
        .eq('user_id', user.id)
        .gte('date', monthStart)
      if (data) {
        const pending = (data as any[]).filter(e => e.status === 'submitted').length
        const approved = (data as any[]).filter(e => e.status === 'approved').length
        const total = (data as any[])
          .reduce((s: number, e: any) => {
            const sign = e.payment_method === 'refund' ? -1 : 1
            return s + sign * (e.converted_gbp ?? e.amount ?? 0)
          }, 0)
        setStats({ total, pending, approved })
      }
    }
    load()
  }, [])

  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />Expenses
        </h2>
        <Link href="/expenses" className="text-xs text-primary font-semibold hover:underline">View all</Link>
      </div>
      <div className="px-5 pb-5 flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-xl p-3 text-center ${stats && stats.total < 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-blue-50 dark:bg-blue-950/30'}`}>
            <p className={`text-lg font-black ${stats && stats.total < 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
              {stats ? `${stats.total < 0 ? '-' : ''}£${Math.abs(Math.round(stats.total))}` : '—'}
            </p>
            <p className={`text-[10px] font-semibold mt-0.5 ${stats && stats.total < 0 ? 'text-emerald-500' : 'text-blue-500'}`}>This Month</p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
            <p className="text-lg font-black text-amber-600">{stats?.pending ?? '—'}</p>
            <p className="text-[10px] text-amber-500 font-semibold mt-0.5">Pending</p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
            <p className="text-lg font-black text-emerald-600">{stats?.approved ?? '—'}</p>
            <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">Approved</p>
          </div>
        </div>
        <Link href="/expenses"
          className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 p-4 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Add Expense</p>
              <p className="text-[11px] text-muted-foreground">Claim or record a purchase</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  )
}

// ── Announcements Widget ────────────────────────────────────
function AnnouncementsWidget() {
  const supabase = createClient()
  const [items, setItems] = useState<{ id: string; subject: string; category: string; sent_by_name: string; sent_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  const CATEGORY_EMOJI: Record<string, string> = {
    general: '📢', ooo: '🏖️', event: '📅', closure: '🏢',
    celebrate: '🎉', newjoiner: '👋', policy: '📋', urgent: '⚠️', it: '🔧',
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const supabaseAny = supabase as any
      const { data } = await supabaseAny
        .from('announcements')
        .select('id, subject, category, sent_by_name, sent_at')
        .order('sent_at', { ascending: false })
        .limit(4)
      setItems(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="rounded-2xl bg-card shadow overflow-hidden flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-muted-foreground" />Announcements
        </h2>
        <Link href="/announcements" className="text-xs text-primary font-semibold hover:underline">Send</Link>
      </div>
      <div className="px-4 pb-4 flex-1 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <Link href="/announcements"
            className="flex items-center justify-between rounded-xl border border-dashed border-border hover:border-primary/40 bg-muted/10 hover:bg-muted/30 p-4 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <Megaphone className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Send an Announcement</p>
                <p className="text-[11px] text-muted-foreground">Email all staff instantly</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </Link>
        ) : (
          <>
            {items.map(a => (
              <Link key={a.id} href="/announcements"
                className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/10 hover:bg-muted/30 px-3 py-2.5 transition-colors">
                <span className="text-base shrink-0 mt-0.5">{CATEGORY_EMOJI[a.category] ?? '📢'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">{a.subject}</p>
                  <p className="text-[11px] text-muted-foreground">{a.sent_by_name} · {timeAgo(a.sent_at)}</p>
                </div>
              </Link>
            ))}
            <Link href="/announcements"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border hover:border-primary/40 py-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
              <Plus className="h-3.5 w-3.5" /> New Announcement
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export default function DashboardClient({
  userId, clockedIn, clockInTime, clockInIso, completedWeekHours, weekHours: _weekHours, expectedHoursThisWeek, contractedWeeklyHours,
  scheduledDaysPassed, scheduledDaysTotal,
  leaveBalances, pendingApprovals, myPendingLeave, visitorsToday, notifications,
  isAdmin, isReception, displayName, diaryReminders, leaveRequests,
}: DashboardClientProps) {
  const { config, ready, reorder, setSize, remove, restore } = useWidgetConfig()
  const [editMode, setEditMode] = useState(false)
  const [now, setNow] = useState(new Date())
  const [showLateModal, setShowLateModal] = useState(false)
  const [lateReason, setLateReason] = useState("")
  const [isLatePending, startLateTransition] = useTransition()
  const router = useRouter()
  const refreshing = useRef(false)

  // Live week hours — updates every second while clocked in
  const liveWeekHours = clockedIn && clockInIso
    ? completedWeekHours + Math.max(0, (now.getTime() - new Date(clockInIso).getTime()) / 3600000)
    : completedWeekHours
  const weekHours = liveWeekHours

  function handleRunningLateSubmit() {
    startLateTransition(async () => {
      const result = await logRunningLate(userId, lateReason.trim() || undefined)
      if (!result.success) { toast.error(result.error ?? "Failed to log"); return }
      setShowLateModal(false)
      setLateReason("")
      toast.success("Running late logged — see you when you get here!")
    })
  }

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Live push — Supabase Realtime + 30s fallback polling
  useEffect(() => {
    const supabase = createClient()

    function refresh() {
      if (refreshing.current) return
      refreshing.current = true
      router.refresh()
      setTimeout(() => { refreshing.current = false }, 3000)
    }

    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance",     filter: `user_id=eq.${userId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests", filter: `user_id=eq.${userId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_balances", filter: `user_id=eq.${userId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" },  refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" },        refresh)
      .subscribe()

    const poll = setInterval(refresh, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [userId, router])

  const hour = now.getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = displayName.split(" ")[0]
  const annualBalance = leaveBalances.find(b => b.leave_type === "annual")
  const annualEffectiveTotal = annualBalance ? Number(annualBalance.total) + Number(annualBalance.carried_forward ?? 0) : 0
  const annualRemaining = annualBalance ? Math.max(0, annualEffectiveTotal - annualBalance.used - annualBalance.pending) : 0

  // dnd-kit sensors
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorder(String(active.id), String(over.id))
    }
  }

  const visibleWidgets = ready ? config.filter(c => c.visible) : DEFAULT_CONFIG.filter(c => c.visible)

  function renderWidgetContent(id: WidgetId) {
    switch (id) {
      case "quick-actions":
        return (
          <QuickActionsWidget
            clockedIn={clockedIn}
            isAdmin={isAdmin}
            isReception={isReception}
            onRunningLate={() => setShowLateModal(true)}
            showLateModal={showLateModal}
            setShowLateModal={setShowLateModal}
            lateReason={lateReason}
            setLateReason={setLateReason}
            isLatePending={isLatePending}
            handleRunningLateSubmit={handleRunningLateSubmit}
          />
        )
      case "leave-balances":
        return (
          <LeaveBalancesWidget
            leaveBalances={leaveBalances}
            pendingApprovals={pendingApprovals}
            myPendingLeave={myPendingLeave}
          />
        )
      case "notifications":
        return <NotificationsWidget notifications={notifications} />
      case "calendar":
        return <MiniCalendar leaveRequests={leaveRequests} />
      case "diary":
        return <DiaryWidget diaryReminders={diaryReminders} />
      case "week-summary":
        return <WeekSummaryWidget weekHours={weekHours} expectedHoursThisWeek={expectedHoursThisWeek} contractedWeeklyHours={contractedWeeklyHours} />
      case "help":
        return <HelpWidget />
      case "upcoming-leave":
        return <UpcomingLeaveWidget leaveRequests={leaveRequests} />
      case "approvals":
        return <ApprovalsWidget pendingApprovals={pendingApprovals} myPendingLeave={myPendingLeave} />
      case "expenses":
        return <ExpensesWidget />
      case "announcements":
        return <AnnouncementsWidget />
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-screen-2xl mx-auto">

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d2a4e] to-[#0a1e3a] border border-white/10 shadow-2xl">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute top-0 left-1/2 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 md:p-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-white/40 tracking-widest uppercase">
                {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              {/* Customise / Done button */}
              <button
                onClick={() => setEditMode(v => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold transition-all ${
                  editMode
                    ? "bg-emerald-500/80 border-emerald-400/50 text-white"
                    : "border-white/20 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white"
                }`}
              >
                {editMode ? (
                  <><Check className="h-3 w-3" /> Done</>
                ) : (
                  <><LayoutGrid className="h-3 w-3" /> Customise</>
                )}
              </button>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {greeting}, {firstName} <span className="inline-block animate-bounce origin-bottom">👋</span>
            </h1>
            <div className="flex items-center gap-3 pt-1">
              <div className={`h-2 w-2 rounded-full ${clockedIn ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
              <span className="text-sm text-white/50 font-medium">
                {clockedIn ? `Clocked in since ${clockInTime}` : "Not clocked in today"}
              </span>
            </div>
          </div>

          {/* Live clock */}
          <div className="shrink-0 text-right">
            <p className="text-5xl sm:text-6xl font-black text-white tabular-nums tracking-tight font-mono">
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-white/30 mt-1 font-medium tracking-widest">
              {now.toLocaleTimeString("en-GB", { second: "2-digit" })}s
            </p>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 border-t border-white/5">
          {[
            { label: "Status",       value: clockedIn ? "In" : "Out",      sub: clockedIn ? `Since ${clockInTime}` : "Not clocked in" },
            { label: "Annual Leave", value: `${annualRemaining}d`,          sub: `of ${annualEffectiveTotal} days remaining` },
          ].map((s) => (
            <div key={s.label} className="px-6 py-4 border-r border-white/5">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">{s.label}</p>
              <p className="text-xl font-extrabold text-white">{s.value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
          {/* This Week */}
          <div className="px-6 py-4 border-r border-white/5">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">This Week</p>
            <p className="text-xl font-extrabold text-white">
              {weekHours.toFixed(1)}<span className="text-sm font-medium text-white/40">/{(contractedWeeklyHours > 0 ? contractedWeeklyHours : 40).toFixed(1)}h</span>
            </p>
            <div className="mt-1.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${weekHours >= (contractedWeeklyHours > 0 ? contractedWeeklyHours : 40) ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${Math.min(100, contractedWeeklyHours > 0 ? (weekHours / contractedWeeklyHours) * 100 : 0)}%` }}
              />
            </div>
            <p className="text-[11px] text-white/40 mt-1">{scheduledDaysPassed} of {scheduledDaysTotal} days</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Visitors</p>
            <p className="text-xl font-extrabold text-white">{visitorsToday}</p>
            <p className="text-[11px] text-white/40 mt-0.5">expected today</p>
          </div>
        </div>
      </div>

      {/* Jiggle keyframe */}
      <style>{`
        @keyframes jiggle {
          0%,100% { transform: rotate(0deg) }
          25%     { transform: rotate(-0.35deg) }
          75%     { transform: rotate(0.35deg) }
        }
        .animate-jiggle { animation: jiggle 0.6s ease-in-out infinite; }
      `}</style>

      {/* ── Widget Grid ─────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleWidgets.map(w => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleWidgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                id={widget.id}
                size={widget.size}
                editMode={editMode}
                onRemove={() => remove(widget.id)}
                onResize={(s) => setSize(widget.id, s)}
              >
                {renderWidgetContent(widget.id)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>

        {/* DragOverlay — the ghost that follows the cursor */}
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
          {activeId ? (() => {
            const w = config.find(c => c.id === activeId)
            if (!w) return null
            return (
              <SortableWidget
                id={activeId}
                size={w.size}
                editMode={false}
                onRemove={() => {}}
                onResize={() => {}}
                isOverlay
              >
                {renderWidgetContent(activeId as WidgetId)}
              </SortableWidget>
            )
          })() : null}
        </DragOverlay>
      </DndContext>

      {/* ── Add / Remove Widgets panel (iOS-style gallery) ──── */}
      {editMode && (
        <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Widget Gallery</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Tap + to add · tap × on a widget to remove</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {config.filter(w => w.id !== "approvals" || isAdmin).map((widget) => {
              const meta = WIDGET_META[widget.id]
              const Icon = meta.icon
              return (
                <div
                  key={widget.id}
                  className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all ${
                    widget.visible
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/40 bg-muted/20 opacity-70"
                  }`}
                >
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${widget.visible ? "bg-primary/15" : "bg-muted"}`}>
                    <Icon className={`h-6 w-6 ${widget.visible ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className="text-xs font-semibold text-foreground text-center leading-tight">{meta.label}</span>
                  <button
                    onClick={() => widget.visible ? remove(widget.id) : restore(widget.id)}
                    className={`absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 ${
                      widget.visible
                        ? "bg-destructive text-white"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {widget.visible ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
