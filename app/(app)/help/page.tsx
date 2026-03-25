"use client"

import { useState } from "react"
import {
    Clock, CalendarDays, FileEdit, FileSpreadsheet, BookOpen, MessageSquare,
    AlertTriangle, Users, UserPlus, Bell, Settings,
    CheckCircle, Coffee, Home, ClipboardList, Search, Package2, TableProperties,
    Monitor, ShieldCheck, Receipt, CreditCard, Banknote, Camera, ShoppingCart,
    BarChart3, Mail, CheckCircle2, Megaphone, MapPin,
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
                    <Step n={1} text={"Tap \"I'm Running Late\" on the Attendance page before you arrive."} />
                    <Step n={2} text="Enter your expected arrival time and an optional reason." />
                    <Step n={3} text="The office is notified immediately by email. When you arrive, clock in as normal." />
                </div>

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
                    If your leave has not yet been approved you can withdraw it from the Leave page. Your pending days are released back to your balance immediately. If it has already been approved, speak to the office to cancel it.
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
                    The Directory is your internal phonebook. It has two tabs — Staff (everyone at Your Company) and External (suppliers, clients, and other outside contacts).
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
                    ["Running late", "Sent to the office when you log Running Late. Includes your name, expected arrival time, and reason."],
                    ["Forgotten clock-out", "Sent to you at 7pm if you clocked in but never clocked out. Reminds you to submit a correction request."],
                    ["Correction reviewed", "Sent to you when your correction request is approved or rejected. Includes the outcome and any notes."],
                    ["Birthday wish", "Sent to you on your birthday — a personal message from Your Company."],
                    ["Birthday reminder", "Sent 2 days before a colleague's birthday so you have time to prepare."],
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
                    <Step n={1} text="Go to your-staffportal-url.com and click Forgot password? on the login page." />
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
        subtitle: "AI-powered expense claims, VAT tracking, bank reconciliation, and Excel exports",
        content: (
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Expense Manager handles everything from submitting a £5 coffee receipt to full monthly accounting reconciliation with your bank. It uses <strong>Google Gemini 1.5 Flash AI</strong> for automatic receipt scanning and intelligent bank statement matching. Access it from <strong>Expenses</strong> in the sidebar.
                </p>

                {/* AI banner */}
                <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-3 space-y-2">
                    <p className="text-xs font-bold text-violet-800 dark:text-violet-300 uppercase tracking-wider">🤖 AI-Powered Features</p>
                    <InfoTable rows={[
                        ["Receipt OCR (Optical Character Recognition)", "Upload a photo or PDF receipt — AI instantly reads merchant name, total amount, date, description, suggested category, receipt number, VAT details (amount, rate, supplier VAT number), and currency. ~90% accuracy on UK receipts. <1 second processing."],
                        ["Bank Statement AI Matching", "Upload your bank statement (PDF/image) — AI extracts EVERY transaction and auto-matches debits to company card expenses using a smart scoring system (60pts for amount match + 40pts for date match). Matches within ±7 days and ±15% amount variance. Performance: 95% faster than manual (100 transactions × 100 expenses in <0.5s)."],
                    ]} />
                </div>

                <SubHeading text="The 6 Tabs" />
                <InfoTable rows={[
                    ["My Expenses", "Submit and track your own expense claims, company card records, and refunds"],
                    ["Purchase Requests", "Request approval to buy something before spending the money"],
                    ["Monthly Sheet", "Full accounting view — 3 views, bank reconciliation, VAT summary, CSV export"],
                    ["Approvals", "Approve or reject expenses and purchase requests assigned to you"],
                    ["Analytics", "Spend by month or UK fiscal quarter — category, person, VAT (admin/director/accounts)"],
                    ["Settings", "Manage company cards and per-person auto-approve (admin/director/accounts)"],
                ]} />

                <SubHeading text="Payment Types" />
                <InfoTable rows={[
                    ["Company Card", "Money already spent from the company account. Auto-approved instantly — no claim needed. Company card transactions appear in the bank statement reconciliation."],
                    ["Personal Card (Claim)", "You paid with your own card. Pick an approver → they get an email → once approved, download the signed Claim Sheet PDF."],
                    ["Cash (Claim)", "Same as personal card but paid in cash. Same approval and claim sheet flow."],
                    ["Return / Refund", "Money returned to the company. Auto-approved, no claim. Shown separately in the accounting summary."],
                ]} />

                <SubHeading text="Submitting an Expense — Step by Step" />
                <div className="space-y-2">
                    <Step n={1} text='Go to My Expenses tab → click "Add Expense" (blue button, top right).' />
                    <Step n={2} text='Upload receipt: Click "Upload Receipt" → choose image/PDF → wait 1-2 seconds for green "Receipt uploaded ✓". AI now processes it in the background.' />
                    <Step n={3} text='AI auto-fill: Within 1 second, form fields populate automatically (merchant, amount, date, description, category). If OCR fails, you get a warning toast — just fill manually.' />
                    <Step n={4} text="Review AI data: Check all auto-filled fields. Edit anything wrong. AI is ~90% accurate but not perfect." />
                    <Step n={5} text='Choose payment method: Company Card (auto-approved) | Personal Card (needs approval) | Cash (needs approval) | Return/Refund (auto-approved).' />
                    <Step n={6} text="VAT (optional): Toggle Includes VAT? → select rate (20%, 5%, 0%, custom) → AI may have pre-filled VAT amount, rate, and supplier VAT number from receipt. System calculates Net automatically." />
                    <Step n={7} text="Approver (if needed): For Personal Card/Cash → select who approves → they get email immediately with receipt link." />
                    <Step n={8} text='Category: Choose from dropdown (or click "+ New category" to add inline with color picker).' />
                    <Step n={9} text='Submit: Click blue "Submit Expense" button → Done! Status shows in My Expenses list.' />
                </div>
                <Note text="Company card purchases are auto-approved instantly (no claim needed — company already paid). Personal card/cash go to your selected approver first." />

                <SubHeading text="VAT Tracking" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    When you toggle <strong>Includes VAT?</strong> on an expense, you set the VAT rate and the system stores:
                </p>
                <InfoTable rows={[
                    ["Gross amount", "The total you paid (what you enter in the Amount field)"],
                    ["Net amount", "Gross ÷ (1 + VAT rate) — stored automatically"],
                    ["VAT amount", "Gross − Net — stored automatically"],
                    ["VAT rate", "The percentage (20%, 5%, etc.)"],
                    ["Supplier VAT number", "The supplier's VAT registration number from the receipt"],
                    ["Receipt / invoice number", "The reference number from the document — for accounting reconciliation"],
                ]} />
                <Note text="All VAT fields appear in the Monthly Sheet CSV and the Accounting Summary view for finance reporting." />

                <SubHeading text="Claim Sheet PDF (Personal Claims)" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Once a personal claim is approved, a <strong>Download Claim Form</strong> button appears on the expense detail. You can download and print it for your records. A download link is also sent automatically by email to both you and the accounts team.
                </p>
                <InfoTable rows={[
                    ["Employee details", "Name, email, date of submission"],
                    ["Expense details", "Description, date, merchant, category, amount, GBP equivalent"],
                    ["VAT details", "Net, VAT amount, VAT rate, VAT number (if recorded)"],
                    ["Approval details", "Who approved it and on what date"],
                    ["Receipt link", "Direct link to the digital receipt"],
                    ["Signature lines", "For employee and authorised signatory on the printed copy"],
                ]} />

                <SubHeading text="Approval Flow (Personal Claims)" />
                <div className="rounded-xl border border-border bg-muted/30 p-4 font-mono text-xs text-foreground space-y-1">
                    <p>Submit with personal card or cash</p>
                    <p className="text-muted-foreground">→ Pick an approver from the dropdown (any staff member)</p>
                    <p className="text-muted-foreground">→ Approver gets email with all expense details + one-click review link</p>
                    <p className="text-muted-foreground">→ Approver opens Approvals tab → approves or rejects with optional note</p>
                    <p className="text-muted-foreground">→ You get an approval email with a link to download your claim form PDF</p>
                    <p className="text-muted-foreground">→ Accounts team automatically gets an email with the amount to reimburse + claim form download link</p>
                    <p className="text-muted-foreground">→ Accounts processes the reimbursement — no paper needed, everything is in StaffPortal</p>
                </div>
                <Note text="Company card and cash withdrawal expenses do not go through approval — they are recorded instantly. Accounts are not notified as no personal money is involved." />

                <SubHeading text="Monthly Sheet — Three Views" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Monthly Sheet shows all expenses for any selected month. Switch between three views using the buttons at the top:
                </p>
                <InfoTable rows={[
                    ["Transaction List", "Every expense in a table — columns include Gross, Net, VAT, Receipt Number, Bank Amount, Bank Adjustment, and reconciliation status. Filterable. Full accounting CSV export."],
                    ["By Person", "Collapsible sections per employee with subtotals: gross spend, VAT, and personal claims to reimburse. Grand total at the bottom."],
                    ["Accounting Summary", "Grand totals (Gross / Net / VAT), spend by category with percentages, by payment method, bank adjustments log, and refunds reconciliation — built for the finance team."],
                ]} />

                <SubHeading text="Bank Statement Reconciliation — AI Magic (Admin / Accounts / Director)" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Monthly Sheet has a powerful AI reconciliation feature. Upload your bank statement and watch AI automatically match every transaction to expenses in seconds.
                </p>
                <div className="space-y-2">
                    <Step n={1} text='Monthly Sheet → Select month (e.g. March 2026) → Click blue "Upload Statement" button (center top).' />
                    <Step n={2} text="Choose bank statement file (JPG/PNG/PDF, max 10MB) → Upload begins." />
                    <Step n={3} text="AI Processing Phase 1: Gemini reads the statement image and extracts bank name, account holder, statement period, and EVERY transaction (date, description, amount, debit/credit). Takes ~5-10 seconds." />
                    <Step n={4} text="AI Processing Phase 2: Smart matching algorithm runs. For each DEBIT transaction, AI scores it against ALL company card expenses in that month using: Amount similarity (60pts max if within 1%) + Date proximity (40pts max if same day) = Total score 0-100." />
                    <Step n={5} text="Match classification: ≥70pts = ✓ Matched (green, auto-linked) | 40-69pts = ~ Suggested (amber, review needed) | <40pts = ✗ Unmatched (red, investigate)." />
                    <Step n={6} text='Reconciliation panel appears below: Shows all bank transactions with colored rows. Click any "Suggested" match to review. Unmatched items (bank fees, missing expenses) are highlighted for investigation.' />
                    <Step n={7} text='Matched expenses: actual_bank_amount field updates automatically. If amount differs from expense → bank_adjustment calculated (e.g. £15.99 expense vs £16.00 bank = +£0.01 adjustment).' />
                    <Step n={8} text='Export: Click "Export Reconciliation" → Downloads 3-sheet Excel file: (1) All expenses with VAT breakdown + clickable receipt links, (2) Bank statement with match status + confidence scores, (3) Unmatched debits only for investigation.' />
                </div>
                <Note text="Performance: The matching algo is optimized (O(n²) → O(n × 15 days)) so 100 transactions × 100 expenses complete in <0.5 seconds instead of 3-5 seconds." />

                <SubHeading text="Analytics (Admin / Director / Accounts)" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Switch between two modes using the Monthly / By Quarter toggle:
                </p>
                <InfoTable rows={[
                    ["Monthly", "Pick any individual month from the last 24. Shows: Gross total, VAT reclaimable, claims to pay, transaction count, category pie chart, top spenders."],
                    ["By Quarter (UK Fiscal)", "UK fiscal year starts April. Q1 = Apr–Jun, Q2 = Jul–Sep, Q3 = Oct–Dec, Q4 = Jan–Mar. Select FY year (e.g. FY 2025/26) and quarter. Shows monthly breakdown bar chart within the quarter and a quarter-selector grid for quick switching."],
                ]} />
                <Note text="Only approved and paid expenses are included in Analytics. The VAT reclaimable figure shows the total input VAT across all VAT-tracked expenses in the period." />

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
                    ["Personal claim approved", "You get a confirmation email with a link to download your claim form PDF. The accounts team automatically receives a separate email with the reimbursement amount and their own download link."],
                    ["Company card approved", "You get a confirmation email only. No accounts notification — company already paid."],
                    ["Claim rejected", "You get the rejection reason from the approver"],
                    ["Purchase request submitted", "Approver gets email with item, cost, urgency, justification, and attachments"],
                    ["Purchase request approved/rejected", "You receive the decision with any approver notes"],
                ]} />

                <SubHeading text="Settings (Admin / Director / Accounts)" />
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground"><strong>Company Cards</strong> — Register company cards and link each one to the employee who holds it (name + last 4 digits). When submitting a company card expense, the employee picks whose card was used from a dropdown. The AI receipt scanner also reads the last 4 digits from the receipt automatically and pre-selects the correct card. This ensures every expense is correctly linked to the right card for bank reconciliation.</p>
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
                    The Announcements page lets <strong>anyone</strong> send a formatted email to the whole company. The email goes to <strong>admin@yourcompany.com</strong> — the company group inbox. Go to <strong>My Work → Announcements</strong> in the sidebar, or use the <strong>Announce</strong> quick action on the dashboard.
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
                    ["7. Send", "Click Send to All Staff — email fires instantly to admin@yourcompany.com"],
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
                        { mono: true,  text: "From: notifications@sarmalinux.com → admin@yourcompany.com" },
                        { mono: false, text: "Dark branded header with Staff Announcement title, your name, and the type badge (e.g. 🏖️ Out of Office)" },
                        { mono: false, text: "Blue subject bar with the emoji and your subject line" },
                        { mono: false, text: "Your message as clean paragraphs" },
                        { mono: false, text: "Event card (if included) showing date range, time, and location in a styled blue box" },
                        { mono: false, text: "Footer with your name and your-staffportal-url.com" },
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

                <Note text="Add notifications@sarmalinux.com to your Outlook safe senders list so announcements don't go to junk. Settings → Safe senders → Add → notifications@sarmalinux.com → Save." />
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
