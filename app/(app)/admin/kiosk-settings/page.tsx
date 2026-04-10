import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAllStaffForKioskSettings } from "@/lib/actions/visitors"
import KioskSettingsClient from "./kiosk-settings-client"

export default async function KioskSettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes("admin") && !roles.includes("reception")) redirect("/")

    const staff = await getAllStaffForKioskSettings()
    return <KioskSettingsClient staff={staff} />
}
