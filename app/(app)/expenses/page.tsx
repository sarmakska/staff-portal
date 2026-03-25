import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { createClient as admin } from '@supabase/supabase-js'
import ExpensesClient from './expenses-client'
import { getAllUsersForExpenseSettings } from '@/lib/actions/expenses'

const supabaseAdmin = admin(
  'https://your-supabase-project-ref.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (rolesData ?? []).map(r => r.role as string)
  const isAdmin = roles.includes('admin')
  const isDirector = roles.includes('director')
  const isAccounts = roles.includes('accounts')
  const isManager = roles.includes('manager') || isAdmin || isDirector
  const canSeeAll = isAdmin || isDirector || isAccounts

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('id, full_name, email, display_name, expense_auto_approve')
    .eq('id', user.id)
    .single()

  const [{ tab }, allUsers] = await Promise.all([
    searchParams,
    getAllUsersForExpenseSettings(),
  ])

  return (
    <ExpensesClient
      userId={user.id}
      userProfile={profile}
      roles={roles}
      isAdmin={isAdmin || isAccounts}
      isDirector={isDirector}
      isManager={isManager}
      canSeeAll={canSeeAll}
      initialTab={tab ?? 'my-expenses'}
      allUsers={allUsers}
    />
  )
}
