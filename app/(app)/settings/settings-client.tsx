"use client"

import { useState, useTransition, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useTheme } from "next-themes"
import { User, Sun, Moon, Monitor, Edit2, Check, Users, KeyRound, X, Plus, Camera, Loader2, CalendarClock, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateProfile, setApprovers as saveApproversAction, updateKioskPin, clearKioskPin, getAvatarUploadUrl, saveAvatarUrl } from "@/lib/actions/settings"
import { saveWorkSchedule } from "@/lib/actions/schedule"
import type { WorkDayCode, WorkSchedule, HoursByDay } from "@/types/database"
import { useAuth } from "@/lib/providers"

interface Approver {
    id: string
    name: string
    job_title: string | null
    priority: number
}

interface Props {
    profile: {
        id: string
        full_name: string
        display_name: string | null
        email: string
        job_title: string | null
        phone: string | null
        department_id: string | null
        location_id: string | null
        kiosk_pin: string | null
        is_active: boolean
        gender?: string | null
        desk_extension?: string | null
        avatar_url?: string | null
        birthday?: string | null
    } | null
    roles: string[]
    departments: { id: string; name: string }[]
    locations: { id: string; name: string }[]
    currentApprovers: Approver[]
    allUsers: { id: string; full_name: string; display_name: string | null; job_title: string | null }[]
    schedule: WorkSchedule | null
}

function parseBirthday(val: string | null | undefined) {
    if (!val) return { day: "", month: "", year: "" }
    const parts = val.split("-")
    const y = parseInt(parts[0] ?? "0")
    return { day: parts[2] ?? "", month: parts[1] ?? "", year: y <= 1 ? "" : parts[0] ?? "" }
}
function buildBirthdayDate(day: string, month: string, year: string): string | null {
    if (!day || !month) return null
    const y = year || "0001"
    return `${y.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

const ALL_DAYS: { code: WorkDayCode; label: string }[] = [
    { code: "mon", label: "Mon" },
    { code: "tue", label: "Tue" },
    { code: "wed", label: "Wed" },
    { code: "thu", label: "Thu" },
    { code: "fri", label: "Fri" },
    { code: "sat", label: "Sat" },
    { code: "sun", label: "Sun" },
]

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
    return (
        <div className="flex items-start gap-3 mb-5">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
                <p className="text-sm font-bold text-foreground">{title}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
        </div>
    )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between py-2.5 border-b border-border/40 last:border-0">
            <span className="text-xs text-muted-foreground w-32 shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-foreground font-medium text-right flex-1">{value}</span>
        </div>
    )
}

export default function SettingsClient({ profile, roles, departments, locations, currentApprovers, allUsers, schedule }: Props) {
    const { theme, setTheme } = useTheme()
    const { refreshProfile } = useAuth()
    const [editing, setEditing] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [fullName, setFullName] = useState(profile?.full_name ?? "")
    const [displayName, setDisplayName] = useState(profile?.display_name ?? "")
    const [phone, setPhone] = useState(profile?.phone ?? "")
    const [jobTitle, setJobTitle] = useState(profile?.job_title ?? "")
    const [gender, setGender] = useState(profile?.gender ?? "")
    const [deskExtension, setDeskExtension] = useState(profile?.desk_extension ?? "")
    const [departmentId, setDepartmentId] = useState(profile?.department_id ?? "")
    const parsedBday = parseBirthday(profile?.birthday)
    const [bdayDay, setBdayDay] = useState(parsedBday.day)
    const [bdayMonth, setBdayMonth] = useState(parsedBday.month)
    const [bdayYear, setBdayYear] = useState(parsedBday.year)

    const [approvers, setApprovers] = useState<Approver[]>(currentApprovers)
    const [approverSearch, setApproverSearch] = useState("")
    const [savingApprovers, setSavingApprovers] = useState(false)

    const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
    const [uploading, setUploading] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const [pin, setPin] = useState("")
    const [confirmPin, setConfirmPin] = useState("")
    const [hasPin, setHasPin] = useState(!!profile?.kiosk_pin)

    const [workDays, setWorkDays] = useState<WorkDayCode[]>(
        (schedule?.work_days as WorkDayCode[]) ?? ["mon", "tue", "wed", "thu", "fri"]
    )
    const buildInitialHours = (): HoursByDay => {
        const base: HoursByDay = {};
        (schedule?.work_days ?? ["mon", "tue", "wed", "thu", "fri"] as WorkDayCode[]).forEach(d => {
            base[d] = schedule?.hours_by_day?.[d] ?? schedule?.daily_hours ?? 7.5
        })
        return base
    }
    const [hoursByDay, setHoursByDay] = useState<HoursByDay>(buildInitialHours)
    const [savingSchedule, setSavingSchedule] = useState(false)

    const weeklyHours = ALL_DAYS.filter(d => workDays.includes(d.code)).reduce((sum, d) => sum + (hoursByDay[d.code] ?? 7.5), 0)

    const toggleDay = (code: WorkDayCode) => {
        setWorkDays(prev => {
            if (prev.includes(code)) return prev.filter(d => d !== code)
            if (hoursByDay[code] === undefined) setHoursByDay(h => ({ ...h, [code]: 7.5 }))
            return [...prev, code]
        })
    }

    const setDayHours = (code: WorkDayCode, hours: number) => setHoursByDay(prev => ({ ...prev, [code]: hours }))

    const handleSaveSchedule = async () => {
        setSavingSchedule(true)
        const result = await saveWorkSchedule(workDays, hoursByDay)
        setSavingSchedule(false)
        if (result.error) { toast.error(result.error); return }
        toast.success("Work schedule saved")
    }

    const displayLabel = profile?.display_name || profile?.full_name || "—"
    const initials = displayLabel.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    const primaryRole = roles.includes("admin") ? "Admin"
        : roles.includes("director") ? "Director"
        : roles.includes("accounts") ? "Accounts"
        : roles.includes("reception") ? "Reception"
        : "Employee"
    const deptName = departments.find(d => d.id === profile?.department_id)?.name ?? "—"
    const locName = locations.find(l => l.id === profile?.location_id)?.name ?? "—"

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const urlResult = await getAvatarUploadUrl(file.type)
            if (!urlResult.success || !urlResult.signedUrl) { toast.error(urlResult.error ?? "Upload failed"); return }
            const uploadResp = await fetch(urlResult.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
            if (!uploadResp.ok) { toast.error("Upload failed — please try again"); return }
            const saveResult = await saveAvatarUrl(urlResult.publicUrl!)
            if (!saveResult.success) { toast.error(saveResult.error ?? "Failed to save photo"); return }
            setAvatarUrl(saveResult.url ?? null)
            toast.success("Profile photo updated!")
            await refreshProfile()
        } catch {
            toast.error("Upload failed — please try again")
        } finally {
            setUploading(false)
            e.target.value = ""
        }
    }

    const handleSave = () => {
        const formData = new FormData()
        formData.set("full_name", fullName)
        formData.set("display_name", displayName)
        formData.set("phone", phone)
        formData.set("job_title", jobTitle)
        formData.set("gender", gender)
        formData.set("desk_extension", deskExtension)
        formData.set("department_id", departmentId)
        const bday = buildBirthdayDate(bdayDay, bdayMonth, bdayYear)
        if (bday) formData.set("birthday", bday)
        startTransition(async () => {
            const result = await updateProfile(formData)
            if (result.success) { toast.success("Profile updated"); setEditing(false) }
            else toast.error(result.error ?? "Failed to update profile")
        })
    }

    const filteredUsers = allUsers.filter(u =>
        !approvers.find(a => a.id === u.id) &&
        (u.display_name || u.full_name || "").toLowerCase().includes(approverSearch.toLowerCase())
    )

    const addApprover = (user: typeof allUsers[0]) => {
        if (approvers.length >= 3) { toast.error("Maximum 3 approvers"); return }
        setApprovers(prev => [...prev, { id: user.id, name: user.display_name || user.full_name || "Unknown", job_title: user.job_title, priority: prev.length + 1 }])
        setApproverSearch("")
    }

    const removeApprover = (id: string) => setApprovers(prev => prev.filter(a => a.id !== id).map((a, i) => ({ ...a, priority: i + 1 })))

    const saveApprovers = () => {
        setSavingApprovers(true)
        startTransition(async () => {
            const result = await saveApproversAction(approvers.map(a => a.id))
            setSavingApprovers(false)
            if (result?.success) toast.success("Approvers saved")
            else toast.error(result?.error ?? "Failed to save approvers")
        })
    }

    const savePin = () => {
        if (pin !== confirmPin) { toast.error("PINs don't match"); return }
        startTransition(async () => {
            const result = await updateKioskPin(pin)
            if (result.success) { toast.success("Kiosk PIN set"); setHasPin(true); setPin(""); setConfirmPin("") }
            else toast.error(result.error ?? "Failed to set PIN")
        })
    }

    const removePin = () => {
        startTransition(async () => {
            const result = await clearKioskPin()
            if (result.success) { toast.success("Kiosk PIN removed"); setHasPin(false) }
            else toast.error(result.error ?? "Failed to remove PIN")
        })
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

            {/* Page header */}
            <div>
                <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your profile and preferences</p>
            </div>

            {/* ── Profile ── */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                {/* Avatar banner */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4">
                    <div className="flex items-center gap-4">
                        <div className="relative group/avatar shrink-0">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={displayLabel} className="h-16 w-16 rounded-full object-cover border-2 border-border" />
                            ) : (
                                <div className="h-16 w-16 rounded-full bg-brand-taupe/20 text-brand-taupe flex items-center justify-center font-bold text-xl">
                                    {initials}
                                </div>
                            )}
                            <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                                title="Change photo"
                            >
                                {uploading ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Camera className="h-4 w-4 text-white" />}
                            </button>
                            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
                        </div>
                        <div>
                            <p className="text-base font-bold text-foreground leading-tight">{displayLabel}</p>
                            <p className="text-sm text-muted-foreground">{profile?.job_title ?? "—"}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{primaryRole}</span>
                                <span className="text-[11px] text-muted-foreground">{deptName} · {locName}</span>
                            </div>
                        </div>
                    </div>
                    {!editing ? (
                        <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-8 shrink-0" onClick={() => setEditing(true)}>
                            <Edit2 className="h-3.5 w-3.5" />Edit
                        </Button>
                    ) : (
                        <div className="flex gap-2 shrink-0">
                            <Button variant="outline" size="sm" className="rounded-xl h-8" onClick={() => setEditing(false)} disabled={isPending}>Cancel</Button>
                            <Button size="sm" className="rounded-xl gap-1.5 h-8" onClick={handleSave} disabled={isPending}>
                                <Check className="h-3.5 w-3.5" />{isPending ? "Saving…" : "Save"}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="border-t border-border/50 px-5 py-4">
                    {editing ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Full Name *</Label>
                                <Input value={fullName} onChange={e => setFullName(e.target.value)} className="rounded-xl h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Display Name</Label>
                                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Leave blank to use full name" className="rounded-xl h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Job Title</Label>
                                <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="rounded-xl h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Phone</Label>
                                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 000000" className="rounded-xl h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Department</Label>
                                <Select value={departmentId || "none"} onValueChange={v => setDepartmentId(v === "none" ? "" : v)}>
                                    <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder="Select department" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Desk Extension</Label>
                                <Input value={deskExtension} onChange={e => setDeskExtension(e.target.value)} placeholder="e.g. 104" className="rounded-xl h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Gender</Label>
                                <Select value={gender || "none"} onValueChange={v => setGender(v === "none" ? "" : v)}>
                                    <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder="Select gender" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Prefer not to say</SelectItem>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label className="text-xs">Birthday</Label>
                                <div className="flex gap-2">
                                    <Select value={bdayDay} onValueChange={setBdayDay}>
                                        <SelectTrigger className="rounded-xl h-9 flex-1"><SelectValue placeholder="Day" /></SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                <SelectItem key={d} value={String(d).padStart(2, "0")}>{d}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={bdayMonth} onValueChange={setBdayMonth}>
                                        <SelectTrigger className="rounded-xl h-9 flex-1"><SelectValue placeholder="Month" /></SelectTrigger>
                                        <SelectContent>
                                            {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                                                <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={bdayYear || "none"} onValueChange={v => setBdayYear(v === "none" ? "" : v)}>
                                        <SelectTrigger className="rounded-xl h-9 w-[110px]"><SelectValue placeholder="Year (opt.)" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Not set</SelectItem>
                                            {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 16 - i).map(y => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <p className="text-[11px] text-muted-foreground">Year is optional — used for birthday reminders only</p>
                            </div>
                            <div className="sm:col-span-2 rounded-xl bg-muted/40 px-3 py-2.5">
                                <p className="text-xs text-muted-foreground">Email: <span className="text-foreground font-medium">{profile?.email ?? "—"}</span> <span className="text-muted-foreground">(contact admin to change)</span></p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <FieldRow label="Email" value={profile?.email ?? "—"} />
                            <FieldRow label="Phone" value={profile?.phone || <span className="text-muted-foreground">Not set</span>} />
                            <FieldRow label="Roles" value={<span className="capitalize">{roles.join(", ") || "Employee"}</span>} />
                            <FieldRow label="Status" value={profile?.is_active ? <span className="text-emerald-600 font-semibold">Active</span> : <span className="text-muted-foreground">Inactive</span>} />
                            {profile?.desk_extension && <FieldRow label="Desk Ext." value={profile.desk_extension} />}
                            {profile?.birthday && (() => {
                                const p = parseBirthday(profile.birthday)
                                const months = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
                                const label = p.year
                                    ? `${parseInt(p.day)} ${months[parseInt(p.month)]} ${p.year}`
                                    : `${parseInt(p.day)} ${months[parseInt(p.month)]}`
                                return <FieldRow label="Birthday" value={`🎂 ${label}`} />
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Leave Approvers ── */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm px-5 py-5">
                <SectionHeader icon={Users} title="Leave Approvers" description="Up to 3 people who can approve your leave. Priority 1 is asked first." />

                {approvers.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 mb-3">
                        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">⚠ No approvers set — you won&apos;t be able to submit leave requests until you add one.</p>
                    </div>
                ) : (
                    <div className="space-y-2 mb-3">
                        {approvers.map(a => (
                            <div key={a.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                                <div className="flex items-center gap-3">
                                    <span className="h-6 w-6 rounded-full bg-brand-taupe/15 text-brand-taupe text-xs font-bold flex items-center justify-center shrink-0">
                                        {a.priority}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{a.name}</p>
                                        {a.job_title && <p className="text-[11px] text-muted-foreground">{a.job_title}</p>}
                                    </div>
                                </div>
                                <button onClick={() => removeApprover(a.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors" title="Remove">
                                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {approvers.length < 3 && (
                    <div className="space-y-2 mb-4">
                        <Input
                            placeholder="Search staff to add as approver…"
                            value={approverSearch}
                            onChange={e => setApproverSearch(e.target.value)}
                            className="rounded-xl h-9"
                        />
                        {approverSearch && filteredUsers.length > 0 && (
                            <div className="rounded-xl border border-border divide-y divide-border/50 overflow-hidden max-h-40 overflow-y-auto">
                                {filteredUsers.slice(0, 6).map(u => (
                                    <button key={u.id} className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors" onClick={() => addApprover(u)}>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{u.display_name || u.full_name}</p>
                                            {u.job_title && <p className="text-[11px] text-muted-foreground">{u.job_title}</p>}
                                        </div>
                                        <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <Button size="sm" className="rounded-xl" onClick={saveApprovers} disabled={isPending || savingApprovers}>
                    <Check className="h-3.5 w-3.5 mr-1.5" />{savingApprovers ? "Saving…" : "Save Approvers"}
                </Button>
            </div>

            {/* ── Work Schedule ── */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm px-5 py-5">
                <SectionHeader icon={CalendarClock} title="Work Schedule" description="Set your working days and contracted hours. Used for timesheets and staff summary." />

                {/* Day toggles */}
                <div className="flex gap-2 flex-wrap mb-5">
                    {ALL_DAYS.map(({ code, label }) => (
                        <button
                            key={code}
                            type="button"
                            onClick={() => toggleDay(code)}
                            className={`h-9 w-12 rounded-xl border text-sm font-semibold transition-colors ${
                                workDays.includes(code)
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Per-day hours */}
                {workDays.length > 0 && (
                    <div className="rounded-xl border border-border/60 overflow-hidden mb-4">
                        {ALL_DAYS.filter(d => workDays.includes(d.code)).map(({ code, label }, i, arr) => (
                            <div key={code} className={`flex items-center justify-between px-4 py-2.5 ${i !== arr.length - 1 ? "border-b border-border/40" : ""}`}>
                                <span className="text-sm font-semibold text-foreground w-10">{label}</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0.5}
                                        max={24}
                                        step={0.5}
                                        value={hoursByDay[code] ?? 7.5}
                                        onChange={e => setDayHours(code, parseFloat(e.target.value) || 0)}
                                        className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    <span className="text-sm text-muted-foreground">hrs</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Weekly total */}
                <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3 mb-4">
                    <div>
                        <p className="text-sm font-semibold text-foreground">Weekly total</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {ALL_DAYS.filter(d => workDays.includes(d.code)).map(d => `${d.label} ${hoursByDay[d.code] ?? 7.5}h`).join(" · ")}
                        </p>
                    </div>
                    <p className="text-2xl font-extrabold text-foreground">{weeklyHours.toFixed(1)}h</p>
                </div>

                <Button size="sm" className="rounded-xl" onClick={handleSaveSchedule} disabled={savingSchedule || workDays.length === 0}>
                    {savingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                    Save Schedule
                </Button>

            </div>

            {/* ── Kiosk PIN ── */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm px-5 py-5">
                <SectionHeader icon={KeyRound} title="Kiosk PIN" description="4–6 digit PIN to clock in/out at the office kiosk without logging in." />

                {hasPin ? (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">PIN is active</p>
                                <p className="text-[11px] text-emerald-600/70 dark:text-emerald-500">Use it at the kiosk to clock in/out</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 h-8" onClick={removePin} disabled={isPending}>
                            Remove
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">New PIN (4–6 digits)</Label>
                            <Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="rounded-xl h-9 font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Confirm PIN</Label>
                            <Input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="rounded-xl h-9 font-mono" />
                        </div>
                        <div className="col-span-2">
                            <Button size="sm" className="rounded-xl" onClick={savePin} disabled={isPending || pin.length < 4}>
                                Set PIN
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Appearance ── */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-sm px-5 py-5">
                <SectionHeader icon={Sun} title="Appearance" description="Choose your preferred colour theme." />
                <div className="flex gap-3">
                    {[
                        { value: "light", icon: Sun, label: "Light" },
                        { value: "dark", icon: Moon, label: "Dark" },
                        { value: "system", icon: Monitor, label: "System" },
                    ].map(({ value, icon: Icon, label }) => (
                        <button
                            key={value}
                            onClick={() => setTheme(value)}
                            className={`flex-1 flex flex-col items-center gap-2 rounded-xl border py-4 text-sm font-semibold transition-colors ${
                                theme === value
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                        >
                            <Icon className="h-5 w-5" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

        </div>
    )
}
