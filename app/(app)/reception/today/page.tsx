import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Monitor, UserCheck, UserX } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function ReceptionTodayPage() {
  const supabase = await createClient()
  const _authCtx = await getCurrentUser()
  const user = _authCtx!
  const { isAdmin, isReception, isAccounts } = _authCtx!

  // Verify role
  const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
  if (!roles.includes("reception") && !roles.includes("admin")) redirect("/")

  const today = new Date().toISOString().split("T")[0]
  const { data: visitors } = await supabase
    .from("visitors")
    .select("*, host:user_profiles!visitors_host_user_id_fkey(full_name)")
    .eq("visit_date", today)
    .order("time_window_start", { ascending: true })

  const stats = {
    expected: visitors?.filter(v => v.status === "booked").length ?? 0,
    checkedIn: visitors?.filter(v => v.status === "checked_in").length ?? 0,
    checkedOut: visitors?.filter(v => v.status === "checked_out").length ?? 0,
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reception Desk</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Expected", value: stats.expected, color: "text-blue-600" },
          { label: "Checked In", value: stats.checkedIn, color: "text-green-600" },
          { label: "Checked Out", value: stats.checkedOut, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="rounded-2xl border-border shadow-sm">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!visitors || visitors.length === 0) ? (
        <EmptyState
          icon={<Monitor className="h-7 w-7 text-muted-foreground" />}
          title="No visitors today"
          description="No visitors are booked for today."
        />
      ) : (
        <div className="space-y-3">
          {visitors.map((v: any) => (
            <Card key={v.id} className="rounded-2xl border-border shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground font-bold text-sm">
                    {v.visitor_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{v.visitor_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.company ? `${v.company} · ` : ""}
                      Host: {v.host?.full_name ?? "—"}
                      {v.time_window_start ? ` · ${String(v.time_window_start).substring(0, 5)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={v.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
