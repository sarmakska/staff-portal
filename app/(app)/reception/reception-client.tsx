"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Contact, Clock, Users, Building, AlertCircle, Plus, Timer, UserCheck, UserX, Home, Plane } from "lucide-react"
import { toast } from "sonner"
import { checkinVisitor, checkoutVisitor, registerWalkInVisitor } from "@/lib/actions/visitors"
import { cancelVisitorBooking } from "@/lib/actions/reception"
import { logRunningLate } from "@/lib/actions/attendance"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import React from "react"

interface Visitor {
    id: string
    visitor_name: string
    company: string | null
    host_name: string
    time_window_start: string
    time_window_end: string
    status: string
    guest_count: number
    requires_id: boolean
    checked_in_at: string | null
    checked_out_at: string | null
}

interface Staff {
    id: string
    full_name: string
}

interface StaffLogEntry {
    id: string
    name: string
    job_title: string | null
    department: string | null
    status: 'in_office' | 'clocked_out' | 'wfh' | 'on_leave' | 'not_in'
    clock_in: string | null
    clock_out: string | null
    leave_type: string | null
}

interface Props {
    visitors: Visitor[]
    staffList: Staff[]
    receptionistName: string
    staffLog: StaffLogEntry[]
}

const STAFF_STATUS_STYLES: Record<string, { icon: React.ElementType; pill: string; dot: string }> = {
    in_office:   { icon: UserCheck, pill: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",   dot: "bg-green-100 text-green-700" },
    clocked_out: { icon: UserX,    pill: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",      dot: "bg-slate-100 text-slate-600" },
    wfh:         { icon: Home,     pill: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",       dot: "bg-blue-100 text-blue-700" },
    on_leave:    { icon: Plane,    pill: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300", dot: "bg-orange-100 text-orange-700" },
    not_in:      { icon: UserX,    pill: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",           dot: "bg-red-100 text-red-600" },
}

const STAFF_STATUS_LABEL: Record<string, string> = {
    in_office: 'In Office',
    clocked_out: 'Clocked Out',
    wfh: 'WFH',
    on_leave: 'On Leave',
    not_in: 'Not In',
}

export default function ReceptionClient({ visitors, staffList, receptionistName, staffLog }: Props) {
    const router = useRouter()
    const [filter, setFilter] = useState("all")
    const [isPending, startTransition] = useTransition()
    const [staffFilter, setStaffFilter] = useState("all")

    // Walk-in Dialog State
    const [showWalkIn, setShowWalkIn] = useState(false)
    const [wiName, setWiName] = useState("")
    const [wiPhone, setWiPhone] = useState("")
    const [wiCompany, setWiCompany] = useState("")
    const [wiHost, setWiHost] = useState("")

    // Late Arrival Dialog State
    const [showLate, setShowLate] = useState(false)
    const [lateEmployee, setLateEmployee] = useState("")
    const [lateExpected, setLateExpected] = useState("")
    const [lateReason, setLateReason] = useState("")

    const filtered = filter === "all"
        ? visitors
        : visitors.filter(v => v.status === filter)

    const filteredStaff = staffFilter === 'all' ? staffLog : staffLog.filter(s => s.status === staffFilter)

    const handleAction = (id: string, action: 'checkin' | 'checkout' | 'cancel') => {
        startTransition(async () => {
            let res;
            if (action === 'checkin') res = await checkinVisitor(id)
            else if (action === 'checkout') res = await checkoutVisitor(id)
            else res = await cancelVisitorBooking(id)

            if (res.success) {
                toast.success(`Visitor ${action} successful`)
                router.refresh()
            } else {
                toast.error(res.error || "Action failed")
            }
        })
    }

    const handleWalkIn = () => {
        if (!wiName.trim() || !wiHost) {
            toast.error("Name and Host are required")
            return
        }
        startTransition(async () => {
            const res = await registerWalkInVisitor({
                visitor_name: wiName,
                visitor_phone: wiPhone,
                company: wiCompany,
                host_user_id: wiHost,
            })
            if (res.success) {
                toast.success("Walk-in registered and checked in!")
                setShowWalkIn(false)
                setWiName(""); setWiPhone(""); setWiCompany(""); setWiHost("");
                router.refresh()
            } else {
                toast.error(res.error || "Failed to register walk-in")
            }
        })
    }

    const handleLateArrival = () => {
        if (!lateEmployee) {
            toast.error("Please select an employee")
            return
        }
        startTransition(async () => {
            const res = await logRunningLate(lateEmployee, lateReason || undefined, lateExpected || undefined, receptionistName)
            if (res.success) {
                toast.success("Late arrival logged and notification sent")
                setShowLate(false)
                setLateEmployee(""); setLateExpected(""); setLateReason("")
                router.refresh()
            } else {
                toast.error(res.error || "Failed to log late arrival")
            }
        })
    }

    const fmtTime = (t: string) => {
        if (!t) return ""
        return new Date(`1970-01-01T${t}`).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    }

    const fmtFullTime = (t: string | null) => {
        if (!t) return "—"
        return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    }

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Reception</h1>
                    <p className="text-base font-medium text-muted-foreground mt-1">Manage today's expected visitors and walk-ins.</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Late Arrival Button */}
                    <Dialog open={showLate} onOpenChange={setShowLate}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="rounded-xl gap-2 font-semibold shadow-sm border-amber-300 text-amber-700 hover:bg-amber-50">
                                <Timer className="h-4 w-4" /> Log Late Arrival
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Timer className="h-5 w-5 text-amber-600" /> Log Late Arrival
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Employee *</Label>
                                    <Select value={lateEmployee || "none"} onValueChange={v => setLateEmployee(v === "none" ? "" : v)}>
                                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select employee" /></SelectTrigger>
                                        <SelectContent>
                                            {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Expected Arrival Time</Label>
                                    <Input
                                        type="time"
                                        value={lateExpected}
                                        onChange={e => setLateExpected(e.target.value)}
                                        className="rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Reason (Optional)</Label>
                                    <Textarea
                                        value={lateReason}
                                        onChange={e => setLateReason(e.target.value)}
                                        placeholder="e.g. Train delay, appointment..."
                                        className="rounded-xl resize-none"
                                        rows={3}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    An email notification will be sent to management. Logged by: <strong>{receptionistName}</strong>
                                </p>
                                <Button
                                    onClick={handleLateArrival}
                                    disabled={isPending || !lateEmployee}
                                    className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                                >
                                    {isPending ? "Logging..." : "Log Late Arrival & Notify"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Walk-in Button */}
                    <Dialog open={showWalkIn} onOpenChange={setShowWalkIn}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl gap-2 font-semibold shadow-sm">
                                <Plus className="h-4 w-4" /> Register Walk-In
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Register Walk-In Visitor</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Visitor Name *</Label>
                                    <Input value={wiName} onChange={(e) => setWiName(e.target.value)} placeholder="John Doe" className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input type="tel" value={wiPhone} onChange={(e) => setWiPhone(e.target.value)} placeholder="+44 7700 900000" className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Company (Optional)</Label>
                                    <Input value={wiCompany} onChange={(e) => setWiCompany(e.target.value)} placeholder="Acme Corp" className="rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Host *</Label>
                                    <Select value={wiHost || "none"} onValueChange={v => setWiHost(v === "none" ? "" : v)}>
                                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select staff member" /></SelectTrigger>
                                        <SelectContent>
                                            {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleWalkIn} disabled={isPending || !wiName || !wiHost} className="w-full rounded-xl">
                                    {isPending ? "Registering..." : "Register & Check In"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Contact className="h-5 w-5 text-brand-taupe" /> Today's Visitor Log
                    </CardTitle>
                    <div className="flex bg-muted/50 p-1 rounded-xl">
                        {["all", "booked", "checked_in", "checked_out"].map(f => (
                            <Button
                                key={f}
                                variant={filter === f ? "default" : "ghost"}
                                size="sm"
                                className={`rounded-lg capitalize text-xs px-4 ${filter === f ? "shadow-sm" : ""}`}
                                onClick={() => setFilter(f)}
                            >
                                {f.replace("_", " ")}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    {filtered.length === 0 ? (
                        <EmptyState
                            icon={<Contact className="h-8 w-8 text-muted-foreground" />}
                            title="No visitors"
                            description={`No visitors found for status: ${filter.replace("_", " ")}`}
                        />
                    ) : (
                        <div className="space-y-3">
                            {filtered.map(v => (
                                <div key={v.id} className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors shadow-sm">
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start md:items-center">
                                        <div>
                                            <h4 className="font-semibold text-foreground text-sm">{v.visitor_name}</h4>
                                            {v.company && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                    <Building className="h-3 w-3 shrink-0" /> {v.company}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Host</p>
                                            <p className="text-sm font-medium text-foreground mt-0.5">{v.host_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-brand-taupe" /> {fmtTime(v.time_window_start)} - {fmtTime(v.time_window_end)}
                                            </p>
                                            {(v.guest_count > 1 || v.requires_id) && (
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    {v.guest_count > 1 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-800 border-none"><Users className="h-2.5 w-2.5 mr-1" /> +{v.guest_count - 1}</Badge>}
                                                    {v.requires_id && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-red-100 text-red-800 border-none"><AlertCircle className="h-2.5 w-2.5 mr-1" /> ID Req</Badge>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 items-start md:items-end">
                                            <StatusBadge status={v.status} />
                                            {v.status === 'checked_in' && v.checked_in_at && <span className="text-[10px] text-muted-foreground">In: {fmtFullTime(v.checked_in_at)}</span>}
                                            {v.status === 'checked_out' && v.checked_out_at && <span className="text-[10px] text-muted-foreground">Out: {fmtFullTime(v.checked_out_at)}</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        {v.status === 'booked' && (
                                            <Button size="sm" variant="default" className="w-full md:w-auto rounded-lg text-xs" onClick={() => handleAction(v.id, 'checkin')} disabled={isPending}>
                                                Check In
                                            </Button>
                                        )}
                                        {v.status === 'checked_in' && (
                                            <Button size="sm" variant="outline" className="w-full md:w-auto rounded-lg text-xs" onClick={() => handleAction(v.id, 'checkout')} disabled={isPending}>
                                                Check Out
                                            </Button>
                                        )}
                                        {v.status === 'booked' && (
                                            <Button size="sm" variant="ghost" className="w-full md:w-auto rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleAction(v.id, 'cancel')} disabled={isPending}>
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Staff Log */}
            <Card className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" /> Today's Staff Log
                    </CardTitle>
                    <div className="flex flex-wrap bg-muted/50 p-1 rounded-xl gap-0.5">
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'in_office', label: 'In Office' },
                            { key: 'wfh', label: 'WFH' },
                            { key: 'on_leave', label: 'On Leave' },
                            { key: 'not_in', label: 'Not In' },
                        ].map(f => (
                            <Button
                                key={f.key}
                                variant={staffFilter === f.key ? "default" : "ghost"}
                                size="sm"
                                className={`rounded-lg text-xs px-3 ${staffFilter === f.key ? "shadow-sm" : ""}`}
                                onClick={() => setStaffFilter(f.key)}
                            >
                                {f.label}
                                <span className="ml-1.5 text-[10px] opacity-70">
                                    {f.key === 'all' ? staffLog.length : staffLog.filter(s => s.status === f.key).length}
                                </span>
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredStaff.length === 0 ? (
                        <EmptyState
                            icon={<Users className="h-8 w-8 text-muted-foreground" />}
                            title="No staff"
                            description="No staff found for this filter"
                        />
                    ) : (
                        <div className="divide-y divide-border/40">
                            {filteredStaff.map(s => {
                                const { icon: StatusIcon, pill, dot } = STAFF_STATUS_STYLES[s.status]
                                const fmtT = (t: string | null) => t ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'
                                return (
                                    <div key={s.id} className="flex items-center justify-between py-3 gap-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dot}`}>
                                                {s.name.charAt(0).toUpperCase()}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{s.job_title ?? s.department ?? '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {(s.status === 'in_office' || s.status === 'clocked_out') && (
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-xs text-muted-foreground">In: <span className="text-foreground font-medium">{fmtT(s.clock_in)}</span></p>
                                                    {s.status === 'clocked_out' && <p className="text-xs text-muted-foreground">Out: <span className="text-foreground font-medium">{fmtT(s.clock_out)}</span></p>}
                                                </div>
                                            )}
                                            {s.status === 'on_leave' && s.leave_type && (
                                                <span className="text-xs text-muted-foreground hidden sm:block capitalize">{s.leave_type} leave</span>
                                            )}
                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill}`}>
                                                <StatusIcon className="h-3 w-3" />
                                                {STAFF_STATUS_LABEL[s.status]}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
