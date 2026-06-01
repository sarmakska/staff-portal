// Deduplicated module
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { ArrowLeft, User, Building2, Calendar, Clock, Users, BadgeCheck, Accessibility } from "lucide-react"
import Link from "next/link"
import { getCurrentUser } from "@/lib/actions/auth"
import { VisitorQr } from "@/components/shared/visitor-qr"

export default async function VisitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const _authCtx = await getCurrentUser()

  const user = _authCtx!


  const { data: visitor } = await supabase
    .from("visitors")
    .select("*, host:user_profiles!visitors_host_user_id_fkey(full_name, email)")
    .eq("id", id)
    .single()

  if (!visitor) notFound()

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const fmtTime = (t: string) => t?.substring(0, 5) ?? "—"

  const fields = [
    { icon: <User className="h-4 w-4" />, label: "Visitor", value: visitor.visitor_name },
    { icon: <Building2 className="h-4 w-4" />, label: "Company", value: visitor.company ?? "—" },
    { icon: <Calendar className="h-4 w-4" />, label: "Date", value: fmt(visitor.visit_date) },
    {
      icon: <Clock className="h-4 w-4" />, label: "Time",
      value: visitor.checked_out_at
        ? `${fmtTime(visitor.time_window_start)} – ${new Date(visitor.checked_out_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
        : visitor.checked_in_at
          ? `${new Date(visitor.checked_in_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} – ongoing`
          : `${fmtTime(visitor.time_window_start)} – ${fmtTime(visitor.time_window_end)}`
    },
    { icon: <Users className="h-4 w-4" />, label: "Guests", value: String(visitor.guest_count) },
    { icon: <BadgeCheck className="h-4 w-4" />, label: "ID Required", value: visitor.requires_id ? "Yes" : "No" },
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/visitors"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{visitor.visitor_name}</h1>
          <p className="text-sm text-muted-foreground">Visitor booking details</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={visitor.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border-border shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
                <span className="text-muted-foreground">{icon}</span>
                <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
                <span className="text-sm font-medium text-foreground">{value}</span>
              </div>
            ))}
            {visitor.accessibility_notes && (
              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
                <Accessibility className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm text-muted-foreground w-24 shrink-0">Accessibility</span>
                <span className="text-sm font-medium text-foreground">{visitor.accessibility_notes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono text-foreground tracking-wider">{visitor.reference_code}</p>
              {visitor.badge_number && (
                <p className="text-sm text-muted-foreground mt-2">Badge: {visitor.badge_number}</p>
              )}
              <div className="mt-4">
                <VisitorQr code={visitor.reference_code} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Host</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-foreground">{(visitor.host as any)?.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{(visitor.host as any)?.email ?? ""}</p>
            </CardContent>
          </Card>

          {visitor.checked_in_at && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Checked in</span>
                  <span>{new Date(visitor.checked_in_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {visitor.checked_out_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Checked out</span>
                    <span>{new Date(visitor.checked_out_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
