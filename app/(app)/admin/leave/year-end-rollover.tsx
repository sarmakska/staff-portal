"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ChevronRight, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react"
import {
    previewYearEndRollover,
    runYearEndRollover,
    type RolloverPreviewRow,
} from "@/lib/actions/leave-rollover"

interface Props {
    currentYear: number
}

export function YearEndRollover({ currentYear }: Props) {
    const [preview, setPreview] = useState<RolloverPreviewRow[] | null>(null)
    const [toYear, setToYear] = useState(currentYear + 1)
    const [fromYear, setFromYear] = useState(currentYear)
    const [done, setDone] = useState(false)
    const [isPendingPreview, startPreview] = useTransition()
    const [isPendingRollover, startRollover] = useTransition()

    function handlePreview() {
        setDone(false)
        setPreview(null)
        startPreview(async () => {
            const res = await previewYearEndRollover(fromYear)
            if (res.error) {
                toast.error(res.error)
                return
            }
            setToYear(res.toYear)
            setPreview(res.rows)
        })
    }

    function handleRollover() {
        startRollover(async () => {
            const res = await runYearEndRollover(fromYear)
            if (res.success) {
                toast.success(`Rolled over ${res.count} employee${res.count === 1 ? "" : "s"} into ${toYear}`)
                setDone(true)
                setPreview(null)
            } else {
                toast.error(res.error ?? "Rollover failed")
            }
        })
    }

    return (
        <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur-md shadow-sm p-6 space-y-5">
            <div>
                <h2 className="text-xl font-bold text-foreground">Year-End Rollover</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Roll unused annual leave into the next year. Each employee&apos;s carry-forward cap is set in the <span className="font-medium text-foreground">Max Carry</span> column below.
                </p>
            </div>

            {/* Year selector + preview */}
            <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Roll over from year</label>
                    <Input
                        type="number"
                        min={2024}
                        max={2099}
                        value={fromYear}
                        onChange={e => { setFromYear(Number(e.target.value)); setPreview(null); setDone(false) }}
                        className="h-9 w-28 rounded-xl text-center font-bold bg-background/50 border-border/60 focus-visible:ring-brand-taupe"
                    />
                </div>
                <Button
                    onClick={handlePreview}
                    disabled={isPendingPreview}
                    size="sm"
                    className="h-9 rounded-xl gap-1.5 bg-brand-taupe hover:bg-brand-taupe/90 text-white"
                >
                    <ChevronRight className="h-4 w-4" />
                    {isPendingPreview ? "Loading…" : "Preview"}
                </Button>
            </div>

            {/* Done state */}
            {done && (
                <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/20 px-4 py-3 text-sm text-success font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Rollover complete. Annual leave for {toYear} has been updated.
                </div>
            )}

            {/* Preview table */}
            {preview && preview.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Review carefully. Confirming will upsert {toYear} annual leave balances for all {preview.length} employees.
                    </div>

                    <div className="rounded-2xl border border-border/60 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border/60">
                                    <tr>
                                        <th className="px-4 py-3 font-bold tracking-wider">Employee</th>
                                        <th className="px-4 py-3 font-bold tracking-wider text-right">{fromYear} Remaining</th>
                                        <th className="px-4 py-3 font-bold tracking-wider text-right">Cap</th>
                                        <th className="px-4 py-3 font-bold tracking-wider text-right">Will Carry</th>
                                        <th className="px-4 py-3 font-bold tracking-wider text-right">{toYear} Base</th>
                                        <th className="px-4 py-3 font-bold tracking-wider text-right">{toYear} Total</th>
                                        <th className="px-4 py-3 font-bold tracking-wider text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {preview.map(row => (
                                        <tr key={row.userId} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-foreground">{row.name}</div>
                                                <div className="text-xs text-muted-foreground">{row.email}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">{row.remaining}d</td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">{row.cap}d</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`font-bold ${row.willCarry > 0 ? "text-brand-taupe" : "text-muted-foreground"}`}>
                                                    {row.willCarry}d
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">{row.nextYearBase}d</td>
                                            <td className="px-4 py-3 text-right font-bold text-foreground">{row.nextYearTotal}d</td>
                                            <td className="px-4 py-3 text-center">
                                                {row.alreadyExists ? (
                                                    <span className="text-xs font-medium text-amber-600 bg-amber-500/10 rounded-full px-2 py-0.5">
                                                        Will update
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-medium text-success bg-success/10 rounded-full px-2 py-0.5">
                                                        New
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <Button
                        onClick={handleRollover}
                        disabled={isPendingRollover}
                        className="gap-2 rounded-xl bg-brand-taupe hover:bg-brand-taupe/90 text-white"
                    >
                        <RotateCcw className="h-4 w-4" />
                        {isPendingRollover ? "Running rollover…" : `Confirm rollover into ${toYear}`}
                    </Button>
                </div>
            )}

            {preview && preview.length === 0 && (
                <p className="text-sm text-muted-foreground">No annual leave records found for {fromYear}.</p>
            )}
        </div>
    )
}
