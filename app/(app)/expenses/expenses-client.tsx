'use client'

import { useState, useEffect, useTransition, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Receipt, ShoppingCart, BarChart3, Settings, CheckCircle2,
  Plus, X, Upload, Camera, ChevronDown, Loader2, ExternalLink,
  TrendingUp, DollarSign, Clock, AlertCircle, Check, FileText,
  CreditCard, Banknote, Paperclip, Trash2, Eye, Download,
  Calendar, Users, Filter, ChevronRight, Building2, Wallet,
  ArrowUpRight, ArrowDownRight, Zap, MoreHorizontal, RefreshCw,
  FileSpreadsheet, AlertTriangle, Layers, SlidersHorizontal, Scale,
  ChevronDown as ChevronDownIcon, ChevronUp, MessageSquare, History, Pencil, Tag, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getMyExpenses, getAllExpenses, getPendingApprovals, submitExpense, updateExpense,
  updateExpenseStatus, markExpensePaid, getExpenseCategories, getCompanyCards,
  getApprovalChains, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  createCompanyCard, saveApprovalChain,
  deleteApprovalChain, getMyPurchaseRequests, getAllPurchaseRequests,
  submitPurchaseRequest, updatePurchaseRequestStatus, cancelPurchaseRequest, deletePurchaseRequest, getExpenseAnalytics,
  getReceiptUploadUrl, getPublicReceiptUrl, toggleExpenseAutoApprove,
  getAllUsersForExpenseSettings, getBankStatements, deleteBankStatement,
  recordBankAdjustment, getExpenseAnalyticsPeriod, updateTransactionMatch,
  markBankStatementReconciled, getExpenseAnalyticsDirector,
  getDepartmentsForExpenses, bulkMarkExpensesPaid,
  addExpenseComment, getExpenseComments, getExpenseAuditLog,
} from '@/lib/actions/expenses'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────

type Tab = 'my-expenses' | 'purchase-requests' | 'monthly' | 'approvals' | 'analytics' | 'settings'

interface Props {
  userId: string
  userProfile: any
  roles: string[]
  isAdmin: boolean
  isDirector: boolean
  isManager: boolean
  canSeeAll: boolean
  initialTab: string
  allUsers: { id: string; full_name: string | null; display_name: string | null; email: string }[]
}

const CURRENCIES = ['GBP', 'USD', 'EUR', 'AED', 'SAR', 'TRY', 'CHF', 'JPY', 'CAD', 'AUD']

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: 'text-slate-600',  bg: 'bg-slate-100' },
  submitted: { label: 'Pending',   color: 'text-amber-600',  bg: 'bg-amber-50' },
  approved:  { label: 'Approved',  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  rejected:  { label: 'Rejected',  color: 'text-rose-600',   bg: 'bg-rose-50' },
  paid:      { label: 'Paid',      color: 'text-blue-600',   bg: 'bg-blue-50' },
  ordered:   { label: 'Ordered',   color: 'text-violet-600', bg: 'bg-violet-50' },
  cancelled: { label: 'Cancelled', color: 'text-slate-500',  bg: 'bg-slate-100' },
}

const URGENCY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: 'text-emerald-600', dot: 'bg-emerald-500' },
  medium: { label: 'Medium', color: 'text-amber-600',   dot: 'bg-amber-500' },
  high:   { label: 'High',   color: 'text-rose-600',    dot: 'bg-rose-500' },
}

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#f97316', '#8b5cf6', '#14b8a6', '#ef4444', '#84cc16']

function formatCurrency(amount: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Status badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', cfg.bg, cfg.color)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'approved' || status === 'paid' ? 'bg-emerald-500' : status === 'rejected' ? 'bg-rose-500' : status === 'submitted' ? 'bg-amber-500' : 'bg-slate-400')} />
      {cfg.label}
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 flex items-start gap-4">
      <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-black text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function ExpensesClient({ userId, userProfile, roles, isAdmin, isDirector, isManager, canSeeAll, initialTab, allUsers }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>(initialTab as Tab)
  const [isPending, startTransition] = useTransition()

  const tabs: { id: Tab; label: string; icon: React.ElementType; roles?: string[] }[] = [
    { id: 'my-expenses',        label: 'My Expenses',       icon: Receipt },
    { id: 'purchase-requests',  label: 'Purchase Requests', icon: ShoppingCart },
    { id: 'monthly',            label: 'Monthly Sheet',     icon: Calendar },
    { id: 'approvals',          label: 'Approvals',         icon: CheckCircle2 },
    { id: 'analytics',          label: 'Analytics',         icon: BarChart3 },
    { id: 'settings',           label: 'Settings',          icon: Settings },
  ].filter(t => {
    if (t.id === 'analytics' && !canSeeAll) return false
    if (t.id === 'settings' && !canSeeAll) return false
    return true
  }) as { id: Tab; label: string; icon: React.ElementType }[]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-0">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-foreground">Expense Manager</h1>
              <p className="text-sm text-muted-foreground mt-1">Track, claim, and manage all company expenses</p>
            </div>
            <div className="flex items-center gap-2">
              {userProfile?.expense_auto_approve && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/30 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
                  <Zap className="h-3 w-3" /> Auto-approved
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {tabs.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-200',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'my-expenses'       && <MyExpensesTab userId={userId} userProfile={userProfile} allUsers={allUsers} canSeeAll={canSeeAll} isAdmin={isAdmin} />}
        {activeTab === 'purchase-requests' && <PurchaseRequestsTab userId={userId} allUsers={allUsers} />}
        {activeTab === 'monthly'           && <MonthlySheetTab canSeeAll={canSeeAll} isAdmin={isAdmin} isDirector={isDirector} />}
        {activeTab === 'approvals'         && <ApprovalsTab />}
        {activeTab === 'analytics'         && <AnalyticsTab />}
        {activeTab === 'settings'          && <SettingsTab isAdmin={isAdmin} isDirector={isDirector} />}
      </div>
    </div>
  )
}

// ============================================================
// MY EXPENSES TAB
// ============================================================

function MyExpensesTab({ userId, userProfile, allUsers, canSeeAll, isAdmin }: { userId: string; userProfile: any; allUsers: any[]; canSeeAll: boolean; isAdmin?: boolean }) {
  const router = useRouter()
  const [expenses, setExpenses] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null)
  const [isPending, startTransition] = useTransition()
  const [filterUser, setFilterUser] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkPaid, setShowBulkPaid] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [exp, cats, cds, depts] = await Promise.all([canSeeAll ? getAllExpenses() : getMyExpenses(), getExpenseCategories(), getCompanyCards(), getDepartmentsForExpenses()])
    setExpenses(exp)
    setCategories(cats)
    setCards(cds)
    setDepartments(depts)
    setLoading(false)
  }, [canSeeAll])

  useEffect(() => { load() }, [load])

  const filteredExpenses = canSeeAll && filterUser !== 'all'
    ? expenses.filter(e => e.user_id === filterUser)
    : expenses

  const totalThisMonth = filteredExpenses
    .filter(e => e.date?.startsWith(new Date().toISOString().slice(0, 7)) && ['approved', 'paid'].includes(e.status))
    .reduce((s, e) => s + (e.payment_method === 'refund' ? -(e.converted_gbp ?? e.amount) : (e.converted_gbp ?? e.amount)), 0)

  const pending = filteredExpenses.filter(e => e.status === 'submitted').length
  const approved = filteredExpenses.filter(e => e.status === 'approved').length
  const toReimburse = filteredExpenses.filter(e => e.status === 'approved' && e.payment_method !== 'company_card' && e.payment_method !== 'company_cash').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="This Month" value={formatCurrency(totalThisMonth)} icon={DollarSign} color="bg-gradient-to-br from-blue-500 to-blue-600" />
        <StatCard label="Pending" value={String(pending)} sub="awaiting approval" icon={Clock} color="bg-gradient-to-br from-amber-500 to-amber-600" />
        <StatCard label="Approved" value={String(approved)} sub={toReimburse > 0 ? `${toReimburse} to reimburse` : 'no reimbursement needed'} icon={CheckCircle2} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
        <StatCard label="Total Expenses" value={String(filteredExpenses.length)} icon={Receipt} color="bg-gradient-to-br from-violet-500 to-violet-600" />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">{canSeeAll ? 'All Expenses' : 'My Claims'}</h2>
          {selectedIds.size > 0 && (
            <button onClick={() => setShowBulkPaid(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              <CheckCircle2 className="h-4 w-4" /> Mark {selectedIds.size} as Paid
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canSeeAll && (
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Employees</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{u.display_name || u.full_name || u.email}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowForm(true)}
            aria-label="Add new expense"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add Expense
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredExpenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses yet" sub="Add your first expense claim to get started" />
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map(e => (
            <div key={e.id} className="flex items-start gap-2">
              {canSeeAll && e.status === 'approved' && (e.payment_method === 'personal_card' || e.payment_method === 'personal_cash') && (
                <input type="checkbox" checked={selectedIds.has(e.id)}
                  onChange={ev => setSelectedIds(prev => { const s = new Set(prev); ev.target.checked ? s.add(e.id) : s.delete(e.id); return s })}
                  className="mt-3 h-4 w-4 rounded border-border text-primary focus:ring-primary/30 shrink-0 cursor-pointer" />
              )}
              {(!canSeeAll || e.status !== 'approved') && <div className="w-6 shrink-0" />}
              <div className="flex-1 min-w-0">
                <ExpenseRow expense={e} onClick={() => setSelectedExpense(e)} showEmployee={canSeeAll} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <ExpenseFormModal
          categories={categories}
          cards={cards}
          departments={departments}
          allUsers={allUsers}
          currentUserId={userId}
          isAdmin={isAdmin}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); load() }}
        />
      )}

      {/* Detail modal */}
      {selectedExpense && (
        <ExpenseDetailModal expense={selectedExpense} onClose={() => setSelectedExpense(null)} onRefresh={load} allUsers={allUsers} isAdmin={isAdmin} departments={departments} />
      )}

      {/* Bulk mark as paid modal */}
      {showBulkPaid && (
        <BulkPaidModal
          count={selectedIds.size}
          onClose={() => setShowBulkPaid(false)}
          onConfirm={async (reimb) => {
            const result = await bulkMarkExpensesPaid(Array.from(selectedIds), reimb) as any
            if (result.success) {
              toast.success(`${selectedIds.size} expenses marked as paid`)
              setSelectedIds(new Set())
              setShowBulkPaid(false)
              load()
            } else {
              toast.error(result.error ?? 'Failed to update')
            }
          }}
        />
      )}
    </div>
  )
}

// ── Bulk Mark Paid Modal ──────────────────────────────────────

function BulkPaidModal({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: (r: { via: string; ref: string; date: string }) => Promise<void> }) {
  const [via, setVia] = useState('BACS')
  const [ref, setRef] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Mark {count} Expense{count > 1 ? 's' : ''} as Paid</h3>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">Payment Method</label>
          <select value={via} onChange={e => setVia(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="BACS">BACS Transfer</option>
            <option value="Payroll">Added to Payroll</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">Reference / Payroll Run Ref <span className="font-normal text-muted-foreground">(optional)</span></label>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. BACS-2026-03 or March Payroll"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">Payment Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={async () => { setSaving(true); await onConfirm({ via, ref, date }); setSaving(false) }}
            disabled={saving}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Confirm Payment'}
          </button>
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Expense row ───────────────────────────────────────────────

function ExpenseRow({ expense: e, onClick, showEmployee }: { expense: any; onClick: () => void; showEmployee?: boolean }) {
  const paymentIcon = (e.payment_method === 'company_card' || e.payment_method === 'company_cash') ? CreditCard : Banknote
  const PayIcon = paymentIcon
  const employeeName = e.user_profiles?.display_name || e.user_profiles?.full_name || e.user_profiles?.email || 'Unknown Employee'
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
    >
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: e.expense_categories?.color ? e.expense_categories.color + '20' : '#e0e7ff' }}>
          <Receipt className="h-4 w-4" style={{ color: e.expense_categories?.color ?? '#6366f1' }} />
        </div>
        <div className="flex-1 min-w-0">
          {/* Top row: description + amount */}
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-foreground text-sm truncate min-w-0 flex-1">{e.description}</p>
            <div className="text-right shrink-0 ml-2">
              <p className={cn('font-black text-sm', e.payment_method === 'refund' ? 'text-emerald-600' : 'text-foreground')}>
                {e.payment_method === 'refund' ? '-' : ''}{formatCurrency(e.amount, e.currency)}
              </p>
              {e.currency !== 'GBP' && e.converted_gbp && (
                <p className="text-[10px] text-muted-foreground">{e.payment_method === 'refund' ? '-' : ''}{formatCurrency(e.converted_gbp)}</p>
              )}
            </div>
          </div>
          {/* Meta row: employee, date, merchant, category */}
          <div className="flex items-center gap-x-2 gap-y-0.5 mt-0.5 flex-wrap">
            {showEmployee && employeeName && <span className="text-xs font-semibold text-primary/80">{employeeName}</span>}
            <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
            {e.merchant && <span className="text-xs text-muted-foreground truncate max-w-[120px]">· {e.merchant}</span>}
            {e.expense_categories && <span className="text-xs text-muted-foreground">· {e.expense_categories.name}</span>}
          </div>
          {/* Bottom row: card info + receipt + status */}
          <div className="flex items-center gap-x-3 gap-y-0.5 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <PayIcon className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[140px]">
                {e.payment_method === 'company_card' ? (e.company_cards ? `${e.company_cards.label} ····${e.company_cards.last4}` : 'Company Card') : e.payment_method === 'company_cash' ? 'Cash (Company)' : e.payment_method === 'personal_card' ? 'Personal Card' : e.payment_method === 'refund' ? 'Refund' : 'Cash (Claim)'}
              </span>
            </span>
            {e.receipt_url && <span className="flex items-center gap-1 text-xs text-blue-600"><Paperclip className="h-3 w-3" />Receipt attached</span>}
            <StatusBadge status={e.status} />
            {e.payment_method === 'refund' && <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Credit</span>}
            {e.bank_adjustment != null && Math.abs(e.bank_adjustment) > 0.50 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-2.5 w-2.5" />
                Bank {e.bank_adjustment > 0 ? '+' : ''}{formatCurrency(e.bank_adjustment)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </button>
  )
}

// ── Expense Form Modal ────────────────────────────────────────

function ExpenseFormModal({ categories, cards, departments, allUsers, currentUserId, isAdmin, onClose, onSuccess }: {
  categories: any[]; cards: any[]; departments: any[]; allUsers: any[]; currentUserId: string; isAdmin?: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [dupWarning, setDupWarning] = useState<any>(null)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [receiptData, setReceiptData] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [addingCat, setAddingCat] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [localCats, setLocalCats] = useState(categories)
  useEffect(() => {
    if (localCats.length === 0) {
      getExpenseCategories().then(cats => { if (cats && cats.length > 0) setLocalCats(cats) })
    }
  }, [])
  const [onBehalfOfId, setOnBehalfOfId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('company_card')
  const [includesVat, setIncludesVat] = useState(false)
  const [vatRate, setVatRate] = useState(20)
  const [customVatRate, setCustomVatRate] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [grossAmount, setGrossAmount] = useState('')
  const [cardLast4, setCardLast4] = useState('')
  const [selectedCardId, setSelectedCardId] = useState('')
  // Controlled fields for OCR auto-fill
  const [formDescription, setFormDescription] = useState('')
  const [formMerchant, setFormMerchant] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formCurrency, setFormCurrency] = useState('GBP')
  const [formCategoryId, setFormCategoryId] = useState('')

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, isPending])

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const { uploadUrl, path, success } = await getReceiptUploadUrl(file.name, file.type) as any
      if (!success || !uploadUrl) throw new Error('Could not get upload URL')

      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      const publicUrl = await getPublicReceiptUrl(path)
      setReceiptUrl(publicUrl)

      // OCR via AI Vision
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        setScanning(true)
        try {
          const res = await fetch('/api/expenses/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiptUrl: publicUrl }),
          })
          if (res.ok) {
            const data = await res.json()
            setReceiptData(data)
            if (data.description) setFormDescription(data.description)
            if (data.merchant) setFormMerchant(data.merchant)
            if (data.date) setFormDate(data.date)
            if (data.currency) setFormCurrency(data.currency)
            if (data.amount) setGrossAmount(String(data.amount))
            if (data.category) {
              const match = localCats.find((c: any) => c.name.toLowerCase() === data.category?.toLowerCase())
              if (match) setFormCategoryId(match.id)
            }
            if (data.receipt_number) setReceiptNumber(data.receipt_number)
            if (data.card_last4) {
              setCardLast4(data.card_last4)
              // Auto-match to registered card by last4
              const matchedCard = cards.find((c: any) => c.last4 === data.card_last4)
              if (matchedCard) setSelectedCardId(matchedCard.id)
            }
            if (data.vat_number) setVatNumber(data.vat_number)
            if ((data.vat_amount && data.vat_amount > 0) || (data.vat_rate && data.vat_rate > 0)) {
              setIncludesVat(true)
              if (data.vat_rate) setVatRate(data.vat_rate)
            }
            toast.success('Receipt scanned — fields auto-filled!')
          } else {
            const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
            console.error('OCR failed:', errorData)
            toast.warning(`Could not scan receipt: ${errorData.error}. Please fill manually.`)
          }
        } catch (e: any) {
          console.error('OCR error:', e)
          toast.warning('Could not scan receipt — please fill the form manually.')
        }
        setScanning(false)
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Upload failed')
    }
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    if (receiptUrl) fd.set('receipt_url', receiptUrl)
    if (receiptData) fd.set('receipt_data', JSON.stringify(receiptData))
    fd.set('payment_method', paymentMethod)
    if (onBehalfOfId) fd.set('on_behalf_of_user_id', onBehalfOfId)

    startTransition(async () => {
      const result = await submitExpense(fd) as any
      if (result.success) {
        toast.success('Expense submitted for approval')
        onSuccess()
      } else if (result.error === 'DUPLICATE_WARNING') {
        setDupWarning(result.duplicate)
      } else {
        toast.error(result.error ?? 'Failed to submit')
      }
    })
  }

  const handleAddCategory = async () => {
    if (!newCat.trim()) return
    setAddingCat(true)
    const result = await createExpenseCategory(newCat.trim(), 'tag', newCatColor) as any
    if (result.success) {
      setLocalCats(c => [...c, result.data])
      setNewCat('')
      toast.success('Category added')
    } else {
      toast.error(result.error ?? 'Failed to add category')
    }
    setAddingCat(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">Add Expense</h3>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form id="expense-form" onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Receipt upload zone */}
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                'relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200',
                receiptUrl ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border hover:border-primary/50 hover:bg-muted/30'
              )}
            >
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{scanning ? 'Scanning receipt with AI...' : 'Uploading...'}</p>
                </div>
              ) : receiptUrl ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-600">Receipt uploaded {scanning ? '· Scanning...' : receiptData ? '· Auto-filled!' : ''}</span>
                  <a href={receiptUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="ml-auto text-blue-600 hover:underline text-xs">View</a>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-3">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Take photo or upload receipt</p>
                  <p className="text-xs text-muted-foreground">AI will auto-fill the form · JPG, PNG, PDF</p>
                </div>
              )}
            </div>

            {/* On behalf of — admin only */}
            {isAdmin && (
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Add on behalf of</label>
                <select value={onBehalfOfId} onChange={ev => setOnBehalfOfId(ev.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">Myself (default)</option>
                  {allUsers.filter(u => u.id !== currentUserId).map(u => (
                    <option key={u.id} value={u.id}>{u.display_name ?? u.full_name ?? u.email}</option>
                  ))}
                </select>
                {onBehalfOfId && (
                  <p className="text-[11px] text-amber-600 mt-1">Expense will be saved under the selected staff member.</p>
                )}
              </div>
            )}

            {/* Payment method */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-2">Payment Method</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { v: 'company_card', label: 'Company Card', icon: CreditCard },
                  { v: 'company_cash', label: 'Cash Withdrawal', icon: Banknote },
                  { v: 'personal_card', label: 'Personal Card (Claim)', icon: Wallet },
                  { v: 'personal_cash', label: 'Cash (Claim)', icon: Banknote },
                  { v: 'refund', label: 'Return / Refund', icon: RefreshCw },
                ].map(opt => (
                  <button type="button" key={opt.v}
                    onClick={() => setPaymentMethod(opt.v)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all',
                      paymentMethod === opt.v
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    )}
                  >
                    <opt.icon className="h-4 w-4" />
                    <span className="text-center leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Company card / refund — pick registered card or enter last 4 */}
            {(paymentMethod === 'company_card' || paymentMethod === 'refund') && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-foreground">Whose card was used?</label>
                {cards.length > 0 ? (
                  <>
                    <select value={selectedCardId} onChange={e => {
                      setSelectedCardId(e.target.value)
                      const card = cards.find((c: any) => c.id === e.target.value)
                      if (card) setCardLast4(card.last4)
                      else setCardLast4('')
                    }} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                      <option value="">— Select card —</option>
                      {cards.map((c: any) => {
                        const name = c.user_profiles ? (c.user_profiles.display_name || c.user_profiles.full_name || c.card_holder || 'Unknown') : (c.card_holder || 'Unknown')
                        return <option key={c.id} value={c.id}>{name} · {c.card_type} ····{c.last4}</option>
                      })}
                    </select>
                    {selectedCardId && <input type="hidden" name="card_id" value={selectedCardId} />}
                    {selectedCardId && <input type="hidden" name="card_last4" value={cardLast4} />}
                    {!selectedCardId && (
                      <input name="card_last4" value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4} placeholder="Or type last 4 digits manually" inputMode="numeric" pattern="[0-9]*"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    )}
                    <p className="text-[11px] text-muted-foreground">AI will auto-detect from receipt if card digits are visible.</p>
                  </>
                ) : (
                  <>
                    <input name="card_last4" value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4} placeholder="Last 4 digits (e.g. 4231)" inputMode="numeric" pattern="[0-9]*"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <p className="text-[11px] text-muted-foreground">Register company cards in Settings to pick by employee name.</p>
                  </>
                )}
              </div>
            )}

            {/* Core fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-foreground mb-1.5">Description *</label>
                <input required name="description" value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="What was this for?" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Amount * <span className="text-[10px] font-normal text-muted-foreground">(total incl. VAT if applicable)</span></label>
                <input required name="amount" type="number" step="0.01" min="0.01"
                  value={grossAmount}
                  onChange={e => setGrossAmount(e.target.value)}
                  placeholder="0.00" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Currency</label>
                <select name="currency" value={formCurrency} onChange={e => setFormCurrency(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Date *</label>
                <input required name="date" type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {paymentMethod !== 'company_cash' && (
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Merchant</label>
                  <input name="merchant" value={formMerchant} onChange={e => setFormMerchant(e.target.value)}
                    placeholder="Shop / supplier name" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              )}
            </div>

            {/* Receipt number */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Receipt / Invoice Number</label>
              <input name="receipt_number" value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)}
                placeholder="Auto-filled from receipt scan (optional)"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {/* Department */}
            {departments.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Department <span className="font-normal text-muted-foreground">(optional)</span></label>
                <select name="department_id"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">— No department —</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            {/* Duplicate warning */}
            {dupWarning && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-700">Possible Duplicate</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      A similar expense already exists: <strong>{dupWarning.description}</strong> · £{dupWarning.amount} · {formatDate(dupWarning.date)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setDupWarning(null) }}
                    className="flex-1 rounded-xl border border-amber-300 bg-white dark:bg-transparent py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors">
                    Cancel — it was a duplicate
                  </button>
                  <button type="button" onClick={() => {
                    setDupWarning(null)
                    const form = document.getElementById('expense-form') as HTMLFormElement
                    if (form) {
                      const fd = new FormData(form)
                      fd.set('skip_duplicate_check', 'true')
                      if (receiptUrl) fd.set('receipt_url', receiptUrl)
                      if (receiptData) fd.set('receipt_data', JSON.stringify(receiptData))
                      fd.set('payment_method', paymentMethod)
                      if (onBehalfOfId) fd.set('on_behalf_of_user_id', onBehalfOfId)
                      submitExpense(fd).then((r: any) => {
                        if (r.success) { toast.success('Expense submitted'); onSuccess() }
                        else toast.error(r.error ?? 'Failed to submit')
                      })
                    }
                  }}
                    className="flex-1 rounded-xl bg-amber-600 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity">
                    Submit anyway — different expense
                  </button>
                </div>
              </div>
            )}

            {/* VAT section — auto-shown by AI, manual fallback link */}
            <div className="space-y-3">
              {includesVat ? (
                <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-violet-700 dark:text-violet-400">VAT Detected</p>
                    <button type="button" onClick={() => setIncludesVat(false)}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline">Remove</button>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">VAT Rate</p>
                    <div className="flex gap-2">
                      {[20, 5, 0].map(rate => (
                        <button type="button" key={rate} onClick={() => { setVatRate(rate); setCustomVatRate('') }}
                          className={cn('flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                            vatRate === rate && !customVatRate ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                          {rate}%
                        </button>
                      ))}
                      <input
                        type="number" placeholder="Other %" step="0.1" min="0" max="100"
                        value={customVatRate}
                        onChange={e => { setCustomVatRate(e.target.value); if (e.target.value) setVatRate(parseFloat(e.target.value)) }}
                        className={cn('w-20 rounded-lg border px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/30',
                          customVatRate ? 'border-primary bg-primary/5' : 'border-border bg-background')}
                      />
                    </div>
                  </div>
                  {grossAmount && vatRate > 0 && (() => {
                    const gross = parseFloat(grossAmount)
                    if (!isNaN(gross) && gross > 0) {
                      const vatAmt = Math.round(gross * vatRate / (100 + vatRate) * 100) / 100
                      const netAmt = Math.round((gross - vatAmt) * 100) / 100
                      return (
                        <div className="rounded-lg bg-muted/40 px-3 py-2 grid grid-cols-3 gap-2 text-center">
                          <div><p className="text-[10px] text-muted-foreground">Gross</p><p className="text-xs font-bold">{formatCurrency(gross, formCurrency)}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Net</p><p className="text-xs font-bold">{formatCurrency(netAmt, formCurrency)}</p></div>
                          <div><p className="text-[10px] text-violet-600">VAT</p><p className="text-xs font-bold text-violet-600">{formatCurrency(vatAmt, formCurrency)}</p></div>
                        </div>
                      )
                    }
                    return null
                  })()}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Supplier VAT Number (optional)</label>
                    <input name="vat_number" value={vatNumber} onChange={e => setVatNumber(e.target.value)}
                      placeholder="e.g. GB123456789"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setIncludesVat(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline">
                  + Add VAT details manually
                </button>
              )}
              {!includesVat && vatNumber && <input type="hidden" name="vat_number" value={vatNumber} />}
              <input type="hidden" name="includes_vat" value={includesVat ? 'true' : 'false'} />
              <input type="hidden" name="vat_rate" value={vatRate} />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Category</label>
              <select name="category_id" value={formCategoryId} onChange={e => setFormCategoryId(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                <option value="">Select category</option>
                {localCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-2 mt-2">
                <input value={newCat} onChange={e => setNewCat(e.target.value)}
                  placeholder="+ New category" className="flex-1 rounded-xl border border-dashed border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                  className="h-9 w-9 rounded-xl border border-border cursor-pointer bg-background" title="Category colour" />
                <button type="button" onClick={handleAddCategory} disabled={addingCat || !newCat.trim()}
                  className="rounded-xl bg-muted px-3 py-2 text-xs font-semibold hover:bg-muted/80 disabled:opacity-50">
                  {addingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                </button>
              </div>
            </div>

            {/* Approver — only for personal claims */}
            {(paymentMethod === 'personal_card' || paymentMethod === 'personal_cash') && (
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Send to Approver *</label>
                <select required name="direct_approver_id" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select who should approve this</option>
                  {allUsers.filter(u => u.id !== currentUserId).map(u => (
                    <option key={u.id} value={u.id}>{u.display_name ?? u.full_name ?? u.email}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">They will receive an email to review your expense.</p>
              </div>
            )}
            {paymentMethod === 'company_card' && (
              <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground"><strong>Company card purchases</strong> are recorded automatically — no approval needed as the money has already been spent.</p>
              </div>
            )}
            {paymentMethod === 'refund' && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5">
                <p className="text-xs text-emerald-700 dark:text-emerald-400"><strong>Return / Refund</strong> — record money being returned to the company or refunded to you. No approval required.</p>
              </div>
            )}
          </form>
        </div>

        <div className="p-5 border-t border-border flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" form="expense-form" disabled={isPending}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Expense Detail Modal ──────────────────────────────────────

function ExpenseDetailModal({ expense: e, onClose, onRefresh, allUsers, isAdmin, departments = [] }: { expense: any; onClose: () => void; onRefresh: () => void; allUsers?: any[]; isAdmin?: boolean; departments?: any[] }) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [paymentMethod, setPaymentMethod] = useState(e.payment_method ?? 'company_card')
  const [selectedCardId, setSelectedCardId] = useState(e.company_cards?.id ?? '')
  const [cardLast4, setCardLast4] = useState(e.company_cards?.last4 ?? '')
  const [editUserId, setEditUserId] = useState(e.user_id ?? '')
  const [editDepartmentId, setEditDepartmentId] = useState(e.department_id ?? '')
  const [receiptUrl, setReceiptUrl] = useState(e.receipt_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [editAmount, setEditAmount] = useState(String(e.amount ?? ''))
  const [editIncludesVat, setEditIncludesVat] = useState(!!e.includes_vat)
  const [editVatRate, setEditVatRate] = useState<number>(e.vat_rate ?? 20)
  const [editCustomVatRate, setEditCustomVatRate] = useState('')
  const [editVatNumber, setEditVatNumber] = useState(e.vat_number ?? '')
  const [editReceiptNumber, setEditReceiptNumber] = useState(e.receipt_number ?? '')
  const [scanning, setScanning] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<'details' | 'comments' | 'history'>('details')
  const [comments, setComments] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getExpenseCategories().then(setCategories)
    getCompanyCards().then((c: any) => setCards(c ?? []))
    getExpenseComments(e.id).then(setComments)
    getExpenseAuditLog(e.id).then(setAuditLog)
  }, [e.id])

  const handlePostComment = async () => {
    if (!newComment.trim()) return
    setPostingComment(true)
    const result = await addExpenseComment(e.id, newComment) as any
    if (result.success) {
      setComments(prev => [...prev, result.data])
      setNewComment('')
    } else {
      toast.error(result.error ?? 'Failed to post comment')
    }
    setPostingComment(false)
  }

  const handleSave = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    setSaving(true)
    const fd = new FormData(ev.currentTarget)
    fd.set('payment_method', paymentMethod)
    if (receiptUrl) fd.set('receipt_url', receiptUrl)
    if (selectedCardId) fd.set('card_id', selectedCardId)
    if (cardLast4) fd.set('card_last4', cardLast4)
    if (isAdmin && editUserId) fd.set('edit_user_id', editUserId)
    fd.set('department_id', editDepartmentId)
    const result = await updateExpense(e.id, fd)
    setSaving(false)
    if (result.success) {
      toast.success('Expense updated')
      setIsEditing(false)
      onRefresh()
    } else {
      toast.error(result.error ?? 'Failed to save')
    }
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const { uploadUrl, path, success } = await getReceiptUploadUrl(file.name, file.type) as any
      if (!success || !uploadUrl) throw new Error('Could not get upload URL')
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      const publicUrl = await getPublicReceiptUrl(path)
      setReceiptUrl(publicUrl)
      // OCR scan on upload
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        setScanning(true)
        try {
          const res = await fetch('/api/expenses/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiptUrl: publicUrl }),
          })
          if (res.ok) {
            const data = await res.json()
            if (data.receipt_number) setEditReceiptNumber(data.receipt_number)
            if (data.vat_number) setEditVatNumber(data.vat_number)
            if ((data.vat_amount && data.vat_amount > 0) || (data.vat_rate && data.vat_rate > 0)) {
              setEditIncludesVat(true)
              if (data.vat_rate) setEditVatRate(data.vat_rate)
            }
            toast.success('Receipt scanned — fields updated!')
          } else {
            toast.success('Receipt uploaded')
          }
        } catch {
          toast.success('Receipt uploaded')
        }
        setScanning(false)
      } else {
        toast.success('Receipt uploaded')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed')
    }
    setUploading(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-foreground">{isEditing ? 'Edit Expense' : 'Expense Details'}</h3>
            {!isEditing && <StatusBadge status={e.status} />}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave}>
            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Description *</label>
                <input required name="description" defaultValue={e.description}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {/* Amount + Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Amount *</label>
                  <input required name="amount" type="number" step="0.01" min="0.01" value={editAmount} onChange={ev => setEditAmount(ev.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Currency</label>
                  <select name="currency" defaultValue={e.currency ?? 'GBP'}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                    {['GBP','USD','EUR','AED','SAR','TRY','CHF','JPY','CAD','AUD'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {/* Date + Merchant */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Date *</label>
                  <input required name="date" type="date" defaultValue={e.date}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                {paymentMethod !== 'company_cash' && (
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Merchant</label>
                    <input name="merchant" defaultValue={e.merchant ?? ''}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                )}
              </div>
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Category</label>
                <select name="category_id" defaultValue={e.category_id ?? ''}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">No category</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Department */}
              {departments.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Department</label>
                  <select value={editDepartmentId} onChange={ev => setEditDepartmentId(ev.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                    <option value="">— No department —</option>
                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              {/* Employee picker — admin only */}
              {isAdmin && allUsers && allUsers.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Employee</label>
                  <select value={editUserId} onChange={ev => setEditUserId(ev.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.display_name ?? u.full_name ?? u.email}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Payment method */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-2">Payment Method</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { v: 'company_card', label: 'Company Card', icon: CreditCard },
                    { v: 'company_cash', label: 'Cash Withdrawal', icon: Banknote },
                    { v: 'personal_card', label: 'Personal Card', icon: Wallet },
                    { v: 'personal_cash', label: 'Cash (Claim)', icon: Banknote },
                    { v: 'refund', label: 'Return / Refund', icon: RefreshCw },
                  ].map(opt => (
                    <button type="button" key={opt.v} onClick={() => setPaymentMethod(opt.v)}
                      className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all',
                        paymentMethod === opt.v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30')}>
                      <opt.icon className="h-4 w-4" />
                      <span className="text-center leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {paymentMethod !== e.payment_method && (e.status === 'approved' || e.status === 'paid') && (
                  <p className="mt-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg px-3 py-2">
                    Warning: changing the payment method on an approved expense may affect reconciliation records.
                  </p>
                )}
              </div>
              {/* Card selector for company card / refund */}
              {(paymentMethod === 'company_card' || paymentMethod === 'refund') && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-foreground">Card Used</label>
                  {cards.length > 0 ? (
                    <select value={selectedCardId} onChange={ev => {
                      setSelectedCardId(ev.target.value)
                      const card = cards.find((c: any) => c.id === ev.target.value)
                      setCardLast4(card ? card.last4 : '')
                    }} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                      <option value="">— Select card —</option>
                      {cards.map((c: any) => {
                        const name = c.user_profiles ? (c.user_profiles.display_name || c.user_profiles.full_name || c.card_holder || 'Unknown') : (c.card_holder || 'Unknown')
                        return <option key={c.id} value={c.id}>{name} · {c.card_type} ····{c.last4}</option>
                      })}
                    </select>
                  ) : (
                    <input value={cardLast4} onChange={ev => setCardLast4(ev.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4} placeholder="Last 4 digits" inputMode="numeric"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  )}
                </div>
              )}
              {/* Receipt */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Receipt</label>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={ev => ev.target.files?.[0] && handleFileUpload(ev.target.files[0])} />
                {receiptUrl ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-emerald-600 flex-1">Receipt attached</span>
                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                    <button type="button" onClick={() => setReceiptUrl('')} className="text-xs text-rose-500 hover:underline">Remove</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || scanning}
                    className="w-full rounded-xl border-2 border-dashed border-border p-3 text-xs text-muted-foreground hover:border-primary/50 transition-all">
                    {uploading ? 'Uploading...' : scanning ? 'Scanning receipt...' : '+ Upload receipt'}
                  </button>
                )}
              </div>
              {/* Receipt number */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Receipt / Invoice Number</label>
                <input name="receipt_number" value={editReceiptNumber} onChange={ev => setEditReceiptNumber(ev.target.value)}
                  placeholder="Auto-filled from receipt scan (optional)"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {/* VAT section */}
              <div className="space-y-3">
                {editIncludesVat ? (
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-violet-700 dark:text-violet-400">VAT Details</p>
                      <button type="button" onClick={() => setEditIncludesVat(false)}
                        className="text-[10px] text-muted-foreground hover:text-foreground underline">Remove</button>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">VAT Rate</p>
                      <div className="flex gap-2">
                        {[20, 5, 0].map(rate => (
                          <button type="button" key={rate} onClick={() => { setEditVatRate(rate); setEditCustomVatRate('') }}
                            className={cn('flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                              editVatRate === rate && !editCustomVatRate ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                            {rate}%
                          </button>
                        ))}
                        <input
                          type="number" placeholder="Other %" step="0.1" min="0" max="100"
                          value={editCustomVatRate}
                          onChange={ev => { setEditCustomVatRate(ev.target.value); if (ev.target.value) setEditVatRate(parseFloat(ev.target.value)) }}
                          className={cn('w-20 rounded-lg border px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/30',
                            editCustomVatRate ? 'border-primary bg-primary/5' : 'border-border bg-background')}
                        />
                      </div>
                    </div>
                    {editAmount && editVatRate > 0 && (() => {
                      const gross = parseFloat(editAmount)
                      if (!isNaN(gross) && gross > 0) {
                        const vatAmt = Math.round(gross * editVatRate / (100 + editVatRate) * 100) / 100
                        const netAmt = Math.round((gross - vatAmt) * 100) / 100
                        return (
                          <div className="rounded-lg bg-muted/40 px-3 py-2 grid grid-cols-3 gap-2 text-center">
                            <div><p className="text-[10px] text-muted-foreground">Gross</p><p className="text-xs font-bold">{formatCurrency(gross, e.currency)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Net</p><p className="text-xs font-bold">{formatCurrency(netAmt, e.currency)}</p></div>
                            <div><p className="text-[10px] text-violet-600">VAT</p><p className="text-xs font-bold text-violet-600">{formatCurrency(vatAmt, e.currency)}</p></div>
                          </div>
                        )
                      }
                      return null
                    })()}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">Supplier VAT Number (optional)</label>
                      <input name="vat_number" value={editVatNumber} onChange={ev => setEditVatNumber(ev.target.value)}
                        placeholder="e.g. GB123456789"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditIncludesVat(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline">
                    + Add VAT details manually
                  </button>
                )}
                {!editIncludesVat && editVatNumber && <input type="hidden" name="vat_number" value={editVatNumber} />}
                <input type="hidden" name="includes_vat" value={editIncludesVat ? 'true' : 'false'} />
                <input type="hidden" name="vat_rate" value={editVatRate} />
              </div>
            </div>
            <div className="p-5 border-t border-border flex gap-3">
              <button type="submit" disabled={saving}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setIsEditing(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Sub-tabs: Details / Comments / History */}
            <div className="flex gap-1 px-5 pt-3 border-b border-border">
              {([['details','Details',Receipt],['comments',`Comments${comments.length > 0 ? ` (${comments.length})` : ''}`,MessageSquare],['history',`History${auditLog.length > 0 ? ` (${auditLog.length})` : ''}`,History]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setActiveDetailTab(id as any)}
                  className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all',
                    activeDetailTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  <Icon className="h-3 w-3" />{label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[55vh]">
              {activeDetailTab === 'details' && (<>
                <div className="grid grid-cols-2 gap-3">
                  <InfoBlock label="Amount" value={formatCurrency(e.amount, e.currency)} highlight />
                  {e.currency !== 'GBP' && e.converted_gbp && <InfoBlock label="GBP Equivalent" value={formatCurrency(e.converted_gbp)} />}
                  <InfoBlock label="Date" value={formatDate(e.date)} />
                  <InfoBlock label="Merchant" value={e.merchant ?? '—'} />
                  <InfoBlock label="Category" value={e.expense_categories?.name ?? '—'} />
                  <InfoBlock label="Payment" value={e.payment_method === 'company_card' ? `Company Card${e.company_cards ? ` ····${e.company_cards.last4}` : ''}` : e.payment_method === 'company_cash' ? 'Cash Withdrawal (Company)' : e.payment_method === 'personal_card' ? 'Personal Card (Claim)' : 'Cash (Claim)'} />
                  {e.departments && <InfoBlock label="Department" value={e.departments.name} />}
                  {e.expense_categories?.gl_code && <InfoBlock label="GL Code" value={e.expense_categories.gl_code} />}
                  {e.receipt_number && <InfoBlock label="Receipt / Invoice No." value={e.receipt_number} />}
                  {e.vat_number && <InfoBlock label="Supplier VAT No." value={e.vat_number} />}
                  {e.vat_amount > 0 && <InfoBlock label="VAT Amount" value={formatCurrency(e.vat_amount, e.currency)} />}
                  {e.status === 'paid' && e.reimbursed_via && (
                    <InfoBlock label="Reimbursed" value={`${e.reimbursed_via}${e.reimbursement_ref ? ` · ${e.reimbursement_ref}` : ''}${e.reimbursed_at ? ` · ${formatDate(e.reimbursed_at)}` : ''}`} />
                  )}
                  <div className="col-span-2"><InfoBlock label="Description" value={e.description} /></div>
                </div>
                {e.bank_adjustment != null && Math.abs(e.bank_adjustment) > 0.50 && (
                  <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Bank Statement Discrepancy</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Bank shows {formatCurrency(e.actual_bank_amount ?? 0)} · Expense {formatCurrency(e.converted_gbp ?? e.amount)} · Difference: {e.bank_adjustment > 0 ? '+' : ''}{formatCurrency(e.bank_adjustment)}
                      </p>
                      {e.bank_adjustment_note && <p className="text-xs text-amber-600 mt-0.5 italic">Note: {e.bank_adjustment_note}</p>}
                    </div>
                  </div>
                )}
                {e.receipt_url && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2">Receipt</p>
                    {e.receipt_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                      <img src={e.receipt_url} alt="Receipt" className="w-full rounded-xl border border-border object-cover max-h-64" />
                    ) : (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-border p-3 hover:bg-muted text-sm text-blue-600">
                        <FileText className="h-4 w-4" /> View Receipt PDF <ExternalLink className="h-3 w-3 ml-auto" />
                      </a>
                    )}
                  </div>
                )}
                {e.expense_approvals?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2">Approvals</p>
                    <div className="space-y-2">
                      {e.expense_approvals.map((a: any) => (
                        <div key={a.id} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                          <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs',
                            a.decision === 'approved' ? 'bg-emerald-500' : a.decision === 'rejected' ? 'bg-rose-500' : 'bg-amber-500')}>
                            {a.decision === 'approved' ? '✓' : a.decision === 'rejected' ? '✗' : '?'}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{a.user_profiles?.full_name ?? 'Approver'}</p>
                            <p className="text-xs text-muted-foreground">{a.note ?? a.decision} {a.decided_at ? `· ${formatDate(a.decided_at)}` : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>)}

              {activeDetailTab === 'comments' && (
                <div className="space-y-3">
                  {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Ask a question or leave a note.</p>}
                  {comments.map((c: any) => (
                    <div key={c.id} className="rounded-xl bg-muted/40 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-foreground">{c.user_profiles?.display_name ?? c.user_profiles?.full_name ?? 'User'}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <p className="text-xs text-foreground">{c.message}</p>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <input value={newComment} onChange={ev => setNewComment(ev.target.value)}
                      onKeyDown={ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); handlePostComment() } }}
                      placeholder="Add a comment..."
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <button onClick={handlePostComment} disabled={postingComment || !newComment.trim()}
                      className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
                      {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
                    </button>
                  </div>
                </div>
              )}

              {activeDetailTab === 'history' && (
                <div className="space-y-2">
                  {auditLog.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No audit history available.</p>}
                  {auditLog.map((log: any) => (
                    <div key={log.id} className="rounded-xl bg-muted/40 p-3 flex items-start gap-3">
                      <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white text-[10px]',
                        log.action === 'created' ? 'bg-blue-500' : log.action === 'approved' ? 'bg-emerald-500' : log.action === 'rejected' ? 'bg-rose-500' : log.action === 'paid' ? 'bg-violet-500' : 'bg-slate-400')}>
                        {log.action === 'created' ? '+' : log.action === 'approved' ? '✓' : log.action === 'rejected' ? '✗' : log.action === 'paid' ? '£' : '~'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground capitalize">{log.action}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{log.user_profiles?.display_name ?? log.user_profiles?.full_name ?? 'System'}</p>
                        {log.changes && Object.keys(log.changes).length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {Object.entries(log.changes).slice(0, 4).map(([field, change]: [string, any]) => (
                              <p key={field} className="text-[10px] text-muted-foreground">
                                <span className="font-semibold">{field}</span>: {String(change.from ?? '—')} → {String(change.to ?? '—')}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-border flex gap-3">
              {e.status === 'approved' && (e.payment_method === 'personal_card' || e.payment_method === 'personal_cash') && (
                <a href={`/api/expenses/claim-pdf/${e.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                  <Download className="h-4 w-4" /> Download Claim Sheet
                </a>
              )}
              <button onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors">
                Edit
              </button>
              <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted transition-colors">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InfoBlock({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground font-semibold mb-0.5">{label}</p>
      <p className={cn('text-sm', highlight ? 'font-black text-foreground' : 'text-foreground')}>{value}</p>
    </div>
  )
}

// ============================================================
// PURCHASE REQUESTS TAB
// ============================================================

function PurchaseRequestsTab({ userId, allUsers }: { userId: string; allUsers: any[] }) {
  const [prs, setPrs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getMyPurchaseRequests()
    setPrs(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalSubmitted = prs.filter(p => p.status === 'submitted').length
  const totalApproved = prs.filter(p => p.status === 'approved').length
  const totalGbp = prs.filter(p => ['approved', 'ordered'].includes(p.status))
    .reduce((s, p) => s + (p.converted_gbp ?? p.estimated_cost), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Pending Review" value={String(totalSubmitted)} icon={Clock} color="bg-gradient-to-br from-amber-500 to-amber-600" />
        <StatCard label="Approved" value={String(totalApproved)} icon={CheckCircle2} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
        <StatCard label="Approved Value" value={formatCurrency(totalGbp)} icon={DollarSign} color="bg-gradient-to-br from-blue-500 to-blue-600" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">My Purchase Requests</h2>
        <button onClick={() => setShowForm(true)}
          aria-label="Create new purchase request"
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" aria-hidden="true" /> New Request
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : prs.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No purchase requests" sub="Request approval to buy something for the company" />
      ) : (
        <div className="space-y-3">
          {prs.map(pr => <PrRow key={pr.id} pr={pr} onClick={() => setSelected(pr)} />)}
        </div>
      )}

      {showForm && <PrFormModal allUsers={allUsers} currentUserId={userId} onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); load() }} />}
      {selected && <PrDetailModal pr={selected} onClose={() => setSelected(null)} onRefresh={load} allUsers={allUsers} currentUserId={userId} />}
    </div>
  )
}

function PrRow({ pr, onClick }: { pr: any; onClick: () => void }) {
  const urgency = URGENCY_CONFIG[pr.urgency] ?? URGENCY_CONFIG.medium
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
          <ShoppingCart className="h-4 w-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground text-sm">{pr.item_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('flex items-center gap-1 text-xs font-semibold', urgency.color)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', urgency.dot)} />{urgency.label}
                </span>
                {pr.supplier && <span className="text-xs text-muted-foreground">· {pr.supplier}</span>}
                <span className="text-xs text-muted-foreground">· {formatDate(pr.submitted_at)}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-foreground">{formatCurrency(pr.estimated_cost, pr.currency)}</p>
              <StatusBadge status={pr.status} />
            </div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </button>
  )
}

function PrFormModal({ onClose, onSuccess, allUsers, currentUserId }: { onClose: () => void; onSuccess: () => void; allUsers: any[]; currentUserId: string }) {
  const [isPending, startTransition] = useTransition()
  const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAttach = async (file: File) => {
    setUploading(true)
    try {
      const { uploadUrl, path, success } = await getReceiptUploadUrl(file.name, file.type) as any
      if (!success) throw new Error('Upload failed')
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      const publicUrl = await getPublicReceiptUrl(path)
      setAttachments(a => [...a, { url: publicUrl, name: file.name }])
    } catch (e: any) { toast.error(e.message) }
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    attachments.forEach(a => { fd.append('attachment_urls[]', a.url); fd.append('attachment_names[]', a.name) })
    startTransition(async () => {
      const result = await submitPurchaseRequest(fd)
      if (result.success) { toast.success('Purchase request submitted'); onSuccess() }
      else toast.error(result.error ?? 'Failed to submit')
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">New Purchase Request</h3>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          <form id="pr-form" onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Item / Service *</label>
              <input required name="item_name" placeholder="What do you need?" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Description</label>
              <textarea name="description" rows={2} placeholder="More details..." className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Estimated Cost *</label>
                <input required name="estimated_cost" type="number" step="0.01" min="0.01" placeholder="0.00" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Currency</label>
                <select name="currency" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Urgency</label>
                <select name="urgency" defaultValue="medium" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Supplier (optional)</label>
                <input name="supplier" placeholder="Where to buy?" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Justification</label>
              <textarea name="justification" rows={2} placeholder="Why is this needed?" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-foreground">Attachments (quotes, screenshots)</label>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/80">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />} Attach
                </button>
                <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => e.target.files?.[0] && handleAttach(e.target.files[0])} />
              </div>
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-muted/40 p-2.5 mb-2">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs flex-1 truncate">{a.name}</span>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600"><ExternalLink className="h-3.5 w-3.5" /></a>
                  <button type="button" onClick={() => setAttachments(att => att.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </div>
              ))}
            </div>

            {/* Approver */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Send to Approver *</label>
              <select required name="direct_approver_id" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Select who should approve this</option>
                {allUsers.filter(u => u.id !== currentUserId).map(u => (
                  <option key={u.id} value={u.id}>{u.display_name ?? u.full_name ?? u.email}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">They will receive an email to review your request.</p>
            </div>
          </form>
        </div>
        <div className="p-5 border-t border-border flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
          <button type="submit" form="pr-form" disabled={isPending}
            className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PrDetailModal({ pr, onClose, onRefresh, allUsers, currentUserId }: {
  pr: any; onClose: () => void; onRefresh: () => void; allUsers: any[]; currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()
  const urgency = URGENCY_CONFIG[pr.urgency] ?? URGENCY_CONFIG.medium
  const submitter = allUsers.find((u: any) => u.id === pr.user_id)
  const approver = allUsers.find((u: any) => u.id === pr.direct_approver_id)
  const isOwner = pr.user_id === currentUserId
  const canCancel = isOwner && pr.status === 'submitted'
  const canDelete = isOwner && ['rejected', 'cancelled'].includes(pr.status)
  const canDownloadPdf = pr.status === 'approved'

  const handleCancel = () => {
    startTransition(async () => {
      const res = await cancelPurchaseRequest(pr.id)
      if (res.success) { toast.success('Request cancelled'); onRefresh(); onClose() }
      else toast.error(res.error ?? 'Failed to cancel')
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deletePurchaseRequest(pr.id)
      if (res.success) { toast.success('Request deleted'); onRefresh(); onClose() }
      else toast.error(res.error ?? 'Failed to delete')
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-foreground">{pr.item_name}</h3>
            <StatusBadge status={pr.status} />
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Key details grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Estimated Cost" value={`${pr.currency !== 'GBP' ? pr.currency + ' ' : ''}${formatCurrency(pr.estimated_cost, pr.currency)}`} highlight />
            {pr.currency !== 'GBP' && pr.converted_gbp && <InfoBlock label="GBP Equivalent" value={formatCurrency(pr.converted_gbp)} />}
            <InfoBlock label="Urgency" value={<span className={urgency.color}>{urgency.label}</span> as any} />
            <InfoBlock label="Submitted" value={formatDate(pr.submitted_at)} />
            {submitter && <InfoBlock label="Submitted By" value={submitter.display_name ?? submitter.full_name ?? submitter.email} />}
            {approver && <InfoBlock label="Sent To" value={approver.display_name ?? approver.full_name ?? approver.email} />}
            {pr.supplier && <InfoBlock label="Supplier" value={pr.supplier} />}
          </div>

          {/* Description / Justification */}
          {pr.description && (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground font-semibold mb-0.5">Description</p>
              <p className="text-sm text-foreground">{pr.description}</p>
            </div>
          )}
          {pr.justification && (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground font-semibold mb-0.5">Justification / Reason</p>
              <p className="text-sm text-foreground">{pr.justification}</p>
            </div>
          )}

          {/* Approver note / decision */}
          {pr.notes && (
            <div className={cn('rounded-xl p-3 border', pr.status === 'rejected' ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800')}>
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                {pr.status === 'rejected' ? 'Rejection Reason' : pr.status === 'approved' ? 'Approver Note' : 'Note from Approver'}
              </p>
              <p className="text-sm text-foreground">{pr.notes}</p>
            </div>
          )}

          {/* Approval history */}
          {pr.pr_approvals?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-foreground mb-2">Approval History</p>
              <div className="space-y-2">
                {pr.pr_approvals.map((a: any) => {
                  const decisionColor = a.decision === 'approved' ? 'text-emerald-600' : a.decision === 'rejected' ? 'text-rose-600' : 'text-amber-600'
                  return (
                    <div key={a.id} className="rounded-xl border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className={cn('text-xs font-bold capitalize', decisionColor)}>{a.decision}</span>
                        {a.decided_at && <span className="text-xs text-muted-foreground">{formatDate(a.decided_at)}</span>}
                      </div>
                      {a.note && <p className="text-xs text-muted-foreground mt-1 italic">&quot;{a.note}&quot;</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Attachments */}
          {pr.pr_attachments?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-foreground mb-2">Attachments</p>
              {pr.pr_attachments.map((a: any) => (
                <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-border p-3 hover:bg-muted text-sm text-blue-600 mb-2">
                  <FileText className="h-4 w-4" />{a.file_name}<ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex gap-3 flex-wrap">
          {canDownloadPdf && (
            <a href={`/api/expenses/purchase-request-pdf/${pr.id}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              <Download className="h-4 w-4" /> Download PDF
            </a>
          )}
          {canCancel && (
            <button onClick={handleCancel} disabled={isPending}
              className="rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 px-4 py-2.5 text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50 flex items-center gap-2">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Cancel Request
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} disabled={isPending}
              className="rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 px-4 py-2.5 text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50 flex items-center gap-2">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete Request
            </button>
          )}
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">Close</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MONTHLY SHEET TAB
// ============================================================

type SheetView = 'list' | 'person' | 'summary'

function MonthlySheetTab({ canSeeAll, isAdmin, isDirector }: { canSeeAll: boolean; isAdmin: boolean; isDirector: boolean }) {
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [view, setView] = useState<SheetView>('list')
  const [expenses, setExpenses] = useState<any[]>([])
  const [statements, setStatements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [uploadingStatement, setUploadingStatement] = useState(false)
  const [sendingEmailStmtId, setSendingEmailStmtId] = useState<string | null>(null)
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set())
  const [adjustModal, setAdjustModal] = useState<any | null>(null)
  const [matchingTxId, setMatchingTxId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const stmtFileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [expData, stmtData] = await Promise.all([
      getAllExpenses(month),
      canSeeAll ? getBankStatements(month) : Promise.resolve([]),
    ])
    setExpenses(expData)
    setStatements(stmtData)
    setLoading(false)
  }, [month, canSeeAll])

  useEffect(() => { load() }, [load])

  // Memoize expensive filtering
  const filtered = useMemo(() => expenses.filter(e =>
    !filter ||
    e.user_profiles?.full_name?.toLowerCase().includes(filter.toLowerCase()) ||
    e.description?.toLowerCase().includes(filter.toLowerCase()) ||
    e.merchant?.toLowerCase().includes(filter.toLowerCase())
  ), [expenses, filter])

  // Memoize expensive calculations - single pass through data
  const { totalGbp, totalVat, totalNet, claimsTotal } = useMemo(() => {
    let gbp = 0, vat = 0, net = 0, claims = 0
    filtered.forEach(e => {
      const gross = e.converted_gbp ?? e.amount
      const sign = e.payment_method === 'refund' ? -1 : 1
      gbp += gross * sign
      vat += (e.vat_amount ?? 0) * sign
      net += (e.net_amount ?? gross) * sign
      if (['personal_card', 'personal_cash'].includes(e.payment_method)) {
        claims += gross
      }
    })
    return { totalGbp: gbp, totalVat: vat, totalNet: net, claimsTotal: claims }
  }, [filtered])

  // Enhanced accounting CSV
  const exportCsv = () => {
    const rows = [
      ['Date', 'Employee', 'Merchant', 'Description', 'Category', 'Payment', 'Currency', 'Amount', 'GBP (Gross)', 'Net (ex VAT)', 'VAT Amount', 'VAT Rate %', 'VAT Number', 'Receipt No.', 'Status', 'Bank Amount', 'Bank Adj.', 'Receipt URL'],
      ...filtered.map(e => {
        const sign  = e.payment_method === 'refund' ? -1 : 1
        const gross = (e.converted_gbp ?? e.amount) * sign
        const net   = (e.net_amount ?? (e.converted_gbp ?? e.amount)) * sign
        return [
          e.date, e.user_profiles?.full_name ?? '', e.merchant ?? '', e.description,
          e.expense_categories?.name ?? '', e.payment_method, e.currency,
          e.amount * sign, gross, net,
          e.vat_amount != null ? e.vat_amount * sign : '', e.vat_rate ? `${e.vat_rate}%` : '', e.vat_number ?? '',
          e.receipt_number ?? '', e.status,
          e.actual_bank_amount ?? '', e.bank_adjustment ?? '',
          e.receipt_url ?? '',
        ]
      }),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `expenses-accounting-${month}.csv`
    a.click()
  }

  // Reconciliation Excel export
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const exportXlsx = async () => {
    setExportingXlsx(true)
    try {
      const res = await fetch(`/api/expenses/export-reconciliation?month=${month}`)
      if (!res.ok) { toast.error('Failed to generate Excel report'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `reconciliation-${month}.xlsx`
      a.click()
      toast.success('Reconciliation report downloaded')
    } catch {
      toast.error('Download failed')
    } finally {
      setExportingXlsx(false)
    }
  }

  // Bank statement upload
  const handleStatementUpload = async (file: File) => {
    setUploadingStatement(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('month', month)
      const res = await fetch('/api/expenses/bank-statement', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        const who = data.cardholderName ? ` · ${data.cardholderName}'s card` : ''
        toast.success(`AI matched ${data.matched} of ${data.total} transactions${who}`)
        load()
      } else {
        toast.error(data.error ?? 'Failed to process statement')
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Upload failed')
    }
    setUploadingStatement(false)
  }

  const handleDeleteStatement = (id: string) => {
    startTransition(async () => {
      const res = await deleteBankStatement(id) as any
      if (!res.success) { toast.error(res.error ?? 'Failed to delete statement'); return }
      toast.success('Statement removed')
      load()
    })
  }

  const handleSendMissingReceiptEmail = async (stmtId: string) => {
    setSendingEmailStmtId(stmtId)
    try {
      const res = await fetch('/api/expenses/bank-statement/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId: stmtId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Email sent to ${data.sentTo} — ${data.count} missing receipt${data.count !== 1 ? 's' : ''}`)
      } else {
        toast.error(data.error ?? 'Failed to send email')
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to send email')
    }
    setSendingEmailStmtId(null)
  }

  const handleAdjust = (amount: number, note: string) => {
    if (!adjustModal) return
    startTransition(async () => {
      const res = await recordBankAdjustment(adjustModal.id, amount, note) as any
      if (res.success) { toast.success('Bank amount recorded'); setAdjustModal(null); load() }
      else toast.error(res.error)
    })
  }

  const togglePerson = (name: string) => {
    setExpandedPersons(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const handleUnlinkTx = (txId: string) => {
    startTransition(async () => {
      const res = await updateTransactionMatch(txId, null, 'unmatched') as any
      if (!res.success) { toast.error(res.error ?? 'Failed to unlink transaction'); return }
      load()
    })
  }
  const handleAcceptTx = (txId: string, expenseId: string) => {
    startTransition(async () => {
      const res = await updateTransactionMatch(txId, expenseId, 'matched') as any
      if (!res.success) { toast.error(res.error ?? 'Failed to match transaction'); return }
      load()
    })
  }
  const handleMarkReviewedTx = (txId: string) => {
    startTransition(async () => {
      const res = await updateTransactionMatch(txId, null, 'ignored') as any
      if (!res.success) { toast.error(res.error ?? 'Failed to update transaction'); return }
      toast.success('Transaction marked as reviewed')
      load()
    })
  }
  const handleMarkReconciled = (stmtId: string) => {
    startTransition(async () => {
      const res = await markBankStatementReconciled(stmtId) as any
      if (res.success) { toast.success('Month marked as reconciled ✓'); load() }
      else toast.error(res.error)
    })
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" value={month} onChange={e => { setMonth(e.target.value); setFilter('') }}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />

        {/* View switcher */}
        <div className="flex rounded-xl border border-border overflow-hidden shrink-0">
          {([
            { v: 'list', label: 'Transactions' },
            { v: 'person', label: 'By Person' },
            { v: 'summary', label: 'Accounting' },
          ] as { v: SheetView; label: string }[]).map(({ v, label }) => (
            <button key={v} onClick={() => setView(v)}
              className={cn('px-3 py-2 text-xs font-semibold transition-colors',
                view === v ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}>
              {label}
            </button>
          ))}
        </div>

        {view === 'list' && (
          <div className="relative flex-1 min-w-40 max-w-sm">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by person, merchant..."
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        )}

        <button onClick={load} className="rounded-xl border border-border p-2 hover:bg-muted">
          <RefreshCw className="h-4 w-4" />
        </button>
        <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Download className="h-4 w-4" /> Export CSV
        </button>

        {canSeeAll && (
          <button
            onClick={exportXlsx}
            disabled={exportingXlsx}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {exportingXlsx ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            {exportingXlsx ? 'Generating...' : 'Export Reconciliation'}
          </button>
        )}

        {/* Bank statement upload — admin/accounts/director only */}
        {canSeeAll && (
          <>
            <button onClick={() => stmtFileRef.current?.click()} disabled={uploadingStatement}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
              {uploadingStatement
                ? <><Loader2 className="h-4 w-4 animate-spin" /> AI Parsing...</>
                : <><FileSpreadsheet className="h-4 w-4" /> Upload Statement</>}
            </button>
            <input ref={stmtFileRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleStatementUpload(e.target.files[0]) }} />
          </>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Gross" value={formatCurrency(totalGbp)} icon={DollarSign} color="bg-gradient-to-br from-blue-500 to-blue-600" />
        <StatCard label="Net (ex VAT)" value={formatCurrency(totalNet)} icon={Receipt} color="bg-gradient-to-br from-slate-500 to-slate-600" />
        <StatCard label="Total VAT" value={formatCurrency(totalVat)} sub="reclaimable" icon={FileText} color="bg-gradient-to-br from-violet-500 to-violet-600" />
        <StatCard label="Claims to Pay" value={formatCurrency(claimsTotal)} sub="personal card / cash" icon={Wallet} color="bg-gradient-to-br from-amber-500 to-amber-600" />
      </div>

      {/* Bank statement reconciliation */}
      {canSeeAll && statements.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-foreground">Bank Statement Reconciliation</h3>
            <span className="ml-auto text-xs text-muted-foreground">{statements.length} statement{statements.length > 1 ? 's' : ''} for {month}</span>
          </div>
          {statements.map((stmt: any) => {
            const debits = (stmt.bank_statement_transactions ?? []).filter((t: any) => t.type === 'debit')
            const unmatchedDebits = debits.filter((t: any) => t.match_status === 'unmatched').length
            const reconciledBy = stmt.user_profiles?.display_name ?? stmt.user_profiles?.full_name ?? 'unknown'
            return (
              <div key={stmt.id} className="rounded-xl bg-card border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{stmt.bank_name || 'Bank Statement'}</p>
                    <p className="text-xs text-muted-foreground">
                      {stmt.matched_count} of {stmt.total_transactions} debits matched
                      {unmatchedDebits > 0 && ` · ${unmatchedDebits} need attention`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {stmt.reconciled_at ? (
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        ✓ Reconciled
                      </span>
                    ) : unmatchedDebits === 0 && stmt.total_transactions > 0 ? (
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">All Matched</span>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                        {unmatchedDebits} Issues
                      </span>
                    )}
                    {stmt.file_url && (
                      <a href={stmt.file_url} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg p-1.5 hover:bg-muted text-blue-600"><Eye className="h-3.5 w-3.5" /></a>
                    )}
                    <button
                      onClick={() => handleSendMissingReceiptEmail(stmt.id)}
                      disabled={sendingEmailStmtId === stmt.id}
                      title="Send missing receipt email to cardholder"
                      className="rounded-lg p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 disabled:opacity-50">
                      {sendingEmailStmtId === stmt.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Mail className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => handleDeleteStatement(stmt.id)} disabled={isPending}
                      className="rounded-lg p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {stmt.bank_statement_transactions?.length > 0 && (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Date</th>
                          <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Description</th>
                          <th className="text-right py-1.5 pr-3 font-semibold text-muted-foreground">Amount</th>
                          <th className="text-left py-1.5 font-semibold text-muted-foreground">Status / Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stmt.bank_statement_transactions.map((tx: any) => (
                          <tr key={tx.id} className="border-b border-border/30">
                            <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{tx.transaction_date}</td>
                            <td className="py-1.5 pr-3 text-foreground max-w-48 truncate">{tx.description}</td>
                            <td className={cn('py-1.5 pr-3 text-right font-semibold whitespace-nowrap',
                              tx.type === 'credit' ? 'text-emerald-600' : 'text-foreground')}>
                              {tx.type === 'credit' ? '+' : ''}{formatCurrency(tx.amount)}
                            </td>
                            <td className="py-1.5">
                              {tx.type === 'credit' ? (
                                <span className="text-muted-foreground">Credit</span>
                              ) : tx.match_status === 'matched' ? (
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Matched</span>
                                  <button onClick={() => handleUnlinkTx(tx.id)} disabled={isPending}
                                    className="text-[10px] text-rose-500 hover:underline font-semibold">Unlink</button>
                                </div>
                              ) : tx.match_status === 'partial' ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="h-3 w-3" /> Suggested</span>
                                  <button onClick={() => handleAcceptTx(tx.id, tx.matched_expense_id)} disabled={isPending}
                                    className="text-[10px] text-emerald-600 hover:underline font-semibold">Accept</button>
                                  <button onClick={() => handleMarkReviewedTx(tx.id)} disabled={isPending}
                                    className="text-[10px] text-slate-500 hover:underline">Skip</button>
                                </div>
                              ) : tx.match_status === 'ignored' ? (
                                <span className="text-muted-foreground text-[10px] italic">Reviewed — no expense</span>
                              ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="flex items-center gap-1 text-rose-500"><AlertTriangle className="h-3 w-3" /> No match</span>
                                  <button onClick={() => handleMarkReviewedTx(tx.id)} disabled={isPending}
                                    className="text-[10px] text-slate-500 hover:underline">Mark Reviewed</button>
                                  <button onClick={() => setMatchingTxId(tx.id)} disabled={isPending}
                                    className="text-[10px] text-blue-600 hover:underline font-semibold">Find Expense</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Sign-off */}
                <div className="mt-3">
                  {stmt.reconciled_at ? (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 px-3 py-2 flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <p className="text-xs text-emerald-700">Reconciled by {reconciledBy} on {formatDate(stmt.reconciled_at)}</p>
                    </div>
                  ) : unmatchedDebits === 0 && stmt.total_transactions > 0 ? (
                    <button onClick={() => handleMarkReconciled(stmt.id)} disabled={isPending}
                      className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Month as Reconciled
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      Resolve {unmatchedDebits} unmatched transaction{unmatchedDebits !== 1 ? 's' : ''} to sign off
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* Find Expense modal */}
      {matchingTxId && (
        <FindExpenseModal
          expenses={expenses}
          onSelect={(expId) => {
            startTransition(async () => {
              await updateTransactionMatch(matchingTxId, expId, 'matched')
              setMatchingTxId(null)
              toast.success('Transaction linked to expense')
              load()
            })
          }}
          onClose={() => setMatchingTxId(null)}
        />
      )}

      {/* Main content */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 && view !== 'summary' ? (
        <EmptyState icon={Calendar} title="No expenses this month" sub="Expenses will appear here once recorded" />
      ) : view === 'list' ? (
        <MonthlyListView expenses={filtered} onAdjust={canSeeAll ? (e: any) => setAdjustModal(e) : undefined} />
      ) : view === 'person' ? (
        <MonthlyPersonView expenses={filtered} expandedPersons={expandedPersons} toggle={togglePerson} />
      ) : (
        <MonthlyAccountingView expenses={filtered} statements={statements} />
      )}

      {/* Bank adjustment modal */}
      {adjustModal && (
        <BankAdjustmentModal expense={adjustModal} onSave={handleAdjust} onClose={() => setAdjustModal(null)} isPending={isPending} />
      )}
    </div>
  )
}

// ── Transaction list view ─────────────────────────────────────

// ── Find Expense Modal (for manual bank transaction matching) ──

function FindExpenseModal({ expenses, onSelect, onClose }: { expenses: any[]; onSelect: (expId: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const results = expenses.filter(e =>
    !q || e.description?.toLowerCase().includes(q.toLowerCase()) ||
    e.merchant?.toLowerCase().includes(q.toLowerCase()) ||
    String(e.amount).includes(q)
  ).slice(0, 20)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Link to Expense</h3>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus
            placeholder="Search by description, merchant, or amount…"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3" />
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No expenses found</p>
            ) : results.map((e: any) => (
              <button key={e.id} onClick={() => onSelect(e.id)}
                className="w-full text-left rounded-xl border border-border p-3 hover:border-primary/40 hover:bg-muted/30 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{e.description}</p>
                    <p className="text-[11px] text-muted-foreground">{e.date} · {e.merchant ?? ''} · {e.user_profiles?.display_name ?? e.user_profiles?.full_name ?? ''}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground ml-3">{formatCurrency(e.converted_gbp ?? e.amount)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MonthlyListView({ expenses, onAdjust }: { expenses: any[]; onAdjust?: (e: any) => void }) {
  const totalGbp = expenses.reduce((s, e) => s + (e.converted_gbp ?? e.amount), 0)
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground whitespace-nowrap">Date</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground">Employee</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground">Description</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground">Category</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground">Payment</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground">Card</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-muted-foreground">Gross</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-muted-foreground">Net</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-muted-foreground">VAT</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground">Rcpt No.</th>
              <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground">Status</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-muted-foreground">Bank £</th>
              <th className="px-3 py-3 text-xs font-bold text-muted-foreground">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e, i) => {
              const isRefund = e.payment_method === 'refund'
              const sign = isRefund ? -1 : 1
              const gross = (e.converted_gbp ?? e.amount) * sign
              const net   = (e.net_amount ?? (e.converted_gbp ?? e.amount)) * sign
              const vat   = (e.vat_amount ?? 0) * sign
              const hasAdj = e.bank_adjustment && Math.abs(e.bank_adjustment) > 0.001
              return (
                <tr key={e.id} className={cn('border-b border-border transition-colors hover:bg-muted/20', i % 2 !== 0 && 'bg-muted/10', isRefund && 'bg-emerald-50/40 dark:bg-emerald-950/10')}>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-foreground text-xs whitespace-nowrap">{e.user_profiles?.full_name ?? '—'}</p>
                  </td>
                  <td className="px-3 py-2.5 max-w-48">
                    <p className="text-xs text-foreground truncate">{e.description}</p>
                    {e.merchant && <p className="text-xs text-muted-foreground truncate">{e.merchant}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs" style={{ color: e.expense_categories?.color ?? '#64748b' }}>
                      {e.expense_categories?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs font-semibold',
                      e.payment_method === 'personal_card' || e.payment_method === 'personal_cash' ? 'text-amber-600' :
                      isRefund ? 'text-emerald-600' : 'text-muted-foreground')}>
                      {e.payment_method === 'company_card' ? 'Card' :
                       e.payment_method === 'personal_card' ? 'Personal' :
                       e.payment_method === 'personal_cash' ? 'Cash' :
                       isRefund ? 'Credit' : 'Cash'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {e.company_cards
                      ? `${e.company_cards.label ?? e.company_cards.card_holder ?? ''} ····${e.company_cards.last4}`
                      : '—'}
                  </td>
                  <td className={cn('px-3 py-2.5 text-right font-black text-xs whitespace-nowrap', isRefund && 'text-emerald-600')}>{isRefund ? '-' : ''}{formatCurrency(Math.abs(gross))}</td>
                  <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap text-muted-foreground">{vat !== 0 ? formatCurrency(net) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                    {vat > 0 ? (
                      <span className="text-violet-600 font-semibold">{formatCurrency(vat)}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.receipt_number ?? '—'}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={e.status} /></td>
                  <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                    {e.actual_bank_amount ? (
                      <button onClick={() => onAdjust?.(e)} className="text-right">
                        <p className="font-semibold">{formatCurrency(e.actual_bank_amount)}</p>
                        {hasAdj && (
                          <p className={cn('text-[10px]', e.bank_adjustment > 0 ? 'text-rose-500' : 'text-emerald-500')}>
                            {e.bank_adjustment > 0 ? '+' : ''}{formatCurrency(e.bank_adjustment)}
                          </p>
                        )}
                      </button>
                    ) : onAdjust && (e.payment_method === 'company_card' || e.payment_method === 'refund') ? (
                      <button onClick={() => onAdjust(e)} className="text-xs text-blue-500 hover:underline">Set</button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.receipt_url ? (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 text-xs hover:underline">
                        <Eye className="h-3 w-3" />
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t border-border">
              <td colSpan={6} className="px-3 py-3 text-xs font-bold text-foreground">Total ({expenses.length} rows)</td>
              <td className="px-3 py-3 text-right text-sm font-black text-foreground whitespace-nowrap">
                {formatCurrency(expenses.reduce((s, e) => s + (e.payment_method === 'refund' ? -(e.converted_gbp ?? e.amount) : (e.converted_gbp ?? e.amount)), 0))}
              </td>
              <td className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                {formatCurrency(expenses.reduce((s, e) => s + (e.payment_method === 'refund' ? -(e.net_amount ?? (e.converted_gbp ?? e.amount)) : (e.net_amount ?? (e.converted_gbp ?? e.amount))), 0))}
              </td>
              <td className="px-3 py-3 text-right text-xs font-semibold text-violet-600 whitespace-nowrap">
                {formatCurrency(expenses.reduce((s, e) => s + (e.payment_method === 'refund' ? -(e.vat_amount ?? 0) : (e.vat_amount ?? 0)), 0))}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Per person view ───────────────────────────────────────────

function MonthlyPersonView({ expenses, expandedPersons, toggle }: {
  expenses: any[]; expandedPersons: Set<string>; toggle: (name: string) => void
}) {
  const byPerson = expenses.reduce((acc, e) => {
    const name = e.user_profiles?.full_name ?? 'Unknown'
    if (!acc[name]) acc[name] = { name, expenses: [], gross: 0, net: 0, vat: 0, claims: 0 }
    acc[name].expenses.push(e)
    const sign = e.payment_method === 'refund' ? -1 : 1
    acc[name].gross  += (e.converted_gbp ?? e.amount) * sign
    acc[name].net    += (e.net_amount ?? (e.converted_gbp ?? e.amount)) * sign
    acc[name].vat    += (e.vat_amount ?? 0) * sign
    if (e.payment_method === 'personal_card' || e.payment_method === 'personal_cash') {
      acc[name].claims += e.converted_gbp ?? e.amount
    }
    return acc
  }, {} as Record<string, { name: string; expenses: any[]; gross: number; net: number; vat: number; claims: number }>)

  const people = Object.values(byPerson).sort((a: any, b: any) => b.gross - a.gross)
  const grandGross: number = people.reduce((s: number, p: any) => s + (p.gross as number), 0)

  return (
    <div className="space-y-3">
      {people.map((person: any) => {
        const expanded = expandedPersons.has(person.name)
        return (
          <div key={person.name} className="rounded-2xl border border-border bg-card overflow-hidden">
            <button onClick={() => toggle(person.name)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors text-left">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-primary">{person.name.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground">{person.name}</p>
                <p className="text-xs text-muted-foreground">{person.expenses.length} transaction{person.expenses.length > 1 ? 's' : ''}</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="font-black text-foreground">{formatCurrency(person.gross)}</p>
                {person.vat > 0 && <p className="text-xs text-violet-600">VAT: {formatCurrency(person.vat)}</p>}
                {person.claims > 0 && <p className="text-xs text-amber-600">Claim: {formatCurrency(person.claims)}</p>}
              </div>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>
            {expanded && (
              <div className="border-t border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/20 border-b border-border/50">
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Description</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Category</th>
                        <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Gross</th>
                        <th className="text-right px-4 py-2 font-semibold text-muted-foreground">VAT</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {person.expenses.map((e: any) => (
                        <tr key={e.id} className="border-b border-border/30 hover:bg-muted/10">
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(e.date)}</td>
                          <td className="px-4 py-2 max-w-48">
                            <p className="truncate">{e.description}</p>
                            {e.merchant && <p className="text-muted-foreground truncate">{e.merchant}</p>}
                          </td>
                          <td className="px-4 py-2" style={{ color: e.expense_categories?.color ?? '#64748b' }}>
                            {e.expense_categories?.name ?? '—'}
                          </td>
                          <td className={cn('px-4 py-2 text-right font-semibold', e.payment_method === 'refund' && 'text-emerald-600')}>
                            {e.payment_method === 'refund' ? '-' : ''}{formatCurrency(e.converted_gbp ?? e.amount)}
                          </td>
                          <td className="px-4 py-2 text-right text-violet-600">{e.vat_amount ? formatCurrency(e.vat_amount) : '—'}</td>
                          <td className="px-4 py-2"><StatusBadge status={e.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/20">
                        <td colSpan={3} className="px-4 py-2 font-bold">Subtotal</td>
                        <td className="px-4 py-2 text-right font-black">{formatCurrency(person.gross)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-violet-600">{formatCurrency(person.vat)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Grand total */}
      <div className="rounded-2xl border border-border bg-primary/5 px-5 py-4 flex items-center justify-between">
        <p className="font-bold text-foreground">Grand Total — {people.length} employees</p>
        <p className="text-xl font-black text-foreground">{formatCurrency(grandGross)}</p>
      </div>
    </div>
  )
}

// ── Accounting summary view ───────────────────────────────────

function MonthlyAccountingView({ expenses, statements }: { expenses: any[]; statements: any[] }) {
  const grossTotal = expenses.reduce((s, e) => s + (e.payment_method === 'refund' ? -(e.converted_gbp ?? e.amount) : (e.converted_gbp ?? e.amount)), 0)
  const vatTotal   = expenses.reduce((s, e) => s + (e.payment_method === 'refund' ? -(e.vat_amount ?? 0) : (e.vat_amount ?? 0)), 0)
  const netTotal   = expenses.reduce((s, e) => s + (e.payment_method === 'refund' ? -(e.net_amount ?? (e.converted_gbp ?? e.amount)) : (e.net_amount ?? (e.converted_gbp ?? e.amount))), 0)

  // By category
  const byCategory = expenses.reduce((acc, e) => {
    const cat = e.expense_categories?.name ?? 'Uncategorised'
    const col = e.expense_categories?.color ?? '#64748b'
    if (!acc[cat]) acc[cat] = { name: cat, color: col, gross: 0, vat: 0, count: 0 }
    const sign = e.payment_method === 'refund' ? -1 : 1
    acc[cat].gross += (e.converted_gbp ?? e.amount) * sign
    acc[cat].vat   += (e.vat_amount ?? 0) * sign
    acc[cat].count++
    return acc
  }, {} as Record<string, any>)
  const catList = Object.values(byCategory).sort((a: any, b: any) => b.gross - a.gross)

  // By payment method — refunds are credits back to company card, so group them there as negative
  const byMethod: Record<string, number> = {}
  expenses.forEach(e => {
    const key  = e.payment_method === 'refund' ? 'company_card' : e.payment_method
    const sign = e.payment_method === 'refund' ? -1 : 1
    byMethod[key] = (byMethod[key] ?? 0) + (e.converted_gbp ?? e.amount) * sign
  })

  // Bank adjustments
  const adjustments = expenses.filter(e => e.bank_adjustment && Math.abs(e.bank_adjustment) > 0.001)
  const totalAdj    = adjustments.reduce((s, e) => s + (e.bank_adjustment ?? 0), 0)

  // Refunds
  const refunds = expenses.filter(e => e.payment_method === 'refund')

  const methodLabel: Record<string, string> = {
    company_card: 'Company Card', company_cash: 'Cash Withdrawal (Company)',
    personal_card: 'Personal Card (Claim)', personal_cash: 'Cash (Claim)',
  }

  return (
    <div className="space-y-6">
      {/* Grand totals */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Scale className="h-4 w-4" /> Grand Totals</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 p-4 text-center">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">GROSS</p>
            <p className="text-2xl font-black text-blue-900 dark:text-blue-200">{formatCurrency(grossTotal)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-4 text-center">
            <p className="text-xs font-semibold text-muted-foreground mb-1">NET (ex VAT)</p>
            <p className="text-2xl font-black text-foreground">{formatCurrency(netTotal)}</p>
          </div>
          <div className="rounded-xl bg-violet-50 dark:bg-violet-950/20 p-4 text-center">
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1">TOTAL VAT</p>
            <p className="text-2xl font-black text-violet-900 dark:text-violet-200">{formatCurrency(vatTotal)}</p>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 bg-muted/20">
          <h3 className="font-bold text-foreground text-sm">Spend by Category</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="text-left px-5 py-2.5 text-xs font-bold text-muted-foreground">Category</th>
              <th className="text-right px-5 py-2.5 text-xs font-bold text-muted-foreground">Count</th>
              <th className="text-right px-5 py-2.5 text-xs font-bold text-muted-foreground">Gross</th>
              <th className="text-right px-5 py-2.5 text-xs font-bold text-muted-foreground">VAT</th>
              <th className="text-right px-5 py-2.5 text-xs font-bold text-muted-foreground">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {catList.map((c: any) => (
              <tr key={c.name} className="border-b border-border/30 hover:bg-muted/10">
                <td className="px-5 py-2.5 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-sm text-foreground">{c.name}</span>
                </td>
                <td className="px-5 py-2.5 text-right text-muted-foreground">{c.count}</td>
                <td className="px-5 py-2.5 text-right font-semibold">{formatCurrency(c.gross)}</td>
                <td className="px-5 py-2.5 text-right text-violet-600">{c.vat > 0 ? formatCurrency(c.vat) : '—'}</td>
                <td className="px-5 py-2.5 text-right text-muted-foreground">
                  {grossTotal > 0 ? `${((c.gross / grossTotal) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/20 border-t border-border">
              <td className="px-5 py-3 font-bold text-xs">Total</td>
              <td className="px-5 py-3 text-right text-xs font-semibold">{expenses.length}</td>
              <td className="px-5 py-3 text-right font-black">{formatCurrency(grossTotal)}</td>
              <td className="px-5 py-3 text-right font-semibold text-violet-600">{formatCurrency(vatTotal)}</td>
              <td className="px-5 py-3 text-right text-xs text-muted-foreground">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment method split */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 bg-muted/20">
          <h3 className="font-bold text-foreground text-sm">By Payment Method</h3>
        </div>
        <div className="divide-y divide-border">
          {Object.entries(byMethod).map(([method, total]) => (
            <div key={method} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-foreground">{methodLabel[method] ?? method}</span>
              <span className="font-bold text-foreground">{formatCurrency(total as number)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bank adjustments */}
      {adjustments.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between">
            <h3 className="font-bold text-foreground text-sm">Bank Adjustments ({adjustments.length})</h3>
            <span className={cn('text-sm font-bold', totalAdj > 0 ? 'text-rose-600' : 'text-emerald-600')}>
              {totalAdj > 0 ? '+' : ''}{formatCurrency(totalAdj)}
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="text-left px-5 py-2 font-semibold text-muted-foreground">Date</th>
                <th className="text-left px-5 py-2 font-semibold text-muted-foreground">Description</th>
                <th className="text-right px-5 py-2 font-semibold text-muted-foreground">Expense £</th>
                <th className="text-right px-5 py-2 font-semibold text-muted-foreground">Bank £</th>
                <th className="text-right px-5 py-2 font-semibold text-muted-foreground">Difference</th>
                <th className="text-left px-5 py-2 font-semibold text-muted-foreground">Note</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((e: any) => (
                <tr key={e.id} className="border-b border-border/30">
                  <td className="px-5 py-2 text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="px-5 py-2">{e.description}</td>
                  <td className="px-5 py-2 text-right">{formatCurrency(e.converted_gbp ?? e.amount)}</td>
                  <td className="px-5 py-2 text-right font-semibold">{formatCurrency(e.actual_bank_amount)}</td>
                  <td className={cn('px-5 py-2 text-right font-semibold', e.bank_adjustment > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    {e.bank_adjustment > 0 ? '+' : ''}{formatCurrency(e.bank_adjustment)}
                  </td>
                  <td className="px-5 py-2 text-muted-foreground">{e.bank_adjustment_note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Refunds */}
      {refunds.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50 bg-emerald-50/50 dark:bg-emerald-950/20">
            <h3 className="font-bold text-foreground text-sm">Refunds / Returns ({refunds.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {refunds.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{e.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(e.date)}{e.merchant ? ` · ${e.merchant}` : ''}</p>
                </div>
                <p className="font-bold text-emerald-600">{formatCurrency(e.converted_gbp ?? e.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bank adjustment modal ─────────────────────────────────────

function BankAdjustmentModal({ expense: e, onSave, onClose, isPending }: {
  expense: any; onSave: (amount: number, note: string) => void; onClose: () => void; isPending: boolean
}) {
  const [amount, setAmount] = useState(String(e.actual_bank_amount ?? (e.converted_gbp ?? e.amount) ?? ''))
  const [note, setNote] = useState(e.bank_adjustment_note ?? '')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl p-6">
        <h3 className="text-base font-bold text-foreground mb-1">Record Actual Bank Amount</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {e.description} · {formatDate(e.date)}<br />
          Expense recorded as <strong>{formatCurrency(e.converted_gbp ?? e.amount)}</strong>
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">Actual amount on bank statement (GBP)</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">Note (e.g. FX fee, rounding)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        {parseFloat(amount) !== (e.converted_gbp ?? e.amount) && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 px-3 py-2 mb-4">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Difference: <strong>{formatCurrency(parseFloat(amount) - (e.converted_gbp ?? e.amount))}</strong>
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={() => onSave(parseFloat(amount), note)} disabled={isPending || !amount}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// APPROVALS TAB
// ============================================================

function ApprovalsTab() {
  const [data, setData] = useState<{ expenses: any[]; prs: any[] }>({ expenses: [], prs: [] })
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState<{ type: 'expense' | 'pr'; id: string; title: string; action: 'approve' | 'reject' } | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    const d = await getPendingApprovals()
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDecide = (note: string) => {
    if (!actionModal) return
    const decision = actionModal.action === 'approve' ? 'approved' : 'rejected'
    // Optimistically remove from list immediately
    setData(prev => ({
      expenses: prev.expenses.filter(e => e.id !== actionModal.id),
      prs: prev.prs.filter(p => p.id !== actionModal.id),
    }))
    setActionModal(null)
    startTransition(async () => {
      let result: { success: boolean; error?: string } | undefined
      if (actionModal.type === 'expense') {
        result = await updateExpenseStatus(actionModal.id, decision, note)
      } else {
        result = await updatePurchaseRequestStatus(actionModal.id, decision, note)
      }
      if (result && !result.success) {
        toast.error(result.error ?? 'Action failed — please try again')
        load() // reload to restore the item in the list
      } else {
        toast.success(decision === 'approved' ? 'Approved successfully' : 'Rejected')
        load()
      }
    })
  }

  const totalPending = data.expenses.length + data.prs.length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-foreground">Pending Approvals</h2>
        {totalPending > 0 && (
          <span className="rounded-full bg-rose-100 dark:bg-rose-950/30 px-2.5 py-0.5 text-xs font-bold text-rose-600">{totalPending} pending</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : totalPending === 0 ? (
        <EmptyState icon={CheckCircle2} title="All caught up!" sub="No pending approvals right now" />
      ) : (
        <div className="space-y-4">
          {/* Expense claims */}
          {data.expenses.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">Expense Claims ({data.expenses.length})</h3>
              <div className="space-y-3">
                {data.expenses.map(e => (
                  <div key={e.id} className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-card p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                        <Receipt className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-foreground text-sm">{e.user_profiles?.full_name ?? 'Employee'}</p>
                            <p className="text-xs text-muted-foreground">{e.description}</p>
                            <div className="flex gap-2 mt-1">
                              {e.merchant && <span className="text-xs text-muted-foreground">{e.merchant}</span>}
                              <span className="text-xs text-muted-foreground">· {formatDate(e.date)}</span>
                              {e.expense_type === 'claim' && <span className="text-xs font-semibold text-amber-600">· Reimbursement claim</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-foreground text-lg">{formatCurrency(e.amount, e.currency)}</p>
                            {e.currency !== 'GBP' && <p className="text-xs text-muted-foreground">{formatCurrency(e.converted_gbp ?? e.amount)}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {e.receipt_url && (
                            <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/80">
                              <Eye className="h-3 w-3" /> View Receipt
                            </a>
                          )}
                          <div className="ml-auto flex gap-2">
                            <button onClick={() => setActionModal({ type: 'expense', id: e.id, title: `${e.user_profiles?.full_name} — ${formatCurrency(e.amount, e.currency)}`, action: 'approve' })}
                              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 flex items-center gap-1.5">
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button onClick={() => setActionModal({ type: 'expense', id: e.id, title: `${e.user_profiles?.full_name} — ${formatCurrency(e.amount, e.currency)}`, action: 'reject' })}
                              className="rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 px-3 py-1.5 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5">
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purchase requests */}
          {data.prs.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">Purchase Requests ({data.prs.length})</h3>
              <div className="space-y-3">
                {data.prs.map(pr => {
                  const urgency = URGENCY_CONFIG[pr.urgency] ?? URGENCY_CONFIG.medium
                  return (
                    <div key={pr.id} className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-card p-4">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                          <ShoppingCart className="h-4 w-4 text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-foreground text-sm">{pr.user_profiles?.full_name ?? 'Employee'}</p>
                              <p className="text-sm text-foreground font-semibold">{pr.item_name}</p>
                              <div className="flex gap-2 mt-0.5">
                                <span className={cn('text-xs font-semibold', urgency.color)}>{urgency.label} urgency</span>
                                {pr.supplier && <span className="text-xs text-muted-foreground">· {pr.supplier}</span>}
                              </div>
                              {pr.justification && <p className="text-xs text-muted-foreground mt-1 italic">"{pr.justification}"</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-black text-foreground text-lg">{formatCurrency(pr.estimated_cost, pr.currency)}</p>
                              {pr.currency !== 'GBP' && <p className="text-xs text-muted-foreground">{formatCurrency(pr.converted_gbp ?? pr.estimated_cost)}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            {pr.pr_attachments?.length > 0 && (
                              <a href={pr.pr_attachments[0].file_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/80">
                                <Paperclip className="h-3 w-3" /> {pr.pr_attachments.length} attachment{pr.pr_attachments.length > 1 ? 's' : ''}
                              </a>
                            )}
                            <div className="ml-auto flex gap-2">
                              <button onClick={() => setActionModal({ type: 'pr', id: pr.id, title: `${pr.item_name} — ${pr.user_profiles?.full_name ?? ''}`, action: 'approve' })}
                                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button onClick={() => setActionModal({ type: 'pr', id: pr.id, title: `${pr.item_name} — ${pr.user_profiles?.full_name ?? ''}`, action: 'reject' })}
                                className="rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 px-3 py-1.5 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5">
                                <X className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decision modal */}
      {actionModal && <DecisionModal title={actionModal.title} action={actionModal.action} onDecide={handleDecide} onClose={() => setActionModal(null)} isPending={isPending} />}
    </div>
  )
}

function DecisionModal({ title, action, onDecide, onClose, isPending }: {
  title: string; action: 'approve' | 'reject'; onDecide: (note: string) => void; onClose: () => void; isPending: boolean
}) {
  const [note, setNote] = useState('')
  const isApprove = action === 'approve'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0', isApprove ? 'bg-emerald-100 dark:bg-emerald-950/40' : 'bg-rose-100 dark:bg-rose-950/40')}>
            {isApprove ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-rose-600" />}
          </div>
          <h3 className="text-base font-bold text-foreground">{isApprove ? 'Approve' : 'Reject'}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4 ml-11">{title}</p>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder={isApprove ? 'Add a note (optional)...' : 'Reason for rejection (optional)...'} rows={3}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} disabled={isPending} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50">Cancel</button>
          <button onClick={() => onDecide(note)} disabled={isPending}
            className={cn('flex-1 rounded-xl py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5',
              isApprove ? 'bg-emerald-600' : 'bg-rose-600')}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isApprove ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ANALYTICS TAB
// ============================================================

// UK financial year: starts 1 April. FY year = year April starts.
// Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar (next year)
function currentFYYear() {
  const now = new Date()
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1
}
function currentFYQuarter() {
  const m = new Date().getMonth() + 1
  if (m >= 4 && m <= 6) return 1
  if (m >= 7 && m <= 9) return 2
  if (m >= 10 && m <= 12) return 3
  return 4
}

function AnalyticsTab() {
  const now = new Date()
  const [analyticsMode, setAnalyticsMode] = useState<'monthly' | 'quarterly'>('quarterly')
  const [selectedYear, setSelectedYear]     = useState(currentFYYear())
  const [selectedQuarter, setSelectedQuarter] = useState(currentFYQuarter())
  const [selectedMonth, setSelectedMonth]   = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [directorData, setDirectorData] = useState<{ ytd: any[]; allStatus: any[]; vatTrend: any[] } | null>(null)

  // Available months (last 24)
  const availableMonths = (() => {
    const result = []
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      result.push({ value, label })
    }
    return result
  })()

  // Available FY years (last 3)
  const availableFYYears = (() => {
    const fy = currentFYYear()
    return [fy, fy - 1, fy - 2].map(y => ({ value: y, label: `FY ${y}/${String(y + 1).slice(-2)}` }))
  })()

  const quarterLabels = ['Apr – Jun', 'Jul – Sep', 'Oct – Dec', 'Jan – Mar']
  const fyLabel = availableFYYears.find(y => y.value === selectedYear)?.label ?? `FY ${selectedYear}`
  const periodLabel = analyticsMode === 'monthly'
    ? (availableMonths.find(m => m.value === selectedMonth)?.label ?? selectedMonth)
    : `Q${selectedQuarter} (${quarterLabels[selectedQuarter - 1]}) — ${fyLabel}`

  const load = useCallback(async () => {
    setLoading(true)
    let d: any[]
    if (analyticsMode === 'monthly') {
      const [yr, mo] = selectedMonth.split('-').map(Number)
      d = await getExpenseAnalyticsPeriod('monthly', yr, mo)
    } else {
      d = await getExpenseAnalyticsPeriod('quarterly', selectedYear, selectedQuarter)
    }
    setData(d)
    setLoading(false)
  }, [analyticsMode, selectedYear, selectedQuarter, selectedMonth])

  useEffect(() => { load() }, [load])

  // Monthly breakdown within period (for bar chart)
  const monthlyData = (() => {
    const map: Record<string, number> = {}
    data.forEach(e => {
      const m = e.date?.slice(0, 7)
      if (m) map[m] = (map[m] ?? 0) + (e.payment_method === 'refund' ? -(e.converted_gbp ?? e.amount) : (e.converted_gbp ?? e.amount))
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        total: Math.round((total as number) * 100) / 100,
      }))
  })()

  const byCategory = (() => {
    const map: Record<string, { name: string; total: number; color: string }> = {}
    data.forEach(e => {
      const cat = e.expense_categories?.name ?? 'Other'
      const col = e.expense_categories?.color ?? '#64748b'
      if (!map[cat]) map[cat] = { name: cat, total: 0, color: col }
      map[cat].total += e.payment_method === 'refund' ? -(e.converted_gbp ?? e.amount) : (e.converted_gbp ?? e.amount)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  const byPerson = (() => {
    const map: Record<string, { name: string; total: number }> = {}
    data.forEach(e => {
      const n = e.user_profiles?.display_name ?? e.user_profiles?.full_name ?? 'Unknown'
      if (!map[n]) map[n] = { name: n, total: 0 }
      map[n].total += e.payment_method === 'refund' ? -(e.converted_gbp ?? e.amount) : (e.converted_gbp ?? e.amount)
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10)
  })()

  const totalSpend   = data.reduce((s, e) => s + (e.payment_method === 'refund' ? -(e.converted_gbp ?? e.amount) : (e.converted_gbp ?? e.amount)), 0)
  const totalVat     = data.reduce((s, e) => s + (e.payment_method === 'refund' ? -(e.vat_amount ?? 0) : (e.vat_amount ?? 0)), 0)
  const claimsTotal  = data.filter(e => ['personal_card', 'personal_cash'].includes(e.payment_method))
                          .reduce((s, e) => s + (e.converted_gbp ?? e.amount), 0)

  // ── Director analytics computations ─────────────────────────
  const ytdTotal = (directorData?.ytd ?? []).reduce((s, e) => {
    const sign = e.payment_method === 'refund' ? -1 : 1
    return s + (e.converted_gbp ?? e.amount) * sign
  }, 0)
  const ytdCount = (directorData?.ytd ?? []).length
  const ytdAvg = ytdCount > 0 ? ytdTotal / ytdCount : 0

  const pendingTotal = (directorData?.allStatus ?? [])
    .filter((e: any) => e.status === 'submitted')
    .reduce((s: number, e: any) => s + (e.converted_gbp ?? e.amount), 0)
  const pendingCount = (directorData?.allStatus ?? []).filter((e: any) => e.status === 'submitted').length

  // Month vs last month — grouped by category
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`
  const monthVsLastData = (() => {
    const cats: Record<string, { category: string; thisMonth: number; lastMonth: number }> = {}
    for (const e of (directorData?.allStatus ?? [])) {
      const m = e.date?.slice(0, 7)
      if (m !== thisMonthKey && m !== lastMonthKey) continue
      const cat = 'Total Spend'
      if (!cats[cat]) cats[cat] = { category: cat, thisMonth: 0, lastMonth: 0 }
      const sign = e.payment_method === 'refund' ? -1 : 1
      const amt = (e.converted_gbp ?? e.amount) * sign
      if (m === thisMonthKey) cats[cat].thisMonth += amt
      else cats[cat].lastMonth += amt
    }
    // Also break down by payment method — refunds are credits back to company card
    const methods: Record<string, { category: string; thisMonth: number; lastMonth: number }> = {}
    for (const e of (directorData?.allStatus ?? [])) {
      const m = e.date?.slice(0, 7)
      if (m !== thisMonthKey && m !== lastMonthKey) continue
      const label = ({ company_card: 'Company Card', company_cash: 'Cash Out', personal_card: 'Personal Card', personal_cash: 'Cash Claim', refund: 'Company Card' } as any)[e.payment_method] ?? e.payment_method
      if (!methods[label]) methods[label] = { category: label, thisMonth: 0, lastMonth: 0 }
      const sign = e.payment_method === 'refund' ? -1 : 1
      const amt = (e.converted_gbp ?? e.amount) * sign
      if (m === thisMonthKey) methods[label].thisMonth += amt
      else methods[label].lastMonth += amt
    }
    return Object.values(methods).map(v => ({ ...v, thisMonth: Math.round(v.thisMonth * 100) / 100, lastMonth: Math.round(v.lastMonth * 100) / 100 }))
  })()

  const vatByMonthData = (() => {
    const map: Record<string, number> = {}
    for (const e of (directorData?.vatTrend ?? [])) {
      const m = e.date?.slice(0, 7)
      if (!m) continue
      const sign = e.payment_method === 'refund' ? -1 : 1
      map[m] = (map[m] ?? 0) + (e.vat_amount ?? 0) * sign
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([m, vat]) => ({
      month: new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      vat: Math.round((vat as number) * 100) / 100,
    }))
  })()

  const paymentMethodData = (() => {
    const map: Record<string, number> = {}
    for (const e of (directorData?.allStatus ?? [])) {
      const m = e.date?.slice(0, 7)
      if (m !== thisMonthKey) continue
      // Refunds are credits back to company card — group them there as negative
      const label = ({ company_card: 'Company Card', company_cash: 'Cash Out', personal_card: 'Personal Card', personal_cash: 'Cash Claim', refund: 'Company Card' } as any)[e.payment_method] ?? e.payment_method
      const sign = e.payment_method === 'refund' ? -1 : 1
      map[label] = (map[label] ?? 0) + (e.converted_gbp ?? e.amount) * sign
    }
    return Object.entries(map).filter(([, v]) => v > 0).map(([method, total]) => ({ method, total: Math.round((total as number) * 100) / 100 }))
  })()

  const top5Merchants = (() => {
    const map: Record<string, number> = {}
    for (const e of (directorData?.allStatus ?? [])) {
      if (!e.merchant) continue
      const sign = e.payment_method === 'refund' ? -1 : 1
      map[e.merchant] = (map[e.merchant] ?? 0) + (e.converted_gbp ?? e.amount) * sign
    }
    return Object.entries(map).filter(([, v]) => v > 0).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5).map(([merchant, total]) => ({ merchant, total: Math.round((total as number) * 100) / 100 }))
  })()

  const claimsOutstanding = (() => {
    const map: Record<string, { name: string; total: number; count: number }> = {}
    for (const e of (directorData?.allStatus ?? [])) {
      if (e.status !== 'submitted' || !['personal_card', 'personal_cash'].includes(e.payment_method)) continue
      const n = e.user_profiles?.display_name ?? e.user_profiles?.full_name ?? 'Unknown'
      if (!map[n]) map[n] = { name: n, total: 0, count: 0 }
      map[n].total += e.converted_gbp ?? e.amount
      map[n].count++
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  const spendByStatusData = (() => {
    const map: Record<string, { month: string; approved: number; pending: number; paid: number }> = {}
    for (const e of (directorData?.allStatus ?? [])) {
      const m = e.date?.slice(0, 7)
      if (!m) continue
      if (!map[m]) map[m] = { month: new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), approved: 0, pending: 0, paid: 0 }
      const sign = e.payment_method === 'refund' ? -1 : 1
      const amt = (e.converted_gbp ?? e.amount) * sign
      if (e.status === 'approved') map[m].approved += amt
      else if (e.status === 'submitted') map[m].pending += amt
      else if (e.status === 'paid') map[m].paid += amt
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  })()

  return (
    <div className="space-y-6">
      {/* Mode + period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-border overflow-hidden shrink-0">
          {([['monthly', 'Monthly'], ['quarterly', 'By Quarter']] as [string, string][]).map(([m, label]) => (
            <button key={m} onClick={() => setAnalyticsMode(m as any)}
              className={cn('px-4 py-2 text-sm font-semibold transition-colors',
                analyticsMode === m ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}>
              {label}
            </button>
          ))}
        </div>

        {analyticsMode === 'monthly' ? (
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
            {availableMonths.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {availableFYYears.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
            <div className="flex rounded-xl border border-border overflow-hidden">
              {[1, 2, 3, 4].map(q => (
                <button key={q} onClick={() => setSelectedQuarter(q)}
                  className={cn('px-3 py-2 text-sm font-semibold transition-colors',
                    selectedQuarter === q ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}>
                  Q{q}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={load} className="rounded-xl border border-border p-2 hover:bg-muted">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm text-muted-foreground">{periodLabel}</p>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon={BarChart3} title="No data for this period" sub="Approve some expenses to see analytics" />
      ) : (
        <>
          {/* KPIs — period */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Gross" value={formatCurrency(totalSpend)} icon={TrendingUp} color="bg-gradient-to-br from-blue-500 to-blue-600" />
            <StatCard label="VAT Reclaimable" value={formatCurrency(totalVat)} icon={FileText} color="bg-gradient-to-br from-violet-500 to-violet-600" />
            <StatCard label="Claims to Pay" value={formatCurrency(claimsTotal)} sub="personal card / cash" icon={Wallet} color="bg-gradient-to-br from-amber-500 to-amber-600" />
            <StatCard label="Transactions" value={String(data.length)} icon={Receipt} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
          </div>
          {/* Director KPIs — YTD & live */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="YTD Total (FY)" value={formatCurrency(ytdTotal)} sub={`${ytdCount} expenses`} icon={TrendingUp} color="bg-gradient-to-br from-indigo-500 to-indigo-600" />
            <StatCard label="Avg per Expense" value={formatCurrency(ytdAvg)} sub="year to date" icon={BarChart3} color="bg-gradient-to-br from-cyan-500 to-cyan-600" />
            <StatCard label="Pending Approval" value={formatCurrency(pendingTotal)} sub={`${pendingCount} waiting`} icon={Clock} color="bg-gradient-to-br from-amber-500 to-amber-600" />
            <StatCard label="Claims Outstanding" value={formatCurrency(claimsOutstanding.reduce((s, p) => s + p.total, 0))} sub="to reimburse" icon={Wallet} color="bg-gradient-to-br from-rose-500 to-rose-600" />
          </div>

          {/* Spend trend (monthly bars within quarter, or daily within month) */}
          {monthlyData.length > 1 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-foreground mb-4">
                {analyticsMode === 'quarterly' ? 'Monthly Breakdown within Quarter' : 'Spend Trend'}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `£${v}`} />
                  <Tooltip formatter={(v: any) => [formatCurrency(v), 'Total']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* By category */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-foreground mb-4">Spend by Category</h3>
              {byCategory.length === 0 ? <EmptyState icon={BarChart3} title="No data" sub="Approve some expenses first" /> : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={byCategory} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                        {byCategory.map((_c, i) => <Cell key={_c.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2 py-2">
                    {byCategory.slice(0, 6).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-xs text-foreground flex-1 truncate">{c.name}</span>
                        <span className="text-xs font-bold text-foreground">{formatCurrency(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* By person */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-foreground mb-4">Top Spenders</h3>
              {byPerson.length === 0 ? <EmptyState icon={Users} title="No data" sub="No approved expenses yet" /> : (
                <div className="space-y-2">
                  {byPerson.map((p, i) => {
                    const pct = (p.total / (byPerson[0]?.total || 1)) * 100
                    return (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                        <span className="text-xs text-foreground flex-1 truncate">{p.name}</span>
                        <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-foreground w-20 text-right">{formatCurrency(p.total)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* UK FY quarter overview (only in quarterly mode) */}
          {analyticsMode === 'quarterly' && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-foreground mb-1">{fyLabel} — All Quarters</h3>
              <p className="text-xs text-muted-foreground mb-4">UK fiscal year: Apr {selectedYear} – Mar {selectedYear + 1}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(q => (
                  <button key={q} onClick={() => setSelectedQuarter(q)}
                    className={cn('rounded-xl border p-3 text-center transition-all',
                      selectedQuarter === q ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30')}>
                    <p className="text-xs font-bold text-muted-foreground mb-0.5">Q{q}</p>
                    <p className="text-[11px] text-muted-foreground">{quarterLabels[q - 1]}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Director Charts ──────────────────────────── */}

          {/* This month vs last month */}
          {monthVsLastData.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-foreground mb-1">This Month vs Last Month</h3>
              <p className="text-xs text-muted-foreground mb-4">Breakdown by payment method</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthVsLastData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `£${Math.round(v)}`} />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
                  <Legend />
                  <Bar dataKey="lastMonth" name="Last Month" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="thisMonth" name="This Month" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* VAT reclaimable trend */}
            {vatByMonthData.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-bold text-foreground mb-1">VAT Reclaimable</h3>
                <p className="text-xs text-muted-foreground mb-4">Last 6 months</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={vatByMonthData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `£${v}`} />
                    <Tooltip formatter={(v: any) => [formatCurrency(v), 'VAT']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
                    <Bar dataKey="vat" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Payment method split */}
            {paymentMethodData.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-bold text-foreground mb-1">Payment Method Split</h3>
                <p className="text-xs text-muted-foreground mb-4">Current month</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={paymentMethodData} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                        {paymentMethodData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2 py-2">
                    {paymentMethodData.map((p: any, i: number) => (
                      <div key={p.method} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-xs text-foreground flex-1 truncate">{p.method}</span>
                        <span className="text-xs font-bold">{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top 5 merchants */}
            {top5Merchants.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-bold text-foreground mb-1">Top 5 Merchants</h3>
                <p className="text-xs text-muted-foreground mb-4">All time (approved & paid)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={top5Merchants} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `£${v}`} />
                    <YAxis type="category" dataKey="merchant" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
                    <Bar dataKey="total" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Claims outstanding */}
            {claimsOutstanding.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-bold text-foreground mb-1">Claims to Reimburse</h3>
                <p className="text-xs text-muted-foreground mb-4">Submitted but not yet paid out</p>
                <div className="space-y-2.5">
                  {claimsOutstanding.map((p: any, i: number) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="w-4 text-xs font-bold text-muted-foreground shrink-0">{i + 1}</span>
                      <span className="flex-1 text-sm text-foreground truncate">{p.name}</span>
                      <span className="text-xs text-amber-600 font-semibold shrink-0">{p.count} pending</span>
                      <span className="text-sm font-bold text-foreground shrink-0">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between">
                    <span className="text-xs font-bold text-foreground">Total</span>
                    <span className="text-sm font-black text-amber-600">{formatCurrency(claimsOutstanding.reduce((s: number, p: any) => s + p.total, 0))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Spend by status (stacked bar) */}
          {spendByStatusData.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-foreground mb-1">Spend by Approval Status</h3>
              <p className="text-xs text-muted-foreground mb-4">Monthly breakdown — approved, pending, paid</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={spendByStatusData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `£${Math.round(v)}`} />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
                  <Legend />
                  <Bar dataKey="approved" stackId="a" name="Approved" fill="#10b981" />
                  <Bar dataKey="pending" stackId="a" name="Pending" fill="#f59e0b" />
                  <Bar dataKey="paid" stackId="a" name="Paid" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// SETTINGS TAB
// ============================================================

function SettingsTab({ isAdmin, isDirector }: { isAdmin: boolean; isDirector: boolean }) {
  const [cards, setCards] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCardForm, setShowCardForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [newCatGl, setNewCatGl] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatColor, setEditCatColor] = useState('')
  const [editCatGl, setEditCatGl] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [cd, us, cats] = await Promise.all([getCompanyCards(), getAllUsersForExpenseSettings(), getExpenseCategories()])
    setCards(cd)
    setUsers(us)
    setCategories(cats)
    setLoading(false)
  }, [])

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    setAddingCat(true)
    const result = await createExpenseCategory(newCatName.trim(), 'tag', newCatColor, newCatGl.trim() || undefined) as any
    if (result.success) {
      setCategories(c => [...c, result.data])
      setNewCatName('')
      setNewCatGl('')
      toast.success('Category added')
    } else {
      toast.error(result.error ?? 'Failed to add category')
    }
    setAddingCat(false)
  }

  const handleSaveCat = async (id: string) => {
    const result = await updateExpenseCategory(id, { name: editCatName, color: editCatColor, gl_code: editCatGl }) as any
    if (result.success) {
      setCategories(cats => cats.map(c => c.id === id ? { ...c, name: editCatName, color: editCatColor, gl_code: editCatGl } : c))
      setEditingCatId(null)
      toast.success('Category updated')
    } else {
      toast.error(result.error ?? 'Failed to update')
    }
  }

  const handleDeleteCat = async (id: string) => {
    if (!confirm('Delete this category? Expenses using it will be uncategorised.')) return
    const result = await deleteExpenseCategory(id) as any
    if (result.success) {
      setCategories(cats => cats.filter(c => c.id !== id))
      toast.success('Category deleted')
    } else {
      toast.error(result.error ?? 'Failed to delete')
    }
  }

  useEffect(() => { load() }, [load])

  const handleToggleAutoApprove = (userId: string, currentValue: boolean) => {
    startTransition(async () => {
      const result = await toggleExpenseAutoApprove(userId, !currentValue) as any
      if (result.success) { toast.success('Updated'); load() }
      else toast.error(result.error)
    })
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Company cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-foreground">Company Cards</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Register cards so employees can tag expenses correctly</p>
          </div>
          <button onClick={() => setShowCardForm(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Add Card
          </button>
        </div>
        <div className="space-y-3">
          {cards.map(c => {
            const employeeName = c.user_profiles ? (c.user_profiles.display_name || c.user_profiles.full_name) : c.card_holder
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <CreditCard className="h-4 w-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{employeeName} · {c.card_type} ····{c.last4}</p>
                </div>
                <span className={cn('text-xs font-semibold rounded-full px-2.5 py-0.5', c.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
                  {c.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Auto-approve per user */}
      <div>
        <div className="mb-4">
          <h3 className="font-bold text-foreground">Auto-Approve Users</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Users with auto-approve enabled can add expenses without going through the approval chain</p>
        </div>
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{(u.full_name ?? 'U').charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{u.full_name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <button
                onClick={() => handleToggleAutoApprove(u.id, u.expense_auto_approve)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  u.expense_auto_approve ? 'bg-violet-600' : 'bg-muted'
                )}
              >
                <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                  u.expense_auto_approve ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Categories + GL Codes */}
      <div>
        <div className="mb-4">
          <h3 className="font-bold text-foreground">Expense Categories &amp; GL Codes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Set GL codes for Business Central. Click the edit icon to update any category.</p>
        </div>
        <div className="space-y-2 mb-4">
          {categories.map(c => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-3">
              {editingCatId === c.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={editCatName} onChange={ev => setEditCatName(ev.target.value)}
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <input type="color" value={editCatColor} onChange={ev => setEditCatColor(ev.target.value)}
                      className="h-9 w-9 rounded-xl border border-border cursor-pointer bg-background" />
                  </div>
                  <input value={editCatGl} onChange={ev => setEditCatGl(ev.target.value)}
                    placeholder="GL Code (e.g. 6110, 7400)"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveCat(c.id)}
                      className="flex-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">Save</button>
                    <button onClick={() => setEditingCatId(null)}
                      className="flex-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg shrink-0" style={{ backgroundColor: c.color ?? '#6366f1' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    {c.gl_code && <p className="text-xs text-muted-foreground">GL: {c.gl_code}</p>}
                  </div>
                  {!c.gl_code && <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-full px-2 py-0.5 font-semibold">No GL code</span>}
                  <button onClick={() => { setEditingCatId(c.id); setEditCatName(c.name); setEditCatColor(c.color ?? '#6366f1'); setEditCatGl(c.gl_code ?? '') }}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDeleteCat(c.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-muted-foreground hover:text-rose-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-dashed border-border p-4 space-y-3">
          <p className="text-xs font-bold text-foreground">Add New Category</p>
          <div className="flex gap-2">
            <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
              placeholder="Category name"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
              className="h-10 w-10 rounded-xl border border-border cursor-pointer bg-background" title="Category colour" />
          </div>
          <input value={newCatGl} onChange={e => setNewCatGl(e.target.value)}
            placeholder="GL Code for Business Central (optional, e.g. 6110)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
            {addingCat ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : '+ Add Category'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
          <Tag className="h-3 w-3" /> Departments are managed in Admin → Organisation Settings
        </p>
      </div>

      {/* Forms */}
      {showCardForm && <CardForm onClose={() => setShowCardForm(false)} onSuccess={() => { setShowCardForm(false); load() }} />}
    </div>
  )
}

type StepDef = { type: 'role' | 'person'; role?: string; user_id?: string; label: string }

function normaliseStep(raw: any): StepDef {
  if (raw.user_id) return { type: 'person', user_id: raw.user_id, label: raw.label ?? '' }
  return { type: 'role', role: raw.role ?? 'manager', label: raw.label ?? 'Line Manager' }
}

function ApprovalChainForm({ chain, users, onClose, onSuccess }: { chain: any; users: any[]; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState(chain?.name ?? '')
  const [steps, setSteps] = useState<StepDef[]>(
    chain?.steps?.length ? chain.steps.map(normaliseStep) : [{ type: 'role', role: 'manager', label: 'Line Manager' }]
  )
  const [isDefault, setIsDefault] = useState(chain?.is_default ?? false)
  const [isPending, startTransition] = useTransition()

  const addStep = () => setSteps(s => [...s, { type: 'role', role: 'director', label: 'Director' }])
  const removeStep = (i: number) => setSteps(s => s.filter((_, j) => j !== i))

  const updateStepType = (i: number, type: 'role' | 'person') => {
    setSteps(s => s.map((step, j) => {
      if (j !== i) return step
      if (type === 'person') return { type: 'person', user_id: '', label: '' }
      return { type: 'role', role: 'manager', label: 'Line Manager' }
    }))
  }

  const updateStepRole = (i: number, role: string) => {
    const labels: Record<string, string> = { manager: 'Line Manager', director: 'Director', admin: 'Admin', accounts: 'Accounts' }
    setSteps(s => s.map((step, j) => j === i ? { ...step, role, label: labels[role] ?? role } : step))
  }

  const updateStepPerson = (i: number, userId: string) => {
    const user = users.find(u => u.id === userId)
    const label = user?.display_name || user?.full_name || ''
    setSteps(s => s.map((step, j) => j === i ? { ...step, user_id: userId, label } : step))
  }

  const handleSubmit = () => {
    if (!name.trim() || steps.length === 0) return
    // Convert back to DB format
    const dbSteps = steps.map(s => s.type === 'person'
      ? { user_id: s.user_id, label: s.label }
      : { role: s.role, label: s.label }
    )
    startTransition(async () => {
      const result = await saveApprovalChain({ id: chain?.id, name, steps: dbSteps as any, is_default: isDefault }) as any
      if (result.success) { toast.success(chain ? 'Updated' : 'Chain created'); onSuccess() }
      else toast.error(result.error)
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">{chain ? 'Edit Chain' : 'New Approval Chain'}</h3>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">Chain Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Expenses"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-foreground">Approval Steps</label>
            <button onClick={addStep} className="text-xs font-semibold text-primary hover:underline">+ Add Step</button>
          </div>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-muted-foreground">Step {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateStepType(i, 'role')}
                      className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors', s.type === 'role' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
                    >By Role</button>
                    <button
                      onClick={() => updateStepType(i, 'person')}
                      className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors', s.type === 'person' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
                    >Specific Person</button>
                    <button onClick={() => removeStep(i)} disabled={steps.length <= 1}
                      className="ml-1 rounded-lg p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-muted-foreground hover:text-rose-600 disabled:opacity-30">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {s.type === 'role' ? (
                  <select value={s.role} onChange={e => updateStepRole(i, e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="manager">Line Manager</option>
                    <option value="director">Director</option>
                    <option value="admin">Admin</option>
                    <option value="accounts">Accounts</option>
                  </select>
                ) : (
                  <select value={s.user_id ?? ''} onChange={e => updateStepPerson(i, e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">— Select a person —</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.display_name || u.full_name}{u.job_title ? ` · ${u.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {s.type === 'person' && s.user_id && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓ {s.label} will receive approval emails for this step</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <button type="button" onClick={() => setIsDefault((v: boolean) => !v)}
            className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', isDefault ? 'bg-primary' : 'bg-muted')}>
            <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm', isDefault ? 'translate-x-6' : 'translate-x-1')} />
          </button>
          <span className="text-sm text-foreground">Set as default chain</span>
        </label>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={handleSubmit} disabled={isPending || !name.trim()}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
          </button>
        </div>
      </div>
    </div>
  )
}

function CardForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [users, setUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')

  useEffect(() => { getAllUsersForExpenseSettings().then(setUsers) }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const selectedUser = users.find(u => u.id === selectedUserId)
    startTransition(async () => {
      const result = await createCompanyCard({
        label: String(fd.get('label')),
        last4: String(fd.get('last4')),
        card_holder: selectedUser ? (selectedUser.display_name || selectedUser.full_name) : String(fd.get('card_holder')),
        card_type: String(fd.get('card_type')),
        user_id: selectedUserId || null,
      }) as any
      if (result.success) { toast.success('Card added'); onSuccess() }
      else toast.error(result.error)
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">Add Company Card</h3>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">Assigned Employee</label>
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <option value="">— Select employee —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.display_name || u.full_name} · {u.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">Card Label</label>
            <input required name="label" placeholder="e.g. Sai Business Visa"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Last 4 Digits</label>
              <input required name="last4" maxLength={4} minLength={4} placeholder="1234" inputMode="numeric" pattern="[0-9]*"
                onChange={e => { const el = e.target as HTMLInputElement; el.value = el.value.replace(/\D/g, '') }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Card Type</label>
              <select name="card_type" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                <option>Visa</option>
                <option>Mastercard</option>
                <option>Amex</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          {!selectedUserId && (
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Cardholder Name <span className="font-normal text-muted-foreground">(if not selecting employee above)</span></label>
              <input name="card_holder" placeholder="Name on card"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add Card
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground text-center max-w-xs">{sub}</p>
    </div>
  )
}
