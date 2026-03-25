'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

// Colour palette
const COLORS = {
  headerBg: '2C2C2C',       // near-black header
  headerFg: 'FFFFFF',
  present:  'D6F5E3',       // light green
  absent:   'FFE0E0',       // light red
  late:     'FFF4CC',       // light yellow
  wfh:      'DDEEFF',       // light blue
  half_day: 'F0E6FF',       // light purple
  holiday:  'F0F0F0',       // light grey
  default:  'FFFFFF',
  totalBg:  'F5F5F5',
  border:   'D0D0D0',
  summaryBg: 'EEF2FF',      // light indigo for summary rows
}

function statusColor(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'present':  return COLORS.present
    case 'absent':   return COLORS.absent
    case 'late':     return COLORS.late
    case 'wfh':      return COLORS.wfh
    case 'half_day': return COLORS.half_day
    case 'holiday':  return COLORS.holiday
    default:         return COLORS.default
  }
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function thinBorder(color = COLORS.border): Partial<ExcelJS.Borders> {
  const s = { style: 'thin' as const, color: { argb: 'FF' + color } }
  return { top: s, bottom: s, left: s, right: s }
}

type ExportRow = {
  work_date: string
  clock_in: string | null
  clock_out: string | null
  total_hours: number | null
  status: string | null
  running_late?: boolean | null
  late_reason?: string | null
  expected_arrival_time?: string | null
  late_logged_by?: string | null
  wfh_type?: string | null
}

type UserSchedule = {
  hours_by_day?: Record<string, number> | null
  daily_hours?: number | null
}

const DOW_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function wfhHours(dateStr: string, schedule: UserSchedule | null, wfhType?: string | null): number {
  const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay()
  const dayCode = DOW_CODES[dow]
  const fullHours = schedule?.hours_by_day?.[dayCode] ?? schedule?.daily_hours ?? 7.5
  return (wfhType === 'half_am' || wfhType === 'half_pm') ? fullHours / 2 : fullHours
}

function addSheetForEmployee(
  wb: ExcelJS.Workbook,
  sheetName: string,
  employeeName: string,
  email: string,
  from: string,
  to: string,
  rows: ExportRow[],
) {
  const ws = wb.addWorksheet(sheetName)

  // Column definitions
  ws.columns = [
    { key: 'date',    width: 14 },
    { key: 'day',     width: 11 },
    { key: 'clockIn', width: 12 },
    { key: 'clockOut',width: 12 },
    { key: 'hours',   width: 12 },
    { key: 'status',  width: 12 },
    { key: 'notes',   width: 26 },
  ]

  // Title rows
  ws.mergeCells('A1:G1')
  const title = ws.getCell('A1')
  title.value = `Timesheet — ${employeeName}`
  title.font = { bold: true, size: 14, color: { argb: 'FF' + COLORS.headerBg } }
  title.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(1).height = 24

  ws.mergeCells('A2:G2')
  const sub = ws.getCell('A2')
  sub.value = `${email}   |   Period: ${from} to ${to}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`
  sub.font = { size: 10, color: { argb: 'FF888888' } }
  ws.getRow(2).height = 18

  // Blank separator
  ws.getRow(3).height = 6

  // Header row
  const headerRow = ws.addRow(['Date', 'Day', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Notes'])
  headerRow.height = 22
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.headerBg } }
    cell.font = { bold: true, color: { argb: 'FF' + COLORS.headerFg }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder()
  })

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 4 }]

  let totalHours = 0

  // Data rows
  for (const r of rows) {
    const h = r.total_hours ?? 0
    totalHours += h
    const noteParts = []
    if (r.status === 'wfh' && !r.clock_in) {
      const wLabel = r.wfh_type === 'half_am' ? 'WFH – Morning' : r.wfh_type === 'half_pm' ? 'WFH – Afternoon' : 'WFH – Full Day'
      noteParts.push(wLabel + ' (contracted hrs)')
    }
    if (r.running_late) {
      noteParts.push(r.late_reason ? `Running Late: ${r.late_reason}` : 'Running Late')
      if (r.expected_arrival_time) noteParts.push(`Expected: ${r.expected_arrival_time}`)
      if (r.late_logged_by && r.late_logged_by !== 'self') noteParts.push(`Logged by: ${r.late_logged_by}`)
    }
    const notes = noteParts.join(' · ')
    const row = ws.addRow([
      r.work_date,
      new Date(r.work_date).toLocaleDateString('en-GB', { weekday: 'long' }),
      fmt(r.clock_in),
      fmt(r.clock_out),
      h > 0 ? h : '',
      (r.status ?? '').replace('_', ' '),
      notes,
    ])
    row.height = 18
    const bg = 'FF' + statusColor(r.status)
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = thinBorder()
      cell.font = { size: 10 }
    })
    // Left-align date, day, notes
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' }
    if (notes) row.getCell(7).font = { size: 10, color: { argb: 'FFD97706' } }
  }

  // Total row
  const totalRow = ws.addRow(['', '', '', 'TOTAL', Math.round(totalHours * 100) / 100, '', ''])
  totalRow.height = 20
  totalRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.totalBg } }
    cell.font = { bold: true, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder()
  })
  totalRow.getCell(4).font = { bold: true, size: 11, color: { argb: 'FF' + COLORS.headerBg } }
  totalRow.getCell(5).font = { bold: true, size: 11, color: { argb: 'FF2E7D32' } }

  return ws
}

async function requireAdminOrAccounts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (rolesData ?? []).map((r: any) => r.role)
  if (!roles.includes('admin') && !roles.includes('director') && !roles.includes('accounts')) return null
  return { user }
}

// ── Individual employee export ────────────────────────────────────

export async function generateIndividualTimesheetExcel(
  userId: string,
  from: string,
  to: string,
): Promise<{ error?: string; base64?: string; filename?: string }> {
  const ctx = await requireAdminOrAccounts()
  if (!ctx) return { error: 'Unauthorized' }

  const [{ data: attendance }, { data: profile }, { data: wfhRecords }, { data: scheduleData }] = await Promise.all([
    supabaseAdmin
      .from('attendance')
      .select('work_date, clock_in, clock_out, total_hours, status, running_late, late_reason, expected_arrival_time, late_logged_by')
      .eq('user_id', userId)
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: true }) as any,
    supabaseAdmin
      .from('user_profiles')
      .select('full_name, display_name, email')
      .eq('id', userId)
      .single(),
    supabaseAdmin
      .from('wfh_records')
      .select('wfh_date, wfh_type')
      .eq('user_id', userId)
      .gte('wfh_date', from)
      .lte('wfh_date', to),
    (supabaseAdmin as any)
      .from('work_schedules')
      .select('hours_by_day, daily_hours')
      .eq('user_id', userId)
      .single(),
  ])

  const schedule: UserSchedule = scheduleData ?? {}

  // Build WFH date map: date -> wfh_type
  const wfhDateMap = new Map<string, string>((wfhRecords ?? []).map((w: any) => [w.wfh_date as string, w.wfh_type ?? 'full']))

  // Add WFH-only rows for days with no attendance record, using contracted hours
  const attendanceDates = new Set((attendance ?? []).map((r: any) => r.work_date))
  const wfhOnlyRows: ExportRow[] = (wfhRecords ?? [])
    .filter((w: any) => !attendanceDates.has(w.wfh_date))
    .map((w: any) => ({
      work_date: w.wfh_date,
      clock_in: null,
      clock_out: null,
      total_hours: wfhHours(w.wfh_date, schedule, w.wfh_type ?? 'full'),
      status: 'wfh',
      wfh_type: w.wfh_type ?? 'full',
    }))

  // For attendance rows on WFH days with no hours recorded, fill from schedule
  const attendanceRows: ExportRow[] = (attendance ?? []).map((r: any) => {
    const wType = wfhDateMap.get(r.work_date)
    if (wType && (r.total_hours == null || r.total_hours === 0)) {
      return { ...r, status: 'wfh', total_hours: wfhHours(r.work_date, schedule, wType), wfh_type: wType }
    }
    if (wType) return { ...r, status: 'wfh', wfh_type: wType }
    return r
  })

  const allRows: ExportRow[] = [...attendanceRows, ...wfhOnlyRows]
    .sort((a, b) => a.work_date.localeCompare(b.work_date))

  const name = profile?.display_name || profile?.full_name || 'Employee'
  const email = profile?.email ?? ''
  const sheetName = name.slice(0, 31).replace(/[:\\/?*[\]]/g, '')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'StaffPortal'
  wb.created = new Date()

  addSheetForEmployee(wb, sheetName, name, email, from, to, allRows)

  const buffer = await wb.xlsx.writeBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const filename = `timesheet_${name.replace(/\s+/g, '_')}_${from}_to_${to}.xlsx`

  return { base64, filename }
}

// ── All employees export ──────────────────────────────────────────

export async function generateAllTimesheetsExcel(
  from: string,
  to: string,
): Promise<{ error?: string; base64?: string; filename?: string }> {
  const ctx = await requireAdminOrAccounts()
  if (!ctx) return { error: 'Unauthorized' }

  const [{ data, error }, { data: allWfh }, { data: allLeave }, { data: allSchedules }] = await Promise.all([
    supabaseAdmin
      .from('attendance')
      .select('work_date, clock_in, clock_out, total_hours, status, running_late, late_reason, expected_arrival_time, late_logged_by, user_id, user:user_profiles!attendance_user_id_fkey(full_name, display_name, email)')
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: true }) as any,
    supabaseAdmin
      .from('wfh_records')
      .select('wfh_date, wfh_type, user_id, notes, user:user_profiles!wfh_records_user_id_fkey(full_name, display_name, email)')
      .gte('wfh_date', from)
      .lte('wfh_date', to)
      .order('wfh_date', { ascending: true }),
    supabaseAdmin
      .from('leave_requests')
      .select('start_date, end_date, leave_type, days_taken, status, notes, user_id, user:user_profiles!leave_requests_user_id_fkey(full_name, display_name, email)')
      .gte('start_date', from)
      .lte('start_date', to)
      .order('start_date', { ascending: true }) as any,
    (supabaseAdmin as any)
      .from('work_schedules')
      .select('user_id, hours_by_day, daily_hours'),
  ])

  if (error) return { error: error.message }

  // Build schedule map: userId -> UserSchedule
  const scheduleMap = new Map<string, UserSchedule>()
  for (const s of allSchedules ?? []) {
    scheduleMap.set((s as any).user_id, s as UserSchedule)
  }

  // Build WFH map per user: userId -> Map<date, wfh_type>
  const wfhByUser = new Map<string, Map<string, string>>()
  for (const w of allWfh ?? []) {
    const uid = (w as any).user_id
    if (!wfhByUser.has(uid)) wfhByUser.set(uid, new Map())
    wfhByUser.get(uid)!.set((w as any).wfh_date as string, (w as any).wfh_type ?? 'full')
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'StaffPortal'
  wb.created = new Date()

  // Group attendance by user_id
  const byUser: Record<string, { name: string; email: string; rows: ExportRow[] }> = {}
  for (const r of data ?? []) {
    const u = r.user as any
    const id = r.user_id
    if (!byUser[id]) {
      byUser[id] = { name: u?.display_name || u?.full_name || 'Unknown', email: u?.email ?? '', rows: [] }
    }
    const wType = wfhByUser.get(id)?.get(r.work_date)
    const sched = scheduleMap.get(id) ?? null
    if (wType && (r.total_hours == null || r.total_hours === 0)) {
      byUser[id].rows.push({ ...r, status: 'wfh', total_hours: wfhHours(r.work_date, sched, wType), wfh_type: wType })
    } else if (wType) {
      byUser[id].rows.push({ ...r, status: 'wfh', wfh_type: wType })
    } else {
      byUser[id].rows.push(r)
    }
  }

  // Add WFH-only rows per user (no attendance record that day)
  for (const w of allWfh ?? []) {
    const uid = (w as any).user_id
    const u = (w as any).user as any
    if (!byUser[uid]) {
      byUser[uid] = { name: u?.display_name || u?.full_name || 'Unknown', email: u?.email ?? '', rows: [] }
    }
    const alreadyHasDate = byUser[uid].rows.some(r => r.work_date === (w as any).wfh_date)
    if (!alreadyHasDate) {
      const sched = scheduleMap.get(uid) ?? null
      const wType = (w as any).wfh_type ?? 'full'
      byUser[uid].rows.push({
        work_date: (w as any).wfh_date,
        clock_in: null,
        clock_out: null,
        total_hours: wfhHours((w as any).wfh_date, sched, wType),
        status: 'wfh',
        wfh_type: wType,
      })
    }
  }

  // Sort rows within each user
  for (const u of Object.values(byUser)) {
    u.rows.sort((a, b) => a.work_date.localeCompare(b.work_date))
  }

  // One sheet per employee
  for (const { name, email, rows } of Object.values(byUser)) {
    const sheetName = name.slice(0, 31).replace(/[:\\/?*[\]]/g, '')
    addSheetForEmployee(wb, sheetName, name, email, from, to, rows)
  }

  // ── Summary sheet — all employees together ──
  const summaryWs = wb.addWorksheet('All Employees', { properties: { tabColor: { argb: 'FF2C2C2C' } } })
  summaryWs.columns = [
    { key: 'emp',     width: 22 },
    { key: 'date',    width: 14 },
    { key: 'day',     width: 11 },
    { key: 'clockIn', width: 12 },
    { key: 'clockOut',width: 12 },
    { key: 'hours',   width: 12 },
    { key: 'status',  width: 12 },
    { key: 'notes',   width: 26 },
  ]

  summaryWs.mergeCells('A1:H1')
  const t = summaryWs.getCell('A1')
  t.value = `All Employees Timesheet — ${from} to ${to}`
  t.font = { bold: true, size: 14 }
  t.alignment = { horizontal: 'left', vertical: 'middle' }
  summaryWs.getRow(1).height = 24

  summaryWs.mergeCells('A2:H2')
  summaryWs.getCell('A2').value = `Generated: ${new Date().toLocaleDateString('en-GB')} | StaffPortal`
  summaryWs.getCell('A2').font = { size: 10, color: { argb: 'FF888888' } }
  summaryWs.getRow(2).height = 16
  summaryWs.getRow(3).height = 6

  const hdr = summaryWs.addRow(['Employee', 'Date', 'Day', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Notes'])
  hdr.height = 22
  hdr.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.headerBg } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder()
  })
  summaryWs.views = [{ state: 'frozen', ySplit: 4 }]

  for (const { name, rows } of Object.values(byUser)) {
    for (const r of rows) {
      const notes = r.running_late
        ? (r.late_reason ? `Running Late: ${r.late_reason}` : 'Running Late')
        : ''
      const row = summaryWs.addRow([
        name,
        r.work_date,
        new Date(r.work_date).toLocaleDateString('en-GB', { weekday: 'long' }),
        fmt(r.clock_in),
        fmt(r.clock_out),
        r.total_hours ?? '',
        (r.status ?? '').replace('_', ' '),
        notes,
      ])
      row.height = 18
      const bg = 'FF' + statusColor(r.status)
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = thinBorder()
        cell.font = { size: 10 }
      })
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' }
      row.getCell(8).alignment = { horizontal: 'left', vertical: 'middle' }
      if (notes) row.getCell(8).font = { size: 10, color: { argb: 'FFD97706' } }
    }
  }

  // ── Monthly Summary sheet ──
  const monthWs = wb.addWorksheet('Monthly Summary', { properties: { tabColor: { argb: 'FF4F46E5' } } })
  monthWs.columns = [
    { key: 'emp',     width: 24 },
    { key: 'present', width: 10 },
    { key: 'late',    width: 10 },
    { key: 'absent',  width: 10 },
    { key: 'wfh',     width: 10 },
    { key: 'half',    width: 12 },
    { key: 'holiday', width: 10 },
    { key: 'totalDays', width: 12 },
    { key: 'totalHrs',  width: 14 },
  ]

  monthWs.mergeCells('A1:I1')
  const mt = monthWs.getCell('A1')
  mt.value = `Monthly Summary — ${from} to ${to}`
  mt.font = { bold: true, size: 14 }
  mt.alignment = { horizontal: 'left', vertical: 'middle' }
  monthWs.getRow(1).height = 24

  monthWs.mergeCells('A2:I2')
  monthWs.getCell('A2').value = `Generated: ${new Date().toLocaleDateString('en-GB')} | StaffPortal`
  monthWs.getCell('A2').font = { size: 10, color: { argb: 'FF888888' } }
  monthWs.getRow(2).height = 16
  monthWs.getRow(3).height = 6

  const mhdr = monthWs.addRow(['Employee', 'Present', 'Late', 'Absent', 'WFH', 'Half Day', 'Holiday', 'Total Days', 'Total Hours'])
  mhdr.height = 22
  mhdr.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder()
  })

  for (const { name, rows } of Object.values(byUser)) {
    const counts: Record<string, number> = {}
    let totalHrs = 0
    for (const r of rows) {
      const s = (r.status ?? 'unknown').toLowerCase()
      counts[s] = (counts[s] ?? 0) + 1
      totalHrs += r.total_hours ?? 0
    }
    const totalDays = rows.length
    const row = monthWs.addRow([
      name,
      counts['present'] ?? 0,
      counts['late'] ?? 0,
      counts['absent'] ?? 0,
      counts['wfh'] ?? 0,
      counts['half_day'] ?? 0,
      counts['holiday'] ?? 0,
      totalDays,
      Math.round(totalHrs * 100) / 100,
    ])
    row.height = 18
    row.eachCell(cell => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = thinBorder()
      cell.font = { size: 10 }
    })
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(1).font = { size: 10, bold: true }
    // Colour the hours green
    row.getCell(9).font = { size: 10, bold: true, color: { argb: 'FF2E7D32' } }
  }

  // ── WFH Records sheet ──
  const wfhWs = wb.addWorksheet('WFH Records', { properties: { tabColor: { argb: 'FF0369A1' } } })
  wfhWs.columns = [
    { key: 'emp',      width: 24 },
    { key: 'date',     width: 14 },
    { key: 'day',      width: 14 },
    { key: 'wfh_type', width: 16 },
    { key: 'notes',    width: 36 },
  ]

  const wfhTypeLabelXls = (t: string) => {
    if (t === 'half_am') return 'Morning Only'
    if (t === 'half_pm') return 'Afternoon Only'
    return 'Full Day'
  }

  wfhWs.mergeCells('A1:E1')
  const wt = wfhWs.getCell('A1')
  wt.value = `WFH Records — ${from} to ${to}`
  wt.font = { bold: true, size: 14 }
  wt.alignment = { horizontal: 'left', vertical: 'middle' }
  wfhWs.getRow(1).height = 24
  wfhWs.mergeCells('A2:E2')
  wfhWs.getCell('A2').value = `Generated: ${new Date().toLocaleDateString('en-GB')} | StaffPortal`
  wfhWs.getCell('A2').font = { size: 10, color: { argb: 'FF888888' } }
  wfhWs.getRow(2).height = 16
  wfhWs.getRow(3).height = 6

  const whdr = wfhWs.addRow(['Employee', 'Date', 'Day', 'Type', 'Notes'])
  whdr.height = 22
  whdr.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder()
  })

  for (const w of allWfh ?? []) {
    const u = (w as any).user as any
    const empName = u?.display_name || u?.full_name || 'Unknown'
    const wDate = (w as any).wfh_date as string
    const row = wfhWs.addRow([
      empName,
      wDate,
      new Date(wDate).toLocaleDateString('en-GB', { weekday: 'long' }),
      wfhTypeLabelXls((w as any).wfh_type ?? 'full'),
      (w as any).notes ?? '',
    ])
    row.height = 18
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.wfh } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = thinBorder()
      cell.font = { size: 10 }
    })
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' }
  }

  // ── Leave Records sheet ──
  const leaveWs = wb.addWorksheet('Leave Records', { properties: { tabColor: { argb: 'FF7C3AED' } } })
  leaveWs.columns = [
    { key: 'emp',    width: 24 },
    { key: 'type',   width: 14 },
    { key: 'start',  width: 14 },
    { key: 'end',    width: 14 },
    { key: 'days',   width: 10 },
    { key: 'status', width: 12 },
    { key: 'notes',  width: 36 },
  ]

  leaveWs.mergeCells('A1:G1')
  const lt = leaveWs.getCell('A1')
  lt.value = `Leave Records — ${from} to ${to}`
  lt.font = { bold: true, size: 14 }
  lt.alignment = { horizontal: 'left', vertical: 'middle' }
  leaveWs.getRow(1).height = 24
  leaveWs.mergeCells('A2:G2')
  leaveWs.getCell('A2').value = `Generated: ${new Date().toLocaleDateString('en-GB')} | StaffPortal`
  leaveWs.getCell('A2').font = { size: 10, color: { argb: 'FF888888' } }
  leaveWs.getRow(2).height = 16
  leaveWs.getRow(3).height = 6

  const lhdr = leaveWs.addRow(['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Notes'])
  lhdr.height = 22
  lhdr.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder()
  })

  const leaveStatusColor: Record<string, string> = {
    approved: 'D6F5E3',
    rejected: 'FFE0E0',
    pending:  'FFF4CC',
  }

  for (const lr of allLeave ?? []) {
    const u = (lr as any).user as any
    const empName = u?.display_name || u?.full_name || 'Unknown'
    const status = ((lr as any).status ?? '').toLowerCase()
    const leaveBg = leaveStatusColor[status] ?? COLORS.default
    const row = leaveWs.addRow([
      empName,
      ((lr as any).leave_type ?? '').replace(/_/g, ' '),
      (lr as any).start_date ?? '',
      (lr as any).end_date ?? '',
      (lr as any).days_taken ?? '',
      status,
      (lr as any).notes ?? '',
    ])
    row.height = 18
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + leaveBg } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = thinBorder()
      cell.font = { size: 10 }
    })
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(1).font = { size: 10, bold: true }
    row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { base64, filename: `timesheets_all_${from}_to_${to}.xlsx` }
}
