import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail } from "lucide-react"
import { getCurrentUser } from "@/lib/actions/auth"
import TemplatesClient from "./templates-client"

export default async function AdminTemplatesPage() {
  const _authCtx = await getCurrentUser()
  const user = _authCtx!

  const { data: rolesData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id)
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
  if (!roles.includes("admin")) redirect("/")

  const { data: templates } = await supabaseAdmin
    .from("email_templates")
    .select("*")
    .eq("is_active", true)
    .order("name")

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
        <p className="text-sm text-muted-foreground">Active system email templates</p>
      </div>

      {(!templates || templates.length === 0) ? (
        <EmptyState
          icon={<Mail className="h-7 w-7 text-muted-foreground" />}
          title="No email templates"
          description="Run the database migrations to seed email templates."
        />
      ) : (
        <TemplatesClient templates={templates} />
      )}
    </div>
  )
}
