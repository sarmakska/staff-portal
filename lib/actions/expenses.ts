'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/actions/auth'
import {
  sendExpenseSubmittedEmail,
  sendExpenseApprovedEmail,
  sendExpenseRejectedEmail,
  sendPurchaseRequestSubmittedEmail,
  sendPurchaseRequestDecisionEmail,
} from '@/lib/email'
import type { ExpenseApprovalChain } from '@/types/database'
import { EXPENSE_ERRORS } from '@/lib/constants/errors'

// Helper to get admin client with fresh env vars
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('[SUPABASE] Missing env vars - URL:', !!url, 'Key:', !!key)
    throw new Error('Supabase configuration missing')
  }

  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
    global: { headers: { 'x-my-custom-header': 'service-role' } }
  })
}

// Legacy module-level client for backward compatibility
// Use getSupabaseAdmin() for critical operations like INSERT
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Helpers ──────────────────────────────────────────────────

async function getExchangeRate(from: string, to = 'GBP'): Promise<number> {
  if (from === to) return 1
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=${to}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) {
      console.error(`[ExchangeRate] API returned ${res.status} for ${from}->${to}`)
      return 1
    }
    const data = await res.json()
    if (!data.rates || data.rates[to] === undefined) {
      console.error(`[ExchangeRate] No rate found for ${from}->${to}`, data)
      return 1
    }
    return data.rates[to]
  } catch (err: any) {
    console.error(`[ExchangeRate] Failed to fetch rate for ${from}->${to}:`, err.message)
    return 1
  }
}

async function getApproversForChain(chainId: string, step: number): Promise<{ email: string; name: string }[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: chain } = await supabaseAdmin
    .from('expense_approval_chains')
    .select('steps')
    .eq('id', chainId)
    .single()

  if (!chain) return []
  const steps = chain.steps as ExpenseApprovalChain['steps']
  const stepDef = steps[step]
  if (!stepDef) return []

  if (stepDef.user_id) {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', stepDef.user_id)
      .single()
    return profile ? [{ email: profile.email, name: profile.full_name }] : []
  }

  if (stepDef.role) {
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', stepDef.role)
    if (!roles?.length) return []
    const ids = roles.map(r => r.user_id)
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('email, full_name')
      .in('id', ids)
      .eq('is_active', true)
    return (profiles ?? []).map(p => ({ email: p.email, name: p.full_name }))
  }

  return []
}

// ── Categories ───────────────────────────────────────────────

export async function getExpenseCategories() {
  const { data } = await supabaseAdmin
    .from('expense_categories')
    .select('*')
    .order('name')
  return data ?? []
}

export async function createExpenseCategory(name: string, icon: string, color: string, gl_code?: string) {
  const user = await getCurrentUser()

  const { data, error } = await supabaseAdmin
    .from('expense_categories')
    .insert({ name, icon, color, gl_code: gl_code || null, created_by: user?.id ?? null })
    .select()
    .single()

  return error ? { success: false, error: error.message } : { success: true, data }
}

export async function updateExpenseCategory(id: string, payload: { name?: string; color?: string; icon?: string; gl_code?: string }) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { error } = await supabaseAdmin
    .from('expense_categories')
    .update({ ...payload, gl_code: payload.gl_code ?? null })
    .eq('id', id)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function deleteExpenseCategory(id: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { error } = await supabaseAdmin.from('expense_categories').delete().eq('id', id)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function getDepartmentsForExpenses() {
  const { data } = await supabaseAdmin
    .from('departments')
    .select('id, name')
    .order('name')
  return (data ?? []) as { id: string; name: string }[]
}

// ── Company Cards ─────────────────────────────────────────────

export async function getCompanyCards() {
  const { data } = await supabaseAdmin
    .from('company_cards')
    .select('*, user_profiles(id, full_name, display_name, email)')
    .eq('is_active', true)
    .order('label')
  return (data ?? []) as any[]
}

export async function createCompanyCard(payload: {
  label: string; last4: string; card_holder: string; card_type: string; user_id?: string | null
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const supabase = await createClient()
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const userRoles = (roles ?? []).map(r => r.role)
  if (!userRoles.includes('admin') && !userRoles.includes('director') && !userRoles.includes('accounts'))
    return { success: false, error: 'Insufficient permissions' }

  const { data, error } = await supabaseAdmin
    .from('company_cards')
    .insert(payload as any)
    .select()
    .single()
  return error ? { success: false, error: error.message } : { success: true, data }
}

export async function updateCompanyCard(id: string, payload: Partial<{ label: string; last4: string; card_holder: string; card_type: string; is_active: boolean }>) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabaseAdmin.from('company_cards').update(payload).eq('id', id)
  return error ? { success: false, error: error.message } : { success: true }
}

// ── Approval Chains ───────────────────────────────────────────

export async function getApprovalChains() {
  const { data } = await supabaseAdmin
    .from('expense_approval_chains')
    .select('*')
    .order('name')
  return data ?? []
}

export async function saveApprovalChain(payload: {
  id?: string; name: string; steps: ExpenseApprovalChain['steps']; is_default?: boolean
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const supabase = await createClient()
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const userRoles = (roles ?? []).map(r => r.role)
  if (!userRoles.includes('admin') && !userRoles.includes('director') && !userRoles.includes('accounts'))
    return { success: false, error: 'Insufficient permissions' }

  if (payload.is_default) {
    await supabaseAdmin.from('expense_approval_chains').update({ is_default: false }).neq('id', payload.id ?? '')
  }

  if (payload.id) {
    const { error } = await supabaseAdmin
      .from('expense_approval_chains')
      .update({ name: payload.name, steps: payload.steps, is_default: payload.is_default ?? false })
      .eq('id', payload.id)
    return error ? { success: false, error: error.message } : { success: true }
  }

  const { data, error } = await supabaseAdmin
    .from('expense_approval_chains')
    .insert({ name: payload.name, steps: payload.steps, is_default: payload.is_default ?? false, created_by: user.id })
    .select()
    .single()
  return error ? { success: false, error: error.message } : { success: true, data }
}

export async function deleteApprovalChain(id: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { error } = await supabaseAdmin.from('expense_approval_chains').delete().eq('id', id)
  return error ? { success: false, error: error.message } : { success: true }
}

// ── Expenses ──────────────────────────────────────────────────

export async function getMyExpenses() {
  const user = await getCurrentUser()
  if (!user) return []

  console.log('[getMyExpenses] Fetching expenses for user:', user.id)

  const { data, error } = await supabaseAdmin
    .from('expenses')
    .select('*, expense_categories(*), company_cards(*), departments(id,name), expense_approvals(*, user_profiles(full_name,email))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getMyExpenses] Error:', error.message, error.code, error.details)
  } else {
    console.log('[getMyExpenses] Success! Found', data?.length || 0, 'expenses')
    if (data && data.length > 0) {
      console.log('[getMyExpenses] Sample expense:', data[0].id, data[0].description)
    }
  }

  return (data ?? []) as any[]
}

export async function getAllExpenses(month?: string) {
  let query = supabaseAdmin
    .from('expenses')
    .select('*, expense_categories(*), company_cards(*), departments(id,name), user_profiles!expenses_user_id_fkey(full_name,email,display_name), expense_approvals(*, user_profiles(full_name,email))')
    .order('date', { ascending: false })

  if (month) {
    const start = `${month}-01`
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0)
      .toISOString().split('T')[0]
    query = query.gte('date', start).lte('date', end)
  }

  const { data } = await query
  return (data ?? []) as any[]
}

export async function getPendingApprovals() {
  const user = await getCurrentUser()
  if (!user) return { expenses: [], prs: [] }

  const { data: expenses } = await supabaseAdmin
    .from('expenses')
    .select('*, expense_categories(*), company_cards(*), departments(id,name), user_profiles!expenses_user_id_fkey(full_name,email,display_name)')
    .eq('status', 'submitted')
    .eq('direct_approver_id', user.id)
    .order('submitted_at', { ascending: true })

  const { data: prsRaw } = await supabaseAdmin
    .from('purchase_requests')
    .select('*, pr_attachments(*)')
    .eq('status', 'submitted')
    .eq('direct_approver_id', user.id)
    .order('submitted_at', { ascending: true })

  const prUserIds = [...new Set((prsRaw ?? []).map((p: any) => p.user_id).filter(Boolean))]
  let prProfiles: any[] = []
  if (prUserIds.length) {
    const { data: pp } = await supabaseAdmin.from('user_profiles').select('id,full_name,email,display_name').in('id', prUserIds)
    prProfiles = pp ?? []
  }
  const prs = (prsRaw ?? []).map((p: any) => ({ ...p, user_profiles: prProfiles.find((u: any) => u.id === p.user_id) ?? null }))

  return { expenses: (expenses ?? []) as any[], prs: prs as any[] }
}

export async function submitExpense(formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: EXPENSE_ERRORS.UNAUTHORIZED }

  // Validate amount
  const amountStr = String(formData.get('amount') || '0')
  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0 || amount > 1000000) {
    return { success: false, error: EXPENSE_ERRORS.INVALID_AMOUNT }
  }

  // Validate currency
  const VALID_CURRENCIES = ['GBP', 'USD', 'EUR', 'AED', 'SAR', 'TRY', 'CHF', 'JPY', 'CAD', 'AUD']
  const currency = String(formData.get('currency') || 'GBP')
  if (!VALID_CURRENCIES.includes(currency)) {
    return { success: false, error: EXPENSE_ERRORS.INVALID_CURRENCY }
  }

  // Validate date
  const dateStr = String(formData.get('date'))
  if (!dateStr) return { success: false, error: EXPENSE_ERRORS.INVALID_DATE }
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return { success: false, error: EXPENSE_ERRORS.INVALID_DATE }
  }
  // Block future-dated expenses (allow up to 1 day ahead for timezone tolerance)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  if (date > tomorrow) {
    return { success: false, error: 'Expense date cannot be in the future.' }
  }

  // Validate description
  const description = String(formData.get('description') || '').trim()
  if (!description || description.length < 3) {
    return { success: false, error: EXPENSE_ERRORS.INVALID_DESCRIPTION }
  }

  const exchangeRate = await getExchangeRate(currency)
  const convertedGbp = Math.round(amount * exchangeRate * 100) / 100
  const paymentMethod = String(formData.get('payment_method') || 'company_card')
  const expenseType = (paymentMethod === 'company_card' || paymentMethod === 'company_cash') ? 'record' : 'claim'

  // Admin can submit on behalf of another user
  const onBehalfOfId = String(formData.get('on_behalf_of_user_id') || '') || null
  const { data: rolesData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
  const isAdmin = (rolesData ?? []).some((r: any) => r.role === 'admin')
  const targetUserId = (isAdmin && onBehalfOfId) ? onBehalfOfId : user.id

  // Check if target user has auto-approve enabled
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name, email, expense_auto_approve')
    .eq('id', targetUserId)
    .single()

  const autoApprove = profile?.expense_auto_approve ?? false
  const directApproverId = String(formData.get('direct_approver_id') || '') || null

  const needsApproval = !autoApprove && (paymentMethod === 'personal_card' || paymentMethod === 'personal_cash')
  if (needsApproval && !directApproverId) {
    return { success: false, error: EXPENSE_ERRORS.MISSING_APPROVER }
  }
  // Block self-approval
  if (needsApproval && directApproverId === targetUserId) {
    return { success: false, error: 'You cannot set yourself as the approver.' }
  }

  // Duplicate detection: same user, same amount (±5%), same date (±2 days)
  const dupSkip = String(formData.get('skip_duplicate_check') || '') === 'true'
  if (!dupSkip) {
    const dateFrom = new Date(dateStr); dateFrom.setDate(dateFrom.getDate() - 2)
    const dateTo   = new Date(dateStr); dateTo.setDate(dateTo.getDate() + 2)
    const { data: dupes } = await supabaseAdmin
      .from('expenses')
      .select('id, amount, date, description')
      .eq('user_id', targetUserId)
      .gte('date', dateFrom.toISOString().split('T')[0])
      .lte('date', dateTo.toISOString().split('T')[0])
      .not('status', 'eq', 'rejected')
    if (dupes && dupes.length > 0) {
      const nearDupe = dupes.find((d: any) => Math.abs(d.amount - amount) / Math.max(amount, 1) < 0.05)
      if (nearDupe) {
        return {
          success: false,
          error: 'DUPLICATE_WARNING',
          duplicate: { id: nearDupe.id, amount: nearDupe.amount, date: nearDupe.date, description: nearDupe.description }
        }
      }
    }
  }

  // VAT calculation
  const includesVat = String(formData.get('includes_vat') || '') === 'true'
  const vatRatePct = includesVat ? parseFloat(String(formData.get('vat_rate') || '20')) : 0
  const vatAmountVal = includesVat && vatRatePct > 0
    ? Math.round((amount * vatRatePct / (100 + vatRatePct)) * 100) / 100
    : null
  const netAmountVal = vatAmountVal !== null ? Math.round((amount - vatAmountVal) * 100) / 100 : null

  console.log('[EXPENSE] Inserting expense with service role...')
  console.log('[EXPENSE] User ID:', user.id)
  console.log('[EXPENSE] Amount:', amount, currency)
  console.log('[EXPENSE] Service role key configured:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: expense, error } = await supabaseAdmin
    .from('expenses')
    .insert({
      user_id: targetUserId,
      amount,
      currency,
      converted_gbp: convertedGbp,
      exchange_rate: exchangeRate,
      category_id: String(formData.get('category_id') || '') || null,
      date: dateStr,
      description,
      merchant: String(formData.get('merchant') || '') || null,
      card_id: String(formData.get('card_id') || '') || null,
      receipt_url: String(formData.get('receipt_url') || '') || null,
      receipt_data: (() => { try { const v = formData.get('receipt_data'); return v ? JSON.parse(String(v)) : null } catch { return null } })(),
      direct_approver_id: needsApproval ? directApproverId : null,
      payment_method: paymentMethod,
      expense_type: expenseType,
      requires_approval: needsApproval,
      status: needsApproval ? 'submitted' : 'approved',
      submitted_at: new Date().toISOString(),
      // VAT fields
      vat_amount: vatAmountVal,
      vat_rate: includesVat ? vatRatePct : null,
      net_amount: netAmountVal,
      vat_number: String(formData.get('vat_number') || '') || null,
      receipt_number: String(formData.get('receipt_number') || '') || null,
      // Department
      department_id: String(formData.get('department_id') || '') || null,
    } as any)
    .select()
    .single()

  console.log('[EXPENSE] Insert result - Error:', error)
  console.log('[EXPENSE] Insert result - Data:', expense)

  if (error) {
    console.error('[EXPENSE] Database error:', error.message, error.code, error.details)
    return { success: false, error: error.message }
  }

  // Audit log: created
  await (supabaseAdmin as any).from('expense_audit_log').insert({
    expense_id: expense.id,
    user_id: user.id,
    action: 'created',
    changes: null,
  })

  // Get submitter profile for email
  const { data: submitterProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  // Email the selected approver directly (personal claims only)
  if (needsApproval && directApproverId) {
    const { data: approverProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', directApproverId)
      .single()
    if (approverProfile) {
      await sendExpenseSubmittedEmail({
        approverEmail: approverProfile.email,
        approverName: approverProfile.full_name ?? 'Approver',
        employeeName: submitterProfile?.full_name ?? 'Employee',
        amount: `${currency} ${amount.toFixed(2)}`,
        description: String(formData.get('description')),
        merchant: String(formData.get('merchant') || ''),
        date: String(formData.get('date')),
        expenseId: expense.id,
      })
    }
  }

  return { success: true, data: expense }
}

export async function updateExpense(expenseId: string, formData: FormData) {
  const supabaseAdmin = getSupabaseAdmin()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const amountStr = String(formData.get('amount') || '0')
  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) return { success: false, error: 'Invalid amount' }

  const currency = String(formData.get('currency') || 'GBP')
  const dateStr = String(formData.get('date'))
  const description = String(formData.get('description') || '').trim()
  if (!description) return { success: false, error: 'Description is required' }

  const exchangeRate = await getExchangeRate(currency)
  const convertedGbp = Math.round(amount * exchangeRate * 100) / 100

  const paymentMethod = String(formData.get('payment_method') || 'company_card')
  const includesVat = String(formData.get('includes_vat') || '') === 'true'
  const vatRatePct = includesVat ? parseFloat(String(formData.get('vat_rate') || '20')) : 0
  const vatAmountVal = includesVat && vatRatePct > 0
    ? Math.round((amount * vatRatePct / (100 + vatRatePct)) * 100) / 100
    : null
  const netAmountVal = vatAmountVal !== null ? Math.round((amount - vatAmountVal) * 100) / 100 : null

  const receiptUrl = String(formData.get('receipt_url') || '') || null

  // Admin can reassign expense to another user
  const { data: editRoles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
  const isAdminEdit = (editRoles ?? []).some((r: any) => r.role === 'admin')
  const editUserId = isAdminEdit ? (String(formData.get('edit_user_id') || '') || null) : null

  // Fetch existing expense for audit diff
  const { data: existing } = await supabaseAdmin
    .from('expenses')
    .select('amount, currency, description, merchant, category_id, date, payment_method, department_id, receipt_number, vat_amount, vat_rate')
    .eq('id', expenseId)
    .single()

  const updatePayload: any = {
      amount,
      currency,
      converted_gbp: convertedGbp,
      exchange_rate: exchangeRate,
      category_id: String(formData.get('category_id') || '') || null,
      date: dateStr,
      description,
      merchant: String(formData.get('merchant') || '') || null,
      payment_method: paymentMethod,
      expense_type: paymentMethod === 'company_card' ? 'record' : 'claim',
      card_id: String(formData.get('card_id') || '') || null,
      receipt_url: receiptUrl,
      vat_amount: vatAmountVal,
      vat_rate: includesVat ? vatRatePct : null,
      net_amount: netAmountVal,
      vat_number: String(formData.get('vat_number') || '') || null,
      receipt_number: String(formData.get('receipt_number') || '') || null,
      department_id: String(formData.get('department_id') || '') || null,
  }
  if (editUserId) updatePayload.user_id = editUserId

  const { error } = await supabaseAdmin
    .from('expenses')
    .update(updatePayload)
    .eq('id', expenseId)

  if (error) return { success: false, error: error.message }

  // Build audit diff
  const changes: Record<string, { from: any; to: any }> = {}
  const auditFields = ['amount', 'currency', 'description', 'merchant', 'category_id', 'date', 'payment_method', 'department_id', 'receipt_number', 'vat_amount', 'vat_rate'] as const
  for (const field of auditFields) {
    const oldVal = (existing as any)?.[field] ?? null
    const newVal = updatePayload[field] ?? null
    if (String(oldVal) !== String(newVal)) changes[field] = { from: oldVal, to: newVal }
  }
  if (Object.keys(changes).length > 0) {
    await (supabaseAdmin as any).from('expense_audit_log').insert({
      expense_id: expenseId,
      user_id: user.id,
      action: 'updated',
      changes,
    })
  }

  return { success: true }
}

export async function updateExpenseStatus(
  expenseId: string,
  decision: 'approved' | 'rejected',
  note?: string
) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: expense } = await supabaseAdmin
    .from('expenses')
    .select('*, user_profiles!expenses_user_id_fkey(full_name,email), expense_approval_chains(*)')
    .eq('id', expenseId)
    .single()

  if (!expense) return { success: false, error: 'Expense not found' }

  // Record approval
  await supabaseAdmin.from('expense_approvals').insert({
    expense_id: expenseId,
    step: expense.current_step,
    approver_id: user.id,
    decision,
    note: note || null,
    decided_at: new Date().toISOString(),
  })

  const chain = expense.expense_approval_chains as ExpenseApprovalChain | null
  const steps = chain?.steps ?? []
  const currentExpenseStep = expense.current_step ?? 0
  const nextStep = currentExpenseStep + 1

  if (decision === 'rejected') {
    await supabaseAdmin
      .from('expenses')
      .update({ status: 'rejected', notes: note || null })
      .eq('id', expenseId)
    await (supabaseAdmin as any).from('expense_audit_log').insert({ expense_id: expenseId, user_id: user.id, action: 'rejected', changes: note ? { note } : null })

    const employeeProfile = expense.user_profiles as { full_name: string; email: string } | null
    if (employeeProfile) {
      await sendExpenseRejectedEmail({
        employeeEmail: employeeProfile.email,
        employeeName: employeeProfile.full_name,
        amount: `${expense.currency} ${expense.amount}`,
        description: expense.description,
        reason: note ?? 'No reason provided',
        expenseId,
      })
    }
  } else if (steps.length === 0 || nextStep >= steps.length) {
    // All steps approved (or no chain = direct approval)
    await supabaseAdmin
      .from('expenses')
      .update({ status: 'approved', current_step: nextStep })
      .eq('id', expenseId)
    await (supabaseAdmin as any).from('expense_audit_log').insert({ expense_id: expenseId, user_id: user.id, action: 'approved', changes: note ? { note } : null })

    const employeeProfile = expense.user_profiles as { full_name: string; email: string } | null
    const isPersonalClaim = expense.payment_method === 'personal_card' || expense.payment_method === 'personal_cash'

    if (employeeProfile) {
      await sendExpenseApprovedEmail({
        employeeEmail: employeeProfile.email,
        employeeName: employeeProfile.full_name,
        amount: `${expense.currency} ${expense.amount}`,
        description: expense.description,
        expenseId,
      })
    }

    // Only notify accounts for personal claims (reimbursement needed)
    if (isPersonalClaim) {
      const { data: accountsRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'accounts')
      const accountsUserIds = (accountsRoles ?? []).map((r: any) => r.user_id).filter(Boolean)
      let accountsUsers: any[] = []
      if (accountsUserIds.length) {
        const { data: ap } = await supabaseAdmin
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', accountsUserIds)
        accountsUsers = ap ?? []
      }
      if (accountsUsers.length > 0) {
        for (const ap of accountsUsers) {
          if (ap?.email) {
            await sendExpenseApprovedEmail({
              employeeEmail: ap.email,
              employeeName: ap.full_name ?? 'Accounts',
              amount: `${expense.currency} ${expense.amount}`,
              description: expense.description,
              expenseId,
              receiptUrl: expense.receipt_url ?? undefined,
              isFinance: true,
              accountsName: ap.full_name ?? 'Accounts Team',
              submittedBy: (expense.user_profiles as any)?.full_name ?? 'Employee',
            })
          }
        }
      }
    }
  } else {
    // Advance to next step
    await supabaseAdmin
      .from('expenses')
      .update({ current_step: nextStep })
      .eq('id', expenseId)

    if (chain?.id) {
      const approvers = await getApproversForChain(chain.id, nextStep)
      for (const approver of approvers) {
        await sendExpenseSubmittedEmail({
          approverEmail: approver.email,
          approverName: approver.name,
          employeeName: (expense.user_profiles as any)?.full_name ?? 'Employee',
          amount: `${expense.currency} ${expense.amount}`,
          description: expense.description,
          merchant: expense.merchant ?? '',
          date: expense.date,
          expenseId,
        })
      }
    }
  }

  return { success: true }
}

export async function markExpensePaid(
  expenseId: string,
  reimbursement?: { via: string; ref: string; date: string }
) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const updatePayload: any = { status: 'paid' }
  if (reimbursement?.via) {
    updatePayload.reimbursed_via = reimbursement.via
    updatePayload.reimbursement_ref = reimbursement.ref || null
    updatePayload.reimbursed_at = reimbursement.date ? new Date(reimbursement.date).toISOString() : new Date().toISOString()
  }
  const { error } = await (supabaseAdmin as any)
    .from('expenses')
    .update(updatePayload)
    .eq('id', expenseId)
    .eq('status', 'approved')
  if (error) return { success: false, error: error.message }
  await (supabaseAdmin as any).from('expense_audit_log').insert({
    expense_id: expenseId,
    user_id: user.id,
    action: 'paid',
    changes: reimbursement ? { reimbursed_via: reimbursement.via, reimbursement_ref: reimbursement.ref, reimbursed_at: reimbursement.date } : null,
  })
  return { success: true }
}

export async function bulkMarkExpensesPaid(
  expenseIds: string[],
  reimbursement: { via: string; ref: string; date: string }
) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  if (!expenseIds.length) return { success: false, error: 'No expenses selected' }
  const updatePayload: any = {
    status: 'paid',
    reimbursed_via: reimbursement.via || null,
    reimbursement_ref: reimbursement.ref || null,
    reimbursed_at: reimbursement.date ? new Date(reimbursement.date).toISOString() : new Date().toISOString(),
  }
  const { error } = await (supabaseAdmin as any)
    .from('expenses')
    .update(updatePayload)
    .in('id', expenseIds)
    .eq('status', 'approved')
  if (error) return { success: false, error: error.message }
  // Audit log for each
  const logs = expenseIds.map(id => ({
    expense_id: id,
    user_id: user.id,
    action: 'paid',
    changes: { reimbursed_via: reimbursement.via, reimbursement_ref: reimbursement.ref, reimbursed_at: reimbursement.date },
  }))
  await (supabaseAdmin as any).from('expense_audit_log').insert(logs)
  return { success: true }
}

export async function addExpenseComment(expenseId: string, message: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  if (!message.trim()) return { success: false, error: 'Message cannot be empty' }
  const { data, error } = await (supabaseAdmin as any)
    .from('expense_comments')
    .insert({ expense_id: expenseId, user_id: user.id, message: message.trim() })
    .select('*, user_profiles(full_name,display_name)')
    .single()
  return error ? { success: false, error: error.message } : { success: true, data }
}

export async function getExpenseComments(expenseId: string) {
  const { data } = await (supabaseAdmin as any)
    .from('expense_comments')
    .select('*, user_profiles(full_name,display_name)')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: true })
  return (data ?? []) as any[]
}

export async function getExpenseAuditLog(expenseId: string) {
  const { data } = await (supabaseAdmin as any)
    .from('expense_audit_log')
    .select('*, user_profiles(full_name,display_name)')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: false })
  return (data ?? []) as any[]
}

// ── Purchase Requests ─────────────────────────────────────────

export async function getMyPurchaseRequests() {
  const user = await getCurrentUser()
  if (!user) return []
  const { data } = await supabaseAdmin
    .from('purchase_requests')
    .select('*, pr_approvals(*), pr_attachments(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []) as any[]
}

export async function getAllPurchaseRequests() {
  const { data: raw } = await supabaseAdmin
    .from('purchase_requests')
    .select('*, pr_approvals(*), pr_attachments(*)')
    .order('submitted_at', { ascending: false })
  const userIds = [...new Set((raw ?? []).map((p: any) => p.user_id).filter(Boolean))]
  let profiles: any[] = []
  if (userIds.length) {
    const { data: pp } = await supabaseAdmin.from('user_profiles').select('id,full_name,email,display_name').in('id', userIds)
    profiles = pp ?? []
  }
  return (raw ?? []).map((p: any) => ({ ...p, user_profiles: profiles.find((u: any) => u.id === p.user_id) ?? null })) as any[]
}

export async function submitPurchaseRequest(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const currency = String(formData.get('currency') || 'GBP')
  const estimatedCost = parseFloat(String(formData.get('estimated_cost') || '0'))
  const exchangeRate = await getExchangeRate(currency)

  const directApproverId = String(formData.get('direct_approver_id') || '') || null

  if (!directApproverId) {
    return { success: false, error: 'Please select an approver for this purchase request.' }
  }

  const { data: pr, error } = await supabaseAdmin
    .from('purchase_requests')
    .insert({
      user_id: user.id,
      item_name: String(formData.get('item_name')),
      description: String(formData.get('description') || '') || null,
      estimated_cost: estimatedCost,
      currency,
      converted_gbp: estimatedCost * exchangeRate,
      exchange_rate: exchangeRate,
      supplier: String(formData.get('supplier') || '') || null,
      justification: String(formData.get('justification') || '') || null,
      urgency: String(formData.get('urgency') || 'medium'),
      direct_approver_id: directApproverId,
      status: 'submitted',
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Handle file attachments (URLs passed from client after upload)
  const attachments = formData.getAll('attachment_urls[]')
  const attachmentNames = formData.getAll('attachment_names[]')
  if (attachments.length) {
    await supabaseAdmin.from('pr_attachments').insert(
      attachments.map((url, i) => ({
        pr_id: pr.id,
        file_url: String(url),
        file_name: String(attachmentNames[i] ?? `attachment-${i + 1}`),
      }))
    )
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  if (directApproverId) {
    const { data: approverProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', directApproverId)
      .single()
    if (approverProfile) {
      await sendPurchaseRequestSubmittedEmail({
        approverEmail: approverProfile.email,
        approverName: approverProfile.full_name ?? 'Approver',
        employeeName: profile?.full_name ?? 'Employee',
        itemName: String(formData.get('item_name')),
        estimatedCost: `${currency} ${estimatedCost.toFixed(2)}`,
        urgency: String(formData.get('urgency') || 'medium'),
        justification: String(formData.get('justification') || ''),
        prId: pr.id,
      })
    }
  }

  return { success: true, data: pr }
}

export async function updatePurchaseRequestStatus(
  prId: string,
  decision: 'approved' | 'rejected' | 'ordered',
  note?: string
) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Fetch PR without any FK joins (PostgREST schema cache issue on new tables)
  const { data: pr, error: prErr } = await supabaseAdmin
    .from('purchase_requests')
    .select('id, user_id, item_name, description, estimated_cost, currency, converted_gbp, exchange_rate, supplier, current_step, status, approval_chain_id')
    .eq('id', prId)
    .single()

  if (prErr || !pr) return { success: false, error: 'Purchase request not found' }

  // Fetch employee profile separately
  const { data: employeeProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('full_name, email')
    .eq('id', pr.user_id)
    .single()

  if (decision === 'ordered') {
    await supabaseAdmin.from('purchase_requests').update({ status: 'ordered', notes: note || null }).eq('id', prId)
    return { success: true }
  }

  // Log the approval/rejection
  const { error: insertErr } = await (supabaseAdmin as any).from('pr_approvals').insert({
    pr_id: prId,
    step: pr.current_step ?? 0,
    approver_id: user.id,
    decision,
    note: note || null,
    decided_at: new Date().toISOString(),
  })
  if (insertErr) console.error('[PR] pr_approvals insert error:', insertErr.message)

  // Fetch approval chain separately if one is set
  let steps: any[] = []
  if (pr.approval_chain_id) {
    const { data: chain } = await supabaseAdmin
      .from('expense_approval_chains')
      .select('steps')
      .eq('id', pr.approval_chain_id)
      .single()
    steps = (chain as any)?.steps ?? []
  }

  const currentStep = pr.current_step ?? 0
  const nextStep = currentStep + 1
  const newStatus = decision === 'rejected'
    ? 'rejected'
    : (steps.length === 0 || nextStep >= steps.length) ? 'approved' : 'submitted'

  const { error: updateErr } = await supabaseAdmin
    .from('purchase_requests')
    .update({ status: newStatus, current_step: nextStep, notes: note || null })
    .eq('id', prId)
  if (updateErr) return { success: false, error: updateErr.message }

  // Auto-create an expense record when fully approved
  if (newStatus === 'approved') {
    const today = new Date().toISOString().split('T')[0]
    const desc = (pr as any).item_name + ((pr as any).description ? ` — ${(pr as any).description}` : '')
    const { data: newExpense } = await supabaseAdmin.from('expenses').insert({
      user_id: (pr as any).user_id,
      amount: (pr as any).estimated_cost,
      currency: (pr as any).currency ?? 'GBP',
      converted_gbp: (pr as any).converted_gbp ?? (pr as any).estimated_cost,
      exchange_rate: (pr as any).exchange_rate ?? 1,
      description: desc,
      merchant: (pr as any).supplier ?? null,
      payment_method: 'company_card',
      expense_type: 'record',
      requires_approval: false,
      status: 'approved',
      date: today,
      submitted_at: new Date().toISOString(),
    } as any).select('id').single()
    if (newExpense?.id) {
      await (supabaseAdmin as any)
        .from('purchase_requests')
        .update({ expense_id: newExpense.id })
        .eq('id', prId)
    }
  }

  if (employeeProfile?.email) {
    await sendPurchaseRequestDecisionEmail({
      employeeEmail: employeeProfile.email,
      employeeName: employeeProfile.full_name ?? 'Employee',
      itemName: pr.item_name,
      decision,
      note: note ?? '',
      prId,
    })
  }

  return { success: true }
}

export async function cancelPurchaseRequest(prId: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: pr } = await supabaseAdmin
    .from('purchase_requests')
    .select('user_id, status')
    .eq('id', prId)
    .single()
  if (!pr) return { success: false, error: 'Not found' }
  if (pr.user_id !== user.id && !user.isAdmin && !user.isDirector) {
    return { success: false, error: 'Only the submitter or an admin can cancel this request.' }
  }
  await supabaseAdmin.from('purchase_requests').update({ status: 'cancelled' }).eq('id', prId)
  return { success: true }
}

export async function deletePurchaseRequest(prId: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data: pr } = await supabaseAdmin
    .from('purchase_requests')
    .select('user_id, status')
    .eq('id', prId)
    .single()
  if (!pr) return { success: false, error: 'Not found' }
  if (!['rejected', 'cancelled'].includes(pr.status))
    return { success: false, error: 'Only rejected or cancelled requests can be deleted' }
  if (pr.user_id !== user.id && !user.isAdmin && !user.isDirector)
    return { success: false, error: 'Only the submitter or an admin can delete this request.' }
  const { error } = await (supabaseAdmin as any).from('purchase_requests').delete().eq('id', prId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Auto-approve toggle (admin/director only) ─────────────────

export async function toggleExpenseAutoApprove(userId: string, value: boolean) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const supabase = await createClient()
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const userRoles = (roles ?? []).map(r => r.role)
  if (!userRoles.includes('admin') && !userRoles.includes('director') && !userRoles.includes('accounts'))
    return { success: false, error: 'Insufficient permissions' }

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ expense_auto_approve: value })
    .eq('id', userId)

  return error ? { success: false, error: error.message } : { success: true }
}

export async function getAllUsersForExpenseSettings() {
  const user = await getCurrentUser()
  if (!user) return []
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('id, full_name, email, display_name, expense_auto_approve')
    .eq('is_active', true)
    .order('full_name')
  return data ?? []
}

// ── Analytics ─────────────────────────────────────────────────

export async function getExpenseAnalytics(months = 6) {
  const since = new Date()
  since.setMonth(since.getMonth() - months)
  const sinceStr = since.toISOString().split('T')[0]

  const { data: expenses } = await supabaseAdmin
    .from('expenses')
    .select('*, expense_categories(name,color), user_profiles!expenses_user_id_fkey(full_name)')
    .gte('date', sinceStr)
    .in('status', ['approved', 'paid'])

  return (expenses ?? []) as any[]
}

// mode='monthly': period = month number (1-12), year = calendar year
// mode='quarterly': period = quarter (1-4), year = UK FY start year
//   UK FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar(next year)
export async function getExpenseAnalyticsPeriod(
  mode: 'monthly' | 'quarterly',
  year: number,
  period: number
) {
  let startDate: string
  let endDate: string

  if (mode === 'monthly') {
    startDate = `${year}-${String(period).padStart(2, '0')}-01`
    const lastDay = new Date(year, period, 0).getDate()
    endDate = `${year}-${String(period).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  } else {
    const quarterRanges: Record<number, [string, string]> = {
      1: [`${year}-04-01`,     `${year}-06-30`],
      2: [`${year}-07-01`,     `${year}-09-30`],
      3: [`${year}-10-01`,     `${year}-12-31`],
      4: [`${year + 1}-01-01`, `${year + 1}-03-31`],
    }
    ;[startDate, endDate] = quarterRanges[period] ?? quarterRanges[1]
  }

  const { data } = await supabaseAdmin
    .from('expenses')
    .select('*, expense_categories(name,color), user_profiles!expenses_user_id_fkey(full_name)')
    .gte('date', startDate)
    .lte('date', endDate)
    .in('status', ['approved', 'paid'])
    .order('date', { ascending: true })

  return (data ?? []) as any[]
}

// ── Bank statements ───────────────────────────────────────────

export async function getBankStatements(month: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from('bank_statements')
    .select('*, bank_statement_transactions(*), user_profiles!bank_statements_reconciled_by_fkey(full_name,display_name)')
    .eq('month', month)
    .order('created_at', { ascending: false })
  if (error) {
    // Fallback if reconciled_by FK columns don't exist yet (migration not yet run)
    const { data: fallback } = await (supabaseAdmin as any)
      .from('bank_statements')
      .select('*, bank_statement_transactions(*)')
      .eq('month', month)
      .order('created_at', { ascending: false })
    return (fallback ?? []) as any[]
  }
  return (data ?? []) as any[]
}

export async function deleteBankStatement(id: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { error: txErr } = await (supabaseAdmin as any).from('bank_statement_transactions').delete().eq('statement_id', id)
  if (txErr) return { success: false, error: txErr.message }
  const { error: stmtErr } = await (supabaseAdmin as any).from('bank_statements').delete().eq('id', id)
  if (stmtErr) return { success: false, error: stmtErr.message }
  return { success: true }
}

export async function updateTransactionMatch(
  transactionId: string,
  expenseId: string | null,
  status: 'matched' | 'partial' | 'unmatched' | 'ignored'
) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { error: matchErr } = await (supabaseAdmin as any)
    .from('bank_statement_transactions')
    .update({ matched_expense_id: expenseId, match_status: status })
    .eq('id', transactionId)
  if (matchErr) return { success: false, error: matchErr.message }
  return { success: true }
}

export async function recordBankAdjustment(
  expenseId: string,
  actualAmount: number,
  note: string
) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const supabase = await createClient()
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const userRoles = (roles ?? []).map((r: any) => r.role)
  if (!userRoles.includes('admin') && !userRoles.includes('director') && !userRoles.includes('accounts'))
    return { success: false, error: 'Insufficient permissions' }

  const { data: exp } = await supabaseAdmin.from('expenses').select('converted_gbp, amount').eq('id', expenseId).single()
  const gbp = (exp as any)?.converted_gbp ?? (exp as any)?.amount ?? 0
  const adjustment = Math.round((actualAmount - gbp) * 100) / 100

  const { error } = await supabaseAdmin.from('expenses').update({
    actual_bank_amount: actualAmount,
    bank_adjustment: adjustment,
    bank_adjustment_note: note || null,
    bank_adjustment_by: user.id,
    bank_adjustment_at: new Date().toISOString(),
  } as any).eq('id', expenseId)

  return error ? { success: false, error: error.message } : { success: true, adjustment }
}

export async function markBankStatementReconciled(statementId: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const supabase = await createClient()
  const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const userRoles = (rolesData ?? []).map((r: any) => r.role)
  if (!userRoles.includes('admin') && !userRoles.includes('director') && !userRoles.includes('accounts'))
    return { success: false, error: 'Insufficient permissions' }
  const { error } = await (supabaseAdmin as any)
    .from('bank_statements')
    .update({ reconciled_at: new Date().toISOString(), reconciled_by: user.id })
    .eq('id', statementId)
  return error ? { success: false, error: error.message } : { success: true }
}

export async function getExpenseAnalyticsDirector() {
  const now = new Date()
  const fyStart = now.getMonth() >= 3
    ? `${now.getFullYear()}-04-01`
    : `${now.getFullYear() - 1}-04-01`
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]

  const [{ data: ytdData }, { data: allStatusData }, { data: vatTrendData }] = await Promise.all([
    supabaseAdmin
      .from('expenses')
      .select('id, amount, converted_gbp, payment_method, status, date, expense_categories(name,color), user_profiles!expenses_user_id_fkey(full_name,display_name)')
      .gte('date', fyStart)
      .in('status', ['approved', 'paid']),
    supabaseAdmin
      .from('expenses')
      .select('id, amount, converted_gbp, payment_method, status, date, merchant, user_profiles!expenses_user_id_fkey(full_name,display_name)')
      .gte('date', sixMonthsAgo),
    supabaseAdmin
      .from('expenses')
      .select('date, vat_amount, payment_method, status')
      .gte('date', sixMonthsAgo)
      .in('status', ['approved', 'paid']),
  ])
  return {
    ytd: (ytdData ?? []) as any[],
    allStatus: (allStatusData ?? []) as any[],
    vatTrend: (vatTrendData ?? []) as any[],
  }
}

// ── File upload to Supabase Storage ──────────────────────────

export async function getReceiptUploadUrl(fileName: string, contentType: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const ext = fileName.split('.').pop()
  const path = `receipts/${user.id}/${Date.now()}.${ext}`

  const { data, error } = await supabaseAdmin.storage
    .from('expenses')
    .createSignedUploadUrl(path)

  if (error) return { success: false, error: error.message }
  return { success: true, uploadUrl: data.signedUrl, path }
}

export async function getPublicReceiptUrl(path: string) {
  const { data } = supabaseAdmin.storage.from('expenses').getPublicUrl(path)
  return data.publicUrl
}
