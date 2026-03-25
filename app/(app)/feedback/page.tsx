import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Plus } from "lucide-react"
import Link from "next/link"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function FeedbackPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
  const isPrivileged = roles.includes("admin") || roles.includes("director")

  // Admin/Director sees ALL feedback.
  // Others see feedback they submitted OR feedback addressed to them.
  const { data: feedbackItems } = await (isPrivileged
    ? supabaseAdmin
        .from("feedback")
        .select("*, submitter:user_profiles!feedback_user_id_fkey(full_name, display_name), recipient:user_profiles!feedback_recipient_id_fkey(full_name, display_name)")
        .order("created_at", { ascending: false })
    : supabase
        .from("feedback")
        .select("*, submitter:user_profiles!feedback_user_id_fkey(full_name, display_name), recipient:user_profiles!feedback_recipient_id_fkey(full_name, display_name)")
        .or(`user_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            {isPrivileged ? "All staff feedback — visible to admin and director" : "Feedback you've given or received"}
          </p>
        </div>
        <Button className="rounded-xl gap-2" asChild>
          <Link href="/feedback/new"><Plus className="h-4 w-4" />Give Feedback</Link>
        </Button>
      </div>

      {(!feedbackItems || feedbackItems.length === 0) ? (
        <EmptyState
          icon={<MessageSquare className="h-7 w-7 text-muted-foreground" />}
          title="No feedback"
          description={isPrivileged ? "No staff feedback has been submitted yet." : "No feedback given or received."}
          action={<Button asChild className="rounded-xl"><Link href="/feedback/new">Give Feedback</Link></Button>}
        />
      ) : (
        <div className="space-y-3">
          {feedbackItems.map((f: any) => {
            const submitterName = isPrivileged
              ? (f.submitter?.display_name || f.submitter?.full_name || "Unknown")
              : f.user_id === user.id ? "You" : (f.submitter?.display_name || f.submitter?.full_name || "Unknown")
            const recipientName = f.recipient?.display_name || f.recipient?.full_name || null
            const isReceived = !isPrivileged && f.recipient_id === user.id && f.user_id !== user.id
            return (
              <Card key={f.id} className={`rounded-2xl border-border shadow-sm ${isReceived ? "border-l-2 border-l-blue-400" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{f.subject}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-0.5">
                          {submitterName && <span>From: <span className="font-medium">{submitterName}</span></span>}
                          {recipientName && <span>→ To: <span className="font-medium">{recipientName}</span></span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] rounded-md capitalize">{f.category?.replace("_", " ") ?? "General"}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{f.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(f.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={f.status ?? "submitted"} />
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
