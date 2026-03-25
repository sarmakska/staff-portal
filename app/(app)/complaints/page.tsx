import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Plus, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { getCurrentUser } from "@/lib/actions/auth"

const severityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-destructive/10 text-destructive",
}

export default async function ComplaintsPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
  const isPrivileged = roles.includes("admin") || roles.includes("director")

  // Admin/Director sees ALL complaints.
  // Others see complaints they submitted OR complaints addressed to them.
  const { data: complaints } = await (isPrivileged
    ? supabaseAdmin
        .from("complaints")
        .select("*, submitter:user_profiles!complaints_user_id_fkey(full_name, display_name), recipient:user_profiles!complaints_recipient_id_fkey(full_name, display_name)")
        .order("created_at", { ascending: false })
    : supabase
        .from("complaints")
        .select("*, submitter:user_profiles!complaints_user_id_fkey(full_name, display_name), recipient:user_profiles!complaints_recipient_id_fkey(full_name, display_name)")
        .or(`user_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Complaints</h1>
          <p className="text-sm text-muted-foreground">
            {isPrivileged
              ? "All workplace complaints — visible to admin and director"
              : "Complaints you've raised or received"}
          </p>
        </div>
        <Button className="rounded-xl gap-2" asChild>
          <Link href="/complaints/new"><Plus className="h-4 w-4" />New Complaint</Link>
        </Button>
      </div>

      {isPrivileged && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Anonymous complaints are shown as "Anonymous" — submitter identity is never revealed.
        </div>
      )}

      {(!complaints || complaints.length === 0) ? (
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7 text-muted-foreground" />}
          title="No complaints"
          description={isPrivileged ? "No complaints have been raised yet." : "No complaints raised or received."}
          action={<Button asChild className="rounded-xl"><Link href="/complaints/new">Raise a Complaint</Link></Button>}
        />
      ) : (
        <div className="space-y-3">
          {complaints.map((c: any) => {
            const submitterLabel = isPrivileged
              ? c.is_anonymous ? "Anonymous" : (c.submitter?.display_name || c.submitter?.full_name || "Unknown")
              : c.user_id === user.id ? "You" : (c.is_anonymous ? "Anonymous" : (c.submitter?.display_name || c.submitter?.full_name || "Unknown"))
            const recipientLabel = c.recipient?.display_name || c.recipient?.full_name || null
            const isReceived = !isPrivileged && c.recipient_id === user.id && c.user_id !== user.id
            return (
              <Card key={c.id} className={`rounded-2xl border-border shadow-sm ${isReceived ? "border-l-2 border-l-amber-400" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{c.subject}</p>
                          {c.is_anonymous && !isPrivileged && c.user_id !== user.id && (
                            <Badge variant="outline" className="text-[10px] rounded-md">Anonymous</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          {submitterLabel && (
                            <span>From: <span className={c.is_anonymous ? "italic" : "font-medium"}>{submitterLabel}</span></span>
                          )}
                          {recipientLabel && (
                            <span>→ To: <span className="font-medium">{recipientLabel}</span></span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <Badge className={`text-[10px] rounded-md capitalize ${severityColors[c.severity] ?? ""}`}>
                            {c.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] rounded-md capitalize">{c.category}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        {c.message && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.message}</p>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
