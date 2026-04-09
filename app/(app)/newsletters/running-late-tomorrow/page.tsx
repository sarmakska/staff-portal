import Link from 'next/link'
import { ArrowLeft, Clock, Tag, CheckCircle2, AlertCircle, Zap, CalendarDays, Bell, Shield } from 'lucide-react'

export const metadata = {
  title: 'Pre-Log Running Late for Tomorrow — Newsletters — StaffPortal',
  description: 'You can now log Running Late for tomorrow in advance — the office is notified straight away.',
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="shrink-0 h-7 w-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div>
        <p className="text-sm font-bold text-[#0f172a] dark:text-white mb-1">{title}</p>
        <p className="text-sm text-slate-500 leading-relaxed">{children}</p>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-black text-[#0f2540] dark:text-white mb-4 mt-10 first:mt-0">{children}</h2>
  )
}

export default function RunningLateTomorrowPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

      {/* Back */}
      <Link href="/newsletters" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-blue-600 mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Newsletters
      </Link>

      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
            <Tag className="h-3 w-3" /> Attendance
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" /> 2 min read
          </span>
          <span className="text-xs text-slate-400">7 April 2026</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#0f2540] dark:text-white leading-tight mb-4">
          New: Pre-Log Running Late for Tomorrow
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed">
          Let the office know in advance &mdash; log tonight, they know by morning.
        </p>
      </div>

      {/* What's new */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 mb-10">
        <p className="text-sm font-bold text-amber-800 mb-2">What&apos;s new</p>
        <p className="text-sm text-amber-700 leading-relaxed">
          The <strong>Running Late</strong> button on your dashboard now has a <strong>Today / Tomorrow</strong> toggle.
          If you know tonight that you&apos;ll be late in the morning &mdash; train strike, early appointment, anything &mdash;
          you can log it now. Management gets the email straight away and no one is left wondering where you are.
        </p>
      </div>

      {/* How to use */}
      <SectionTitle>How to use it</SectionTitle>

      <div className="space-y-5 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl p-6 mb-10">
        <Step n={1} title="Tap Running Late on the dashboard">
          Open StaffPortal and find the <strong>Running Late</strong> button in the Quick Actions grid on your dashboard.
        </Step>
        <Step n={2} title='Choose "Tomorrow"'>
          A <strong>Today / Tomorrow</strong> toggle appears at the top of the form. Tap <strong>Tomorrow</strong>.
          It highlights in amber to confirm your selection.
        </Step>
        <Step n={3} title="Add a reason (optional)">
          Let the office know why &mdash; train strike, doctor&apos;s appointment, anything. This is optional but helpful.
          You can also leave it blank.
        </Step>
        <Step n={4} title='Tap "Confirm" — done'>
          The notification email is sent to management <strong>immediately</strong> with tomorrow&apos;s date.
          No need to do anything in the morning &mdash; just arrive and clock in as normal.
        </Step>
      </div>

      {/* Toggle explainer visual */}
      <SectionTitle>What the toggle looks like</SectionTitle>

      <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl p-6 mb-10">
        <p className="text-xs text-slate-400 mb-4">The form looks like this when you open it:</p>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-4 max-w-xs">
          <div className="flex-1 py-2.5 text-sm font-semibold text-center bg-slate-100 text-slate-400">
            Today
          </div>
          <div className="flex-1 py-2.5 text-sm font-semibold text-center bg-amber-500 text-white">
            Tomorrow
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Amber = selected. Tap either option to switch. The form defaults to <strong>Today</strong> every time you open it.
        </p>
      </div>

      {/* What happens */}
      <SectionTitle>What happens after you confirm</SectionTitle>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-emerald-700">Management notified instantly</p>
          </div>
          <p className="text-sm text-emerald-700/80 leading-relaxed">
            An email goes out immediately with your name, tomorrow&apos;s date, your expected arrival time (if entered), and your reason.
            No one has to chase you in the morning.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm font-bold text-blue-700">Absent reminder skipped</p>
          </div>
          <p className="text-sm text-blue-700/80 leading-relaxed">
            The system automatically skips your 10am absent reminder tomorrow. Your pre-log is recognised and
            you won&apos;t receive an unnecessary &ldquo;you haven&apos;t clocked in&rdquo; email.
          </p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-violet-600 shrink-0" />
            <p className="text-sm font-bold text-violet-700">Attendance recorded for tomorrow</p>
          </div>
          <p className="text-sm text-violet-700/80 leading-relaxed">
            A Running Late entry is created in your attendance for tomorrow&apos;s date.
            When you arrive and clock in, it updates the same record &mdash; no duplicate entries.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-bold text-amber-700">Nothing to do in the morning</p>
          </div>
          <p className="text-sm text-amber-700/80 leading-relaxed">
            Just arrive and clock in as you normally would. The Running Late flag is already set.
            No need to tap anything extra when you get in.
          </p>
        </div>
      </div>

      {/* When to use */}
      <SectionTitle>When to use this</SectionTitle>

      <div className="space-y-3 mb-10">
        {[
          { title: 'Train strike or disruption announced the night before', desc: 'You know your journey will be affected — log it before you go to bed.' },
          { title: 'Early morning appointment', desc: 'Doctor, dentist, school run — anything pushing your arrival back.' },
          { title: 'Late night and later start agreed with your manager', desc: 'Log it so the system reflects what your manager already knows.' },
          { title: 'Bad weather forecast', desc: "If you know it'll affect your commute, give the office a heads-up." },
        ].map(({ title, desc }) => (
          <div key={title} className="flex gap-3 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-4">
            <div className="shrink-0 w-2 h-2 rounded-full bg-amber-400 mt-2" />
            <div>
              <p className="text-sm font-bold text-[#0f172a] dark:text-white mb-0.5">{title}</p>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <SectionTitle>Quick answers</SectionTitle>

      <div className="space-y-4 mb-10">
        {[
          {
            q: 'What if I end up arriving on time after all?',
            a: "No problem — just clock in as normal. The running late flag stays on your record but your actual clock-in time shows you were on time. Your manager will see both.",
          },
          {
            q: 'Can I still log Today if I forgot this morning?',
            a: "Yes — the toggle defaults to Today every time. Just open Running Late and leave it on Today if you're logging in the moment.",
          },
          {
            q: 'Can reception log it for me?',
            a: "Yes — reception's Log Late Arrival screen also has the Today / Tomorrow toggle, so they can pre-log it on your behalf too.",
          },
          {
            q: 'Will I get an absent reminder email tomorrow morning?',
            a: "No — the system recognises your pre-log and automatically skips the 10am absent reminder for you.",
          },
        ].map(({ q, a }) => (
          <div key={q} className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-5">
            <p className="text-sm font-bold text-[#0f172a] dark:text-white mb-2">{q}</p>
            <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-[#1e3a5f] rounded-2xl px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Zap className="h-5 w-5 text-amber-300" />
          <p className="text-white font-bold text-lg">Try it now</p>
        </div>
        <p className="text-blue-200 text-sm mb-6">
          Head to the dashboard and tap Running Late in Quick Actions.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#1e3a5f] font-bold text-sm px-6 py-2.5 hover:bg-blue-50 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/attendance"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 text-white font-semibold text-sm px-6 py-2.5 hover:bg-white/20 transition-colors"
          >
            View Attendance
          </Link>
        </div>
      </div>

    </div>
  )
}
