import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import DirectoryClient from "./directory-client"
import { getCurrentUser } from "@/lib/actions/auth"

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>
}) {
  const _authCtx = await getCurrentUser()
  if (!_authCtx) redirect("/login")
  const user = _authCtx

  const supabase = await createClient()
  const { q, tab } = await searchParams

  // Internal staff — RLS allows all authenticated users to read profiles
  let staffQuery = supabase
    .from("user_profiles")
    .select("id, full_name, display_name, job_title, email, phone, gender, desk_extension, is_active, department_id, avatar_url, departments!user_profiles_department_id_fkey(name)")
    .order("full_name")

  if (q && tab !== "external") {
    staffQuery = staffQuery.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,job_title.ilike.%${q}%`)
  }

  // External contacts — use admin client to bypass RLS
  let extQuery = supabaseAdmin
    .from("external_contacts")
    .select("id, added_by, name, email, phone, company, job_title, notes, created_at")
    .order("name")

  if (q && tab === "external") {
    extQuery = extQuery.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
  }

  const [{ data: staffRaw }, { data: contacts }] = await Promise.all([staffQuery, extQuery])
  const staff = (staffRaw ?? []) as any[]

  return (
    <DirectoryClient
      staff={staff}
      contacts={contacts ?? []}
      currentUserId={user.id}
      initialTab={tab ?? "staff"}
      initialQ={q ?? ""}
    />
  )
}
