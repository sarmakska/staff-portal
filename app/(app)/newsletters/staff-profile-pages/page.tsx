import Link from 'next/link'
import { ArrowLeft, Clock, Tag, CheckCircle2, Zap, Users, Camera, Pencil, Move, Globe, Heart, CalendarDays } from 'lucide-react'

export const metadata = {
  title: 'Staff Profile Pages — Newsletters — StaffPortal',
  description: 'Your profile in the Directory now has a full page — cover photo, bio, hobbies, social links, and more.',
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

export default function StaffProfilePagesPage() {
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
            <Tag className="h-3 w-3" /> Directory
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" /> 3 min read
          </span>
          <span className="text-xs text-slate-400">7 April 2026</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#0f2540] dark:text-white leading-tight mb-4">
          New: Staff Profile Pages
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed">
          Every person in the Directory now has their own profile page &mdash; with a cover photo, bio, hobbies, social links, and more. Here&apos;s how to make yours look great.
        </p>
      </div>

      {/* What's new */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl px-6 py-5 mb-10">
        <p className="text-sm font-bold text-violet-800 mb-2">What&apos;s new</p>
        <p className="text-sm text-violet-700 leading-relaxed">
          Tap anyone&apos;s name in the <strong>Directory</strong> to open their full profile page. You&apos;ll see their cover photo,
          avatar, job title, department, live status (In Office, WFH, On Leave, etc.), contact details, social links,
          bio, hobbies, and how long they&apos;ve been with Memo. Your own profile is fully editable.
        </p>
      </div>

      {/* How to view */}
      <SectionTitle>How to view a profile</SectionTitle>

      <div className="space-y-5 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl p-6 mb-10">
        <Step n={1} title="Go to Directory">
          Open <strong>Directory</strong> from the sidebar. You&apos;ll see the full staff list.
        </Step>
        <Step n={2} title="Tap anyone's name">
          Click on a colleague&apos;s card to open their profile page.
        </Step>
        <Step n={3} title="See everything at a glance">
          Their cover photo, status, contact info, bio, hobbies, social links, and work details &mdash; all in one place.
          You can email, WhatsApp, or call them directly from the buttons at the top.
        </Step>
      </div>

      {/* How to edit your profile */}
      <SectionTitle>How to set up your profile</SectionTitle>

      <div className="space-y-5 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl p-6 mb-10">
        <Step n={1} title="Open your own profile">
          Go to <strong>Directory</strong>, find yourself, and tap your name. You&apos;ll see an <strong>Edit Profile</strong> button in the top bar.
        </Step>
        <Step n={2} title="Add a cover photo">
          Click <strong>Edit Cover</strong> on the cover area to upload a photo.
          After uploading, click <strong>Reposition</strong> to drag the image up or down to frame it perfectly &mdash; just like Facebook. Hit <strong>Save</strong> when you&apos;re happy.
        </Step>
        <Step n={3} title="Fill in your profile page">
          Click <strong>Edit Profile</strong> (top right) to go to Settings. Scroll down to the <strong>Profile Page</strong> section where you can add:
        </Step>
      </div>

      {/* What you can add */}
      <SectionTitle>What you can add</SectionTitle>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-sm font-bold text-blue-700">Cover photo</p>
          </div>
          <p className="text-sm text-blue-700/80 leading-relaxed">
            Upload any image as your cover. Use the <strong>Reposition</strong> button to drag and adjust the crop &mdash; your position is saved automatically.
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Pencil className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-emerald-700">About me (bio)</p>
          </div>
          <p className="text-sm text-emerald-700/80 leading-relaxed">
            Write a short bio &mdash; up to 400 characters. Tell your colleagues what you do, what you&apos;re passionate about, or anything you want them to know.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-bold text-amber-700">Hobbies &amp; interests</p>
          </div>
          <p className="text-sm text-amber-700/80 leading-relaxed">
            Add up to 10 hobbies. Type one and press Enter to add it. These show as colourful tags on your profile &mdash; great for finding common interests with colleagues.
          </p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-violet-600 shrink-0" />
            <p className="text-sm font-bold text-violet-700">Social links</p>
          </div>
          <p className="text-sm text-violet-700/80 leading-relaxed">
            Add your LinkedIn, Instagram, X/Twitter, Facebook, Discord, Teams, or personal website. They show with branded icons on your profile.
          </p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-rose-600 shrink-0" />
            <p className="text-sm font-bold text-rose-700">Joined date</p>
          </div>
          <p className="text-sm text-rose-700/80 leading-relaxed">
            Set the date you joined Memo. This shows as &ldquo;Since 2023 &middot; 2 years 4m&rdquo; on your profile.
            You can edit it directly on your profile page (tap the pencil icon next to &ldquo;Joined&rdquo;) or in Settings.
          </p>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Move className="h-4 w-4 text-sky-600 shrink-0" />
            <p className="text-sm font-bold text-sky-700">Cover repositioning</p>
          </div>
          <p className="text-sm text-sky-700/80 leading-relaxed">
            After uploading a cover photo, click <strong>Reposition</strong>, then drag up or down to adjust how the image is cropped. Click <strong>Save</strong> to keep your position.
          </p>
        </div>
      </div>

      {/* What colleagues see */}
      <SectionTitle>What colleagues see on your profile</SectionTitle>

      <div className="space-y-3 mb-10">
        {[
          { title: 'Live status', desc: 'In Office, Working from Home, On Leave, Running Late, Left Office, or Not In Today — updates in real time.' },
          { title: 'Contact buttons', desc: 'Email, WhatsApp, and Call buttons right at the top. One tap to reach you.' },
          { title: 'Department & job title', desc: 'Shown under your name and in the Work Details section.' },
          { title: 'How long you\'ve been at Memo', desc: 'Your joined date shows as a badge and in the At a Glance sidebar.' },
          { title: 'Birthday', desc: 'If you\'ve set your birthday in Settings, it appears in your At a Glance section.' },
          { title: 'Bio, hobbies & social links', desc: 'Everything you add in Settings shows on your profile for colleagues to see.' },
        ].map(({ title, desc }) => (
          <div key={title} className="flex gap-3 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-4">
            <div className="shrink-0 w-2 h-2 rounded-full bg-violet-400 mt-2" />
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
            q: 'Can I see other people\'s profiles?',
            a: 'Yes — everyone in the Directory has a profile page. Just tap their name to view it. You can see their status, contact info, bio, and anything they\'ve added.',
          },
          {
            q: 'Can other people edit my profile?',
            a: 'No — only you can edit your own profile. The Edit Profile and Reposition buttons only appear when you\'re viewing your own page.',
          },
          {
            q: 'Do I have to fill everything in?',
            a: 'No — everything is optional. Your profile will still show your name, job title, department, status, and contact details even if you don\'t add a bio or cover photo.',
          },
          {
            q: 'Where do I set my joined date?',
            a: 'Two places: on your profile page, tap the pencil icon next to "Joined" in the At a Glance section. Or go to Settings and look for "Joined Memo" in your profile details.',
          },
          {
            q: 'My cover photo looks cropped wrong — how do I fix it?',
            a: 'Click "Reposition" on your cover photo, then drag up or down to adjust the framing. Click "Save" when it looks right. You can redo this any time.',
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
          <Zap className="h-5 w-5 text-violet-300" />
          <p className="text-white font-bold text-lg">Set up your profile now</p>
        </div>
        <p className="text-blue-200 text-sm mb-6">
          Head to the Directory, find yourself, and start making your profile yours.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/directory"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#1e3a5f] font-bold text-sm px-6 py-2.5 hover:bg-blue-50 transition-colors"
          >
            <Users className="h-4 w-4" /> Go to Directory
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 text-white font-semibold text-sm px-6 py-2.5 hover:bg-white/20 transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      </div>

    </div>
  )
}
