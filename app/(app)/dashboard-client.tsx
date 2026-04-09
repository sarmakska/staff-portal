"use client"

import React, { useState, useEffect, useRef, useTransition } from "react"
import {
  Clock, CalendarDays, UserPlus, CheckCircle, LogIn, LogOut, ArrowRight,
  AlertCircle, TrendingUp, Zap, Coffee, FileText, XCircle, Bell, BookOpen, Users, HelpCircle,
  ChevronLeft, ChevronRight, LayoutGrid, Check, GripVertical, X, Plus,
  Plane, ClipboardList, Receipt, Megaphone, Ticket, Heart,
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
  preLoggedTomorrow: boolean
  tomorrowLateReason: string | null
}

// ── Widget config types ────────────────────────────────────
type WidgetId = "notifications" | "calendar" | "diary" | "week-summary" | "help" | "approvals" | "announcements" | "polls" | "it-support" | "wellness"
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
  { id: "notifications",  size: "large",  visible: true  },
  { id: "wellness",       size: "medium", visible: true  },
  { id: "it-support",     size: "medium", visible: true  },
  { id: "calendar",       size: "medium", visible: true  },
  { id: "approvals",      size: "medium", visible: true  },
  { id: "week-summary",   size: "small",  visible: false },
  { id: "announcements",  size: "medium", visible: true  },
  { id: "diary",          size: "medium", visible: true  },
  { id: "polls",          size: "large",  visible: true  },
  { id: "help",           size: "medium", visible: false },
]

const WIDGET_META: Record<WidgetId, { label: string; icon: React.ElementType }> = {
  "notifications":  { label: "Notifications",    icon: Bell },
  "calendar":       { label: "My Calendar",      icon: CalendarDays },
  "diary":          { label: "Diary Reminders",  icon: BookOpen },
  "week-summary":   { label: "Week Summary",     icon: TrendingUp },
  "help":           { label: "How to Use",       icon: HelpCircle },
  "approvals":      { label: "Approvals",        icon: ClipboardList },
  "announcements":  { label: "Announcements",    icon: Megaphone },
  "polls":          { label: "Staff Polls",      icon: Users },
  "it-support":     { label: "IT Support",       icon: Ticket },
  "wellness":       { label: "Wellness Hub",     icon: Heart },
}

// ── useWidgetConfig hook ───────────────────────────────────
function useWidgetConfig() {
  const [config, setConfig] = useState<WidgetConfig[]>(DEFAULT_CONFIG)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dashboard_widgets_v14")
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
    try { localStorage.setItem("dashboard_widgets_v14", JSON.stringify(newConfig)) } catch { /* ignore */ }
  }

  const reorder = (activeId: string, overId: string) => {
    setConfig(prev => {
      const oldIdx = prev.findIndex(c => c.id === activeId)
      const newIdx = prev.findIndex(c => c.id === overId)
      const next = arrayMove(prev, oldIdx, newIdx)
      try { localStorage.setItem("dashboard_widgets_v14", JSON.stringify(next)) } catch { /* ignore */ }
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

function SortableWidget({ id, size, editMode, onRemove, onResize, children, isOverlay = false, index = 0 }: {
  id: string
  size: WidgetSize
  editMode: boolean
  onRemove: () => void
  onResize: (s: WidgetSize) => void
  children: React.ReactNode
  isOverlay?: boolean
  index?: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const [showSizePicker, setShowSizePicker] = useState(false)

  const colSpan = size === "large" ? "lg:col-span-2" : "lg:col-span-1"

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 200ms cubic-bezier(0.25,1,0.5,1)",
        animationDelay: isOverlay ? "0ms" : `${index * 60}ms`,
      }}
      className={`
        relative col-span-1 ${colSpan}
        ${isDragging && !isOverlay ? "opacity-0" : "opacity-100"}
        ${isOverlay ? "rotate-2 scale-105 shadow-2xl cursor-grabbing" : "widget-appear"}
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
const WIDGET_CLS = "rounded-2xl bg-card/90 shadow-sm border border-border/30 overflow-hidden flex flex-col h-full hover:shadow-lg hover:border-border/50 transition-all duration-300"

function CssMascot({ type, className = "" }: { type: "walker" | "waver" | "calendar" | "plane"; className?: string }) {
  const base = "pointer-events-none select-none"
  if (type === "walker") return (
    <span className={`${base} ${className} inline-block`} style={{ animation: 'mascotWalk 1.2s ease-in-out infinite' }}>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="5" r="2.5" fill="currentColor" opacity="0.7" />
        <path d="M12 8v7M12 11l-3.5-1.5M12 11l3.5-1.5M12 15l-2.5 5M12 15l2.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      </svg>
    </span>
  )
  if (type === "waver") return (
    <span className={`${base} ${className} inline-block origin-bottom-right text-2xl`} style={{ animation: 'mascotWave 1s ease-in-out infinite' }}>
      👋
    </span>
  )
  if (type === "calendar") return (
    <span className={`${base} ${className} inline-block`} style={{ animation: 'mascotBounce 1.5s ease-in-out infinite' }}>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="3" y="6" width="18" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <circle cx="12" cy="16" r="2" fill="currentColor" opacity="0.3" />
      </svg>
    </span>
  )
  return (
    <span className={`${base} ${className} inline-block`} style={{ animation: 'mascotFloat 2.5s ease-in-out infinite' }}>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M22 2L11 13M22 2l-7 20-3-7-7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      </svg>
    </span>
  )
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
  expense_pending_approval:{ icon: AlertCircle,    iconClass: "text-blue-400",    bgClass: "bg-blue-500/10 border-blue-500/20"    },
  pr_approved:             { icon: CheckCircle,   iconClass: "text-emerald-400", bgClass: "bg-emerald-500/10 border-emerald-500/20" },
  pr_rejected:             { icon: XCircle,       iconClass: "text-rose-400",    bgClass: "bg-rose-500/10 border-rose-500/20"      },
  pr_pending:              { icon: Clock,         iconClass: "text-amber-400",   bgClass: "bg-amber-500/10 border-amber-500/20"    },
  pr_submitted:            { icon: ClipboardList, iconClass: "text-violet-400",  bgClass: "bg-violet-500/10 border-violet-500/20"  },
}

// ── Widget: Quick Actions ──────────────────────────────────
function QuickActionsWidget({
  clockedIn, isAdmin, isReception, onRunningLate,
  showLateModal, setShowLateModal, lateReason, setLateReason,
  lateDay, setLateDay, isLatePending, handleRunningLateSubmit,
}: {
  clockedIn: boolean
  isAdmin: boolean
  isReception: boolean
  onRunningLate: () => void
  showLateModal: boolean
  setShowLateModal: (v: boolean) => void
  lateReason: string
  setLateReason: (v: string) => void
  lateDay: 'today' | 'tomorrow'
  setLateDay: (v: 'today' | 'tomorrow') => void
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
    { href: "/newsletters",   icon: BookOpen,   label: "Newsletters",    grad: "from-slate-400 to-slate-600" },
    ...(isAdmin ? [{ href: "/manager/approvals", icon: CheckCircle, label: "Approvals", grad: "from-rose-400 to-rose-600" }] : []),
    ...(isAdmin || isReception ? [{ href: "/reception/today", icon: Coffee, label: "Reception", grad: "from-amber-400 to-amber-500" }] : []),
  ]

  return (
    <>
      <div className="widget-appear" style={{ animationDelay: '60ms' }}>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none lg:flex-wrap">
          {quickActions.map((a) => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-card/80 border border-border/40 hover:border-primary/40 hover:shadow-sm group whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95">
              <div className={`h-6 w-6 rounded-full bg-gradient-to-br ${a.grad} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                <a.icon className="h-3 w-3 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{a.label}</span>
            </Link>
          ))}
          <button onClick={onRunningLate} className="flex items-center gap-2 px-3 py-2 rounded-full bg-card/80 border border-border/40 hover:border-amber-400/40 hover:shadow-sm group whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200">
              <Clock className="h-3 w-3 text-white" />
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Running Late</span>
          </button>
        </div>
      </div>

      {/* Running Late Modal */}
      {showLateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold mb-2">Log Running Late</h3>
            <p className="text-sm text-muted-foreground mb-4">Your manager will be notified immediately. Optionally let them know why.</p>

            {/* Today / Tomorrow toggle */}
            <div className="flex rounded-xl border border-border overflow-hidden mb-4">
              {(['today', 'tomorrow'] as const).map((day) => (
                <button
                  key={day}
                  onClick={() => setLateDay(day)}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors capitalize ${
                    lateDay === day
                      ? 'bg-amber-500 text-white'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  {day === 'today' ? 'Today' : 'Tomorrow'}
                </button>
              ))}
            </div>

            <textarea
              className="w-full h-24 p-3 rounded-xl border border-border bg-muted/30 mb-4 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
              placeholder="e.g. Delayed train, heavy traffic... (optional)"
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowLateModal(false); setLateReason(""); setLateDay('today') }}
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
    </>
  )
}

// ── Widget: Leave Balances ─────────────────────────────────
const LEAVE_CARD: Record<string, { bg: string; num: string; bar: string; label: string }> = {
  annual:    { bg: "bg-blue-500/10",   num: "text-blue-600 dark:text-blue-400",   bar: "bg-blue-500",   label: "Annual"    },
  sick:      { bg: "bg-rose-500/10",   num: "text-rose-600 dark:text-rose-400",   bar: "bg-rose-500",   label: "Sick"      },
  unpaid:    { bg: "bg-slate-500/10",  num: "text-slate-600 dark:text-slate-400", bar: "bg-slate-400",  label: "Unpaid"    },
  maternity: { bg: "bg-purple-500/10", num: "text-purple-600 dark:text-purple-400", bar: "bg-purple-500", label: "Maternity" },
}

function LeaveBalancesBar({
  leaveBalances, pendingApprovals, myPendingLeave,
}: {
  leaveBalances: LeaveBalance[]
  pendingApprovals: number
  myPendingLeave: number
}) {
  return (
    <div className="widget-appear" style={{ animationDelay: '120ms' }}>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {leaveBalances.map((lb) => {
          const effectiveTotal = Number(lb.total) + Number(lb.carried_forward ?? 0)
          const remaining = Math.max(0, effectiveTotal - lb.used - lb.pending)
          const pct = effectiveTotal > 0 ? Math.min(100, ((lb.used + lb.pending) / effectiveTotal) * 100) : 0
          const card = LEAVE_CARD[lb.leave_type] ?? { bg: "bg-zinc-500/10", num: "text-zinc-600 dark:text-zinc-400", bar: "bg-zinc-400", label: lb.leave_type }
          return (
            <Link key={lb.leave_type} href="/leave"
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl ${card.bg} border border-border/20 shrink-0 min-w-[150px] hover:shadow-sm transition-all duration-200 group`}>
              <div className="flex flex-col items-start min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</p>
                <p className={`text-xl font-black tabular-nums leading-tight ${card.num}`}>{remaining}<span className="text-[10px] font-semibold ml-0.5">d</span></p>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[40px]">
                <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ease-out ${card.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground whitespace-nowrap">{lb.used}d / {effectiveTotal}d</p>
              </div>
            </Link>
          )
        })}

        {pendingApprovals > 0 && (
          <Link href="/manager/approvals" className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 shrink-0 transition-colors">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">{pendingApprovals} to approve</span>
          </Link>
        )}
        {myPendingLeave > 0 && (
          <Link href="/leave" className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 shrink-0 transition-colors">
            <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">{myPendingLeave} pending</span>
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Widget: Notifications ──────────────────────────────────
const NOTIF_BORDER: Record<NotificationItem["kind"], string> = {
  leave_approved:           "border-l-emerald-500",
  leave_rejected:           "border-l-rose-500",
  leave_pending:            "border-l-amber-500",
  team_leave_pending:       "border-l-amber-500",
  visitor_checkin:          "border-l-violet-500",
  expense_approved:         "border-l-emerald-500",
  expense_rejected:         "border-l-rose-500",
  expense_pending:          "border-l-amber-500",
  expense_pending_approval: "border-l-blue-500",
  pr_approved:              "border-l-emerald-500",
  pr_rejected:              "border-l-rose-500",
  pr_pending:               "border-l-amber-500",
  pr_submitted:             "border-l-violet-500",
}

function NotificationsWidget({ notifications }: { notifications: NotificationItem[] }) {
  const recent = notifications.slice(0, 8)

  return (
    <div className={WIDGET_CLS}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
          <Bell className="h-3.5 w-3.5 text-blue-500" />Notifications
        </h2>
        {recent.length > 0 && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{recent.length}</span>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 justify-center">
          <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Check className="h-3 w-3 text-emerald-500" />
          </div>
          <p className="text-[11px] text-muted-foreground">All caught up</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-2 px-2.5 space-y-0.5">
          {recent.map((n) => {
            const cfg = NOTIF_CONFIG[n.kind]
            const Icon = cfg.icon
            return (
              <Link key={n.id} href={n.link}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-all duration-150 group">
                <div className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center ${cfg.bgClass}`}>
                  <Icon className={`h-3 w-3 ${cfg.iconClass}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-foreground truncate group-hover:text-primary transition-colors">{n.label}</p>
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
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
    <div className={WIDGET_CLS}>
      {/* Month nav */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-foreground tracking-tight">
            {viewDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          </p>
          <CssMascot type="calendar" className="text-primary/50" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <Link href="/calendar" className="text-[9px] font-bold text-primary hover:opacity-75">View</Link>
        </div>
      </div>

      <div className="px-3 pt-1 grid grid-cols-7 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <p key={i} className={`text-[9px] font-bold ${i >= 5 ? "text-muted-foreground/30" : "text-muted-foreground/60"}`}>{d}</p>
        ))}
      </div>

      <div className="px-3 pb-2 grid grid-cols-7 text-center flex-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
          const isToday = dateStr === todayStr
          const leaveStatus = leaveMap.get(dateStr)
          const isWeekend = ((firstDayOfWeek + d - 1) % 7) >= 5
          return (
            <div key={dateStr} className="flex items-center justify-center py-[3px]">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all duration-150 ${
                isToday ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30" :
                leaveStatus === "approved" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" :
                leaveStatus === "pending" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                isWeekend ? "text-muted-foreground/30" : "text-foreground/80 hover:bg-muted"
              }`}>
                {d}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-3 pb-2 flex items-center gap-3 border-t border-border/20 pt-1.5">
        {[
          { color: "bg-primary", label: "Today" },
          { color: "bg-blue-500", label: "Leave" },
          { color: "bg-amber-400", label: "Pending" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full ${l.color}`} />
            <span className="text-[9px] text-muted-foreground/60">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Widget: Diary ──────────────────────────────────────────
function DiaryWidget({ diaryReminders }: { diaryReminders: any[] }) {
  return (
    <div className={WIDGET_CLS}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
          <BookOpen className="h-3.5 w-3.5 text-violet-500" />Reminders
        </h2>
        <Link href="/diary" className="text-[10px] font-bold text-primary hover:opacity-75 flex items-center gap-1">
          Diary <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {diaryReminders.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-3 justify-center">
          <BookOpen className="h-4 w-4 text-violet-500/40" />
          <p className="text-[11px] text-muted-foreground">No reminders this week</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-0.5">
          {diaryReminders.map((r: any) => {
            const d = new Date(r.reminder_at)
            const isToday = d.toDateString() === new Date().toDateString()
            const isTomorrow = d.toDateString() === new Date(Date.now() + 86400000).toDateString()
            const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short" })
            const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
            return (
              <Link key={r.id} href="/diary"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-all duration-150 group">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${isToday ? "bg-amber-500/15" : "bg-violet-500/15"}`}>
                  <BookOpen className={`h-3 w-3 ${isToday ? "text-amber-500" : "text-violet-500"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-foreground truncate group-hover:text-primary transition-colors">{r.title}</p>
                </div>
                <span className={`text-[9px] font-bold shrink-0 ${isToday ? "text-amber-500" : "text-violet-500"}`}>{dayLabel} {time}</span>
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
    <div className={WIDGET_CLS}>
      <div className="flex items-center gap-4 p-4 h-full">
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
    <Link href="/help" className={`${WIDGET_CLS} group`}>
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

// ── Widget: Approvals ──────────────────────────────────────
function ApprovalsWidget({ pendingApprovals, myPendingLeave }: { pendingApprovals: number; myPendingLeave: number }) {
  return (
    <div className={WIDGET_CLS}>
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
          <ClipboardList className="h-3.5 w-3.5 text-amber-500" />Approvals
        </h2>
      </div>
      <div className="px-3 pb-3 flex-1 space-y-1.5">
        <Link href="/manager/approvals"
          className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors group ${
            pendingApprovals > 0 ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20" : "border-border/40 bg-muted/20 hover:bg-muted/40"
          }`}>
          <div className="flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${pendingApprovals > 0 ? "bg-amber-500/20" : "bg-muted"}`}>
              <ClipboardList className={`h-4 w-4 ${pendingApprovals > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground">Team Requests</p>
              <p className="text-[10px] text-muted-foreground">{pendingApprovals > 0 ? `${pendingApprovals} awaiting` : "All caught up"}</p>
            </div>
          </div>
          {pendingApprovals > 0 && <span className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] font-bold text-white">{pendingApprovals}</span>}
        </Link>
        <Link href="/leave"
          className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors group ${
            myPendingLeave > 0 ? "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20" : "border-border/40 bg-muted/20 hover:bg-muted/40"
          }`}>
          <div className="flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${myPendingLeave > 0 ? "bg-blue-500/20" : "bg-muted"}`}>
              <CalendarDays className={`h-4 w-4 ${myPendingLeave > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground">My Leave</p>
              <p className="text-[10px] text-muted-foreground">{myPendingLeave > 0 ? `${myPendingLeave} pending` : "No pending"}</p>
            </div>
          </div>
          {myPendingLeave > 0 && <span className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">{myPendingLeave}</span>}
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
    <div className={WIDGET_CLS}>
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
          <Megaphone className="h-3.5 w-3.5 text-blue-500" />Announcements
        </h2>
        <Link href="/announcements" className="text-[10px] text-primary font-bold hover:underline">Send</Link>
      </div>
      <div className="px-3 pb-3 flex-1 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <Link href="/announcements"
            className="flex items-center gap-2 rounded-lg border border-dashed border-border hover:border-primary/40 bg-muted/10 hover:bg-muted/30 px-3 py-2 transition-colors">
            <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold text-muted-foreground">Send an Announcement</p>
          </Link>
        ) : (
          <>
            {items.map(a => (
              <Link key={a.id} href="/announcements"
                className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/30 px-2.5 py-2 transition-colors">
                <span className="text-sm shrink-0">{CATEGORY_EMOJI[a.category] ?? '📢'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-foreground truncate">{a.subject}</p>
                  <p className="text-[10px] text-muted-foreground">{a.sent_by_name} · {timeAgo(a.sent_at)}</p>
                </div>
              </Link>
            ))}
            <Link href="/announcements"
              className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-border hover:border-primary/40 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors">
              <Plus className="h-3 w-3" /> New
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// ── Widget: IT Support ────────────────────────────────────
const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
  high:     "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  medium:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  low:      "bg-slate-500/15 text-slate-500 dark:text-slate-400",
}

function ITSupportWidget() {
  const supabase = createClient()
  const [stats, setStats] = useState<{ open: number; inProgress: number; latest: any | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await (supabase as any)
        .from('it_tickets')
        .select('id, title, status, priority, created_at')
        .eq('user_id', user.id)
        .in('status', ['open', 'in_progress', 'pending_info'])
        .order('created_at', { ascending: false })
        .limit(10)
      const tickets = data ?? []
      const open = tickets.filter((t: any) => t.status === 'open').length
      const inProgress = tickets.filter((t: any) => t.status !== 'open').length
      setStats({ open, inProgress, latest: tickets[0] ?? null })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className={WIDGET_CLS}>
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
          <Ticket className="h-3.5 w-3.5 text-orange-500" />IT Support
        </h2>
        <Link href="/it" className="text-[10px] font-bold text-primary hover:opacity-75 flex items-center gap-1">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="px-3 pb-3 flex-1 flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <div className="h-4 w-4 rounded-full border-2 border-muted border-t-primary animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg bg-amber-500/10 px-3 py-2 text-center">
                <p className="text-lg font-black text-amber-600 leading-tight">{stats?.open ?? 0}</p>
                <p className="text-[9px] font-semibold text-amber-500">Open</p>
              </div>
              <div className="flex-1 rounded-lg bg-blue-500/10 px-3 py-2 text-center">
                <p className="text-lg font-black text-blue-600 leading-tight">{stats?.inProgress ?? 0}</p>
                <p className="text-[9px] font-semibold text-blue-500">In Progress</p>
              </div>
            </div>
            {stats?.latest ? (
              <Link href={`/it/${stats.latest.id}`}
                className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 px-2.5 py-2 transition-colors group">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-foreground truncate">{stats.latest.title}</p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize shrink-0 ${PRIORITY_BADGE[stats.latest.priority] ?? PRIORITY_BADGE.low}`}>
                  {stats.latest.priority}
                </span>
              </Link>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center py-1">No open tickets</p>
            )}
            <Link href="/it"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 py-2 text-[11px] font-bold text-primary transition-colors">
              <Plus className="h-3 w-3" /> Raise a Ticket
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// ── Widget: Wellness Hub ───────────────────────────────────
const MOOD_EMOJIS = ['😔', '😕', '😐', '🙂', '😄']
const MOOD_LABELS = ['Low', 'Meh', 'Okay', 'Good', 'Great']
const MOOD_COLORS = [
  'bg-rose-500/15 hover:bg-rose-500/25',
  'bg-orange-500/15 hover:bg-orange-500/25',
  'bg-amber-500/15 hover:bg-amber-500/25',
  'bg-lime-500/15 hover:bg-lime-500/25',
  'bg-emerald-500/15 hover:bg-emerald-500/25',
]

function WellnessWidget() {
  const supabase = createClient()
  const [todayMood, setTodayMood] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecked(true); return }
      const today = new Date().toISOString().split('T')[0]
      const { data } = await (supabase as any)
        .from('mood_checkins')
        .select('rating')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()
      if (data) setTodayMood(data.rating)
      setChecked(true)
    }
    load()
  }, [])

  async function handleMood(score: number) {
    if (submitting) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }
    const today = new Date().toISOString().split('T')[0]
    await (supabase as any)
      .from('mood_checkins')
      .upsert({ user_id: user.id, date: today, rating: score }, { onConflict: 'user_id,date' })
    setTodayMood(score)
    setSubmitting(false)
  }

  return (
    <div className={WIDGET_CLS}>
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
          <Heart className="h-3.5 w-3.5 text-rose-500" />Wellness Hub
        </h2>
        <Link href="/wellness" className="text-xs font-semibold text-primary hover:opacity-75 flex items-center gap-1">
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="px-3 pb-3 flex-1 flex flex-col gap-2">
        {/* Mood check-in */}
        <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
          {!checked ? (
            <div className="flex justify-center py-1">
              <div className="h-4 w-4 rounded-full border-2 border-muted border-t-primary animate-spin" />
            </div>
          ) : todayMood !== null ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{MOOD_EMOJIS[todayMood - 1]}</span>
              <p className="text-xs font-bold text-foreground flex-1">{MOOD_LABELS[todayMood - 1]}</p>
              <button onClick={() => setTodayMood(null)} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors">Change</button>
            </div>
          ) : (
            <div className="flex gap-1">
              {MOOD_EMOJIS.map((emoji, i) => (
                <button key={i} onClick={() => handleMood(i + 1)} disabled={submitting} title={MOOD_LABELS[i]}
                  className={`flex-1 rounded-lg py-1.5 text-base transition-all hover:scale-110 active:scale-95 ${MOOD_COLORS[i]} disabled:opacity-50`}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Quick links */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { href: "/wellness/stretches", icon: "🧘", label: "Stretch" },
            { href: "/wellness/breathing", icon: "💨", label: "Breathe" },
            { href: "/wellness/events",    icon: "📅", label: "Events" },
          ].map(link => (
            <Link key={link.href} href={link.href}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 py-2 transition-colors">
              <span className="text-sm">{link.icon}</span>
              <span className="text-[10px] font-semibold text-foreground">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Polls Widget (scrollable stack) ───────────────────────
const BAR_GRAD = ['from-violet-500 to-purple-600','from-blue-500 to-cyan-500','from-emerald-500 to-teal-500','from-orange-500 to-amber-500','from-pink-500 to-rose-500']
const BAR_BG   = ['bg-violet-50 dark:bg-violet-950/20','bg-blue-50 dark:bg-blue-950/20','bg-emerald-50 dark:bg-emerald-950/20','bg-orange-50 dark:bg-orange-950/20','bg-pink-50 dark:bg-pink-950/20']

function PollsWidget() {
  const supabase = createClient()
  const [polls, setPolls] = useState<any[]>([])
  const [myVotes, setMyVotes] = useState<Record<string,number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const now = new Date().toISOString()
      const [{ data: pollsData }, { data: votesData }] = await Promise.all([
        (supabase as any).from('polls').select('id,question,options,deadline,created_by_name,is_archived').gt('deadline', now).eq('is_archived', false).order('created_at', { ascending: false }).limit(10),
        (supabase as any).from('poll_votes').select('poll_id,option_index,user_id'),
      ])
      const voteMap: Record<string,number> = {}
      ;(votesData ?? []).filter((v:any) => v.user_id === user.id).forEach((v:any) => { voteMap[v.poll_id] = v.option_index })
      setMyVotes(voteMap)
      // Attach vote counts
      const enriched = (pollsData ?? []).map((p:any) => ({
        ...p,
        voteCounts: (p.options??[]).map((_:any,i:number) => (votesData??[]).filter((v:any)=>v.poll_id===p.id&&v.option_index===i).length),
        totalVotes: (votesData??[]).filter((v:any)=>v.poll_id===p.id).length,
      }))
      setPolls(enriched)
      setLoading(false)
    }
    load()
  }, [])

  async function handleVote(pollId: string, idx: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await (supabase as any).from('poll_votes').upsert({ poll_id: pollId, user_id: user.id, option_index: idx }, { onConflict: 'poll_id,user_id' })
    setMyVotes(prev => ({ ...prev, [pollId]: idx }))
    setPolls(prev => prev.map(p => {
      if (p.id !== pollId) return p
      const newCounts = [...p.voteCounts]
      const prev_vote = myVotes[pollId]
      if (prev_vote !== undefined) newCounts[prev_vote] = Math.max(0, newCounts[prev_vote]-1)
      newCounts[idx] = (newCounts[idx]||0)+1
      return { ...p, voteCounts: newCounts, totalVotes: newCounts.reduce((a:number,b:number)=>a+b,0) }
    }))
  }

  return (
    <div className={WIDGET_CLS}>
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
          <span className="text-sm">📊</span> Polls
          {polls.length > 0 && <span className="h-4 px-1.5 rounded-full bg-violet-500 text-white text-[9px] font-black flex items-center">{polls.length}</span>}
        </h2>
        <Link href="/polls" className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center pb-5">
          <div className="h-6 w-6 rounded-full border-2 border-muted border-t-violet-500 animate-spin" />
        </div>
      ) : polls.length === 0 ? (
        <div className="flex items-center justify-center gap-3 px-4 py-5">
          <span className="text-lg">🗳️</span>
          <p className="text-xs text-muted-foreground">No active polls</p>
          <Link href="/polls" className="text-[10px] font-bold text-violet-600 hover:underline shrink-0">Create one →</Link>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 max-h-[420px] scrollbar-thin">
          {polls.map((poll, pi) => {
            const myVote = myVotes[poll.id]
            const hasVoted = myVote !== undefined
            const max = Math.max(...(poll.voteCounts??[]),1)
            const deadline = new Date(poll.deadline)
            const diff = deadline.getTime()-Date.now()
            const dLeft = diff>86400000?`${Math.floor(diff/86400000)}d left`:diff>3600000?`${Math.floor(diff/3600000)}h left`:`${Math.floor(diff/60000)}m left`
            return (
              <div key={poll.id} className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <p className="text-xs font-bold text-foreground leading-snug flex-1">{poll.question}</p>
                  <span className="text-[9px] font-bold text-amber-500 shrink-0 bg-amber-50 dark:bg-amber-950/30 rounded-full px-2 py-0.5">{dLeft}</span>
                </div>
                <div className="space-y-1.5">
                  {(poll.options??[]).map((opt:string, i:number) => {
                    const votes = poll.voteCounts?.[i]??0
                    const pct = poll.totalVotes>0?Math.round((votes/poll.totalVotes)*100):0
                    const isMine = myVote===i
                    return (
                      <button key={i} onClick={()=>handleVote(poll.id,i)}
                        className={`w-full text-left rounded-xl relative overflow-hidden transition-all ${BAR_BG[i%BAR_BG.length]} ${isMine?'ring-1 ring-violet-400':''}`}
                      >
                        <div className={`absolute inset-y-0 left-0 bg-gradient-to-r opacity-20 transition-all duration-500 ${BAR_GRAD[i%BAR_GRAD.length]}`} style={{width:`${pct}%`}} />
                        <div className="relative flex items-center justify-between px-3 py-2 gap-2">
                          <span className="text-[11px] font-semibold text-foreground truncate">{opt}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isMine && <span className="text-[8px] font-black text-violet-500">VOTED</span>}
                            <span className={`text-[10px] font-black bg-gradient-to-r bg-clip-text text-transparent ${BAR_GRAD[i%BAR_GRAD.length]}`}>{pct}%</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">{poll.totalVotes} vote{poll.totalVotes!==1?'s':''} · by {poll.created_by_name}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export default function DashboardClient({
  userId, clockedIn, clockInTime, clockInIso, completedWeekHours, weekHours: _weekHours, expectedHoursThisWeek, contractedWeeklyHours,
  scheduledDaysPassed, scheduledDaysTotal,
  leaveBalances, pendingApprovals, myPendingLeave, visitorsToday, notifications,
  isAdmin, isReception, displayName, diaryReminders, leaveRequests,
  preLoggedTomorrow, tomorrowLateReason,
}: DashboardClientProps) {
  const { config, ready, reorder, setSize, remove, restore } = useWidgetConfig()
  const [editMode, setEditMode] = useState(false)
  const [now, setNow] = useState(new Date())
  const [showLateModal, setShowLateModal] = useState(false)
  const [lateReason, setLateReason] = useState("")
  const [lateDay, setLateDay] = useState<'today' | 'tomorrow'>('today')
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
      const result = await logRunningLate(userId, lateReason.trim() || undefined, undefined, undefined, lateDay)
      if (!result.success) { toast.error(result.error ?? "Failed to log"); return }
      setShowLateModal(false)
      setLateReason("")
      setLateDay('today')
      toast.success(lateDay === 'tomorrow' ? "Pre-logged for tomorrow — team has been notified!" : "Running late logged — see you when you get here!")
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

  // Live weather from Open-Meteo (W5 1UA — lat 51.509, lon -0.198)
  type WeatherType = "clear" | "clear_night" | "partly_cloudy" | "partly_cloudy_night" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunderstorm"
  const [weather, setWeather] = useState<{ temp: number; high: number; low: number; type: WeatherType; icon: string; label: string } | null>(null)

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=51.509&longitude=-0.198&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=Europe/London&forecast_days=1")
        const data = await res.json()
        const code: number = data.current?.weather_code ?? 0
        const isDay: boolean = data.current?.is_day === 1
        const temp = Math.round(data.current?.temperature_2m ?? 0)
        const high = Math.round(data.daily?.temperature_2m_max?.[0] ?? temp)
        const low = Math.round(data.daily?.temperature_2m_min?.[0] ?? temp)
        let type: WeatherType = isDay ? "clear" : "clear_night"
        let icon = isDay ? "☀️" : "🌙"
        let label = isDay ? "Sunny" : "Clear Night"
        if (code === 0) { type = isDay ? "clear" : "clear_night"; icon = isDay ? "☀️" : "🌙"; label = isDay ? "Sunny" : "Clear Night" }
        else if (code <= 2) { type = isDay ? "partly_cloudy" : "partly_cloudy_night"; icon = isDay ? "⛅" : "☁️"; label = isDay ? "Partly Cloudy" : "Partly Cloudy" }
        else if (code === 3) { type = "cloudy"; icon = "☁️"; label = "Overcast" }
        else if (code <= 48) { type = "fog"; icon = "🌫️"; label = "Foggy" }
        else if (code <= 57) { type = "drizzle"; icon = "🌦️"; label = "Drizzle" }
        else if (code <= 67) { type = "rain"; icon = "🌧️"; label = "Rain" }
        else if (code <= 77) { type = "snow"; icon = "🌨️"; label = "Snow" }
        else if (code <= 82) { type = "rain"; icon = "🌧️"; label = "Showers" }
        else if (code >= 95) { type = "thunderstorm"; icon = "⛈️"; label = "Thunderstorm" }
        setWeather({ temp, high, low, type, icon, label })
      } catch { /* silent fail — weather is decorative */ }
    }
    fetchWeather()
    const interval = setInterval(fetchWeather, 600_000)
    return () => clearInterval(interval)
  }, [])

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
      case "approvals":
        return <ApprovalsWidget pendingApprovals={pendingApprovals} myPendingLeave={myPendingLeave} />
      case "announcements":
        return <AnnouncementsWidget />
      case "polls":
        return <PollsWidget />
      case "it-support":
        return <ITSupportWidget />
      case "wellness":
        return <WellnessWidget />
    }
  }

  return (
    <div className="px-1.5 py-2 sm:p-2 md:p-3 space-y-2 max-w-screen-2xl mx-auto">

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl widget-appear transition-all duration-1000 ${
        weather?.type === "clear" ? "bg-gradient-to-br from-[#4a90d9] via-[#5ba0e8] to-[#87ceeb]" :
        weather?.type === "clear_night" ? "bg-gradient-to-br from-[#0a1628] via-[#0f1f3a] to-[#1a2d4d]" :
        weather?.type === "partly_cloudy" ? "bg-gradient-to-br from-[#5a7fa8] via-[#6d8db5] to-[#8aacc4]" :
        weather?.type === "partly_cloudy_night" ? "bg-gradient-to-br from-[#111d30] via-[#1a2840] to-[#243350]" :
        weather?.type === "cloudy" ? "bg-gradient-to-br from-[#5c6a7a] via-[#6b7a8c] to-[#7d8e9e]" :
        weather?.type === "rain" || weather?.type === "drizzle" ? "bg-gradient-to-br from-[#3a4a5c] via-[#4a5a6e] to-[#5a6a7c]" :
        weather?.type === "thunderstorm" ? "bg-gradient-to-br from-[#1a2030] via-[#2a3040] to-[#3a4050]" :
        weather?.type === "snow" ? "bg-gradient-to-br from-[#7a8a9a] via-[#8a9aaa] to-[#9aabb8]" :
        weather?.type === "fog" ? "bg-gradient-to-br from-[#6a7580] via-[#7a8590] to-[#8a95a0]" :
        "bg-gradient-to-br from-slate-900 via-[#0d2a4e] to-[#0a1e3a]"
      }`}>
        {/* Decorative orbs — adapt to weather */}
        {weather?.type === "clear" ? (
          <>
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-yellow-200/40 blur-3xl" style={{ animation: 'weatherSunPulse 4s ease-in-out infinite' }} />
            <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" style={{ animation: 'weatherSunPulse 4s ease-in-out infinite 1s' }} />
          </>
        ) : weather?.type === "clear_night" || weather?.type === "partly_cloudy_night" ? (
          <>
            <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-blue-400/8 blur-3xl" />
            <div className="pointer-events-none absolute top-3 right-20 h-2 w-2 rounded-full bg-white/20" style={{ animation: 'weatherSunPulse 3s ease-in-out infinite' }} />
            <div className="pointer-events-none absolute top-8 right-40 h-1.5 w-1.5 rounded-full bg-white/15" style={{ animation: 'weatherSunPulse 4s ease-in-out infinite 1s' }} />
            <div className="pointer-events-none absolute top-5 right-60 h-1 w-1 rounded-full bg-white/20" style={{ animation: 'weatherSunPulse 3.5s ease-in-out infinite 0.5s' }} />
            <div className="pointer-events-none absolute top-12 right-32 h-1 w-1 rounded-full bg-white/10" style={{ animation: 'weatherSunPulse 5s ease-in-out infinite 2s' }} />
            <div className="pointer-events-none absolute top-6 left-[30%] h-1.5 w-1.5 rounded-full bg-white/12" style={{ animation: 'weatherSunPulse 4s ease-in-out infinite 1.5s' }} />
            <div className="pointer-events-none absolute top-10 left-[45%] h-1 w-1 rounded-full bg-white/15" style={{ animation: 'weatherSunPulse 3s ease-in-out infinite 0.8s' }} />
            <div className="pointer-events-none absolute top-4 left-[60%] h-1.5 w-1.5 rounded-full bg-white/10" style={{ animation: 'weatherSunPulse 4.5s ease-in-out infinite 2.5s' }} />
            {/* Moon glow */}
            <div className="pointer-events-none absolute -top-8 right-16 h-24 w-24 rounded-full bg-blue-200/5 blur-2xl" />
          </>
        ) : (
          <>
            <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
          </>
        )}

        <div className="relative flex items-start justify-between gap-3 p-4 md:p-6">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] sm:text-sm font-medium text-white/40 tracking-widest uppercase">
                {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </p>
              <button
                onClick={() => setEditMode(v => !v)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold transition-all ${
                  editMode
                    ? "bg-emerald-500/80 border-emerald-400/50 text-white"
                    : "border-white/20 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white"
                }`}
              >
                {editMode ? <><Check className="h-2.5 w-2.5" /> Done</> : <><LayoutGrid className="h-2.5 w-2.5" /> Customise</>}
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {greeting}, {firstName} <CssMascot type="waver" />
            </h1>
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${clockedIn ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
              <span className="text-xs text-white/50 font-medium">
                {clockedIn ? `In since ${clockInTime}` : "Not clocked in"}
              </span>
            </div>
          </div>

          {/* Live clock + weather */}
          <div className="shrink-0 text-right">
            <p className="text-3xl sm:text-5xl md:text-6xl font-black text-white tabular-nums tracking-tight font-mono leading-none">
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-[9px] sm:text-xs text-white/30 mt-0.5 font-medium tracking-widest">
              {now.toLocaleTimeString("en-GB", { second: "2-digit" })}s
            </p>
            {weather && (
              <div className="flex items-center justify-end gap-1.5 mt-1.5">
                <span className="text-base sm:text-lg">{weather.icon}</span>
                <span className="text-lg sm:text-2xl font-extralight text-white/90 tabular-nums leading-none">{weather.temp}°</span>
                <span className="text-[9px] sm:text-[10px] text-white/50 font-medium">{weather.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative grid grid-cols-4 border-t border-white/5">
          <div className="px-3 sm:px-5 py-2.5 sm:py-3.5 border-r border-white/5">
            <p className="text-[8px] sm:text-[10px] font-bold text-white/30 uppercase tracking-widest mb-0.5 flex items-center gap-1">
              Office {clockedIn && <CssMascot type="walker" className="text-white/40" />}
            </p>
            <p className="text-base sm:text-xl font-extrabold text-white leading-tight">
              {clockedIn ? (() => { const m = Math.max(0, Math.floor((now.getTime() - new Date(clockInIso!).getTime()) / 60000)); const h = Math.floor(m / 60); const min = m % 60; return h === 0 ? `${min}m` : `${h}h${min}m` })() : "—"}
            </p>
            <p className="text-[9px] sm:text-[11px] text-white/40 mt-0.5 hidden sm:block">{clockedIn ? `Since ${clockInTime}` : "Not in"}</p>
          </div>
          <div className="px-3 sm:px-5 py-2.5 sm:py-3.5 border-r border-white/5">
            <p className="text-[8px] sm:text-[10px] font-bold text-white/30 uppercase tracking-widest mb-0.5">Leave</p>
            <p className="text-base sm:text-xl font-extrabold text-white leading-tight">{annualRemaining}d</p>
            <p className="text-[9px] sm:text-[11px] text-white/40 mt-0.5 hidden sm:block">of {annualEffectiveTotal}d</p>
          </div>
          <div className="px-3 sm:px-5 py-2.5 sm:py-3.5 border-r border-white/5">
            <p className="text-[8px] sm:text-[10px] font-bold text-white/30 uppercase tracking-widest mb-0.5">Week</p>
            <p className="text-base sm:text-xl font-extrabold text-white leading-tight">
              {weekHours.toFixed(1)}<span className="text-[9px] sm:text-sm font-medium text-white/40">h</span>
            </p>
            <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${weekHours >= (contractedWeeklyHours > 0 ? contractedWeeklyHours : 40) ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${Math.min(100, contractedWeeklyHours > 0 ? (weekHours / contractedWeeklyHours) * 100 : 0)}%` }}
              />
            </div>
          </div>
          <div className="px-3 sm:px-5 py-2.5 sm:py-3.5">
            <p className="text-[8px] sm:text-[10px] font-bold text-white/30 uppercase tracking-widest mb-0.5">Visitors</p>
            <p className="text-base sm:text-xl font-extrabold text-white leading-tight">{visitorsToday}</p>
            <p className="text-[9px] sm:text-[11px] text-white/40 mt-0.5 hidden sm:block">today</p>
          </div>
        </div>

        {/* Live weather overlay — full banner */}
        {weather && (
          <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
            {/* Rain — thick visible streaks like Apple */}
            {weather.type === "rain" && Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="absolute bg-gradient-to-b from-transparent via-white/20 to-white/40 rounded-full"
                style={{ left: `${2 + i * 3.3}%`, top: '-20%', width: '1.5px', height: '35%', animation: `weatherRain ${0.5 + (i % 5) * 0.08}s linear infinite ${(i % 7) * 0.1}s` }} />
            ))}
            {/* Drizzle — lighter, fewer */}
            {weather.type === "drizzle" && Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="absolute bg-gradient-to-b from-transparent to-white/25 rounded-full"
                style={{ left: `${5 + i * 7}%`, top: '-10%', width: '1px', height: '18%', animation: `weatherRain ${0.8 + (i % 4) * 0.1}s linear infinite ${(i % 5) * 0.15}s` }} />
            ))}
            {/* Snow — fluffy dots drifting */}
            {weather.type === "snow" && Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="absolute rounded-full bg-white"
                style={{ left: `${3 + i * 5}%`, top: '-5%', width: `${2 + (i % 3)}px`, height: `${2 + (i % 3)}px`, opacity: 0.3 + (i % 3) * 0.1, animation: `weatherSnow ${3 + (i % 4)}s linear infinite ${(i % 6) * 0.5}s` }} />
            ))}
            {/* Clouds drifting — bigger, more visible */}
            {(weather.type === "cloudy" || weather.type === "partly_cloudy") && Array.from({ length: 4 }).map((_, i) => (
              <svg key={i} viewBox="0 0 80 32" fill="none"
                className="absolute"
                style={{ top: `${5 + i * 18}%`, width: `${80 + i * 30}px`, animation: `weatherCloudDrift ${12 + i * 4}s linear infinite ${i * 3}s`, opacity: 0.12 + i * 0.06 }}>
                <ellipse cx="40" cy="20" rx="36" ry="12" fill="white" />
                <ellipse cx="26" cy="14" rx="20" ry="12" fill="white" />
                <ellipse cx="52" cy="16" rx="18" ry="11" fill="white" />
              </svg>
            ))}
            {/* Fog — thicker bands */}
            {weather.type === "fog" && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="absolute w-full bg-white/8 rounded-full"
                style={{ top: `${20 + i * 14}%`, height: '3px', animation: `weatherFogDrift ${7 + i * 2}s ease-in-out infinite alternate ${i * 1.5}s` }} />
            ))}
            {/* Thunderstorm — heavy rain + lightning */}
            {weather.type === "thunderstorm" && (
              <>
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="absolute bg-gradient-to-b from-transparent via-blue-200/30 to-blue-300/50 rounded-full"
                    style={{ left: `${1 + i * 2.9}%`, top: '-20%', width: '1.5px', height: '40%', animation: `weatherRain ${0.4 + (i % 4) * 0.06}s linear infinite ${(i % 6) * 0.08}s` }} />
                ))}
                <div className="absolute inset-0" style={{ animation: 'weatherLightning 6s ease-in-out infinite' }}>
                  <div className="w-full h-full bg-white/8" />
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* Animations */}
      <style>{`
        @keyframes jiggle {
          0%,100% { transform: rotate(0deg) }
          25%     { transform: rotate(-0.35deg) }
          75%     { transform: rotate(0.35deg) }
        }
        .animate-jiggle { animation: jiggle 0.6s ease-in-out infinite; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .widget-appear {
          animation: fadeSlideUp 0.45s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes mascotWalk {
          0%,100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(2px) rotate(-3deg); }
          50% { transform: translateX(4px) rotate(0deg); }
          75% { transform: translateX(2px) rotate(3deg); }
        }
        @keyframes mascotWave {
          0%,100% { transform: rotate(0deg); }
          25% { transform: rotate(20deg); }
          50% { transform: rotate(-5deg); }
          75% { transform: rotate(20deg); }
        }
        @keyframes mascotBounce {
          0%,100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.05); }
        }
        @keyframes mascotFloat {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          33% { transform: translate(3px,-3px) rotate(5deg); }
          66% { transform: translate(-2px,-5px) rotate(-3deg); }
        }
        @keyframes weatherRain {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(600%); }
        }
        @keyframes weatherSnow {
          0%   { transform: translateY(-100%) translateX(0); }
          50%  { transform: translateY(300%) translateX(15px); }
          100% { transform: translateY(600%) translateX(-5px); }
        }
        @keyframes weatherSunPulse {
          0%,100% { transform: scale(1); opacity: 0.6; }
          50%     { transform: scale(1.15); opacity: 1; }
        }
        @keyframes weatherCloudDrift {
          0%   { transform: translateX(-100px); }
          100% { transform: translateX(calc(100vw + 100px)); }
        }
        @keyframes weatherFogDrift {
          0%   { transform: translateX(-5%) scaleY(1); opacity: 0.08; }
          100% { transform: translateX(5%) scaleY(2); opacity: 0.15; }
        }
        @keyframes weatherLightning {
          0%,92%,96%,100% { opacity: 0; }
          93%,95% { opacity: 1; }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Pre-logged tomorrow banner */}
      {preLoggedTomorrow && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-5 py-3">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            You&apos;ve pre-logged running late for tomorrow
            {tomorrowLateReason ? ` — ${tomorrowLateReason}` : ""}.
            Management has been notified.
          </p>
        </div>
      )}

      {/* ── Quick Actions Bar ──────────────────────────────── */}
      <QuickActionsWidget
        clockedIn={clockedIn} isAdmin={isAdmin} isReception={isReception}
        onRunningLate={() => setShowLateModal(true)}
        showLateModal={showLateModal} setShowLateModal={setShowLateModal}
        lateReason={lateReason} setLateReason={setLateReason}
        lateDay={lateDay} setLateDay={setLateDay}
        isLatePending={isLatePending} handleRunningLateSubmit={handleRunningLateSubmit}
      />

      {/* ── Leave Balances Bar ─────────────────────────────── */}
      <LeaveBalancesBar
        leaveBalances={leaveBalances}
        pendingApprovals={pendingApprovals}
        myPendingLeave={myPendingLeave}
      />

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {visibleWidgets.map((widget, wi) => (
              <SortableWidget
                key={widget.id}
                id={widget.id}
                size={widget.size}
                editMode={editMode}
                onRemove={() => remove(widget.id)}
                onResize={(s) => setSize(widget.id, s)}
                index={wi}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
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
