"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserPlus, X, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { createUser } from "@/lib/actions/admin"

const ALL_EXTRA_ROLES = ["admin", "director", "accounts", "reception"] as const

interface Props {
    departments: { id: string; name: string }[]
}

export function CreateUserModal({ departments }: Props) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [showPassword, setShowPassword] = useState(false)

    const [form, setForm] = useState({
        full_name: "",
        display_name: "",
        email: "",
        password: "",
        kiosk_pin: "",
        job_title: "",
        phone: "",
        department_id: "",
        is_active: true,
        roles: [] as string[],
        leave_annual: "",
        leave_sick: "",
        leave_maternity: "",
        max_carry_forward: "5",
    })

    const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

    const toggleRole = (role: string) => {
        setForm(f => ({
            ...f,
            roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role]
        }))
    }

    const reset = () => {
        setForm({
            full_name: "", display_name: "", email: "", password: "", kiosk_pin: "",
            job_title: "", phone: "", department_id: "", is_active: true, roles: [],
            leave_annual: "", leave_sick: "", leave_maternity: "", max_carry_forward: "5",
        })
        setShowPassword(false)
        setOpen(false)
    }

    const handleSubmit = () => {
        if (!form.full_name.trim()) { toast.error("Full name is required"); return }
        if (!form.email.trim()) { toast.error("Email is required"); return }
        if (!form.password || form.password.length < 6) { toast.error("Password must be at least 6 characters"); return }
        if (form.kiosk_pin && !/^\d{4}$/.test(form.kiosk_pin)) { toast.error("Kiosk PIN must be exactly 4 digits"); return }

        startTransition(async () => {
            const result = await createUser({
                full_name: form.full_name,
                email: form.email,
                password: form.password,
                kiosk_pin: form.kiosk_pin || undefined,
                display_name: form.display_name || undefined,
                job_title: form.job_title || undefined,
                phone: form.phone || undefined,
                department_id: form.department_id || undefined,
                is_active: form.is_active,
                roles: form.roles,
                leave_annual: form.leave_annual ? Number(form.leave_annual) : undefined,
                leave_sick: form.leave_sick ? Number(form.leave_sick) : undefined,
                leave_maternity: form.leave_maternity ? Number(form.leave_maternity) : undefined,
                max_carry_forward: form.max_carry_forward ? Number(form.max_carry_forward) : undefined,
            })

            if (result.success) {
                toast.success(`${form.full_name} has been added successfully`)
                reset()
            } else {
                toast.error(result.error ?? "Failed to create user")
            }
        })
    }

    return (
        <>
            <Button onClick={() => setOpen(true)} className="gap-2 rounded-xl h-9 px-4 text-sm">
                <UserPlus className="h-4 w-4" /> Add User
            </Button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm overflow-y-auto py-6 px-4">
                    <div className="w-full max-w-xl rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Add New User</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">They can log in immediately after being created</p>
                            </div>
                            <button onClick={reset} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-5">

                            {/* Account */}
                            <section className="space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Account</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">Full Name *</label>
                                        <Input value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Jane Smith" className="rounded-xl h-10" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">Display Name</label>
                                        <Input value={form.display_name} onChange={e => set("display_name", e.target.value)} placeholder="Jane (optional)" className="rounded-xl h-10" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">Email *</label>
                                        <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="jane@yourcompany.com" className="rounded-xl h-10" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">Password *</label>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? "text" : "password"}
                                                value={form.password}
                                                onChange={e => set("password", e.target.value)}
                                                placeholder="Min 6 characters"
                                                className="rounded-xl h-10 pr-10"
                                            />
                                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Profile */}
                            <section className="space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Profile</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">Job Title</label>
                                        <Input value={form.job_title} onChange={e => set("job_title", e.target.value)} placeholder="Sales Assistant" className="rounded-xl h-10" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">Phone</label>
                                        <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+44 7700 900000" className="rounded-xl h-10" />
                                    </div>
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
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">Kiosk PIN</label>
                                        <Input
                                            value={form.kiosk_pin}
                                            onChange={e => set("kiosk_pin", e.target.value.replace(/\D/g, "").slice(0, 4))}
                                            placeholder="4 digits"
                                            className="rounded-xl h-10"
                                            maxLength={4}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => set("is_active", !form.is_active)}
                                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${form.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                                    >
                                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                                    </button>
                                    <span className="text-sm font-medium text-foreground">{form.is_active ? "Active" : "Inactive"}</span>
                                </div>
                            </section>

                            {/* Access */}
                            <section className="space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Access Roles <span className="text-muted-foreground/60 normal-case font-normal">(Employee is always included)</span></p>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_EXTRA_ROLES.map(role => (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => toggleRole(role)}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize transition-colors ${
                                                form.roles.includes(role)
                                                    ? "bg-foreground text-background border-foreground"
                                                    : "bg-muted/30 text-muted-foreground border-border hover:border-foreground/40"
                                            }`}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Leave Allowances */}
                            <section className="space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Leave Allowances <span className="text-muted-foreground/60 normal-case font-normal">(optional — can set later)</span></p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { key: "leave_annual", label: "Annual" },
                                        { key: "leave_sick", label: "Sick" },
                                        { key: "leave_maternity", label: "Maternity" },
                                        { key: "max_carry_forward", label: "Max Carry" },
                                    ].map(({ key, label }) => (
                                        <div key={key} className="space-y-1.5">
                                            <label className="text-xs font-semibold text-foreground">{label}</label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={(form as any)[key]}
                                                onChange={e => set(key, e.target.value)}
                                                placeholder="0"
                                                className="rounded-xl h-10 text-center"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                            <Button variant="outline" onClick={reset} disabled={isPending} className="rounded-xl">Cancel</Button>
                            <Button onClick={handleSubmit} disabled={isPending} className="rounded-xl gap-2">
                                <UserPlus className="h-4 w-4" />
                                {isPending ? "Creating..." : "Create User"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
