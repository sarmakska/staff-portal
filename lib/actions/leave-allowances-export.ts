'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ExcelJS from 'exceljs'

export async function exportLeaveAllowances(): Promise<{ base64?: string; filename?: string; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (rolesData ?? []).map((r: any) => r.role)
    if (!roles.includes('admin') && !roles.includes('director') && !roles.includes('accounts')) {
        return { error: 'Unauthorized' }
    }

    const currentYear = new Date().getFullYear()
    const lastYear = currentYear - 1

    const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, full_name, display_name, email, leave_balances(leave_type, total, used, pending, year)')
        .order('full_name')

    const { data: carryData } = await (supabaseAdmin as any)
        .from('user_profiles')
        .select('id, max_carry_forward, carry_forward_days')

    const carryMap = new Map<string, { maxCarry: number; carryForwardDays: number }>(
        (carryData ?? []).map((r: any) => [r.id, {
            maxCarry: r.max_carry_forward ?? 5,
            carryForwardDays: r.carry_forward_days ?? 0,
        }])
    )

    const { data: lastYearData } = await supabaseAdmin
        .from('leave_balances')
        .select('user_id, total, used, pending')
        .eq('leave_type', 'annual' as any)
        .eq('year', lastYear)

    const lastYearMap = new Map<string, { total: number; used: number; pending: number }>(
        (lastYearData ?? []).map((b: any) => [b.user_id, {
            total: Number(b.total),
            used: Number(b.used),
            pending: Number(b.pending),
        }])
    )

    function getCarry(userId: string): number {
        const maxCarry = carryMap.get(userId)?.maxCarry ?? 5
        const ly = lastYearMap.get(userId)
        if (ly) {
            const remaining = Math.max(0, ly.total - ly.used - ly.pending)
            return Math.min(remaining, maxCarry)
        }
        return carryMap.get(userId)?.carryForwardDays ?? 0
    }

    function getBalance(p: any, type: string) {
        const b = ((p.leave_balances as any[]) ?? []).find(
            (b: any) => b.leave_type === type && b.year === currentYear
        )
        return {
            total: Number(b?.total ?? 0),
            used: Number(b?.used ?? 0),
            pending: Number(b?.pending ?? 0),
        }
    }

    // Build workbook
    const wb = new ExcelJS.Workbook()
    wb.creator = 'StaffPortal'
    wb.created = new Date()

    const ws = wb.addWorksheet(`Leave Allowances ${currentYear}`, {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    })

    // ── Colours ──────────────────────────────────────────────
    const C = {
        headerBg: '1C1C1C',
        headerFg: 'FFFFFF',
        annualBg: 'EFF6FF',   // light blue
        annualHdr: 'BFDBFE',
        sickBg:   'FFF1F2',   // light rose
        sickHdr:  'FECDD3',
        matBg:    'F5F3FF',   // light violet
        matHdr:   'DDD6FE',
        carryBg:  'F0FDF4',   // light green
        carryHdr: 'BBF7D0',
        roHdr:    'F3F4F6',   // read-only grey
        border:   'D1D5DB',
        empBg:    'FAFAFA',
    }

    function fill(argb: string): ExcelJS.Fill {
        return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
    }
    function border(): Partial<ExcelJS.Borders> {
        return {
            top:    { style: 'thin', color: { argb: C.border } },
            bottom: { style: 'thin', color: { argb: C.border } },
            left:   { style: 'thin', color: { argb: C.border } },
            right:  { style: 'thin', color: { argb: C.border } },
        }
    }

    // ── Row 1: Title ─────────────────────────────────────────
    ws.addRow([`Leave Allowances — ${currentYear}`, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    ws.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: '111827' } }
    ws.getRow(1).height = 28
    ws.mergeCells('A1:O1')

    // ── Row 2: Generated info ─────────────────────────────────
    ws.addRow([`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}   ·   Carry forward auto-calculated from ${lastYear} remaining (capped by Max Carry). Manual where no ${lastYear} data exists.`])
    ws.getRow(2).getCell(1).font = { size: 8, color: { argb: '6B7280' } }
    ws.getRow(2).height = 16
    ws.mergeCells('A2:O2')

    ws.addRow([]) // spacer

    // ── Row 4: Group headers ──────────────────────────────────
    const grpRow = ws.addRow(['Employee', '', 'Annual Leave', '', '', '', '', 'Sick Leave', '', '', 'Maternity Leave', '', '', 'Max Carry', ''])
    grpRow.height = 20

    const grpStyle = (cell: ExcelJS.Cell, argb: string) => {
        cell.fill = fill(argb)
        cell.font = { bold: true, size: 9, color: { argb: C.headerFg } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = border()
    }

    grpStyle(grpRow.getCell(1), C.headerBg)   // Employee
    grpStyle(grpRow.getCell(3), '1D4ED8')      // Annual (blue)
    grpStyle(grpRow.getCell(8), 'BE123C')      // Sick (rose)
    grpStyle(grpRow.getCell(11), '6D28D9')     // Maternity (violet)
    grpStyle(grpRow.getCell(14), '065F46')     // Max Carry (green)

    ws.mergeCells('A4:B4')
    ws.mergeCells('C4:G4')
    ws.mergeCells('H4:J4')
    ws.mergeCells('K4:M4')
    ws.mergeCells('N4:O4')

    // ── Row 5: Sub-headers ────────────────────────────────────
    const subRow = ws.addRow([
        'Name', 'Email',
        'Base Allow.', 'Carry Over', 'Total Allow.', 'Absence Count', 'Remaining',
        'Contract', 'Used', 'Left',
        'Contract', 'Used', 'Left',
        'Max Carry', 'Pending (Ann.)',
    ])
    subRow.height = 28

    const subCols = [
        { col: 1, bg: C.headerBg }, { col: 2, bg: C.headerBg },
        { col: 3, bg: C.annualHdr }, { col: 4, bg: C.annualHdr },
        { col: 5, bg: C.roHdr }, { col: 6, bg: C.annualHdr }, { col: 7, bg: C.roHdr },
        { col: 8, bg: C.sickHdr }, { col: 9, bg: C.sickHdr }, { col: 10, bg: C.roHdr },
        { col: 11, bg: C.matHdr }, { col: 12, bg: C.matHdr }, { col: 13, bg: C.roHdr },
        { col: 14, bg: C.carryHdr }, { col: 15, bg: C.annualHdr },
    ]
    subCols.forEach(({ col, bg }) => {
        const cell = subRow.getCell(col)
        cell.fill = fill(bg)
        cell.font = { bold: true, size: 8, color: { argb: col <= 2 ? C.headerFg : '111827' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = border()
    })

    // ── Data rows ─────────────────────────────────────────────
    let rowIdx = 0
    for (const p of (profiles ?? []) as any[]) {
        const name = p.display_name || p.full_name || '—'
        const carry = getCarry(p.id)
        const annual = getBalance(p, 'annual')
        const sick = getBalance(p, 'sick')
        const maternity = getBalance(p, 'maternity')

        const annualTotal = annual.total + carry
        const annualRemaining = Math.max(0, annualTotal - annual.used - annual.pending)
        const sickLeft = Math.max(0, sick.total - sick.used - sick.pending)
        const maternityLeft = Math.max(0, maternity.total - maternity.used - maternity.pending)
        const maxCarry = carryMap.get(p.id)?.maxCarry ?? 5

        const row = ws.addRow([
            name, p.email ?? '',
            annual.total, carry, annualTotal, annual.used, annualRemaining,
            sick.total, sick.used, sickLeft,
            maternity.total, maternity.used, maternityLeft,
            maxCarry, annual.pending,
        ])

        row.height = 22
        const isEven = rowIdx % 2 === 0

        // Employee cols
        const empBg = isEven ? C.empBg : 'F9FAFB'
        ;[1, 2].forEach(c => {
            row.getCell(c).fill = fill(empBg)
            row.getCell(c).font = { size: 9, bold: c === 1 }
            row.getCell(c).alignment = { vertical: 'middle' }
            row.getCell(c).border = border()
        })

        // Annual
        const annBg = isEven ? C.annualBg : 'DBEAFE'
        ;[3, 4, 6].forEach(c => {
            row.getCell(c).fill = fill(annBg)
            row.getCell(c).font = { size: 10, bold: true }
            row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
            row.getCell(c).border = border()
        })
        // Read-only: Total Allow + Remaining
        ;[5, 7].forEach(c => {
            row.getCell(c).fill = fill(isEven ? 'F3F4F6' : 'E5E7EB')
            row.getCell(c).font = { size: 11, bold: true }
            row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
            row.getCell(c).border = border()
        })

        // Sick
        const sickBg = isEven ? C.sickBg : 'FFE4E6'
        ;[8, 9].forEach(c => {
            row.getCell(c).fill = fill(sickBg)
            row.getCell(c).font = { size: 10, bold: true }
            row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
            row.getCell(c).border = border()
        })
        row.getCell(10).fill = fill(isEven ? 'F3F4F6' : 'E5E7EB')
        row.getCell(10).font = { size: 11, bold: true }
        row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(10).border = border()

        // Maternity
        const matBg = isEven ? C.matBg : 'EDE9FE'
        ;[11, 12].forEach(c => {
            row.getCell(c).fill = fill(matBg)
            row.getCell(c).font = { size: 10, bold: true }
            row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
            row.getCell(c).border = border()
        })
        row.getCell(13).fill = fill(isEven ? 'F3F4F6' : 'E5E7EB')
        row.getCell(13).font = { size: 11, bold: true }
        row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(13).border = border()

        // Max Carry
        row.getCell(14).fill = fill(isEven ? C.carryBg : 'DCFCE7')
        row.getCell(14).font = { size: 10, bold: true }
        row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(14).border = border()

        // Pending
        row.getCell(15).fill = fill(annBg)
        row.getCell(15).font = { size: 9, color: { argb: '6B7280' } }
        row.getCell(15).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(15).border = border()

        rowIdx++
    }

    // ── Column widths ─────────────────────────────────────────
    ws.columns = [
        { width: 22 }, { width: 26 },
        { width: 11 }, { width: 11 }, { width: 12 }, { width: 13 }, { width: 11 },
        { width: 11 }, { width: 9 }, { width: 9 },
        { width: 11 }, { width: 9 }, { width: 9 },
        { width: 11 }, { width: 13 },
    ]

    // ── Freeze panes ──────────────────────────────────────────
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 5 }]

    const buffer = await wb.xlsx.writeBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dateStr = new Date().toISOString().split('T')[0]
    return {
        base64,
        filename: `leave_allowances_${currentYear}_${dateStr}.xlsx`,
    }
}
