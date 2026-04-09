'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ITTicket } from '@/lib/actions/it-tickets'
import { submitITTicket } from '@/lib/actions/it-tickets'
import { cn } from '@/lib/utils'
import {
  Ticket, Plus, X, ChevronRight, Clock, CheckCircle2, AlertCircle,
  Loader2, Search, Filter, Paperclip, MessageSquare, ArrowUpRight,
  Wrench, Monitor, Wifi, Shield, Printer, Package, HelpCircle,
  AlertTriangle, Zap,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ── Constants ─────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'hardware', label: 'Hardware', icon: Monitor },
  { value: 'software', label: 'Software', icon: Package },
  { value: 'network', label: 'Network / Internet', icon: Wifi },
  { value: 'email', label: 'Email / Account', icon: Shield },
  { value: 'printer', label: 'Printer / Scanner', icon: Printer },
  { value: 'access', label: 'Access / Permissions', icon: Shield },
  { value: 'other', label: 'Other', icon: HelpCircle },
]

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  { value: 'medium', label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { value: 'high', label: 'High', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  { value: 'critical', label: 'Critical', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
]

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  open: { label: 'Open', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
  in_progress: { label: 'In Progress', icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50' },
  resolved: { label: 'Resolved', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  closed: { label: 'Closed', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  userId: string
  isAdmin: boolean
  initialTickets: ITTicket[]
}

// ── Main component ────────────────────────────────────────────

export default function ITTicketsClient({ userId, isAdmin, initialTickets }: Props) {
  const router = useRouter()
  const [tickets, setTickets] = useState(initialTickets)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [isPending, startTransition] = useTransition()

  // Form state
  const [form, setForm] = useState({ title: '', description: '', category: 'hardware', priority: 'medium' })
  const [formError, setFormError] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  const filtered = useMemo(() => {
    let list = tickets
    if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus)
    if (filterPriority !== 'all') list = list.filter(t => t.priority === filterPriority)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        String(t.ticket_number).includes(q)
      )
    }
    return list
  }, [tickets, filterStatus, filterPriority, search])

  const stats = useMemo(() => ({
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    total: tickets.length,
  }), [tickets])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('Title and description are required.')
      return
    }
    setFormSubmitting(true)
    setFormError('')
    const result = await submitITTicket(form)
    setFormSubmitting(false)
    if (!result.success) {
      setFormError(result.error ?? 'Something went wrong.')
      return
    }
    setShowNew(false)
    setForm({ title: '', description: '', category: 'hardware', priority: 'medium' })
    startTransition(() => router.refresh())
  }

  const getPriorityBadge = (priority: string) => {
    const p = PRIORITIES.find(x => x.value === priority) ?? PRIORITIES[1]
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', p.bg, p.color, p.border)}>
        {priority === 'critical' && <Zap className="h-3 w-3" />}
        {p.label}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.open
    const Icon = s.icon
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', s.bg, s.color)}>
        <Icon className="h-3 w-3" />
        {s.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-violet-600" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">IT Support</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-[52px]">
              {isAdmin ? 'Manage all support tickets' : 'Raise a ticket and track your requests'}
            </p>
          </div>
          {!isAdmin && (
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Ticket
            </button>
          )}
          {isAdmin && (
            <a
              href="/admin/it"
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Shield className="h-4 w-4" />
              Admin Portal
            </a>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground', bg: 'bg-muted/50' },
            { label: 'Open', value: stats.open, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { label: 'In Progress', value: stats.in_progress, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Resolved', value: stats.resolved, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl px-4 py-3 border border-border/50', s.bg)}>
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Ticket list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Ticket className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No tickets found</h3>
            <p className="text-sm text-muted-foreground">
              {tickets.length === 0
                ? "You haven't raised any tickets yet."
                : 'No tickets match your filters.'}
            </p>
            {tickets.length === 0 && !isAdmin && (
              <button
                onClick={() => setShowNew(true)}
                className="mt-4 flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                Raise a ticket
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ticket => {
              const cat = CATEGORIES.find(c => c.value === ticket.category)
              const CatIcon = cat?.icon ?? HelpCircle
              const isUrgent = ticket.priority === 'critical' || ticket.priority === 'high'
              return (
                <button
                  key={ticket.id}
                  onClick={() => router.push(`/it/${ticket.id}`)}
                  className={cn(
                    'w-full text-left bg-card border border-border rounded-2xl p-5 hover:border-violet-300 hover:shadow-md transition-all duration-200 group',
                    isUrgent && ticket.status === 'open' && 'border-orange-200 dark:border-orange-800/50'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                      ticket.status === 'resolved' || ticket.status === 'closed'
                        ? 'bg-gray-100 dark:bg-gray-800'
                        : 'bg-violet-100 dark:bg-violet-900/30'
                    )}>
                      <CatIcon className={cn(
                        'h-5 w-5',
                        ticket.status === 'resolved' || ticket.status === 'closed'
                          ? 'text-gray-400'
                          : 'text-violet-600'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-muted-foreground">#{ticket.ticket_number}</span>
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                      <h3 className="font-semibold text-foreground text-sm leading-snug mb-1 group-hover:text-violet-600 transition-colors">
                        {ticket.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{ticket.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {isAdmin && ticket.user_profile && (
                          <span>{ticket.user_profile.display_name || ticket.user_profile.full_name}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                        </span>
                        {(ticket.comment_count ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {ticket.comment_count}
                          </span>
                        )}
                        {(ticket.attachment_count ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {ticket.attachment_count}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3 group-hover:text-violet-600 transition-colors" />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* New ticket modal */}
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-bold text-foreground">New IT Support Ticket</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">IT admin will be notified immediately</p>
                </div>
                <button
                  onClick={() => { setShowNew(false); setFormError('') }}
                  className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left',
                            form.category === cat.value
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400'
                              : 'border-border text-muted-foreground hover:border-violet-300 hover:bg-muted/50'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{cat.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Priority</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRIORITIES.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                        className={cn(
                          'px-2 py-2 rounded-xl border text-xs font-semibold transition-all',
                          form.priority === p.value
                            ? cn(p.bg, p.color, 'border-current')
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Title <span className="text-red-500">*</span></label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Brief summary of the issue"
                    maxLength={120}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Description <span className="text-red-500">*</span></label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the issue in detail. Include any error messages, steps to reproduce, and what you expected to happen."
                    rows={5}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">You can attach screenshots after submitting.</p>
                </div>

                {formError && (
                  <p className="text-sm text-red-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> {formError}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowNew(false); setFormError('') }}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold border border-border rounded-xl hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    {formSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                    Submit Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
