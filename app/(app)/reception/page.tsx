import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import ReceptionClient from "./reception-client"
import { getStaffForKiosk } from "@/lib/actions/visitors"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function ReceptionPage() {
    const _authCtx = await getCurrentUser()
    const user = _authCtx!

    const { data: rolesData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id)
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
    if (!roles.includes("admin") && !roles.includes("reception")) {
        redirect("/")
    }

    const todayStr = new Date().toISOString().split("T")[0]

    const { data: visitorsRaw } = await supabaseAdmin
        .from("visitors")
        .select("*, host:user_profiles!visitors_host_user_id_fkey(full_name)")
        .eq("visit_date", todayStr)
        .order("time_window_start", { ascending: true })

    const visitors = (visitorsRaw || []).map(v => ({
        ...v,
        host_name: (v.host as any)?.full_name ?? "Unknown Host",
    }))

    const staff = await getStaffForKiosk()

    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name, display_name')
        .eq('id', user.id)
        .single()
    const receptionistName = (profile as any)?.display_name || (profile as any)?.full_name || 'Reception'

    // Today's attendance
    const { data: todayAttendance } = await supabaseAdmin
        .from("attendance")
        .select("user_id, clock_in, clock_out, status")
        .eq("work_date", todayStr)

    // Today's WFH
    const { data: todayWfh } = await supabaseAdmin
        .from("wfh_records")
        .select("user_id")
        .eq("wfh_date", todayStr)

    // Today's approved leave
    const { data: todayLeave } = await supabaseAdmin
        .from("leave_requests")
        .select("user_id, leave_type")
        .eq("status", "approved")
        .lte("start_date", todayStr)
        .gte("end_date", todayStr)

    // All active staff with department
    const { data: allStaff } = await supabaseAdmin
        .from("user_profiles")
        .select("id, full_name, display_name, job_title, department_id, departments!user_profiles_department_id_fkey(name)")
        .eq("is_active", true)
        .order("full_name")

    const attendanceMap = new Map((todayAttendance || []).map(a => [a.user_id, a]))
    const wfhSet = new Set((todayWfh || []).map(w => w.user_id))
    const leaveMap = new Map((todayLeave || []).map(l => [l.user_id, l.leave_type]))

    const staffLog = (allStaff || []).map((s: any) => {
        const att = attendanceMap.get(s.id)
        const dept = (s.departments as any)?.name ?? null
        let statusType: 'in_office' | 'clocked_out' | 'wfh' | 'on_leave' | 'not_in'
        if (leaveMap.has(s.id)) statusType = 'on_leave'
        else if (wfhSet.has(s.id)) statusType = 'wfh'
        else if (att?.clock_in && att?.clock_out) statusType = 'clocked_out'
        else if (att?.clock_in) statusType = 'in_office'
        else statusType = 'not_in'
        return {
            id: s.id,
            name: s.display_name || s.full_name,
            job_title: s.job_title ?? null,
            department: dept,
            status: statusType,
            clock_in: att?.clock_in ?? null,
            clock_out: att?.clock_out ?? null,
            leave_type: leaveMap.get(s.id) ?? null,
        }
    })

    return <ReceptionClient visitors={visitors} staffList={staff} receptionistName={receptionistName} staffLog={staffLog} />
}
