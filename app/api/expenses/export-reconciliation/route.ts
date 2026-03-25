import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Styling helpers ───────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FF1F2937' }, // dark slate
}
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }
const BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
}
const EVEN_ROW_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
const MATCHED_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }   // emerald-100
const PARTIAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }   // amber-100
const UNMATCHED_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } } // rose-100

function applyHeader(row: ExcelJS.Row) {
  row.height = 18
  row.eachCell(cell => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.border = BORDER
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
}

function applyCell(cell: ExcelJS.Cell, even: boolean, fill?: ExcelJS.Fill) {
  cell.border = BORDER
  cell.fill = fill ?? (even ? EVEN_ROW_FILL : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } })
  cell.alignment = { vertical: 'middle', wrapText: false }
}

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── GET handler ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const user = await getCurrentUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const supabase = await createClient()
    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role as string)
    const canExport = roles.includes('admin') || roles.includes('director') || roles.includes('accounts')
    if (!canExport) return new NextResponse('Forbidden', { status: 403 })

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    if (!month) return new NextResponse('Missing month param', { status: 400 })

    // Date range
    const [yearStr, monthStr] = month.split('-')
    const startDate = `${yearStr}-${monthStr}-01`
    const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate()
    const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`

    // Fetch all expenses for this month
    const { data: expenses } = await supabaseAdmin
      .from('expenses')
      .select('*, expense_categories(name,color), company_cards(*), user_profiles!expenses_user_id_fkey(full_name,email,display_name)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    // Fetch bank statements + their transactions with matched expense data
    const { data: statements } = await (supabaseAdmin as any)
      .from('bank_statements')
      .select('*, bank_statement_transactions(*)')
      .eq('month', month)
      .order('created_at', { ascending: false })

    const expenseList = expenses ?? []
    const statementList = (statements ?? []) as any[]

    // Build expense lookup map for bank sheet
    const expenseMap = new Map<string, any>(expenseList.map(e => [e.id, e]))

    // Flatten all bank transactions from all statements
    const allBankTx: any[] = statementList.flatMap((stmt: any) =>
      (stmt.bank_statement_transactions ?? []).map((tx: any) => ({ ...tx, bank_name: stmt.bank_name ?? 'Bank Statement' }))
    )

    // Month label
    const monthLabel = new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    // ── Create workbook ───────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = 'StaffPortal'
    wb.created = new Date()
    wb.modified = new Date()

    // ================================================================
    // SHEET 1: All Expenses
    // ================================================================
    const ws1 = wb.addWorksheet('All Expenses', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })

    ws1.columns = [
      { key: 'date',        header: 'Date',           width: 14 },
      { key: 'employee',    header: 'Employee',        width: 22 },
      { key: 'description', header: 'Description',     width: 34 },
      { key: 'merchant',    header: 'Merchant',         width: 22 },
      { key: 'category',    header: 'Category',         width: 18 },
      { key: 'payment',     header: 'Payment Method',   width: 18 },
      { key: 'currency',    header: 'Currency',         width: 10 },
      { key: 'orig_amount', header: 'Orig. Amount',     width: 14, style: { numFmt: '#,##0.00' } },
      { key: 'gross_gbp',   header: 'Gross (GBP £)',    width: 15, style: { numFmt: '#,##0.00' } },
      { key: 'net_gbp',     header: 'Net ex VAT (£)',   width: 15, style: { numFmt: '#,##0.00' } },
      { key: 'vat_amount',  header: 'VAT Amount (£)',   width: 15, style: { numFmt: '#,##0.00' } },
      { key: 'vat_rate',    header: 'VAT Rate',          width: 10 },
      { key: 'vat_number',  header: 'VAT No.',           width: 18 },
      { key: 'receipt_no',  header: 'Receipt No.',       width: 16 },
      { key: 'status',      header: 'Status',            width: 14 },
      { key: 'bank_amount', header: 'Bank Amount (£)',   width: 16, style: { numFmt: '#,##0.00' } },
      { key: 'bank_adj',    header: 'Bank Adj. (£)',     width: 14, style: { numFmt: '+#,##0.00;-#,##0.00' } },
      { key: 'adj_note',    header: 'Adj. Note',         width: 24 },
      { key: 'receipt',     header: 'Receipt Link',      width: 14 },
    ]

    // Title row
    ws1.mergeCells('A1:S1')
    const titleRow1 = ws1.getRow(1)
    titleRow1.getCell(1).value = `Expense Report — ${monthLabel}`
    titleRow1.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1F2937' } }
    titleRow1.getCell(1).alignment = { vertical: 'middle' }
    titleRow1.height = 26

    // Header row
    const hdr1 = ws1.addRow({})
    ws1.columns.forEach((col, i) => {
      const cell = hdr1.getCell(i + 1)
      cell.value = col.header
    })
    applyHeader(hdr1)

    // Data rows
    expenseList.forEach((e, idx) => {
      const gross = e.converted_gbp ?? e.amount
      const net = e.net_amount ?? gross
      const even = idx % 2 === 0

      const row = ws1.addRow({
        date:        e.date,
        employee:    e.user_profiles?.full_name ?? '',
        description: e.description,
        merchant:    e.merchant ?? '',
        category:    e.expense_categories?.name ?? '',
        payment:     ({
          company_card:  'Company Card',
          personal_card: 'Personal Card',
          personal_cash: 'Cash',
          refund:        'Refund',
        } as any)[e.payment_method] ?? e.payment_method,
        currency:    e.currency,
        orig_amount: e.amount,
        gross_gbp:   gross,
        net_gbp:     net,
        vat_amount:  e.vat_amount ?? null,
        vat_rate:    e.vat_rate ? `${e.vat_rate}%` : '',
        vat_number:  e.vat_number ?? '',
        receipt_no:  e.receipt_number ?? '',
        status:      e.status,
        bank_amount: e.actual_bank_amount ?? null,
        bank_adj:    e.bank_adjustment ?? null,
        adj_note:    e.bank_adjustment_note ?? '',
        receipt:     e.receipt_url ? 'View Receipt' : '',
      })

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        applyCell(cell, even)
      })
      row.height = 16

      // Make receipt a hyperlink
      if (e.receipt_url) {
        const receiptCell = row.getCell(19)
        receiptCell.value = { text: 'View Receipt', hyperlink: e.receipt_url }
        receiptCell.font = { color: { argb: 'FF2563EB' }, underline: true }
      }
    })

    // Totals row
    const totalRow1 = ws1.addRow({})
    const grossTotal = expenseList.reduce((s, e) => s + (e.converted_gbp ?? e.amount), 0)
    const netTotal = expenseList.reduce((s, e) => s + (e.net_amount ?? (e.converted_gbp ?? e.amount)), 0)
    const vatTotal = expenseList.reduce((s, e) => s + (e.vat_amount ?? 0), 0)
    totalRow1.getCell(1).value = `TOTAL (${expenseList.length} expenses)`
    totalRow1.getCell(1).font = { bold: true }
    totalRow1.getCell(9).value = grossTotal
    totalRow1.getCell(9).font = { bold: true }
    totalRow1.getCell(9).numFmt = '#,##0.00'
    totalRow1.getCell(10).value = netTotal
    totalRow1.getCell(10).numFmt = '#,##0.00'
    totalRow1.getCell(11).value = vatTotal
    totalRow1.getCell(11).numFmt = '#,##0.00'
    totalRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
    totalRow1.font = { bold: true }
    totalRow1.eachCell({ includeEmpty: true }, cell => { cell.border = BORDER })

    // ================================================================
    // SHEET 2: Bank Statement
    // ================================================================
    const ws2 = wb.addWorksheet('Bank Statement', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })

    ws2.columns = [
      { key: 'bank',        header: 'Bank',              width: 20 },
      { key: 'date',        header: 'Date',              width: 14 },
      { key: 'description', header: 'Bank Description',  width: 38 },
      { key: 'type',        header: 'Type',              width: 10 },
      { key: 'amount',      header: 'Amount (£)',        width: 14, style: { numFmt: '#,##0.00' } },
      { key: 'status',      header: 'Match Status',      width: 16 },
      { key: 'confidence',  header: 'Confidence Score',  width: 18 },
      { key: 'exp_date',    header: 'Exp. Date',         width: 14 },
      { key: 'exp_desc',    header: 'Expense Description', width: 34 },
      { key: 'employee',    header: 'Employee',          width: 22 },
      { key: 'exp_amount',  header: 'Expense Amount (£)', width: 18, style: { numFmt: '#,##0.00' } },
      { key: 'difference',  header: 'Difference (£)',    width: 16, style: { numFmt: '+#,##0.00;-#,##0.00' } },
      { key: 'receipt',     header: 'Receipt Link',      width: 14 },
    ]

    // Title row
    ws2.mergeCells('A1:M1')
    const titleRow2 = ws2.getRow(1)
    titleRow2.getCell(1).value = `Bank Statement Reconciliation — ${monthLabel}`
    titleRow2.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1F2937' } }
    titleRow2.getCell(1).alignment = { vertical: 'middle' }
    titleRow2.height = 26

    // Header row
    const hdr2 = ws2.addRow({})
    ws2.columns.forEach((col, i) => {
      hdr2.getCell(i + 1).value = col.header
    })
    applyHeader(hdr2)

    // Data rows
    allBankTx.forEach((tx, idx) => {
      const matchedExp = tx.matched_expense_id ? expenseMap.get(tx.matched_expense_id) : null
      const even = idx % 2 === 0

      const matchStatusLabel: Record<string, string> = {
        matched: '✓ Matched',
        partial:  '~ Suggested',
        unmatched: '✗ No Match',
        credit:   'Credit',
      }

      const expGross = matchedExp ? (matchedExp.converted_gbp ?? matchedExp.amount) : null
      const diff = matchedExp && expGross !== null ? Math.round((tx.amount - expGross) * 100) / 100 : null

      const row = ws2.addRow({
        bank:        tx.bank_name,
        date:        tx.transaction_date,
        description: tx.description,
        type:        tx.type,
        amount:      tx.amount,
        status:      matchStatusLabel[tx.match_status] ?? tx.match_status,
        confidence:  tx.match_confidence != null ? `${tx.match_confidence} pts` : '',
        exp_date:    matchedExp?.date ?? '',
        exp_desc:    matchedExp?.description ?? '',
        employee:    matchedExp?.user_profiles?.full_name ?? '',
        exp_amount:  expGross ?? null,
        difference:  diff,
        receipt:     matchedExp?.receipt_url ? 'View Receipt' : '',
      })

      // Row colorisation by match status
      const rowFill = tx.match_status === 'matched'
        ? MATCHED_FILL : tx.match_status === 'partial'
        ? PARTIAL_FILL : tx.match_status === 'unmatched'
        ? UNMATCHED_FILL : undefined

      row.eachCell({ includeEmpty: true }, cell => {
        applyCell(cell, even, rowFill)
      })
      row.height = 16

      // Hyperlink for receipt
      if (matchedExp?.receipt_url) {
        const receiptCell = row.getCell(13)
        receiptCell.value = { text: 'View Receipt', hyperlink: matchedExp.receipt_url }
        receiptCell.font = { color: { argb: 'FF2563EB' }, underline: true }
        applyCell(receiptCell, even, rowFill)
      }
    })

    // Summary after data
    if (allBankTx.length > 0) {
      ws2.addRow({})
      const summRow = ws2.addRow({})
      const debits = allBankTx.filter(t => t.type === 'debit')
      summRow.getCell(1).value = `Total debits: ${debits.length} | Matched: ${debits.filter(t => t.match_status === 'matched').length} | Suggested: ${debits.filter(t => t.match_status === 'partial').length} | Unmatched: ${debits.filter(t => t.match_status === 'unmatched').length}`
      summRow.getCell(1).font = { bold: true, italic: true, size: 9 }
      summRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
      ws2.mergeCells(`A${summRow.number}:M${summRow.number}`)
    }

    // ================================================================
    // SHEET 3: Unmatched Bank Debits
    // ================================================================
    const ws3 = wb.addWorksheet('Unmatched Debits', {
      tabColor: { argb: 'FFEF4444' },
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    })

    const unmatchedTx = allBankTx.filter(t => t.type === 'debit' && t.match_status === 'unmatched')

    ws3.columns = [
      { key: 'bank',        header: 'Bank',             width: 20 },
      { key: 'date',        header: 'Date',             width: 14 },
      { key: 'description', header: 'Bank Description', width: 46 },
      { key: 'amount',      header: 'Amount (£)',       width: 16, style: { numFmt: '#,##0.00' } },
      { key: 'confidence',  header: 'Best Score',       width: 14 },
      { key: 'action',      header: 'Action Required',  width: 30 },
    ]

    // Title
    ws3.mergeCells('A1:F1')
    const titleRow3 = ws3.getRow(1)
    titleRow3.getCell(1).value = `Unmatched Bank Debits — ${monthLabel} (Requires Investigation)`
    titleRow3.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFDC2626' } }
    titleRow3.getCell(1).alignment = { vertical: 'middle' }
    titleRow3.height = 26

    const hdr3 = ws3.addRow({})
    ws3.columns.forEach((col, i) => { hdr3.getCell(i + 1).value = col.header })
    applyHeader(hdr3)

    if (unmatchedTx.length === 0) {
      const noRow = ws3.addRow({})
      noRow.getCell(1).value = '✓ All bank debits have been matched — nothing to investigate.'
      noRow.getCell(1).font = { italic: true, color: { argb: 'FF059669' } }
      ws3.mergeCells(`A${noRow.number}:F${noRow.number}`)
    } else {
      unmatchedTx.forEach((tx, idx) => {
        const row = ws3.addRow({
          bank:        tx.bank_name,
          date:        tx.transaction_date,
          description: tx.description,
          amount:      tx.amount,
          confidence:  tx.match_confidence != null ? `${tx.match_confidence} pts` : '0 pts',
          action:      'Verify with finance / add missing expense',
        })
        row.eachCell({ includeEmpty: true }, cell => { applyCell(cell, idx % 2 === 0, UNMATCHED_FILL) })
        row.height = 16
      })

      // Total
      const totalUnmatched = unmatchedTx.reduce((s, t) => s + t.amount, 0)
      const totRow = ws3.addRow({})
      totRow.getCell(1).value = `TOTAL UNMATCHED (${unmatchedTx.length} debits)`
      totRow.getCell(4).value = totalUnmatched
      totRow.getCell(4).numFmt = '#,##0.00'
      totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
      totRow.font = { bold: true }
      totRow.eachCell({ includeEmpty: true }, cell => { cell.border = BORDER })
    }

    // ── Stream back the .xlsx buffer ─────────────────────────
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reconciliation-${month}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('[ExcelExport]', err)
    return new NextResponse(err.message ?? 'Internal error', { status: 500 })
  }
}
