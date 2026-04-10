"use client"

import { useState, useTransition } from "react"
import { deleteAttendanceRecord, forceClockOut } from "@/lib/actions/attendance"
import { toast } from "sonner"
import { Trash2, LogOut, Users, UserCheck, UserX } from "lucide-react"

type AttendanceRecord = {
    id: string
    full_name: string
    department_name: string | null
    is_clocked_in: boolean
    clock_in_time: string | null
    attendance_record_id: string | null
}

function Initials({ name }: { name: string }) {
    const parts = name.trim().split(" ")
    const ini = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")
    return (
        <div className="h-8 w-8 rounded-full bg-brand-taupe/20 text-brand-taupe flex items-center justify-center text-xs font-bold shrink-0 uppercase">
            {ini || "?"}
        </div>
    )
}

export function AdminAttendanceClient({ initialData }: { initialData: AttendanceRecord[] }) {
    const [isPending, startTransition] = useTransition()
    const [data, setData] = useState(initialData)

    const clockedIn = data.filter(d => d.is_clocked_in).length
    const checkedOut = data.filter(d => !d.is_clocked_in).length

    const handleDelete = (recordId: string, fullName: string) => {
        if (!confirm(`Delete today's clock-in for ${fullName}?`)) return
        startTransition(async () => {
            const res = await deleteAttendanceRecord(recordId)
            if (res.success) {
                toast.success(`Deleted clock-in for ${fullName}`)
                setData(prev => prev.map(p => p.attendance_record_id === recordId
                    ? { ...p, is_clocked_in: false, clock_in_time: null, attendance_record_id: null }
                    : p))
            } else {
                toast.error(res.error || "Failed to delete record")
            }
        })
    }

    const handleForceOut = (recordId: string, fullName: string) => {
        if (!confirm(`Force clock-out ${fullName}?`)) return
        startTransition(async () => {
            const res = await forceClockOut(recordId)
            if (res.success) {
                toast.success(`Forced clock-out for ${fullName}`)
                setData(prev => prev.map(p => p.attendance_record_id === recordId
                    ? { ...p, is_clocked_in: false }
                    : p))
            } else {
                toast.error(res.error || "Failed to force clock-out")
            }
        })
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Staff</p>
                        <p className="text-sm font-extrabold text-foreground">{data.length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5">
                    <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-wider">Clocked In</p>
                        <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{clockedIn}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Not In</p>
                        <p className="text-sm font-extrabold text-foreground">{checkedOut}</p>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                {data.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                        No staff records available.
                    </div>
                ) : (
                    <div className="divide-y divide-border/30">
                        {data.map((staff) => {
                            const time = staff.clock_in_time
                                ? new Date(staff.clock_in_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                                : null

                            return (
                                <div
                                    key={staff.id}
                                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/10 transition-colors group"
                                >
                                    {/* Avatar */}
                                    <Initials name={staff.full_name} />

                                    {/* Name + dept */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground leading-tight">{staff.full_name}</p>
                                        {staff.department_name && (
                                            <p className="text-[11px] text-muted-foreground">{staff.department_name}</p>
                                        )}
                                    </div>

                                    {/* Clock-in time */}
                                    <div className="w-16 text-right shrink-0">
                                        {time ? (
                                            <span className="text-sm font-bold text-foreground tabular-nums">{time}</span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground/40">—</span>
                                        )}
                                    </div>

                                    {/* Status badge */}
                                    <div className="w-28 flex justify-end shrink-0">
                                        {staff.is_clocked_in ? (
                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Clocked In
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                                Not In
                                            </span>
                                        )}
                                    </div>

                                    {/* Actions — hover only */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-16 justify-end">
                                        {staff.is_clocked_in && staff.attendance_record_id && (
                                            <>
                                                <button
                                                    onClick={() => handleForceOut(staff.attendance_record_id!, staff.full_name)}
                                                    disabled={isPending}
                                                    title="Force clock-out"
                                                    className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                                >
                                                    <LogOut className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(staff.attendance_record_id!, staff.full_name)}
                                                    disabled={isPending}
                                                    title="Delete entry"
                                                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
