"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/lib/providers"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { CheckCircle, XCircle, FileEdit, Clock, ArrowRight, Calendar, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { submitCorrection, reviewCorrection, directCorrection, getTeamCorrections, getStaffAttendance } from "@/lib/actions/corrections"
import { getCurrentUser } from "@/lib/actions/auth"

type AttendanceRecord = {
  id: string
  work_date: string
  clock_in: string | null
  clock_out: string | null
  break_start: string | null
  break_end: string | null
  total_hours: number | null
  status: string | null
}

type Correction = {
  id: string
  field: string
  attendance: { work_date: string } | null
  original_value: string | null
  proposed_value: string
  reason: string
  status: string
  created_at: string
  user?: { full_name: string; email: string } | null
}

const FIELD_LABELS: Record<string, string> = {
  clock_in: "Clock In",
  clock_out: "Clock Out",
  break_start: "Break Start",
  break_end: "Break End",
}

function fmtTime(ts: string | null) {
  if (!ts) return "—"
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  })
}

function DayStamp({ date }: { date: string }) {
  const d = new Date(date + "T12:00:00")
  return (
    <div className="w-11 shrink-0 text-center">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
        {d.toLocaleDateString("en-GB", { weekday: "short" })}
      </p>
      <p className="text-xl font-bold text-foreground leading-tight">
        {d.toLocaleDateString("en-GB", { day: "numeric" })}
      </p>
      <p className="text-[10px] text-muted-foreground leading-none">
        {d.toLocaleDateString("en-GB", { month: "short" })}
      </p>
    </div>
  )
}

export default function CorrectionsPage() {
  const { isAdmin, isReception } = useAuth()
  const [loading, setLoading] = useState(true)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [teamCorrections, setTeamCorrections] = useState<Correction[]>([])

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [corrField, setCorrField] = useState<"clock_in" | "clock_out" | "break_start" | "break_end">("clock_in")
  const [corrValue, setCorrValue] = useState("")
  const [corrReason, setCorrReason] = useState("")

  const [showApprovalModal, setShowApprovalModal] = useState<{ id: string; action: "approve" | "reject" } | null>(null)
  const [comment, setComment] = useState("")
  const [isPending, startTransition] = useTransition()

  // Direct fix state (admin/reception)
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([])
  const [directUserId, setDirectUserId] = useState("")
  const [directRecords, setDirectRecords] = useState<AttendanceRecord[]>([])
  const [directTarget, setDirectTarget] = useState<AttendanceRecord | null>(null)
  const [directField, setDirectField] = useState<"clock_in" | "clock_out" | "break_start" | "break_end">("clock_in")
  const [directValue, setDirectValue] = useState("")
  const [directReason, setDirectReason] = useState("")

  const supabase = createClient()

  async function loadData() {
    const _authCtx = await getCurrentUser()
    const user = _authCtx!
    const { isAdmin, isReception } = _authCtx!
    if (!user) { setLoading(false); return }

    const since = new Date()
    since.setDate(since.getDate() - 30)
    const sinceStr = since.toISOString().split("T")[0]

    const [{ data: att }, { data: mine }] = await Promise.all([
      supabase
        .from("attendance")
        .select("id, work_date, clock_in, clock_out, break_start, break_end, total_hours, status")
        .eq("user_id", user.id)
        .gte("work_date", sinceStr)
        .order("work_date", { ascending: false })
        .limit(30),
      supabase
        .from("attendance_corrections")
        .select("*, attendance(work_date)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ])

    setAttendanceRecords(att ?? [])
    setCorrections((mine ?? []) as any)

    if (isAdmin || isReception) {
      const [{ data: team }, { data: staff }] = await Promise.all([
        getTeamCorrections(),
        supabase.from("user_profiles").select("id, full_name").eq("is_active", true).order("full_name", { ascending: true }),
      ])
      setTeamCorrections((team ?? []) as any)
      setStaffList((staff ?? []) as any)
    }

    setLoading(false)
  }

  async function loadDirectRecords(userId: string) {
    if (!userId) { setDirectRecords([]); return }
    const { data } = await getStaffAttendance(userId)
    setDirectRecords((data ?? []) as AttendanceRecord[])
  }

  useEffect(() => { loadData() }, [isAdmin, isReception])

  function originalForField(rec: AttendanceRecord, field: string) {
    const raw = rec[field as keyof AttendanceRecord] as string | null
    if (!raw) return ""
    return new Date(raw).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  }

  function openModal(rec: AttendanceRecord) {
    setSelectedRecord(rec)
    setCorrField("clock_in")
    setCorrValue(originalForField(rec, "clock_in"))
    setCorrReason("")
  }

  function handleFieldChange(f: "clock_in" | "clock_out" | "break_start" | "break_end") {
    setCorrField(f)
    if (selectedRecord) setCorrValue(originalForField(selectedRecord, f))
  }

  function handleSubmit() {
    if (!selectedRecord || !corrValue || !corrReason.trim()) {
      toast.error("Please fill in all fields")
      return
    }
    startTransition(async () => {
      // Convert "HH:MM" time input to full ISO timestamp using the record's date.
      // Done on the client so the browser's local timezone is applied correctly.
      const [hours, minutes] = corrValue.split(":").map(Number)
      const dt = new Date(selectedRecord.work_date + "T00:00:00")
      dt.setHours(hours, minutes, 0, 0)
      const proposedISO = dt.toISOString()

      const result = await submitCorrection({
        workDate: selectedRecord.work_date,
        field: corrField,
        proposedValue: proposedISO,
        reason: corrReason,
      })
      if (result.success) {
        toast.success("Correction request submitted!")
        setSelectedRecord(null)
        await loadData()
      } else {
        toast.error(result.error ?? "Failed to submit")
      }
    })
  }

  function handleReview() {
    if (!showApprovalModal) return
    if (showApprovalModal.action === "reject" && !comment.trim()) {
      toast.error("Comment required for rejection")
      return
    }
    startTransition(async () => {
      const result = await reviewCorrection({
        correctionId: showApprovalModal.id,
        action: showApprovalModal.action,
        comment,
      })
      if (result.success) {
        toast.success(`Correction ${showApprovalModal.action === "approve" ? "approved" : "rejected"}!`)
        setShowApprovalModal(null)
        setComment("")
        await loadData()
      } else {
        toast.error(result.error ?? "Failed")
      }
    })
  }

  function openDirectModal(rec: AttendanceRecord) {
    setDirectTarget(rec)
    setDirectField("clock_in")
    setDirectValue(originalForField(rec, "clock_in"))
    setDirectReason("")
  }

  function handleDirectFieldChange(f: "clock_in" | "clock_out" | "break_start" | "break_end") {
    setDirectField(f)
    if (directTarget) setDirectValue(originalForField(directTarget, f))
  }

  function handleDirectSubmit() {
    if (!directTarget || !directValue || !directReason.trim()) {
      toast.error("Please fill in all fields")
      return
    }
    startTransition(async () => {
      const [hours, minutes] = directValue.split(":").map(Number)
      const dt = new Date(directTarget.work_date + "T00:00:00")
      dt.setHours(hours, minutes, 0, 0)
      const result = await directCorrection({
        targetUserId: directUserId,
        workDate: directTarget.work_date,
        field: directField,
        proposedValue: dt.toISOString(),
        reason: directReason,
      })
      if (result.success) {
        toast.success("Attendance updated!")
        setDirectTarget(null)
        await loadDirectRecords(directUserId)
      } else {
        toast.error(result.error ?? "Failed to apply correction")
      }
    })
  }

  const pendingCount = corrections.filter(c => c.status === "submitted").length

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-5 animate-pulse">
        <div className="h-7 w-40 rounded-xl bg-muted/60" />
        <div className="h-9 w-64 rounded-xl bg-muted/40" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-[60px] rounded-2xl bg-muted/30" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Corrections</h1>
        <p className="text-sm text-muted-foreground">
          Select a day below to request a clock-in correction. Admin will review and approve.
        </p>
      </div>

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="records" className="rounded-lg gap-1.5">
            <Calendar className="h-3.5 w-3.5" />Attendance Records
          </TabsTrigger>
          <TabsTrigger value="my" className="rounded-lg gap-1.5">
            <FileEdit className="h-3.5 w-3.5" />My Requests
            {pendingCount > 0 && (
              <span className="h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          {(isAdmin || isReception) && (
            <TabsTrigger value="team" className="rounded-lg gap-1.5">
              Team Queue
              {teamCorrections.length > 0 && (
                <span className="h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {teamCorrections.length}
                </span>
              )}
            </TabsTrigger>
          )}
          {(isAdmin || isReception) && (
            <TabsTrigger value="direct" className="rounded-lg gap-1.5">
              Direct Fix
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Attendance Records ─────────────────────────────────── */}
        <TabsContent value="records" className="space-y-2">
          {attendanceRecords.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-7 w-7 text-muted-foreground" />}
              title="No attendance records"
              description="No records found in the last 30 days."
            />
          ) : attendanceRecords.map((rec) => {
            const hasPending = corrections.some(
              c => c.attendance?.work_date === rec.work_date && c.status === "submitted"
            )
            return (
              <div key={rec.id}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm gap-3"
              >
                <DayStamp date={rec.work_date} />
                <div className="h-8 w-px bg-border/60 shrink-0" />

                <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">In</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{fmtTime(rec.clock_in)}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Out</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{fmtTime(rec.clock_out)}</p>
                  </div>
                  {rec.total_hours !== null && (
                    <span className="hidden sm:block text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg">
                      {rec.total_hours.toFixed(1)}h
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasPending && (
                    <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                      <AlertCircle className="h-3 w-3" />Pending
                    </span>
                  )}
                  <StatusBadge status={rec.status ?? "unknown"} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs h-8 px-3 border-primary/30 text-primary hover:bg-primary/5 shrink-0"
                    onClick={() => openModal(rec)}
                    disabled={hasPending}
                  >
                    <FileEdit className="h-3 w-3 mr-1" />
                    {hasPending ? "Pending" : "Request Correction"}
                  </Button>
                </div>
              </div>
            )
          })}
        </TabsContent>

        {/* ── My Requests ───────────────────────────────────────── */}
        <TabsContent value="my" className="space-y-2">
          {corrections.length === 0 ? (
            <EmptyState
              icon={<FileEdit className="h-7 w-7 text-muted-foreground" />}
              title="No requests yet"
              description="Go to Attendance Records and click Request Correction on any day."
            />
          ) : corrections.map((c) => (
            <div key={c.id}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3.5 shadow-sm gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <FileEdit className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {FIELD_LABELS[c.field] ?? c.field} &mdash; {fmtDate(c.attendance?.work_date ?? null)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    <span className="text-destructive/80 font-mono">{c.original_value ?? "—"}</span>
                    {" → "}
                    <span className="text-success font-mono">{c.proposed_value}</span>
                    {" · "}
                    {c.reason}
                  </p>
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </TabsContent>

        {/* ── Team Queue (admin) ────────────────────────────────── */}
        {(isAdmin || isReception) && (
          <TabsContent value="team" className="space-y-3">
            {teamCorrections.length === 0 ? (
              <EmptyState title="All clear" description="No pending corrections to review." />
            ) : teamCorrections.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <FileEdit className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {(c.user as any)?.full_name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {FIELD_LABELS[c.field] ?? c.field} &middot; {fmtDate(c.attendance?.work_date ?? null)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 italic">"{c.reason}"</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="gap-1.5 rounded-xl" disabled={isPending}
                      onClick={() => setShowApprovalModal({ id: c.id, action: "approve" })}>
                      <CheckCircle className="h-3.5 w-3.5" />Approve
                    </Button>
                    <Button size="sm" variant="outline"
                      className="gap-1.5 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
                      disabled={isPending}
                      onClick={() => setShowApprovalModal({ id: c.id, action: "reject" })}>
                      <XCircle className="h-3.5 w-3.5" />Reject
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-wide mb-1">Original</p>
                    <p className="text-sm font-semibold text-foreground font-mono">{c.original_value ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                    <p className="text-[10px] font-bold text-success uppercase tracking-wide mb-1">Proposed</p>
                    <p className="text-sm font-semibold text-foreground font-mono">{c.proposed_value}</p>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        )}
        {/* ── Direct Fix (admin/reception) ──────────────────────── */}
        {(isAdmin || isReception) && (
          <TabsContent value="direct" className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Select a staff member to view and directly fix their attendance.</p>
              <Select value={directUserId} onValueChange={(v) => { setDirectUserId(v); loadDirectRecords(v) }}>
                <SelectTrigger className="rounded-xl max-w-xs">
                  <SelectValue placeholder="Select staff member…" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {directUserId && directRecords.length === 0 && (
              <EmptyState icon={<Clock className="h-7 w-7 text-muted-foreground" />} title="No records" description="No attendance in the last 30 days." />
            )}

            {directRecords.map((rec) => (
              <div key={rec.id}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm gap-3"
              >
                <DayStamp date={rec.work_date} />
                <div className="h-8 w-px bg-border/60 shrink-0" />
                <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">In</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{fmtTime(rec.clock_in)}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Out</p>
                    <p className="text-sm font-semibold text-foreground tabular-nums">{fmtTime(rec.clock_out)}</p>
                  </div>
                  {rec.total_hours !== null && (
                    <span className="hidden sm:block text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg">
                      {rec.total_hours.toFixed(1)}h
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={rec.status ?? "unknown"} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs h-8 px-3 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => openDirectModal(rec)}
                  >
                    <FileEdit className="h-3 w-3 mr-1" />Fix
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>
        )}
      </Tabs>

      {/* ── Request Correction Modal ───────────────────────────── */}
      <Dialog open={!!selectedRecord} onOpenChange={(o) => !o && setSelectedRecord(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Request Correction</DialogTitle>
            {selectedRecord && (
              <DialogDescription>{fmtDate(selectedRecord.work_date)}</DialogDescription>
            )}
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              {/* Existing values at a glance */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 border border-border/40 p-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Clock In</p>
                  <p className="text-sm font-semibold font-mono">{fmtTime(selectedRecord.clock_in)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Clock Out</p>
                  <p className="text-sm font-semibold font-mono">{fmtTime(selectedRecord.clock_out)}</p>
                </div>
                {selectedRecord.break_start && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Break Start</p>
                    <p className="text-sm font-semibold font-mono">{fmtTime(selectedRecord.break_start)}</p>
                  </div>
                )}
                {selectedRecord.break_end && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Break End</p>
                    <p className="text-sm font-semibold font-mono">{fmtTime(selectedRecord.break_end)}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Field to Correct</Label>
                <Select value={corrField} onValueChange={(v) => handleFieldChange(v as any)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clock_in">Clock In</SelectItem>
                    <SelectItem value="clock_out">Clock Out</SelectItem>
                    <SelectItem value="break_start">Break Start</SelectItem>
                    <SelectItem value="break_end">Break End</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Current value</Label>
                  <div className="h-10 rounded-xl border border-border/50 bg-muted/40 px-3 flex items-center text-sm font-mono text-muted-foreground">
                    {originalForField(selectedRecord, corrField) || "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Corrected time <span className="text-destructive">*</span></Label>
                  <Input type="time" className="rounded-xl" value={corrValue}
                    onChange={(e) => setCorrValue(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Explain why this correction is needed..."
                  className="rounded-xl resize-none"
                  rows={3}
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setSelectedRecord(null)}>
              Cancel
            </Button>
            <Button className="rounded-xl" disabled={isPending} onClick={handleSubmit}>
              {isPending ? "Submitting…" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Direct Fix Modal ──────────────────────────────────── */}
      <Dialog open={!!directTarget} onOpenChange={(o) => !o && setDirectTarget(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Fix Attendance</DialogTitle>
            {directTarget && (
              <DialogDescription>{fmtDate(directTarget.work_date)}</DialogDescription>
            )}
          </DialogHeader>
          {directTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 border border-border/40 p-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Clock In</p>
                  <p className="text-sm font-semibold font-mono">{fmtTime(directTarget.clock_in)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Clock Out</p>
                  <p className="text-sm font-semibold font-mono">{fmtTime(directTarget.clock_out)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Field to Fix</Label>
                <Select value={directField} onValueChange={(v) => handleDirectFieldChange(v as any)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clock_in">Clock In</SelectItem>
                    <SelectItem value="clock_out">Clock Out</SelectItem>
                    <SelectItem value="break_start">Break Start</SelectItem>
                    <SelectItem value="break_end">Break End</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Current value</Label>
                  <div className="h-10 rounded-xl border border-border/50 bg-muted/40 px-3 flex items-center text-sm font-mono text-muted-foreground">
                    {originalForField(directTarget, directField) || "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Corrected time <span className="text-destructive">*</span></Label>
                  <Input type="time" className="rounded-xl" value={directValue}
                    onChange={(e) => setDirectValue(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Why is this being corrected?"
                  className="rounded-xl resize-none"
                  rows={3}
                  value={directReason}
                  onChange={(e) => setDirectReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDirectTarget(null)}>
              Cancel
            </Button>
            <Button className="rounded-xl" disabled={isPending} onClick={handleDirectSubmit}>
              {isPending ? "Saving…" : "Apply Fix"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Approve / Reject Modal ────────────────────────────── */}
      <Dialog open={!!showApprovalModal} onOpenChange={() => setShowApprovalModal(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {showApprovalModal?.action === "approve" ? "Approve" : "Reject"} Correction
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              Comment{" "}
              {showApprovalModal?.action === "reject" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              placeholder={showApprovalModal?.action === "reject"
                ? "Required — explain the reason..."
                : "Optional comment..."}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setShowApprovalModal(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              variant={showApprovalModal?.action === "reject" ? "destructive" : "default"}
              disabled={isPending}
              onClick={handleReview}
            >
              {showApprovalModal?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
