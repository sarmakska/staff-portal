"use client"

import { useState, useTransition } from "react"
import {
  Bell, BellOff, CheckCircle, XCircle, Loader2, Mail, Send, Zap,
  CalendarDays, Clock, Users, ClipboardEdit, Receipt, Megaphone,
} from "lucide-react"
import { updateNotificationSetting } from "@/lib/actions/app-settings"
import { EMAIL_NOTIFICATION_META, EMAIL_NOTIFICATION_KEYS, NOTIFICATION_FROM_EMAIL } from "@/lib/notification-settings"
import type { EmailNotificationKey } from "@/lib/notification-settings"

interface NotificationsClientProps {
  settings: Record<string, boolean>
  envEmails: { wfhNotify: string; accountsNotify: string; receptionNotify: string }
}

const GROUP_META: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  Leave:       { icon: CalendarDays,   color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",   border: "border-blue-200 dark:border-blue-800" },
  Attendance:  { icon: Clock,          color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800" },
  People:      { icon: Users,          color: "text-rose-600 dark:text-rose-400",   bg: "bg-rose-50 dark:bg-rose-950/40",   border: "border-rose-200 dark:border-rose-800" },
  Corrections: { icon: ClipboardEdit,  color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-200 dark:border-violet-800" },
  Expenses:      { icon: Receipt,    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40",  border: "border-emerald-200 dark:border-emerald-800" },
  Announcements: { icon: Megaphone,  color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-950/40",        border: "border-blue-200 dark:border-blue-800" },
}

// Render recipient — email addresses get a monospace chip, plain text stays normal
function RecipientDisplay({ value }: { value: string }) {
  // Split on " + " to handle multiple recipients
  const parts = value.split(" + ")
  return (
    <span className="flex flex-wrap gap-1 items-center">
      {parts.map((part, i) => {
        const isEmail = part.includes("@")
        return (
          <span key={i} className="flex items-center gap-1">
            {isEmail
              ? <span className="font-mono text-[11px] bg-muted/60 border border-border/60 rounded px-1.5 py-0.5 text-foreground/80">{part}</span>
              : <span className="text-[11px] text-muted-foreground">{part}</span>
            }
            {i < parts.length - 1 && <span className="text-muted-foreground/50 text-[10px]">+</span>}
          </span>
        )
      })}
    </span>
  )
}

export default function NotificationsClient({ settings: initial, envEmails }: NotificationsClientProps) {
  const [settings, setSettings] = useState<Record<string, boolean>>(initial)
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ key: string; ok: boolean } | null>(null)

  async function toggle(key: string) {
    const newVal = !settings[key]
    setSaving(key)
    setSettings(prev => ({ ...prev, [key]: newVal }))
    startTransition(async () => {
      const result = await updateNotificationSetting(key, newVal)
      setSaving(null)
      if (!result.success) {
        setSettings(prev => ({ ...prev, [key]: !newVal }))
        setFlash({ key, ok: false })
      } else {
        setFlash({ key, ok: true })
      }
      setTimeout(() => setFlash(null), 2000)
    })
  }

  function resolveRecipient(key: EmailNotificationKey): string {
    if (key === "email_wfh" || key === "email_early_clockout" || key === "email_running_late") {
      return envEmails.wfhNotify
    }
    if (key === "email_forgotten_clockout") return `Employee + ${envEmails.receptionNotify}`
    if (key === "email_leave_approved") return `Employee + ${envEmails.accountsNotify}`
    if (key === "email_correction_submitted") return envEmails.receptionNotify
    return EMAIL_NOTIFICATION_META[key].recipient
  }

  // Group by category preserving order
  const groups: Record<string, EmailNotificationKey[]> = {}
  for (const key of EMAIL_NOTIFICATION_KEYS) {
    const group = EMAIL_NOTIFICATION_META[key].group
    if (!groups[group]) groups[group] = []
    groups[group].push(key)
  }

  const enabledCount = Object.values(settings).filter(Boolean).length
  const totalCount = EMAIL_NOTIFICATION_KEYS.length

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which automated emails StaffPortal sends.
        </p>
      </div>

      {/* Stats + from-email bar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">
            {enabledCount} <span className="text-sm font-normal text-muted-foreground">/ {totalCount}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-2.5">
          <Send className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Sending from</p>
            <p className="text-xs font-mono font-medium text-foreground mt-0.5 truncate">{NOTIFICATION_FROM_EMAIL}</p>
          </div>
        </div>
      </div>

      {/* Groups */}
      {Object.entries(groups).map(([group, keys]) => {
        const gMeta = GROUP_META[group] ?? { icon: Bell, color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border" }
        const GroupIcon = gMeta.icon
        const groupEnabled = keys.filter(k => settings[k] ?? true).length

        return (
          <div key={group} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

            {/* Group header */}
            <div className={`px-5 py-3 border-b border-border/50 flex items-center justify-between ${gMeta.bg}`}>
              <div className="flex items-center gap-2">
                <GroupIcon className={`h-4 w-4 ${gMeta.color}`} />
                <p className={`text-sm font-semibold ${gMeta.color}`}>{group}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {groupEnabled}/{keys.length} on
              </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-border/40">
              {keys.map(key => {
                const meta = EMAIL_NOTIFICATION_META[key]
                const enabled = settings[key] ?? true
                const isSaving = saving === key
                const flashState = flash?.key === key ? flash : null
                const recipient = resolveRecipient(key)

                return (
                  <div key={key} className={`px-5 py-4 space-y-3 transition-colors ${!enabled ? "bg-muted/10" : ""}`}>

                    {/* Title row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition-colors border ${
                          enabled
                            ? `${gMeta.bg} ${gMeta.border}`
                            : "bg-muted/30 border-border"
                        }`}>
                          {enabled
                            ? <Bell className={`h-4 w-4 ${gMeta.color}`} />
                            : <BellOff className="h-4 w-4 text-muted-foreground" />
                          }
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-semibold leading-tight ${enabled ? "text-foreground" : "text-muted-foreground line-through decoration-muted-foreground/40"}`}>
                              {meta.label}
                            </p>
                            {flashState && (
                              <span className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-0.5 ${
                                flashState.ok ? "text-emerald-500" : "text-rose-500"
                              }`}>
                                {flashState.ok
                                  ? <><CheckCircle className="h-3 w-3" />Saved</>
                                  : <><XCircle className="h-3 w-3" />Failed</>
                                }
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{meta.description}</p>
                          <p className="text-xs text-muted-foreground/80 mt-1.5 leading-relaxed border-l-2 border-border pl-2">{meta.detail}</p>
                        </div>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => toggle(key)}
                        disabled={isSaving}
                        className={`relative shrink-0 h-6 w-11 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          enabled ? "bg-primary" : "bg-muted-foreground/30"
                        } ${isSaving ? "opacity-70 cursor-wait" : "cursor-pointer"}`}
                        aria-checked={enabled}
                        role="switch"
                      >
                        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 flex items-center justify-center ${
                          enabled ? "translate-x-5" : "translate-x-0"
                        }`}>
                          {isSaving && <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />}
                        </span>
                      </button>
                    </div>

                    {/* Detail rows */}
                    <div className="ml-11 space-y-1.5 pt-0.5">
                      <div className="flex items-start gap-2 text-xs">
                        <Mail className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/60" />
                        <span className="font-medium text-muted-foreground shrink-0 w-12">To:</span>
                        <RecipientDisplay value={recipient} />
                      </div>
                      <div className="flex items-start gap-2 text-xs">
                        <span className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/60 text-[10px] font-bold flex items-center justify-center">Re:</span>
                        <span className="font-medium text-muted-foreground shrink-0 w-12">Subject:</span>
                        <span className="font-mono text-[11px] text-muted-foreground leading-relaxed break-all">{meta.subject}</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs">
                        <Zap className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/60" />
                        <span className="font-medium text-muted-foreground shrink-0 w-12">Trigger:</span>
                        <span className="text-muted-foreground leading-relaxed">{meta.trigger}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
