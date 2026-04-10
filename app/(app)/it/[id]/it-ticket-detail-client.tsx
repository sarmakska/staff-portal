'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ITTicket, ITTicketComment, ITTicketAttachment } from '@/lib/actions/it-tickets'
import { addITTicketComment, updateITTicketStatus, updateITTicketMeta, saveAttachmentRecord } from '@/lib/actions/it-tickets'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
const supabaseBrowser = createBrowserClient()
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, Clock, CheckCircle2, Wrench, AlertCircle, Paperclip,
  Send, Lock, Eye, Loader2, Upload, File, Image, X, Tag,
  User, Monitor, Package, Wifi, Shield, Printer, HelpCircle,
  Zap, AlertTriangle, ChevronDown,
} from 'lucide-react'

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
  { value: 'low', label: 'Low', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
  { value: 'medium', label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { value: 'high', label: 'High', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  { value: 'critical', label: 'Critical', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
]

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 'in_progress', label: 'In Progress', icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
  { value: 'closed', label: 'Closed', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
]

interface Props {
  userId: string
  isAdmin: boolean
  ticket: ITTicket
  initialComments: ITTicketComment[]
  attachments: ITTicketAttachment[]
  staffList: { id: string; name: string }[]
}

export default function ITTicketDetailClient({ userId, isAdmin, ticket: initialTicket, initialComments, attachments: initialAttachments, staffList }: Props) {
  const router = useRouter()
  const [ticket, setTicket] = useState(initialTicket)
  const [comments, setComments] = useState(initialComments)
  const [attachments, setAttachments] = useState(initialAttachments)
  const [commentText, setCommentText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cat = CATEGORIES.find(c => c.value === ticket.category)
  const CatIcon = cat?.icon ?? HelpCircle
  const statusInfo = STATUS_OPTIONS.find(s => s.value === ticket.status) ?? STATUS_OPTIONS[0]
  const priorityInfo = PRIORITIES.find(p => p.value === ticket.priority) ?? PRIORITIES[1]
  const StatusIcon = statusInfo.icon

  async function handleSendComment() {
    if (!commentText.trim()) return
    const body = commentText.trim()
    setSubmitting(true)
    const result = await addITTicketComment(ticket.id, body, isInternal)
    setSubmitting(false)
    if (!result.success) return
    setCommentText('')
    // Optimistically add comment before refresh
    setComments(prev => [...prev, {
      id: crypto.randomUUID(),
      ticket_id: ticket.id,
      user_id: userId,
      body,
      is_internal: isInternal,
      created_at: new Date().toISOString(),
      user_profile: undefined,
    }])
    startTransition(() => router.refresh())
  }

  async function handleStatusChange(status: string) {
    const result = await updateITTicketStatus(ticket.id, status)
    if (result.success) {
      setTicket(t => ({ ...t, status }))
    }
  }

  async function handlePriorityChange(priority: string) {
    const result = await updateITTicketMeta(ticket.id, { priority })
    if (result.success) setTicket(t => ({ ...t, priority }))
  }

  async function handleAssign(assigned_to: string) {
    const result = await updateITTicketMeta(ticket.id, { assigned_to: assigned_to || null })
    if (result.success) setTicket(t => ({ ...t, assigned_to: assigned_to || null }))
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setUploadError('File must be under 10MB'); return }
    setUploading(true)
    setUploadError('')
    const path = `${ticket.id}/${Date.now()}-${file.name}`

    const { error } = await supabaseBrowser.storage.from('it-attachments').upload(path, file)
    if (error) { setUploadError('Upload failed. Please try again.'); setUploading(false); return }

    const result = await saveAttachmentRecord({
      ticketId: ticket.id,
      fileName: file.name,
      filePath: path,
      fileSize: file.size,
      mimeType: file.type,
    })
    setUploading(false)
    if (result.success) {
      setAttachments(prev => [...prev, {
        id: result.id!,
        ticket_id: ticket.id,
        comment_id: null,
        user_id: userId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        created_at: new Date().toISOString(),
      }])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function openAttachment(att: ITTicketAttachment) {
    const { data } = await supabaseBrowser.storage.from('it-attachments').createSignedUrl(att.file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const isImage = (mime: string | null) => mime?.startsWith('image/') ?? false

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Back */}
        <button
          onClick={() => router.push(isAdmin ? '/admin/it' : '/it')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isAdmin ? 'Back to IT Portal' : 'My Tickets'}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">

            {/* Ticket header */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-xs font-mono text-muted-foreground">#{ticket.ticket_number}</span>
                <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', statusInfo.bg, statusInfo.color)}>
                  <StatusIcon className="h-3 w-3" />
                  {statusInfo.label}
                </span>
                <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', priorityInfo.bg, priorityInfo.color)}>
                  {ticket.priority === 'critical' && <Zap className="h-3 w-3 mr-1" />}
                  {priorityInfo.label}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  <CatIcon className="h-3 w-3" />
                  {cat?.label ?? ticket.category}
                </span>
              </div>
              <h1 className="text-xl font-bold text-foreground mb-4">{ticket.title}</h1>
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {ticket.user_profile?.display_name || ticket.user_profile?.full_name || 'Unknown'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(ticket.created_at), 'd MMM yyyy, HH:mm')}
                </span>
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-violet-500" />
                  Attachments
                  {attachments.length > 0 && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{attachments.length}</span>
                  )}
                </h3>
                <label className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors',
                  uploading
                    ? 'bg-muted text-muted-foreground cursor-wait'
                    : 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                )}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? 'Uploading...' : 'Upload'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              {uploadError && <p className="text-xs text-red-500 mb-3 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{uploadError}</p>}

              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No attachments yet. Upload screenshots or error logs.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attachments.map(att => (
                    <button
                      key={att.id}
                      onClick={() => openAttachment(att)}
                      className="group flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-all text-center"
                    >
                      {isImage(att.mime_type) ? (
                        <Image className="h-8 w-8 text-violet-500" />
                      ) : (
                        <File className="h-8 w-8 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium text-foreground line-clamp-1">{att.file_name}</span>
                      {att.file_size && (
                        <span className="text-xs text-muted-foreground">{(att.file_size / 1024).toFixed(0)} KB</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-500" />
                Activity
                {comments.length > 0 && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{comments.length}</span>}
              </h3>

              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground mb-4 text-center py-4">No replies yet.</p>
              )}

              <div className="space-y-4 mb-5">
                {comments.map(c => (
                  <div key={c.id} className={cn(
                    'rounded-xl p-4 text-sm',
                    c.is_internal
                      ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30'
                      : c.user_id === userId
                        ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/30'
                        : 'bg-muted/50 border border-border'
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-violet-200 dark:bg-violet-800 flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <span className="font-semibold text-foreground text-xs">
                          {c.user_profile?.display_name || c.user_profile?.full_name || 'Team member'}
                        </span>
                        {c.is_internal && (
                          <span className="flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-semibold">
                            <Lock className="h-2.5 w-2.5" />
                            Internal
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              {ticket.status !== 'closed' && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder={isAdmin ? 'Write a reply to the user...' : 'Add more details or reply to IT...'}
                    rows={3}
                    className="w-full px-4 py-3 text-sm bg-background focus:outline-none resize-none border-b border-border"
                  />
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsInternal(v => !v)}
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors',
                          isInternal
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {isInternal ? <Lock className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {isInternal ? 'Internal note' : 'Public reply'}
                      </button>
                    )}
                    {!isAdmin && <span />}
                    <button
                      onClick={handleSendComment}
                      disabled={!commentText.trim() || submitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* Status (admin) */}
            {isAdmin && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Status</p>
                <div className="space-y-1.5">
                  {STATUS_OPTIONS.map(s => {
                    const Icon = s.icon
                    return (
                      <button
                        key={s.value}
                        onClick={() => handleStatusChange(s.value)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                          ticket.status === s.value
                            ? cn(s.bg, s.color, 'font-semibold')
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {s.label}
                        {ticket.status === s.value && <CheckCircle2 className="h-3.5 w-3.5 ml-auto" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Priority (admin) */}
            {isAdmin && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Priority</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.value}
                      onClick={() => handlePriorityChange(p.value)}
                      className={cn(
                        'px-2 py-2 rounded-xl text-xs font-semibold transition-all border',
                        ticket.priority === p.value
                          ? cn(p.bg, p.color, 'border-current')
                          : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assign (admin) */}
            {isAdmin && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Assigned to</p>
                <select
                  value={ticket.assigned_to ?? ''}
                  onChange={e => handleAssign(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                >
                  <option value="">Unassigned</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Ticket details */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Details</p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Submitted by</p>
                  <p className="font-medium text-foreground">{ticket.user_profile?.display_name || ticket.user_profile?.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Category</p>
                  <p className="font-medium text-foreground flex items-center gap-1.5"><CatIcon className="h-3.5 w-3.5" />{cat?.label ?? ticket.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                  <p className="font-medium text-foreground">{format(new Date(ticket.created_at), 'd MMM yyyy, HH:mm')}</p>
                </div>
                {ticket.resolved_at && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Resolved</p>
                    <p className="font-medium text-green-600">{format(new Date(ticket.resolved_at), 'd MMM yyyy, HH:mm')}</p>
                  </div>
                )}
                {ticket.assigned_profile && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Assigned to</p>
                    <p className="font-medium text-foreground">
                      {ticket.assigned_profile.display_name || ticket.assigned_profile.full_name}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Note about auto-delete */}
            {(ticket.status === 'resolved' || ticket.status === 'closed') && ticket.resolved_at && (
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Resolved tickets are automatically deleted 30 days after resolution to keep the system clean.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
