import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import LeaveClient from "./leave-client"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function LeavePage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const currentYear = new Date().getFullYear()
  const lastYear = currentYear - 1

  const [{ data: balances }, { data: requests }, { data: lastYearBal }, { data: userProfile }] = await Promise.all([
    supabase
      .from("leave_balances")
      .select("*")
      .eq("user_id", user.id)
      .eq("year", currentYear)
      .order("leave_type"),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("leave_balances")
      .select("total, used, pending")
      .eq("user_id", user.id)
      .eq("leave_type", "annual" as any)
      .eq("year", lastYear)
      .single(),
    (supabaseAdmin as any)
      .from("user_profiles")
      .select("max_carry_forward, carry_forward_days")
      .eq("id", user.id)
      .single(),
  ])

  // Compute carry the same way the admin Leave Allowances page does
  const maxCarry = userProfile?.max_carry_forward ?? 5
  let annualCarry = 0
  if (lastYearBal) {
    const remaining = Math.max(0, Number(lastYearBal.total) - Number(lastYearBal.used) - Number(lastYearBal.pending))
    annualCarry = Math.min(remaining, maxCarry)
  } else {
    annualCarry = userProfile?.carry_forward_days ?? 0
  }

  // Inject the correctly computed carry_forward into the annual balance
  const enrichedBalances = (balances ?? []).map((b: any) =>
    b.leave_type === "annual" ? { ...b, carried_forward: annualCarry } : b
  )

  return <LeaveClient balances={enrichedBalances} requests={requests ?? []} />
}
