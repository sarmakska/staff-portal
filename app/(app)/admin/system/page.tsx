import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { getSystemStatus, GitHubWorkflowRun } from "@/lib/actions/system-status"
import { Badge } from "@/components/ui/badge"
import { Database, HardDrive, Users, Clock, GitBranch, Github, Server, CheckCircle2, XCircle, RefreshCcw, Activity } from "lucide-react"

// Free tier limits
const SUPABASE_DB_LIMIT_BYTES = 500 * 1024 * 1024       // 500 MB
const SUPABASE_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024  // 1 GB
const SUPABASE_MAU_LIMIT = 50_000
const GITHUB_MINUTES_LIMIT = 2000

function fmtBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function pct(used: number, limit: number) {
    return Math.min(100, Math.round((used / limit) * 100))
}

// SVG arc ring for percentage
function Ring({ percent, size = 64, stroke = 5, color }: { percent: number; size?: number; stroke?: number; color: string }) {
    const r = (size - stroke) / 2
    const circ = 2 * Math.PI * r
    const dash = (percent / 100) * circ
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/40" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
    )
}

function ringColor(p: number) {
    if (p >= 80) return "#ef4444"
    if (p >= 50) return "#f59e0b"
    return "#10b981"
}

function MetricWidget({ label, used, limit, usedLabel, limitLabel, icon: Icon }: {
    label: string; used: number; limit: number; usedLabel: string; limitLabel: string; icon: React.ElementType
}) {
    const p = pct(used, limit)
    const color = ringColor(p)
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
            <div className="relative shrink-0">
                <Ring percent={p} color={color} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className="text-xl font-bold text-foreground tabular-nums leading-tight mt-0.5">{usedLabel}</p>
                <p className="text-[11px] text-muted-foreground">of {limitLabel} · <span style={{ color }} className="font-semibold">{p}%</span></p>
            </div>
        </div>
    )
}

function deployState(state: string) {
    if (state === "READY") return { label: "Ready", dot: "bg-emerald-500" }
    if (state === "ERROR") return { label: "Failed", dot: "bg-red-500" }
    if (state === "BUILDING") return { label: "Building", dot: "bg-blue-500 animate-pulse" }
    return { label: state, dot: "bg-muted-foreground" }
}

function runConclusion(run: GitHubWorkflowRun | null) {
    if (!run) return { label: "Never run", icon: null, cls: "text-muted-foreground" }
    if (run.conclusion === "success") return { label: "Success", icon: CheckCircle2, cls: "text-emerald-500" }
    if (run.conclusion === "failure") return { label: "Failed", icon: XCircle, cls: "text-red-500" }
    if (run.status === "in_progress") return { label: "Running", icon: RefreshCcw, cls: "text-blue-500 animate-spin" }
    return { label: run.conclusion ?? run.status, icon: null, cls: "text-muted-foreground" }
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function fmtDateTs(ts: number) {
    return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

// Section card wrapper
function Section({ title, subtitle, icon: Icon, accent, children }: {
    title: string; subtitle: string; icon: React.ElementType; accent: string; children: React.ReactNode
}) {
    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            {/* Header */}
            <div className={`px-5 py-4 flex items-center gap-3 border-b border-border ${accent}`}>
                <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                    <p className="text-sm font-bold text-white leading-tight">{title}</p>
                    <p className="text-[11px] text-white/70">{subtitle}</p>
                </div>
            </div>
            <div className="p-5 space-y-4">{children}</div>
        </div>
    )
}

export default async function SystemStatusPage() {
    const user = await getCurrentUser()
    if (!user?.isAdmin && !user?.isDirector) redirect("/")

    const status = await getSystemStatus()

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-6 w-6" /> System Status
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Free plan usage · last updated {new Date(status.fetchedAt).toLocaleString("en-GB")}
                </p>
            </div>

            {/* ─── Supabase ─── */}
            <Section title="Supabase" subtitle="Free tier · Postgres + Storage + Auth" icon={Database} accent="bg-emerald-600">
                {status.supabase ? (
                    <div className="space-y-3">
                        <MetricWidget
                            label="Database Size"
                            used={status.supabase.dbSizeBytes}
                            limit={SUPABASE_DB_LIMIT_BYTES}
                            usedLabel={fmtBytes(status.supabase.dbSizeBytes)}
                            limitLabel="500 MB"
                            icon={Database}
                        />
                        <MetricWidget
                            label="Storage"
                            used={status.supabase.storageSizeBytes}
                            limit={SUPABASE_STORAGE_LIMIT_BYTES}
                            usedLabel={fmtBytes(status.supabase.storageSizeBytes)}
                            limitLabel="1 GB"
                            icon={HardDrive}
                        />
                        <MetricWidget
                            label="Monthly Active Users"
                            used={status.supabase.activeUsers}
                            limit={SUPABASE_MAU_LIMIT}
                            usedLabel={status.supabase.activeUsers.toString()}
                            limitLabel="50,000"
                            icon={Users}
                        />
                        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                            Other limits (not measurable via API): Bandwidth 5 GB/mo · Edge Functions 500k calls/mo · Realtime 200 concurrent
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Could not fetch Supabase metrics.</p>
                )}
            </Section>

            {/* ─── Vercel ─── */}
            <Section title="Vercel" subtitle="Hobby plan · Serverless deployments" icon={HardDrive} accent="bg-zinc-800">
                {status.vercel?.error && !status.vercel.lastDeployment ? (
                    <p className="text-sm text-muted-foreground">Unavailable: {status.vercel.error}</p>
                ) : status.vercel ? (
                    <div className="space-y-3">
                        {status.vercel.lastDeployment && (() => {
                            const d = status.vercel!.lastDeployment!
                            const s = deployState(d.state)
                            return (
                                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-foreground">Last Deployment</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                                            <span className="text-xs font-medium text-foreground">{s.label}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-3.5 w-3.5 shrink-0" />
                                            <span>{fmtDateTs(d.createdAt)}</span>
                                        </div>
                                        {d.meta?.githubCommitRef && (
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="h-3.5 w-3.5 shrink-0" />
                                                <span>{d.meta.githubCommitRef}</span>
                                            </div>
                                        )}
                                        {d.meta?.githubCommitMessage && (
                                            <p className="truncate pl-5 italic">{d.meta.githubCommitMessage}</p>
                                        )}
                                    </div>
                                </div>
                            )
                        })()}
                        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Deployments this month</p>
                            <p className="text-2xl font-bold text-foreground tabular-nums">{status.vercel.deploymentsThisMonth}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                            Hobby plan: Bandwidth 100 GB/mo · Serverless 100 GB-hours/mo · 2 cron jobs
                        </p>
                    </div>
                ) : null}
            </Section>

            {/* ─── GitHub ─── */}
            <Section title="GitHub" subtitle="Free plan · Private repo · Actions" icon={Github} accent="bg-slate-700">
                {status.github?.error && !status.github.workflows.length ? (
                    <p className="text-sm text-muted-foreground">Unavailable: {status.github.error}</p>
                ) : status.github ? (
                    <div className="space-y-3">
                        <MetricWidget
                            label="Actions Minutes This Month (approx)"
                            used={status.github.approxMinutesUsed}
                            limit={GITHUB_MINUTES_LIMIT}
                            usedLabel={`~${status.github.approxMinutesUsed} min`}
                            limitLabel="2,000 min"
                            icon={Clock}
                        />
                        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Total runs this month</p>
                            <p className="text-2xl font-bold text-foreground tabular-nums">{status.github.totalRunsThisMonth}</p>
                        </div>

                        {/* Per-workflow */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">Workflow Status</p>
                            {status.github.workflows.map(wf => {
                                const c = runConclusion(wf.lastRun)
                                const Icon = c.icon
                                return (
                                    <div key={wf.name} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{wf.name}</p>
                                            {wf.lastRun && (
                                                <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(wf.lastRun.created_at)}</p>
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-1.5 text-xs font-semibold ${c.cls}`}>
                                            {Icon && <Icon className={`h-3.5 w-3.5 ${c.cls}`} />}
                                            {c.label}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                            Minutes are approximate (run timestamps). Free: 2,000 min/mo · 500 MB artifact storage
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Actions Minutes", value: "2,000 / month" },
                                { label: "Actions Storage", value: "500 MB" },
                                { label: "Collaborators", value: "Unlimited" },
                                { label: "Private Repos", value: "Unlimited" },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                    <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                Add a GitHub PAT as <code className="font-mono bg-muted px-1 rounded">GITHUB_TOKEN</code> in Vercel env vars to see real usage.
                            </p>
                        </div>
                    </>
                )}
            </Section>
        </div>
    )
}
