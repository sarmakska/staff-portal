import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listSsoConnections } from "@/lib/actions/sso"
import SsoClient from "./sso-client"

export default async function AdminSsoPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
    const roles = (rolesData ?? []).map((r: { role: string }) => r.role)
    if (!roles.includes("admin")) redirect("/")

    const { connections } = await listSsoConnections()
    return <SsoClient initialConnections={connections} />
}
