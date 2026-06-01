import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import path from 'path'
import fs from 'fs'

const PAGE_W = 595.28
const MARGIN = 36
const W = PAGE_W - MARGIN * 2

function d(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function dLong(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id: string
  try {
    id = (await params).id
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  try {
    return await handleRequest(id)
  } catch (e: any) {
    console.error('[leave-pdf] Unhandled error:', e?.message, e?.stack)
    return NextResponse.json({ error: e?.message ?? 'Internal server error' }, { status: 500 })
  }
}

async function handleRequest(id: string) {

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rolesData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (rolesData ?? []).map((r: any) => r.role)
  const isPrivileged = roles.some((r: string) => ['admin', 'director', 'accounts'].includes(r))

  const { data: leave, error: leaveErr } = await supabaseAdmin
    .from('leave_requests')
    .select(`*, employee:user_profiles!leave_requests_user_id_fkey(full_name, display_name, email), approver:user_profiles!leave_requests_approver_id_fkey(full_name, display_name)`)
    .eq('id', id)
    .single()

  if (leaveErr || !leave) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (leave.user_id !== user.id && !isPrivileged) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (leave.status !== 'approved' && leave.status !== 'withdrawn') return NextResponse.json({ error: 'Only approved or withdrawn leave can be downloaded' }, { status: 400 })

  const year = new Date().getFullYear()
  const [{ data: balances }, { data: lastYearBal }, { data: userCarryProfile }] = await Promise.all([
    supabaseAdmin.from('leave_balances').select('leave_type, total, used, pending').eq('user_id', leave.user_id).eq('year', year).order('leave_type'),
    supabaseAdmin.from('leave_balances').select('total, used, pending').eq('user_id', leave.user_id).eq('leave_type', 'annual').eq('year', year - 1).single(),
    (supabaseAdmin as any).from('user_profiles').select('max_carry_forward, carry_forward_days').eq('id', leave.user_id).single(),
  ])
  const maxCarry = userCarryProfile?.max_carry_forward ?? 5
  let annualCarry = 0
  if (lastYearBal) {
    const lastRem = Math.max(0, Number(lastYearBal.total) - Number(lastYearBal.used) - Number(lastYearBal.pending))
    annualCarry = Math.min(lastRem, maxCarry)
  } else {
    annualCarry = userCarryProfile?.carry_forward_days ?? 0
  }

  const PDFDocument = (await import('pdfkit')).default
  const emp = leave.employee as any
  const empName = emp?.display_name || emp?.full_name || 'Employee'
  const approverName = (leave.approver as any)?.display_name || (leave.approver as any)?.full_name || '—'
  const leaveTypeLabel = cap(leave.leave_type) + ' Leave'
  const dayTypeLabel = leave.day_type === 'full' ? 'Full Day' : leave.day_type === 'half_am' ? 'Half Day (AM)' : 'Half Day (PM)'
  const daysLabel = `${leave.days_count} ${Number(leave.days_count) === 1 ? 'day' : 'days'}`
  const refCode = `LF-${leave.id.slice(0, 8).toUpperCase()}`
  const logoPath = path.join(process.cwd(), 'public', 'logo.png')
  const hasLogo = fs.existsSync(logoPath)

  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve)
    doc.on('error', reject)

    const HDR_H = 72
    doc.rect(0, 0, PAGE_W, HDR_H).fillColor('#1C1C1C').fill()
    if (hasLogo) doc.image(logoPath, MARGIN, 14, { height: 44 })
    doc.fontSize(7).fillColor('#888888').font('Helvetica').text('INTERNAL SYSTEM', MARGIN, 16, { align: 'right', width: W })
    doc.fontSize(14).fillColor('#FFFFFF').font('Helvetica-Bold').text('LEAVE AUTHORISATION FORM', MARGIN, 28, { align: 'right', width: W })
    doc.fontSize(7.5).fillColor('#aaaaaa').font('Helvetica').text(`${refCode}   ·   Issued: ${d(new Date().toISOString())}`, MARGIN, 50, { align: 'right', width: W })

    const META_Y = HDR_H, META_H = 34
    doc.rect(0, META_Y, PAGE_W, META_H).fillColor('#F2F2F2').fill()
    doc.moveTo(0, META_Y + META_H).lineTo(PAGE_W, META_Y + META_H).strokeColor('#DDDDDD').lineWidth(0.5).stroke()
    const statusLabel = leave.status === 'withdrawn' ? 'WITHDRAWN' : 'APPROVED'
    const statusColor = leave.status === 'withdrawn' ? '#b45309' : '#1e6b35'
    const metaCols = [['Employee', empName], ['Leave Type', leaveTypeLabel], ['Duration', daysLabel], ['Status', statusLabel]]
    const mcW = W / metaCols.length
    metaCols.forEach(([label, val], i) => {
      const mx = MARGIN + i * mcW
      doc.fontSize(6.5).fillColor('#999999').font('Helvetica').text(label.toUpperCase(), mx, META_Y + 6, { width: mcW - 4 })
      doc.fontSize(9).fillColor(val === statusLabel && i === 3 ? statusColor : '#1a1a1a').font('Helvetica-Bold').text(val, mx, META_Y + 16, { width: mcW - 4 })
    })

    let y = META_Y + META_H + 14

    const sectionHdr = (letter: string, title: string) => {
      doc.rect(MARGIN, y, W, 22).fillColor('#EBEBEB').fill()
      doc.rect(MARGIN, y, W, 22).strokeColor('#D0D0D0').lineWidth(0.4).stroke()
      doc.rect(MARGIN, y, 24, 22).fillColor('#2C2C2C').fill()
      doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica-Bold').text(letter, MARGIN + 7, y + 6)
      doc.fontSize(8).fillColor('#333333').font('Helvetica-Bold').text(title, MARGIN + 32, y + 6)
      y += 22
    }

    const cell = (label: string, value: string, cx: number, cy: number, cw: number, ch: number, valueColor = '#1a1a1a', valueBold = true) => {
      doc.rect(cx, cy, cw, ch).strokeColor('#D8D8D8').lineWidth(0.4).stroke()
      doc.fontSize(6.5).fillColor('#AAAAAA').font('Helvetica').text(label.toUpperCase(), cx + 6, cy + 5, { width: cw - 10 })
      doc.fontSize(9).fillColor(valueColor).font(valueBold ? 'Helvetica-Bold' : 'Helvetica').text(value || '—', cx + 6, cy + 16, { width: cw - 10, lineBreak: false })
    }

    const ROW_H = 40
    sectionHdr('A', 'EMPLOYEE DETAILS')
    cell('Full Name', empName, MARGIN, y, W * 0.55, ROW_H)
    cell('Email Address', emp?.email || '—', MARGIN + W * 0.55, y, W * 0.45, ROW_H)
    y += ROW_H + 10

    sectionHdr('B', 'LEAVE REQUEST DETAILS')
    const c4 = W / 4
    cell('Leave Type', leaveTypeLabel, MARGIN, y, c4, ROW_H)
    cell('Day Type', dayTypeLabel, MARGIN + c4, y, c4, ROW_H)
    cell('Start Date', dLong(leave.start_date), MARGIN + c4 * 2, y, c4, ROW_H)
    cell('End Date', dLong(leave.end_date), MARGIN + c4 * 3, y, c4, ROW_H)
    y += ROW_H
    cell('Duration', daysLabel, MARGIN, y, c4, ROW_H)
    cell('Reason / Notes', leave.reason || 'No reason provided', MARGIN + c4, y, c4 * 3, ROW_H, '#1a1a1a', false)
    y += ROW_H + 10

    sectionHdr('C', `LEAVE BALANCES — ${year}`)
    if (balances && balances.length > 0) {
      const cols = [W * 0.28, W * 0.18, W * 0.18, W * 0.18, W * 0.18]
      const HDR_RH = 20, BAL_RH = 22
      doc.rect(MARGIN, y, W, HDR_RH).fillColor('#F7F7F7').fill()
      let bx = MARGIN
      ;['Leave Type', 'Total (Days)', 'Used', 'Pending', 'Remaining'].forEach((h, i) => {
        doc.rect(bx, y, cols[i], HDR_RH).strokeColor('#D0D0D0').lineWidth(0.4).stroke()
        doc.fontSize(7).fillColor('#555555').font('Helvetica-Bold').text(h, bx + 4, y + 6, { width: cols[i] - 8, align: i === 0 ? 'left' : 'center' })
        bx += cols[i]
      })
      y += HDR_RH
      for (const b of balances) {
        if (b.leave_type === 'unpaid') continue
        const carry = b.leave_type === 'annual' ? annualCarry : 0
        const effectiveTotal = (b.total ?? 0) + carry
        const rem = effectiveTotal - (b.used ?? 0) - (b.pending ?? 0)
        const isCurrent = b.leave_type === leave.leave_type
        if (isCurrent) doc.rect(MARGIN, y, W, BAL_RH).fillColor('#FFFDE7').fill()
        let bxr = MARGIN
        const totalDisplay = carry > 0 ? `${effectiveTotal} (incl. ${carry} CF)` : String(b.total ?? 0)
        ;[cap(b.leave_type), totalDisplay, String(b.used ?? 0), String(b.pending ?? 0), String(rem)].forEach((v, i) => {
          doc.rect(bxr, y, cols[i], BAL_RH).strokeColor('#E8E8E8').lineWidth(0.3).stroke()
          let fc = '#1a1a1a', bold = false
          if (i === 0 && isCurrent) { fc = '#7C5C2E'; bold = true }
          if (i === 4) { fc = rem > 0 ? '#1e6b35' : '#c0392b'; bold = true }
          doc.fontSize(9).fillColor(fc).font(bold ? 'Helvetica-Bold' : 'Helvetica').text(v, bxr + 4, y + 6, { width: cols[i] - 8, align: i === 0 ? 'left' : 'center' })
          bxr += cols[i]
        })
        y += BAL_RH
      }
    }
    y += 10

    sectionHdr('D', leave.status === 'withdrawn' ? 'WITHDRAWAL RECORD' : 'AUTHORISATION')
    if (leave.status === 'withdrawn') {
      doc.rect(MARGIN, y, W, 28).fillColor('#FEF3C7').fill()
      doc.rect(MARGIN, y, W, 28).strokeColor('#FDE68A').lineWidth(0.4).stroke()
      doc.fontSize(10).fillColor('#b45309').font('Helvetica-Bold').text('⊘  WITHDRAWN', MARGIN + 10, y + 9)
      doc.fontSize(8.5).fillColor('#92400e').font('Helvetica')
        .text(`Withdrawn by employee  ·  Days returned to balance`, MARGIN + 130, y + 10, { width: W - 140 })
      y += 36
      doc.rect(MARGIN, y, W, 32).fillColor('#FFFBEB').fill()
      doc.rect(MARGIN, y, W, 32).strokeColor('#FDE68A').lineWidth(0.4).stroke()
      doc.fontSize(8).fillColor('#b45309').font('Helvetica-Bold').text('WITHDRAWAL CONFIRMED', MARGIN + 10, y + 7)
      doc.fontSize(7.5).fillColor('#92400e').font('Helvetica')
        .text(`This leave request was withdrawn by the employee via StaffPortal. The days have been returned to their leave balance. This document is for audit reference only.`, MARGIN + 10, y + 18, { width: W - 20 })
    } else {
      doc.rect(MARGIN, y, W, 28).fillColor('#D4EDDA').fill()
      doc.rect(MARGIN, y, W, 28).strokeColor('#B8DFC3').lineWidth(0.4).stroke()
      doc.fontSize(10).fillColor('#1e6b35').font('Helvetica-Bold').text('✓  APPROVED', MARGIN + 10, y + 9)
      doc.fontSize(8.5).fillColor('#2d6a4f').font('Helvetica')
        .text(`Approved by ${approverName}  ·  ${leave.reviewed_at ? dLong(leave.reviewed_at) : '—'}`, MARGIN + 110, y + 10, { width: W - 120 })
      y += 36
      doc.rect(MARGIN, y, W, 32).fillColor('#F0F9FF').fill()
      doc.rect(MARGIN, y, W, 32).strokeColor('#BAE6FD').lineWidth(0.4).stroke()
      doc.fontSize(8).fillColor('#0369A1').font('Helvetica-Bold').text('ELECTRONICALLY AUTHORISED', MARGIN + 10, y + 7)
      doc.fontSize(7.5).fillColor('#0369A1').font('Helvetica')
        .text(`This document has been electronically authorised via StaffPortal on ${d(leave.reviewed_at ?? new Date().toISOString())} and is valid without a physical signature.`, MARGIN + 10, y + 18, { width: W - 20 })
    }
    y += 42

    // Office use only
    doc.rect(MARGIN, y, W, 34).fillColor('#FAFAFA').fill()
    doc.rect(MARGIN, y, W, 34).strokeColor('#D0D0D0').lineWidth(0.4).stroke()
    doc.fontSize(7).fillColor('#AAAAAA').font('Helvetica-Bold').text('FOR OFFICE USE ONLY', MARGIN + 8, y + 5)
    doc.fontSize(7).fillColor('#CCCCCC').font('Helvetica').text('HR Reference:  __________________        Payroll Noted:  □       Filed:  □       Processed:  □', MARGIN + 8, y + 16)

    const FOOTER_Y = 808
    doc.rect(0, FOOTER_Y, PAGE_W, 841.89 - FOOTER_Y).fillColor('#1C1C1C').fill()
    doc.fontSize(7).fillColor('#666666').font('Helvetica').text(`Internal System  ·  Confidential  ·  ${refCode}  ·  Generated ${d(new Date().toISOString())}  ·  This document is valid without a handwritten signature when digitally issued.`, MARGIN, FOOTER_Y + 9, { align: 'center', width: W })

    doc.end()
  })

  const pdfBuffer = Buffer.concat(chunks)
  const safeName = empName.replace(/\s+/g, '_')
  const filename = `leave_form_${safeName}_${leave.start_date}_${refCode}.pdf`

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
