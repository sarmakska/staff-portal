import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { EmptyState } from "@/components/shared/empty-state"
import { CalendarDays, Lock } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getCurrentUser } from "@/lib/actions/auth"
import { LeaveBalanceForm } from "./leave-balance-form"
import { UsedBalanceForm } from "./used-balance-form"
import { MaxCarryForm } from "./max-carry-form"
import { CarryForwardForm } from "./carry-forward-form"
import { LeaveHowItWorks } from "./leave-how-it-works"
import { LeaveExportButton } from "./leave-export-button"

export default async function AdminLeavePage() {
    const _authCtx = await getCurrentUser()
    if (!_authCtx) redirect("/login")
    const user = _authCtx

    const supabase = await createClient()
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
    if (!roles.includes("admin") && !roles.includes("director") && !roles.includes("accounts")) redirect("/")

    const currentYear = new Date().getFullYear()
    const lastYear = currentYear - 1

    const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id, full_name, display_name, email, is_active, leave_balances(leave_type, total, used, pending, year)")
        .order("full_name")
        .order("year", { foreignTable: "leave_balances", ascending: false })
        .order("leave_type", { foreignTable: "leave_balances", ascending: true })

    const { data: carryData, error: carryErr } = await (supabaseAdmin as any)
        .from("user_profiles")
        .select("id, max_carry_forward, carry_forward_days")
    const carryMap = new Map<string, { maxCarry: number; carryForwardDays: number }>(
        carryErr ? [] : (carryData ?? []).map((r: any) => [r.id, {
            maxCarry: r.max_carry_forward ?? 5,
            carryForwardDays: r.carry_forward_days ?? 0,
        }])
    )

    const { data: lastYearData } = await supabaseAdmin
        .from("leave_balances")
        .select("user_id, total, used, pending")
        .eq("leave_type", "annual" as any)
        .eq("year", lastYear)
    const lastYearMap = new Map<string, { total: number; used: number; pending: number }>(
        (lastYearData ?? []).map((b: any) => [b.user_id, {
            total: Number(b.total),
            used: Number(b.used),
            pending: Number(b.pending),
        }])
    )

    function getCarryInfo(userId: string): { carry: number; isAuto: boolean } {
        const maxCarry = carryMap.get(userId)?.maxCarry ?? 5
        const ly = lastYearMap.get(userId)
        if (ly) {
            const remaining = Math.max(0, ly.total - ly.used - ly.pending)
            return { carry: Math.min(remaining, maxCarry), isAuto: true }
        }
        return { carry: carryMap.get(userId)?.carryForwardDays ?? 0, isAuto: false }
    }

    function getBalance(p: any, type: string) {
        const b = ((p.leave_balances as unknown as any[]) ?? []).find(
            (b: any) => b.leave_type === type && b.year === currentYear
        )
        return {
            total: Number(b?.total ?? 0),
            used: Number(b?.used ?? 0),
            pending: Number(b?.pending ?? 0),
        }
    }

    // cell style helpers
    const th = "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center"
    const groupTh = "px-3 py-2 text-[11px] font-extrabold tracking-wider text-center border-b border-border/40"
    const td = "px-2 py-3 text-center align-middle"

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl text-balance">
                        Leave Allowances
                    </h1>
                    <p className="text-base font-medium text-muted-foreground mt-1">
                        {currentYear} — click any editable field and tab away to save
                    </p>
                </div>
                <LeaveExportButton />
            </div>

            <LeaveHowItWorks currentYear={currentYear} lastYear={lastYear} />

            {(!profiles || profiles.length === 0) ? (
                <EmptyState
                    icon={<CalendarDays className="h-7 w-7 text-muted-foreground" />}
                    title="No active users"
                    description="Users will appear here once active."
                />
            ) : (
                <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            {/* Group row */}
                            <tr className="bg-muted/50 border-b border-border/60">
                                <th className={`${groupTh} text-left pl-5 w-48`} rowSpan={2}>Employee</th>
                                <th className={`${groupTh} text-blue-600 dark:text-blue-400 border-l border-border/40`} colSpan={5}>
                                    Annual Leave
                                </th>
                                <th className={`${groupTh} text-rose-500 dark:text-rose-400 border-l border-border/40`} colSpan={3}>
                                    Sick Leave
                                </th>
                                <th className={`${groupTh} text-violet-500 dark:text-violet-400 border-l border-border/40`} colSpan={3}>
                                    Maternity Leave
                                </th>
                                <th className={`${groupTh} text-muted-foreground border-l border-border/40`} rowSpan={2}>
                                    Max<br/>Carry
                                </th>
                            </tr>
                            {/* Sub-header row */}
                            <tr className="bg-muted/30 border-b border-border/60 text-muted-foreground">
                                {/* Annual */}
                                <th className={`${th} border-l border-border/40 w-24`}>Base<br/>Allow.</th>
                                <th className={`${th} w-24`}>Carry<br/>Over</th>
                                <th className={`${th} w-24 bg-muted/40`}>Total<br/>Allow.</th>
                                <th className={`${th} w-24`}>Absence<br/>Count</th>
                                <th className={`${th} w-24 bg-muted/20`}>Remaining<br/>Allow.</th>
                                {/* Sick */}
                                <th className={`${th} border-l border-border/40 w-20`}>Contract</th>
                                <th className={`${th} w-20`}>Used</th>
                                <th className={`${th} w-20 bg-muted/20`}>Left</th>
                                {/* Maternity */}
                                <th className={`${th} border-l border-border/40 w-20`}>Contract</th>
                                <th className={`${th} w-20`}>Used</th>
                                <th className={`${th} w-20 bg-muted/20`}>Left</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-border/30">
                            {(profiles ?? []).map((p: any, i: number) => {
                                const name = p.display_name || p.full_name || "—"
                                const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                                const { carry: currentCarry, isAuto: carryIsAuto } = getCarryInfo(p.id)

                                const annual = getBalance(p, "annual")
                                const sick = getBalance(p, "sick")
                                const maternity = getBalance(p, "maternity")

                                const annualTotal = annual.total + currentCarry
                                const annualRemaining = Math.max(0, annualTotal - annual.used - annual.pending)
                                const sickLeft = Math.max(0, sick.total - sick.used - sick.pending)
                                const maternityLeft = Math.max(0, maternity.total - maternity.used - maternity.pending)

                                const rowBg = i % 2 === 0 ? "" : "bg-muted/10"

                                return (
                                    <tr key={p.id} className={`${rowBg} hover:bg-muted/20 transition-colors`}>

                                        {/* Employee */}
                                        <td className="pl-5 pr-3 py-3 align-middle">
                                            <div className="flex items-center gap-2.5">
                                                <Avatar className="h-7 w-7 border border-border shrink-0">
                                                    <AvatarFallback className="bg-brand-taupe/10 text-brand-taupe text-[10px] font-bold">
                                                        {initials}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-foreground text-sm leading-tight truncate">{name}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Annual — Base Allowance (editable) */}
                                        <td className={`${td} border-l border-border/40`}>
                                            <LeaveBalanceForm
                                                userId={p.id}
                                                leaveType="annual"
                                                year={currentYear}
                                                currentTotal={annual.total}
                                                label="Annual"
                                            />
                                        </td>

                                        {/* Annual — Carry Over (editable or auto) */}
                                        <td className={`${td}`}>
                                            {carryIsAuto ? (
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className="text-lg font-black text-foreground">{currentCarry}</span>
                                                    <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full leading-none">auto</span>
                                                </div>
                                            ) : (
                                                <CarryForwardForm
                                                    userId={p.id}
                                                    currentCarry={currentCarry}
                                                    isAuto={false}
                                                />
                                            )}
                                        </td>

                                        {/* Annual — Total Allowance (read-only) */}
                                        <td className={`${td} bg-muted/20`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-xl font-black text-foreground">{annualTotal}</span>
                                                <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
                                            </div>
                                        </td>

                                        {/* Annual — Absence Count (editable) */}
                                        <td className={`${td}`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <UsedBalanceForm
                                                    userId={p.id}
                                                    leaveType="annual"
                                                    year={currentYear}
                                                    currentUsed={annual.used}
                                                />
                                                {annual.pending > 0 && (
                                                    <span className="text-[9px] text-muted-foreground">{annual.pending} pend.</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Annual — Remaining (read-only) */}
                                        <td className={`${td} bg-muted/20`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-xl font-black text-foreground">{annualRemaining}</span>
                                                <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
                                            </div>
                                        </td>

                                        {/* Sick — Contract */}
                                        <td className={`${td} border-l border-border/40`}>
                                            <LeaveBalanceForm
                                                userId={p.id}
                                                leaveType="sick"
                                                year={currentYear}
                                                currentTotal={sick.total}
                                                label="Sick"
                                            />
                                        </td>

                                        {/* Sick — Used */}
                                        <td className={`${td}`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <UsedBalanceForm
                                                    userId={p.id}
                                                    leaveType="sick"
                                                    year={currentYear}
                                                    currentUsed={sick.used}
                                                />
                                                {sick.pending > 0 && (
                                                    <span className="text-[9px] text-muted-foreground">{sick.pending} pend.</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Sick — Left (read-only) */}
                                        <td className={`${td} bg-muted/20`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-xl font-black text-foreground">{sickLeft}</span>
                                                <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
                                            </div>
                                        </td>

                                        {/* Maternity — Contract */}
                                        <td className={`${td} border-l border-border/40`}>
                                            <LeaveBalanceForm
                                                userId={p.id}
                                                leaveType="maternity"
                                                year={currentYear}
                                                currentTotal={maternity.total}
                                                label="Maternity"
                                            />
                                        </td>

                                        {/* Maternity — Used */}
                                        <td className={`${td}`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <UsedBalanceForm
                                                    userId={p.id}
                                                    leaveType="maternity"
                                                    year={currentYear}
                                                    currentUsed={maternity.used}
                                                />
                                                {maternity.pending > 0 && (
                                                    <span className="text-[9px] text-muted-foreground">{maternity.pending} pend.</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Maternity — Left (read-only) */}
                                        <td className={`${td} bg-muted/20`}>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-xl font-black text-foreground">{maternityLeft}</span>
                                                <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
                                            </div>
                                        </td>

                                        {/* Max Carry */}
                                        <td className={`${td} border-l border-border/40`}>
                                            <MaxCarryForm
                                                userId={p.id}
                                                currentMax={carryMap.get(p.id)?.maxCarry ?? 5}
                                            />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
