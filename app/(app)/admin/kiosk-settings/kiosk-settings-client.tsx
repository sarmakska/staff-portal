"use client"

import { useState, useTransition } from "react"
import { toggleKioskVisibility, setKioskPinForUser } from "@/lib/actions/visitors"
import { Tablet } from "lucide-react"
import { toast } from "sonner"

interface Staff {
    id: string
    full_name: string
    show_on_kiosk: boolean
    kiosk_pin: string | null
}

export default function KioskSettingsClient({ staff }: { staff: Staff[] }) {
    const [list, setList] = useState<Staff[]>(staff)
    const [editingPin, setEditingPin] = useState<string | null>(null)
    const [pinValue, setPinValue] = useState("")
    const [pending, startTransition] = useTransition()

    const toggle = (id: string, current: boolean) => {
        startTransition(async () => {
            const res = await toggleKioskVisibility(id, !current)
            if (res.success) {
                setList(prev => prev.map(s => s.id === id ? { ...s, show_on_kiosk: !current } : s))
            } else {
                toast.error(res.error ?? "Failed to update")
            }
        })
    }

    const startEditPin = (id: string, currentPin: string | null) => {
        setEditingPin(id)
        setPinValue(currentPin ?? "")
    }

    const savePin = (id: string) => {
        startTransition(async () => {
            const res = await setKioskPinForUser(id, pinValue)
            if (res.success) {
                setList(prev => prev.map(s => s.id === id ? { ...s, kiosk_pin: pinValue || null } : s))
                setEditingPin(null)
                toast.success("PIN updated")
            } else {
                toast.error(res.error ?? "Failed to update PIN")
            }
        })
    }

    const visible = list.filter(s => s.show_on_kiosk).length
    const noPinCount = list.filter(s => !s.kiosk_pin).length

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Tablet className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Kiosk Settings</h1>
                    <p className="text-sm text-muted-foreground">Manage who appears on the sign-in kiosk and their PIN</p>
                </div>
            </div>

            <div className="flex gap-3">
                <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3">
                    <p className="text-2xl font-bold text-foreground">{visible}</p>
                    <p className="text-xs text-muted-foreground">Visible on kiosk</p>
                </div>
                <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3">
                    <p className="text-2xl font-bold text-foreground">{list.length - visible}</p>
                    <p className="text-xs text-muted-foreground">Hidden from kiosk</p>
                </div>
                <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3">
                    <p className={`text-2xl font-bold ${noPinCount > 0 ? "text-amber-500" : "text-foreground"}`}>{noPinCount}</p>
                    <p className="text-xs text-muted-foreground">No PIN set</p>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/40 grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                    <span className="text-sm font-medium text-foreground">Staff Member</span>
                    <span className="text-sm font-medium text-foreground text-center w-28">Kiosk PIN</span>
                    <span className="text-sm font-medium text-foreground text-center w-16">Visible</span>
                </div>
                <div className="divide-y divide-border">
                    {list.map(s => (
                        <div key={s.id} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                                    {s.full_name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-foreground truncate">{s.full_name}</span>
                            </div>

                            <div className="w-28">
                                {editingPin === s.id ? (
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={pinValue}
                                            onChange={e => setPinValue(e.target.value.replace(/\D/g, ""))}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") savePin(s.id)
                                                if (e.key === "Escape") setEditingPin(null)
                                            }}
                                            autoFocus
                                            placeholder="4-6 digits"
                                            className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                        <button
                                            onClick={() => savePin(s.id)}
                                            disabled={pending}
                                            className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                                        >
                                            Save
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => startEditPin(s.id, s.kiosk_pin)}
                                        className="w-full rounded-lg border border-dashed border-border px-3 py-1 text-sm text-center hover:border-primary hover:text-primary transition-colors"
                                    >
                                        {s.kiosk_pin ? (
                                            <span className="font-mono tracking-widest">{s.kiosk_pin}</span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">+ Set PIN</span>
                                        )}
                                    </button>
                                )}
                            </div>

                            <div className="flex justify-center w-16">
                                <button
                                    onClick={() => toggle(s.id, s.show_on_kiosk)}
                                    disabled={pending}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                                        s.show_on_kiosk ? "bg-primary" : "bg-muted-foreground/30"
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            s.show_on_kiosk ? "translate-x-6" : "translate-x-1"
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                Click a PIN to edit it. Press Enter or Save to confirm. Staff hidden from the kiosk cannot clock in or out from the sign-in screen.
            </p>
        </div>
    )
}
