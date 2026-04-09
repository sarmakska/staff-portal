'use client'

import { useState, useTransition } from 'react'
import { createNoticePost, deleteNoticePost } from '@/lib/actions/notice-board'
import type { NoticePost } from '@/lib/actions/notice-board'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, X, Link as LinkIcon, Calendar, Trash2, Pin } from 'lucide-react'

const NOTE_COLOURS = [
  { hex: '#fef08a', name: 'Yellow', text: '#713f12', pin: '#a16207' },
  { hex: '#bbf7d0', name: 'Green',  text: '#14532d', pin: '#15803d' },
  { hex: '#bfdbfe', name: 'Blue',   text: '#1e3a8a', pin: '#1d4ed8' },
  { hex: '#fecaca', name: 'Red',    text: '#7f1d1d', pin: '#dc2626' },
  { hex: '#e9d5ff', name: 'Purple', text: '#4c1d95', pin: '#7c3aed' },
  { hex: '#fed7aa', name: 'Orange', text: '#7c2d12', pin: '#ea580c' },
  { hex: '#fbcfe8', name: 'Pink',   text: '#831843', pin: '#db2777' },
  { hex: '#99f6e4', name: 'Teal',   text: '#134e4a', pin: '#0d9488' },
]

function getTilt(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  return ((Math.abs(h) % 11) - 5) * 0.8
}

function StickyNote({ post, onDelete }: { post: NoticePost; onDelete: (id: string) => void }) {
  const [hovered, setHovered] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const colour = NOTE_COLOURS.find(c => c.hex === post.colour) ?? NOTE_COLOURS[0]
  const tilt = getTilt(post.id)
  const isExpired = post.expires_at && new Date(post.expires_at) < new Date()

  function handleDelete() {
    setDeleting(true)
    startTransition(async () => {
      const res = await deleteNoticePost(post.id)
      if (res.success) { toast.success('Note removed'); onDelete(post.id) }
      else { toast.error(res.error ?? 'Failed'); setDeleting(false) }
    })
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn('relative break-inside-avoid mb-6 select-none', deleting && 'pointer-events-none')}
      style={{
        transform: `rotate(${hovered ? tilt * 0.2 : tilt}deg) scale(${hovered ? 1.03 : 1})`,
        transformOrigin: 'top center',
        transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s',
        opacity: deleting ? 0 : isExpired ? 0.5 : 1,
        zIndex: hovered ? 20 : 1,
      }}
    >
      {/* Pin */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
        <div className="h-5 w-5 rounded-full shadow-md border-2 border-white/50 flex items-center justify-center" style={{ backgroundColor: colour.pin }}>
          <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
        </div>
        <div className="h-2.5 w-px bg-gray-600/40" />
      </div>

      {/* Note */}
      <div
        className="relative rounded-sm pt-5 px-4 pb-4"
        style={{
          backgroundColor: post.colour,
          boxShadow: hovered
            ? '4px 12px 32px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.15)'
            : '2px 6px 16px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1)',
          minHeight: '120px',
          fontFamily: "'Segoe Print','Bradley Hand','Comic Sans MS',cursive",
        }}
      >
        {/* Folded corner */}
        <div className="absolute bottom-0 right-0 w-6 h-6"
          style={{ background: `linear-gradient(225deg, rgba(0,0,0,0.14) 50%, transparent 50%)` }} />

        {hovered && (
          <button onClick={handleDelete} disabled={isPending}
            className="absolute top-2 right-2 h-5 w-5 rounded-full bg-black/10 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
            style={{ color: colour.text }}>
            <Trash2 className="h-3 w-3" />
          </button>
        )}

        <div style={{ color: colour.text }}>
          <p className="text-sm font-semibold leading-snug break-words whitespace-pre-wrap">{post.content}</p>

          {post.link_url && (
            <a href={post.link_url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold underline hover:opacity-70 max-w-full truncate"
              style={{ color: colour.text }}>
              <LinkIcon className="h-3 w-3 shrink-0" />
              {post.link_label || post.link_url}
            </a>
          )}

          <div className="mt-3 pt-2 border-t border-black/10 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold opacity-50 truncate">{post.created_by_name}</span>
            {post.expires_at && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold opacity-50 shrink-0">
                <Calendar className="h-2.5 w-2.5" />
                {new Date(post.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>

        {isExpired && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-black uppercase tracking-widest border-2 border-current px-2 py-0.5 rotate-[-10deg] opacity-60"
              style={{ color: colour.text }}>Expired</span>
          </div>
        )}
      </div>
    </div>
  )
}

function AddNoteModal({ onClose, onAdd }: { onClose: () => void; onAdd: (post: NoticePost) => void }) {
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [colour, setColour] = useState(NOTE_COLOURS[0].hex)
  const [expiresAt, setExpiresAt] = useState('')
  const [showLink, setShowLink] = useState(false)
  const [showExpiry, setShowExpiry] = useState(false)
  const [isPending, startTransition] = useTransition()
  const selectedColour = NOTE_COLOURS.find(c => c.hex === colour) ?? NOTE_COLOURS[0]

  function submit() {
    startTransition(async () => {
      const res = await createNoticePost({ content, link_url: linkUrl || undefined, link_label: linkLabel || undefined, colour, expires_at: expiresAt || undefined })
      if (res.success && res.post) { toast.success('Note pinned!'); onAdd(res.post); onClose() }
      else toast.error(res.error ?? 'Failed to pin note')
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
        {/* Preview */}
        <div className="flex justify-center mb-5">
          <div className="relative rounded-sm px-5 py-4 shadow-2xl w-48 text-center"
            style={{ backgroundColor: colour, transform: 'rotate(-2deg)', fontFamily: "'Segoe Print','Bradley Hand','Comic Sans MS',cursive", color: selectedColour.text }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className="h-5 w-5 rounded-full border-2 border-white/50" style={{ backgroundColor: selectedColour.pin }} />
              <div className="h-2.5 w-px bg-gray-600/40" />
            </div>
            <p className="text-sm font-semibold leading-snug mt-1 min-h-[28px]">{content || 'Your note…'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-amber-600" />
              <h2 className="font-bold text-foreground">Pin a Note</h2>
            </div>
            <button onClick={onClose} className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Write your note here…"
              className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 h-24"
              style={{ fontFamily: "'Segoe Print','Bradley Hand','Comic Sans MS',cursive" }} />

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Colour</p>
              <div className="flex gap-2 flex-wrap">
                {NOTE_COLOURS.map(c => (
                  <button key={c.hex} onClick={() => setColour(c.hex)} title={c.name}
                    className={cn('h-7 w-7 rounded-full border-2 transition-all', colour === c.hex ? 'border-foreground scale-110 shadow' : 'border-transparent hover:scale-105')}
                    style={{ backgroundColor: c.hex }} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <button onClick={() => setShowLink(v => !v)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                <LinkIcon className="h-3 w-3" /> {showLink ? 'Remove link' : 'Add a link (optional)'}
              </button>
              {showLink && (
                <div className="space-y-2">
                  <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…"
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Link label (optional)"
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              )}
            </div>

            <div>
              <button onClick={() => setShowExpiry(v => !v)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Calendar className="h-3 w-3" /> {showExpiry ? 'Remove expiry' : 'Set expiry date (optional)'}
              </button>
              {showExpiry && (
                <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              )}
            </div>

            <button onClick={submit} disabled={isPending || !content.trim()}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-3 transition-all flex items-center justify-center gap-2">
              {isPending
                ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Pinning…</>
                : <><Pin className="h-4 w-4" /> Pin It</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NoticeBoardClient({ initialPosts }: { initialPosts: NoticePost[] }) {
  const [posts, setPosts] = useState<NoticePost[]>(initialPosts)
  const [showAdd, setShowAdd] = useState(false)

  const active = posts.filter(p => !p.expires_at || new Date(p.expires_at) >= new Date())
  const expired = posts.filter(p => p.expires_at && new Date(p.expires_at) < new Date())

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {showAdd && <AddNoteModal onClose={() => setShowAdd(false)} onAdd={p => setPosts(prev => [p, ...prev])} />}

      {/* Header */}
      <div className="bg-white dark:bg-card border-b border-border px-4 py-6 md:py-8">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
              <Pin className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Notice Board</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {active.length > 0 ? `${active.length} note${active.length !== 1 ? 's' : ''} pinned` : 'Nothing pinned yet'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 transition-all text-sm shadow-sm">
            <Plus className="h-4 w-4" /> Pin a Note
          </button>
        </div>
      </div>

      {/* Cork Board */}
      <div className="max-w-screen-xl mx-auto px-4 py-8 pb-16">
        <div className="relative rounded-2xl p-6 md:p-10 min-h-[480px] overflow-hidden"
          style={{
            backgroundColor: '#b5894a',
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(0,0,0,0.04) 31px, rgba(0,0,0,0.04) 32px),
              repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(0,0,0,0.03) 31px, rgba(0,0,0,0.03) 32px),
              radial-gradient(ellipse at 15% 25%, #c8a060 0%, #b5894a 50%, #a07238 100%)
            `,
            boxShadow: 'inset 0 0 0 4px #8b6030, inset 0 0 0 6px #c09050, 0 8px 32px rgba(0,0,0,0.2)',
          }}>

          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                <Pin className="h-8 w-8 text-white/60" />
              </div>
              <p className="text-white/80 font-bold text-lg drop-shadow">Board is empty</p>
              <p className="text-white/50 text-sm mt-1 mb-6">Be the first to pin something</p>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 rounded-xl bg-white text-amber-800 font-bold px-5 py-2.5 shadow-lg text-sm hover:shadow-xl transition-all">
                <Plus className="h-4 w-4" /> Pin First Note
              </button>
            </div>
          ) : (
            <div style={{ columns: 'auto', columnWidth: '200px', columnGap: '28px' }}>
              {active.map(post => (
                <StickyNote key={post.id} post={post} onDelete={id => setPosts(p => p.filter(x => x.id !== id))} />
              ))}
            </div>
          )}
        </div>

        {expired.length > 0 && (
          <div className="mt-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Expired ({expired.length})</p>
            <div style={{ columns: 'auto', columnWidth: '200px', columnGap: '28px' }}>
              {expired.map(post => (
                <StickyNote key={post.id} post={post} onDelete={id => setPosts(p => p.filter(x => x.id !== id))} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
