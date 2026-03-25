import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Gemini: parse a bank statement image/PDF ──────────────────

async function parseStatementWithGemini(imageBase64: string, mimeType: string) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key not set')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: { mime_type: mimeType, data: imageBase64 },
              },
              {
                text: `You are an expert bank statement parser. Extract ALL transactions visible in this bank statement image.

Return ONLY valid JSON with no explanation, no markdown, no code blocks:
{
  "bank_name": "Name of the bank if visible",
  "account_holder": "Account holder name if visible",
  "statement_period": "Period shown e.g. March 2026",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Full transaction description as shown",
      "amount": 123.45,
      "type": "debit or credit"
    }
  ]
}

Rules:
- Include EVERY transaction visible on the statement
- Debit = money leaving the account (purchases, payments)
- Credit = money coming in (refunds, deposits, salary)
- If the date has no year, infer from context
- If amount uses comma as thousands separator, convert correctly (e.g. 1,234.56 → 1234.56)
- description should be the exact text shown on the statement
- Return ONLY the JSON, no other text`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 4096 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini error: ${err}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse bank statement')
  return JSON.parse(jsonMatch[0])
}

// ── Auto-match transactions to existing expenses ──────────────

function scoreMatch(tx: { date: string; amount: number }, expense: { date: string; amount: number; converted_gbp: number | null }) {
  let score = 0
  const expAmount = expense.converted_gbp ?? expense.amount

  // Amount match (tx is in GBP from bank, expense may be in original currency)
  const amountDiffPct = Math.abs(tx.amount - expAmount) / Math.max(tx.amount, 0.01) * 100
  if (amountDiffPct < 1)       score += 60
  else if (amountDiffPct < 3)  score += 45
  else if (amountDiffPct < 7)  score += 25
  else if (amountDiffPct < 15) score += 10

  // Date match
  const txDate = new Date(tx.date).getTime()
  const expDate = new Date(expense.date).getTime()
  const dateDiffDays = Math.abs(txDate - expDate) / (1000 * 60 * 60 * 24)
  if (dateDiffDays === 0)      score += 40
  else if (dateDiffDays <= 1)  score += 28
  else if (dateDiffDays <= 2)  score += 16
  else if (dateDiffDays <= 4)  score += 6

  return score
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role as string)
    const canUpload = roles.includes('admin') || roles.includes('director') || roles.includes('accounts')
    if (!canUpload) return NextResponse.json({ error: 'Access denied. Only accounts, admin, or director can upload bank statements.' }, { status: 403 })

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const month = formData.get('month') as string | null

    if (!file || !month) return NextResponse.json({ error: 'Missing file or month' }, { status: 400 })

    // Validate file type
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf']
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload JPG, PNG, or PDF.' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    // Upload file to Supabase Storage
    const storagePath = `bank-statements/${user.id}/${month}-${Date.now()}.${ext}`
    const fileBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabaseAdmin.storage
      .from('expenses')
      .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('[BankStmt] Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from('expenses').getPublicUrl(storagePath)
    const fileUrl = urlData.publicUrl

    // Parse statement with Gemini AI
    const imageBase64 = Buffer.from(fileBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    let parsed: any
    try {
      parsed = await parseStatementWithGemini(imageBase64, mimeType)
    } catch (e: any) {
      console.error('[BankStmt] Gemini error:', e.message)
      return NextResponse.json({ error: `AI parsing failed: ${e.message}` }, { status: 500 })
    }

    const transactions: Array<{ date: string; description: string; amount: number; type: string }> =
      parsed.transactions ?? []

    // Get all company card expenses for this month (only debit transactions need matching)
    const [yearStr, monthStr] = month.split('-')
    const startDate = `${yearStr}-${monthStr}-01`
    const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate()
    const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`

    const { data: expenses } = await supabaseAdmin
      .from('expenses')
      .select('id, date, amount, converted_gbp, currency, merchant, description, payment_method')
      .gte('date', startDate)
      .lte('date', endDate)
      .in('payment_method', ['company_card', 'company_cash', 'refund'])
      .in('status', ['submitted', 'approved', 'paid'])

    const expenseList = expenses ?? []

    // Optimize: Index expenses by date for faster lookup
    const expensesByDate = new Map<string, any[]>()
    expenseList.forEach(exp => {
      const dateKey = exp.date // YYYY-MM-DD
      if (!expensesByDate.has(dateKey)) {
        expensesByDate.set(dateKey, [])
      }
      expensesByDate.get(dateKey)!.push(exp)
    })

    // Auto-match each debit transaction
    const enrichedTransactions = transactions.map(tx => {
      if (tx.type !== 'debit') {
        return { ...tx, matchedExpenseId: null, matchConfidence: 0, matchStatus: 'credit' as const }
      }

      let bestScore = 0
      let bestExpense: any = null

      // Only check expenses within ±7 days window (massive performance improvement)
      const txDate = new Date(tx.date)
      for (let dayOffset = -7; dayOffset <= 7; dayOffset++) {
        const checkDate = new Date(txDate)
        checkDate.setDate(checkDate.getDate() + dayOffset)
        const dateKey = checkDate.toISOString().split('T')[0]

        const candidateExpenses = expensesByDate.get(dateKey) || []
        for (const exp of candidateExpenses) {
          const score = scoreMatch(tx, exp)
          if (score > bestScore) {
            bestScore = score
            bestExpense = exp
          }
        }
      }

      const matchStatus = bestScore >= 70 ? 'matched' : bestScore >= 40 ? 'partial' : 'unmatched'
      return {
        ...tx,
        matchedExpenseId: bestScore >= 70 ? bestExpense?.id : null,
        matchConfidence: bestScore,
        matchStatus,
      }
    })

    const debitTxns = enrichedTransactions.filter(t => t.type === 'debit')
    const matchedCount = debitTxns.filter(t => t.matchStatus === 'matched').length

    // Save to DB
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
      })
      .select()
      .single()

    if (stmtError || !stmt) {
      console.error('[BankStmt] DB error:', stmtError)
      return NextResponse.json({ error: 'Failed to save statement' }, { status: 500 })
    }

    if (enrichedTransactions.length > 0) {
      await supabaseAdmin.from('bank_statement_transactions').insert(
        enrichedTransactions.map(t => ({
          statement_id: stmt.id,
          transaction_date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          matched_expense_id: t.matchedExpenseId ?? null,
          match_confidence: t.matchConfidence ?? 0,
          match_status: t.matchStatus,
        }))
      )

      // Mark matched expenses with actual_bank_amount if confidence is high
      for (const t of enrichedTransactions) {
        if (t.matchStatus === 'matched' && t.matchedExpenseId) {
          const exp = expenseList.find(e => e.id === t.matchedExpenseId)
          if (exp) {
            const gbp = exp.converted_gbp ?? exp.amount
            await supabaseAdmin.from('expenses').update({
              actual_bank_amount: t.amount,
              bank_adjustment: Math.round((t.amount - gbp) * 100) / 100,
            }).eq('id', t.matchedExpenseId)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      statementId: stmt.id,
      bankName: parsed.bank_name,
      total: debitTxns.length,
      matched: matchedCount,
      partial: debitTxns.filter(t => t.matchStatus === 'partial').length,
      unmatched: debitTxns.filter(t => t.matchStatus === 'unmatched').length,
    })
  } catch (err: any) {
    console.error('[BankStmt] Unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
