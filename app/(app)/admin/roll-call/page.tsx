import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import RollCallClient from "./roll-call-client"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function RollCallPage() {
    const _authCtx = await getCurrentUser()
    if (!_authCtx) redirect("/login")
    const user = _authCtx

    const supabase = await createClient()
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
    if (!roles.includes("admin") && !roles.includes("director") && !roles.includes("reception")) {
        redirect("/")
    }

    const todayStr = new Date().toISOString().split("T")[0]

    // Query 1: Active Staff
    // In Supabase, joining attendance and user_profiles is best done from the side holding the fkey.
    // We want all users who are currently checked in (clock_in != null, clock_out == null) for today.
    const { data: attendanceRaw } = await supabaseAdmin
        .from("attendance")
        .select("clock_in, user_profiles:user_id(id, full_name, department_id, departments:department_id(name), phone, desk_extension)")
        .eq("work_date", todayStr)
        .not("clock_in", "is", null)
        .is("clock_out", null)

    const activeStaff = (attendanceRaw || []).map((a: any) => ({
        id: a.user_profiles?.id || 'unknown',
        full_name: a.user_profiles?.full_name || 'Unknown',
        department: a.user_profiles?.departments?.name || 'General',
        phone: a.user_profiles?.phone || '',
        extension: a.user_profiles?.desk_extension || '',
        clock_in: a.clock_in
    }))

    // Query 2: Active Visitors
    const { data: visitorsRaw } = await supabaseAdmin
        .from("visitors")
        .select("id, visitor_name, company, host:user_profiles!visitors_host_user_id_fkey(full_name), checked_in_at")
        .eq("visit_date", todayStr)
        .eq("status", "checked_in")

    const activeVisitors = (visitorsRaw || []).map((v: any) => ({
        id: v.id,
        name: v.visitor_name,
        company: v.company || '',
        host_name: v.host?.full_name || 'Unknown Host',
        checked_in_at: v.checked_in_at
    }))

    return (
        <RollCallClient
            staff={activeStaff}
            visitors={activeVisitors}
            generatedAt={new Date().toISOString()}
        />
    )
}
