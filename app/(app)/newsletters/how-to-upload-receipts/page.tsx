import Link from 'next/link'
import { ArrowLeft, Clock, Tag, CheckCircle2, AlertCircle, Zap, Camera, FileText, Search, Sun } from 'lucide-react'

export const metadata = {
  title: 'How to Upload Receipts — Newsletters — StaffPortal',
  description: 'A complete guide to keeping your company card expenses up to date — powered by AI',
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="shrink-0 h-7 w-7 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center mt-0.5">
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

export default function HowToUploadReceiptsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

      {/* Back */}
      <Link href="/newsletters" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-blue-600 mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Newsletters
      </Link>

      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
            <Tag className="h-3 w-3" /> Expenses
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" /> 4 min read
          </span>
          <span className="text-xs text-slate-400">7 April 2026</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#0f2540] dark:text-white leading-tight mb-4">
          How to Upload Receipts on StaffPortal
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed">
          A complete guide to keeping your company card expenses up to date &mdash; powered by AI.
        </p>
      </div>

      {/* March note */}
      <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl px-5 py-4 mb-8">
        <p className="text-sm font-bold text-amber-800 mb-1">Note for March 2026</p>
        <p className="text-sm text-amber-700 leading-relaxed">
          We launched StaffPortal mid-March 2026. Please don&apos;t worry about your March transactions &mdash;
          from <strong>April 2026 onwards</strong>, please upload a receipt for every company card purchase
          as soon as you make it.
        </p>
      </div>

      {/* What is changing */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-5 mb-10">
        <p className="text-sm font-bold text-blue-800 mb-2">What is changing</p>
        <p className="text-sm text-blue-700 leading-relaxed">
          From April 2026, every purchase you make on your Memo company card must have a receipt
          uploaded in <strong>StaffPortal</strong>. The accounts team uploads the monthly bank statement
          and the system automatically checks which purchases are missing receipts. If yours is missing,
          you&apos;ll receive a personal email asking you to upload it.
          The good news: uploading takes <strong>under 30 seconds</strong> &mdash; just snap a photo,
          and our AI reads all the details for you automatically.
        </p>
      </div>

      {/* How to upload */}
      <SectionTitle>How to upload a receipt — step by step</SectionTitle>

      <div className="space-y-5 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl p-6 mb-10">
        <Step n={1} title="Open StaffPortal — go to Expenses">
          Click <strong>Expenses</strong> in the left sidebar. Make sure you&apos;re on the <strong>My Expenses</strong> tab.
        </Step>
        <Step n={2} title='Click "Add Expense" (blue button, top right)'>
          The expense form will open. You&apos;ll see a receipt upload area at the top of the form.
        </Step>
        <Step n={3} title="Upload your receipt — AI reads it instantly">
          Click <strong>Upload Receipt</strong> and choose a photo or PDF of your receipt. The AI scans it
          within 1&ndash;2 seconds and automatically fills in the merchant, amount, currency, date,
          category, and VAT details. You don&apos;t need to type anything.
        </Step>
        <Step n={4} title="Check the auto-filled details">
          Review what the AI filled in &mdash; it&apos;s correct around 90% of the time. If anything looks
          wrong, just edit that field. Make sure the <strong>Payment Method</strong> is set to{' '}
          <code className="bg-slate-100 text-[#1e3a5f] px-1.5 py-0.5 rounded text-xs font-mono font-bold">Company Card</code>{' '}
          and your card is selected.
        </Step>
        <Step n={5} title='Click "Submit Expense" — done!'>
          The expense is saved immediately. It appears in your list and in the monthly accounts sheet.
          No approval needed for company card purchases &mdash; they&apos;re recorded automatically.
        </Step>
      </div>

      {/* Missing receipt email */}
      <SectionTitle>What to do when you receive a missing receipt email</SectionTitle>

      <p className="text-sm text-slate-500 leading-relaxed mb-5">
        When the accounts team uploads the monthly bank statement, any purchase with no receipt
        is automatically added to your expenses as a placeholder. It will appear in your list marked:
      </p>

      <div className="bg-red-50 border border-dashed border-red-300 rounded-xl px-5 py-4 text-center mb-6">
        <p className="text-xs text-red-600 mb-1">You&apos;ll see an entry in My Expenses that looks like this:</p>
        <p className="font-mono font-bold text-red-800 text-base">[Receipt needed] ZARA WHITE CITY LONDON</p>
        <p className="text-xs text-red-500 mt-1">Click it, click Edit, upload the receipt. AI fills the details.</p>
      </div>

      <div className="space-y-5 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl p-6 mb-10">
        <Step n={1} title="Go to My Expenses in Nexus">
          You&apos;ll see entries labelled{' '}
          <code className="bg-slate-100 text-[#1e3a5f] px-1.5 py-0.5 rounded text-xs font-mono font-bold">[Receipt needed]</code>{' '}
          at the top of your list.
        </Step>
        <Step n={2} title="Click the entry — then click Edit">
          The expense detail opens. Click the <strong>Edit</strong> button to open the edit form.
        </Step>
        <Step n={3} title="Upload your receipt">
          Click <strong>Upload Receipt</strong> in the form &mdash; AI will read the receipt and update the
          details automatically.
        </Step>
        <Step n={4} title="Check details and click Save">
          Verify the merchant, amount, and date look right. Click <strong>Save</strong>. The{' '}
          <code className="bg-slate-100 text-[#1e3a5f] px-1.5 py-0.5 rounded text-xs font-mono font-bold">[Receipt needed]</code>{' '}
          label is removed and the record is complete.
        </Step>
      </div>

      {/* Why it matters */}
      <SectionTitle>Why this matters</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-emerald-700">Receipt uploaded — everything smooth</p>
          </div>
          <p className="text-sm text-emerald-700/80 leading-relaxed">
            The expense is matched to the bank transaction. VAT is calculated from the bank&apos;s actual
            GBP charge. Accounts can sign off the month quickly. No follow-up needed from you.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-bold text-amber-700">Receipt missing — reminder email sent</p>
          </div>
          <p className="text-sm text-amber-700/80 leading-relaxed">
            A placeholder is created in your Expenses list. You&apos;ll get a personal email listing the
            specific transactions needing receipts. The month can&apos;t be fully reconciled until all
            receipts are uploaded.
          </p>
        </div>
      </div>

      {/* How AI works */}
      <SectionTitle>How the AI works</SectionTitle>

      <div className="space-y-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <span className="inline-block text-xs font-bold tracking-wider uppercase bg-blue-200 text-blue-800 rounded-full px-2.5 py-0.5 mb-3">Primary AI</span>
          <p className="text-sm font-bold text-blue-800 mb-2">Google Gemini 2.5 Flash</p>
          <p className="text-sm text-blue-700/80 leading-relaxed">
            Our primary receipt reader. The moment you upload a photo or PDF, Gemini Vision analyses
            the entire image &mdash; it handles handwritten receipts, foreign language receipts, curved paper,
            low-light photos, and multi-page PDFs. It returns structured data in under 2 seconds.
          </p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
          <span className="inline-block text-xs font-bold tracking-wider uppercase bg-violet-200 text-violet-800 rounded-full px-2.5 py-0.5 mb-3">Automatic Fallback</span>
          <p className="text-sm font-bold text-violet-800 mb-2">Secondary AI Provider</p>
          <p className="text-sm text-violet-700/80 leading-relaxed">
            If the primary AI is unavailable or returns an error, the system automatically switches to a secondary provider
            &mdash; with no delay and no action needed from you. You&apos;ll never see an error
            because of one AI being down. The result looks identical either way.
          </p>
        </div>
      </div>

      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">What AI reads from your receipt:</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-10">
        {[
          'Merchant name', 'Total amount', 'Currency (GBP/USD/EUR)',
          'Transaction date', 'VAT amount & rate', 'Supplier VAT number',
          'Receipt / invoice number', 'Expense category', 'Card last 4 digits',
          'FX conversion rate',
        ].map(item => (
          <div key={item} className="flex items-center gap-2 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-lg px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{item}</span>
          </div>
        ))}
      </div>

      {/* Tips */}
      <SectionTitle>Tips for best results</SectionTitle>

      <div className="grid sm:grid-cols-2 gap-3 mb-10">
        {[
          { icon: Camera, title: 'Upload the same day', tip: "While the purchase is fresh — you're less likely to lose the receipt and the details will be accurate." },
          { icon: Sun, title: 'Good photo quality = better accuracy', tip: 'Lay the receipt flat, good lighting, no shadows across the total or date. Clear photo = ~95% accuracy.' },
          { icon: Search, title: 'Always check the GBP amount', tip: "Especially for foreign currency purchases — AI converts it. Double-check the amount looks right." },
          { icon: FileText, title: 'PDFs work too', tip: 'Email receipts, invoice PDFs, and digital receipts can all be uploaded directly. No need to print and scan.' },
        ].map(({ icon: Icon, title, tip }) => (
          <div key={title} className="flex gap-3 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-4">
            <div className="shrink-0 h-8 w-8 rounded-lg bg-slate-100 dark:bg-muted flex items-center justify-center">
              <Icon className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0f172a] dark:text-white mb-1">{title}</p>
              <p className="text-sm text-slate-500 leading-relaxed">{tip}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-[#1e3a5f] rounded-2xl px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Zap className="h-5 w-5 text-blue-300" />
          <p className="text-white font-bold text-lg">Ready to get started?</p>
        </div>
        <p className="text-blue-200 text-sm mb-6">
          Go to the Expenses tab to upload your first receipt.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/expenses"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#1e3a5f] font-bold text-sm px-6 py-2.5 hover:bg-blue-50 transition-colors"
          >
            Go to My Expenses
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 text-white font-semibold text-sm px-6 py-2.5 hover:bg-white/20 transition-colors"
          >
            View Full Help Guide
          </Link>
        </div>
      </div>

    </div>
  )
}
