"use client"

import { useState, useTransition } from "react"
import { Check, X, ClipboardList, Send } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { approveLeave, rejectLeave, approveCorrection, rejectCorrection, resendLeaveNotification } from "@/lib/actions/approvals"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface Props {
    leaveRequests: any[]
    corrections: any[]
    isAdmin: boolean
}

export default function ApprovalsClient({ leaveRequests, corrections, isAdmin }: Props) {
    const total = leaveRequests.length + corrections.length
    const [rejectItem, setRejectItem] = useState<{ id: string, type: 'leave' | 'correction' } | null>(null)
    const [rejectReason, setRejectReason] = useState("")
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const fmt = (d: string) =>
        new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

    // Format a correction value (either full ISO or "HH:MM") as a readable time
    const fmtTime = (val: string | null) => {
        if (!val) return "—"
        if (val.includes("T")) return new Date(val).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        return val // already "HH:MM"
    }

    const handleAction = (id: string, type: 'leave' | 'correction', action: 'approve' | 'reject') => {
        if (action === 'reject') {
            setRejectItem({ id, type })
            setRejectReason("")
            return
        }

        startTransition(async () => {
            const result = type === 'leave' ? await approveLeave(id) : await approveCorrection(id)
            if (!result.success) { toast.error(result.error ?? "Failed to approve"); return }
            toast.success("Approved successfully")
            router.refresh()
        })
    }

    const confirmReject = () => {
        if (!rejectItem) return
        if (rejectItem.type === 'leave' && !rejectReason.trim()) {
            toast.error("Please provide a rejection reason.")
            return
        }

        startTransition(async () => {
            const result = rejectItem.type === 'leave'
                ? await rejectLeave(rejectItem.id, rejectReason.trim() || "Declined by approver")
                : await rejectCorrection(rejectItem.id)
            if (!result.success) { toast.error(result.error ?? "Failed to reject"); return }
            toast.success("Rejected successfully")
            setRejectItem(null)
            router.refresh()
        })
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
                <p className="text-sm text-muted-foreground">
                    {total} item{total !== 1 ? "s" : ""} pending review
                </p>
            </div>

            {total === 0 ? (
                <EmptyState
                    icon={<ClipboardList className="h-7 w-7 text-muted-foreground" />}
                    title="No pending approvals"
                    description="All leave requests and corrections are up to date."
                />
            ) : (
                <>
                    {leaveRequests.length > 0 && (
                        <Card className="rounded-2xl border-border shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-semibold">Leave Requests ({leaveRequests.length})</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {leaveRequests.map((r: any) => (
                                    <div key={r.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-foreground">{r.user?.full_name ?? r.user?.email}</p>
                                            <StatusBadge status={r.status} />
                                        </div>
                                        <p className="text-xs text-muted-foreground capitalize">
                                            {r.leave_type.replace("_", " ")} leave · {fmt(r.start_date)}
                                            {r.start_date !== r.end_date ? ` – ${fmt(r.end_date)}` : ""}
                                            {" · "}{r.days_count} day{r.days_count !== 1 ? "s" : ""}
                                        </p>
                                        {r.reason && <p className="text-xs text-muted-foreground italic">"{r.reason}"</p>}
                                        <div className="flex gap-2 pt-1 flex-wrap">
                                            <Button size="sm" onClick={() => handleAction(r.id, 'leave', 'approve')} disabled={isPending} className="rounded-xl gap-1 h-8">
                                                <Check className="h-3 w-3" />Approve
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleAction(r.id, 'leave', 'reject')} disabled={isPending} className="rounded-xl gap-1 h-8 text-destructive border-destructive/30 hover:bg-destructive/10">
                                                <X className="h-3 w-3" />Reject
                                            </Button>
                                            {isAdmin && (
                                                <Button size="sm" variant="outline" disabled={isPending} className="rounded-xl gap-1 h-8 text-muted-foreground" onClick={async () => {
                                                    const result = await resendLeaveNotification(r.id)
                                                    if (result.success) toast.success("Notification resent to approver")
                                                    else toast.error(result.error ?? "Failed to resend")
                                                }}>
                                                    <Send className="h-3 w-3" />Resend
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {corrections.length > 0 && (
                        <Card className="rounded-2xl border-border shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-semibold">Corrections ({corrections.length})</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {corrections.map((c: any) => (
                                    <div key={c.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-foreground">{c.user?.full_name ?? c.user?.email}</p>
                                            <StatusBadge status={c.status} />
                                        </div>
                                        <p className="text-xs text-muted-foreground capitalize">
                                            {c.field?.replace("_", " ")} on {c.attendance?.work_date ? fmt(c.attendance.work_date) : "unknown date"}
                                            {c.original_value ? ` · ${fmtTime(c.original_value)} → ${fmtTime(c.proposed_value)}` : ` → ${fmtTime(c.proposed_value)}`}
                                        </p>
                                        {c.reason && <p className="text-xs text-muted-foreground italic">"{c.reason}"</p>}
                                        <div className="flex gap-2 pt-1">
                                            <Button size="sm" onClick={() => handleAction(c.id, 'correction', 'approve')} disabled={isPending} className="rounded-xl gap-1 h-8">
                                                <Check className="h-3 w-3" />Approve
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleAction(c.id, 'correction', 'reject')} disabled={isPending} className="rounded-xl gap-1 h-8 text-destructive border-destructive/30 hover:bg-destructive/10">
                                                <X className="h-3 w-3" />Reject
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            <Dialog open={!!rejectItem} onOpenChange={(open) => !open && setRejectItem(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reject Request</DialogTitle>
                        <DialogDescription>
                            {rejectItem?.type === 'leave' ? "Please provide a reason for rejecting this leave request. The employee will see this reason." : "Are you sure you want to reject this correction request?"}
                        </DialogDescription>
                    </DialogHeader>
                    {rejectItem?.type === 'leave' && (
                        <div className="py-2">
                            <Input
                                placeholder="E.g., No cover available for these dates"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}
                    <DialogFooter className="sm:justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setRejectItem(null)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={confirmReject} disabled={isPending}>
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
