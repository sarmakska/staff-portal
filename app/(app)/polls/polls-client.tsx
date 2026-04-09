'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPoll, castVote } from '@/lib/actions/polls'
import type { Poll } from '@/lib/actions/polls'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, X, Clock, Users, Trophy, ChevronDown, ChevronUp, Archive, Check, BarChart2 } from 'lucide-react'

const OC = [
  { grad: 'from-violet-500 to-purple-600', text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40', bar: 'from-violet-500 to-purple-600' },
  { grad: 'from-blue-500 to-cyan-500',     text: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950/40',     bar: 'from-blue-500 to-cyan-500'     },
  { grad: 'from-emerald-500 to-teal-500',  text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', bar: 'from-emerald-500 to-teal-500' },
  { grad: 'from-orange-500 to-amber-500',  text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40',  bar: 'from-orange-500 to-amber-500'  },
  { grad: 'from-pink-500 to-rose-500',     text: 'text-pink-600 dark:text-pink-400',     bg: 'bg-pink-50 dark:bg-pink-950/40',     bar: 'from-pink-500 to-rose-500'     },
  { grad: 'from-indigo-500 to-blue-600',   text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40', bar: 'from-indigo-500 to-blue-600'   },
]

function useCountdown(deadline: string) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setLabel('Closed'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setLabel(d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`)
    }
    calc()
    const t = setInterval(calc, 60000)
    return () => clearInterval(t)
  }, [deadline])
  return label
}

function PollCard({ poll, onVote }: { poll: Poll; onVote: (id: string, idx: number) => void }) {
  const countdown = useCountdown(poll.deadline)
  const isOpen = !poll.is_archived && new Date(poll.deadline) > new Date()
  const totalVotes = (poll.votes ?? []).length
  const hasVoted = poll.my_vote !== null && poll.my_vote !== undefined
  const [isPending, startTransition] = useTransition()
  const [showChart, setShowChart] = useState(false)

  const votesPerOption = (poll.options ?? []).map((_, i) =>
    (poll.votes ?? []).filter(v => v.option_index === i).length
  )
  const winnerIdx = !isOpen && totalVotes > 0
    ? votesPerOption.indexOf(Math.max(...votesPerOption)) : -1

  function handleVote(idx: number) {
    if (!isOpen || isPending) return
    startTransition(async () => {
      const res = await castVote(poll.id, idx)
      if (res.success) { onVote(poll.id, idx); toast.success('Vote recorded!') }
      else toast.error(res.error ?? 'Failed to vote')
    })
  }

  return (
    <div className={cn(
      'rounded-2xl border bg-card overflow-hidden transition-all duration-200',
      isOpen ? 'border-border shadow-sm hover:shadow-md' : 'border-border/50 opacity-80'
    )}>
      {/* Top bar */}
      <div className={cn('h-1 w-full', isOpen ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500' : 'bg-muted')} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isOpen ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 rounded-full px-2.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" /> LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
                  <Archive className="h-3 w-3" /> CLOSED
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">by {poll.created_by_name}</span>
            </div>
            <h3 className="text-base font-bold text-foreground leading-snug">{poll.question}</h3>
          </div>
          <div className="shrink-0 text-right space-y-1">
            <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" /> {totalVotes}
            </div>
            <div className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', isOpen ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400' : 'text-muted-foreground bg-muted')}>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{countdown}</span>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {(poll.options ?? []).map((opt, i) => {
            const votes = votesPerOption[i]
            const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
            const isMyVote = poll.my_vote === i
            const isWinner = i === winnerIdx
            const col = OC[i % OC.length]
            return (
              <button key={i} onClick={() => handleVote(i)} disabled={isPending || !isOpen}
                className={cn(
                  'w-full text-left rounded-xl border transition-all duration-150 overflow-hidden',
                  isMyVote ? 'border-violet-400 dark:border-violet-500' : isWinner ? 'border-amber-400' : 'border-border',
                  isOpen && !isPending ? 'hover:border-violet-300 cursor-pointer' : 'cursor-default',
                )}>
                <div className="flex">
                  <div className={cn('w-1 shrink-0 bg-gradient-to-b', col.grad)} />
                  <div className={cn('flex-1 px-3.5 py-3', isMyVote ? col.bg : 'bg-card')}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {isWinner && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        <span className="text-sm font-medium text-foreground truncate">{opt}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isMyVote && (
                          <span className={cn('h-4 w-4 rounded-full flex items-center justify-center text-white bg-gradient-to-br', col.grad)}>
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                        <span className={cn('text-sm font-bold tabular-nums', isMyVote ? col.text : 'text-muted-foreground')}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', col.bar)} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{votes} vote{votes !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <p className={cn('text-[11px]',
            isOpen && !hasVoted ? 'text-muted-foreground' :
            isOpen && hasVoted ? 'text-violet-600 dark:text-violet-400 font-medium' : 'text-muted-foreground'
          )}>
            {isOpen && !hasVoted ? 'Tap an option to vote' :
             isOpen && hasVoted ? '✓ Voted — tap to change' :
             `${totalVotes} total vote${totalVotes !== 1 ? 's' : ''}`}
          </p>
          {totalVotes > 0 && (
            <button onClick={() => setShowChart(v => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              <BarChart2 className="h-3.5 w-3.5" />
              {showChart ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>

        {showChart && totalVotes > 0 && (
          <div className="mt-3 rounded-xl bg-muted/40 border border-border/50 p-3.5 space-y-2 animate-in slide-in-from-top-2 duration-200">
            {(poll.options ?? []).map((opt, i) => {
              const votes = votesPerOption[i]
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
              const col = OC[i % OC.length]
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium truncate pr-2">{opt}</span>
                    <span className="font-bold tabular-nums shrink-0">{pct}% <span className="font-normal text-muted-foreground">({votes})</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', col.bar)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CreatePollModal({ onClose, onCreate }: { onClose: () => void; onCreate: (poll: Poll) => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', '', ''])
  const [deadline, setDeadline] = useState('')
  const [isPending, startTransition] = useTransition()
  const minDeadline = new Date(Date.now() + 3600000).toISOString().slice(0, 16)

  const addOption = () => { if (options.length < 8) setOptions(o => [...o, '']) }
  const removeOption = (i: number) => { if (options.length > 2) setOptions(o => o.filter((_, idx) => idx !== i)) }
  const updateOption = (i: number, v: string) => setOptions(o => o.map((x, idx) => idx === i ? v : x))

  function submit() {
    startTransition(async () => {
      const res = await createPoll({ question, options, deadline })
      if (res.success && res.poll) {
        toast.success('Poll launched!')
        onCreate({ ...res.poll, votes: [], my_vote: null })
        onClose()
      } else {
        toast.error(res.error ?? 'Failed to create poll')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">New Poll</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Everyone votes — results are live</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Question *</label>
            <textarea value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="e.g. Which date works best for the Christmas party?"
              className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 h-20" />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Options * <span className="normal-case font-normal">(2–8)</span></label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-gradient-to-br', OC[i % OC.length].grad)}>{i + 1}</div>
                  <input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`}
                    className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  {options.length > 2 && (
                    <button onClick={() => removeOption(i)}
                      className="h-6 w-6 rounded-full bg-muted hover:bg-destructive/20 flex items-center justify-center transition-colors shrink-0">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 8 && (
              <button onClick={addOption} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add option
              </button>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Deadline * <span className="normal-case font-normal">(voting closes automatically)</span></label>
            <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} min={minDeadline}
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          <button onClick={submit}
            disabled={isPending || !question.trim() || options.filter(o => o.trim()).length < 2 || !deadline}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold py-3 transition-all flex items-center justify-center gap-2">
            {isPending
              ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Launching…</>
              : 'Launch Poll'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PollsClient({ initialPolls }: { initialPolls: Poll[] }) {
  const [polls, setPolls] = useState<Poll[]>(initialPolls)
  const [showCreate, setShowCreate] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const router = useRouter()

  const active = polls.filter(p => !p.is_archived && new Date(p.deadline) > new Date())
  const archived = polls.filter(p => p.is_archived || new Date(p.deadline) <= new Date())

  function handleVote(pollId: string, idx: number) {
    setPolls(prev => prev.map(p => p.id !== pollId ? p : { ...p, my_vote: idx }))
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {showCreate && <CreatePollModal onClose={() => setShowCreate(false)} onCreate={p => setPolls(prev => [p, ...prev])} />}

      {/* Header */}
      <div className="bg-white dark:bg-card border-b border-border px-4 py-6 md:py-8">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
              <BarChart2 className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Staff Polls</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {active.length > 0 ? `${active.length} active poll${active.length !== 1 ? 's' : ''}` : 'No active polls right now'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 transition-all text-sm shadow-sm">
            <Plus className="h-4 w-4" /> New Poll
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-10">

        {/* Active polls */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Live Polls</h2>
          </div>

          {active.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <BarChart2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-bold text-foreground text-lg">No active polls</p>
              <p className="text-muted-foreground text-sm mt-1 mb-5">Create a poll and get everyone voting</p>
              <button onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2.5 transition-all text-sm">
                <Plus className="h-4 w-4" /> Create a Poll
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {active.map(p => <PollCard key={p.id} poll={p} onVote={handleVote} />)}
            </div>
          )}
        </section>

        {/* Archive */}
        {archived.length > 0 && (
          <section>
            <button onClick={() => setShowArchive(v => !v)}
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-4">
              <Archive className="h-3.5 w-3.5" />
              Closed Polls — {archived.length}
              {showArchive ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showArchive && (
              <div className="grid gap-4 md:grid-cols-2 animate-in fade-in duration-200">
                {archived.map(p => <PollCard key={p.id} poll={p} onVote={() => {}} />)}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
