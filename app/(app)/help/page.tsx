"use client"

import { useState } from "react"
import {
    Clock, CalendarDays, FileEdit, FileSpreadsheet, BookOpen, MessageSquare,
    AlertTriangle, Users, UserPlus, Bell, Settings,
    CheckCircle, Coffee, Home, ClipboardList, Search, Package2, TableProperties,
    Monitor, ShieldCheck, Receipt, CreditCard, Banknote, Camera, ShoppingCart,
    BarChart3, Mail, CheckCircle2, Megaphone, MapPin, Pin, StickyNote,
    Ticket, Heart, Wind, Dumbbell, Bot,
} from "lucide-react"

interface Section {
    id: string
    icon: React.ElementType
    color: string
    bg: string
    title: string
    subtitle: string
    content: React.ReactNode
}

function Step({ n, text }: { n: number; text: string }) {
    return (
        <div className="flex gap-3 items-start">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">{n}</span>
            <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
        </div>
    )
}

function Note({ text }: { text: string }) {
    return (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">💡 {text}</p>
        </div>
    )
}

function SubHeading({ text }: { text: string }) {
    return <p className="text-sm font-semibold text-foreground mt-4 mb-2">{text}</p>
}

function Formula({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {children}
        </div>
    )
}

function InfoTable({ rows }: { rows: [string, string][] }) {
    return (
        <div className="rounded-xl border border-border overflow-hidden text-xs">
            {rows.map(([col, desc], i) => (
                <div key={i} className={`grid grid-cols-[160px_1fr] divide-x divide-border ${i % 2 === 0 ? "bg-muted/20" : "bg-background"}`}>
                    <div className="px-3 py-2 font-semibold text-foreground">{col}</div>
                    <div className="px-3 py-2 text-muted-foreground leading-snug">{desc}</div>
                </div>
            ))}
        </div>
    )
}

const sections: Section[] = [
    {
        id: "attendance",
        icon: Clock,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-950/40",
        title: "Attendance",
        subtitle: "Clock in, clock out, breaks, WFH, early leave, and running late",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Attendance page is where you record your working day. Every action you take here — clocking in, taking a break, logging WFH — is saved in real time and feeds directly into your timesheet and the office live view.
                </p>

                <SubHeading text="Clocking In" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Attendance from the sidebar." />
                    <Step n={2} text='Tap "Clock In" — the exact time is recorded automatically to the second.' />
                    <Step n={3} text="Your status immediately updates to Clocked In and you appear as present in the live attendance view." />
                </div>

                <SubHeading text="Taking a Break" />
                <div className="space-y-2">
                    <Step n={1} text='Once clocked in, tap "Start Break" when you step away.' />
                    <Step n={2} text='Tap "End Break" when you return.' />
                    <Step n={3} text="The break duration is automatically deducted from your total hours worked that day. If you forget to end your break, your total hours will be calculated without it — submit a correction if needed." />
                </div>

                <SubHeading text="Clocking Out" />
                <div className="space-y-2">
                    <Step n={1} text='Tap "Clock Out" at the end of your shift.' />
                    <Step n={2} text="Your total hours for the day are calculated (time worked minus any break) and saved to your timesheet." />
                    <Step n={3} text="Your status updates to Completed." />
                </div>
                <Note text="If you forget to clock out, you will receive an automated email reminder at 7pm. You can then submit a correction request to fix your record — see the Corrections section below." />

                <SubHeading text="Early Leave" />
                <div className="space-y-2">
                    <Step n={1} text='If you need to leave before your normal end time, use "Early Leave" rather than the standard Clock Out button.' />
                    <Step n={2} text="Enter a reason — this is automatically sent to the office so they are aware you have left." />
                    <Step n={3} text="Your clock-out time and total hours are recorded as normal." />
                </div>

                <SubHeading text="Running Late" />
                <div className="space-y-2">
                    <Step n={1} text={'Tap "Running Late" on the Dashboard quick actions (or the Attendance page).'} />
                    <Step n={2} text='Choose "Today" or "Tomorrow" — you can pre-log for the next day the evening before.' />
                    <Step n={3} text="Enter your expected arrival time and an optional reason." />
                    <Step n={4} text="The office is notified immediately by email. When you arrive, clock in as normal." />
                </div>
                <Note text="Running late entries are visible across the system. They appear as orange events on the Team Calendar so everyone can see. If you pre-logged for tomorrow, an amber banner also appears on your Dashboard. Reception can see a Running Late filter tab showing who has pre-logged for today." />

                <SubHeading text="Live Time in Office" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    While you are clocked in, a live counter shows exactly how long you have been in the office. It updates every second and automatically deducts any break time. You can see it on both the Attendance page (in the Current Status card) and on the Dashboard (in the stat strip at the top).
                </p>

                <SubHeading text="Working From Home (WFH)" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If you are working from home, log it on the Attendance page so your attendance is recorded correctly and the office is notified automatically.
                </p>
                <div className="space-y-2">
                    <Step n={1} text='Tap "Log WFH Day" on the Attendance page.' />
                    <Step n={2} text="Choose the type — Full Day, Morning Only (Half AM), or Afternoon Only (Half PM)." />
                    <Step n={3} text="Optionally add a note. Tap Confirm WFH." />
                    <Step n={4} text="Your attendance is recorded automatically — no separate clock-in is needed for a full WFH day." />
                </div>

                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-4 space-y-2 mt-2">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">How WFH Affects Clock-In</p>
                    <div className="space-y-1.5 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        <p><span className="font-semibold">Full Day WFH</span> — Clock-in is blocked all day. Your attendance is already recorded.</p>
                        <p><span className="font-semibold">Morning Only (Half AM)</span> — Clock-in is blocked before 12:00. After midday the Clock In button appears normally so you can clock in for your afternoon in the office.</p>
                        <p><span className="font-semibold">Afternoon Only (Half PM)</span> — Clock in as normal in the morning. After 12:00, the Clock In button is hidden since you are working from home in the afternoon.</p>
                    </div>
                </div>
            </div>
        ),
    },
    {
        id: "kiosk",
        icon: Monitor,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-950/40",
        title: "Office Kiosk",
        subtitle: "Clock in and out at the shared office terminal using your PIN",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The kiosk is a shared screen at the office entrance. Instead of opening the app on your phone, you tap your name on the kiosk and enter your PIN to clock in or out. It is designed to be quick, simple, and touch-friendly.
                </p>

                <SubHeading text="Setting Up Your Kiosk PIN" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Settings from the sidebar." />
                    <Step n={2} text="Find the Kiosk PIN section and enter a 4-digit PIN of your choice." />
                    <Step n={3} text="Save. You can now use this PIN at the kiosk." />
                </div>
                <Note text="Keep your PIN private. Anyone who knows it can clock in or out as you at the kiosk." />

                <SubHeading text="Clocking In at the Kiosk" />
                <div className="space-y-2">
                    <Step n={1} text="On the kiosk home screen you will see a grid of all staff. Find your name and tap it." />
                    <Step n={2} text="A PIN keypad appears. Enter your 4-digit PIN." />
                    <Step n={3} text="If correct, your clock-in is recorded immediately and the screen shows a success confirmation for 5 seconds before returning to home." />
                </div>

                <SubHeading text="Clocking Out at the Kiosk" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The process is identical to clocking in. If you are already clocked in, entering your PIN will clock you out instead. The kiosk always checks your current status first.
                </p>

                <SubHeading text="Staff Status on the Kiosk" />
                <div className="space-y-1.5 text-sm text-muted-foreground">
                    <p><span className="font-semibold text-emerald-600 dark:text-emerald-400">● IN (green)</span> — Currently clocked in and in the office.</p>
                    <p><span className="font-semibold text-blue-600 dark:text-blue-400">⌂ WFH (blue)</span> — Working from home today.</p>
                    <p><span className="font-semibold text-muted-foreground">○ OUT (grey)</span> — Not yet clocked in today.</p>
                </div>

                <SubHeading text="WFH and the Kiosk" />
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 space-y-1.5">
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed"><span className="font-semibold">Full day WFH</span> — Tapping your name and entering your PIN will show a message: &quot;You are working from home today — no clock-in required.&quot;</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed"><span className="font-semibold">Half AM WFH</span> — Clock-in is blocked before noon. After 12:00, you can clock in normally for your afternoon.</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed"><span className="font-semibold">Half PM WFH</span> — Clock in as normal in the morning. After 12:00 the kiosk blocks clock-in since you are working from home in the afternoon.</p>
                </div>

                <SubHeading text="Visitor Check-In at the Kiosk" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The kiosk also handles visitor registration. See the Visitors section below for full details.
                </p>
            </div>
        ),
    },
    {
        id: "leave",
        icon: CalendarDays,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        title: "Leave",
        subtitle: "Request holidays, sick days, and other leave — how balances and carry forward work",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Leave page is where you submit requests, track your balances, and see the status of past requests. Balances update in real time, pending days are reserved the moment you submit, and carry forward runs automatically every 1st January.
                </p>

                <SubHeading text="Requesting Leave" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Leave from the sidebar." />
                    <Step n={2} text="Tap New Request and choose the leave type — Annual, Sick, Maternity, Unpaid, or Other." />
                    <Step n={3} text="Pick your start and end dates. The system calculates the exact number of days based on your personal work schedule and UK bank holidays." />
                    <Step n={4} text="Add an optional reason — this is sent to your approver." />
                    <Step n={5} text="Tap Submit. Your request goes to your designated approver immediately." />
                </div>
                <Note text="You must set a leave approver in Settings before you can submit. If no approver is set the submit button will not work." />

                <SubHeading text="How Days Are Calculated" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The system does not simply count calendar days. It runs through every individual date in your selected range and applies three filters before counting a day against your balance.
                </p>
                <InfoTable rows={[
                    ["Filter 1 — Schedule", "Each date is checked against your personal contracted work schedule. Days where your contracted hours = 0 are skipped entirely and not charged."],
                    ["Filter 2 — Bank Holidays", "UK bank holidays for England and Wales are fetched live from the official UK Government website (gov.uk) every 24 hours. Any date on that list is skipped automatically, even if it falls on one of your working days."],
                    ["Filter 3 — Half Days", "If you select a half day (AM or PM) the system returns 0.5 immediately without running the loop. Half days are always 0.5 regardless of contracted hours."],
                ]} />
                <Formula>{`days_charged = count of dates where:
  contracted_hours[day] > 0
  AND date is not a UK bank holiday
  AND day_type = 'full'

OR = 0.5 if day_type = 'half_am' or 'half_pm'`}</Formula>
                <div className="space-y-2 mt-1">
                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-1 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">Example 1 — 4 day week (Mon–Thu)</p>
                        <p>Request: Mon 17 Aug – Fri 21 Aug</p>
                        <p>Mon ✓ Tue ✓ Wed ✓ Thu ✓ Fri ✗ (not contracted)</p>
                        <p className="font-medium text-foreground">Result: 4 days charged, not 5.</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-1 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">Example 2 — Bank holiday in range</p>
                        <p>Request: Mon 25 Aug – Fri 29 Aug. Mon 25 Aug is a bank holiday.</p>
                        <p>Mon ✗ (bank holiday) Tue ✓ Wed ✓ Thu ✓ Fri ✓</p>
                        <p className="font-medium text-foreground">Result: 4 days charged.</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-1 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">Example 3 — 3 day week (Mon, Wed, Fri) with bank holiday</p>
                        <p>Request: Mon 25 Aug – Fri 29 Aug. Mon is a bank holiday.</p>
                        <p>Mon ✗ (bank holiday) Tue ✗ (not contracted) Wed ✓ Thu ✗ (not contracted) Fri ✓</p>
                        <p className="font-medium text-foreground">Result: 2 days charged.</p>
                    </div>
                </div>

                <SubHeading text="How Your Balance Updates" />
                <p className="text-sm text-muted-foreground leading-relaxed">Your leave balance has four fields. Your available days at any point is always:</p>
                <Formula>{`available = total + carried_forward − used − pending`}</Formula>
                <InfoTable rows={[
                    ["Submit →", "pending += days_count  |  available decreases immediately. The system blocks submission if days_count > available."],
                    ["Approve →", "used += days_count  |  pending -= days_count  |  available stays the same (already reduced at submission)."],
                    ["Reject →", "pending -= days_count  |  available increases back. Used is unchanged."],
                    ["Withdraw (pending) →", "pending -= days_count  |  available restored."],
                    ["Withdraw (approved) →", "used -= days_count  |  available restored."],
                ]} />
                <Note text="The days_count stored at submission is fixed and never recalculated. All balance changes use that exact stored number so nothing can drift." />

                <SubHeading text="Carry Forward — Automatic Every 1st January" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Carry forward runs automatically on 1st January every year. No action is required from you, your manager, or the Director — the system processes every employee overnight.
                </p>
                <Formula>{`last_year_remaining = last_year_total − last_year_used − last_year_pending
carry_amount       = min(last_year_remaining, max_carry_forward)
new_year_available = new_year_total + carry_amount`}</Formula>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">max_carry_forward</span> is set per employee by the Director. The system default is 5 days unless your Director has configured a different limit for you. Any unused days above your limit are permanently lost at year end — they do not accumulate and cannot be reclaimed.
                </p>
                <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-1 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">Example:</p>
                    <p>last_year_total = 25 days</p>
                    <p>last_year_used = 18 days</p>
                    <p>last_year_pending = 0 days</p>
                    <p>last_year_remaining = 25 − 18 − 0 = <span className="font-semibold text-foreground">7 days</span></p>
                    <p>max_carry_forward = 5 days</p>
                    <p>carry_amount = min(7, 5) = <span className="font-semibold text-foreground">5 days</span> ← 2 days are lost</p>
                    <p>new_year_available = 25 + 5 = <span className="font-semibold text-foreground">30 days</span></p>
                </div>
                <Note text="If you are close to or above your carry forward limit as year end approaches, use your remaining leave before 31st December or the excess will be lost on 1st January." />

                <SubHeading text="Withdrawing a Request" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    You can withdraw any pending or approved leave request directly from the Leave page — just find the request and click Withdraw. Your days are returned to your balance immediately regardless of whether the request was pending or approved.
                </p>
                <InfoTable rows={[
                    ["Withdraw (pending) →", "pending -= days_count. Days back in your available balance instantly."],
                    ["Withdraw (approved) →", "used -= days_count. Days back in your available balance instantly."],
                ]} />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Your withdrawn requests are kept on record and visible under the <span className="font-semibold text-foreground">Withdrawn</span> tab on your Leave page — they are never deleted. Your approver and the accounts team are automatically notified by email when you withdraw leave.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    You can download a withdrawal record PDF from your Leave page for any withdrawn request. The PDF shows the leave details, your updated balance, and is marked <span className="font-semibold text-foreground">WITHDRAWN</span> — it is for audit reference only and is not an approved leave form.
                </p>
            </div>
        ),
    },
    {
        id: "corrections",
        icon: FileEdit,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-50 dark:bg-violet-950/40",
        title: "Corrections",
        subtitle: "Fix a wrong clock-in or clock-out time on your timesheet",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If your attendance record for any day is wrong — for example you forgot to clock out, the kiosk recorded the wrong time, or you clocked in late by mistake — you submit a correction request and it will be reviewed and fixed.
                </p>

                <SubHeading text="When do you need a correction?" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                        ["Forgot to clock out", "You clocked in but never tapped Clock Out. The record shows no end time."],
                        ["Wrong clock-in time", "The kiosk or app recorded a time that doesn't match when you actually arrived."],
                        ["Missing record", "You were in the office but no attendance record exists for that day."],
                        ["Break not ended", "You started a break but never tapped End Break, so hours look wrong."],
                    ].map(([title, desc]) => (
                        <div key={title} className="rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                            <p className="text-xs font-semibold text-foreground">{title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                        </div>
                    ))}
                </div>

                <SubHeading text="Submitting a Correction" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Corrections from the sidebar." />
                    <Step n={2} text="Tap New Correction and select the date you want to fix." />
                    <Step n={3} text="Choose what you are correcting — Clock In time or Clock Out time." />
                    <Step n={4} text="Enter the correct time." />
                    <Step n={5} text="Write a brief reason explaining what happened." />
                    <Step n={6} text="Submit — reception is notified immediately." />
                </div>

                <SubHeading text="What happens after you submit" />
                <div className="space-y-2">
                    <Step n={1} text="Your correction is reviewed by the office." />
                    <Step n={2} text="If approved — your timesheet is updated automatically with the corrected time and your total hours are recalculated." />
                    <Step n={3} text="If rejected — you receive an email with the reason." />
                </div>
                <Note text="You can track all your correction requests on the Corrections page. Each one shows its current status — Submitted, Applied, or Rejected." />
            </div>
        ),
    },
    {
        id: "timesheets",
        icon: FileSpreadsheet,
        color: "text-sky-600 dark:text-sky-400",
        bg: "bg-sky-50 dark:bg-sky-950/40",
        title: "Timesheets",
        subtitle: "View your complete attendance history, hours, and status",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Timesheets page shows your full attendance history — every day you have clocked in, with clock-in time, clock-out time, breaks, total hours worked, and status. You can browse by week or month.
                </p>

                <SubHeading text="Filtering by date" />
                <div className="space-y-2">
                    <Step n={1} text='Use the "This Month" or "Last Month" shortcuts for quick access.' />
                    <Step n={2} text="Or set a custom From and To date for any period you need, then tap Apply." />
                </div>

                <SubHeading text="What each column means" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                        ["Date", "The working day the record belongs to."],
                        ["Clock In", "The exact time you clocked in that day."],
                        ["Clock Out", "The exact time you clocked out. Blank if you forgot to clock out."],
                        ["Break", "Start and end of your break, if recorded."],
                        ["Total Hours", "Hours worked after deducting break time. Calculated automatically on clock-out."],
                        ["Status", "Present, WFH, Absent, or other flags like Early Leave or Running Late."],
                    ].map(([col, desc]) => (
                        <div key={col} className="rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                            <p className="text-xs font-semibold text-foreground">{col}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                        </div>
                    ))}
                </div>

                <Note text="Timesheets are read-only. If a record looks wrong, submit a Correction request to get it fixed." />
            </div>
        ),
    },
    {
        id: "staff-summary",
        icon: TableProperties,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-50 dark:bg-violet-950/40",
        title: "Staff Summary",
        subtitle: "Days worked and leave taken — used for payroll and reporting",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Visible to <span className="font-semibold text-foreground">Director</span> and <span className="font-semibold text-foreground">Accounts</span> only. Shows a per-employee breakdown for any selected date range — days worked in office, WFH days, approved leave days, and contracted days. Designed for payroll processing and internal reporting. No clock-in times are shown, only day counts.
                </p>

                <SubHeading text="What Each Column Shows" />
                <InfoTable rows={[
                    ["Contracted Days", "Count of dates in the selected range that fall on each employee's scheduled working days. Excludes weekends and UK bank holidays. Based on each person's individual work schedule — not a blanket Mon–Fri count."],
                    ["Days Worked (Office)", "Count of attendance records with status = present in the date range. Each record = 1 day worked."],
                    ["Days WFH", "Count of WFH records in the date range. Full day WFH = 1. Half day WFH = 0.5."],
                    ["Days on Leave", "Total approved leave days within the date range, split by type: Annual, Sick, Maternity, Unpaid."],
                    ["Attendance Rate", "(Days Worked + Days WFH) ÷ (Contracted Days − Leave Days) × 100"],
                ]} />

                <SubHeading text="How Days Worked Are Counted" />
                <InfoTable rows={[
                    ["Full day in office (clocked in)", "= 1 day worked"],
                    ["Full day WFH", "= 1 day worked"],
                    ["Half day WFH + half day in office", "= 1 day worked"],
                    ["Half day WFH only (no office record)", "= 0.5 days worked"],
                    ["Full day approved leave", "= 0 days worked + 1 day leave"],
                ]} />

                <SubHeading text="Bank Holidays" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    UK bank holidays for England and Wales are fetched live from the official UK Government website (gov.uk) and refreshed every 24 hours. They are automatically excluded from each employee's contracted days count. Any bank holidays falling in your selected period are shown in an amber notice at the top of the page.
                </p>

                <SubHeading text="Data Sources" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The numbers are joined from three places — attendance clock records, approved leave records, and each employee's contracted work schedule. It is not a live or predictive view. It only reflects data that has already been recorded in the system.
                </p>

                <SubHeading text="Exporting" />
                <div className="space-y-2">
                    <Step n={1} text='Tap Export Excel to download a spreadsheet covering all employees for the selected period.' />
                    <Step n={2} text="The file includes: Employee name, Contracted Days, Days Worked, Days WFH, Days on Leave broken down by type." />
                </div>
            </div>
        ),
    },
    {
        id: "diary",
        icon: BookOpen,
        color: "text-orange-600 dark:text-orange-400",
        bg: "bg-orange-50 dark:bg-orange-950/40",
        title: "Diary",
        subtitle: "Your personal daily work notes — private to you",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Diary is your personal daily work log. Write a note about what you worked on, who you spoke to, or anything else you want to remember. It is completely private — only you can see it.
                </p>

                <SubHeading text="Adding a Diary Entry" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Diary from the sidebar." />
                    <Step n={2} text="Today's date is selected by default. Tap any date on the mini-calendar to write a note for a different day." />
                    <Step n={3} text="Type your notes in the text area." />
                    <Step n={4} text="Tap Save. Your note is stored privately against that date." />
                </div>

                <SubHeading text="Browsing Past Entries" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Dates that have a diary entry are highlighted on the calendar. Tap any highlighted date to view or edit that entry.
                </p>

                <Note text="You may receive an optional email reminder to fill in your diary if you have not written an entry for the day. This is just a nudge and is not mandatory." />
            </div>
        ),
    },
    {
        id: "calendar",
        icon: CalendarDays,
        color: "text-teal-600 dark:text-teal-400",
        bg: "bg-teal-50 dark:bg-teal-950/40",
        title: "Team Calendar",
        subtitle: "See who is in, on leave, WFH, or has events on any given day",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Team Calendar gives you a full picture of the office — who is in, who is on leave, who is working from home, and any company events or appointments. Everything from attendance, leave, and WFH feeds into this calendar automatically.
                </p>

                <SubHeading text="What you can see" />
                <div className="space-y-1.5 text-sm text-muted-foreground">
                    <p>• <span className="font-semibold text-emerald-600 dark:text-emerald-400">Green</span> — colleague is in the office (clocked in)</p>
                    <p>• <span className="font-semibold text-blue-600 dark:text-blue-400">Blue</span> — colleague is working from home</p>
                    <p>• <span className="font-semibold text-amber-600 dark:text-amber-400">Amber</span> — colleague is on approved leave</p>
                    <p>• <span className="font-semibold text-orange-600 dark:text-orange-400">Orange</span> — colleague has logged running late (including pre-logged for a future date)</p>
                    <p>• <span className="font-semibold text-purple-600 dark:text-purple-400">Events</span> — company meetings, appointments, or custom events</p>
                </div>

                <SubHeading text="How it stays up to date" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    You do not need to manually update the calendar. When someone logs WFH, their blue entry appears automatically. When leave is approved, the amber block appears for those dates. The calendar always reflects the current state of the system.
                </p>

                <SubHeading text="Adding an Event" />
                <div className="space-y-2">
                    <Step n={1} text="Click any date on the calendar." />
                    <Step n={2} text="Fill in the event title, optional time, and any notes." />
                    <Step n={3} text="Save — the event appears on the shared calendar visible to everyone." />
                </div>
                <Note text="Events are shared company-wide. Use them for meetings, office closures, visits, or anything the whole team should know about." />
            </div>
        ),
    },
    {
        id: "approvals",
        icon: ClipboardList,
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-50 dark:bg-indigo-950/40",
        title: "Approvals",
        subtitle: "Review and action leave requests assigned to you",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If a colleague has set you as their leave approver, their requests will appear here. You will also receive an email notification each time a new request comes in so you never miss one.
                </p>

                <SubHeading text="Reviewing a Request" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Each request shows the employee name, leave type, dates requested, number of working days, their remaining balance, and the reason they provided (if any). You have full context before making a decision.
                </p>

                <SubHeading text="Approving a Request" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Approvals from the sidebar." />
                    <Step n={2} text="Review the request details." />
                    <Step n={3} text='Tap "Approve". The employee is notified by email immediately. Their Used balance increases and Pending balance clears automatically.' />
                </div>

                <SubHeading text="Declining a Request" />
                <div className="space-y-2">
                    <Step n={1} text='Tap "Reject" on the request.' />
                    <Step n={2} text="Enter a reason — the employee will see this in their notification email." />
                    <Step n={3} text='Tap "Confirm Rejection". Their pending days are immediately released back to their Remaining balance.' />
                </div>

                <SubHeading text="Notification bell" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The bell icon in the top navigation shows a red badge with the number of requests waiting for your review. This updates in real time so you always know if something needs your attention.
                </p>

                <Note text="You only see requests where you are the designated approver. Employees set their own approver in Settings." />
            </div>
        ),
    },
    {
        id: "directory",
        icon: Users,
        color: "text-pink-600 dark:text-pink-400",
        bg: "bg-pink-50 dark:bg-pink-950/40",
        title: "Directory",
        subtitle: "Staff profiles and external contacts in one place",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Directory is your internal phonebook. It has two tabs — Staff (everyone at Your Companys) and External (suppliers, clients, and other outside contacts).
                </p>

                <SubHeading text="Staff Directory" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Directory from the sidebar." />
                    <Step n={2} text="You will see cards for every active team member — name, job title, department, phone number, email, and desk extension." />
                    <Step n={3} text="Use the search bar at the top to filter by name, department, or job title." />
                    <Step n={4} text="Tap a card to see the full profile." />
                </div>

                <SubHeading text="Keeping Your Profile Up to Date" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Your own profile in the directory is populated from whatever you have saved in Settings. Keep your profile complete — job title, phone, department — so your colleagues can find your details easily.
                </p>

                <SubHeading text="External Contacts" />
                <div className="space-y-2">
                    <Step n={1} text='Switch to the "External" tab at the top of the Directory.' />
                    <Step n={2} text="These are suppliers, clients, agents, and other external contacts saved by the team." />
                    <Step n={3} text="You can add new external contacts and edit existing ones." />
                </div>
            </div>
        ),
    },
    {
        id: "visitors",
        icon: UserPlus,
        color: "text-cyan-600 dark:text-cyan-400",
        bg: "bg-cyan-50 dark:bg-cyan-950/40",
        title: "Visitors",
        subtitle: "Pre-register visitors, view the log, and manage the kiosk check-in flow",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Visitors section covers everything to do with people coming into the office — pre-registering expected visitors, the visitor log, and how visitors check in and out at the kiosk.
                </p>

                <SubHeading text="Pre-Registering a Visitor" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Visitors from the sidebar." />
                    <Step n={2} text='Tap "New Visitor" and fill in their name, company, phone number, and expected arrival time.' />
                    <Step n={3} text="Select who they are visiting." />
                    <Step n={4} text="Save — reception is notified by email so they know to expect the visitor." />
                </div>

                <SubHeading text="Visitor Check-In at the Kiosk (Walk-In)" />
                <div className="space-y-2">
                    <Step n={1} text='On the kiosk, tap "Visitors" then "Check In".' />
                    <Step n={2} text="The visitor fills in their name, phone number, company (optional), and selects who they are visiting." />
                    <Step n={3} text="They tick the health and safety consent box and tap Finish Registration." />
                    <Step n={4} text="Their check-in is recorded with a timestamp and their host is notified." />
                </div>

                <SubHeading text="Pre-Registered Visitor Check-In" />
                <div className="space-y-2">
                    <Step n={1} text='Tap "I Have a Booking" on the kiosk visitors screen.' />
                    <Step n={2} text="Enter their name — the system searches for their pre-registration." />
                    <Step n={3} text="Confirm the booking and check in — their arrival is recorded against the pre-registration." />
                </div>

                <SubHeading text="Visitor Check-Out" />
                <div className="space-y-2">
                    <Step n={1} text='On the kiosk, tap "Visitors" then "Check Out".' />
                    <Step n={2} text="The screen shows all visitors currently signed in. Tap the visitor's name to sign them out." />
                    <Step n={3} text="Their check-out time is recorded. The visit is complete." />
                </div>

                <SubHeading text="Visitor Log" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Visitors page in the app shows a complete log of all past and current visitors — check-in time, check-out time, who hosted them, and their company.
                </p>
            </div>
        ),
    },
    {
        id: "feedback",
        icon: MessageSquare,
        color: "text-lime-600 dark:text-lime-400",
        bg: "bg-lime-50 dark:bg-lime-950/40",
        title: "Feedback",
        subtitle: "Share ideas, suggestions, and positive feedback — anonymously if you prefer",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Feedback section is your space to share ideas, suggestions, or positive comments about the workplace or the app. All feedback is read and taken seriously.
                </p>

                <SubHeading text="Submitting Feedback" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Feedback from the sidebar." />
                    <Step n={2} text="Choose a category — Idea, Suggestion, Compliment, or General." />
                    <Step n={3} text="Write your feedback in as much or as little detail as you like." />
                    <Step n={4} text="Choose whether to submit with your name or anonymously." />
                    <Step n={5} text="Tap Submit." />
                </div>

                <Note text="Anonymous feedback is fully anonymous — your name is never stored or attached to the submission in any way." />

                <SubHeading text="What happens to your feedback" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Feedback is reviewed by the relevant team. If you submitted with your name, you may receive a follow-up. Suggestions and ideas that are acted on will be reflected in future updates to the app or the workplace.
                </p>
            </div>
        ),
    },
    {
        id: "complaints",
        icon: AlertTriangle,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-950/40",
        title: "Complaints",
        subtitle: "Raise a formal or informal workplace concern confidentially",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If you have a concern — about your working conditions, a colleague&apos;s behaviour, safety, or anything else — you can raise it here. All complaints are handled confidentially and taken seriously regardless of severity.
                </p>

                <SubHeading text="Raising a Complaint" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Complaints from the sidebar." />
                    <Step n={2} text="Select the severity — Low, Medium, or High." />
                    <Step n={3} text="Choose a category that best describes your concern." />
                    <Step n={4} text="Describe the issue clearly and in as much detail as you feel comfortable sharing." />
                    <Step n={5} text="Choose whether to submit with your name or anonymously." />
                    <Step n={6} text="Submit — your complaint is logged and reviewed." />
                </div>

                <Note text="Anonymous complaints are still reviewed and acted on. Your name will never be attached to an anonymous submission." />

                <SubHeading text="Tracking your complaint" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    You can view the status of your submitted complaints on the Complaints page — Open, In Progress, or Resolved. If you submitted with your name, you will be updated by email when there is progress on your complaint.
                </p>
            </div>
        ),
    },
    {
        id: "notifications",
        icon: Bell,
        color: "text-yellow-600 dark:text-yellow-500",
        bg: "bg-yellow-50 dark:bg-yellow-950/40",
        title: "Email Notifications",
        subtitle: "Every email StaffPortal sends — what triggers it and what it contains",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    StaffPortal sends automated emails to keep you and the office informed. Here is the complete list of every email you might receive, and exactly when it is sent.
                </p>

                {[
                    ["Leave submitted", "Sent to you when you submit a leave request. Confirms the request was received, shows the dates, number of days, and your updated pending balance."],
                    ["Leave approved", "Sent to you when your approver approves your request. Includes the dates, approver name, and your updated remaining balance."],
                    ["Leave declined", "Sent to you when your approver declines your request. Includes the reason they provided so you know why."],
                    ["New leave request (to approver)", "Sent to your designated approver whenever you submit a leave request. Includes all details and a direct link to the Approvals page."],
                    ["WFH notification", "Sent to the office when you log a WFH day. Includes your name, department, the date, WFH type (full/half), and your reason if provided."],
                    ["Early clock-out", "Sent to the office when you use Early Leave. Includes your name, department, the date, time left, hours worked, and your reason."],
                    ["Running late", "Sent to the office immediately when you log Running Late — for today or tomorrow. Includes your name, the date, expected arrival time, and reason."],
                    ["Correction submitted", "Sent to reception when you submit a correction request. Includes the date, the field being corrected, the new value, and your reason."],
                    ["Correction reviewed", "Sent to you when your correction request is approved or rejected. Includes the outcome and any notes from reception."],
                    ["Visitor pre-registered", "Sent to reception when you pre-register a visitor. Includes visitor name, company, expected arrival time, and who they are visiting."],
                    ["Expense claim submitted (to approver)", "Sent to your chosen approver when you submit a personal card or cash expense claim. Includes all expense details, receipt link, and a one-click review link."],
                    ["Expense approved", "Sent to you with a download link to your signed Claim Sheet PDF. A separate email is sent to accounts with the reimbursement amount and their own download link."],
                    ["Expense rejected", "Sent to you with the rejection reason from your approver so you can correct and resubmit if needed."],
                    ["Company card expense recorded", "Sent to you as confirmation when you record a company card expense. No approval needed — company already paid."],
                    ["Purchase request submitted (to approver)", "Sent to your chosen approver when you submit a purchase request. Includes item, cost, urgency, justification, and any attachments."],
                    ["Purchase request decision", "Sent to you when your purchase request is approved or rejected. Includes the approver's decision and any notes."],
                    ["Staff announcement", "Sent to staff@yourcompany.com when anyone creates a staff announcement. Includes the message, type badge, optional date range, and optional calendar invite (.ics file)."],
                    ["New poll created", "Sent to all active staff (except Directors) when a new poll is created. Includes the question, all options, deadline, and a direct link to vote."],
                    ["Absent reminder", "Sent to you at 10am if you have not clocked in and have no holiday, calendar leave, WFH, or running-late recorded for the day. Asks you to select the right option or contact reception. Automatically skips UK bank holidays (checked via gov.uk). Directors and staff marked as excluded from reminders are never sent this email."],
                    ["Missing attendance report", "Sent at 7pm if you have no attendance record at all for the day — no clock-in, no leave, no WFH. You'll receive an email asking you to confirm if you were on pre-booked annual leave, sick leave, or had a clock-in issue. A separate summary is sent to the accounts team so they can follow up before payroll. Skips bank holidays automatically."],
                    ["Forgotten clock-out reminder", "Sent to you at 7pm if you clocked in but never clocked out. Reminds you to submit a correction request. Reception also receives a copy. Skips bank holidays automatically."],
                    ["Birthday wish", "Sent to you on your birthday — a personal message from Your Companys."],
                    ["Birthday reminder", "Sent to the office 2 days before a colleague's birthday so they have time to prepare."],
                    ["Diary reminder", "Optional reminder sent if you have not filled in your diary entry for the day. This is a gentle nudge and is not mandatory."],
                    ["IT ticket submitted", "Sent to the IT admin when you raise a new support ticket. Includes category, priority, and description."],
                    ["IT ticket status update", "Sent to you when your IT ticket status changes (Open, In Progress, Resolved, Closed)."],
                    ["IT ticket reply", "Sent to you when the IT admin replies to your ticket. Includes the reply text so you can read it without opening Nexus."],
                    ["New wellness event", "Sent to all staff when a new wellness event is created. Includes date, time, location, and organiser."],
                ].map(([event, desc]) => (
                    <div key={event} className="flex gap-3 items-start rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-foreground">{event}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                        </div>
                    </div>
                ))}
                <Note text="If you are not receiving emails, check your spam or junk folder and mark the sender as safe." />
            </div>
        ),
    },
    {
        id: "settings",
        icon: Settings,
        color: "text-slate-600 dark:text-slate-400",
        bg: "bg-slate-50 dark:bg-slate-950/40",
        title: "Settings",
        subtitle: "Profile, approvers, kiosk PIN, work schedule, and appearance",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Settings is where you manage everything personal to your account — your profile details, leave approvers, kiosk PIN, work schedule, and app appearance.
                </p>

                <SubHeading text="Your Profile" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Settings from the sidebar." />
                    <Step n={2} text="Tap Edit to update your full name, display name, phone number, job title, department, desk extension, gender, and date of birth." />
                    <Step n={3} text="Tap the camera icon on your avatar to upload a profile photo." />
                    <Step n={4} text="Save — your profile updates immediately across the app and in the Directory." />
                </div>

                <SubHeading text="Leave Approvers" />
                <div className="space-y-2">
                    <Step n={1} text="Under Leave Approvers, search for a colleague by name." />
                    <Step n={2} text="Add them as your approver. You can have up to 3 approvers in priority order." />
                    <Step n={3} text="Priority 1 is your first choice — they receive the email notification for every request you submit." />
                    <Step n={4} text="Tap Save Approvers. You must have at least one approver set before you can submit leave." />
                </div>

                <SubHeading text="Work Schedule" />
                <div className="space-y-2">
                    <Step n={1} text="Under Work Schedule, toggle each day on or off to reflect your working days." />
                    <Step n={2} text="Set your contracted hours for each day — these can differ day to day." />
                    <Step n={3} text="Tap Save Schedule. This is used to calculate whether you are under your contracted hours on any given day." />
                </div>

                <SubHeading text="Kiosk PIN" />
                <div className="space-y-2">
                    <Step n={1} text="Set a 4-digit PIN to use at the office kiosk for clocking in and out." />
                    <Step n={2} text="Tap Save. You can change it at any time." />
                </div>
                <Note text="Keep your PIN private. Anyone who knows it can clock in or out as you at the office kiosk." />

                <SubHeading text="Resetting Your Password" />
                <div className="space-y-2">
                    <Step n={1} text="Go to your-domain.com and click Forgot password? on the login page." />
                    <Step n={2} text="Enter your @yourcompany.com email address." />
                    <Step n={3} text="Check your email — click the reset link and set a new password." />
                </div>
                <Note text="Passwords are never stored or visible to anyone — not even admin. If a staff member is locked out and cannot reset themselves, Admin can trigger a password reset email from the Supabase dashboard under Authentication → Users → ... → Send Password Recovery." />

                <SubHeading text="Appearance" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    At the bottom of Settings, you can switch between Light mode, Dark mode, or System (follows your device setting). This preference is saved to your account and stays consistent across devices.
                </p>
            </div>
        ),
    },
    {
        id: "privacy",
        icon: ShieldCheck,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        title: "Data & Privacy",
        subtitle: "What is stored and who can see what",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    All data is stored securely and is never shared with third parties. Here is a clear breakdown of what is stored for each feature and who can see it.
                </p>

                <SubHeading text="Page Access by Role" />
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">These are the only pages each role has access to, by design, to protect the confidentiality of all staff. <span className="font-semibold text-foreground">Own</span> = their own data only. <span className="font-semibold text-foreground">All</span> = all staff data.</p>
                <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left px-3 py-2.5 font-semibold text-foreground">Page</th>
                                <th className="text-center px-3 py-2.5 font-semibold text-foreground">Employee</th>
                                <th className="text-center px-3 py-2.5 font-semibold text-foreground">Accounts</th>
                                <th className="text-center px-3 py-2.5 font-semibold text-foreground">Director</th>
                                <th className="text-center px-3 py-2.5 font-semibold text-foreground">Reception</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {([
                                ["Dashboard",            "Own",  "Own",  "All",  "Own"],
                                ["Attendance",           "Own",  "Own",  "All",  "Own"],
                                ["Timesheets",           "Own",  "All",  "All",  "Own"],
                                ["Corrections",          "Own",  "Own",  "All",  "Own"],
                                ["Leave",                "Own",  "Own",  "All",  "Own"],
                                ["Diary",                "Own",  "Own",  "Own",  "Own"],
                                ["Calendar",             "All",  "All",  "All",  "All"],
                                ["Directory",            "All",  "All",  "All",  "All"],
                                ["Contacts",             "All",  "All",  "All",  "All"],
                                ["Approvals",            "Own",  "Own",  "All",  "Own"],
                                ["Visitors",             "All",  "All",  "All",  "All"],
                                ["Feedback",             "Own",  "Own",  "All",  "Own"],
                                ["Complaints",           "Own",  "Own",  "All",  "Own"],
                                ["Settings",             "Own",  "Own",  "Own",  "Own"],
                                ["How It Works",         "✓",    "✓",    "✓",    "✓"],
                                ["Allowances",           "✕",    "All",  "All",  "✕"],
                                ["Leave Records",        "✕",    "All",  "All",  "✕"],
                                ["Staff Summary",        "✕",    "All",  "All",  "✕"],
                                ["Roll Call",            "✕",    "✕",    "All",  "All"],
                                ["Analytics",            "✕",    "✕",    "All",  "✕"],
                                ["Forgotten Clock-outs", "✕",    "✕",    "All",  "All"],
                                ["Reception",            "✕",    "✕",    "✕",    "All"],
                                ["Attendance (Live)",    "✕",    "✕",    "All",  "All"],
                            ] as [string, string, string, string, string][]).map(([page, emp, acc, dir, rec]) => (
                                <tr key={page} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-3 py-2 font-medium text-foreground">{page}</td>
                                    {[emp, acc, dir, rec].map((val, i) => (
                                        <td key={i} className="px-3 py-2 text-center">
                                            {val === "Own" && <span className="text-blue-600 dark:text-blue-400 font-semibold">Own</span>}
                                            {val === "All" && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">All</span>}
                                            {val === "✓"  && <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>}
                                            {val === "✕"  && <span className="text-muted-foreground/40">✕</span>}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <SubHeading text="Your Timesheet" />
                <p className="text-xs text-muted-foreground leading-relaxed">You can only view your own detailed timesheet. Colleagues see only your status (In / WFH / Out) — not your times. The <span className="font-medium text-foreground">Director</span> and <span className="font-medium text-foreground">Accounts</span> roles can view all staff timesheets for payroll and reporting purposes — read-only, no editing. Attendance analytics is restricted to the <span className="font-medium text-foreground">Director</span> role only.</p>

                <SubHeading text="Leave" />
                <p className="text-xs text-muted-foreground leading-relaxed">You can see your own leave requests and balances. On the Team Calendar, colleagues can see that you are on leave on certain dates — but not the leave type or reason. Your balance figures are never visible to colleagues.</p>

                <SubHeading text="WFH" />
                <p className="text-xs text-muted-foreground leading-relaxed">Your WFH status is visible on the kiosk and attendance view. Your reason is included in the office notification email but is not displayed to other staff in the app.</p>

                <SubHeading text="Diary" />
                <p className="text-xs text-muted-foreground leading-relaxed">Your diary entries are completely private — only you can see them.</p>

                <SubHeading text="Feedback & Complaints" />
                <p className="text-xs text-muted-foreground leading-relaxed">If you submit anonymously, your name is never stored or attached to the submission in any way.</p>

                <SubHeading text="Your Kiosk PIN" />
                <p className="text-xs text-muted-foreground leading-relaxed">Your PIN is stored securely and is never displayed back to you or anyone else after it is saved. Treat it like a password.</p>

                <div className="mt-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3.5 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">Developer Notice</p>
                    <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                        This app is designed in a way that shows you what you as an employee need — based on Memo's standard procedures. Neither staff nor management can request any additional information. All information is held solely with the Directors.
                    </p>
                    <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                        Please kindly cooperate with privacy. If you have a concern, speak to your Director directly or email the developer at{" "}
                        <a href="mailto:privacy@sarmalinux.com" className="font-semibold underline underline-offset-2">privacy@sarmalinux.com</a>.
                    </p>
                </div>
            </div>
        ),
    },
    {
        id: "expenses",
        icon: Receipt,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-950/40",
        title: "Expense Manager",
        subtitle: "AI receipt scanning, VAT tracking, bank reconciliation with manual fix tools, and director analytics",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Expense Manager handles everything from submitting a £5 coffee receipt to full monthly accounting reconciliation with sign-off. It uses <strong>Google Gemini AI</strong> (with AI as automatic fallback) for receipt scanning and bank statement matching. Built so the accountant does almost no manual work — just upload the your bank statement, fix a few edge cases, sign off. Access it from <strong>Expenses</strong> in the sidebar.
                </p>

                {/* AI banner */}
                <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-3 space-y-2">
                    <p className="text-xs font-bold text-violet-800 dark:text-violet-300 uppercase tracking-wider">🤖 AI-Powered Features</p>
                    <InfoTable rows={[
                        ["Receipt OCR", "Upload a photo or PDF receipt — AI reads merchant, total, currency (GBP/USD/EUR etc.), date, description, category, receipt number, VAT details, and supplier VAT number in under 1 second. ~90% accuracy. Gemini runs first; a secondary AI picks up automatically if Gemini is unavailable."],
                        ["Bank Statement Parsing", "Upload a statement (PDF/image) — AI extracts every transaction automatically, reads the card number from the statement header, and identifies the exact cardholder from their registered card's last 4 digits. Also extracts FX conversion rates, foreign currency amounts, and cash advance fees. Gemini runs first; a secondary AI picks up if Gemini is unavailable."],
                        ["Cardholder Detection", "AI reads the card number from the statement and matches the last 4 digits against company cards registered in Settings → Company Cards. No name guessing — it's always the exact card owner."],
                        ["Auto-Matching", "Each bank debit is scored against company card expenses using amount similarity (60pts) + date proximity (40pts). ≥70 = Matched · 40–69 = Suggested · <40 = No Match."],
                        ["Auto VAT Update", "When a bank transaction matches an expense, the system updates converted_gbp, recalculates VAT and net amount from the bank's actual GBP charge, and stores the bank's FX rate."],
                        ["Stub Creation", "Any unmatched debit automatically creates an expense stub under the cardholder, marked [Receipt needed], status Approved. It appears in the monthly sheet immediately so the cardholder can open it, upload the receipt, and save."],
                        ["Missing Receipt Emails (Manual)", "A mail icon button appears on each statement card. Click it to send the cardholder a personal email listing their specific missing transactions with step-by-step upload instructions. Never sent automatically — you control when it goes."],
                    ]} />
                </div>

                <SubHeading text="The 6 Tabs" />
                <InfoTable rows={[
                    ["My Expenses", "Submit and track your own expense claims, company card records, and refunds"],
                    ["Purchase Requests", "Request approval to buy something before spending the money"],
                    ["Monthly Sheet", "Full accounting view — 3 views, bank reconciliation with sign-off, CSV and Excel export"],
                    ["Approvals", "Approve or reject expenses and purchase requests assigned to you"],
                    ["Analytics", "Period KPIs, 9 director charts, spend trends, VAT, merchant analysis (admin/director/accounts)"],
                    ["Settings", "Manage company cards and per-person auto-approve (admin/director/accounts)"],
                ]} />

                <SubHeading text="Payment Types" />
                <InfoTable rows={[
                    ["Company Card", "Money already spent from the company account. Auto-approved instantly — no claim needed. Appears in bank statement reconciliation."],
                    ["Cash Withdrawal", "Company cash taken out. Auto-recorded, no claim. Tracked separately in accounting summary."],
                    ["Personal Card (Claim)", "You paid from your own card. Pick an approver → email sent → once approved, download your signed Claim Sheet PDF."],
                    ["Cash (Claim)", "Same as personal card but paid in cash. Same approval and claim sheet flow."],
                    ["Return / Refund", "Money returned to the company. Auto-approved, shown as negative in all totals and exports."],
                ]} />

                <SubHeading text="Submitting an Expense — Step by Step" />
                <div className="space-y-2">
                    <Step n={1} text='Go to My Expenses tab → click "Add Expense" (blue button, top right).' />
                    <Step n={2} text='Upload receipt: Click "Upload Receipt" → choose image/PDF → AI scans it in ~1 second and auto-fills the form.' />
                    <Step n={3} text="Check all auto-filled fields. Edit anything wrong — AI is ~90% accurate but not perfect." />
                    <Step n={4} text='Choose payment method: Company Card / Cash Withdrawal (auto-approved, no claim) | Personal Card / Cash (needs approval).' />
                    <Step n={5} text="VAT: If the receipt has VAT, the AI pre-fills the rate and supplier VAT number. You can also click '+ Add VAT details manually' at any time to add or change it." />
                    <Step n={6} text="Approver (personal claims only): pick anyone from staff — they get an email immediately with the receipt link." />
                    <Step n={7} text='Category: Choose from the dropdown. Click "+ New category" to add one inline with a colour picker.' />
                    <Step n={8} text='Click "Submit Expense". Done — status updates in your list immediately.' />
                </div>
                <Note text="Company card and cash withdrawal expenses are auto-approved instantly. Personal card and cash claims go to your chosen approver first." />

                <SubHeading text="Adding or Editing VAT on Existing Expenses" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If VAT was not captured at submission time (or was wrong), you can add or correct it later without resubmitting the expense.
                </p>
                <div className="space-y-2">
                    <Step n={1} text='Open the expense from My Expenses or Monthly Sheet → click Edit.' />
                    <Step n={2} text='If no VAT is set: click "+ Add VAT details manually" — the full VAT panel opens.' />
                    <Step n={3} text='If VAT is already set: the panel shows automatically — change the rate, update the supplier VAT number, or click Remove to clear it.' />
                    <Step n={4} text='The panel shows a live Gross / Net / VAT breakdown as you type. Click Save Changes.' />
                </div>
                <InfoTable rows={[
                    ["Gross amount", "The total you paid — what you enter in the Amount field"],
                    ["Net amount", "Gross ÷ (1 + VAT rate) — calculated and stored automatically"],
                    ["VAT amount", "Gross − Net — calculated and stored automatically"],
                    ["VAT rate", "The percentage: 20%, 5%, 0%, or any custom rate"],
                    ["Supplier VAT number", "The supplier's VAT registration number (e.g. GB123456789)"],
                ]} />
                <Note text="All VAT fields appear in the Monthly Sheet, CSV export, Excel export (all sheets), and on the claim sheet PDF." />

                <SubHeading text="Claim Sheet PDF (Personal Claims)" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Once approved, a <strong>Download Claim Form</strong> button appears. A download link is also sent automatically by email to both you and the accounts team.
                </p>
                <InfoTable rows={[
                    ["Employee details", "Name, email, date of submission"],
                    ["Expense details", "Description, date, merchant, category, amount, GBP equivalent"],
                    ["VAT details", "Net, VAT amount, VAT rate, VAT number (if recorded)"],
                    ["Approval details", "Who approved it and on what date"],
                    ["Receipt link", "Direct clickable link to the digital receipt"],
                    ["Signature lines", "For employee and authorised signatory on the printed copy"],
                ]} />

                <SubHeading text="Approval Flow (Personal Claims)" />
                <div className="rounded-xl border border-border bg-muted/30 p-4 font-mono text-xs text-foreground space-y-1">
                    <p>Submit with personal card or cash</p>
                    <p className="text-muted-foreground">→ Pick an approver from the dropdown</p>
                    <p className="text-muted-foreground">→ Approver gets email with all details + one-click review link</p>
                    <p className="text-muted-foreground">→ Approver opens Approvals tab → approves or rejects with optional note</p>
                    <p className="text-muted-foreground">→ You get an approval email with a link to download your claim form PDF</p>
                    <p className="text-muted-foreground">→ Accounts team gets a separate email: reimbursement amount + their own download link</p>
                    <p className="text-muted-foreground">→ Accounts processes reimbursement — no paper needed</p>
                </div>

                <SubHeading text="Monthly Sheet — Three Views" />
                <InfoTable rows={[
                    ["Transaction List", "Every expense in a table — Gross, Net, VAT, Receipt Number, Bank Amount, Bank Adjustment. Filterable by name/description. CSV export. Amber badge shown on rows where bank amount differs."],
                    ["By Person", "Collapsible sections per employee with subtotals: gross spend, VAT, and claims to reimburse. Grand total at bottom."],
                    ["Accounting Summary", "Grand totals (Gross / Net / VAT), spend by category and payment method, bank adjustments log, refunds reconciliation."],
                ]} />

                <SubHeading text="Bank Statement Reconciliation — Month-End Flow (Accounts / Admin / Director)" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Designed for monthly company credit card statements. Upload once, fix any edge cases in the app, then sign off. No spreadsheets needed.
                </p>
                <div className="space-y-2">
                    <Step n={1} text='Monthly Sheet → select the correct month → click "Upload Statement".' />
                    <Step n={2} text="Choose the statement file (JPG/PNG/PDF, max 10MB)." />
                    <Step n={3} text="AI parses every transaction (5–10 seconds). It also reads the card number from the statement header and matches the last 4 digits against registered company cards to identify the exact cardholder — no manual selection needed." />
                    <Step n={4} text="Smart matching runs: each debit is scored against that cardholder's company card expenses. ≥70pts = ✓ Matched (green) · 40–69pts = ~ Suggested (amber) · <40pts = ✗ No Match (red)." />
                    <Step n={5} text="For every matched expense: converted GBP, VAT, net amount, and exchange rate are updated automatically to the bank's actual figures. A note is saved (e.g. 'Bank charged £24.32 (USD 30.00 @ 1.2348) | FX difference: +£0.18')." />
                    <Step n={6} text="Any unmatched debit automatically creates an expense stub under the cardholder's name, marked [Receipt needed], with status Approved. It appears in their My Expenses immediately so they can open it, upload the receipt, and save." />
                    <Step n={7} text="To notify the cardholder: click the mail icon (✉) on the statement card. This sends them a personal email listing only their missing transactions with step-by-step instructions. The email is never sent automatically — you decide when to send it." />
                    <Step n={8} text="Reconciliation panel shows every transaction with its status. For each row you can take action:" />
                </div>
                <InfoTable rows={[
                    ["✓ Matched — Unlink", "AI matched it but got it wrong? Click Unlink to send it back to unmatched."],
                    ["~ Suggested — Accept", "AI found a likely match. Review the suggested expense and click Accept to confirm."],
                    ["~ Suggested — Skip", "Suggestion is wrong. Click Skip to send it to unmatched for manual review."],
                    ["✗ No Match — Mark Reviewed", "Bank fee, direct debit, or anything with no corresponding expense. Click Mark Reviewed — it's noted and no longer blocks sign-off."],
                    ["✗ No Match — Find Expense", "Opens a search modal. Type description, merchant, or amount to find the right expense and link it manually."],
                ]} />
                <div className="space-y-2 mt-2">
                    <Step n={9} text="Once all transactions are resolved (matched or reviewed), a green 'Mark Month as Reconciled' button appears at the bottom of the statement card." />
                    <Step n={10} text="Click it — the month is signed off, timestamped, and your name is recorded. The status badge changes to ✓ Reconciled." />
                </div>
                <Note text="Bank discrepancies (where the bank charged a different amount than the expense) show as an amber badge on the expense row throughout the app, with the exact difference shown in the expense detail." />

                <SubHeading text="Excel Export — 4 Sheets (Admin / Accounts / Director)" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Click <strong>Export Reconciliation</strong> in the Monthly Sheet to download a fully formatted Excel workbook for the accountant.
                </p>
                <InfoTable rows={[
                    ["Sheet 1 — All Expenses", "Every expense for the month: date, employee, description, merchant, category, payment method, currency, gross, net ex VAT, VAT amount, VAT rate, VAT number, receipt number, status, bank amount, bank adjustment. Refunds shown as negative. Totals row at the bottom. Clickable receipt links."],
                    ["Sheet 2 — Bank Statement", "All bank transactions with match status, confidence score, matched expense details, and difference. Colour-coded: green = matched, amber = suggested, red = unmatched."],
                    ["Sheet 3 — Unmatched Debits", "Only the red rows — transactions that still need investigation. Total unmatched amount shown. Empty if fully reconciled."],
                    ["Sheet 4 — By Employee", "Summary table at the top: one row per employee showing gross, net, VAT, company card spend, cash withdrawals, and claims to reimburse. Full detailed expense listing per employee below, with subtotals and a claims note per person. Grand total at the bottom."],
                ]} />
                <Note text="Refunds are correctly shown as negative figures in all sheets. All employee names use display name where set." />

                <SubHeading text="Analytics — Director Dashboard (Admin / Director / Accounts)" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Analytics tab has two rows of KPI cards and eight charts. The first row covers the selected period; the second row covers year-to-date and live figures.
                </p>
                <InfoTable rows={[
                    ["Total Gross", "Total spend for the selected period (approved + paid)"],
                    ["VAT Reclaimable", "Total input VAT for the period"],
                    ["Claims to Pay", "Personal card and cash claims for the period"],
                    ["Transactions", "Count of expenses in the period"],
                    ["YTD Total (FY)", "Running total from start of UK financial year (April) to today"],
                    ["Avg per Expense", "Average transaction value year to date"],
                    ["Pending Approval", "£ value and count of expenses currently waiting for approval"],
                    ["Claims Outstanding", "Total money owed to staff across all submitted but unpaid personal claims"],
                ]} />
                <p className="text-sm font-semibold text-foreground mt-3 mb-2">Charts</p>
                <InfoTable rows={[
                    ["Spend Trend", "Bar chart of monthly totals within the selected quarter or month"],
                    ["Spend by Category", "Donut chart + legend for the top categories"],
                    ["Top Spenders", "Horizontal progress bars showing the top 10 employees by spend"],
                    ["This Month vs Last Month", "Side-by-side bars broken down by payment method — instant trend check"],
                    ["VAT Reclaimable (last 6 months)", "Violet bar chart showing monthly VAT to reclaim — for the accountant to plan submissions"],
                    ["Payment Method Split", "Donut chart for current month — company card vs personal claims vs cash"],
                    ["Top 5 Merchants", "Horizontal bars showing where the most money is going across all time"],
                    ["Claims to Reimburse", "Ranked list of staff with outstanding personal claims — name, count, and total owed"],
                    ["Spend by Approval Status", "Stacked bar chart by month — approved, pending, and paid — so you can see what is stuck in the queue"],
                ]} />
                <Note text="Only approved and paid expenses are included in period and YTD totals. Pending figures include all submitted expenses regardless of approval status." />

                <SubHeading text="Purchase Requests" />
                <div className="space-y-2">
                    <Step n={1} text='Go to Purchase Requests → tap "New Request".' />
                    <Step n={2} text="Enter item name, estimated cost, currency, urgency (Low / Medium / High), and supplier." />
                    <Step n={3} text="Attach quotes or screenshots, add a justification, and select an approver." />
                    <Step n={4} text="Approver gets an email immediately. Once approved, go ahead and order." />
                </div>

                <SubHeading text="Multi-Currency" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Submit in GBP, USD, EUR, AED, SAR, TRY, CHF, JPY, CAD, or AUD. Live exchange rates are fetched at submission time and stored. All reports, totals, and VAT calculations use GBP.
                </p>

                <SubHeading text="Email Notifications" />
                <InfoTable rows={[
                    ["Personal claim submitted", "Approver gets email with amount, merchant, date, and one-click review link"],
                    ["Personal claim approved", "You get a confirmation email with your claim form PDF link. Accounts get a separate email with the reimbursement amount and their own download link."],
                    ["Company card recorded", "You get a confirmation email only. No accounts notification — company already paid."],
                    ["Claim rejected", "You get the rejection reason from the approver"],
                    ["Purchase request submitted", "Approver gets email with item, cost, urgency, justification, and attachments"],
                    ["Purchase request approved/rejected", "You receive the decision with any approver notes"],
                ]} />

                <SubHeading text="Settings (Admin / Director / Accounts)" />
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground"><strong>Company Cards</strong> — Register cards with the employee name and last 4 digits. When submitting an expense, the employee picks whose card was used. The AI receipt scanner reads the last 4 digits from the receipt and pre-selects the correct card automatically. When a bank statement is uploaded, the AI reads the card number from the statement header and uses the last 4 digits to identify the cardholder — so the right person's stubs and email are always used.</p>
                    <p className="text-sm text-muted-foreground"><strong>Auto-Approve Users</strong> — Toggle per person. When on, that employee's personal claims skip the approval step and are approved instantly.</p>
                </div>
            </div>
        ),
    },
    {
        id: "announcements",
        icon: Megaphone,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-950/40",
        title: "Staff Announcements",
        subtitle: "Send a formatted email to the whole company — 10 types, date ranges, calendar invites",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Announcements page lets <strong>anyone</strong> send a formatted email to the whole company. The email goes to <strong>staff@yourcompany.com</strong> — the company group inbox. Go to <strong>My Work → Announcements</strong> in the sidebar, or use the <strong>Announce</strong> quick action on the dashboard.
                </p>

                <SubHeading text="Announcement Types" />
                <p className="text-sm text-muted-foreground leading-relaxed">Select the type that matches your message — it sets the emoji, colour badge in the email header, and smart placeholder text to guide you.</p>
                <InfoTable rows={[
                    ["📢 General Notice", "Anything general that doesn't fit another category"],
                    ["🏖️ Out of Office", "You or a colleague will be away — date range fields always visible, auto-fills absence dates in calendar invite"],
                    ["📅 Event / Meeting", "All-staff events, team lunches, training sessions — supports date range and time"],
                    ["🏢 Office Closure", "Office closed — bank holidays, building access, etc."],
                    ["🎉 Celebration", "Birthdays, work anniversaries, milestones, good news"],
                    ["👋 New Joiner", "Welcoming a new team member"],
                    ["📋 Policy Update", "HR policy changes, process updates, new rules"],
                    ["⚠️ Urgent Notice", "Something that needs immediate attention from all staff"],
                    ["🤝 Going to Meeting", "You or a colleague are attending an external meeting or client visit — calendar invite with time and location"],
                    ["🔧 IT / Systems", "Planned maintenance, system downtime, new tools"],
                ]} />

                <SubHeading text="How to Send" />
                <InfoTable rows={[
                    ["1. Pick a type", "Choose from the 10 type buttons — each has a different emoji and colour"],
                    ["2. Write the subject", "The type emoji is added automatically — e.g. 🏖️ Out of Office — Sarah"],
                    ["3. Write the message", "Each new line becomes a separate paragraph in the email"],
                    ["4. Set dates (optional)", "From Date and To Date are always visible — fill them in for any event or absence"],
                    ["5. Calendar invite (optional)", "Toggle 'Send calendar invite (.ics)' — enter a title, and the dates above are attached automatically"],
                    ["6. Preview", "Click Preview Email to see exactly what staff will receive before sending"],
                    ["7. Send", "Click Send to All Staff — email fires instantly to staff@yourcompany.com"],
                ]} />

                <SubHeading text="Calendar Events & Date Ranges" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Every announcement type supports a calendar event with a <strong>start date and end date</strong>. This is especially useful for Out of Office (e.g. away Mon–Fri), office closures, or multi-day events. A <strong>.ics calendar file</strong> is automatically attached to the email — recipients click it once to add the event to their Outlook, Google Calendar, or Apple Calendar. No manual entries needed.
                </p>
                <InfoTable rows={[
                    ["Start Date", "First day of the event or absence"],
                    ["End Date (optional)", "Last day — leave blank for single-day events"],
                    ["Time (optional)", "Start time — leave blank for all-day events"],
                    ["Location (optional)", "Room, building, Teams link, or city"],
                    ["Calendar Notes (optional)", "Extra detail shown inside the calendar invite"],
                ]} />
                <Note text="Out of Office automatically opens the date range fields and changes labels to 'First day away / Last day away'. The calendar invite will block those exact dates in everyone's Outlook." />

                <SubHeading text="What the Email Looks Like" />
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                    {[
                        { mono: true,  text: "From: nosarma@sarmalinux.com → staff@yourcompany.com" },
                        { mono: false, text: "Dark branded header with Staff Announcement title, your name, and the type badge (e.g. 🏖️ Out of Office)" },
                        { mono: false, text: "Blue subject bar with the emoji and your subject line" },
                        { mono: false, text: "Your message as clean paragraphs" },
                        { mono: false, text: "Event card (if included) showing date range, time, and location in a styled blue box" },
                        { mono: false, text: "Footer with your name and your-domain.com" },
                        { mono: false, text: "📎 event-invite.ics attachment (if event included)" },
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                            <p className={`text-xs text-muted-foreground ${item.mono ? 'font-mono' : ''}`}>{item.text}</p>
                        </div>
                    ))}
                </div>

                <SubHeading text="Sent History" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Every announcement is logged on the Announcements page. Expand any entry to see the full message, type, date range, and event details. The <strong>Announcements dashboard widget</strong> shows the last 4 sent at a glance.
                </p>

                <Note text="Add nosarma@sarmalinux.com to your Outlook safe senders list so announcements don't go to junk. Settings → Safe senders → Add → nosarma@sarmalinux.com → Save." />
            </div>
        ),
    },
    {
        id: "polls",
        icon: BarChart3,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-50 dark:bg-violet-950/40",
        title: "Staff Polls",
        subtitle: "Create quick votes, see live results, and get notified when new polls go up",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Staff Polls let anyone in the team put a question to a vote — whether it's picking a date for the Christmas party, choosing lunch options, or gathering feedback on a new process. Everyone can see all polls and all results in real time.
                </p>

                <SubHeading text="Creating a Poll" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Polls from the sidebar (under TEAM)." />
                    <Step n={2} text="Click the + New Poll button at the top right." />
                    <Step n={3} text="Write your question — be clear and concise so people know exactly what they're voting on." />
                    <Step n={4} text="Add between 2 and 8 answer options. Each option has a colour-coded label." />
                    <Step n={5} text="Set a deadline — this is required. Voting closes automatically once the deadline passes." />
                    <Step n={6} text="Click Create Poll. An email notification fires instantly to all active staff (except Directors)." />
                </div>
                <Note text="Anyone can create a poll — you don't need to be an admin. Just hit + New Poll and fill in the form." />

                <SubHeading text="Voting" />
                <div className="space-y-2">
                    <Step n={1} text="Open the Polls page or scroll to the Polls widget on your dashboard." />
                    <Step n={2} text="Click any option bar to cast your vote." />
                    <Step n={3} text="Your vote is highlighted with a VOTED badge. You can change your vote any time before the deadline by clicking a different option." />
                </div>

                <SubHeading text="Results" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Results are always visible to everyone — there are no private polls. Each option shows a live percentage bar and the exact vote count. The winning option (most votes) gets a trophy icon once the deadline passes. Click the chart icon on any poll to see a full breakdown with a bar chart.
                </p>

                <SubHeading text="Expired Polls" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Once the deadline passes, a poll is automatically archived. Active polls appear at the top of the page. Archived polls are stored in a collapsible section below — you can still view results but voting is closed.
                </p>

                <SubHeading text="Email Notifications" />
                <InfoTable rows={[
                    ["Who gets notified", "All active staff — except Directors"],
                    ["When", "Every time a new poll is created"],
                    ["Email subject", "📊 New Poll: [Your Question]"],
                    ["Email contains", "The poll question, all options, the deadline, and a direct link to vote in Nexus"],
                    ["On/Off switch", "Admins can turn poll emails on or off in Admin → Notifications"],
                ]} />

                <SubHeading text="Dashboard Widget" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Polls widget at the bottom of your dashboard shows all active polls with live vote bars. You can vote directly from the dashboard without opening the full Polls page.
                </p>
                <Note text="Polls are visible to everyone — results are never hidden. If you need a private vote, use the Feedback or Complaints pages instead." />
            </div>
        ),
    },
    {
        id: "notice-board",
        icon: Pin,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/40",
        title: "Notice Board",
        subtitle: "Pin messages, links, and reminders for the whole team to see",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Notice Board is a shared digital pinboard where anyone in the team can pin sticky notes — quick reminders, useful links, important info, or anything the team should know about. It's fully open: anyone can add a note and anyone can remove one.
                </p>

                <SubHeading text="Adding a Note" />
                <div className="space-y-2">
                    <Step n={1} text="Go to Notice Board from the sidebar (under TEAM)." />
                    <Step n={2} text="Click + Pin a Note." />
                    <Step n={3} text="Write your message — keep it short so it fits on the sticky note." />
                    <Step n={4} text="Pick a colour — choose from 8 colours. The preview on the right updates live." />
                    <Step n={5} text="Optionally add a link (URL) — a clickable button appears on the note so people can open it directly." />
                    <Step n={6} text="Optionally set an expiry date — the note fades out automatically on that date (still visible at 40% opacity so nothing disappears silently)." />
                    <Step n={7} text="Click Pin It to add it to the board." />
                </div>

                <SubHeading text="Removing a Note" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Hover over any note and a trash icon appears in the corner. Click it to remove the note. Anyone can remove any note — there's no ownership restriction. Treat the board as a shared space and tidy up old notes when they're no longer relevant.
                </p>

                <SubHeading text="Note Features" />
                <InfoTable rows={[
                    ["Colour", "8 colours to choose from — use colour to categorise (e.g. yellow = reminder, red = urgent)"],
                    ["Link", "Optional URL — shows as a clickable 'Open Link' button on the note"],
                    ["Expiry", "Optional date — expired notes appear at the bottom of the board at 40% opacity"],
                    ["Tilt", "Each note has a slight random tilt so the board feels natural — hover to straighten it"],
                    ["Pin graphic", "Each note shows a coloured pin at the top — the pin colour matches the note colour"],
                ]} />

                <SubHeading text="Expired Notes" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Notes with an expiry date don't vanish — they move to the bottom of the board at 40% opacity with an 'Expired' badge. You can still read them and remove them when you're done. This way nothing gets silently deleted.
                </p>

                <Note text="There are no private notes on the Notice Board — everything is visible to all staff. For private messages, use the Feedback or internal chat tools." />
            </div>
        ),
    },
    {
        id: "it-support",
        icon: Ticket,
        color: "text-violet-600",
        bg: "bg-violet-50 dark:bg-violet-950/30",
        title: "IT Support",
        subtitle: "Raise and track IT support tickets",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The IT Support Portal lets you raise a ticket for any technical issue — from broken hardware to software problems, network issues, or access requests. The IT admin (currently Sai) is notified by email immediately and can update your ticket, reply to you, and mark it as resolved — all from within Nexus.
                </p>

                <SubHeading text="Raising a ticket" />
                <Step n={1} text="Go to IT Support from the sidebar (under MY WORK)." />
                <Step n={2} text="Click New Ticket and choose a category: Hardware, Software, Network, Email, Printer, Access, or Other." />
                <Step n={3} text="Set a priority — Low, Medium, High, or Critical. Use Critical only for urgent issues that are blocking your work." />
                <Step n={4} text="Give the ticket a clear title and describe the problem in detail. Include any error messages, what you were doing when it happened, and what you expected to happen." />
                <Step n={5} text="Click Submit. The IT admin is emailed immediately with the full details." />

                <SubHeading text="After submitting" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    You'll receive an email every time the status changes (In Progress, Resolved, Closed) or when IT adds a reply to your ticket. You can also open the ticket at any time to add more details, upload screenshots, or reply to a comment from IT.
                </p>

                <SubHeading text="Attaching screenshots or files" />
                <Step n={1} text="Open your ticket after submitting it." />
                <Step n={2} text="Click the Upload button in the Attachments section." />
                <Step n={3} text="Select a screenshot, photo, PDF, or document (max 10MB per file)." />
                <Step n={4} text="The file is saved to your ticket. IT can view it when reviewing your case." />

                <SubHeading text="Ticket statuses" />
                <InfoTable rows={[
                    ["Open", "Your ticket has been received — IT admin will pick it up shortly"],
                    ["In Progress", "IT is actively working on your issue"],
                    ["Resolved", "IT has fixed the issue — please check and confirm it works"],
                    ["Closed", "The ticket is complete. Raise a new one if the issue returns"],
                ]} />

                <SubHeading text="Auto-delete" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Resolved and closed tickets — along with all their attachments — are automatically deleted 30 days after resolution to keep the system clean. Download any important attachments before then.
                </p>

                <SubHeading text="Priorities explained" />
                <InfoTable rows={[
                    ["Low", "Not urgent — can wait a day or two (e.g. slow software, cosmetic issues)"],
                    ["Medium", "Should be fixed this week (e.g. email not syncing, printer jammed)"],
                    ["High", "Affecting your work today (e.g. can't access a file, system crashes)"],
                    ["Critical", "Completely blocking you or the whole office (e.g. no internet, total system failure)"],
                ]} />

                <SubHeading text="Public board" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    All staff can see all tickets on the IT Support page so you can check if an issue has already been reported before raising a duplicate.
                </p>

                <SubHeading text="Email notifications" />
                <InfoTable rows={[
                    ["Ticket submitted", "IT admin receives an email with full ticket details"],
                    ["Status changed", "You receive an email explaining what the new status means"],
                    ["IT replies", "You receive an email quoting their reply — no need to check Nexus"],
                ]} />
            </div>
        ),
    },
    {
        id: "wellness",
        icon: Heart,
        color: "text-green-600",
        bg: "bg-green-50 dark:bg-green-950/30",
        title: "Wellness Hub",
        subtitle: "Daily mood, stretches, breathing exercises, and team events",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Wellness Hub is your personal wellbeing space within Nexus. Check in with how you're feeling, take a guided stretch break, practise breathing exercises, join team wellness events, and track your journey over time.
                </p>

                <SubHeading text="Daily mood check-in" />
                <Step n={1} text="Go to Wellness Hub from the sidebar (under MY WORK)." />
                <Step n={2} text="Tap one of the 5 mood emojis — Struggling, Low, Okay, Good, or Great." />
                <Step n={3} text="Optionally add a private note about how you're feeling." />
                <Step n={4} text="Click Log mood. Your rating is saved for today." />
                <Note text="Mood ratings are private to you — management only sees team averages and participation counts, never individual scores or notes." />

                <SubHeading text="Streak" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Check in every day to build your streak. Your current streak is shown on the Wellness Hub home and in My Journey. Missing a day resets the streak.
                </p>

                <SubHeading text="Stretch library" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Go to Wellness → Stretching to find 8 guided desk-friendly exercises covering Upper Body, Core & Back, Lower Body, Hands & Wrists, and Eye Rest. Each stretch includes step-by-step instructions and a timed countdown.
                </p>
                <Step n={1} text="Choose a quick session (3-min, upper body, or full body) or pick an individual stretch." />
                <Step n={2} text="Click Start. A countdown timer guides you through each exercise." />
                <Step n={3} text="Click Skip to move to the next stretch, or Pause to take a break." />
                <Step n={4} text="At the end, click Save & finish to log the session in My Journey." />

                <SubHeading text="Breathing exercises" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Go to Wellness → Breathing to choose from four guided techniques:
                </p>
                <InfoTable rows={[
                    ["4-7-8", "Calm anxiety fast — breathe in 4s, hold 7s, exhale 8s"],
                    ["Box Breathing", "Focus and clarity — 4s for all four phases, used by Navy SEALs"],
                    ["Deep Belly", "Relax and restore — slow 5s inhale, 6s exhale, 6 cycles"],
                    ["Energizing Breath", "Beat the afternoon slump — quick inhales, slow exhales"],
                ]} />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    An animated bubble expands and contracts in time with your breath. Press Start to begin, Pause to stop, or the reset button to start over. Sessions are saved to My Journey.
                </p>

                <SubHeading text="Team events" />
                <Step n={1} text="Go to Wellness → Events to see all upcoming wellness activities." />
                <Step n={2} text="Click Join to RSVP. You can cancel your spot any time." />
                <Step n={3} text="To create an event, click Add event and fill in the details — title, type, date, time, location, duration, and optional max participants." />
                <Step n={4} text="Once created, all staff who have event emails turned on will be notified automatically." />

                <SubHeading text="Event types" />
                <InfoTable rows={[
                    ["Team Activity", "Group activities involving the whole team"],
                    ["Workout", "Exercise sessions — gym, stretching, yoga"],
                    ["Meditation", "Guided meditation or mindfulness sessions"],
                    ["Walk / Run", "Group walks or runs around the local area"],
                    ["Social", "Coffee catch-ups, team lunches, informal social time"],
                    ["Workshop", "Learning sessions, talks, or skills workshops"],
                ]} />

                <SubHeading text="My Journey" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Go to Wellness → My Journey to see your full history: mood chart for the last 30 days, every stretch session, every breathing session, and your summary stats (streak, average mood, total stretch time).
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Notifications tab in My Journey lets you control which wellness emails you receive — you can turn off stretch reminders, event notifications, and weekly summaries individually.
                </p>

                <SubHeading text="Stretch reminders" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    By default, you'll receive a short email at 11am and 3pm on weekdays reminding you to take a stretch break. Each email includes a random desk-friendly tip. You can turn these off in Wellness → My Journey → Notifications.
                </p>

                <SubHeading text="Admin: Wellness Trends" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Admins and Directors can view the Wellness Trends dashboard at Admin → Wellness Trends. It shows the team's average mood each day for the last 30 days, today's and this week's average, and a participation breakdown by staff member. Individual notes and daily ratings are never shown here — only aggregated averages.
                </p>
            </div>
        ),
    },
    {
        id: "jarvis",
        icon: Bot,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-50 dark:bg-violet-950/40",
        title: "Jarvis AI Assistant",
        subtitle: "Your personal AI helper — ask anything about your data or how to use Nexus",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Jarvis is your personal AI assistant built into StaffPortal. Click the floating button in the bottom-right corner of any page to open a chat with Jarvis.
                </p>

                <SubHeading text="What Jarvis can do" />
                <InfoTable rows={[
                    ["Your data", "Ask about your attendance, leave balance, work schedule, hours this week, and more"],
                    ["How-to help", "Step-by-step guidance for any feature — requesting leave, uploading receipts, booking visitors, etc."],
                    ["Office presence", "Ask who's in the office, who's working from home, or who's on leave today"],
                    ["WiFi passwords", "Ask for the staff or guest WiFi password"],
                    ["Wellness support", "If you're having a tough day, Jarvis can suggest breathing exercises or stretches"],
                    ["Report issues", "Tell Jarvis about a bug or problem — it collects the details and notifies the admin team"],
                ]} />

                <SubHeading text="How to use it" />
                <Step n={1} text="Click the floating Jarvis button in the bottom-right corner of any page." />
                <Step n={2} text="Type your question or message in the chat box." />
                <Step n={3} text="Jarvis responds instantly with your real-time data or step-by-step instructions." />
                <Step n={4} text="Close the chat by clicking the X button. Your conversation is kept for the session." />

                <SubHeading text="Reporting an issue" />
                <Step n={1} text={"Tell Jarvis something like \"the calendar isn't loading\" or \"my leave balance looks wrong\"."} />
                <Step n={2} text="Jarvis will ask you for more details — what page, what happened, what you expected." />
                <Step n={3} text="Once Jarvis has enough info, it sends a detailed report to the admin team by email." />
                <Step n={4} text="You'll see a confirmation that the issue has been flagged." />

                <SubHeading text="Privacy" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Jarvis only shows you your own personal data. It will never reveal other employees' attendance times, leave balances, or personal details. It can only tell you whether a colleague is In Office, WFH, On Leave, or Running Late — nothing more.
                </p>

                <Note text="Jarvis was designed and built by Sai. It runs on a custom AI engine and is available to all logged-in staff." />
            </div>
        ),
    },
]

export default function HelpPage() {
    const [search, setSearch] = useState("")
    const [activeId, setActiveId] = useState(sections[0].id)

    const filtered = sections.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.subtitle.toLowerCase().includes(search.toLowerCase())
    )

    const active = sections.find(s => s.id === activeId) ?? sections[0]
    const ActiveIcon = active.icon

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

            {/* ── Left nav panel ───────────────────────────────── */}
            <aside className="w-64 shrink-0 flex flex-col border-r border-border/50 bg-card/60 overflow-hidden">
                {/* Header */}
                <div className="px-4 pt-5 pb-3 border-b border-border/50 shrink-0">
                    <h1 className="text-base font-bold text-foreground tracking-tight">How It Works</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">StaffPortal guide</p>
                </div>

                {/* Search */}
                <div className="px-3 py-2.5 border-b border-border/50 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>
                </div>

                {/* Nav list */}
                <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {filtered.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">No results</p>
                    )}
                    {filtered.map(s => {
                        const Icon = s.icon
                        const isActive = s.id === activeId
                        return (
                            <button
                                key={s.id}
                                onClick={() => setActiveId(s.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                }`}
                            >
                                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? s.bg : "bg-muted/50"}`}>
                                    <Icon className={`h-3.5 w-3.5 ${isActive ? s.color : "text-muted-foreground"}`} />
                                </div>
                                <span className={`text-xs font-medium leading-tight ${isActive ? "text-foreground" : ""}`}>{s.title}</span>
                            </button>
                        )
                    })}
                </nav>
            </aside>

            {/* ── Right content panel ──────────────────────────── */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 max-w-2xl space-y-6">
                    {/* Section header */}
                    <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${active.bg}`}>
                            <ActiveIcon className={`h-5 w-5 ${active.color}`} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground tracking-tight">{active.title}</h2>
                            <p className="text-sm text-muted-foreground mt-0.5">{active.subtitle}</p>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border/50" />

                    {/* Content */}
                    <div className="space-y-4">
                        {active.content}
                    </div>
                </div>
            </main>
        </div>
    )
}
