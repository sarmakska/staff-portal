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
function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch PR (no FK joins — schema cache issue)
    const { data: pr, error } = await (supabaseAdmin as any)
      .from('purchase_requests')
      .select('*, pr_approvals(*), pr_attachments(*)')
      .eq('id', id)
      .single()

    if (error || !pr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Auth: owner or admin/director/accounts
    if (pr.user_id !== user.id) {
      const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
      const isPriv = (roles ?? []).some((r: any) => ['admin', 'director', 'accounts'].includes(r.role))
      if (!isPriv) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (pr.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved purchase requests can be downloaded' }, { status: 400 })
    }

    // Fetch submitter and approver profiles separately
    const userIds = [...new Set([pr.user_id, pr.direct_approver_id].filter(Boolean))]
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, full_name, display_name, email')
      .in('id', userIds)
    const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
    const emp = profileMap[pr.user_id] ?? {}
    const approver = profileMap[pr.direct_approver_id] ?? {}
    const empName = emp.display_name || emp.full_name || 'Employee'
    const approverName = approver.display_name || approver.full_name || '—'

    // Find approval decision record
    const approvals: any[] = pr.pr_approvals ?? []
    const latestApproval = approvals.find((a: any) => a.decision === 'approved')
    const approvedDate = latestApproval?.decided_at ? fmtDate(latestApproval.decided_at) : '—'

    const refCode = `PR-${id.slice(0, 8).toUpperCase()}`
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    const hasLogo = fs.existsSync(logoPath)

    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    await new Promise<void>((resolve, reject) => {
      doc.on('end', resolve)
      doc.on('error', reject)

      let y = MARGIN

      // ── Header bar ──────────────────────────────────────────
      doc.rect(0, 0, PAGE_W, 70).fill('#0f172a')
      if (hasLogo) {
        try { doc.image(logoPath, MARGIN, 14, { height: 42 }) } catch {}
      }
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
        .text('PURCHASE REQUEST — APPROVED', 0, 22, { align: 'center' })
      doc.font('Helvetica').fontSize(9).fillColor('#94a3b8')
        .text('StaffPortal · Your Company Limited', 0, 43, { align: 'center' })

      y = 90

      // Reference + date row
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

      // ── Section helpers ──────────────────────────────────────
      const sectionHeader = (title: string) => {
        doc.rect(MARGIN, y, W, 20).fill('#f1f5f9')
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9)
          .text(title.toUpperCase(), MARGIN + 8, y + 6)
        y += 24
      }
      const row = (label: string, value: string, bold = false) => {
        doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text(label, MARGIN, y, { width: 160 })
        doc.fillColor('#0f172a').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
          .text(value || '—', MARGIN + 170, y, { width: W - 170 })
        y += 16
      }

      // ── Employee details ──────────────────────────────────────
      sectionHeader('Requested By')
      row('Name', empName)
      row('Email', emp.email || '—')
      row('Submission Date', pr.submitted_at ? fmtDate(pr.submitted_at) : '—')
      y += 6

      // ── Request details ───────────────────────────────────────
      sectionHeader('Request Details')
      row('Item / Service', pr.item_name, true)
      if (pr.description) row('Description', pr.description)
      if (pr.supplier) row('Supplier', pr.supplier)
      row('Urgency', cap(pr.urgency ?? 'medium'))
      if (pr.justification) row('Justification', pr.justification)
      y += 6

      // ── Amount ────────────────────────────────────────────────
      sectionHeader('Amount')
      row('Estimated Cost', fmtCurrency(pr.estimated_cost, pr.currency ?? 'GBP'), true)
      if (pr.currency && pr.currency !== 'GBP' && pr.converted_gbp) {
        row('GBP Equivalent', fmtCurrency(pr.converted_gbp, 'GBP'))
        row('Exchange Rate', `1 ${pr.currency} = ${Number(pr.exchange_rate ?? 1).toFixed(4)} GBP`)
      }
      y += 6

      // ── Approval ──────────────────────────────────────────────
      sectionHeader('Approval')
      row('Status', 'APPROVED')
      row('Approved By', approverName)
      row('Approval Date', approvedDate)
      if (latestApproval?.note) row('Approver Note', latestApproval.note)
      y += 6

      // ── Attachments ───────────────────────────────────────────
      const attachments: any[] = pr.pr_attachments ?? []
      if (attachments.length > 0) {
        sectionHeader('Attachments')
        for (const att of attachments) {
          doc.fillColor('#2563eb').font('Helvetica').fontSize(8)
            .text(att.file_name, MARGIN, y, { width: W, link: att.file_url, underline: true })
          y += 14
        }
        y += 6
      }

      // ── Signature block ───────────────────────────────────────
      y = Math.max(y + 20, 640)
      doc.moveTo(MARGIN, y).lineTo(PAGE_W / 2 - 20, y).stroke('#cbd5e1')
      doc.moveTo(PAGE_W / 2 + 20, y).lineTo(PAGE_W - MARGIN, y).stroke('#cbd5e1')
      y += 6
      doc.fillColor('#64748b').font('Helvetica').fontSize(7.5)
        .text('Requester Signature', MARGIN, y, { width: PAGE_W / 2 - 30, align: 'center' })
        .text('Authorised Signature', PAGE_W / 2 + 20, y, { width: PAGE_W / 2 - 30, align: 'center' })

      // ── Footer ────────────────────────────────────────────────
      doc.rect(0, 820, PAGE_W, 22).fill('#f8fafc')
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(7)
        .text(`StaffPortal · ${refCode} · This document was generated automatically`, 0, 826, { align: 'center' })

      doc.end()
    })

    const buf = Buffer.concat(chunks)
    const safeName = (pr.item_name ?? 'purchase').replace(/[^a-z0-9]/gi, '_').toLowerCase()
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="purchase-request-${refCode}-${safeName}.pdf"`,
        'Content-Length': String(buf.length),
      },
    })
  } catch (e: any) {
    console.error('[purchase-request-pdf]', e)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
