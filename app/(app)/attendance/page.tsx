import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AttendanceClient from "./attendance-client"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function AttendancePage() {
  const supabase = await createClient()
  const _authCtx = await getCurrentUser()
  const user = _authCtx!
  const { isAdmin, isReception, isAccounts } = _authCtx!

  // Get this week's attendance records for the logged-in user
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)

  const { data: records } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user.id)
    .gte("work_date", weekStart.toISOString().split("T")[0])
    .order("work_date", { ascending: true })

  // Today's record
  const today = new Date().toISOString().split("T")[0]
  const todayRecord = records?.find(r => r.work_date === today) ?? null

  const { data: wfhRecord } = await supabase
    .from("wfh_records")
    .select("wfh_date, notes, wfh_type")
    .eq("user_id", user.id)
    .eq("wfh_date", today)
    .single()

  return <AttendanceClient records={records ?? []} todayRecord={todayRecord} userId={user.id} wfhToday={!!wfhRecord} wfhReason={wfhRecord?.notes ?? null} wfhType={(wfhRecord?.wfh_type as 'full' | 'half_am' | 'half_pm') ?? null} />
}
