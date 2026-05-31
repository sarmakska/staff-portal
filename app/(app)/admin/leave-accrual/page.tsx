import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { previewAccruals } from "@/lib/actions/leave-accrual"
import AccrualClient from "./accrual-client"

export default async function LeaveAccrualPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
    if (!roles.includes("admin") && !roles.includes("accounts")) redirect("/")

    const { rows, year, error } = await previewAccruals()
    return <AccrualClient initialRows={rows} year={year} error={error} />
}
