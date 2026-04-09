import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import path from 'path'
import fs from 'fs'

const PAGE_W = 595.28
const MARGIN = 40
const W = PAGE_W - MARGIN * 2

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtCurrency(amount: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: expense, error } = await (supabaseAdmin as any)
      .from('expenses')
      .select('*, expense_categories(*), company_cards(*), user_profiles!expenses_user_id_fkey(full_name, display_name, email), expense_approvals(*, user_profiles(full_name, display_name))')
      .eq('id', id)
      .single()

    if (error || !expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (expense.user_id !== user.id) {
      const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
      const isAdmin = (roles ?? []).some((r: any) => ['admin', 'director', 'accounts'].includes(r.role))
      if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (expense.status !== 'approved') return NextResponse.json({ error: 'Only approved claims can be downloaded' }, { status: 400 })

    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    const emp = expense.user_profiles as any
    const empName = emp?.display_name || emp?.full_name || 'Employee'
    const approvals = (expense.expense_approvals as any[]) ?? []
    const latestApproval = approvals.find((a: any) => a.decision === 'approved')
    const approverName = latestApproval?.user_profiles?.display_name || latestApproval?.user_profiles?.full_name || '—'
    const approvedDate = latestApproval?.decided_at ? fmtDate(latestApproval.decided_at) : '—'
    const refCode = `EXP-${id.slice(0, 8).toUpperCase()}`
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    const hasLogo = fs.existsSync(logoPath)

    await new Promise<void>((resolve, reject) => {
      doc.on('end', resolve)
      doc.on('error', reject)

      let y = MARGIN

      // Header bar
      doc.rect(0, 0, PAGE_W, 70).fill('#0f172a')
      if (hasLogo) {
        try { doc.image(logoPath, MARGIN, 14, { height: 42 }) } catch {}
      }
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
        .text('EXPENSE CLAIM SHEET', 0, 22, { align: 'center' })
      doc.font('Helvetica').fontSize(9).fillColor('#94a3b8')
        .text('StaffPortal · Your Company Limited', 0, 43, { align: 'center' })

      y = 90

      // Reference + status row
      doc.fillColor('#64748b').font('Helvetica').fontSize(8)
        .text(`Reference: ${refCode}`, MARGIN, y)
        .text(`Generated: ${fmtDate(new Date().toISOString())}`, 0, y, { align: 'right', width: PAGE_W - MARGIN })
      y += 18

      // APPROVED stamp
      doc.save()
      doc.rotate(-15, { origin: [PAGE_W - 120, y + 10] })
      doc.rect(PAGE_W - 160, y - 5, 110, 30).stroke('#16a34a')
      doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(14)
        .text('APPROVED', PAGE_W - 155, y + 3, { width: 100, align: 'center' })
      doc.restore()
      y += 14

      // Section helper
      const sectionHeader = (title: string) => {
        doc.rect(MARGIN, y, W, 20).fill('#f1f5f9')
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9)
          .text(title.toUpperCase(), MARGIN + 8, y + 6)
        y += 24
      }
      const row = (label: string, value: string, bold = false) => {
        doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text(label, MARGIN, y, { width: 140 })
        doc.fillColor('#0f172a').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
          .text(value || '—', MARGIN + 150, y, { width: W - 150 })
        y += 16
      }

      // Employee details
      sectionHeader('Employee Details')
      row('Name', empName)
      row('Email', emp?.email || '—')
      row('Submission Date', expense.submitted_at ? fmtDate(expense.submitted_at) : '—')
      y += 6

      // Expense details
      sectionHeader('Expense Details')
      row('Description', expense.description, true)
      row('Date of Expense', fmtDate(expense.date))
      row('Merchant / Supplier', expense.merchant || '—')
      row('Category', expense.expense_categories?.name || '—')
      row('Payment Method', expense.payment_method === 'personal_card' ? 'Personal Card' : 'Cash')
      y += 6

      // Amount
      sectionHeader('Amount')
      row('Amount', fmtCurrency(expense.amount, expense.currency), true)
      if (expense.currency !== 'GBP' && expense.converted_gbp) {
        row('GBP Equivalent', fmtCurrency(expense.converted_gbp, 'GBP'))
        row('Exchange Rate', `1 ${expense.currency} = ${Number(expense.exchange_rate ?? 1).toFixed(4)} GBP`)
      }
      y += 6

      // Approval
      sectionHeader('Approval')
      row('Status', 'APPROVED')
      row('Approved By', approverName)
      row('Approval Date', approvedDate)
      if (latestApproval?.note) row('Notes', latestApproval.note)
      y += 6

      // Receipt
      if (expense.receipt_url) {
        sectionHeader('Receipt')
        doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text('Digital receipt attached in StaffPortal system.', MARGIN, y)
        doc.fillColor('#2563eb').font('Helvetica').fontSize(8).text(expense.receipt_url, MARGIN, y + 12, { width: W, link: expense.receipt_url, underline: true })
        y += 36
      }

      // Signature block
      y = Math.max(y + 20, 640)
      doc.moveTo(MARGIN, y).lineTo(PAGE_W / 2 - 20, y).stroke('#cbd5e1')
      doc.moveTo(PAGE_W / 2 + 20, y).lineTo(PAGE_W - MARGIN, y).stroke('#cbd5e1')
      y += 6
      doc.fillColor('#64748b').font('Helvetica').fontSize(7.5)
        .text('Employee Signature', MARGIN, y, { width: PAGE_W / 2 - 30, align: 'center' })
        .text('Authorised Signature', PAGE_W / 2 + 20, y, { width: PAGE_W / 2 - 30, align: 'center' })

      // Footer
      doc.rect(0, 820, PAGE_W, 22).fill('#f8fafc')
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(7)
        .text(`StaffPortal · ${refCode} · This document was generated automatically`, 0, 826, { align: 'center' })

      doc.end()
    })

    const buf = Buffer.concat(chunks)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="claim-${refCode}.pdf"`,
        'Content-Length': String(buf.length),
      },
    })
  } catch (e: any) {
    console.error('[claim-pdf]', e)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
