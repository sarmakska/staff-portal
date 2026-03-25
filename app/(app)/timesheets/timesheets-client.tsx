"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/shared/empty-state"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileSpreadsheet, Download, Pencil, Trash2, Users, Clock, ArrowRight, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { updateAttendanceEntry, deleteAttendanceEntry } from "@/lib/actions/admin"
import { generateIndividualTimesheetExcel, generateAllTimesheetsExcel } from "@/lib/actions/timesheet-export"

export type AttendanceRow = {
  id: string
  work_date: string
  clock_in: string | null
  clock_out: string | null
  total_hours: number | null
  status: string | null
  running_late?: boolean | null
  late_reason?: string | null
  expected_arrival_time?: string | null
  late_logged_by?: string | null
}

interface Props {
  records: AttendanceRow[]
  isAdmin: boolean
  canExport?: boolean
  viewingName: string
  viewingUserId: string
  from: string
  to: string
  hideExportAll?: boolean
}

const STATUS_OPTIONS = ["present", "absent", "late", "half_day", "holiday", "wfh"]

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  present:  { label: "Present",  cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  absent:   { label: "Absent",   cls: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" },
  late:     { label: "Late",     cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  wfh:      { label: "WFH",      cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  half_day: { label: "Half Day", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" },
  holiday:  { label: "Holiday",  cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
}

function fmt(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function downloadBase64Excel(base64: string, filename: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function TimesheetsClient({ records, isAdmin, canExport, viewingName, viewingUserId, from, to, hideExportAll }: Props) {
  const [rows, setRows] = useState<AttendanceRow[]>(records)
  const [editRow, setEditRow] = useState<AttendanceRow | null>(null)
  const [editClockIn, setEditClockIn] = useState("")
  const [editClockOut, setEditClockOut] = useState("")
  const [editStatus, setEditStatus] = useState("")
  const [isPending, startTransition] = useTransition()
  const [exportingIndividual, setExportingIndividual] = useState(false)
  const [exportingAll, setExportingAll] = useState(false)

  // Group by week
  const weeks: Record<string, AttendanceRow[]> = {}
  for (const r of rows) {
    const d = new Date(r.work_date)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toISOString().split("T")[0]
    if (!weeks[key]) weeks[key] = []
    weeks[key].push(r)
  }

  function openEdit(row: AttendanceRow) {
    setEditRow(row)
    setEditClockIn(toLocalDatetimeValue(row.clock_in))
    setEditClockOut(toLocalDatetimeValue(row.clock_out))
    setEditStatus(row.status ?? "present")
  }

  function handleSaveEdit() {
    if (!editRow) return
    startTransition(async () => {
      const clockInISO = editClockIn ? new Date(editClockIn).toISOString() : null
      const clockOutISO = editClockOut ? new Date(editClockOut).toISOString() : null
      const result = await updateAttendanceEntry(editRow.id, clockInISO, clockOutISO, editStatus)
      if (result.error) { toast.error(result.error); return }
      const totalHours = (clockInISO && clockOutISO)
        ? Math.max(0, Math.round(((new Date(clockOutISO).getTime() - new Date(clockInISO).getTime()) / 3600000) * 100) / 100)
        : null
      setRows(prev => prev.map(r => r.id === editRow.id ? { ...r, clock_in: clockInISO, clock_out: clockOutISO, status: editStatus, total_hours: totalHours } : r))
      setEditRow(null)
      toast.success("Entry updated")
    })
  }

  function handleDelete(id: string, date: string) {
    if (!confirm(`Delete attendance record for ${date}?`)) return
    startTransition(async () => {
      const result = await deleteAttendanceEntry(id)
      if (result.error) { toast.error(result.error); return }
      setRows(prev => prev.filter(r => r.id !== id))
      toast.success("Entry deleted")
    })
  }

  async function handleExportIndividual() {
    setExportingIndividual(true)
    try {
      const result = await generateIndividualTimesheetExcel(viewingUserId, from, to)
      if (result.error || !result.base64) { toast.error(result.error ?? "Export failed"); return }
      downloadBase64Excel(result.base64, result.filename!)
    } finally { setExportingIndividual(false) }
  }

  async function handleExportAll() {
    setExportingAll(true)
    try {
      const result = await generateAllTimesheetsExcel(from, to)
      if (result.error || !result.base64) { toast.error(result.error ?? "Export failed"); return }
      downloadBase64Excel(result.base64, result.filename!)
    } finally { setExportingAll(false) }
  }

  return (
    <>
      {/* Export buttons */}
      {(isAdmin || canExport) && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleExportIndividual} disabled={exportingIndividual}>
            <Download className="h-4 w-4" />
            {exportingIndividual ? "Generating…" : `Export ${viewingName}`}
          </Button>
          {!hideExportAll && (
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleExportAll} disabled={exportingAll}>
              <Users className="h-4 w-4" />
              {exportingAll ? "Generating…" : "Export All Employees"}
            </Button>
          )}
        </div>
      )}

      {Object.keys(weeks).length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-7 w-7 text-muted-foreground" />}
          title="No timesheet data"
          description="No attendance records found for this period."
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(weeks).map(([weekStart, days]) => {
            const total = days.reduce((s, d) => s + (d.total_hours ?? 0), 0)
            const weekLabel = new Date(weekStart + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            const presentDays = days.filter(d => d.status === "present" || d.status === "late").length
            const wfhDays = days.filter(d => d.status === "wfh").length

            return (
              <div key={weekStart} className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">

                {/* Week header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground">Week of {weekLabel}</span>
                    <div className="flex items-center gap-1.5">
                      {presentDays > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          {presentDays} in office
                        </span>
                      )}
                      {wfhDays > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                          {wfhDays} WFH
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums">{total.toFixed(1)}h</span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[50px_1fr_110px_110px_70px_120px] px-5 py-2 border-b border-border/30 bg-muted/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Day</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clock In</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clock Out</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Hours</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Status</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/30">
                  {days.map((d) => {
                    const badge = STATUS_BADGE[d.status ?? ""] ?? { label: d.status ?? "—", cls: "bg-muted text-muted-foreground" }
                    const isWfhOnly = d.id.startsWith("wfh-only-")
                    const clockIn = fmt(d.clock_in)
                    const clockOut = fmt(d.clock_out)

                    return (
                      <div
                        key={d.work_date}
                        className="grid grid-cols-[50px_1fr_110px_110px_70px_120px] items-center px-5 py-3.5 group hover:bg-muted/20 transition-colors"
                      >
                        {/* Day */}
                        <span className="text-xs font-bold text-muted-foreground">
                          {new Date(d.work_date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}
                        </span>

                        {/* Date */}
                        <span className="text-sm text-foreground font-medium">{d.work_date}</span>

                        {/* Clock In */}
                        <div className="flex items-center gap-1.5">
                          {clockIn ? (
                            <>
                              <ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />
                              <span className="text-sm font-semibold text-foreground tabular-nums">{clockIn}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground/40">—</span>
                          )}
                        </div>

                        {/* Clock Out */}
                        <div className="flex items-center gap-1.5">
                          {clockOut ? (
                            <>
                              <ArrowLeft className="h-3 w-3 text-rose-400 shrink-0" />
                              <span className="text-sm font-semibold text-foreground tabular-nums">{clockOut}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground/40">—</span>
                          )}
                        </div>

                        {/* Hours + late badge */}
                        <div className="flex items-center justify-end gap-2">
                          {d.running_late && (
                            <span
                              className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full"
                              title={[
                                d.late_reason ? `Reason: ${d.late_reason}` : null,
                                d.expected_arrival_time ? `Expected: ${d.expected_arrival_time}` : null,
                                d.late_logged_by && d.late_logged_by !== "self" ? `Logged by: ${d.late_logged_by}` : null,
                              ].filter(Boolean).join(" · ") || "Running late"}
                            >
                              <Clock className="h-2.5 w-2.5" />
                              {d.expected_arrival_time ?? "Late"}
                            </span>
                          )}
                          <span className="text-sm font-bold text-foreground tabular-nums">
                            {d.total_hours != null ? `${d.total_hours}h` : ""}
                          </span>
                        </div>

                        {/* Status + actions */}
                        <div className="flex items-center justify-end gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                          {isAdmin && !isWfhOnly && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(d)} className="p-1 rounded-lg hover:bg-muted transition-colors" title="Edit">
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                              <button onClick={() => handleDelete(d.id, d.work_date)} className="p-1 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors" title="Delete">
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) setEditRow(null) }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Attendance — {editRow?.work_date}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Clock In</label>
              <Input type="datetime-local" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Clock Out</label>
              <Input type="datetime-local" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <UISelect value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </UISelect>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
