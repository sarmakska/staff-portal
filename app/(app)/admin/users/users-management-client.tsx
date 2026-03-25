"use client"

import { useState, useTransition } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Users, Building2, X, Pencil, UserMinus, UserCheck,
    Trash2, Plus, Shield, Clock,
} from "lucide-react"
import { toast } from "sonner"
import {
    assignRole, removeRole, toggleUserActive, updateUserProfile,
    createDepartment, deleteDepartment, createLocation, deleteLocation,
} from "@/lib/actions/admin"
import { saveWorkScheduleForUser } from "@/lib/actions/schedule"
import { CreateUserModal } from "./create-user-modal"

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const
const DAY_LABELS: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" }
type DayKey = typeof DAY_KEYS[number]

const ALL_ROLES = ["employee", "admin", "director", "accounts", "reception"] as const

interface Profile {
    id: string
    full_name: string
    display_name: string | null
    email: string
    job_title: string | null
    phone: string | null
    department_id: string | null
    is_active: boolean
    user_roles: { role: string }[]
}
interface Department { id: string; name: string; description?: string | null }
interface Location { id: string; name: string; address?: string | null; city?: string | null }
interface Schedule { user_id: string; work_days: string[]; daily_hours: number; hours_by_day: Record<string, number> | null }

interface Props {
    profiles: Profile[]
    departments: Department[]
    locations: Location[]
    schedules: Schedule[]
    currentUserId: string
}

function EditUserModal({
    profile,
    departments,
    schedule,
    onClose,
}: {
    profile: Profile
    departments: Department[]
    schedule: Schedule | null
    onClose: () => void
}) {
    const [isPending, startTransition] = useTransition()
    const [activeTab, setActiveTab] = useState<"profile" | "schedule">("profile")
    const [form, setForm] = useState({
        full_name: profile.full_name ?? "",
        display_name: profile.display_name ?? "",
        job_title: profile.job_title ?? "",
        phone: profile.phone ?? "",
        department_id: profile.department_id ?? "",
    })
    const set = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }))

    // Schedule state — default Mon–Fri, 7.5h each
    const defaultDays = ["mon", "tue", "wed", "thu", "fri"]
    const [checkedDays, setCheckedDays] = useState<Set<string>>(
        new Set(schedule?.work_days?.length ? schedule.work_days : defaultDays)
    )
    const [hoursMap, setHoursMap] = useState<Record<string, string>>(() => {
        const m: Record<string, string> = {}
        for (const d of DAY_KEYS) {
            const v = schedule?.hours_by_day?.[d] ?? schedule?.daily_hours ?? 7.5
            m[d] = String(v)
        }
        return m
    })

    const toggleDay = (d: string) => {
        setCheckedDays(prev => {
            const next = new Set(prev)
            if (next.has(d)) next.delete(d); else next.add(d)
            return next
        })
    }

    const handleSaveProfile = () => {
        if (!form.full_name.trim()) { toast.error("Full name is required"); return }
        startTransition(async () => {
            const result = await updateUserProfile(profile.id, {
                full_name: form.full_name.trim(),
                display_name: form.display_name.trim() || null as any,
                job_title: form.job_title.trim() || null as any,
                phone: form.phone.trim() || null as any,
                department_id: form.department_id || null,
            })
            if (result.success) { toast.success("Profile updated"); onClose() }
            else toast.error(result.error ?? "Failed to update")
        })
    }

    const handleSaveSchedule = () => {
        const days = DAY_KEYS.filter(d => checkedDays.has(d))
        if (days.length === 0) { toast.error("Select at least one working day"); return }
        const hoursByDay: Record<string, number> = {}
        for (const d of days) {
            const v = parseFloat(hoursMap[d])
            if (isNaN(v) || v < 0.5 || v > 24) { toast.error(`Invalid hours for ${DAY_LABELS[d]}`); return }
            hoursByDay[d] = v
        }
        startTransition(async () => {
            const result = await saveWorkScheduleForUser(profile.id, days as any, hoursByDay as any)
            if (result.success) { toast.success("Schedule saved"); onClose() }
            else toast.error(result.error ?? "Failed to save")
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                    <div>
                        <h2 className="text-base font-bold text-foreground">Edit User</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{profile.email}</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border px-6">
                    {([
                        { key: "profile" as const, label: "Profile" },
                        { key: "schedule" as const, label: "Working Hours", icon: Clock },
                    ]).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`flex items-center gap-1.5 py-3 mr-5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                                activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {t.icon && <t.icon className="h-3.5 w-3.5" />}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Profile tab */}
                {activeTab === "profile" && (
                    <>
                        <div className="px-6 py-5 space-y-3">
                            {[
                                { key: "full_name", label: "Full Name *", placeholder: "Jane Smith" },
                                { key: "display_name", label: "Display Name", placeholder: "Jane (optional)" },
                                { key: "job_title", label: "Job Title", placeholder: "Sales Assistant" },
                                { key: "phone", label: "Phone", placeholder: "+44 7700 900000" },
                            ].map(({ key, label, placeholder }) => (
                                <div key={key} className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground">{label}</label>
                                    <Input
                                        value={(form as any)[key]}
                                        onChange={e => set(key, e.target.value)}
                                        placeholder={placeholder}
                                        className="rounded-xl h-10"
                                    />
                                </div>
                            ))}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-foreground">Department</label>
                                <select
                                    value={form.department_id}
                                    onChange={e => set("department_id", e.target.value)}
                                    className="w-full rounded-xl h-10 px-3 border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">— None —</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                            <Button variant="outline" onClick={onClose} disabled={isPending} className="rounded-xl">Cancel</Button>
                            <Button onClick={handleSaveProfile} disabled={isPending} className="rounded-xl">
                                {isPending ? "Saving…" : "Save Changes"}
                            </Button>
                        </div>
                    </>
                )}

                {/* Schedule tab */}
                {activeTab === "schedule" && (
                    <>
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-xs text-muted-foreground">
                                Set which days this employee works and how many hours per day. Used for leave calculations, attendance analytics, and under/over hours tracking.
                            </p>
                            <div className="space-y-2">
                                {DAY_KEYS.map(d => (
                                    <div key={d} className={`flex items-center justify-between rounded-xl border px-4 py-2.5 transition-colors ${checkedDays.has(d) ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}>
                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={checkedDays.has(d)}
                                                onChange={() => toggleDay(d)}
                                                className="h-4 w-4 rounded accent-primary"
                                            />
                                            <span className="text-sm font-medium text-foreground">{DAY_LABELS[d]}</span>
                                        </label>
                                        {checkedDays.has(d) && (
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min={0.5} max={24} step={0.5}
                                                    value={hoursMap[d]}
                                                    onChange={e => setHoursMap(prev => ({ ...prev, [d]: e.target.value }))}
                                                    className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-sm text-center text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                                <span className="text-xs text-muted-foreground">hrs</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {checkedDays.size > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Total: <strong>{Array.from(checkedDays).reduce((s, d) => s + (parseFloat(hoursMap[d]) || 0), 0).toFixed(1)}h/week</strong> across {checkedDays.size} day{checkedDays.size !== 1 ? "s" : ""}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                            <Button variant="outline" onClick={onClose} disabled={isPending} className="rounded-xl">Cancel</Button>
                            <Button onClick={handleSaveSchedule} disabled={isPending} className="rounded-xl">
                                {isPending ? "Saving…" : "Save Schedule"}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

function UserCard({ p, departments, schedule, currentUserId }: { p: Profile; departments: Department[]; schedule: Schedule | null; currentUserId: string }) {
    const [editOpen, setEditOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const name = p.display_name || p.full_name || "—"
    const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    const userRoles: string[] = (p.user_roles ?? []).map((r: any) => r.role)
    const availableRoles = ALL_ROLES.filter(r => !userRoles.includes(r))
    const isSelf = p.id === currentUserId

    const handleToggleActive = () => {
        startTransition(async () => {
            await toggleUserActive(p.id, !p.is_active)
            toast.success(p.is_active ? `${name} deactivated` : `${name} reactivated`)
        })
    }

    return (
        <>
            {editOpen && (
                <EditUserModal profile={p} departments={departments} schedule={schedule} onClose={() => setEditOpen(false)} />
            )}
            <Card className={`rounded-2xl border-border shadow-sm ${!p.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-10 w-10 border border-border shrink-0">
                                <AvatarFallback className="bg-brand-taupe/10 text-brand-taupe text-sm font-semibold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-foreground">{name}</p>
                                    {!p.is_active && (
                                        <Badge variant="destructive" className="text-[10px] rounded-full">Inactive</Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                                {p.job_title && <p className="text-xs text-muted-foreground">{p.job_title}</p>}
                                {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                                onClick={() => setEditOpen(true)}
                                title="Edit profile"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!isSelf && (
                                <Button
                                    variant="ghost" size="icon"
                                    disabled={isPending}
                                    onClick={handleToggleActive}
                                    title={p.is_active ? "Deactivate (kick out)" : "Reactivate"}
                                    className={`h-8 w-8 rounded-xl ${p.is_active ? "text-muted-foreground hover:text-destructive" : "text-emerald-500 hover:text-emerald-600"}`}
                                >
                                    {p.is_active ? <UserMinus className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Schedule summary */}
                    {schedule && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>
                                {schedule.work_days?.join(", ").toUpperCase()} &middot; {schedule.daily_hours ? `${schedule.daily_hours.toFixed(1)}h/day avg` : "—"}
                            </span>
                        </div>
                    )}

                    {/* Roles */}
                    <div className="flex flex-wrap items-center gap-2">
                        {userRoles.map(r => (
                            <div key={r} className="flex items-center gap-1">
                                <Badge variant="secondary" className="text-[10px] rounded-md capitalize">{r}</Badge>
                                {r !== "employee" && (
                                    <form action={removeRole.bind(null, p.id, r)}>
                                        <button type="submit" className="text-muted-foreground hover:text-destructive transition-colors">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </form>
                                )}
                            </div>
                        ))}
                        {availableRoles.length > 0 && (
                            <form action={assignRole} className="flex items-center gap-1">
                                <input type="hidden" name="userId" value={p.id} />
                                <Select name="role">
                                    <SelectTrigger className="h-6 text-[10px] rounded-md w-28 border-dashed">
                                        <SelectValue placeholder="+ Add role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableRoles.map(r => (
                                            <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button type="submit" size="sm" variant="outline" className="h-6 text-[10px] rounded-md px-2">Add</Button>
                            </form>
                        )}
                    </div>
                </CardContent>
            </Card>
        </>
    )
}

type Tab = "users" | "org"

export function UsersManagementClient({ profiles, departments, locations, schedules, currentUserId }: Props) {
    const scheduleMap = Object.fromEntries(schedules.map(s => [s.user_id, s]))
    const [tab, setTab] = useState<Tab>("users")

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Roles & Users</h1>
                    <p className="text-sm text-muted-foreground">{profiles.length} users registered</p>
                </div>
                {tab === "users" && (
                    <CreateUserModal departments={departments.map(d => ({ id: d.id, name: d.name }))} />
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {([
                    { key: "users" as Tab, label: "Users & Roles", icon: Users },
                    { key: "org" as Tab, label: "Organisation", icon: Building2 },
                ] as const).map(t => {
                    const Icon = t.icon
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                                tab === t.key
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {/* Users & Roles */}
            {tab === "users" && (
                <div className="space-y-4">
                    <div className="bg-brand-taupe/10 border border-brand-taupe/20 rounded-xl p-3 flex items-start gap-3">
                        <Shield className="h-5 w-5 text-brand-taupe shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground">
                            <span className="font-bold text-brand-taupe">Tip:</span> Use <strong>+ Add role</strong> to grant access.
                            Click the <strong>pencil</strong> to edit profile details.
                            Click the <strong>minus icon</strong> to deactivate — they will be signed out and cannot log back in.
                        </p>
                    </div>
                    <div className="space-y-3">
                        {profiles.map((p: any) => (
                            <UserCard key={p.id} p={p} departments={departments} schedule={scheduleMap[p.id] ?? null} currentUserId={currentUserId} />
                        ))}
                    </div>
                </div>
            )}

            {/* Organisation */}
            {tab === "org" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="rounded-2xl border-border shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">Departments ({departments.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {departments.map(d => (
                                <div key={d.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{d.name}</p>
                                        {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                                    </div>
                                    <form action={deleteDepartment.bind(null, d.id)}>
                                        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </form>
                                </div>
                            ))}
                            <form action={createDepartment} className="flex gap-2 pt-1">
                                <Input name="name" placeholder="Department name" className="rounded-xl h-9 text-sm" required />
                                <Input name="description" placeholder="Description (optional)" className="rounded-xl h-9 text-sm" />
                                <Button type="submit" size="sm" className="rounded-xl gap-1 shrink-0">
                                    <Plus className="h-3.5 w-3.5" />Add
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">Locations ({locations.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {locations.map(l => (
                                <div key={l.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{l.name}</p>
                                        {(l.address || l.city) && (
                                            <p className="text-xs text-muted-foreground">{[l.address, l.city].filter(Boolean).join(", ")}</p>
                                        )}
                                    </div>
                                    <form action={deleteLocation.bind(null, l.id)}>
                                        <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </form>
                                </div>
                            ))}
                            <form action={createLocation} className="flex gap-2 pt-1">
                                <Input name="name" placeholder="Location name" className="rounded-xl h-9 text-sm" required />
                                <Input name="city" placeholder="City" className="rounded-xl h-9 text-sm" />
                                <Button type="submit" size="sm" className="rounded-xl gap-1 shrink-0">
                                    <Plus className="h-3.5 w-3.5" />Add
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
