import { supabaseAdmin } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/actions/auth"
import { getProfileExtras } from "@/lib/actions/settings"
import { redirect } from "next/navigation"
import { ProfileClient } from "./profile-client"

export default async function StaffProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const authCtx = await getCurrentUser()
  if (!authCtx) redirect("/login")

  const today = new Date().toISOString().split("T")[0]

  const [
    { data: profile },
    { data: todayAtt },
    { data: todayWfh },
    { data: activeLeave },
    { data: dept },
    extras,
  ] = await Promise.all([
    supabaseAdmin
      .from("user_profiles")
      .select("id, full_name, display_name, job_title, email, phone, desk_extension, gender, avatar_url, department_id, created_at, joined_at, birthday")
      .eq("id", userId)
      .eq("is_active", true)
      .single(),
    supabaseAdmin
      .from("attendance")
      .select("clock_in, clock_out, running_late")
      .eq("user_id", userId)
      .eq("work_date", today)
      .maybeSingle(),
    supabaseAdmin
      .from("wfh_records")
      .select("wfh_type")
      .eq("user_id", userId)
      .eq("wfh_date", today)
      .maybeSingle(),
    supabaseAdmin
      .from("leave_requests")
      .select("leave_type")
      .eq("user_id", userId)
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle(),
    supabaseAdmin.from("departments").select("id, name"),
    getProfileExtras(userId),
  ])

  if (!profile) redirect("/directory")

  const deptName = (dept ?? []).find((d: any) => d.id === (profile as any).department_id)?.name ?? null

  // Determine live status
  let statusType: "in_office" | "wfh" | "on_leave" | "running_late" | "clocked_out" | "not_in" = "not_in"
  if (activeLeave) statusType = "on_leave"
  else if (todayWfh) statusType = "wfh"
  else if ((todayAtt as any)?.running_late && !(todayAtt as any)?.clock_in) statusType = "running_late"
  else if ((todayAtt as any)?.clock_in && !(todayAtt as any)?.clock_out) statusType = "in_office"
  else if ((todayAtt as any)?.clock_in && (todayAtt as any)?.clock_out) statusType = "clocked_out"

  // "At company since"
  const joinedRaw = (profile as any).joined_at ?? (profile as any).created_at
  const joinedDate = new Date(typeof joinedRaw === "string" && joinedRaw.length === 10 ? joinedRaw + "T12:00:00" : joinedRaw)
  const now = new Date()
  const months = (now.getFullYear() - joinedDate.getFullYear()) * 12 + (now.getMonth() - joinedDate.getMonth())
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  const sinceLabel = years > 0
    ? `${years} year${years > 1 ? "s" : ""}${remMonths > 0 ? ` ${remMonths}m` : ""}`
    : months > 0 ? `${months} month${months > 1 ? "s" : ""}` : "Just joined"
  const joinedYear = joinedDate.getFullYear()
  const joinedAtISO = (profile as any).joined_at ?? joinedDate.toISOString().split("T")[0]

  // Birthday display
  let birthdayDisplay: string | null = null
  const bday = (profile as any).birthday
  if (bday) {
    const d = new Date(bday + "T12:00:00")
    birthdayDisplay = d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })
  }

  // Merge profile + extras
  const mergedProfile = { ...profile, ...extras }

  return (
    <ProfileClient
      profile={mergedProfile as any}
      deptName={deptName}
      statusType={statusType}
      sinceLabel={sinceLabel}
      joinedYear={joinedYear}
      birthdayDisplay={birthdayDisplay}
      isOwnProfile={authCtx.id === userId}
      joinedAtISO={joinedAtISO}
    />
  )
}
