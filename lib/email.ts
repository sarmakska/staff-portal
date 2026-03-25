// ============================================================
// Resend Email Client — Server-side only
// All email sending goes through this module.
// NEVER import in client components.
// ============================================================

import { Resend } from 'resend'
import PDFDocument from 'pdfkit'

if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY is not set — emails will be silently skipped.')
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@yournotifications.com'

// ── Template variable replacement ───────────────────────────

function applyTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}

// ── Base email data types ────────────────────────────────────

interface BaseEmailProps {
    to: string | string[]
    subject: string
    html: string
    text?: string
    replyTo?: string
    cc?: string | string[]
    attachments?: { filename: string; content: Buffer }[]
}

async function sendEmail(props: BaseEmailProps): Promise<{ success: boolean; error?: string }> {
    if (!resend) {
        console.warn('[Email] Skipping email send — RESEND_API_KEY not configured.')
        return { success: true }
    }
    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: Array.isArray(props.to) ? props.to : [props.to],
            subject: props.subject,
            html: props.html,
            text: props.text,
            replyTo: props.replyTo,
            cc: props.cc,
            attachments: props.attachments,
        })

        if (error) {
            console.error('[Email] Resend error:', error)
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown email error'
        console.error('[Email] Unexpected error:', message)
        return { success: false, error: message }
    }
}

// ── Email: Leave Submitted ───────────────────────────────────

export interface LeaveSubmittedParams {
    employeeEmail: string
    employeeName: string
    leaveType: string
    startDate: string
    endDate: string
    daysCount: number
    reason: string
    approverName: string
    approverEmail: string
    leaveBalanceRemaining: number
}

export async function sendLeaveSubmittedEmail(params: LeaveSubmittedParams) {
    const vars: Record<string, string> = {
        employee_name: params.employeeName,
        leave_type: params.leaveType,
        start_date: params.startDate,
        end_date: params.endDate,
        days_count: String(params.daysCount),
        reason: params.reason,
        approver_name: params.approverName,
        leave_balance_remaining: String(params.leaveBalanceRemaining),
    }

    const subject = applyTemplate(
        'Leave Request Submitted — {{leave_type}} ({{start_date}} to {{end_date}})',
        vars
    )

    // Email 1: Employee confirmation
    await sendEmail({
        to: [params.employeeEmail],
        subject,
        html: applyTemplate(getLeaveSubmittedHtml(), vars),
        text: applyTemplate(getLeaveSubmittedText(), vars),
    })

    // Email 2: Approver notification (separate email, different content)
    if (params.approverEmail && params.approverEmail !== params.employeeEmail) {
        const approverHtml = buildSimpleHtml({
            heading: 'Leave Request — Action Required',
            accentColor: '#f59e0b',
            body: `
            <h2 style="margin:0 0 20px;font-size:20px;color:#111827;font-weight:700;">Leave Request — Action Required</h2>
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">Hi <strong>${params.approverName}</strong>,</p>
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>${params.employeeName}</strong> has submitted a leave request and is awaiting your approval.
              Please log in to StaffPortal to review and action this request.
            </p>
            ${infoTable([
                ['Employee', params.employeeName],
                ['Leave Type', params.leaveType],
                ['Start Date', params.startDate],
                ['End Date', params.endDate],
                ['Days Requested', `${params.daysCount} days`],
                ['Reason', params.reason || '—'],
            ])}
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">Log in to StaffPortal → Approvals to approve or reject this request.</p>`,
        })
        const approverText = `Hi ${params.approverName}, ${params.employeeName} has submitted a leave request (${params.leaveType}, ${params.startDate} to ${params.endDate}, ${params.daysCount} days). Please log in to StaffPortal to approve or reject. — StaffPortal`
        await sendEmail({
            to: [params.approverEmail],
            subject: `Action Required: Leave Request from ${params.employeeName}`,
            html: approverHtml,
            text: approverText,
        })
    }
}

// ── Email: Leave Approved ────────────────────────────────────

export interface LeaveApprovedParams {
    employeeEmail: string
    accountsEmails: string[]
    employeeName: string
    leaveType: string
    startDate: string
    endDate: string
    daysCount: number
    approverName: string
    approverEmail: string
    leaveBalanceRemaining: number
}

export async function sendLeaveApprovedEmail(params: LeaveApprovedParams) {
    const approvalDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const leaveTypeLabel = params.leaveType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const subject = `Leave Approved — ${leaveTypeLabel} (${params.startDate} to ${params.endDate})`

    // ── Email 1: Employee — simple approval confirmation, no PDF ──────────────
    const employeeHtml = buildSimpleHtml({
        heading: 'Leave Approved',
        accentColor: '#16a34a',
        body: `
        <h2 style="margin:0 0 20px;font-size:22px;color:#16a34a;font-weight:700;">Your Leave Has Been Approved</h2>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">Hi <strong>${params.employeeName}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          Your leave request has been approved by <strong>${params.approverName}</strong>. Please see the details below.
        </p>
        ${infoTable([
            ['Leave Type', leaveTypeLabel],
            ['Start Date', params.startDate],
            ['End Date', params.endDate],
            ['Days Approved', `${params.daysCount} days`],
            ['Approved By', params.approverName],
            ['Approval Date', approvalDate],
            ['Remaining Balance', `${params.leaveBalanceRemaining} days`, '#16a34a'],
        ])}
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">If you have any questions, please speak to your line manager directly.</p>`,
    })
    await sendEmail({ to: params.employeeEmail, subject, html: employeeHtml, text: `Hi ${params.employeeName}, your ${leaveTypeLabel} request (${params.startDate} to ${params.endDate}, ${params.daysCount} days) has been approved by ${params.approverName}. Remaining balance: ${params.leaveBalanceRemaining} days. — StaffPortal` })

    // ── Email 2: Accounts — full details + where to find the PDF ────────────
    const pdfUrl = `https://your-staffportal-url.com/admin/leave-records`
    const accountsHtml = buildSimpleHtml({
        heading: 'Leave Approved — For Your Records',
        accentColor: '#2563eb',
        body: `
        <h2 style="margin:0 0 20px;font-size:20px;color:#111827;font-weight:700;">Leave Approved — For Your Records</h2>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          The following leave request has been approved by <strong>${params.approverName}</strong>.
          Please update payroll accordingly.
        </p>
        ${infoTable([
            ['Employee', params.employeeName],
            ['Employee Email', params.employeeEmail],
            ['Leave Type', leaveTypeLabel],
            ['Start Date', params.startDate],
            ['End Date', params.endDate],
            ['Days Approved', `${params.daysCount} days`],
            ['Approved By', params.approverName],
            ['Approval Date', approvalDate],
            ['Remaining Balance', `${params.leaveBalanceRemaining} days`, '#16a34a'],
        ])}
        <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">
          The signed leave authorisation PDF is available to download from StaffPortal:
        </p>
        <p style="margin:0;color:#2563eb;font-size:13px;"><a href="${pdfUrl}" style="color:#2563eb;">${pdfUrl}</a> → Leave Records</p>`,
    })
    const accountsText = `Leave Approved: ${params.employeeName} — ${leaveTypeLabel} (${params.startDate} to ${params.endDate}, ${params.daysCount} days). Approved by ${params.approverName} on ${approvalDate}. Download PDF: ${pdfUrl} — StaffPortal`
    for (const addr of params.accountsEmails) {
        await sendEmail({ to: addr, subject: `Leave Approved — ${params.employeeName} (${leaveTypeLabel}, ${params.daysCount}d)`, html: accountsHtml, text: accountsText })
    }

    return { success: true }
}

// ── Email: Leave Rejected ────────────────────────────────────

export interface LeaveRejectedParams {
    employeeEmail: string
    employeeName: string
    leaveType: string
    startDate: string
    endDate: string
    daysCount: number
    approverName: string
    rejectionReason: string
    leaveBalanceRemaining: number
}

export async function sendLeaveRejectedEmail(params: LeaveRejectedParams) {
    const vars: Record<string, string> = {
        employee_name: params.employeeName,
        leave_type: params.leaveType,
        start_date: params.startDate,
        end_date: params.endDate,
        days_count: String(params.daysCount),
        approver_name: params.approverName,
        rejection_reason: params.rejectionReason,
        leave_balance_remaining: String(params.leaveBalanceRemaining),
    }

    const subject = applyTemplate(
        'Leave Request Declined — {{leave_type}} ({{start_date}} to {{end_date}})',
        vars
    )

    const html = applyTemplate(getLeaveRejectedHtml(), vars)
    const text = applyTemplate(getLeaveRejectedText(), vars)

    return sendEmail({ to: params.employeeEmail, subject, html, text })
}

// ── Email: WFH Notification ──────────────────────────────────

export interface WfhNotificationParams {
    employeeName: string
    departmentName: string
    wfhDate: string
    wfhNotifyEmail: string
    reason?: string
    wfhType?: 'full' | 'half_am' | 'half_pm'
}

const wfhTypeLabel = (t?: 'full' | 'half_am' | 'half_pm') => {
    if (t === 'half_am') return 'Morning Only (AM)'
    if (t === 'half_pm') return 'Afternoon Only (PM)'
    return 'Full Day'
}

export async function sendWfhEmail(params: WfhNotificationParams) {
    const typeLabel = wfhTypeLabel(params.wfhType)
    const isHalfDay = params.wfhType === 'half_am' || params.wfhType === 'half_pm'
    const subject = isHalfDay
        ? `${params.employeeName} is WFH (${typeLabel}) on ${params.wfhDate}`
        : `${params.employeeName} is Working From Home on ${params.wfhDate}`

    const tableRows: [string, string, string?][] = [
        ['Employee', params.employeeName],
        ['Department', params.departmentName],
        ['Date', params.wfhDate],
        ['Type', typeLabel, '#2563eb'],
        ['Status', 'Working From Home', '#2563eb'],
    ]
    if (params.reason) tableRows.push(['Reason', params.reason])

    const html = buildSimpleHtml({
        heading: 'Work From Home Notice',
        accentColor: '#2563eb',
        body: `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;font-weight:700;">Work From Home Notice</h2>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          <strong>${params.employeeName}</strong> from <strong>${params.departmentName}</strong> will be working from home
          ${isHalfDay ? `(<strong>${typeLabel}</strong>) ` : ''}on <strong>${params.wfhDate}</strong>.
          Please direct any urgent matters via email or phone.
        </p>
        ${infoTable(tableRows)}`,
    })
    const text = `${params.employeeName} (${params.departmentName}) will be WFH [${typeLabel}] on ${params.wfhDate}.${params.reason ? ` Reason: ${params.reason}.` : ''} — StaffPortal`

    return sendEmail({ to: params.wfhNotifyEmail, subject, html, text })
}

// ── Email: Early Clock-out ───────────────────────────────────

export interface EarlyClockOutParams {
    notifyEmail: string
    employeeName: string
    departmentName: string
    workDate: string
    clockOutTime: string
    hoursWorked: number
    reason: string
}

export async function sendEarlyClockOutEmail(params: EarlyClockOutParams) {
    const html = buildSimpleHtml({
        heading: 'Early Departure Notice',
        accentColor: '#d97706',
        body: `
        <h2 style="margin:0 0 8px;font-size:20px;color:#d97706;font-weight:700;">Early Departure Notice</h2>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          <strong>${params.employeeName}</strong> clocked out before their expected shift end on <strong>${params.workDate}</strong>.
          Please review if any follow-up is required.
        </p>
        ${infoTable([
            ['Employee', params.employeeName],
            ['Department', params.departmentName],
            ['Date', params.workDate],
            ['Clock-out Time', params.clockOutTime],
            ['Reason Provided', params.reason],
        ])}`,
    })
    const text = `${params.employeeName} (${params.departmentName}) left at ${params.clockOutTime} on ${params.workDate}. Reason: ${params.reason}. — StaffPortal`

    return sendEmail({
        to: params.notifyEmail,
        subject: `Early Departure — ${params.employeeName} on ${params.workDate}`,
        html,
        text,
    })
}

// ── Email: Forgotten Clock-out ───────────────────────────────

export interface ForgottenClockoutParams {
    employeeEmail: string
    receptionEmail: string
    employeeName: string
    departmentName: string
    workDate: string
    clockInTime: string
}

export async function sendForgottenClockoutEmail(params: ForgottenClockoutParams) {
    const correctionsUrl = 'https://your-staffportal-url.com/corrections'
    const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#dc2626;font-weight:700;">You Forgot to Clock Out</h2>
    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
      Hi <strong>${params.employeeName}</strong>, we noticed you didn't clock out today. Please submit a correction request so your timesheet is accurate.
    </p>
    ${infoTable([
        ['Employee', params.employeeName],
        ['Department', params.departmentName],
        ['Date', params.workDate],
        ['Clocked In At', params.clockInTime],
        ['Clock Out', 'Not recorded', '#dc2626'],
    ])}
    <p style="margin:20px 0 0;text-align:center;">
      <a href="${correctionsUrl}" style="display:inline-block;padding:10px 24px;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Submit a Correction</a>
    </p>`

    const html = buildSimpleHtml({ heading: 'Forgotten Clock-out', accentColor: '#dc2626', body })
    const text = `Hi ${params.employeeName}, you forgot to clock out on ${params.workDate} (clocked in at ${params.clockInTime}). Please submit a correction at ${correctionsUrl}. — StaffPortal`

    // Email 1: Employee
    await sendEmail({
        to: params.employeeEmail,
        subject: `Reminder: You forgot to clock out on ${params.workDate}`,
        html,
        text,
    })

    // Email 2: Reception notice
    const receptionBody = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#dc2626;font-weight:700;">Missed Clock-out Alert</h2>
    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
      <strong>${params.employeeName}</strong> did not clock out today. An email reminder has been sent to them.
    </p>
    ${infoTable([
        ['Employee', params.employeeName],
        ['Department', params.departmentName],
        ['Date', params.workDate],
        ['Clocked In At', params.clockInTime],
        ['Clock Out', 'Not recorded', '#dc2626'],
    ])}`

    const receptionHtml = buildSimpleHtml({ heading: 'Missed Clock-out Alert', accentColor: '#dc2626', body: receptionBody })

    await sendEmail({
        to: params.receptionEmail,
        subject: `Missed Clock-out — ${params.employeeName} on ${params.workDate}`,
        html: receptionHtml,
        text: `${params.employeeName} (${params.departmentName}) did not clock out on ${params.workDate}. Clocked in at ${params.clockInTime}. — StaffPortal`,
    })
}

// ── Email: Under Hours ───────────────────────────────────────

export interface UnderHoursParams {
    notifyEmail: string
    employeeName: string
    departmentName: string
    workDate: string
    hoursWorked: number
    contractedHours: number
}

export async function sendUnderHoursEmail(params: UnderHoursParams) {
    const shortfall = (params.contractedHours - params.hoursWorked).toFixed(2)
    const html = buildSimpleHtml({
        heading: 'Under Hours Notice',
        accentColor: '#7c3aed',
        body: `
        <h2 style="margin:0 0 8px;font-size:20px;color:#7c3aed;font-weight:700;">Under Hours Notice</h2>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          Hi <strong>${params.employeeName}</strong>, your recorded hours on <strong>${params.workDate}</strong> were below
          your contracted working day of <strong>${params.contractedHours} hours</strong>. Please review your timesheet or speak
          to your manager if you believe this is an error.
        </p>
        ${infoTable([
            ['Department', params.departmentName],
            ['Date', params.workDate],
            ['Hours Worked', `${params.hoursWorked.toFixed(2)}h`, '#dc2626'],
            ['Contracted Hours', `${params.contractedHours}h`],
            ['Shortfall', `${shortfall}h`, '#7c3aed'],
        ])}`,
    })
    const text = `${params.employeeName} (${params.departmentName}) worked ${params.hoursWorked.toFixed(2)}h on ${params.workDate} — ${shortfall}h short of the ${params.contractedHours}h contracted. — StaffPortal`

    return sendEmail({
        to: params.notifyEmail,
        subject: `Under Hours — ${params.employeeName} on ${params.workDate} (${params.hoursWorked.toFixed(2)}h / ${params.contractedHours}h)`,
        html,
        text,
    })
}

// ── Email: Running Late ──────────────────────────────────────

export interface RunningLateParams {
    notifyEmail: string
    employeeName: string
    departmentName: string
    date: string
    reason?: string
    expectedArrival?: string
    loggedBy?: string
}

export async function sendRunningLateEmail(params: RunningLateParams) {
    const loggedByLabel = params.loggedBy && params.loggedBy !== 'Self'
        ? `Reception (${params.loggedBy})`
        : 'Employee (self-reported)'
    const subject = `Running Late — ${params.employeeName} — ${params.date}`

    const tableRows: [string, string, string?][] = [
        ['Employee', params.employeeName],
        ['Department', params.departmentName],
        ['Date', params.date],
        ['Status', 'Running Late', '#d97706'],
    ]
    if (params.expectedArrival) tableRows.push(['Expected Arrival', params.expectedArrival])
    if (params.reason) tableRows.push(['Reason', params.reason])
    tableRows.push(['Logged By', loggedByLabel])

    const loggedByNote = params.loggedBy && params.loggedBy !== 'Self'
        ? `This notification was logged by <strong>reception</strong> on behalf of the employee.`
        : `This notification was <strong>self-reported</strong> by the employee.`

    const html = buildSimpleHtml({
        heading: 'Running Late Notice',
        accentColor: '#d97706',
        body: `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;font-weight:700;">Running Late Notice</h2>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          <strong>${params.employeeName}</strong> from <strong>${params.departmentName}</strong> will be arriving late on <strong>${params.date}</strong>.
          ${params.expectedArrival ? `Expected arrival: <strong>${params.expectedArrival}</strong>.` : 'They will clock in when they arrive.'}
        </p>
        ${infoTable(tableRows)}
        <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">${loggedByNote}</p>`,
    })
    const text = `${params.employeeName} (${params.departmentName}) is running late on ${params.date}.${params.expectedArrival ? ` Expected arrival: ${params.expectedArrival}.` : ''}${params.reason ? ` Reason: ${params.reason}.` : ''} Logged by: ${loggedByLabel} — StaffPortal`

    return sendEmail({ to: params.notifyEmail, subject, html, text })
}

// ── Diary Reminder ───────────────────────────────────────────

interface DiaryReminderParams {
    to: string
    name: string
    title: string
    content: string | null
    tags: string[]
    reminderAt: string // human-readable date/time string
}

export async function sendDiaryReminderEmail(params: DiaryReminderParams) {
    const subject = `📔 Reminder: ${params.title}`

    // Strip HTML tags for plain-text fallback only
    const plainContent = params.content
        ? params.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : ''

    // Tags pills
    const tagsHtml = params.tags?.length
        ? params.tags.map(t =>
            `<span style="display:inline-block;background:#ede9fe;color:#5b21b6;font-size:12px;font-weight:600;padding:4px 12px;border-radius:99px;margin:3px 4px 3px 0;border:1px solid #ddd6fe;">${t}</span>`
          ).join('')
        : ''

    // Notes block — render the Tiptap HTML directly, with email-safe inline styles for common elements
    const notesBlock = params.content ? `
        <!-- Notes section -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="border:1px solid #e0e7ff;border-radius:10px;overflow:hidden;margin:24px 0 0;">
          <tr>
            <td style="background:#eef2ff;padding:10px 20px;border-bottom:1px solid #e0e7ff;">
              <span style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;">&#128221; Notes</span>
            </td>
          </tr>
          <tr>
            <td style="background:#fafaff;padding:20px 24px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#1f2937;line-height:1.8;">
                ${params.content}
              </div>
            </td>
          </tr>
        </table>` : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Diary Reminder — ${params.title}</title>
  <style>
    /* Inline content styles for email clients that support <style> */
    .diary-content { font-family: Georgia, 'Times New Roman', serif; font-size: 14px; color: #1f2937; line-height: 1.8; }
    .diary-content h1 { font-size: 22px; font-weight: 700; margin: 16px 0 8px; color: #111827; }
    .diary-content h2 { font-size: 18px; font-weight: 700; margin: 14px 0 6px; color: #111827; }
    .diary-content h3 { font-size: 15px; font-weight: 700; margin: 12px 0 4px; color: #111827; }
    .diary-content p  { margin: 0 0 10px; }
    .diary-content ul, .diary-content ol { margin: 8px 0 8px 24px; padding: 0; }
    .diary-content li { margin-bottom: 4px; }
    .diary-content ul li { list-style-type: disc; }
    .diary-content ol li { list-style-type: decimal; }
    .diary-content blockquote { border-left: 3px solid #c4b5fd; margin: 12px 0; padding: 8px 16px; color: #6b7280; font-style: italic; background: #faf5ff; }
    .diary-content strong { font-weight: 700; }
    .diary-content em { font-style: italic; }
    .diary-content u { text-decoration: underline; }
    .diary-content s { text-decoration: line-through; }
    .diary-content a { color: #4f46e5; text-decoration: underline; }
    .diary-content mark { border-radius: 2px; padding: 0 2px; }
    .diary-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
    .diary-content table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    .diary-content table td, .diary-content table th { border: 1px solid #d1d5db; padding: 8px 12px; font-size: 13px; vertical-align: top; }
    .diary-content table th { background: #f3f4f6; font-weight: 700; }
    .diary-content [style*="text-align: center"] { text-align: center; }
    .diary-content [style*="text-align: right"]  { text-align: right; }
    .diary-content [style*="text-align: justify"] { text-align: justify; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f0f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#312e81,#4f46e5);border-radius:14px 14px 0 0;padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.3px;">StaffPortal</span><br>
                    <span style="color:#a5b4fc;font-size:11px;letter-spacing:0.03em;">Your Company &bull; Personal Diary</span>
                  </td>
                  <td align="right" style="font-size:36px;line-height:1;">&#128214;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr><td style="background:#6366f1;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 36px 28px;border-radius:0 0 14px 14px;">

              <!-- Greeting -->
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Good morning,</p>
              <h2 style="margin:0 0 8px;font-size:24px;color:#111827;font-weight:800;line-height:1.2;letter-spacing:-0.4px;">You have a diary reminder</h2>
              <p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.6;">
                Hi <strong style="color:#374151;">${params.name}</strong> — here is the note you set a reminder for.
              </p>

              <!-- Entry card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background:linear-gradient(135deg,#f5f3ff,#eef2ff);border:1.5px solid #c7d2fe;border-radius:14px;overflow:hidden;margin-bottom:8px;">
                <tr>
                  <td style="padding:24px 28px 20px;">

                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.1em;">&#128338; Diary Entry</p>
                    <p style="margin:0 0 14px;font-size:22px;font-weight:800;color:#1e1b4b;line-height:1.25;letter-spacing:-0.3px;">${params.title}</p>

                    <!-- Meta row -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                      style="background:#ffffff;border:1px solid #e0e7ff;border-radius:8px;overflow:hidden;margin-bottom:4px;">
                      <tr>
                        <td style="padding:10px 16px;border-bottom:1px solid #e0e7ff;font-size:13px;color:#374151;">
                          <span style="color:#6366f1;font-weight:700;">&#128337; Reminder:</span>&nbsp;&nbsp;<strong>${params.reminderAt}</strong>
                        </td>
                      </tr>
                      ${params.tags?.length ? `<tr>
                        <td style="padding:10px 16px;font-size:13px;color:#374151;">
                          <span style="color:#6366f1;font-weight:700;">&#127991; Tags:</span>&nbsp;&nbsp;${tagsHtml}
                        </td>
                      </tr>` : ''}
                    </table>

                    ${notesBlock}

                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:#4f46e5;">
                    <a href="https://your-staffportal-url.com/diary" target="_blank"
                      style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                      Open Diary &#8594;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;font-style:italic;">
                      This reminder was set by you in StaffPortal. Please do not reply to this email.
                    </p>
                    <p style="margin:0;color:#d1d5db;font-size:11px;">&copy; Your Company &bull; Internal communications only</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const text = [
        `Good morning ${params.name},`,
        ``,
        `DIARY REMINDER: ${params.title}`,
        `Scheduled for: ${params.reminderAt}`,
        params.tags?.length ? `Tags: ${params.tags.join(', ')}` : '',
        ``,
        plainContent ? `Notes:\n${plainContent}` : '',
        ``,
        `Open your diary: https://your-staffportal-url.com/diary`,
        ``,
        `— StaffPortal, Your Company`,
    ].filter(Boolean).join('\n')

    return sendEmail({ to: params.to, subject, html, text })
}

// ── Birthday Reminder (to colleagues) ─────────────────────────

export interface BirthdayReminderParams {
    to: string
    recipientName: string
    birthdayPersonName: string
    birthdayDate: string
}

export async function sendBirthdayReminderEmail(params: BirthdayReminderParams) {
    const subject = `🎉 It's ${params.birthdayPersonName}'s Birthday Today!`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Birthday Reminder</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

        <tr>
          <td style="background:#111827;border-radius:12px 12px 0 0;padding:20px 32px 0;">
            <span style="color:#fff;font-size:15px;font-weight:700;">StaffPortal</span>&nbsp;
            <span style="color:#6b7280;font-size:11px;">· Your Company</span>
          </td>
        </tr>

        <!-- Pink/gold gradient hero -->
        <tr>
          <td style="background:linear-gradient(135deg,#db2777 0%,#ea580c 50%,#d97706 100%);padding:40px 32px 36px;text-align:center;">
            <div style="font-size:80px;line-height:1;margin-bottom:16px;">🎂</div>
            <h1 style="margin:0 0 10px;font-size:30px;font-weight:900;color:#fff;letter-spacing:-0.5px;line-height:1.1;">
              It's Someone's Birthday! 🎉
            </h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);">Spread some joy today 🥳</p>
          </td>
        </tr>

        <tr><td style="background:linear-gradient(90deg,#fbbf24,#fde68a,#fbbf24);height:3px;font-size:0;">&nbsp;</td></tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:36px 32px;border-radius:0 0 12px 12px;">

            <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Hi <strong style="color:#374151;">${params.recipientName}</strong>,</p>
            <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#111827;line-height:1.3;">
              Today is <span style="color:#db2777;">${params.birthdayPersonName}</span>'s Birthday! 🎊
            </h2>

            <!-- Card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background:linear-gradient(135deg,#fdf2f8,#fff7ed);border:2px solid #fbcfe8;border-radius:14px;margin:0 0 24px;">
              <tr><td style="padding:28px;text-align:center;">
                <div style="font-size:40px;margin-bottom:14px;">🎈&nbsp;&nbsp;🎁&nbsp;&nbsp;🥂</div>
                <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827;">
                  Give <span style="color:#db2777;">${params.birthdayPersonName}</span> a big birthday wish today!
                </p>
                <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.7;">
                  A quick message, a smile, or a coffee goes a long way.<br>Make their day extra special! ✨
                </p>
                ${params.birthdayDate
                    ? `<span style="display:inline-block;background:#fce7f3;color:#be185d;font-size:13px;font-weight:600;padding:6px 18px;border-radius:99px;">🗓 ${params.birthdayDate}</span>`
                    : ''}
              </td></tr>
            </table>

            <p style="margin:0 0 28px;font-size:14px;color:#374151;text-align:center;line-height:1.7;">
              From all of us at <strong>Your Company</strong> — let's make today memorable! 🎂
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:20px;">
              <tr><td>
                <p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-style:italic;">This is a system-generated email from StaffPortal. Please do not reply.</p>
                <p style="margin:0;color:#9ca3af;font-size:11px;">&copy; Your Company &bull; Internal communications only</p>
              </td></tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    const text = `Hi ${params.recipientName}! Today is ${params.birthdayPersonName}'s birthday! Give them a big birthday wish — a message, smile, or coffee makes all the difference. From all of us at Your Company 🎂 — StaffPortal`

    return sendEmail({ to: params.to, subject, html, text })
}

// ── Birthday Wish (to the birthday person themselves) ──────────

export interface BirthdayWishParams {
    to: string
    name: string
    birthdayDate?: string
}

export async function sendBirthdayWishEmail(params: BirthdayWishParams) {
    const subject = `🎂 Happy Birthday from Your Company, ${params.name}!`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Happy Birthday!</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

        <!-- Deep navy hero for the birthday person -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 45%,#1e3a5f 100%);border-radius:12px 12px 0 0;padding:44px 32px 36px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:0.18em;text-transform:uppercase;">Your Company</p>
            <div style="font-size:88px;line-height:1;margin:16px 0 20px;">🎂</div>
            <h1 style="margin:0 0 8px;font-size:34px;font-weight:900;color:#fff;letter-spacing:-0.5px;line-height:1.1;">
              Happy Birthday,<br><span style="color:#fbbf24;">${params.name}!</span>
            </h1>
            <p style="margin:12px 0 0;font-size:15px;color:rgba(255,255,255,0.7);">Wishing you a wonderful day 🌟</p>
          </td>
        </tr>

        <!-- Gold shimmer bar -->
        <tr><td style="background:linear-gradient(90deg,#92400e,#fbbf24,#fde68a,#fbbf24,#92400e);height:4px;font-size:0;">&nbsp;</td></tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:36px 32px;border-radius:0 0 12px 12px;">

            <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#111827;">Dear ${params.name},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.8;">
              On behalf of everyone at <strong>Your Company</strong>, we want to take a moment
              to celebrate <em>you</em> and wish you a truly special birthday today! 🥳
            </p>

            <!-- Quote card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background:linear-gradient(135deg,#eff6ff,#fdf4ff);border:2px solid #dbeafe;border-radius:14px;margin:0 0 28px;">
              <tr><td style="padding:28px;text-align:center;">
                <div style="font-size:36px;margin-bottom:16px;">🎉&nbsp;🎈&nbsp;🥂&nbsp;🎁&nbsp;🌟</div>
                <p style="margin:0;font-size:15px;color:#374151;line-height:1.9;font-style:italic;">
                  "May this birthday bring you joy, laughter, and everything<br>
                  you've been wishing for. You're a valued part of our team<br>
                  and we're grateful to have you with us."
                </p>
              </td></tr>
            </table>

            <!-- Signature -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin:0 0 28px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">With warmest wishes,</p>
                <p style="margin:0 0 4px;font-size:14px;color:#374151;font-weight:600;">The Your Company Team 💙</p>
                <p style="margin:0;font-size:13px;color:#9ca3af;">your-staffportal-url.com</p>
              </td></tr>
            </table>

            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;text-align:center;line-height:1.7;">
              Have a fantastic birthday — enjoy every single moment! 🎂✨
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:20px;">
              <tr><td>
                <p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-style:italic;">This is a system-generated email from StaffPortal. Please do not reply.</p>
                <p style="margin:0;color:#9ca3af;font-size:11px;">&copy; Your Company &bull; Internal communications only</p>
              </td></tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    const text = `Happy Birthday ${params.name}! On behalf of everyone at Your Company, we wish you a wonderful day! You're a valued part of our team. Have a fantastic birthday! — The Your Company Team 🎂`

    return sendEmail({ to: params.to, subject, html, text })
}

// ── HTML builders ────────────────────────────────────────────

function buildSimpleHtml({ heading, accentColor = '#111827', body }: {
    heading: string; accentColor?: string; body: string
}): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#111827;border-radius:12px 12px 0 0;padding:24px 32px;">
              <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-0.2px;">StaffPortal</span><br>
              <span style="color:#9ca3af;font-size:11px;">Your Company &bull; Internal Office System</span>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background-color:${accentColor};height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:32px;border-radius:0 0 12px 12px;">
              ${body}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="padding-top:20px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-style:italic;">
                      This is a system-generated email from StaffPortal. Please do not reply.
                    </p>
                    <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.6;">
                      &copy; Your Company &bull; Internal communications only
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function infoTable(rows: [string, string, string?][]): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:20px 0;">
${rows.map(([label, value, color], i) => `      <tr style="background-color:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
        <td style="padding:11px 16px;color:#6b7280;font-size:13px;width:42%;border-bottom:1px solid #e5e7eb;">${label}</td>
        <td style="padding:11px 16px;color:${color ?? '#111827'};font-size:13px;font-weight:${color ? '700' : '500'};border-bottom:1px solid #e5e7eb;">${value}</td>
      </tr>`).join('\n')}
    </table>`
}

// ── Leave email templates ──────────────────────────────────────

function getLeaveSubmittedHtml(): string {
    return buildSimpleHtml({
        heading: 'Leave Request Submitted',
        accentColor: '#2563eb',
        body: `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;font-weight:700;">Leave Request Submitted</h2>
        <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Reference: MN-LEAVE</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">Hi <strong>{{employee_name}}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          Your leave request has been submitted successfully and is currently <strong>pending approval</strong> from <strong>{{approver_name}}</strong>.
          You will be notified once a decision has been made.
        </p>
        ${infoTable([
            ['Leave Type', '{{leave_type}}'],
            ['Start Date', '{{start_date}}'],
            ['End Date', '{{end_date}}'],
            ['Days Requested', '{{days_count}} days'],
            ['Reason', '{{reason}}'],
            ['Remaining Balance', '{{leave_balance_remaining}} days', '#2563eb'],
        ])}
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">If you have any questions, please speak to your line manager directly.</p>`,
    })
}

function getLeaveSubmittedText(): string {
    return 'Hi {{employee_name}}, your {{leave_type}} leave from {{start_date}} to {{end_date}} ({{days_count}} days) has been submitted and is pending approval from {{approver_name}}. Reason: {{reason}}. Remaining balance: {{leave_balance_remaining}} days. — StaffPortal'
}

// ── PDF Generator ──────────────────────────────────────────

async function generateLeaveApprovalPdf(params: LeaveApprovedParams & { approvalDate: string; leaveTypeLabel: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' })
        const chunks: Buffer[] = []
        doc.on('data', (chunk: Buffer) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        const green = '#16a34a'
        const dark = '#111827'
        const muted = '#6b7280'
        const lightGray = '#f3f4f6'
        const borderGray = '#e5e7eb'

        // Header bar
        doc.rect(0, 0, 595, 70).fill(dark)
        doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold').text('StaffPortal', 50, 22)
        doc.fontSize(10).fillColor('#9ca3af').font('Helvetica').text('Your Company  •  Internal Office System', 50, 44)

        // Green accent stripe
        doc.rect(0, 70, 595, 4).fill(green)

        // Title
        doc.moveDown(2)
        doc.fontSize(20).fillColor(green).font('Helvetica-Bold').text('Leave Approval Certificate', 50, 95)
        doc.fontSize(11).fillColor(muted).font('Helvetica').text(`Generated: ${params.approvalDate}`, 50, 120)

        // Details table
        const rows: [string, string][] = [
            ['Employee', params.employeeName],
            ['Employee Email', params.employeeEmail],
            ['Leave Type', params.leaveTypeLabel],
            ['Start Date', params.startDate],
            ['End Date', params.endDate],
            ['Days Approved', `${params.daysCount} days`],
            ['Approved By', params.approverName],
            ['Approver Email', params.approverEmail],
            ['Approval Date', params.approvalDate],
            ['Remaining Balance', `${params.leaveBalanceRemaining} days`],
        ]

        let y = 148
        const colLabel = 50
        const colValue = 220
        const rowH = 28

        rows.forEach(([label, value], i) => {
            if (i % 2 === 0) doc.rect(colLabel - 8, y - 6, 500, rowH).fill(lightGray)
            doc.rect(colLabel - 8, y - 6, 500, rowH).strokeColor(borderGray).stroke()
            doc.fontSize(10).fillColor(muted).font('Helvetica').text(label, colLabel, y)
            const isBalance = label === 'Remaining Balance'
            doc.fontSize(10).fillColor(isBalance ? green : dark).font(isBalance ? 'Helvetica-Bold' : 'Helvetica').text(value, colValue, y)
            y += rowH
        })

        // Footer
        doc.rect(0, 770, 595, 72).fill(lightGray)
        doc.fontSize(9).fillColor(muted).font('Helvetica-Oblique')
            .text('This is a system-generated document from StaffPortal. Please do not reply to the accompanying email.', 50, 778, { width: 495 })
        doc.fontSize(9).fillColor(muted).font('Helvetica')
            .text('© Your Company  •  Internal communications only', 50, 795)

        doc.end()
    })
}

function getLeaveRejectedHtml(): string {
    return buildSimpleHtml({
        heading: 'Leave Request Declined',
        accentColor: '#dc2626',
        body: `
        <h2 style="margin:0 0 8px;font-size:20px;color:#dc2626;font-weight:700;">Leave Request Declined</h2>
        <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Reference: MN-LEAVE</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">Hi <strong>{{employee_name}}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          We regret to inform you that your leave request has been <strong style="color:#dc2626;">declined</strong> by <strong>{{approver_name}}</strong>.
          Please see the reason below and speak to your manager if you have any questions.
        </p>
        ${infoTable([
            ['Leave Type', '{{leave_type}}'],
            ['Start Date', '{{start_date}}'],
            ['End Date', '{{end_date}}'],
            ['Days Requested', '{{days_count}} days'],
            ['Declined By', '{{approver_name}}'],
            ['Reason for Decline', '{{rejection_reason}}', '#dc2626'],
            ['Current Balance', '{{leave_balance_remaining}} days remaining'],
        ])}
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">Your leave balance has not been affected.</p>`,
    })
}

function getLeaveRejectedText(): string {
    return 'Hi {{employee_name}}, your {{leave_type}} leave from {{start_date}} to {{end_date}} has been DECLINED by {{approver_name}}. Reason: {{rejection_reason}}. Balance unchanged: {{leave_balance_remaining}} days. — StaffPortal'
}

// ── Email: Correction Reviewed (notify employee of decision) ──

export interface CorrectionReviewedParams {
    employeeEmail: string
    employeeName: string
    workDate: string
    field: string
    originalValue: string | null
    proposedValue: string
    action: 'approved' | 'rejected'
    reviewerName: string
    comment?: string
}

export async function sendCorrectionReviewedEmail(params: CorrectionReviewedParams) {
    const fieldLabel = FIELD_LABEL[params.field] ?? params.field
    const workDateFmt = fmtIsoDate(params.workDate)
    const originalFmt = fmtIsoTime(params.originalValue)
    const proposedFmt = fmtIsoTime(params.proposedValue)
    const approved = params.action === 'approved'
    const accentColor = approved ? '#16a34a' : '#dc2626'
    const actionLabel = approved ? 'Approved' : 'Rejected'

    const html = buildSimpleHtml({
        heading: `Correction ${actionLabel}`,
        accentColor,
        body: `
        <h2 style="margin:0 0 8px;font-size:20px;color:${accentColor};font-weight:700;">Correction ${actionLabel}</h2>
        <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">MN-CORRECTION</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">Hi <strong>${params.employeeName}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          Your attendance correction request has been <strong style="color:${accentColor};">${actionLabel.toLowerCase()}</strong> by <strong>${params.reviewerName}</strong>.
          ${approved ? 'Your attendance record has been updated.' : 'No changes have been made to your attendance record.'}
        </p>
        ${infoTable([
            ['Work Date', workDateFmt],
            ['Field', fieldLabel],
            ['Original Value', originalFmt],
            ['Requested Change', proposedFmt],
            ['Decision', actionLabel, accentColor],
            ...(params.reviewerName ? [['Reviewed By', params.reviewerName] as [string, string]] : []),
        ])}
        ${params.comment ? `
        <div style="background-color:${approved ? '#f0fdf4' : '#fef2f2'};border:1px solid ${approved ? '#bbf7d0' : '#fecaca'};border-radius:8px;padding:14px 16px;margin:0 0 20px;">
          <p style="margin:0 0 4px;color:${approved ? '#166534' : '#991b1b'};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Comment from reviewer</p>
          <p style="margin:0;color:${approved ? '#14532d' : '#7f1d1d'};font-size:14px;line-height:1.5;">"${params.comment}"</p>
        </div>` : ''}
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
          ${approved ? 'You can view the updated record in your Attendance page.' : 'If you have questions, please speak to your manager or contact reception.'}
        </p>`,
    })

    const text = `Hi ${params.employeeName}, your correction request for ${fieldLabel} on ${workDateFmt} has been ${actionLabel.toLowerCase()} by ${params.reviewerName}.${params.comment ? ` Comment: "${params.comment}"` : ''} — StaffPortal`

    return sendEmail({
        to: params.employeeEmail,
        subject: `Correction ${actionLabel} — ${fieldLabel} on ${workDateFmt}`,
        html,
        text,
    })
}

// ── Email: Correction Submitted (notify reception) ────────────

export interface CorrectionSubmittedParams {
    employeeName: string
    employeeEmail: string
    workDate: string
    field: string
    originalValue: string | null
    proposedValue: string
    reason: string
    recipientName?: string
}

const FIELD_LABEL: Record<string, string> = {
    clock_in: 'Clock In',
    clock_out: 'Clock Out',
    break_start: 'Break Start',
    break_end: 'Break End',
}

function fmtIsoTime(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtIsoDate(iso: string): string {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
}

export async function sendCorrectionSubmittedEmail(params: CorrectionSubmittedParams) {
    const receptionEmail = process.env.RECEPTION_NOTIFY_EMAIL ?? 'reception@yourcompany.com'
    const fieldLabel = FIELD_LABEL[params.field] ?? params.field
    const workDateFmt = fmtIsoDate(params.workDate)
    const originalFmt = fmtIsoTime(params.originalValue)
    const proposedFmt = fmtIsoTime(params.proposedValue)

    const html = buildSimpleHtml({
        heading: 'Attendance Correction Request',
        accentColor: '#d97706',
        body: `
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827;font-weight:700;">Attendance Correction Request</h2>
        <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Requires your review &bull; MN-CORRECTION</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">Hi <strong>${params.recipientName ?? 'Reception'}</strong>,</p>
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
          <strong>${params.employeeName}</strong> has submitted an attendance correction request for
          <strong>${workDateFmt}</strong>. Please review and action this from the
          <strong>Corrections &rarr; Team Queue</strong> page.
        </p>
        ${infoTable([
            ['Employee', params.employeeName],
            ['Email', params.employeeEmail],
            ['Work Date', workDateFmt],
            ['Field', fieldLabel],
            ['Current Value', originalFmt],
            ['Requested Change', proposedFmt, '#d97706'],
        ])}
        <div style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
          <p style="margin:0 0 4px;color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Reason given</p>
          <p style="margin:0;color:#78350f;font-size:14px;line-height:1.5;">"${params.reason}"</p>
        </div>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
          Log in to StaffPortal and go to <strong>Corrections &rarr; Team Queue</strong> to approve or reject this request.
        </p>`,
    })

    const text = `Attendance Correction Request — ${params.employeeName} (${params.employeeEmail})\n\nWork Date: ${workDateFmt}\nField: ${fieldLabel}\nCurrent: ${originalFmt} → Requested: ${proposedFmt}\nReason: "${params.reason}"\n\nLog in to StaffPortal → Corrections → Team Queue to review.\n\n— StaffPortal`

    return sendEmail({
        to: receptionEmail,
        subject: `Correction Request — ${params.employeeName} · ${fieldLabel} on ${workDateFmt}`,
        html,
        text,
    })
}

// ── Email: Visitor Booking Confirmation ─────────────────────

export interface VisitorBookingParams {
    visitorEmail: string
    visitorName: string
    hostName: string
    visitDate: string       // formatted, e.g. "Monday, 20 March 2026"
    timeWindow: string      // e.g. "09:00 – 10:00"
    referenceCode: string
    purpose: string
    company?: string
}

export async function sendVisitorBookingEmail(params: VisitorBookingParams) {
    const html = getVisitorBookingHtml(params)
    const text = [
        `Hello ${params.visitorName},`,
        '',
        `Your visit to Your Company has been confirmed.`,
        '',
        `Reference Code: ${params.referenceCode}`,
        `Date: ${params.visitDate}`,
        `Arrival Window: ${params.timeWindow}`,
        `Visiting: ${params.hostName}`,
        `Purpose: ${params.purpose}`,
        '',
        `Office Address:`,
        `Your Company`,
        `3rd Floor, Kantar Building`,
        `Westgate, Hanger Lane`,
        `London W5 1UA`,
        '',
        `Reception: +44 208 753 7100`,
        '',
        `Please quote your reference code at reception or enter it at the kiosk on arrival.`,
        '',
        `We look forward to welcoming you!`,
        '',
        `Warm regards,`,
        `The Your Company Team`,
    ].join('\n')

    const receptionEmail = process.env.RECEPTION_NOTIFY_EMAIL ?? 'reception@yourcompany.com'

    return sendEmail({
        to: params.visitorEmail,
        cc: receptionEmail,
        subject: `Your Visit to Your Company — ${params.visitDate} · Ref: ${params.referenceCode}`,
        html,
        text,
    })
}

function getVisitorBookingHtml(p: VisitorBookingParams): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your Visit is Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#111827;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Your Company</p>
              <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;letter-spacing:0.5px;text-transform:uppercase;">Visitor Booking Confirmation</p>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background-color:#b89a72;height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 32px 28px;border-radius:0 0 12px 12px;">

              <h2 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:700;">Your visit is confirmed!</h2>
              <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7;">
                Dear <strong>${p.visitorName}</strong>,<br><br>
                We are delighted to welcome you to Your Company. Your booking has been confirmed — please find your visit details below and keep your reference code handy for a smooth check-in.
              </p>

              <!-- Reference Code Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#faf8f5;border:2px dashed #c8aa82;border-radius:10px;padding:20px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;">Your Reference Code</p>
                    <p style="margin:0;font-size:36px;font-weight:800;letter-spacing:8px;color:#111827;font-family:monospace;">${p.referenceCode}</p>
                    <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Show this at reception or enter it at the kiosk on arrival</p>
                  </td>
                </tr>
              </table>

              <!-- Visit Details -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 24px;">
                <tr>
                  <td colspan="2" style="background-color:#f9fafb;padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;">Visit Details</span>
                  </td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:11px 16px;color:#6b7280;font-size:13px;width:42%;border-bottom:1px solid #e5e7eb;">Date</td>
                  <td style="padding:11px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">${p.visitDate}</td>
                </tr>
                <tr style="background-color:#f9fafb;">
                  <td style="padding:11px 16px;color:#6b7280;font-size:13px;width:42%;border-bottom:1px solid #e5e7eb;">Expected Arrival</td>
                  <td style="padding:11px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">${p.timeWindow}</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:11px 16px;color:#6b7280;font-size:13px;width:42%;border-bottom:1px solid #e5e7eb;">Visiting</td>
                  <td style="padding:11px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">${p.hostName}</td>
                </tr>
                <tr style="background-color:#f9fafb;">
                  <td style="padding:11px 16px;color:#6b7280;font-size:13px;">Purpose</td>
                  <td style="padding:11px 16px;color:#111827;font-size:13px;font-weight:600;">${p.purpose}</td>
                </tr>
              </table>

              <!-- Office Info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#f0f4ff;border-radius:8px;padding:18px 20px;">
                    <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;">Getting Here</p>
                    <p style="margin:0 0 2px;font-size:14px;color:#111827;font-weight:700;">Your Company</p>
                    <p style="margin:0 0 12px;font-size:13px;color:#374151;line-height:1.7;">3rd Floor, Kantar Building<br>Westgate, Hanger Lane<br>London W5 1UA</p>
                    <p style="margin:0;font-size:13px;color:#374151;">&#128222; Reception: <a href="tel:+442087537100" style="color:#4f46e5;text-decoration:none;font-weight:600;">+44 208 753 7100</a></p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7;">
                If you need to reschedule or have any questions before your visit, please don't hesitate to reach out via phone or by replying to this email. We look forward to welcoming you!
              </p>

              <!-- Footer -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-top:20px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">Warm regards,</p>
                    <p style="margin:0 0 16px;color:#111827;font-size:13px;font-weight:600;">The Your Company Team</p>
                    <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.6;">
                      This is an automated booking confirmation from Your Company. &copy; Your Company
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ============================================================
// EXPENSE MODULE EMAILS
// ============================================================

const NEXUS_URL = 'https://your-staffportal-url.com'

function expenseEmailBase(title: string, content: string) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
          <img src="/logo.png" alt="StaffPortal" height="36" style="display:block;margin:0 auto 12px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${title}</h1>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
          ${content}
        </td></tr>
        <tr><td style="background:#1e293b;border-radius:0 0 16px 16px;padding:20px;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">StaffPortal &bull; Your Company &bull; Internal use only</p>
          <p style="margin:4px 0 0;color:#64748b;font-size:11px;">Designed and developed by Sarma Linux</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function expenseInfoRow(label: string, value: string, highlight = false) {
    return `<tr>
      <td style="padding:10px 14px;color:#64748b;font-size:13px;font-weight:600;background:#f8fafc;border-radius:6px 0 0 6px;width:40%;">${label}</td>
      <td style="padding:10px 14px;color:${highlight ? '#0f172a' : '#374151'};font-size:13px;font-weight:${highlight ? '700' : '400'};background:#f8fafc;border-radius:0 6px 6px 0;">${value}</td>
    </tr>`
}

interface ExpenseSubmittedParams {
    approverEmail: string; approverName: string; employeeName: string
    amount: string; description: string; merchant: string; date: string; expenseId: string
}

export async function sendExpenseSubmittedEmail(params: ExpenseSubmittedParams) {
    const subject = `Action Required: Expense Claim from ${params.employeeName}`
    const content = `
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi <strong>${params.approverName}</strong>,</p>
      <p style="margin:0 0 24px;color:#374151;font-size:14px;"><strong>${params.employeeName}</strong> has submitted an expense claim that requires your approval.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 4px;margin-bottom:24px;">
        ${expenseInfoRow('Amount', params.amount, true)}
        ${expenseInfoRow('Date', params.date)}
        ${expenseInfoRow('Description', params.description)}
        ${params.merchant ? expenseInfoRow('Merchant', params.merchant) : ''}
      </table>
      <div style="text-align:center;margin:28px 0;">
        <a href="${NEXUS_URL}/expenses?tab=approvals" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block;">Review &amp; Approve →</a>
      </div>
    `
    return sendEmail({ to: params.approverEmail, subject, html: expenseEmailBase(subject, content),
        text: `Hi ${params.approverName},\n${params.employeeName} submitted an expense:\nAmount: ${params.amount}\nDate: ${params.date}\nDescription: ${params.description}\nReview: ${NEXUS_URL}/expenses?tab=approvals` })
}

// ── Expense Claim PDF Generator ─────────────────────────────

const PAGE_W = 595.28
const PDF_MARGIN = 40
const PDF_W = PAGE_W - PDF_MARGIN * 2

function fmtPdfDate(s: string) {
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtPdfCurrency(amount: number, currency = 'GBP') {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}

export async function generateExpenseClaimPdf(expense: any): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    const emp = expense.user_profiles as any
    const empName = emp?.display_name || emp?.full_name || 'Employee'
    const approvals = (expense.expense_approvals as any[]) ?? []
    const latestApproval = approvals.find((a: any) => a.decision === 'approved')
    const approverName = latestApproval?.user_profiles?.display_name || latestApproval?.user_profiles?.full_name || '—'
    const approvedDate = latestApproval?.decided_at ? fmtPdfDate(latestApproval.decided_at) : fmtPdfDate(new Date().toISOString())
    const refCode = `EXP-${expense.id.slice(0, 8).toUpperCase()}`

    await new Promise<void>((resolve, reject) => {
        doc.on('end', resolve)
        doc.on('error', reject)

        let y = PDF_MARGIN

        doc.rect(0, 0, PAGE_W, 70).fill('#0f172a')
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('EXPENSE CLAIM FORM', 0, 22, { align: 'center' })
        doc.font('Helvetica').fontSize(9).fillColor('#94a3b8').text('StaffPortal · Your Company', 0, 43, { align: 'center' })
        y = 90

        doc.fillColor('#64748b').font('Helvetica').fontSize(8)
            .text(`Reference: ${refCode}`, PDF_MARGIN, y)
            .text(`Generated: ${fmtPdfDate(new Date().toISOString())}`, 0, y, { align: 'right', width: PAGE_W - PDF_MARGIN })
        y += 18

        doc.save()
        doc.rotate(-15, { origin: [PAGE_W - 120, y + 10] })
        doc.rect(PAGE_W - 160, y - 5, 110, 30).stroke('#16a34a')
        doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(14).text('APPROVED', PAGE_W - 155, y + 3, { width: 100, align: 'center' })
        doc.restore()
        y += 14

        const sectionHeader = (title: string) => {
            doc.rect(PDF_MARGIN, y, PDF_W, 20).fill('#f1f5f9')
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), PDF_MARGIN + 8, y + 6)
            y += 24
        }
        const row = (label: string, value: string, bold = false) => {
            doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text(label, PDF_MARGIN, y, { width: 140 })
            doc.fillColor('#0f172a').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).text(value || '—', PDF_MARGIN + 150, y, { width: PDF_W - 150 })
            y += 16
        }

        sectionHeader('Employee Details')
        row('Name', empName)
        row('Email', emp?.email || '—')
        row('Submission Date', expense.submitted_at ? fmtPdfDate(expense.submitted_at) : '—')
        y += 6

        sectionHeader('Expense Details')
        row('Description', expense.description, true)
        row('Date of Expense', fmtPdfDate(expense.date))
        row('Merchant / Supplier', expense.merchant || '—')
        row('Category', expense.expense_categories?.name || '—')
        row('Payment Method', expense.payment_method === 'personal_card' ? 'Personal Card' : 'Cash (Personal)')
        y += 6

        sectionHeader('Amount')
        row('Amount Claimed', fmtPdfCurrency(expense.amount, expense.currency), true)
        if (expense.currency !== 'GBP' && expense.converted_gbp) {
            row('GBP Equivalent', fmtPdfCurrency(expense.converted_gbp, 'GBP'))
            row('Exchange Rate', `1 ${expense.currency} = ${Number(expense.exchange_rate ?? 1).toFixed(4)} GBP`)
        }
        y += 6

        sectionHeader('Approval')
        row('Status', 'APPROVED — Reimbursement Required')
        row('Approved By', approverName)
        row('Approval Date', approvedDate)
        if (latestApproval?.note) row('Notes', latestApproval.note)
        y += 6

        if (expense.receipt_url) {
            sectionHeader('Receipt')
            doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text('Digital receipt attached in StaffPortal system.', PDF_MARGIN, y)
            doc.fillColor('#2563eb').font('Helvetica').fontSize(8).text(expense.receipt_url, PDF_MARGIN, y + 12, { width: PDF_W, link: expense.receipt_url, underline: true })
            y += 36
        }

        y = Math.max(y + 20, 640)
        doc.moveTo(PDF_MARGIN, y).lineTo(PAGE_W / 2 - 20, y).stroke('#cbd5e1')
        doc.moveTo(PAGE_W / 2 + 20, y).lineTo(PAGE_W - PDF_MARGIN, y).stroke('#cbd5e1')
        y += 6
        doc.fillColor('#64748b').font('Helvetica').fontSize(7.5)
            .text('Employee Signature', PDF_MARGIN, y, { width: PAGE_W / 2 - 30, align: 'center' })
            .text('Authorised Signature', PAGE_W / 2 + 20, y, { width: PAGE_W / 2 - 30, align: 'center' })

        doc.rect(0, 820, PAGE_W, 22).fill('#f8fafc')
        doc.fillColor('#94a3b8').font('Helvetica').fontSize(7)
            .text(`StaffPortal · ${refCode} · This document was generated automatically`, 0, 826, { align: 'center' })

        doc.end()
    })

    return Buffer.concat(chunks)
}

// ── Expense Email Functions ──────────────────────────────────

interface ExpenseApprovedParams {
    employeeEmail: string; employeeName: string; amount: string; description: string; expenseId: string
    receiptUrl?: string; isFinance?: boolean; submittedBy?: string; accountsName?: string
}

export async function sendExpenseApprovedEmail(params: ExpenseApprovedParams) {
    const claimUrl = `${NEXUS_URL}/api/expenses/claim-pdf/${params.expenseId}`
    if (params.isFinance) {
        const subject = `New Expense Claim to Reimburse — ${params.submittedBy}`
        const content = `
          <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi <strong>${params.accountsName ?? 'Accounts Team'}</strong>,</p>
          <p style="margin:0 0 24px;color:#374151;font-size:14px;">The following personal expense claim has been approved and requires reimbursement.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 4px;margin-bottom:24px;">
            ${expenseInfoRow('Employee', params.submittedBy ?? '')}
            ${expenseInfoRow('Amount to Reimburse', params.amount, true)}
            ${expenseInfoRow('Description', params.description)}
          </table>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 8px;color:#166534;font-size:13px;font-weight:600;">Download the claim form from StaffPortal to process this reimbursement.</p>
            <p style="margin:0;color:#374151;font-size:12px;">Log in → Expenses → Approvals tab → find this claim → Download Claim Form.</p>
          </div>
          <div style="text-align:center;margin-bottom:12px;">
            <a href="${claimUrl}" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block;">Download Claim Form PDF</a>
          </div>
          <div style="text-align:center;">
            <a href="${NEXUS_URL}/expenses?tab=monthly" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block;">View Monthly Sheet</a>
          </div>
        `
        return sendEmail({ to: params.employeeEmail, subject, html: expenseEmailBase(subject, content),
            text: `Hi ${params.accountsName ?? 'Accounts Team'},\nNew claim to reimburse from ${params.submittedBy}:\nAmount: ${params.amount}\nDescription: ${params.description}\nDownload claim form: ${claimUrl}\n${NEXUS_URL}/expenses?tab=monthly` })
    }
    const subject = `Your Expense Has Been Approved`
    const content = `
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi <strong>${params.employeeName}</strong>,</p>
      <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:#166534;font-size:15px;font-weight:700;">Your expense claim has been approved</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 4px;margin-bottom:24px;">
        ${expenseInfoRow('Amount', params.amount, true)}
        ${expenseInfoRow('Description', params.description)}
        ${expenseInfoRow('Status', 'Approved — Reimbursement will be processed by accounts')}
      </table>
      <p style="color:#374151;font-size:13px;margin-bottom:20px;">You can download your claim form from StaffPortal at any time — log in, go to Expenses and find this claim to download the PDF.</p>
      <div style="text-align:center;margin-bottom:12px;">
        <a href="${claimUrl}" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block;">Download Claim Form PDF</a>
      </div>
      <div style="text-align:center;">
        <a href="${NEXUS_URL}/expenses" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block;">View My Expenses</a>
      </div>
    `
    return sendEmail({ to: params.employeeEmail, subject, html: expenseEmailBase(subject, content),
        text: `Hi ${params.employeeName},\nYour expense claim has been approved.\nAmount: ${params.amount}\nReimbursement will be processed by accounts.\nDownload claim form: ${claimUrl}\n${NEXUS_URL}/expenses` })
}

interface ExpenseRejectedParams {
    employeeEmail: string; employeeName: string; amount: string; description: string; reason: string; expenseId: string
}

export async function sendExpenseRejectedEmail(params: ExpenseRejectedParams) {
    const subject = `Your Expense Could Not Be Approved`
    const content = `
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi <strong>${params.employeeName}</strong>,</p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:#b91c1c;font-size:15px;font-weight:700;">Your expense was not approved</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 4px;margin-bottom:24px;">
        ${expenseInfoRow('Amount', params.amount, true)}
        ${expenseInfoRow('Description', params.description)}
        ${expenseInfoRow('Reason', params.reason)}
      </table>
      <div style="text-align:center;">
        <a href="${NEXUS_URL}/expenses" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block;">View My Expenses</a>
      </div>
    `
    return sendEmail({ to: params.employeeEmail, subject, html: expenseEmailBase(subject, content),
        text: `Hi ${params.employeeName},\nYour expense was not approved.\nAmount: ${params.amount}\nReason: ${params.reason}\n${NEXUS_URL}/expenses` })
}

interface PurchaseRequestSubmittedParams {
    approverEmail: string; approverName: string; employeeName: string
    itemName: string; estimatedCost: string; urgency: string; justification: string; prId: string
}

export async function sendPurchaseRequestSubmittedEmail(params: PurchaseRequestSubmittedParams) {
    const urgencyColor = params.urgency === 'high' ? '#ef4444' : params.urgency === 'medium' ? '#f59e0b' : '#10b981'
    const subject = `Purchase Request: ${params.itemName} — Action Required`
    const content = `
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi <strong>${params.approverName}</strong>,</p>
      <p style="margin:0 0 24px;color:#374151;font-size:14px;"><strong>${params.employeeName}</strong> has submitted a purchase request that needs your review.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 4px;margin-bottom:24px;">
        ${expenseInfoRow('Item', params.itemName, true)}
        ${expenseInfoRow('Estimated Cost', params.estimatedCost, true)}
        ${expenseInfoRow('Urgency', `<span style="color:${urgencyColor};font-weight:700;text-transform:capitalize;">${params.urgency}</span>`)}
        ${params.justification ? expenseInfoRow('Justification', params.justification) : ''}
      </table>
      <div style="text-align:center;margin:28px 0;">
        <a href="${NEXUS_URL}/expenses?tab=approvals" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block;">Review Request</a>
      </div>
    `
    return sendEmail({ to: params.approverEmail, subject, html: expenseEmailBase(subject, content),
        text: `Hi ${params.approverName},\n${params.employeeName} submitted a purchase request:\nItem: ${params.itemName}\nCost: ${params.estimatedCost}\nUrgency: ${params.urgency}\n${NEXUS_URL}/expenses?tab=approvals` })
}

interface PurchaseRequestDecisionParams {
    employeeEmail: string; employeeName: string; itemName: string; decision: string; note: string; prId: string
}

export async function sendPurchaseRequestDecisionEmail(params: PurchaseRequestDecisionParams) {
    const approved = params.decision === 'approved'
    const subject = approved ? `Purchase Request Approved: ${params.itemName}` : `Purchase Request Not Approved: ${params.itemName}`
    const content = `
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi <strong>${params.employeeName}</strong>,</p>
      <div style="background:${approved ? '#f0fdf4' : '#fef2f2'};border-left:4px solid ${approved ? '#10b981' : '#ef4444'};border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0;color:${approved ? '#166534' : '#b91c1c'};font-size:15px;font-weight:700;">
          ${approved ? 'Your purchase request has been approved' : 'Your purchase request was not approved'}
        </p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 4px;margin-bottom:24px;">
        ${expenseInfoRow('Item', params.itemName, true)}
        ${params.note ? expenseInfoRow(approved ? 'Note' : 'Reason', params.note) : ''}
      </table>
      <div style="text-align:center;">
        <a href="${NEXUS_URL}/expenses?tab=purchase-requests" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block;">View My Requests</a>
      </div>
    `
    return sendEmail({ to: params.employeeEmail, subject, html: expenseEmailBase(subject, content),
        text: `Hi ${params.employeeName},\nYour purchase request "${params.itemName}" has been ${params.decision}.\n${params.note ? `Note: ${params.note}\n` : ''}${NEXUS_URL}/expenses?tab=purchase-requests` })
}

// ── Staff Announcement Email ─────────────────────────────────

const ANNOUNCE_FROM = 'notifications@sarmalinux.com'

export interface AnnouncementEvent {
    title: string
    date: string        // YYYY-MM-DD
    endDate?: string    // YYYY-MM-DD (for multi-day/OOO)
    time?: string       // HH:MM (24h)
    location?: string
    description?: string
}

export interface AnnouncementParams {
    subject: string
    body: string
    sentByName: string
    category?: string
    categoryEmoji?: string
    event?: AnnouncementEvent
}

function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function generateIcs(event: AnnouncementEvent, subject: string): Buffer {
    const now = new Date()
    const stamp = now.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'

    const [sy, sm, sd] = event.date.split('-').map(Number)
    let dtStart: string
    let dtEnd: string

    if (event.time) {
        const [h, m] = event.time.split(':').map(Number)
        const startDate = new Date(Date.UTC(sy, sm - 1, sd, h, m))
        const endDate = event.endDate
            ? new Date(new Date(event.endDate + 'T12:00:00').getTime() + 60 * 60 * 1000)
            : new Date(startDate.getTime() + 60 * 60 * 1000)
        dtStart = startDate.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
        dtEnd = endDate.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
    } else {
        dtStart = `${sy}${String(sm).padStart(2, '0')}${String(sd).padStart(2, '0')}`
        const endRaw = event.endDate ? event.endDate.split('-').map(Number) : null
        const endD = endRaw
            ? new Date(Date.UTC(endRaw[0], endRaw[1] - 1, endRaw[2] + 1))
            : new Date(Date.UTC(sy, sm - 1, sd + 1))
        dtEnd = `${endD.getUTCFullYear()}${String(endD.getUTCMonth() + 1).padStart(2, '0')}${String(endD.getUTCDate()).padStart(2, '0')}`
    }

    const uid = `${stamp}-${Math.random().toString(36).slice(2)}@your-staffportal-url.com`
    const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//StaffPortal//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        event.time ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
        event.time ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${event.title}`,
        event.location ? `LOCATION:${event.location}` : '',
        event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : `DESCRIPTION:${subject}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    return Buffer.from(ics, 'utf-8')
}

function announcementHtml(params: AnnouncementParams): string {
    const emoji = params.categoryEmoji ?? '📢'
    const category = params.category ?? 'General Notice'
    const bodyLines = params.body.split('\n').map(l => l.trim()).filter(Boolean)
    const bodyHtml = bodyLines.map(l => `<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.6;">${l}</p>`).join('')

    const dateDisplay = params.event
        ? params.event.endDate && params.event.endDate !== params.event.date
            ? `${fmtDate(params.event.date)} → ${fmtDate(params.event.endDate)}`
            : fmtDate(params.event.date)
        : ''

    const eventCard = params.event ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-radius:12px;overflow:hidden;border:2px solid #dbeafe;">
      <tr>
        <td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:14px 20px;vertical-align:middle;" width="52">
          <div style="font-size:28px;text-align:center;">📅</div>
        </td>
        <td style="background:#eff6ff;padding:14px 20px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.05em;">Calendar Event</p>
          <p style="margin:0 0 8px;font-size:17px;font-weight:800;color:#1e3a8a;">${params.event.title}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#1e40af;font-weight:700;">📆 ${dateDisplay}</p>
          ${params.event.time ? `<p style="margin:0 0 4px;font-size:13px;color:#1e40af;font-weight:700;">⏰ ${params.event.time}</p>` : ''}
          ${params.event.location ? `<p style="margin:0 0 4px;font-size:13px;color:#1e40af;font-weight:700;">📍 ${params.event.location}</p>` : ''}
          ${params.event.description ? `<p style="margin:8px 0 0;font-size:13px;color:#374151;">${params.event.description}</p>` : ''}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="background:#dbeafe;padding:10px 20px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#1e40af;font-weight:600;">📎 A calendar invite is attached — open the attachment to add this event to Outlook, Google Calendar or Apple Calendar</p>
        </td>
      </tr>
    </table>` : ''

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#111827 0%,#1f2937 100%);border-radius:16px 16px 0 0;padding:28px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">StaffPortal</p>
              <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;">Staff Announcement</p>
            </td>
            <td align="right" style="vertical-align:top;">
              <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:8px 14px;display:inline-block;margin-bottom:6px;">
                <p style="margin:0;font-size:11px;color:#9ca3af;">From</p>
                <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;">${params.sentByName}</p>
              </div>
              <br>
              <div style="background:rgba(255,255,255,0.06);border-radius:20px;padding:4px 12px;display:inline-block;">
                <p style="margin:0;font-size:12px;color:#e5e7eb;">${emoji} ${category}</p>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Subject bar -->
      <tr><td style="background:#1e40af;padding:14px 32px;">
        <p style="margin:0;font-size:16px;font-weight:800;color:#ffffff;">${params.subject}</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:32px;">
        ${bodyHtml}
        ${eventCard}
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 16px 16px;padding:20px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0;font-size:12px;color:#6b7280;">Sent via <strong style="color:#374151;">StaffPortal</strong> by ${params.sentByName}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">This is an internal staff announcement from Your Company.</p>
            </td>
            <td align="right">
              <a href="${NEXUS_URL}" style="font-size:11px;color:#6b7280;text-decoration:none;">your-staffportal-url.com</a>
            </td>
          </tr>
        </table>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}

export async function sendStaffAnnouncement(params: AnnouncementParams): Promise<{ success: boolean; error?: string }> {
    if (!resend) return { success: true }

    const attachments: { filename: string; content: Buffer }[] = []
    if (params.event) {
        attachments.push({
            filename: 'event-invite.ics',
            content: generateIcs(params.event, params.subject),
        })
    }

    try {
        const { error } = await resend.emails.send({
            from: `StaffPortal <${ANNOUNCE_FROM}>`,
            to: [process.env.WFH_NOTIFY_EMAIL ?? 'admin@yourcompany.com'],
            subject: params.subject,
            html: announcementHtml(params),
            text: `${params.categoryEmoji ?? '📢'} ${params.category ?? 'Announcement'} from ${params.sentByName}\n\n${params.subject}\n\n${params.body}${params.event ? `\n\nEvent: ${params.event.title}\nDate: ${params.event.date}${params.event.endDate ? ' to ' + params.event.endDate : ''}${params.event.time ? ' at ' + params.event.time : ''}${params.event.location ? '\nLocation: ' + params.event.location : ''}` : ''}`,
            attachments: attachments.length > 0 ? attachments : undefined,
        })
        if (error) {
            console.error('[Announcement] Resend error:', error)
            return { success: false, error: error.message }
        }
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Announcement] Error:', message)
        return { success: false, error: message }
    }
}
