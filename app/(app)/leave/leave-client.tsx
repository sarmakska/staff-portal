"use client"

import { useState, useTransition } from "react"
import { CalendarDays, Plus, X, FileDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import Link from "next/link"
import { withdrawLeave } from "@/lib/actions/leave"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type Balance = {
    id: string
    leave_type: string
    total: number
    used: number
    pending: number
}

type Request = {
    id: string
    leave_type: string
    start_date: string
    end_date: string
    day_type: string
    reason: string | null
    status: string
}

const COLORS: Record<string, string> = {
    annual: "#7C6F5E",
    sick: "#E97766",
    maternity: "#A78BCA",
    paternity: "#6B9AC4",
}

interface Props {
    balances: Balance[]
    requests: Request[]
}

export default function LeaveClient({ balances, requests }: Props) {
    const [filter, setFilter] = useState("all")
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleDownload = (id: string) => {
        window.open(`/api/leave-pdf/${id}`, '_blank')
    }

    const handleWithdraw = (id: string) => {
        if (!confirm("Are you sure you want to withdraw this request?")) return
        startTransition(async () => {
            const { success, error } = await withdrawLeave(id)
            if (success) {
                toast.success("Leave request withdrawn.")
                router.refresh()
            } else {
                toast.error(error || "Withdrawal failed")
            }
        })
    }

    const filtered = filter === "all"
        ? requests
        : requests.filter(r => r.status === filter)

    const fmt = (d: string) =>
        new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
                    <p className="text-sm text-muted-foreground">View balances and manage your leave requests</p>
                </div>
                <Button className="rounded-xl gap-2" asChild>
                    <Link href="/leave/new"><Plus className="h-4 w-4" />New Request</Link>
                </Button>
            </div>

            {/* Balance Cards */}
            {balances.length > 0 && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {balances.map((lb) => {
                        const carried = Number((lb as any).carried_forward ?? 0)
                        const effectiveTotal = Number(lb.total) + carried
                        const remaining = Math.max(0, effectiveTotal - Number(lb.used) - Number(lb.pending))
                        const pct = effectiveTotal > 0
                            ? ((Number(lb.used) + Number(lb.pending)) / effectiveTotal) * 100
                            : 0
                        const color = COLORS[lb.leave_type] ?? "#7C6F5E"
                        return (
                            <Card key={lb.id} className="rounded-2xl border-border shadow-sm">
                                <CardContent className="p-4 space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider capitalize">
                                        {lb.leave_type}
                                    </p>
                                    <div className="flex items-end gap-1">
                                        <span className="text-2xl font-bold text-foreground">{remaining}</span>
                                        <span className="text-xs text-muted-foreground pb-0.5">/ {effectiveTotal} days</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-2 w-full rounded-full bg-muted">
                                            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>{lb.used} used</span>
                                            {Number(lb.pending) > 0 && <span>{lb.pending} pending</span>}
                                            {carried > 0 && <span>{carried} carried</span>}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Requests */}
            <Card className="rounded-2xl border-border shadow-sm">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
                    <CardTitle className="text-base font-semibold">My Requests</CardTitle>
                    <div className="flex gap-1.5 flex-wrap">
                        {["all", "pending", "approved", "rejected"].map((f) => (
                            <Button
                                key={f}
                                variant={filter === f ? "default" : "outline"}
                                size="sm"
                                className="rounded-full text-xs capitalize h-7 px-3"
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    {filtered.length === 0 ? (
                        <EmptyState
                            icon={<CalendarDays className="h-7 w-7 text-muted-foreground" />}
                            title={filter === "all" ? "No leave requests" : `No ${filter} requests`}
                            description={filter === "all"
                                ? "Submit your first leave request using the button above."
                                : "No requests match this filter."}
                            action={filter === "all"
                                ? <Button asChild className="rounded-xl"><Link href="/leave/new">New Request</Link></Button>
                                : undefined}
                        />
                    ) : (
                        <div className="space-y-3">
                            {filtered.map((req) => (
                                <div key={req.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground capitalize">{req.leave_type} Leave</span>
                                            <StatusBadge status={req.status} />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {fmt(req.start_date)}
                                            {req.start_date !== req.end_date && <> – {fmt(req.end_date)}</>}
                                            {req.day_type !== "full" && ` (${req.day_type === "half_am" ? "Morning" : "Afternoon"})`}
                                        </p>
                                        {req.reason && <p className="text-xs text-muted-foreground">{req.reason}</p>}
                                    </div>
                                    <div className="flex gap-2 shrink-0 mt-3 sm:mt-0">
                                        {req.status === 'approved' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownload(req.id)}
                                                className="gap-1.5 rounded-xl"
                                            >
                                                <FileDown className="h-4 w-4" /> Download Form
                                            </Button>
                                        )}
                                        {(req.status === 'pending' || req.status === 'approved') && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleWithdraw(req.id)}
                                                disabled={isPending}
                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            >
                                                <X className="h-4 w-4 mr-1" /> Withdraw
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
