import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/actions/auth"
import { DiaryClient } from "./diary-client"

export default async function DiaryPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: entries } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  return <DiaryClient entries={(entries ?? []) as any[]} />
}
