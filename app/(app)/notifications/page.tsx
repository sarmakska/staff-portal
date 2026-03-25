import Link from 'next/link'
import {
  Mail, CheckCircle2, XCircle, Clock, Receipt, ShoppingCart,
  CalendarDays, AlertCircle, Bell, ArrowRight, Zap, FileText, ShieldCheck, Megaphone,
} from 'lucide-react'

export default function NotificationsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground">How Email Notifications Work</h1>
        <p className="text-sm text-muted-foreground mt-1">
          StaffPortal sends automatic emails at every important step. Here's exactly what gets sent and when.
        </p>
      </div>

      {/* Sender email banner */}
      <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-5">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-bold text-blue-900 dark:text-blue-200">All system emails are sent from</p>
            <p className="font-mono text-base font-bold text-blue-700 dark:text-blue-300 break-all">noreply@yournotifications.com</p>
            <p className="text-sm font-bold text-blue-900 dark:text-blue-200 mt-3">Staff announcements are sent from</p>
            <p className="font-mono text-base font-bold text-blue-700 dark:text-blue-300 break-all">notifications@sarmalinux.com</p>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-2">
              Add <strong>both addresses</strong> to your Outlook safe senders list so all Nexus emails land in your inbox, not junk.
            </p>
          </div>
        </div>
      </div>

      {/* Outlook safe sender guide */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 bg-muted/30 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-bold text-foreground">How to add to Outlook Safe Senders</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">Add both addresses — takes less than a minute. Do it once and all future emails arrive directly in your inbox.</p>
          <ol className="space-y-2.5">
            {[
              { step: "1", text: "Open Outlook and click the gear icon (⚙) in the top-right corner." },
              { step: "2", text: 'In the search box, type "Safe senders" and click the result.' },
              { step: "3", text: 'Click "Add" and type: noreply@yournotifications.com — then click Save.' },
              { step: "4", text: 'Click "Add" again and type: notifications@sarmalinux.com — then click Save.' },
            ].map(({ step, text }) => (
              <li key={step} className="flex items-start gap-3">
                <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">{step}</span>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
          <div className="rounded-xl bg-muted/40 px-3 py-2 mt-2">
            <p className="text-[11px] text-muted-foreground">
              <strong>Outlook on the web:</strong> Settings → Mail → Junk email → Safe senders and domains → Add both addresses → Save.
            </p>
          </div>
        </div>
      </div>

      {/* Announcements */}
      <Section
        icon={Megaphone}
        title="Staff Announcements"
        color="from-blue-600 to-blue-700"
        items={[
          {
            trigger: 'Any staff member sends an announcement',
            recipient: 'admin@yourcompany.com — company group inbox',
            subject: '{Category Emoji} {Announcement Subject}',
            contains: [
              'Category badge (General / OOO / Event / Closure / Celebration / New Joiner / Policy / Urgent / Meeting / IT)',
              'Sender name and full message',
              'Optional event card with title, date range, time, and location',
              'Calendar invite (.ics) attached if an event is included',
            ],
            badge: 'All Staff',
            badgeColor: 'bg-blue-100 text-blue-700',
            highlight: false,
          },
          {
            trigger: 'Out of Office announcement (OOO category)',
            recipient: 'admin@yourcompany.com',
            subject: '🌴 {Subject} — Away from [Start Date] to [End Date]',
            contains: [
              'OOO category auto-shows absence date range',
              'First day away and last day back clearly displayed',
              'Calendar block attached so colleagues can mark their diary',
            ],
            badge: 'OOO',
            badgeColor: 'bg-amber-100 text-amber-700',
            highlight: false,
          },
          {
            trigger: 'Announcement includes a calendar event',
            recipient: 'admin@yourcompany.com',
            subject: '{Category Emoji} {Announcement Subject}',
            contains: [
              'event-invite.ics file attached automatically',
              'Single-day or multi-day date range supported',
              'One click adds to Outlook, Google Calendar, or Apple Calendar',
              'Event card shows title, date(s), time, and location',
            ],
            badge: 'With Calendar',
            badgeColor: 'bg-violet-100 text-violet-700',
            highlight: false,
          },
        ]}
      />

      {/* Expense emails */}
      <Section
        icon={Receipt}
        title="Expense Claims"
        color="from-blue-500 to-blue-600"
        items={[
          {
            trigger: 'Personal claim submitted (personal card or cash)',
            recipient: 'The approver you selected in the form',
            subject: 'Action Required: Expense Claim from [Name]',
            contains: ['Employee name', 'Amount & currency', 'Date & merchant', 'Direct link to approve/reject in Nexus'],
            badge: 'To Approver',
            badgeColor: 'bg-amber-100 text-amber-700',
          },
          {
            trigger: 'Company card or refund recorded',
            recipient: 'No email — auto-approved instantly, no approver needed',
            subject: '(no email sent)',
            contains: ['Expense saved to monthly sheet immediately', 'No approval flow required'],
            badge: 'Auto',
            badgeColor: 'bg-slate-100 text-slate-700',
          },
          {
            trigger: 'Expense approved',
            recipient: 'Employee who submitted',
            subject: 'Your Expense Has Been Approved',
            contains: ['Approved amount', 'Confirmation reimbursement will be processed', 'Link to My Expenses'],
            badge: 'To Employee',
            badgeColor: 'bg-emerald-100 text-emerald-700',
          },
          {
            trigger: 'Expense approved',
            recipient: 'Jai (expense reporting) — jai@yourcompany.com',
            subject: 'Approved Expense — Original Receipt Required from [Name]',
            contains: ['Who submitted', 'Amount', 'Reminder to collect physical receipt', 'Link to digital receipt', 'Employee can now download Claim Sheet PDF'],
            badge: 'To Jai',
            badgeColor: 'bg-violet-100 text-violet-700',
            highlight: true,
          },
          {
            trigger: 'Expense rejected',
            recipient: 'Employee who submitted',
            subject: 'Your Expense Could Not Be Approved',
            contains: ['Amount & description', 'Rejection reason from approver', 'Option to resubmit with more info'],
            badge: 'To Employee',
            badgeColor: 'bg-rose-100 text-rose-700',
          },
        ]}
      />

      {/* Purchase request emails */}
      <Section
        icon={ShoppingCart}
        title="Purchase Requests"
        color="from-violet-500 to-violet-600"
        items={[
          {
            trigger: 'Purchase request submitted',
            recipient: 'Approver (Line Manager / Director)',
            subject: 'Purchase Request: [Item] — Action Required',
            contains: ['Item name & estimated cost', 'Urgency level (Low / Medium / High)', 'Justification text', 'Link to approve/reject'],
            badge: 'To Approver',
            badgeColor: 'bg-amber-100 text-amber-700',
          },
          {
            trigger: 'Purchase request approved',
            recipient: 'Employee who submitted',
            subject: 'Purchase Request Approved: [Item]',
            contains: ['Item name', 'Approver note (if any)', 'Link to view the request'],
            badge: 'To Employee',
            badgeColor: 'bg-emerald-100 text-emerald-700',
          },
          {
            trigger: 'Purchase request rejected',
            recipient: 'Employee who submitted',
            subject: 'Purchase Request Not Approved: [Item]',
            contains: ['Item name', 'Rejection reason', 'Link to resubmit'],
            badge: 'To Employee',
            badgeColor: 'bg-rose-100 text-rose-700',
          },
        ]}
      />

      {/* Leave emails */}
      <Section
        icon={CalendarDays}
        title="Leave Requests"
        color="from-emerald-500 to-emerald-600"
        items={[
          {
            trigger: 'Leave submitted',
            recipient: 'Approver',
            subject: 'New Leave Request from [Name]',
            contains: ['Leave type & dates', 'Remaining balance', 'Approve/reject link'],
            badge: 'To Approver',
            badgeColor: 'bg-amber-100 text-amber-700',
          },
          {
            trigger: 'Leave approved',
            recipient: 'Employee + Accounts team',
            subject: 'Your Leave Has Been Approved',
            contains: ['Approved dates', 'Updated balances', 'PDF download link'],
            badge: 'To Employee',
            badgeColor: 'bg-emerald-100 text-emerald-700',
          },
          {
            trigger: 'Leave rejected',
            recipient: 'Employee',
            subject: 'Your Leave Request Was Not Approved',
            contains: ['Rejection reason', 'Remaining balance'],
            badge: 'To Employee',
            badgeColor: 'bg-rose-100 text-rose-700',
          },
        ]}
      />

      {/* Other */}
      <Section
        icon={Bell}
        title="Other Notifications"
        color="from-slate-600 to-slate-700"
        items={[
          {
            trigger: 'Forgotten clock-out detected',
            recipient: 'Employee',
            subject: 'Reminder: You May Have Forgotten to Clock Out',
            contains: ['Clock-in time', 'Link to corrections'],
            badge: 'Automated',
            badgeColor: 'bg-slate-100 text-slate-700',
          },
          {
            trigger: 'Diary reminder due',
            recipient: 'Employee',
            subject: 'Diary Reminder: [Title]',
            contains: ['Reminder title & notes', 'Scheduled time', 'Tags'],
            badge: 'Automated',
            badgeColor: 'bg-slate-100 text-slate-700',
          },
          {
            trigger: "Colleague's birthday (2 days before)",
            recipient: 'All colleagues',
            subject: "🎂 Birthday Reminder: [Name]'s Birthday in 2 Days",
            contains: ['Name and date', 'Wish them well in person!'],
            badge: 'Automated',
            badgeColor: 'bg-pink-100 text-pink-700',
          },
          {
            trigger: 'Visitor checked in',
            recipient: 'Host employee',
            subject: 'Your Visitor [Name] Has Arrived',
            contains: ['Visitor name & company', 'Check-in time'],
            badge: 'Automated',
            badgeColor: 'bg-slate-100 text-slate-700',
          },
        ]}
      />

      {/* Technical note */}
      <div className="rounded-2xl bg-muted/30 border border-border p-5">
        <div className="flex gap-3">
          <Zap className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">Technical Details</p>
            <p className="text-sm text-muted-foreground">All emails are sent via <strong>Resend</strong>. System notifications come from <code className="bg-muted px-1.5 py-0.5 rounded text-xs">noreply@yournotifications.com</code>. Staff announcements come from <code className="bg-muted px-1.5 py-0.5 rounded text-xs">notifications@sarmalinux.com</code>. Add both to your Outlook safe senders list. The Expense Manager uses <strong>Google Gemini Vision AI</strong> in two places: (1) Receipt OCR — reads merchant, amount, date, category, receipt number, VAT amount, VAT rate, and supplier VAT number from any receipt photo or PDF; (2) Bank Statement Parser — uploads a bank statement image/PDF, extracts every transaction, and auto-matches debits to company card expenses by amount and date.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/expenses" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Receipt className="h-4 w-4" /> Go to Expense Manager
        </Link>
        <Link href="/" className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

interface EmailItem {
  trigger: string
  recipient: string
  subject: string
  contains: string[]
  badge: string
  badgeColor: string
  highlight?: boolean
}

function Section({ icon: Icon, title, color, items }: {
  icon: React.ElementType; title: string; color: string; items: EmailItem[]
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className={`rounded-2xl border p-4 ${item.highlight ? 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20' : 'border-border bg-card'}`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm font-bold text-foreground">{item.trigger}</p>
                </div>
                <p className="text-xs text-muted-foreground">→ {item.recipient}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.badgeColor}`}>
                {item.badge}
              </span>
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2 mb-3">
              <p className="text-xs font-semibold text-muted-foreground">Subject:</p>
              <p className="text-xs font-mono text-foreground mt-0.5">{item.subject}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.contains.map((c, j) => (
                <span key={j} className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />{c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
