"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { AlertTriangle } from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"

interface Alert {
    id: string
    work_date: string
    notified_at: string
    user: {
        full_name: string | null
        email: string | null
        departments: { name: string } | null
    } | null
}

interface Props {
    alerts: Alert[]
}

const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

export default function ForgottenClockowutsClient({ alerts }: Props) {
    const [search, setSearch] = useState("")

    // Chart: incidents per day (last 30 days)
    const chartData = useMemo(() => {
        const counts: Record<string, number> = {}
        alerts.forEach(a => {
            counts[a.work_date] = (counts[a.work_date] ?? 0) + 1
        })
        return Object.entries(counts)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-30)
            .map(([date, count]) => ({
                date: new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
                count,
            }))
    }, [alerts])

    // Per-person stats
    const byPerson = useMemo(() => {
        const map: Record<string, { name: string; email: string; dept: string; count: number }> = {}
        alerts.forEach(a => {
            const key = a.user?.email ?? a.id
            if (!map[key]) {
                map[key] = {
                    name: a.user?.full_name ?? a.user?.email ?? "Unknown",
                    email: a.user?.email ?? "",
                    dept: a.user?.departments?.name ?? "Unassigned",
                    count: 0,
                }
            }
            map[key].count++
        })
        return Object.values(map).sort((a, b) => b.count - a.count)
    }, [alerts])

    const filtered = useMemo(() => {
        if (!search.trim()) return alerts
        const q = search.toLowerCase()
        return alerts.filter(a =>
            (a.user?.full_name ?? "").toLowerCase().includes(q) ||
            (a.user?.email ?? "").toLowerCase().includes(q) ||
            (a.user?.departments?.name ?? "").toLowerCase().includes(q)
        )
    }, [alerts, search])

    if (alerts.length === 0) {
        return (
            <div className="p-4 md:p-6 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Forgotten Clock-outs</h1>
                    <p className="text-sm text-muted-foreground">Track employees who forgot to clock out</p>
                </div>
                <EmptyState
                    icon={<AlertTriangle className="h-7 w-7 text-muted-foreground" />}
                    title="No forgotten clock-outs"
                    description="No alerts have been triggered yet. The cron runs Mon–Fri at 7pm."
                />
            </div>
        )
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Forgotten Clock-outs</h1>
                <p className="text-sm text-muted-foreground">
                    {alerts.length} alert{alerts.length !== 1 ? "s" : ""} total · cron runs Mon–Fri at 7pm UK time
                </p>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card className="rounded-2xl border-border shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Total Incidents</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{alerts.length}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-border shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Unique Employees</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{byPerson.length}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-border shadow-sm col-span-2 md:col-span-1">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Most Incidents</p>
                        <p className="text-lg font-bold text-foreground mt-1 truncate">
                            {byPerson[0]?.name ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{byPerson[0]?.count ?? 0} times</p>
                    </CardContent>
                </Card>
            </div>

            {/* Chart */}
            <Card className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Incidents per Day (last 30 days)</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                formatter={(v: any) => [`${v} incident${v !== 1 ? "s" : ""}`, "Count"]}
                            />
                            <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Per-person leaderboard */}
            <Card className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">By Employee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {byPerson.map(p => (
                        <div key={p.email} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                            <div>
                                <p className="text-sm font-medium text-foreground">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.dept}</p>
                            </div>
                            <span className="text-sm font-bold text-destructive">{p.count}×</span>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Full log table */}
            <Card className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <CardTitle className="text-base font-semibold">Full Log ({filtered.length})</CardTitle>
                        <input
                            type="search"
                            placeholder="Search name or department…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-52"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                    <th className="pb-2 pr-4 font-medium">Employee</th>
                                    <th className="pb-2 pr-4 font-medium">Department</th>
                                    <th className="pb-2 pr-4 font-medium">Date</th>
                                    <th className="pb-2 font-medium">Notified At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map(a => (
                                    <tr key={a.id}>
                                        <td className="py-2 pr-4 font-medium text-foreground">
                                            {a.user?.full_name ?? a.user?.email ?? "Unknown"}
                                        </td>
                                        <td className="py-2 pr-4 text-muted-foreground">
                                            {a.user?.departments?.name ?? "Unassigned"}
                                        </td>
                                        <td className="py-2 pr-4 text-muted-foreground">{fmt(a.work_date)}</td>
                                        <td className="py-2 text-muted-foreground">
                                            {new Date(a.notified_at).toLocaleTimeString("en-GB", {
                                                hour: "2-digit", minute: "2-digit",
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
