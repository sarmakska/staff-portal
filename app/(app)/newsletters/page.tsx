import Link from 'next/link'
import { ArrowRight, Clock, Tag } from 'lucide-react'

export const metadata = {
  title: 'Newsletters — StaffPortal',
  description: 'Newsletters, guides, and updates for StaffPortal',
}

const posts = [
  {
    slug: 'meet-jarvis',
    title: 'Meet Jarvis — Your AI Assistant',
    subtitle: 'I\'ve built an AI assistant right into Nexus. Say hello.',
    date: '8 April 2026',
    readTime: '3 min read',
    tag: 'AI',
    tagColor: 'bg-violet-100 text-violet-700',
    excerpt:
      "Jarvis is your personal AI assistant built into StaffPortal. Ask him about your leave, attendance, how to do anything on the app, who's in the office, WiFi passwords, or just tell him you're having a rough day. He's also great at reporting issues to admin.",
  },
  {
    slug: 'staff-profile-pages',
    title: 'New: Staff Profile Pages',
    subtitle: 'Your profile in the Directory now has a full page — cover photo, bio, hobbies, social links, and more',
    date: '7 April 2026',
    readTime: '3 min read',
    tag: 'Directory',
    tagColor: 'bg-violet-100 text-violet-700',
    excerpt:
      "Every person in the Directory now has their own profile page. Add a cover photo, reposition it like Facebook, write a bio, list your hobbies, link your socials, and set your joined date. Here's how to make yours look great.",
  },
  {
    slug: 'running-late-tomorrow',
    title: 'New: Pre-Log Running Late for Tomorrow',
    subtitle: 'Let the office know in advance — log tonight, they know by morning',
    date: '7 April 2026',
    readTime: '2 min read',
    tag: 'Attendance',
    tagColor: 'bg-amber-100 text-amber-700',
    excerpt:
      "You can now log Running Late for tomorrow — not just today. Tap the Running Late button on the dashboard, choose Tomorrow, add a reason if you like, and the office is notified straight away.",
  },
  {
    slug: 'how-to-upload-receipts',
    title: 'How to Upload Receipts on StaffPortal',
    subtitle: 'A complete guide to keeping your company card expenses up to date — powered by AI',
    date: '7 April 2026',
    readTime: '4 min read',
    tag: 'Expenses',
    tagColor: 'bg-blue-100 text-blue-700',
    excerpt:
      "From April 2026, every company card purchase must have a receipt uploaded in Nexus. Here's exactly how AI reads your receipts, what it extracts, and what to do if you receive a missing receipt email.",
  },
]

export default function NewslettersPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">

      {/* Header */}
      <div className="mb-12">
        <p className="text-xs font-bold tracking-widest uppercase text-blue-600 mb-3">StaffPortal</p>
        <h1 className="text-4xl font-black text-[#0f2540] dark:text-white mb-4 leading-tight">Newsletters &amp; Updates</h1>
        <p className="text-lg text-slate-500 max-w-xl">
          Guides, announcements, and updates for the StaffPortal platform.
        </p>
      </div>

      {/* Posts */}
      <div className="grid gap-6">
        {posts.map(post => (
          <Link
            key={post.slug}
            href={`/newsletters/${post.slug}`}
            className="group block bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${post.tagColor}`}>
                    <Tag className="h-3 w-3" />{post.tag}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />{post.readTime}
                  </span>
                  <span className="text-xs text-slate-400">{post.date}</span>
                </div>
                <h2 className="text-xl font-bold text-[#0f2540] dark:text-white mb-2 group-hover:text-blue-700 transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-0">{post.excerpt}</p>
              </div>
              <div className="shrink-0 mt-1">
                <div className="h-9 w-9 rounded-full bg-slate-100 group-hover:bg-blue-600 flex items-center justify-center transition-colors">
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
