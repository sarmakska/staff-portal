import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role as string)
    if (!roles.includes('admin') && !roles.includes('director') && !roles.includes('accounts')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { statementId } = await req.json()
    if (!statementId) return NextResponse.json({ error: 'Missing statementId' }, { status: 400 })

    // Fetch statement + cardholder
    const { data: stmt } = await supabaseAdmin
      .from('bank_statements')
      .select('id, month, bank_name, cardholder_user_id')
      .eq('id', statementId)
      .single()

    if (!stmt) return NextResponse.json({ error: 'Statement not found' }, { status: 404 })

    // Get cardholder profile
    let cardholderEmail: string | null = null
    let cardholderName = 'Cardholder'
    if (stmt.cardholder_user_id) {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', stmt.cardholder_user_id)
        .single()
      if (profile) {
        cardholderName = profile.full_name ?? 'Cardholder'
        cardholderEmail = profile.email ?? null
      }
    }

    if (!cardholderEmail) {
      return NextResponse.json({ error: 'No cardholder email found for this statement. The card may not have been matched.' }, { status: 400 })
    }

    // Get unmatched/stub transactions for this statement
    const { data: txns } = await supabaseAdmin
      .from('bank_statement_transactions')
      .select('transaction_date, description, amount, cash_advance_fee, match_status, matched_expense_id')
      .eq('statement_id', statementId)
      .eq('type', 'debit')

    const unstubbed = (txns ?? []).filter((t: any) => {
      // Find transactions where the matched expense has [Receipt needed] (i.e. stubs)
      // Or unmatched transactions
      return t.match_status === 'unmatched' || t.match_status === 'matched'
    })

    // Get all matched expense ids to check which are stubs
    const matchedIds = (txns ?? [])
      .filter((t: any) => t.matched_expense_id)
      .map((t: any) => t.matched_expense_id)

    let stubExpenses: any[] = []
    if (matchedIds.length > 0) {
      const { data: exps } = await supabaseAdmin
        .from('expenses')
        .select('id, description, receipt_url')
        .in('id', matchedIds)
      stubExpenses = exps ?? []
    }

    const stubExpenseIds = new Set(
      stubExpenses
        .filter((e: any) => !e.receipt_url && e.description?.startsWith('[Receipt needed]'))
        .map((e: any) => e.id)
    )

    // Transactions needing receipts = stubs with no receipt
    const needsReceiptTxns = (txns ?? []).filter((t: any) =>
      t.type === 'debit' && t.matched_expense_id && stubExpenseIds.has(t.matched_expense_id)
    )

    if (needsReceiptTxns.length === 0) {
      return NextResponse.json({ error: 'No missing receipts found for this statement.' }, { status: 400 })
    }

    // Build email
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    const resend = new Resend(apiKey)
    const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@yourcompany.com'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'
    const accountsEmail = 'accounts@yourcompany.com'

    const [yearStr, monthStr] = stmt.month.split('-')
    const monthLabel = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1)
      .toLocaleString('en-GB', { month: 'long', year: 'numeric' })

    // March 2026 note
    const isMarch2026 = stmt.month === '2026-03'
    const marchNote = isMarch2026 ? `
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:14px 16px;margin:16px 0;">
        <p style="color:#92400e;margin:0;font-size:13px;font-weight:600;">Note about March 2026</p>
        <p style="color:#92400e;margin:6px 0 0;font-size:13px;">We launched StaffPortal mid-March 2026. Please don't worry about March — from <strong>April 2026</strong> onwards, please upload receipts for all company card purchases as soon as you make them.</p>
      </div>` : ''

    const tableRows = needsReceiptTxns.map((t: any) => {
      const fee = t.cash_advance_fee ? ` + £${Number(t.cash_advance_fee).toFixed(2)} fee` : ''
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${t.transaction_date}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${t.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">£${Number(t.amount).toFixed(2)}${fee}</td>
      </tr>`
    }).join('')

    const totalAmount = needsReceiptTxns.reduce((sum: number, t: any) =>
      sum + Number(t.amount) + (t.cash_advance_fee ? Number(t.cash_advance_fee) : 0), 0)

    const firstName = cardholderName.split(' ')[0]
    const bankLabel = stmt.bank_name ? `${stmt.bank_name} statement` : 'company card statement'

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;">
        <div style="background:#1e3a5f;padding:24px 32px;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Receipts Required — Company Card</h1>
          <p style="color:#93c5fd;margin:8px 0 0;">${monthLabel}</p>
        </div>
        <div style="padding:24px 32px;background:#f9fafb;">
          <p style="color:#374151;">Hi ${firstName},</p>
          <p style="color:#374151;">
            We have uploaded your ${bankLabel} for <strong>${monthLabel}</strong> and found
            <strong>${needsReceiptTxns.length} transaction${needsReceiptTxns.length > 1 ? 's' : ''}</strong>
            with no receipt uploaded in StaffPortal. Total: <strong>£${totalAmount.toFixed(2)}</strong>.
          </p>

          ${marchNote}

          <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);margin:16px 0;">
            <thead>
              <tr style="background:#1e3a5f;">
                <th style="padding:10px 12px;color:#fff;text-align:left;font-size:12px;">Date</th>
                <th style="padding:10px 12px;color:#fff;text-align:left;font-size:12px;">Merchant</th>
                <th style="padding:10px 12px;color:#fff;text-align:right;font-size:12px;">Amount</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>

          <p style="color:#374151;font-weight:600;">These have been added to your expenses in the portal. Please open each one and upload the receipt.</p>

          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:16px 0;">
            <h3 style="margin:0 0 12px;color:#111827;font-size:14px;font-weight:700;">How to upload a receipt:</h3>
            <ol style="color:#374151;padding-left:20px;margin:0;line-height:2.2;font-size:13px;">
              <li>Go to <a href="${appUrl}/expenses" style="color:#2563eb;font-weight:600;">StaffPortal → My Expenses</a></li>
              <li>Find the entry marked <strong>[Receipt needed]</strong></li>
              <li>Click it → click <strong>Edit</strong></li>
              <li>Upload your receipt — AI fills the details automatically</li>
              <li>Check the details and click <strong>Save</strong></li>
            </ol>
          </div>

          <p style="color:#6b7280;font-size:12px;">Questions? Contact accounts at <a href="mailto:${accountsEmail}" style="color:#2563eb;">${accountsEmail}</a></p>
        </div>
      </div>`

    await resend.emails.send({
      from: FROM,
      to: [cardholderEmail],
      subject: `[StaffPortal] Please upload receipts for your company card — ${monthLabel}`,
      html,
    })

    return NextResponse.json({ success: true, sentTo: cardholderEmail, count: needsReceiptTxns.length })
  } catch (err: any) {
    console.error('[BankStmt/SendEmail]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
