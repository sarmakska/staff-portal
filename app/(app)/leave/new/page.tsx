import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import NewLeaveClient from "./new-leave-client"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function NewLeaveRequestPage() {
  const supabase = await createClient()
  const _authCtx = await getCurrentUser()
  const user = _authCtx!


  const currentYear = new Date().getFullYear()

  const { data: balances } = await supabase
    .from("leave_balances")
    .select("leave_type")
    .eq("user_id", user.id)
    .eq("year", currentYear)

  const permittedTypes = balances?.map((b) => b.leave_type) || ["annual", "sick", "unpaid"]

  return <NewLeaveClient permittedLeaveTypes={permittedTypes} />
}
