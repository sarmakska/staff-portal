"use client"

import { useState, useEffect, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Clock, LogIn, LogOut, Coffee, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toggleWfh, submitEarlyLeave, logRunningLate, checkWfhClockInBlock } from "@/lib/actions/attendance"

type AttendanceRecord = {
    id: string
    work_date: string
    clock_in: string | null
    clock_out: string | null
    break_start: string | null
    break_end: string | null
    status: string
    total_hours: number | null
    running_late?: boolean | null
    late_reason?: string | null
}

interface Props {
    records: AttendanceRecord[]
    todayRecord: AttendanceRecord | null
    userId: string
    wfhToday: boolean
    wfhReason: string | null
    wfhType: 'full' | 'half_am' | 'half_pm' | null
}

export default function AttendanceClient({ records, todayRecord, userId, wfhToday, wfhReason, wfhType: wfhTypeProp }: Props) {
    const [currentTime, setCurrentTime] = useState(new Date())
    const [clockedIn, setClockedIn] = useState(!!todayRecord?.clock_in && !todayRecord?.clock_out)
    const [onBreak, setOnBreak] = useState(!!todayRecord?.break_start && !todayRecord?.break_end)
    const [isPending, startTransition] = useTransition()
    const [isWfh, setIsWfh] = useState(wfhToday)
    const [currentWfhType, setCurrentWfhType] = useState<'full' | 'half_am' | 'half_pm'>(wfhTypeProp ?? 'full')
    const [showWfhModal, setShowWfhModal] = useState(false)
    const [wfhReasonInput, setWfhReasonInput] = useState("")
    const [wfhTypeInput, setWfhTypeInput] = useState<'full' | 'half_am' | 'half_pm'>('full')
    const [showEarlyLeaveModal, setShowEarlyLeaveModal] = useState(false)
    const [earlyLeaveReason, setEarlyLeaveReason] = useState("")
    const [showLateModal, setShowLateModal] = useState(false)
    const [lateReason, setLateReason] = useState("")

    const supabase = createClient()

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    const today = new Date().toISOString().split("T")[0]
    const clockInTime = todayRecord?.clock_in
        ? new Date(todayRecord.clock_in).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        : null

    const handleClockIn = () => {
        startTransition(async () => {
            const block = await checkWfhClockInBlock(userId, today)
            if (block) { toast.error(block); return }
            const now = new Date().toISOString()
            const { error } = await supabase.from("attendance").upsert({
                user_id: userId,
                work_date: today,
                clock_in: now,
                status: "present",
            }, { onConflict: "user_id,work_date" })
            if (error) { toast.error(error.message); return }
            setClockedIn(true)
            toast.success("Clocked in!")
        })
    }

    const handleClockOut = () => {
        startTransition(async () => {
            const now = new Date()
            const nowIso = now.toISOString()

            // Fetch the current record to compute total_hours accurately
            const { data: rec } = await supabase
                .from("attendance")
                .select("clock_in, break_start, break_end")
                .eq("user_id", userId)
                .eq("work_date", today)
                .single()

            let totalHours = 0
            if (rec?.clock_in) {
                const inMs = new Date(rec.clock_in).getTime()
                const outMs = now.getTime()
                let workedMs = outMs - inMs
                if (rec.break_start && rec.break_end) {
                    workedMs -= new Date(rec.break_end).getTime() - new Date(rec.break_start).getTime()
                }
                totalHours = Math.max(0, workedMs / (1000 * 60 * 60))
            }

            const { error } = await supabase.from("attendance")
                .update({
                    clock_out: nowIso,
                    status: "present",
                    total_hours: parseFloat(totalHours.toFixed(2)),
                })
                .eq("user_id", userId).eq("work_date", today)
            if (error) { toast.error(error.message); return }
            setClockedIn(false)
            toast.success("Clocked out!")
        })
    }

    const handleBreak = () => {
        startTransition(async () => {
            const now = new Date().toISOString()
            const update = onBreak
                ? { break_end: now }
                : { break_start: now }
            const { error } = await supabase.from("attendance")
                .update(update)
                .eq("user_id", userId).eq("work_date", today)
            if (error) { toast.error(error.message); return }
            setOnBreak(!onBreak)
            toast.success(onBreak ? "Break ended" : "Break started")
        })
    }

    const currentHour = currentTime.getHours()
    const wfhBlocksClockIn = isWfh && (
        currentWfhType === 'full' ||
        (currentWfhType === 'half_am' && currentHour < 12) ||
        (currentWfhType === 'half_pm' && currentHour >= 12)
    )

    const fmt = (iso: string | null) =>
        iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "--:--"

    const wfhTypeLabel = (t: 'full' | 'half_am' | 'half_pm') => {
        if (t === 'half_am') return 'Morning Only'
        if (t === 'half_pm') return 'Afternoon Only'
        return 'Full Day'
    }

    const handleWfhSubmit = () => {
        startTransition(async () => {
            const result = await toggleWfh(userId, today, true, wfhReasonInput.trim() || undefined, wfhTypeInput)
            if (result.error) { toast.error(result.error); return }
            setIsWfh(true)
            setCurrentWfhType(wfhTypeInput)
            setShowWfhModal(false)
            setWfhReasonInput("")
            setWfhTypeInput('full')
            const label = wfhTypeLabel(wfhTypeInput)
            toast.success(`WFH logged — ${label}`)
        })
    }

    const handleCancelWfh = () => {
        startTransition(async () => {
            const result = await toggleWfh(userId, today, false)
            if (result.error) { toast.error(result.error); return }
            setIsWfh(false)
            toast.success("WFH cancelled for today")
        })
    }

    const handleRunningLateSubmit = () => {
        startTransition(async () => {
            const result = await logRunningLate(userId, lateReason.trim() || undefined)
            if (result.error) { toast.error(result.error); return }
            setShowLateModal(false)
            setLateReason("")
            toast.success("Running late logged — see you when you get here!")
        })
    }

    const handleEarlyLeaveSubmit = () => {
        if (!earlyLeaveReason.trim()) {
            toast.error("Please provide a reason")
            return
        }
        startTransition(async () => {
            const result = await submitEarlyLeave(
                userId, today, earlyLeaveReason.trim(),
                todayRecord?.clock_in ?? null,
                todayRecord?.break_start ?? null,
                todayRecord?.break_end ?? null
            )
            if (result.error) { toast.error(result.error); return }
            setClockedIn(false)
            setShowEarlyLeaveModal(false)
            setEarlyLeaveReason("")
            toast.success("Clocked out (Early Leave logged)")
        })
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
                <p className="text-sm text-muted-foreground">Track your daily clock-in, breaks, and clock-out</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Clock Action Panel */}
                <Card className="rounded-2xl border-border shadow-sm lg:col-span-1">
                    <CardContent className="flex flex-col items-center gap-6 p-8">
                        <div className="text-center space-y-1">
                            <p className="text-4xl font-bold font-mono text-foreground tabular-nums">
                                {currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${clockedIn ? (onBreak ? "bg-yellow-500" : "bg-green-500") : "bg-muted-foreground"}`} />
                            <span className="text-sm font-medium text-foreground">
                                {clockedIn ? (onBreak ? "On Break" : "Clocked In") : "Not Clocked In"}
                            </span>
                        </div>

                        <div className="grid w-full grid-cols-2 gap-3">
                            {!clockedIn && !todayRecord?.clock_out ? (
                                <>
                                    {wfhBlocksClockIn ? (
                                        <div className="col-span-2 rounded-2xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-900 px-4 py-4 text-center space-y-1">
                                            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Working from home today</p>
                                            <p className="text-xs text-indigo-500 dark:text-indigo-400">Attendance has been recorded — no clock-in needed</p>
                                        </div>
                                    ) : (
                                        <Button className="col-span-1 h-14 rounded-2xl text-base gap-2" onClick={handleClockIn} disabled={isPending}>
                                            <LogIn className="h-5 w-5" />Clock In
                                        </Button>
                                    )}
                                    <Button variant={isWfh ? "default" : "outline"} className={`${wfhBlocksClockIn ? "col-span-2" : "col-span-1"} h-14 rounded-2xl text-sm gap-2 ${isWfh ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}`} onClick={isWfh ? handleCancelWfh : () => setShowWfhModal(true)} disabled={isPending}>
                                        {isWfh ? `WFH · ${wfhTypeLabel(currentWfhType)} (tap to cancel)` : "Log WFH Day"}
                                    </Button>
                                    {!wfhBlocksClockIn && (todayRecord?.running_late ? (
                                        <div className="col-span-2 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
                                            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                                            <span className="text-sm font-medium text-amber-600">Running Late Logged</span>
                                        </div>
                                    ) : (
                                        <Button variant="outline" className="col-span-2 h-11 rounded-2xl text-sm gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/5 hover:border-amber-500/50" onClick={() => setShowLateModal(true)} disabled={isPending}>
                                            <Clock className="h-4 w-4" /> I&apos;m Running Late
                                        </Button>
                                    ))}
                                </>
                            ) : !clockedIn && todayRecord?.clock_out ? (
                                <>
                                    <div className="col-span-2 h-10 rounded-2xl border border-border bg-muted/30 flex items-center justify-center font-medium text-muted-foreground text-sm">
                                        Shift Completed Today
                                    </div>
                                    <Button
                                        variant={isWfh ? "default" : "outline"}
                                        className={`col-span-2 h-11 rounded-2xl text-sm gap-2 ${isWfh ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}`}
                                        onClick={isWfh ? handleCancelWfh : () => { setWfhTypeInput('half_pm'); setShowWfhModal(true) }}
                                        disabled={isPending}
                                    >
                                        {isWfh ? `WFH · ${wfhTypeLabel(currentWfhType)} (tap to remove)` : "Log WFH for this afternoon"}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant={onBreak ? "default" : "outline"}
                                        className="h-14 rounded-2xl text-sm gap-2"
                                        onClick={handleBreak} disabled={isPending}
                                    >
                                        <Coffee className="h-4 w-4" />
                                        {onBreak ? "End Break" : "Start Break"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="col-span-1 h-14 rounded-2xl text-sm gap-2"
                                        onClick={() => setShowEarlyLeaveModal(true)} disabled={isPending}
                                    >
                                        <AlertCircle className="h-4 w-4 text-orange-500" /> Early Leave
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="col-span-2 h-14 rounded-2xl text-sm gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
                                        onClick={handleClockOut} disabled={isPending}
                                    >
                                        <LogOut className="h-4 w-4" />Clock Out
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* WFH Modal */}
                        {showWfhModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                                <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <h3 className="text-xl font-bold mb-2">Log Work From Home</h3>
                                    <p className="text-sm text-muted-foreground mb-4">Choose how much of today you&apos;re working from home.</p>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        {([['full', 'Full Day'], ['half_am', 'Morning Only'], ['half_pm', 'Afternoon Only']] as const).map(([val, label]) => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => setWfhTypeInput(val)}
                                                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${wfhTypeInput === val ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : 'border-border bg-muted/30 text-muted-foreground hover:border-indigo-300'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        className="w-full h-20 p-3 rounded-xl border border-border bg-muted/30 mb-4 focus:ring-2 focus:ring-primary outline-none resize-none"
                                        placeholder="e.g. Waiting for a delivery, unwell but able to work... (optional)"
                                        value={wfhReasonInput}
                                        onChange={(e) => setWfhReasonInput(e.target.value)}
                                    />
                                    <div className="flex gap-3 justify-end">
                                        <Button variant="outline" onClick={() => { setShowWfhModal(false); setWfhReasonInput(""); setWfhTypeInput('full') }} disabled={isPending}>Cancel</Button>
                                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleWfhSubmit} disabled={isPending}>Confirm WFH</Button>
                                    </div>
                                </div>
                            </div>
                        )}

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
                                        <Button variant="outline" onClick={() => { setShowLateModal(false); setLateReason("") }} disabled={isPending}>Cancel</Button>
                                        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={handleRunningLateSubmit} disabled={isPending}>Confirm</Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Early Leave Modal */}
                        {showEarlyLeaveModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                                <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <h3 className="text-xl font-bold mb-2">Log Early Departure</h3>
                                    <p className="text-sm text-muted-foreground mb-4">Please provide a reason for clocking out before your shift normally ends.</p>
                                    <textarea
                                        className="w-full h-24 p-3 rounded-xl border border-border bg-muted/30 mb-4 focus:ring-2 focus:ring-primary outline-none resize-none"
                                        placeholder="Reason for early departure..."
                                        value={earlyLeaveReason}
                                        onChange={(e) => setEarlyLeaveReason(e.target.value)}
                                    />
                                    <div className="flex gap-3 justify-end">
                                        <Button variant="outline" onClick={() => setShowEarlyLeaveModal(false)} disabled={isPending}>Cancel</Button>
                                        <Button variant="destructive" onClick={handleEarlyLeaveSubmit} disabled={isPending}>Submit & Clock Out</Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isWfh && (
                            <div className="w-full rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-900 p-3 space-y-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">WFH · {wfhTypeLabel(currentWfhType)}</p>
                                </div>
                                {wfhReason && <p className="text-sm text-foreground">{wfhReason}</p>}
                            </div>
                        )}

                        {todayRecord && (
                            <div className="w-full rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Today&apos;s Timeline</p>
                                <div className="space-y-2">
                                    {todayRecord.running_late && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                                            <span className="text-amber-600 font-medium">Running Late</span>
                                            {todayRecord.late_reason && <span className="ml-auto text-muted-foreground text-xs truncate max-w-[120px]">{todayRecord.late_reason}</span>}
                                        </div>
                                    )}
                                    {todayRecord.clock_in && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <LogIn className="h-3.5 w-3.5 text-green-600" />
                                            <span>Clock In</span>
                                            <span className="ml-auto text-muted-foreground">{fmt(todayRecord.clock_in)}</span>
                                        </div>
                                    )}
                                    {todayRecord.break_start && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Coffee className="h-3.5 w-3.5 text-yellow-600" />
                                            <span>Break</span>
                                            <span className="ml-auto text-muted-foreground">
                                                {fmt(todayRecord.break_start)}{todayRecord.break_end ? ` – ${fmt(todayRecord.break_end)}` : " (active)"}
                                            </span>
                                        </div>
                                    )}
                                    {todayRecord.clock_out && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span>Clock Out</span>
                                            <span className="ml-auto text-muted-foreground">{fmt(todayRecord.clock_out)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Weekly Summary */}
                <div className="space-y-6 lg:col-span-2">
                    <Card className="rounded-2xl border-border shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">Current Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                {[
                                    { label: "Clock In", value: fmt(todayRecord?.clock_in ?? null) },
                                    { label: "Break", value: todayRecord?.break_start ? (onBreak ? "Active" : fmt(todayRecord.break_start)) : "—" },
                                    { label: "Clock Out", value: fmt(todayRecord?.clock_out ?? null) },
                                    { label: "Hours", value: todayRecord?.total_hours ? `${todayRecord.total_hours}h` : "—" },
                                ].map(({ label, value }) => (
                                    <div key={label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                                        <p className="text-xs text-muted-foreground">{label}</p>
                                        <p className="text-lg font-bold text-foreground">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-base font-semibold">This Week</CardTitle>
                            <Button variant="ghost" size="sm" className="text-xs text-brand-taupe" asChild>
                                <Link href="/corrections">Request Correction</Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {records.length === 0 ? (
                                <EmptyState
                                    icon={<Clock className="h-7 w-7 text-muted-foreground" />}
                                    title="No attendance records"
                                    description="Clock in to start tracking your attendance."
                                />
                            ) : (
                                <div className="space-y-2">
                                    {records.map((day) => (
                                        <div key={day.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 text-center">
                                                    <p className="text-xs font-medium text-muted-foreground">
                                                        {new Date(day.work_date).toLocaleDateString("en-GB", { weekday: "short" })}
                                                    </p>
                                                </div>
                                                <p className="text-sm text-foreground">
                                                    {day.clock_in ? `${fmt(day.clock_in)} – ${fmt(day.clock_out)}` : "—"}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {day.total_hours && <span className="text-sm font-medium">{day.total_hours}h</span>}
                                                <StatusBadge status={day.status} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
