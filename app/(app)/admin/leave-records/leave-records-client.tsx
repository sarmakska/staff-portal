"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { FileDown, CalendarDays, Search, Mail, Loader2 } from "lucide-react"
import { resendLeaveApprovalEmail } from "@/lib/actions/approvals"
import { toast } from "sonner"

interface Request {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  days_count: number
  day_type: string
  status: string
  reviewed_at: string | null
  created_at: string
  employee: { full_name: string; display_name: string | null; email: string } | null
  approver: { full_name: string; display_name: string | null } | null
}

interface Props {
  requests: Request[]
}

const TYPE_COLORS: Record<string, string> = {
  annual:       "bg-[#7C6F5E]/10 text-[#7C6F5E] border-[#7C6F5E]/20",
  sick:         "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  personal:     "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  compassionate:"bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  maternity:    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
  unpaid:       "bg-muted text-muted-foreground border-border",
}

const TYPE_DOT: Record<string, string> = {
  annual:       "bg-[#7C6F5E]",
  sick:         "bg-red-500",
  personal:     "bg-blue-500",
  compassionate:"bg-green-500",
  maternity:    "bg-purple-500",
  unpaid:       "bg-muted-foreground",
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

export function LeaveRecordsClient({ requests }: Props) {
  const [search, setSearch] = useState("")
  const [resending, setResending] = useState<string | null>(null)

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  const fmtShort = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

  async function handleResend(id: string) {
    setResending(id)
    try {
      const result = await resendLeaveApprovalEmail(id)
      if (result.success) toast.success("Approval email resent")
      else toast.error(result.error ?? "Failed to resend email")
    } finally {
      setResending(null)
    }
  }

  const filtered = search.trim()
    ? requests.filter((r) => {
        const name = r.employee?.display_name || r.employee?.full_name || ""
        const email = r.employee?.email || ""
        const q = search.toLowerCase()
        return name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || r.leave_type.includes(q)
      })
    : requests

  // Stats
  const totalDays = filtered.reduce((s, r) => s + Number(r.days_count), 0)
  const uniqueEmployees = new Set(filtered.map(r => r.employee?.email)).size
  const byType = filtered.reduce<Record<string, number>>((acc, r) => {
    acc[r.leave_type] = (acc[r.leave_type] ?? 0) + 1
    return acc
  }, {})

  const handleDownload = (id: string) => {
    window.open(`/api/leave-pdf/${id}`, "_blank")
  }

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave Records</h1>
          <p className="text-sm text-muted-foreground">Approved leave forms for payroll and records</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{filtered.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total Days</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{totalDays}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Employees</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{uniqueEmployees}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1.5">By Type</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(byType).map(([type, count]) => (
              <span key={type} className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[type] ?? "bg-muted-foreground"}`} />
                <span className="capitalize">{type}</span>
                <span className="text-foreground font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7 text-muted-foreground" />}
          title="No approved leave records"
          description="Approved leave requests will appear here."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Employee</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Period</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Days</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Approved by</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
          </div>

          <div className="divide-y divide-border/60">
            {filtered.map((req) => {
              const empName = req.employee?.display_name || req.employee?.full_name || "—"
              const empEmail = req.employee?.email ?? ""
              const approverName = req.approver?.display_name || req.approver?.full_name || "—"
              const dateRange = req.start_date === req.end_date
                ? fmtShort(req.start_date)
                : `${fmtShort(req.start_date)} – ${fmtShort(req.end_date)}`

              return (
                <div
                  key={req.id}
                  className="group px-5 py-3.5 hover:bg-muted/30 transition-colors"
                >
                  {/* Mobile layout */}
                  <div className="flex items-start justify-between gap-3 md:hidden">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{empName}</span>
                        <Badge className={`text-[10px] capitalize border rounded-md px-2 py-0.5 font-medium ${TYPE_COLORS[req.leave_type] ?? "bg-muted text-muted-foreground border-border"}`}>
                          {req.leave_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{dateRange} · {req.days_count} {Number(req.days_count) === 1 ? "day" : "days"}</p>
                      <p className="text-xs text-muted-foreground">Approved by <span className="font-medium text-foreground">{approverName}</span>{req.reviewed_at && ` · ${fmt(req.reviewed_at)}`}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl shrink-0" onClick={() => handleDownload(req.id)}>
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl shrink-0" onClick={() => handleResend(req.id)} disabled={resending === req.id}>
                        {resending === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_auto] gap-4 items-center">
                    {/* Employee */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-brand-taupe/10 text-brand-taupe flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(empName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{empName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{empEmail}</p>
                      </div>
                    </div>

                    {/* Type */}
                    <div>
                      <Badge className={`text-[10px] capitalize border rounded-md px-2 py-0.5 font-medium ${TYPE_COLORS[req.leave_type] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {req.leave_type}
                      </Badge>
                    </div>

                    {/* Period */}
                    <p className="text-xs text-muted-foreground">{dateRange}</p>

                    {/* Days */}
                    <p className="text-sm font-semibold text-foreground">{req.days_count} <span className="text-xs font-normal text-muted-foreground">{Number(req.days_count) === 1 ? "day" : "days"}</span></p>

                    {/* Approved by */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{approverName}</p>
                      {req.reviewed_at && <p className="text-[11px] text-muted-foreground">{fmt(req.reviewed_at)}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs" onClick={() => handleDownload(req.id)}>
                        <FileDown className="h-3.5 w-3.5" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs" onClick={() => handleResend(req.id)} disabled={resending === req.id}>
                        {resending === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                        Resend
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
