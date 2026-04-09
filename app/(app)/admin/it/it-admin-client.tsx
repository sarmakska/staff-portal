'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ITTicket } from '@/lib/actions/it-tickets'
import { updateITTicketStatus, updateITTicketMeta } from '@/lib/actions/it-tickets'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Ticket, Search, CheckCircle2, AlertCircle, Wrench, Clock,
  Monitor, Package, Wifi, Shield, Printer, HelpCircle, Zap,
  User, MessageSquare, Paperclip, ChevronRight, BarChart3,
  Filter, ArrowUpDown, Eye,
} from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', ring: 'ring-blue-300' },
  { value: 'in_progress', label: 'In Progress', icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', ring: 'ring-amber-300' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30', ring: 'ring-green-300' },
  { value: 'closed', label: 'Closed', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', ring: 'ring-gray-300' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-green-600', bg: 'bg-green-50' },
  { value: 'medium', label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50' },
  { value: 'high', label: 'High', color: 'text-orange-600', bg: 'bg-orange-50' },
  { value: 'critical', label: 'Critical', color: 'text-red-600', bg: 'bg-red-50' },
]

const CATEGORIES = [
  { value: 'hardware', label: 'Hardware', icon: Monitor },
  { value: 'software', label: 'Software', icon: Package },
  { value: 'network', label: 'Network / Internet', icon: Wifi },
  { value: 'email', label: 'Email / Account', icon: Shield },
  { value: 'printer', label: 'Printer / Scanner', icon: Printer },
  { value: 'access', label: 'Access / Permissions', icon: Shield },
  { value: 'other', label: 'Other', icon: HelpCircle },
]

interface Props {
  userId: string
  tickets: ITTicket[]
  stats: { open: number; in_progress: number; resolved: number; closed: number; total: number }
  staffList: { id: string; name: string }[]
}

export default function ITAdminClient({ userId, tickets: initialTickets, stats, staffList }: Props) {
  const router = useRouter()
  const [tickets, setTickets] = useState(initialTickets)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'priority'>('created')
  const [_, startTransition] = useTransition()

  const filtered = useMemo(() => {
    let list = [...tickets]
    if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus)
    if (filterPriority !== 'all') list = list.filter(t => t.priority === filterPriority)
    if (filterCategory !== 'all') list = list.filter(t => t.category === filterCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        String(t.ticket_number).includes(q) ||
        (t.user_profile?.full_name ?? '').toLowerCase().includes(q)
      )
    }
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    list.sort((a, b) => {
      if (sortBy === 'priority') return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2)
      if (sortBy === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return list
  }, [tickets, filterStatus, filterPriority, filterCategory, search, sortBy])

  async function quickStatus(ticketId: string, status: string, e: React.MouseEvent) {
    e.stopPropagation()
    const result = await updateITTicketStatus(ticketId, status)
    if (result.success) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t))
    }
  }

  async function quickAssign(ticketId: string, assigned_to: string, e: React.MouseEvent) {
    e.stopPropagation()
    const result = await updateITTicketMeta(ticketId, { assigned_to: assigned_to || null })
    if (result.success) {
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, assigned_to: assigned_to || null } : t))
    }
  }

  const getPriorityBadge = (priority: string) => {
    const p = PRIORITIES.find(x => x.value === priority) ?? PRIORITIES[1]
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', p.bg, p.color)}>
        {priority === 'critical' && <Zap className="h-2.5 w-2.5" />}
        {p.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Shield className="h-5 w-5 text-violet-600" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">IT Admin Portal</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-[52px]">Manage and resolve all IT support tickets</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground', bg: '' },
            { label: 'Open', value: stats.open, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { label: 'In Progress', value: stats.in_progress, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Resolved', value: stats.resolved, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
            { label: 'Closed', value: stats.closed, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800/50' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl px-4 py-3 border border-border/50', s.bg || 'bg-muted/50')}>
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
              placeholder="Search by title, user, or ticket #..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none">
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none">
            <option value="all">All Priority</option>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none">
            <option value="created">Newest first</option>
            <option value="updated">Last updated</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Ticket</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Assigned</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No tickets found.</td>
                  </tr>
                )}
                {filtered.map(ticket => {
                  const cat = CATEGORIES.find(c => c.value === ticket.category)
                  const CatIcon = cat?.icon ?? HelpCircle
                  const statusInfo = STATUS_OPTIONS.find(s => s.value === ticket.status) ?? STATUS_OPTIONS[0]
                  const StatusIcon = statusInfo.icon
                  const assignedStaff = staffList.find(s => s.id === ticket.assigned_to)

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => router.push(`/it/${ticket.id}`)}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-muted-foreground">#{ticket.ticket_number}</span>
                      </td>
                      <td className="px-4 py-3.5 max-w-[260px]">
                        <div className="flex items-center gap-2 mb-0.5">
                          <CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-foreground truncate group-hover:text-violet-600 transition-colors">{ticket.title}</span>
                        </div>
                        <div className="flex items-center gap-3 ml-5">
                          {(ticket.comment_count ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MessageSquare className="h-3 w-3" />{ticket.comment_count}
                            </span>
                          )}
                          {(ticket.attachment_count ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Paperclip className="h-3 w-3" />{ticket.attachment_count}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-foreground">
                          {ticket.user_profile?.display_name || ticket.user_profile?.full_name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">{getPriorityBadge(ticket.priority)}</td>
                      <td className="px-4 py-3.5">
                        <select
                          value={ticket.status}
                          onClick={e => e.stopPropagation()}
                          onChange={e => quickStatus(ticket.id, e.target.value, e as any)}
                          className={cn(
                            'text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/30',
                            statusInfo.bg, statusInfo.color
                          )}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          value={ticket.assigned_to ?? ''}
                          onClick={e => e.stopPropagation()}
                          onChange={e => quickAssign(ticket.id, e.target.value, e as any)}
                          className="text-xs text-foreground border border-border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30 max-w-[120px] truncate"
                        >
                          <option value="">Unassigned</option>
                          {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3.5">
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-violet-600 transition-colors" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Resolved tickets are automatically deleted 30 days after resolution.
        </p>
      </div>
    </div>
  )
}
