import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { UsersManagementClient } from "./users-management-client"

export const metadata = {
    title: "Roles & Users | StaffPortal Admin",
}

export default async function AdminUsersPage() {
    const user = await getCurrentUser()
    if (!user) redirect("/login")

    const { data: rolesData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes("admin")) redirect("/")

    const [
        { data: profiles },
        { data: departments },
        { data: locations },
        { data: schedules },
    ] = await Promise.all([
        supabaseAdmin
            .from("user_profiles")
            .select("id, full_name, display_name, email, job_title, phone, department_id, is_active, user_roles!user_roles_user_id_fkey(role)")
            .order("full_name"),
        supabaseAdmin.from("departments").select("id, name, description, head_user_id").order("name"),
        supabaseAdmin.from("locations").select("id, name, address, city").order("name"),
        supabaseAdmin.from("work_schedules").select("user_id, work_days, daily_hours, hours_by_day"),
    ])

    return (
        <UsersManagementClient
            profiles={(profiles ?? []) as any}
            departments={departments ?? []}
            locations={locations ?? []}
            schedules={(schedules ?? []) as any}
            currentUserId={user.id}
        />
    )
}
