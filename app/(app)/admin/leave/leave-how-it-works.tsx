"use client"

import { useState } from "react"
import { Info, ChevronDown, ChevronUp, Pencil, Lock } from "lucide-react"

export function LeaveHowItWorks({ currentYear, lastYear }: { currentYear: number; lastYear: number }) {
    const [open, setOpen] = useState(false)

    return (
        <div className="rounded-2xl border border-border/50 bg-card/30">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
                <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">How Allowances Work</p>
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {open && (
                <div className="px-5 pb-5 space-y-6 border-t border-border/40 pt-5">

                    {/* What can you edit */}
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Pencil className="h-3 w-3 text-foreground" />
                            <span className="font-semibold text-foreground">Pencil icon</span> — you can click this number and change it. Tab away to save.
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Lock className="h-3 w-3" />
                            <span className="font-semibold">Lock icon</span> — the system works this out for you. You cannot edit it.
                        </div>
                    </div>

                    {/* Annual Leave */}
                    <div className="space-y-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-500 dark:text-blue-400">Annual Leave — What Each Column Means</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-foreground/10 text-foreground">Base Allow.</span>
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                    <span className="font-semibold text-foreground">How many days off this person gets in {currentYear}.</span> This is their annual leave entitlement from their contract. You set this. Click it, type the number, press Tab.
                                </p>
                            </div>

                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-foreground/10 text-foreground">Carry Over</span>
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                    <span className="font-semibold text-foreground">Days left over from {lastYear} that rolled into this year.</span> If {lastYear} data is in the system, the number fills in automatically — it takes what was left last year and caps it at their Max Carry limit. If there is no {lastYear} data yet, you type it in yourself.
                                </p>
                            </div>

                            <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-foreground/10 text-foreground">Total Allow.</span>
                                    <Lock className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                    <span className="font-semibold text-foreground">Base + Carry Over.</span> This is the full pot of days the person can actually use this year. The system adds it up for you — you cannot edit this directly.
                                </p>
                            </div>

                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-foreground/10 text-foreground">Absence Count</span>
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                    <span className="font-semibold text-foreground">Days already taken this year.</span> Every time a leave request is approved the number goes up by itself. Any days still waiting for approval show underneath in grey. Only edit this if something has gone wrong and you need to correct it.
                                </p>
                            </div>

                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-foreground/10 text-foreground">Remaining Allow.</span>
                                    <Lock className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                    <span className="font-semibold text-foreground">Days left to book.</span> The system takes Total − Absence − Pending to get this number. If a staff member tries to book more days than this, the system blocks them automatically.
                                </p>
                            </div>

                        </div>
                    </div>

                    {/* Sick + Maternity + Max Carry */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <p className="text-[11px] font-extrabold uppercase tracking-widest text-rose-500 dark:text-rose-400">Sick &amp; Maternity — What Each Column Means</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: "Contract", icon: "edit", desc: "How many sick/maternity days they are allowed under their contract. You set this number." },
                                    { label: "Used", icon: "edit", desc: "How many days they have actually taken. Goes up automatically when a request is approved. Only edit to correct a mistake." },
                                    { label: "Left", icon: "lock", desc: "Contract minus Used minus Pending. Just for your records. There is NO hard block — staff can still submit sick or maternity leave even if this shows 0." },
                                ].map(({ label, icon, desc }) => (
                                    <div key={label} className="rounded-xl border border-border/40 bg-muted/20 p-2.5 space-y-1">
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-bold text-foreground">{label}</span>
                                            {icon === "edit"
                                                ? <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                                                : <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                                            }
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-snug">{desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Max Carry</p>
                            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-foreground">Max Carry</span>
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-snug">
                                    <span className="font-semibold text-foreground">The most unused days they can bring into {currentYear + 1}.</span> At the end of {currentYear}, the system will carry forward whichever is smaller — their actual days left OR this number. Default is 5. Set to 0 if you do not want any days rolling over for this person.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Worked example */}
                    <div className="rounded-xl bg-muted/30 border border-border/30 px-4 py-4 space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Real Example — Follow the Numbers</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2 text-[12px] text-muted-foreground">
                            <div className="space-y-1">
                                <p><span className="font-semibold text-foreground">Base Allow.</span> = 20 days <span className="text-[10px] text-muted-foreground/60">(their contract says 20)</span></p>
                                <p><span className="font-semibold text-foreground">Carry Over</span> = 3 days <span className="text-[10px] text-muted-foreground/60">(had 5 left in {lastYear}, Max Carry was 3, so capped at 3)</span></p>
                                <p><span className="font-semibold text-foreground">Total Allow.</span> = 20 + 3 = <span className="text-foreground font-bold">23 days</span></p>
                                <p><span className="font-semibold text-foreground">Absence Count</span> = 8 <span className="text-[10px] text-muted-foreground/60">(8 days already approved and taken)</span></p>
                                <p><span className="font-semibold text-muted-foreground">Pending</span> = 2 <span className="text-[10px] text-muted-foreground/60">(2 days submitted but not approved yet)</span></p>
                            </div>
                            <div className="flex flex-col justify-center gap-2">
                                <p className="text-[13px] font-bold text-foreground">Remaining = 23 − 8 − 2 = <span className="text-emerald-500">13 days</span></p>
                                <p className="text-[11px]">They try to book 10 days → <span className="font-semibold text-foreground">allowed.</span><br />They try to book 14 days → <span className="text-rose-400 font-semibold">blocked by the system.</span></p>
                                <p className="text-[11px] pt-1 border-t border-border/20">End of year: 13 days left, Max Carry = 5 → system carries <span className="font-semibold text-foreground">5 days</span> into {currentYear + 1}. The other 8 are gone.</p>
                            </div>
                        </div>
                    </div>

                    {/* Annual vs Sick summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                        <div className="rounded-lg bg-blue-500/5 border border-blue-400/20 px-3 py-2.5">
                            <p className="font-bold text-blue-500 mb-1">Annual Leave — Hard limit</p>
                            <p className="text-muted-foreground">If someone tries to book more days than their Remaining shows, the system says no. Simple. Carry forward happens at year end based on Max Carry.</p>
                        </div>
                        <div className="rounded-lg bg-rose-500/5 border border-rose-400/20 px-3 py-2.5">
                            <p className="font-bold text-rose-400 mb-1">Sick &amp; Maternity — No hard limit</p>
                            <p className="text-muted-foreground">Even if the balance shows 0, staff can still submit sick or maternity leave. The columns are just for your records — the system does not block them. No carry forward either.</p>
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
