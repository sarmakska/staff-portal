import { getCurrentUser } from "@/lib/actions/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import NewComplaintClient from "./new-complaint-client"

export default async function NewComplaintPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const { data: users } = await supabaseAdmin
    .from("user_profiles")
    .select("id, full_name, display_name")
    .eq("is_active", true)
    .neq("id", user.id)
    .order("full_name")

  const userList = (users ?? []).map((u: any) => ({
    id: u.id,
    name: u.display_name || u.full_name || "Unknown",
  }))

  return <NewComplaintClient users={userList} currentUserId={user.id} />
}
