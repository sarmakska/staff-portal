import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { getEmailFlags } from '@/lib/actions/app-settings'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Shared prompt ─────────────────────────────────────────────

const BANK_STATEMENT_PROMPT = `You are an expert bank statement parser. Extract ALL transactions from this bank statement.

Return ONLY valid JSON with no explanation, no markdown, no code blocks:
{
  "bank_name": "Name of the bank if visible",
  "account_holder": "Account holder name if visible",
  "card_last4": "Last 4 digits of the card number shown on the statement, e.g. 1234",
  "statement_period": "Period shown e.g. March 2026",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Full transaction description as shown",
      "amount": 15.51,
      "type": "debit or credit",
      "foreign_amount": 20.00,
      "foreign_currency": "USD",
      "bank_rate": 1.2894,
      "is_cash_advance": false,
      "cash_advance_fee": null
    }
  ]
}

Rules:
- Include EVERY transaction EXCEPT standalone "CASH ADVANCE FEE" lines — instead, merge those fees into the preceding cash withdrawal transaction's cash_advance_fee field
- Debit = money leaving the account. Credit = money coming in
- amount = the GBP amount the bank charged (always positive, use type for direction)
- For foreign currency transactions (e.g. "20.00 USD @ 1.2894"): set foreign_amount=20.00, foreign_currency="USD", bank_rate=1.2894
- If no foreign currency, set foreign_amount=null, foreign_currency=null, bank_rate=null
- is_cash_advance = true for ATM withdrawals, cash machines, Notemachine entries
- cash_advance_fee = the fee amount shown on the "CASH ADVANCE FEE" line that follows a cash withdrawal (e.g. 3.00), else null
- If date has no year, infer from context
- Return ONLY the JSON, no other text`

// ── Gemini ────────────────────────────────────────────────────

async function parseStatementWithGemini(imageBase64: string, mimeType: string) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key not set')

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: BANK_STATEMENT_PROMPT },
        ]}],
        generationConfig: { temperature: 0, maxOutputTokens: 4096 },
      }),
    }
  )
  if (!response.ok) throw new Error(`Gemini error: ${await response.text()}`)
  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse bank statement')
  return JSON.parse(jsonMatch[0])
}

// ── Claude fallback ───────────────────────────────────────────

async function parseStatementWithClaude(imageBase64: string, mimeType: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API key not set')
  const anthropic = new Anthropic({ apiKey })

  let contentBlock: any
  if (mimeType === 'application/pdf') {
    contentBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
  } else {
    const imgType = mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    contentBlock = { type: 'image', source: { type: 'base64', media_type: imgType, data: imageBase64 } }
  }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: BANK_STATEMENT_PROMPT }] }],
  })
  const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse bank statement')
  return JSON.parse(jsonMatch[0])
}

// ── Matching score ────────────────────────────────────────────

function scoreMatch(
  tx: { date: string; amount: number; description: string },
  expense: { date: string; amount: number; converted_gbp: number | null; merchant: string | null }
) {
  let score = 0
  const expAmount = expense.converted_gbp ?? expense.amount
  const amountDiffPct = Math.abs(tx.amount - expAmount) / Math.max(tx.amount, 0.01) * 100
  if (amountDiffPct < 1)       score += 60
  else if (amountDiffPct < 3)  score += 45
  else if (amountDiffPct < 7)  score += 25
  else if (amountDiffPct < 15) score += 10

  const txDate = new Date(tx.date).getTime()
  const expDate = new Date(expense.date).getTime()
  const dateDiffDays = Math.abs(txDate - expDate) / (1000 * 60 * 60 * 24)
  if (dateDiffDays === 0)      score += 40
  else if (dateDiffDays <= 1)  score += 28
  else if (dateDiffDays <= 2)  score += 16
  else if (dateDiffDays <= 4)  score += 6

  if (expense.merchant) {
    const txDesc = tx.description.toLowerCase()
    const merchantWords = expense.merchant.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    if (merchantWords.some(word => txDesc.includes(word))) score += 20
  }
  return score
}

// ── Build bank adjustment note ────────────────────────────────

function buildAdjustmentNote(tx: any, oldGbp: number): string {
  const parts: string[] = []
  if (tx.foreign_amount && tx.foreign_currency && tx.bank_rate) {
    parts.push(`Bank charged £${tx.amount.toFixed(2)} (${tx.foreign_amount} ${tx.foreign_currency} @ ${tx.bank_rate})`)
  } else {
    parts.push(`Bank charged £${tx.amount.toFixed(2)}`)
  }
  if (tx.cash_advance_fee) {
    parts.push(`Cash advance fee: £${Number(tx.cash_advance_fee).toFixed(2)}`)
  }
  const diff = tx.amount - oldGbp
  if (Math.abs(diff) > 0.01) {
    parts.push(`FX difference: ${diff > 0 ? '+' : ''}£${diff.toFixed(2)}`)
  }
  return parts.join(' | ')
}

// ── Unmatched notification email ─────────────────────────────

async function sendUnmatchedNotification(
  unmatchedTxns: Array<{ date: string; description: string; amount: number; cash_advance_fee?: number | null }>,
  month: string,
  bankName: string | null,
  cardholder: { name: string; email: string } | null
) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || unmatchedTxns.length === 0 || !cardholder?.email) return
  const resend = new Resend(apiKey)
  const FROM = process.env.RESEND_FROM_EMAIL ?? 'nosarma@sarmalinux.com'
  const accountsEmail = process.env.ACCOUNTS_NOTIFY_EMAIL ?? 'accounts@yourcompany.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com'

  const [yearStr, monthStr] = month.split('-')
  const monthLabel = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1)
    .toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  const cardholderName = cardholder?.name ?? 'Unknown Cardholder'
  const cardholderEmail = cardholder?.email ?? null

  const tableRows = unmatchedTxns.map(t => {
    const fee = t.cash_advance_fee ? ` + £${Number(t.cash_advance_fee).toFixed(2)} fee` : ''
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${t.date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${t.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">£${t.amount.toFixed(2)}${fee}</td>
    </tr>`
  }).join('')

  const totalAmount = unmatchedTxns.reduce((sum, t) => sum + t.amount + (t.cash_advance_fee ? Number(t.cash_advance_fee) : 0), 0)

  // ── Email to cardholder only — with their specific missing transactions ──
  const cardholderHtml = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;">
      <div style="background:#1e3a5f;padding:24px 32px;">
        <h1 style="color:#fff;margin:0;font-size:20px;">Receipts Required — Company Card</h1>
        <p style="color:#93c5fd;margin:8px 0 0;">${monthLabel}</p>
      </div>
      <div style="padding:24px 32px;background:#f9fafb;">
        <p style="color:#374151;">Hi ${cardholderName.split(' ')[0]},</p>
        <p style="color:#374151;">
          We have uploaded your company card statement for <strong>${monthLabel}</strong> and found
          <strong>${unmatchedTxns.length} transaction${unmatchedTxns.length > 1 ? 's' : ''}</strong>
          with no receipt uploaded in StaffPortal. Total: <strong>£${totalAmount.toFixed(2)}</strong>.
        </p>

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

        <p style="color:#374151;font-weight:600;">These have been added to your expenses in Nexus. Please open each one and upload the receipt.</p>

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

  // Send only to the cardholder — not accounts
  if (cardholderEmail) {
    await resend.emails.send({
      from: FROM,
      to: [cardholderEmail],
      subject: `[StaffPortal] Please upload receipts for your company card — ${monthLabel}`,
      html: cardholderHtml,
    })
  }
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role as string)
    if (!roles.includes('admin') && !roles.includes('director') && !roles.includes('accounts')) {
      return NextResponse.json({ error: 'Access denied. Only accounts, admin, or director can upload bank statements.' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const month = formData.get('month') as string | null
    if (!file || !month) return NextResponse.json({ error: 'Missing file or month' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload JPG, PNG, or PDF.' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    // Upload to storage
    const storagePath = `bank-statements/${user.id}/${month}-${Date.now()}.${ext}`
    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabaseAdmin.storage
      .from('expenses')
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false })
    if (uploadError) return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    const { data: urlData } = supabaseAdmin.storage.from('expenses').getPublicUrl(storagePath)
    const fileUrl = urlData.publicUrl

    // Parse with AI
    const imageBase64 = Buffer.from(fileBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    let parsed: any
    try {
      console.log('[BankStmt] Trying Gemini...')
      parsed = await parseStatementWithGemini(imageBase64, mimeType)
    } catch (geminiErr: any) {
      console.warn('[BankStmt] Gemini failed:', geminiErr.message, '— trying Claude')
      try {
        parsed = await parseStatementWithClaude(imageBase64, mimeType)
      } catch (claudeErr: any) {
        return NextResponse.json({ error: `AI parsing failed: ${claudeErr.message}` }, { status: 500 })
      }
    }

    const transactions: Array<{
      date: string
      description: string
      amount: number
      type: string
      foreign_amount?: number | null
      foreign_currency?: string | null
      bank_rate?: number | null
      is_cash_advance?: boolean
      cash_advance_fee?: number | null
    }> = parsed.transactions ?? []

    // Resolve cardholder from card last4 on the statement
    console.log('[BankStmt] card_last4 from AI:', parsed.card_last4, '| account_holder:', parsed.account_holder)
    let cardholderUserId: string | null = null
    let cardholderCardId: string | null = null
    let cardholderInfo: { name: string; email: string } | null = null

    const last4 = parsed.card_last4 ? String(parsed.card_last4).replace(/\D/g, '').slice(-4) : null
    if (last4 && last4.length === 4) {
      const { data: matchedCard } = await supabaseAdmin
        .from('company_cards')
        .select('id, user_id')
        .eq('last4', last4)
        .eq('is_active', true)
        .single()
      if (matchedCard) {
        cardholderCardId = matchedCard.id
        cardholderUserId = matchedCard.user_id
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', matchedCard.user_id)
          .single()
        if (profile) {
          cardholderInfo = { name: profile.full_name ?? 'Unknown', email: profile.email ?? '' }
          console.log('[BankStmt] Cardholder resolved by card last4:', last4, '->', cardholderInfo.name)
        }
      } else {
        console.warn('[BankStmt] No company card found with last4:', last4)
      }
    } else {
      console.warn('[BankStmt] card_last4 not found in statement; falling back to name match')
      // Name-based fallback
      if (parsed.account_holder) {
        const nameParts = parsed.account_holder.trim().toLowerCase().split(/\s+/).filter((p: string) => p.length > 1)
        const { data: profiles } = await supabaseAdmin
          .from('user_profiles')
          .select('id, full_name, email')
          .eq('status', 'active')
        if (profiles && nameParts.length > 0) {
          let bestScore = 0
          let bestProfile: any = null
          for (const p of profiles) {
            const fullName = (p.full_name ?? '').toLowerCase()
            const score = nameParts.filter((part: string) => fullName.includes(part)).length
            if (score > bestScore) { bestScore = score; bestProfile = p }
          }
          if (bestScore > 0) {
            cardholderUserId = bestProfile.id
            cardholderInfo = { name: bestProfile.full_name, email: bestProfile.email }
            console.log('[BankStmt] Cardholder matched by name:', bestProfile.full_name, '(score:', bestScore, ')')
            const { data: cards } = await supabaseAdmin
              .from('company_cards')
              .select('id')
              .eq('user_id', cardholderUserId!)
              .eq('is_active', true)
              .limit(1)
            if (cards && cards.length > 0) cardholderCardId = cards[0].id
          } else {
            console.warn('[BankStmt] No cardholder match found for:', parsed.account_holder)
          }
        }
      }
    }

    // Get expenses for the month
    const [yearStr, monthStr] = month.split('-')
    const startDate = `${yearStr}-${monthStr}-01`
    const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate()
    const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`

    const { data: expenses } = await supabaseAdmin
      .from('expenses')
      .select('id, date, amount, converted_gbp, currency, merchant, description, payment_method, vat_rate, vat_amount, net_amount, exchange_rate')
      .gte('date', startDate)
      .lte('date', endDate)
      .in('payment_method', ['company_card', 'company_cash', 'refund'])
      .in('status', ['submitted', 'approved', 'paid'])

    const expenseList = expenses ?? []

    // Match transactions (debits → company_card/cash, credits → refunds)
    const enrichedTransactions = transactions.map(tx => {
      let bestScore = 0
      let bestExpense: any = null
      const txDate = new Date(tx.date)

      // For credits, only match against refund expenses
      const matchAgainst = tx.type === 'credit'
        ? expenseList.filter(e => e.payment_method === 'refund')
        : expenseList.filter(e => e.payment_method !== 'refund')

      const expByDate = new Map<string, any[]>()
      matchAgainst.forEach(exp => {
        if (!expByDate.has(exp.date)) expByDate.set(exp.date, [])
        expByDate.get(exp.date)!.push(exp)
      })

      for (let dayOffset = -7; dayOffset <= 7; dayOffset++) {
        const checkDate = new Date(txDate)
        checkDate.setDate(checkDate.getDate() + dayOffset)
        const dateKey = checkDate.toISOString().split('T')[0]
        for (const exp of (expByDate.get(dateKey) || [])) {
          const score = scoreMatch(tx, exp)
          if (score > bestScore) { bestScore = score; bestExpense = exp }
        }
      }

      const matchStatus = bestScore >= 70 ? 'matched' : bestScore >= 40 ? 'partial' : tx.type === 'credit' ? 'credit' : 'unmatched'
      return {
        ...tx,
        matchedExpenseId: bestScore >= 70 ? bestExpense?.id : null,
        partialExpenseId: bestScore >= 40 && bestScore < 70 ? bestExpense?.id : null,
        matchConfidence: bestScore,
        matchStatus,
      }
    })

    const debitTxns = enrichedTransactions.filter(t => t.type === 'debit')
    const matchedCount = debitTxns.filter(t => t.matchStatus === 'matched').length

    // Save statement record
    const { data: stmt, error: stmtError } = await supabaseAdmin
      .from('bank_statements')
      .insert({
        uploaded_by: user.id,
        month,
        bank_name: parsed.bank_name ?? null,
        file_url: fileUrl,
        status: 'matched',
        total_transactions: debitTxns.length,
        matched_count: matchedCount,
        cardholder_user_id: cardholderUserId ?? null,
      })
      .select()
      .single()

    if (stmtError || !stmt) return NextResponse.json({ error: 'Failed to save statement' }, { status: 500 })

    if (enrichedTransactions.length > 0) {
      await supabaseAdmin.from('bank_statement_transactions').insert(
        enrichedTransactions.map(t => ({
          statement_id: stmt.id,
          transaction_date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          matched_expense_id: t.matchedExpenseId ?? t.partialExpenseId ?? null,
          match_confidence: t.matchConfidence ?? 0,
          match_status: t.matchStatus,
        }))
      )

      // Update expenses with bank's actual values
      // Full update for matched (≥70), bank amount only for partial (40-69) and credits
      for (const t of enrichedTransactions) {
        const expenseId = t.matchedExpenseId ?? t.partialExpenseId
        if (!expenseId) continue

        const exp = expenseList.find(e => e.id === expenseId)
        if (!exp) continue

        const oldGbp = exp.converted_gbp ?? exp.amount
        const bankGbp = t.amount
        const adjustment = Math.round((bankGbp - oldGbp) * 100) / 100
        const note = buildAdjustmentNote(t, oldGbp)

        if (t.matchStatus === 'matched') {
          // Full update: VAT, net, FX rate, converted GBP
          let newVatAmount = exp.vat_amount
          let newNetAmount = exp.net_amount
          if (exp.vat_rate && exp.vat_rate > 0) {
            newVatAmount = Math.round(bankGbp * exp.vat_rate / (100 + exp.vat_rate) * 100) / 100
            newNetAmount = Math.round((bankGbp - newVatAmount) * 100) / 100
          }
          const updatePayload: any = {
            actual_bank_amount: bankGbp,
            bank_adjustment: adjustment,
            bank_adjustment_note: note,
            converted_gbp: bankGbp,
          }
          if (t.bank_rate) updatePayload.exchange_rate = t.bank_rate
          if (exp.vat_rate && exp.vat_rate > 0) {
            updatePayload.vat_amount = newVatAmount
            updatePayload.net_amount = newNetAmount
          }
          await supabaseAdmin.from('expenses').update(updatePayload).eq('id', expenseId)
        } else if (t.matchStatus === 'partial' || t.matchStatus === 'credit') {
          // Partial/credit: just store the bank amount so Set button disappears
          await supabaseAdmin.from('expenses').update({
            actual_bank_amount: bankGbp,
            bank_adjustment: adjustment,
            bank_adjustment_note: note,
          }).eq('id', expenseId)
        }
      }
    }

    // Auto-create expense stubs for unmatched transactions
    const unmatchedTxns = debitTxns.filter(t => t.matchStatus === 'unmatched')
    let stubsCreated = 0
    for (const t of unmatchedTxns) {
      const stubDesc = t.cash_advance_fee
        ? `[Receipt needed] ${t.description} — Cash advance fee: £${Number(t.cash_advance_fee).toFixed(2)}`
        : `[Receipt needed] ${t.description}`

      const { data: stub } = await supabaseAdmin
        .from('expenses')
        .insert({
          user_id: cardholderUserId ?? user.id,
          company_card_id: cardholderCardId,
          date: t.date,
          amount: t.amount,
          currency: 'GBP',
          converted_gbp: t.amount,
          merchant: t.description.substring(0, 100),
          description: stubDesc,
          payment_method: 'company_card',
          status: 'approved',
          actual_bank_amount: t.amount,
          bank_adjustment: 0,
          bank_adjustment_note: buildAdjustmentNote(t, t.amount),
        })
        .select('id')
        .single()

      if (stub?.id) {
        stubsCreated++
        // Link the bank transaction to the new stub expense
        await supabaseAdmin
          .from('bank_statement_transactions')
          .update({ matched_expense_id: stub.id, match_status: 'matched', match_confidence: 100 })
          .eq('statement_id', stmt.id)
          .eq('transaction_date', t.date)
          .eq('amount', t.amount)
          .eq('description', t.description)
      }
    }

    return NextResponse.json({
      success: true,
      statementId: stmt.id,
      bankName: parsed.bank_name,
      accountHolder: parsed.account_holder,
      cardLast4: last4,
      cardholderName: cardholderInfo?.name ?? null,
      total: debitTxns.length,
      matched: matchedCount,
      partial: debitTxns.filter(t => t.matchStatus === 'partial').length,
      unmatched: unmatchedTxns.length,
      stubs_created: stubsCreated,
    })
  } catch (err: any) {
    console.error('[BankStmt] Unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
