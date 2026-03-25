'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import path from 'path'
import fs from 'fs'

const PAGE_W = 595.28
const MARGIN = 36
const W = PAGE_W - MARGIN * 2   // 523.28

function d(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function dLong(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export async function generateLeaveFormPDF(
  leaveRequestId: string,
): Promise<{ base64?: string; filename?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (rolesData ?? []).map((r: any) => r.role)
  const isPrivileged = roles.includes('admin') || roles.includes('accounts')

  const { data: req, error: reqErr } = await supabaseAdmin
    .from('leave_requests')
    .select(`*, employee:user_profiles!leave_requests_user_id_fkey(full_name, display_name, email), approver:user_profiles!leave_requests_approver_id_fkey(full_name, display_name)`)
    .eq('id', leaveRequestId)
    .single()

  if (reqErr || !req) return { error: 'Leave request not found' }
  if (req.user_id !== user.id && !isPrivileged) return { error: 'Unauthorized' }
  if (req.status !== 'approved') return { error: 'Only approved leave can be downloaded' }

  const year = new Date().getFullYear()
  const { data: balances } = await supabaseAdmin
    .from('leave_balances')
    .select('leave_type, total, used, pending')
    .eq('user_id', req.user_id)
    .eq('year', year)
    .order('leave_type')

  const PDFDocument = (await import('pdfkit')).default

  const emp    = req.employee as any
  const empName      = emp?.display_name || emp?.full_name || 'Employee'
  const approverName = (req.approver as any)?.display_name || (req.approver as any)?.full_name || '—'
  const leaveTypeLabel = cap(req.leave_type) + ' Leave'
  const dayTypeLabel   = req.day_type === 'full' ? 'Full Day' : req.day_type === 'half_am' ? 'Half Day (AM)' : 'Half Day (PM)'
  const daysLabel      = `${req.days_count} ${Number(req.days_count) === 1 ? 'day' : 'days'}`
  const refCode        = `LF-${req.id.slice(0, 8).toUpperCase()}`
  const logoPath       = path.join(process.cwd(), 'public', 'logo.png')
  const hasLogo        = fs.existsSync(logoPath)

  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)

    // ─────────────────────────────────────────────────────
    // HEADER BAND
    // ─────────────────────────────────────────────────────
    const HDR_H = 72
    doc.rect(0, 0, PAGE_W, HDR_H).fillColor('#1C1C1C').fill()

    if (hasLogo) {
      doc.image(logoPath, MARGIN, 14, { height: 44 })
    }

    doc.fontSize(7).fillColor('#888888').font('Helvetica')
      .text('MEMO INTERNAL SYSTEM', MARGIN, 16, { align: 'right', width: W })
    doc.fontSize(14).fillColor('#FFFFFF').font('Helvetica-Bold')
      .text('LEAVE AUTHORISATION FORM', MARGIN, 28, { align: 'right', width: W })
    doc.fontSize(7.5).fillColor('#aaaaaa').font('Helvetica')
      .text(`${refCode}   ·   Issued: ${d(new Date().toISOString())}`, MARGIN, 50, { align: 'right', width: W })

    // ─────────────────────────────────────────────────────
    // META STRIP
    // ─────────────────────────────────────────────────────
    const META_Y = HDR_H
    const META_H = 34
    doc.rect(0, META_Y, PAGE_W, META_H).fillColor('#F2F2F2').fill()
    doc.moveTo(0, META_Y + META_H).lineTo(PAGE_W, META_Y + META_H).strokeColor('#DDDDDD').lineWidth(0.5).stroke()

    const metaCols = [
      ['Employee', empName],
      ['Leave Type', leaveTypeLabel],
      ['Duration', daysLabel],
      ['Status', 'APPROVED'],
    ]
    const mcW = W / metaCols.length
    metaCols.forEach(([label, val], i) => {
      const mx = MARGIN + i * mcW
      doc.fontSize(6.5).fillColor('#999999').font('Helvetica').text(label.toUpperCase(), mx, META_Y + 6, { width: mcW - 4 })
      const isApproved = val === 'APPROVED'
      doc.fontSize(9).fillColor(isApproved ? '#1e6b35' : '#1a1a1a').font('Helvetica-Bold').text(val, mx, META_Y + 16, { width: mcW - 4 })
    })

    let y = META_Y + META_H + 14

    // ─────────────────────────────────────────────────────
    // Helper: section header
    // ─────────────────────────────────────────────────────
    const sectionHdr = (letter: string, title: string) => {
      doc.rect(MARGIN, y, W, 22).fillColor('#EBEBEB').fill()
      doc.rect(MARGIN, y, W, 22).strokeColor('#D0D0D0').lineWidth(0.4).stroke()
      doc.rect(MARGIN, y, 24, 22).fillColor('#2C2C2C').fill()
      doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica-Bold').text(letter, MARGIN + 7, y + 6)
      doc.fontSize(8).fillColor('#333333').font('Helvetica-Bold').text(title, MARGIN + 32, y + 6)
      y += 22
    }

    // Helper: bordered cell
    const cell = (
      label: string, value: string,
      cx: number, cy: number, cw: number, ch: number,
      valueColor = '#1a1a1a', valueBold = true,
    ) => {
      doc.rect(cx, cy, cw, ch).strokeColor('#D8D8D8').lineWidth(0.4).stroke()
      doc.fontSize(6.5).fillColor('#AAAAAA').font('Helvetica').text(label.toUpperCase(), cx + 6, cy + 5, { width: cw - 10 })
      doc.fontSize(9).fillColor(valueColor).font(valueBold ? 'Helvetica-Bold' : 'Helvetica')
        .text(value || '—', cx + 6, cy + 16, { width: cw - 10, lineBreak: false })
    }

    // ─────────────────────────────────────────────────────
    // SECTION A — EMPLOYEE DETAILS
    // ─────────────────────────────────────────────────────
    sectionHdr('A', 'EMPLOYEE DETAILS')
    const ROW_H = 40
    cell('Full Name',      empName,         MARGIN,            y, W * 0.55, ROW_H)
    cell('Email Address',  emp?.email || '—', MARGIN + W * 0.55, y, W * 0.45, ROW_H)
    y += ROW_H + 10

    // ─────────────────────────────────────────────────────
    // SECTION B — LEAVE REQUEST
    // ─────────────────────────────────────────────────────
    sectionHdr('B', 'LEAVE REQUEST DETAILS')
    const c4 = W / 4
    cell('Leave Type', leaveTypeLabel,       MARGIN,         y, c4,     ROW_H)
    cell('Day Type',   dayTypeLabel,          MARGIN + c4,    y, c4,     ROW_H)
    cell('Start Date', dLong(req.start_date), MARGIN + c4*2,  y, c4,     ROW_H)
    cell('End Date',   dLong(req.end_date),   MARGIN + c4*3,  y, c4,     ROW_H)
    y += ROW_H
    cell('Duration', daysLabel,               MARGIN,         y, c4,     ROW_H)
    cell('Reason / Notes', req.reason || 'No reason provided', MARGIN + c4, y, c4 * 3, ROW_H, '#1a1a1a', false)
    y += ROW_H + 10

    // ─────────────────────────────────────────────────────
    // SECTION C — LEAVE BALANCES
    // ─────────────────────────────────────────────────────
    sectionHdr('C', `LEAVE BALANCES — ${year}`)
    if (balances && balances.length > 0) {
      const cols = [W * 0.28, W * 0.18, W * 0.18, W * 0.18, W * 0.18]
      const HDR_RH = 20
      const BAL_RH = 22

      // Table header
      doc.rect(MARGIN, y, W, HDR_RH).fillColor('#F7F7F7').fill()
      const hdrLabels = ['Leave Type', 'Total (Days)', 'Used', 'Pending', 'Remaining']
      let bx = MARGIN
      hdrLabels.forEach((h, i) => {
        doc.rect(bx, y, cols[i], HDR_RH).strokeColor('#D0D0D0').lineWidth(0.4).stroke()
        doc.fontSize(7).fillColor('#555555').font('Helvetica-Bold')
          .text(h, bx + 4, y + 6, { width: cols[i] - 8, align: i === 0 ? 'left' : 'center' })
        bx += cols[i]
      })
      y += HDR_RH

      for (const b of balances) {
        const rem = (b.total ?? 0) - (b.used ?? 0) - (b.pending ?? 0)
        const isCurrentLeave = b.leave_type === req.leave_type
        if (isCurrentLeave) {
          doc.rect(MARGIN, y, W, BAL_RH).fillColor('#FFFDE7').fill()
        }
        const vals = [cap(b.leave_type), String(b.total ?? 0), String(b.used ?? 0), String(b.pending ?? 0), String(rem)]
        let bxr = MARGIN
        vals.forEach((v, i) => {
          doc.rect(bxr, y, cols[i], BAL_RH).strokeColor('#E8E8E8').lineWidth(0.3).stroke()
          let fc = '#1a1a1a'
          let bold = false
          if (i === 0 && isCurrentLeave) { fc = '#7C5C2E'; bold = true }
          if (i === 4) { fc = rem > 0 ? '#1e6b35' : '#c0392b'; bold = true }
          doc.fontSize(9).fillColor(fc).font(bold ? 'Helvetica-Bold' : 'Helvetica')
            .text(v, bxr + 4, y + 6, { width: cols[i] - 8, align: i === 0 ? 'left' : 'center' })
          bxr += cols[i]
        })
        y += BAL_RH
      }
    }
    y += 10

    // ─────────────────────────────────────────────────────
    // SECTION D — AUTHORISATION
    // ─────────────────────────────────────────────────────
    sectionHdr('D', 'AUTHORISATION & SIGNATURES')

    // Approval status bar
    doc.rect(MARGIN, y, W, 28).fillColor('#D4EDDA').fill()
    doc.rect(MARGIN, y, W, 28).strokeColor('#B8DFC3').lineWidth(0.4).stroke()
    doc.fontSize(10).fillColor('#1e6b35').font('Helvetica-Bold').text('✓  APPROVED', MARGIN + 10, y + 9)
    doc.fontSize(8.5).fillColor('#2d6a4f').font('Helvetica')
      .text(
        `Approved by ${approverName}  ·  ${req.reviewed_at ? dLong(req.reviewed_at) : '—'}`,
        MARGIN + 110, y + 10, { width: W - 120 }
      )
    y += 36

    // Instruction text
    doc.fontSize(7.5).fillColor('#999999').font('Helvetica').text(
      'Please sign below to acknowledge this leave authorisation. Employee must sign upon return. Approver signature confirms authorisation.',
      MARGIN, y, { width: W }
    )
    y += 16

    // ─── Two signature boxes ──────────────────────────────
    const sigW = (W - 12) / 2
    const sigH = 90

    const sigBox = (boxX: number, label: string, name: string, preFilledDate: string | null) => {
      // Outer box
      doc.rect(boxX, y, sigW, sigH).strokeColor('#C8C8C8').lineWidth(0.5).stroke()
      // Header strip
      doc.rect(boxX, y, sigW, 18).fillColor('#2C2C2C').fill()
      doc.fontSize(7.5).fillColor('#FFFFFF').font('Helvetica-Bold').text(label, boxX + 8, y + 5)

      // Name row
      doc.fontSize(7.5).fillColor('#888888').font('Helvetica').text('NAME', boxX + 8, y + 24)
      doc.fontSize(9).fillColor('#1a1a1a').font('Helvetica-Bold').text(name, boxX + 40, y + 23, { width: sigW - 48 })

      // Date row
      doc.fontSize(7.5).fillColor('#888888').font('Helvetica').text('DATE', boxX + 8, y + 40)
      if (preFilledDate) {
        doc.fontSize(9).fillColor('#1a1a1a').font('Helvetica').text(preFilledDate, boxX + 40, y + 39)
      } else {
        doc.moveTo(boxX + 40, y + 48).lineTo(boxX + sigW - 10, y + 48).strokeColor('#CCCCCC').lineWidth(0.5).stroke()
      }

      // Signature row
      doc.fontSize(7.5).fillColor('#888888').font('Helvetica').text('SIGN', boxX + 8, y + 58)
      doc.moveTo(boxX + 40, y + 74).lineTo(boxX + sigW - 10, y + 74).strokeColor('#AAAAAA').lineWidth(0.5).stroke()
      // subtle sign-here shading
      doc.rect(boxX + 40, y + 58, sigW - 50, 16).fillColor('#FAFAFA').fill()
    }

    sigBox(MARGIN,          'EMPLOYEE SIGNATURE',  empName,      null)
    sigBox(MARGIN + sigW + 12, 'APPROVER SIGNATURE', approverName, req.reviewed_at ? d(req.reviewed_at) : null)
    y += sigH + 10

    // Office use box
    const officeH = 34
    doc.rect(MARGIN, y, W, officeH).fillColor('#FAFAFA').fill()
    doc.rect(MARGIN, y, W, officeH).strokeColor('#D0D0D0').lineWidth(0.4).stroke()
    doc.fontSize(7).fillColor('#AAAAAA').font('Helvetica-Bold').text('FOR OFFICE USE ONLY', MARGIN + 8, y + 5)
    doc.fontSize(7).fillColor('#CCCCCC').font('Helvetica')
      .text('HR Reference:  __________________        Payroll Noted:  □       Filed:  □       Processed:  □', MARGIN + 8, y + 16)

    // ─────────────────────────────────────────────────────
    // FOOTER BAND
    // ─────────────────────────────────────────────────────
    const FOOTER_Y = 808
    doc.rect(0, FOOTER_Y, PAGE_W, 841.89 - FOOTER_Y).fillColor('#1C1C1C').fill()
    doc.fontSize(7).fillColor('#666666').font('Helvetica')
      .text(
        `MEMO Internal System  ·  Confidential  ·  ${refCode}  ·  Generated ${d(new Date().toISOString())}  ·  This document is valid without a handwritten signature when digitally issued.`,
        MARGIN, FOOTER_Y + 9, { align: 'center', width: W }
      )

    doc.end()
  })

  const base64 = Buffer.concat(chunks).toString('base64')
  const safeName = empName.replace(/\s+/g, '_')
  return {
    base64,
    filename: `leave_form_${safeName}_${req.start_date}_${refCode}.pdf`,
  }
}
