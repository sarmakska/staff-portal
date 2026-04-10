"use client"

import { useState, useTransition } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { adminGetAllStaffWfh, adminSetWfh } from "@/lib/actions/attendance"
import { toast } from "sonner"
import { Home, X, RefreshCw } from "lucide-react"

type WfhRow = {
    id: string
    full_name: string
    department_name: string | null
    is_wfh: boolean
    wfh_type: 'full' | 'half_am' | 'half_pm' | null
}

function wfhTypeLabel(t: 'full' | 'half_am' | 'half_pm' | null) {
    if (t === 'half_am') return 'Morning'
    if (t === 'half_pm') return 'Afternoon'
    return 'Full Day'
}

export function WfhManagementClient({
    initialDate,
    initialData,
}: {
    initialDate: string
    initialData: WfhRow[]
}) {
    const [date, setDate] = useState(initialDate)
    const [data, setData] = useState(initialData)
    const [isPending, startTransition] = useTransition()

    const reload = (d: string) => {
        startTransition(async () => {
            const fresh = await adminGetAllStaffWfh(d)
            setData(fresh)
        })
    }

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const d = e.target.value
        setDate(d)
        if (d) reload(d)
    }

    const handleToggle = (row: WfhRow) => {
        if (!date) { toast.error("Please select a date first"); return }
        const label = row.is_wfh ? "Remove WFH" : "Mark WFH"
        if (!confirm(`${label} for ${row.full_name} on ${date}?`)) return

        startTransition(async () => {
            const res = await adminSetWfh(row.id, date, !row.is_wfh)
            if (res.success) {
                toast.success(
                    row.is_wfh
                        ? `Removed WFH for ${row.full_name}`
                        : `Marked ${row.full_name} as WFH`
                )
                setData(prev =>
                    prev.map(p => p.id === row.id ? { ...p, is_wfh: !p.is_wfh, wfh_type: !p.is_wfh ? 'full' : null } : p)
                )
            } else {
                toast.error(res.error || "Failed to update WFH")
            }
        })
    }

    const wfhCount = data.filter(d => d.is_wfh).length

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">WFH Management</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {wfhCount} of {data.length} staff working from home on this date
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Input
                        type="date"
                        value={date}
                        onChange={handleDateChange}
                        disabled={isPending}
                        className="w-44"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => reload(date)}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card className="rounded-2xl border-0 shadow-sm bg-card/60 backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border/50">
                            <tr>
                                <th className="px-6 py-4 font-semibold tracking-wider">Staff Member</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Department</th>
                                <th className="px-6 py-4 font-semibold tracking-wider text-center">WFH Status</th>
                                <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {data.map(row => (
                                <tr key={row.id} className="hover:bg-muted/10 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="font-semibold text-foreground">{row.full_name}</span>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {row.department_name ?? "Unassigned"}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {row.is_wfh ? (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium text-xs">
                                                <Home className="h-3.5 w-3.5" /> WFH · {wfhTypeLabel(row.wfh_type)}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {row.is_wfh ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={isPending}
                                                onClick={() => handleToggle(row)}
                                                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                                            >
                                                <X className="h-3.5 w-3.5" /> Remove WFH
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={isPending}
                                                onClick={() => handleToggle(row)}
                                                className="gap-2 border-blue-400/30 text-blue-600 hover:bg-blue-50/50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                            >
                                                <Home className="h-3.5 w-3.5" /> Mark WFH
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        No staff found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
