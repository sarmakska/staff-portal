"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, RefreshCw, CalendarDays, Laptop } from "lucide-react"
import * as XLSX from "xlsx"

interface PersonSummary {
    id: string
    name: string
    email: string
    daysWorked: number
    wfhDays: number
    daysLeave: number
    leaveBreakdown: Record<string, number>
    contractedDays: number
    contractedDaysPerWeek: number
    hoursPerWeek: number
}

interface Props {
    summary: PersonSummary[]
    from: string
    to: string
    workingDaysInPeriod: number
    bankHolidaysInRange: string[]
}

function fmt(d: string) {
    return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function num(v: number) {
    return v % 1 === 0 ? String(v) : v.toFixed(1)
}

export function StaffSummaryClient({ summary, from, to, workingDaysInPeriod, bankHolidaysInRange }: Props) {
    const router = useRouter()
    const [fromVal, setFromVal] = useState(from)
    const [toVal, setToVal] = useState(to)

    function applyFilter() { router.push(`?from=${fromVal}&to=${toVal}`) }

    function setMonth(offset: number) {
        const now = new Date()
        const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
        const f = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]
        const t = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]
        setFromVal(f); setToVal(t)
        router.push(`?from=${f}&to=${t}`)
    }

    function exportExcel() {
        const rows = summary.map(p => ({
            "Employee": p.name,
            "Email": p.email,
            "Contract (days/week)": p.contractedDaysPerWeek,
            "Hours per Week": p.hoursPerWeek,
            "Contracted Days in Period": p.contractedDays,
            "Days Worked (Office)": p.daysWorked - p.wfhDays > 0 ? p.daysWorked - p.wfhDays : 0,
            "WFH Days": p.wfhDays,
            "Total Days Worked": p.daysWorked,
            "Days on Leave": p.daysLeave,
            "Annual Leave": p.leaveBreakdown["annual"] ?? 0,
            "Sick Leave": p.leaveBreakdown["sick"] ?? 0,
            "Maternity Leave": p.leaveBreakdown["maternity"] ?? 0,
            "Unpaid Leave": p.leaveBreakdown["unpaid"] ?? 0,
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        ws["!cols"] = [
            { wch: 28 }, { wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 22 },
            { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
        ]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Staff Summary")
        XLSX.writeFile(wb, `staff-summary-${from}-to-${to}.xlsx`)
    }

    return (
        <div className="space-y-5 p-4 md:p-6 max-w-[1300px] mx-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">Staff Summary</h1>
                    <p className="text-base font-medium text-muted-foreground mt-1">Days worked and leave taken per employee</p>
                </div>
                <Button onClick={exportExcel} className="gap-2 shrink-0">
                    <Download className="h-4 w-4" />Export Excel
                </Button>
            </div>

            {/* Date filter */}
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground font-medium">From</label>
                    <Input type="date" value={fromVal} onChange={e => setFromVal(e.target.value)} className="h-9 w-40 rounded-xl" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground font-medium">To</label>
                    <Input type="date" value={toVal} onChange={e => setToVal(e.target.value)} className="h-9 w-40 rounded-xl" />
                </div>
                <Button onClick={applyFilter} className="h-9 gap-2 rounded-xl">
                    <RefreshCw className="h-4 w-4" />Apply
                </Button>
                <div className="flex gap-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => setMonth(-1)} className="rounded-xl text-xs">Last Month</Button>
                    <Button variant="outline" size="sm" onClick={() => setMonth(0)} className="rounded-xl text-xs">This Month</Button>
                </div>
            </div>

            {/* Info row */}
            <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Period</p>
                        <p className="text-sm font-bold text-foreground">{fmt(from)} — {fmt(to)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
                    <span className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{workingDaysInPeriod}</span>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Working Days in Period</p>
                        <p className="text-sm font-bold text-foreground">Mon–Fri, excl. UK Bank Holidays</p>
                    </div>
                </div>
                {bankHolidaysInRange.length > 0 && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5">
                        <CalendarDays className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div>
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold tracking-wider">Bank Holidays</p>
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{bankHolidaysInRange.map(d => fmt(d)).join(", ")}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            {/* Group header */}
                            <tr className="bg-muted/50 border-b border-border/60">
                                <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-foreground w-56" rowSpan={2}>Employee</th>
                                <th className="px-4 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground border-l border-border/40" colSpan={3}>Contract</th>
                                <th className="px-4 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-l border-border/40" colSpan={3}>Attendance</th>
                                <th className="px-4 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-rose-500 border-l border-border/40" colSpan={4}>Leave</th>
                            </tr>
                            <tr className="bg-muted/30 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                <th className="px-4 py-2.5 text-center border-l border-border/40">Days/Week</th>
                                <th className="px-4 py-2.5 text-center">Hours/Week</th>
                                <th className="px-4 py-2.5 text-center">In Period</th>
                                <th className="px-4 py-2.5 text-center border-l border-border/40">Office</th>
                                <th className="px-4 py-2.5 text-center">
                                    <span className="flex items-center justify-center gap-1"><Laptop className="h-3 w-3" />WFH</span>
                                </th>
                                <th className="px-4 py-2.5 text-center bg-muted/30">Total</th>
                                <th className="px-4 py-2.5 text-center border-l border-border/40">Annual</th>
                                <th className="px-4 py-2.5 text-center">Sick</th>
                                <th className="px-4 py-2.5 text-center">Maternity</th>
                                <th className="px-4 py-2.5 text-center">Unpaid</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {summary.map((p, i) => {
                                const officeDays = Math.max(0, p.daysWorked - p.wfhDays)
                                const isEven = i % 2 === 0
                                return (
                                    <tr key={p.id} className={`hover:bg-muted/20 transition-colors ${isEven ? "" : "bg-muted/10"}`}>
                                        <td className="px-5 py-3.5 align-middle">
                                            <div className="font-bold text-foreground text-sm leading-tight">{p.name}</div>
                                            <div className="text-[11px] text-muted-foreground">{p.email}</div>
                                        </td>
                                        {/* Contract */}
                                        <td className="px-4 py-3.5 text-center align-middle border-l border-border/40">
                                            <span className="inline-flex items-center justify-center h-6 min-w-[28px] px-2 rounded-md text-xs font-bold bg-muted/50 text-foreground">
                                                {p.contractedDaysPerWeek}d
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle">
                                            <span className="inline-flex items-center justify-center h-6 min-w-[36px] px-2 rounded-md text-xs font-bold bg-primary/10 text-primary">
                                                {p.hoursPerWeek % 1 === 0 ? p.hoursPerWeek : p.hoursPerWeek.toFixed(1)}h
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle">
                                            <span className="text-sm font-bold text-muted-foreground">{p.contractedDays}</span>
                                        </td>
                                        {/* Attendance */}
                                        <td className="px-4 py-3.5 text-center align-middle border-l border-border/40">
                                            <span className="text-sm font-bold text-foreground">{num(officeDays)}</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle">
                                            {p.wfhDays > 0
                                                ? <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">{num(p.wfhDays)}</span>
                                                : <span className="text-muted-foreground/40 text-sm">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle bg-muted/10">
                                            <span className="text-base font-extrabold text-foreground">{num(p.daysWorked)}</span>
                                        </td>
                                        {/* Leave */}
                                        <td className="px-4 py-3.5 text-center align-middle border-l border-border/40 text-sm text-muted-foreground">
                                            {p.leaveBreakdown["annual"] ? <span className="font-semibold text-foreground">{num(p.leaveBreakdown["annual"])}</span> : "—"}
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle text-sm text-muted-foreground">
                                            {p.leaveBreakdown["sick"] ? <span className="font-semibold text-foreground">{num(p.leaveBreakdown["sick"])}</span> : "—"}
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle text-sm text-muted-foreground">
                                            {p.leaveBreakdown["maternity"] ? <span className="font-semibold text-foreground">{num(p.leaveBreakdown["maternity"])}</span> : "—"}
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle text-sm text-muted-foreground">
                                            {p.leaveBreakdown["unpaid"] ? <span className="font-semibold text-foreground">{num(p.leaveBreakdown["unpaid"])}</span> : "—"}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
