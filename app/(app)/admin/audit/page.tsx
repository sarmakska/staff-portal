import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { EmptyState } from "@/components/shared/empty-state"
import { Shield, LogIn, LogOut, Plus, Pencil, Trash2, Settings } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth"

const ACTION_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string; dot: string }> = {
  login:        { label: "Login",        icon: LogIn,   bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  logout:       { label: "Logout",       icon: LogOut,  bg: "bg-slate-100 dark:bg-slate-800",        text: "text-slate-600 dark:text-slate-400",    dot: "bg-slate-400" },
  create:       { label: "Create",       icon: Plus,    bg: "bg-blue-100 dark:bg-blue-900/30",       text: "text-blue-700 dark:text-blue-400",      dot: "bg-blue-500" },
  user_updated: { label: "Updated",      icon: Pencil,  bg: "bg-amber-100 dark:bg-amber-900/30",     text: "text-amber-700 dark:text-amber-400",    dot: "bg-amber-500" },
  update:       { label: "Updated",      icon: Pencil,  bg: "bg-amber-100 dark:bg-amber-900/30",     text: "text-amber-700 dark:text-amber-400",    dot: "bg-amber-500" },
  delete:       { label: "Deleted",      icon: Trash2,  bg: "bg-red-100 dark:bg-red-900/30",         text: "text-red-700 dark:text-red-400",        dot: "bg-red-500" },
  leave_submitted: { label: "Leave",     icon: Settings, bg: "bg-violet-100 dark:bg-violet-900/30",  text: "text-violet-700 dark:text-violet-400",  dot: "bg-violet-500" },
}

function getConfig(action: string) {
  return ACTION_CONFIG[action] ?? { label: action, icon: Settings, bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" }
}

function groupByDate(logs: any[]) {
  const groups: Record<string, any[]> = {}
  for (const log of logs) {
    const date = new Date(log.created_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    if (!groups[date]) groups[date] = []
    groups[date].push(log)
  }
  return groups
}

export default async function AdminAuditPage() {
  const _authCtx = await getCurrentUser()
  const user = _authCtx!

  const { data: rolesData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id)
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
  if (!roles.includes("admin")) redirect("/")

  const { data: logs } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  const grouped = groupByDate(logs ?? [])
  const totalEvents = logs?.length ?? 0
  const loginCount = logs?.filter((l: any) => l.action === "login").length ?? 0
  const changeCount = logs?.filter((l: any) => ["user_updated", "update", "create", "delete"].includes(l.action)).length ?? 0

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Last 100 system events</p>
        </div>
        <div className="flex gap-3">
          <div className="text-center rounded-xl border border-border/60 bg-card px-4 py-2">
            <p className="text-xl font-black text-foreground">{totalEvents}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Events</p>
          </div>
          <div className="text-center rounded-xl border border-border/60 bg-card px-4 py-2">
            <p className="text-xl font-black text-emerald-600">{loginCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Logins</p>
          </div>
          <div className="text-center rounded-xl border border-border/60 bg-card px-4 py-2">
            <p className="text-xl font-black text-amber-600">{changeCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Changes</p>
          </div>
        </div>
      </div>

      {(!logs || logs.length === 0) ? (
        <EmptyState
          icon={<Shield className="h-7 w-7 text-muted-foreground" />}
          title="No audit logs yet"
          description="System events will be recorded here."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{date}</span>
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] text-muted-foreground">{entries.length} event{entries.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Log entries */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                {entries.map((log: any, i: number) => {
                  const cfg = getConfig(log.action)
                  const Icon = cfg.icon
                  const time = new Date(log.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                  const actor = log.actor_email?.split("@")[0] ?? "system"
                  const domain = log.actor_email?.split("@")[1] ?? ""

                  return (
                    <div
                      key={log.id}
                      className={`flex items-center gap-4 px-5 py-3 ${i !== entries.length - 1 ? "border-b border-border/30" : ""} hover:bg-muted/10 transition-colors`}
                    >
                      {/* Icon badge */}
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                      </div>

                      {/* Action label */}
                      <div className="w-24 shrink-0">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Actor */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground">{actor}</span>
                        {domain && <span className="text-xs text-muted-foreground">@{domain}</span>}
                        {log.entity_table && (
                          <span className="ml-2 text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{log.entity_table}</span>
                        )}
                        {log.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.description}</p>
                        )}
                      </div>

                      {/* Time */}
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-foreground tabular-nums">{time}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
