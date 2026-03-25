import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import Link from "next/link"
import { getCurrentUser } from "@/lib/actions/auth"
import { VisitorsClient } from "./visitors-client"

export default async function VisitorsPage() {
  const supabase = await createClient()
  const _authCtx = await getCurrentUser()
  if (!_authCtx) redirect('/login')
  const user = _authCtx

  const { data: visitors } = await supabase
    .from("visitors")
    .select("*, host:user_profiles!visitors_host_user_id_fkey(full_name)")
    .order("visit_date", { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visitors</h1>
          <p className="text-sm text-muted-foreground">Manage visitor bookings and check-ins</p>
        </div>
        <Button className="rounded-xl gap-2" asChild>
          <Link href="/visitors/new"><UserPlus className="h-4 w-4" />Book Visitor</Link>
        </Button>
      </div>

      <VisitorsClient visitors={(visitors ?? []) as any} canDelete={true} />
    </div>
  )
}
