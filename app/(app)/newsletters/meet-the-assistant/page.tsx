import Link from 'next/link'
import { ArrowLeft, Clock, Tag, CheckCircle2, Zap, Bot, MessageCircle, Shield, Heart, Wifi } from 'lucide-react'

export const metadata = {
  title: 'Meet the assistant — Newsletters — StaffPortal',
  description: 'Say hello to the assistant — your new AI assistant built right into StaffPortal.',
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="shrink-0 h-7 w-7 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
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

export default function MeetTheAssistantPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

      {/* Back */}
      <Link href="/newsletters" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-blue-600 mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Newsletters
      </Link>

      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-violet-100 text-violet-700">
            <Tag className="h-3 w-3" /> AI
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" /> 3 min read
          </span>
          <span className="text-xs text-slate-400">8 April 2026</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#0f2540] dark:text-white leading-tight mb-4">
          Meet the assistant &mdash; Your AI Assistant
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed">
          I&apos;ve built an AI assistant right into StaffPortal. His name is the assistant, and he&apos;s here to make your life easier. Here&apos;s everything he can do.
        </p>
      </div>

      {/* What's new */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl px-6 py-5 mb-10">
        <p className="text-sm font-bold text-violet-800 mb-2">What&apos;s new</p>
        <p className="text-sm text-violet-700 leading-relaxed">
          You&apos;ll notice a floating button in the <strong>bottom-right corner</strong> of every page. That&apos;s the assistant. Click it to open a chat &mdash; he knows your attendance, leave, schedule, and can walk you through any feature step by step. He&apos;s also a pretty decent wellness coach.
        </p>
      </div>

      {/* How to use */}
      <SectionTitle>How to chat with the assistant</SectionTitle>

      <div className="space-y-5 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl p-6 mb-10">
        <Step n={1} title="Click the floating button">
          Look for the purple button in the bottom-right corner of any page. That&apos;s the assistant.
        </Step>
        <Step n={2} title="Ask anything">
          Type your question naturally &mdash; &ldquo;How many leave days do I have?&rdquo;, &ldquo;How do I book a visitor?&rdquo;, &ldquo;Is Wendy in the office?&rdquo;
        </Step>
        <Step n={3} title="Get an instant answer">
          the assistant pulls your real-time data and responds in seconds. He&apos;ll give you step-by-step instructions when you need them.
        </Step>
      </div>

      {/* What he can do */}
      <SectionTitle>What the assistant can help with</SectionTitle>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm font-bold text-blue-700">Your personal data</p>
          </div>
          <p className="text-sm text-blue-700/80 leading-relaxed">
            Leave balance, attendance history, hours this week, work schedule, pending requests, desk extension &mdash; all your data at your fingertips.
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-emerald-700">How-to guidance</p>
          </div>
          <p className="text-sm text-emerald-700/80 leading-relaxed">
            &ldquo;How do I request leave?&rdquo; &ldquo;How do I upload a receipt?&rdquo; &ldquo;How do I set my kiosk PIN?&rdquo; &mdash; the assistant walks you through it step by step.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-bold text-amber-700">Office status</p>
          </div>
          <p className="text-sm text-amber-700/80 leading-relaxed">
            &ldquo;Is Prakash in today?&rdquo; &ldquo;Who&apos;s working from home?&rdquo; &mdash; the assistant knows who&apos;s in the office, WFH, on leave, or running late.
          </p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-rose-600 shrink-0" />
            <p className="text-sm font-bold text-rose-700">Wellness support</p>
          </div>
          <p className="text-sm text-rose-700/80 leading-relaxed">
            Having a tough day? Tell the assistant. He&apos;ll suggest breathing exercises, stretches, and remind you it&apos;s okay to take a break. He&apos;s not a therapist &mdash; just a caring mate.
          </p>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="h-4 w-4 text-sky-600 shrink-0" />
            <p className="text-sm font-bold text-sky-700">Office info</p>
          </div>
          <p className="text-sm text-sky-700/80 leading-relaxed">
            &ldquo;What&apos;s the WiFi password?&rdquo; &mdash; the assistant knows the staff and guest WiFi details, and other everyday office info.
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-orange-600 shrink-0" />
            <p className="text-sm font-bold text-orange-700">Report issues</p>
          </div>
          <p className="text-sm text-orange-700/80 leading-relaxed">
            Something broken? Tell the assistant the details &mdash; he&apos;ll collect everything and send a proper report to the admin team automatically.
          </p>
        </div>
      </div>

      {/* Examples */}
      <SectionTitle>Things you can ask</SectionTitle>

      <div className="space-y-3 mb-10">
        {[
          { q: "How many annual leave days do I have left?", a: "the assistant checks your real-time balance and tells you instantly." },
          { q: "How do I upload a receipt?", a: "Step-by-step walkthrough — which page, which button, what happens." },
          { q: "Is Anuja in the office today?", a: "Tells you if they're in, WFH, on leave, or running late." },
          { q: "I'm feeling stressed today", a: "Suggests a quick breathing exercise or stretch from the Wellness Hub." },
          { q: "What's the guest WiFi password?", a: "Gives you the network name and password immediately." },
          { q: "The expenses page won't load", a: "Asks you for details, then sends a full report to admin." },
        ].map(({ q, a }) => (
          <div key={q} className="flex gap-3 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-4">
            <div className="shrink-0 w-2 h-2 rounded-full bg-violet-400 mt-2" />
            <div>
              <p className="text-sm font-bold text-[#0f172a] dark:text-white mb-0.5">&ldquo;{q}&rdquo;</p>
              <p className="text-sm text-slate-500">{a}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Privacy */}
      <SectionTitle>Privacy &amp; safety</SectionTitle>

      <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-5 mb-10">
        <ul className="space-y-2 text-sm text-slate-500">
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> the assistant only shows you <strong className="text-foreground">your own data</strong>. He&apos;ll never reveal other people&apos;s personal details.</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> He can tell you if a colleague is <strong className="text-foreground">in the office or WFH</strong> &mdash; but never their clock times or leave balances.</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> the assistant is <strong className="text-foreground">read-only</strong> &mdash; he can&apos;t change any data. He just reads and explains.</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Chat history is <strong className="text-foreground">session-only</strong> &mdash; close the chat and it&apos;s gone. Nothing is stored.</li>
        </ul>
      </div>

      {/* CTA */}
      <div className="bg-[#1e3a5f] rounded-2xl px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Zap className="h-5 w-5 text-violet-300" />
          <p className="text-white font-bold text-lg">Try the assistant now</p>
        </div>
        <p className="text-blue-200 text-sm mb-6">
          Click the floating button in the bottom-right corner of any page. Go on, say hi.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#1e3a5f] font-bold text-sm px-6 py-2.5 hover:bg-blue-50 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 text-white font-semibold text-sm px-6 py-2.5 hover:bg-white/20 transition-colors"
          >
            How It Works
          </Link>
        </div>
      </div>

    </div>
  )
}
