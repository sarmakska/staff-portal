"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { CalendarClock, Loader2, Play } from "lucide-react"
import { toast } from "sonner"
import { runAccruals, type AccrualPreviewRow } from "@/lib/actions/leave-accrual"

export default function AccrualClient({
    initialRows,
    year,
    error,
}: {
    initialRows: AccrualPreviewRow[]
    year: number
    error?: string
}) {
    const [rows, setRows] = useState(initialRows)
    const [isPending, startTransition] = useTransition()
    const [done, setDone] = useState(false)

    const total = rows.reduce((sum, r) => sum + r.daysToGrant, 0)

    const handleRun = () => {
        startTransition(async () => {
            const res = await runAccruals(year)
            if (res.error) { toast.error(res.error); return }
            toast.success(`Granted ${res.granted ?? 0} day(s) across ${res.count ?? 0} balances`)
            setRows([])
            setDone(true)
        })
    }

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CalendarClock className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Leave Accruals</h1>
                    <p className="text-sm text-muted-foreground">Monthly top-ups for {year}, capped at each employee&apos;s full entitlement.</p>
                </div>
            </div>

            {error ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
                    {error}
                </div>
            ) : done ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm text-emerald-800 dark:text-emerald-300">
                    Accruals applied. Re-running today will grant nothing further until the next month elapses.
                </div>
            ) : rows.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-card p-6 text-sm text-muted-foreground text-center">
                    Nothing to accrue right now. Balances with an accrual rate top up automatically on the first of each month.
                </div>
            ) : (
                <>
                    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                        <div className="grid grid-cols-[1fr,auto,auto] gap-3 px-5 py-2.5 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            <span>Employee</span>
                            <span className="text-right">Rate / month</span>
                            <span className="text-right">To grant</span>
                        </div>
                        {rows.map((r, i) => (
                            <div key={`${r.userId}-${r.leaveType}`} className={`grid grid-cols-[1fr,auto,auto] gap-3 px-5 py-3 items-center ${i !== rows.length - 1 ? "border-b border-border/30" : ""}`}>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">{r.name}</p>
                                    <p className="text-xs text-muted-foreground">{r.leaveType}</p>
                                </div>
                                <span className="text-right text-sm tabular-nums">{r.accrualRate}</span>
                                <span className="text-right text-sm font-bold tabular-nums text-emerald-600">+{r.daysToGrant}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground">
                            {rows.length} balance{rows.length !== 1 ? "s" : ""} will receive <span className="font-bold text-foreground">{total.toFixed(2)}</span> day(s).
                        </p>
                        <Button onClick={handleRun} disabled={isPending} className="gap-2">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            Run accruals now
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
