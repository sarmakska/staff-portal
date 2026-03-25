import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import ForgottenClockowutsClient from "./forgotten-clockouts-client"

export default async function ForgottenClockoutsPage() {
    const _authCtx = await getCurrentUser()
    if (!_authCtx) redirect("/login")

    const supabase = await createClient()
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", _authCtx.id)
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
    if (!roles.includes("admin") && !roles.includes("director") && !roles.includes("reception")) redirect("/")

    const db = supabaseAdmin as any

    const { data: alertsRaw } = await db
        .from("forgotten_clockout_alerts")
        .select("id, work_date, notified_at, user_id, user:user_profiles!forgotten_clockout_alerts_user_id_fkey(full_name, email, department_id)")
        .order("work_date", { ascending: false })
        .limit(500)

    const rawList: any[] = alertsRaw ?? []

    // Enrich with department names
    const deptIds = [...new Set(rawList.map((a: any) => a.user?.department_id).filter(Boolean))] as string[]
    const { data: depts } = deptIds.length > 0
        ? await supabaseAdmin.from("departments").select("id, name").in("id", deptIds)
        : { data: [] as { id: string; name: string }[] }
    const deptMap: Record<string, string> = Object.fromEntries((depts ?? []).map((d) => [d.id, d.name]))

    const alerts = rawList.map((a: any) => ({
        ...a,
        user: a.user ? { ...a.user, departments: { name: deptMap[a.user.department_id] ?? null } } : null,
    }))

    return <ForgottenClockowutsClient alerts={alerts} />
}
