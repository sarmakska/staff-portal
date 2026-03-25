import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Plus } from "lucide-react"
import { createDepartment, deleteDepartment, createLocation, deleteLocation } from "@/lib/actions/admin"
import { getCurrentUser } from "@/lib/actions/auth"
import DeptHeadSelect from "./dept-head-select"

export default async function AdminOrgPage() {
  const _authCtx = await getCurrentUser()
  const user = _authCtx!

  const { data: rolesData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id)
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
  if (!roles.includes("admin") && !roles.includes("director")) redirect("/")

  const [{ data: departments }, { data: locations }, { data: usersData }] = await Promise.all([
    supabaseAdmin.from("departments").select("id, name, description, head_user_id").order("name"),
    supabaseAdmin.from("locations").select("id, name, address, city").order("name"),
    supabaseAdmin.from("user_profiles").select("id, full_name").order("full_name")
  ])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Organisation</h1>
        <p className="text-sm text-muted-foreground">Manage departments and office locations</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Departments */}
        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Departments ({departments?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(departments ?? []).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{d.name}</p>
                  {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <DeptHeadSelect deptId={d.id} currentHeadId={d.head_user_id} users={usersData || []} />
                  <form action={deleteDepartment.bind(null, d.id)}>
                    <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                </div>
              </div>
            ))}
            <form action={createDepartment} className="flex gap-2 pt-1">
              <Input name="name" placeholder="Department name" className="rounded-xl h-9 text-sm" required />
              <Input name="description" placeholder="Description (optional)" className="rounded-xl h-9 text-sm" />
              <Button type="submit" size="sm" className="rounded-xl gap-1 shrink-0">
                <Plus className="h-3.5 w-3.5" />Add
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Locations */}
        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Locations ({locations?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(locations ?? []).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{l.name}</p>
                  {(l.address || l.city) && (
                    <p className="text-xs text-muted-foreground">{[l.address, l.city].filter(Boolean).join(", ")}</p>
                  )}
                </div>
                <form action={deleteLocation.bind(null, l.id)}>
                  <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            ))}
            <form action={createLocation} className="flex gap-2 pt-1">
              <Input name="name" placeholder="Location name" className="rounded-xl h-9 text-sm" required />
              <Input name="city" placeholder="City" className="rounded-xl h-9 text-sm" />
              <Button type="submit" size="sm" className="rounded-xl gap-1 shrink-0">
                <Plus className="h-3.5 w-3.5" />Add
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
