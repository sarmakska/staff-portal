'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { logBreathingSession } from '@/lib/actions/wellness'
import { cn } from '@/lib/utils'
import { ArrowLeft, Wind, Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react'

// ── Techniques ────────────────────────────────────────────────

const TECHNIQUES = [
  {
    id: '4-7-8',
    name: '4-7-8 Breathing',
    tagline: 'Calm anxiety fast',
    description: 'Breathe in for 4 counts, hold for 7, exhale for 8. This technique activates your parasympathetic nervous system.',
    phases: [
      { label: 'Inhale', duration: 4, color: 'from-blue-400 to-blue-600', instruction: 'Breathe in through your nose' },
      { label: 'Hold', duration: 7, color: 'from-purple-400 to-purple-600', instruction: 'Hold your breath' },
      { label: 'Exhale', duration: 8, color: 'from-teal-400 to-teal-600', instruction: 'Exhale completely through your mouth' },
    ],
    benefit: 'Reduces stress & anxiety',
    cycles: 4,
    color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40',
    accent: 'text-blue-600',
    emoji: '🌊',
  },
  {
    id: 'box',
    name: 'Box Breathing',
    tagline: 'Focus & clarity',
    description: 'Equal counts for all four phases. Used by Navy SEALs to stay calm under pressure.',
    phases: [
      { label: 'Inhale', duration: 4, color: 'from-indigo-400 to-indigo-600', instruction: 'Breathe in slowly' },
      { label: 'Hold', duration: 4, color: 'from-violet-400 to-violet-600', instruction: 'Hold still' },
      { label: 'Exhale', duration: 4, color: 'from-purple-400 to-purple-600', instruction: 'Breathe out slowly' },
      { label: 'Hold', duration: 4, color: 'from-fuchsia-400 to-fuchsia-600', instruction: 'Hold empty' },
    ],
    benefit: 'Improves focus & performance',
    cycles: 4,
    color: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/40',
    accent: 'text-indigo-600',
    emoji: '⬜',
  },
  {
    id: 'diaphragmatic',
    name: 'Deep Belly Breathing',
    tagline: 'Relax & restore',
    description: 'Slow, deep breaths that engage your diaphragm fully. Great for a midday reset.',
    phases: [
      { label: 'Inhale', duration: 5, color: 'from-green-400 to-green-600', instruction: 'Breathe deep into your belly' },
      { label: 'Exhale', duration: 6, color: 'from-emerald-400 to-emerald-600', instruction: 'Let it all go slowly' },
    ],
    benefit: 'Lowers heart rate & tension',
    cycles: 6,
    color: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/40',
    accent: 'text-green-600',
    emoji: '🌿',
  },
  {
    id: 'energizing',
    name: 'Energizing Breath',
    tagline: 'Beat the afternoon slump',
    description: 'Short, quick breaths through the nose followed by a long exhale. Increases oxygen flow.',
    phases: [
      { label: 'Quick inhale', duration: 2, color: 'from-amber-400 to-orange-500', instruction: 'Short, sharp breath in' },
      { label: 'Exhale', duration: 4, color: 'from-orange-400 to-red-500', instruction: 'Slow exhale through the mouth' },
    ],
    benefit: 'Boosts energy & alertness',
    cycles: 8,
    color: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40',
    accent: 'text-amber-600',
    emoji: '⚡',
  },
]

// ── Active breathing exercise ─────────────────────────────────

function BreathingExercise({ technique, onComplete, onBack }: {
  technique: typeof TECHNIQUES[0]
  onComplete: (secs: number) => void
  onBack: () => void
}) {
  const [phase, setPhase] = useState(0)
  const [count, setCount] = useState(technique.phases[0].duration)
  const [cycle, setCycle] = useState(1)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedRef = useRef<NodeJS.Timeout | null>(null)

  const currentPhase = technique.phases[phase]
  const totalDuration = technique.phases.reduce((t, p) => t + p.duration, 0) * technique.cycles
  const progress = ((currentPhase.duration - count) / currentPhase.duration) * 100
  const bubbleScale = currentPhase.label.toLowerCase().includes('inhale') ? 1 + (1 - count / currentPhase.duration) * 0.3 : 1 + (count / currentPhase.duration) * 0.3

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          const nextPhase = (phase + 1) % technique.phases.length
          const isLastPhase = nextPhase === 0
          if (isLastPhase) {
            if (cycle >= technique.cycles) {
              clearInterval(intervalRef.current!)
              setRunning(false)
              setFinished(true)
              return 0
            }
            setCycle(cy => cy + 1)
          }
          setPhase(nextPhase)
          setCount(technique.phases[nextPhase].duration)
          return technique.phases[nextPhase].duration
        }
        return c - 1
      })
    }, 1000)

    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

    return () => {
      clearInterval(intervalRef.current!)
      clearInterval(elapsedRef.current!)
    }
  }, [running, phase, cycle])

  function toggle() {
    if (running) {
      clearInterval(intervalRef.current!)
      clearInterval(elapsedRef.current!)
    }
    setRunning(r => !r)
  }

  function reset() {
    clearInterval(intervalRef.current!)
    clearInterval(elapsedRef.current!)
    setRunning(false)
    setPhase(0)
    setCount(technique.phases[0].duration)
    setCycle(1)
    setFinished(false)
    setElapsed(0)
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-6xl mb-4">✨</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Well done!</h2>
        <p className="text-muted-foreground mb-2">You completed {technique.cycles} cycles of {technique.name}.</p>
        <p className="text-sm text-muted-foreground mb-8">Take a moment to notice how you feel.</p>
        <div className="flex gap-3">
          <button onClick={onBack} className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
            Try another
          </button>
          <button onClick={() => onComplete(elapsed)} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors">
            <CheckCircle2 className="h-4 w-4" /> Save session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto text-center">
      <h2 className="text-xl font-bold text-foreground mb-1">{technique.name}</h2>
      <p className="text-sm text-muted-foreground mb-8">Cycle {cycle} of {technique.cycles}</p>

      {/* Animated bubble */}
      <div className="flex items-center justify-center mb-8">
        <div
          className={cn('rounded-full bg-gradient-to-br flex items-center justify-center transition-transform duration-1000 ease-in-out shadow-2xl', currentPhase.color)}
          style={{
            width: '180px',
            height: '180px',
            transform: `scale(${bubbleScale})`,
            opacity: running ? 1 : 0.5,
          }}
        >
          <div className="text-center text-white">
            <p className="text-4xl font-bold">{count}</p>
            <p className="text-sm font-semibold opacity-90 mt-1">{currentPhase.label}</p>
          </div>
        </div>
      </div>

      {/* Phase instruction */}
      <p className="text-base text-foreground font-medium mb-2">{currentPhase.instruction}</p>

      {/* Phase pills */}
      <div className="flex gap-2 justify-center mb-8">
        {technique.phases.map((p, i) => (
          <div
            key={i}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              i === phase
                ? 'bg-gradient-to-r text-white shadow-sm ' + currentPhase.color
                : 'bg-muted text-muted-foreground'
            )}
          >
            {p.label} {p.duration}s
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={reset} className="h-11 w-11 flex items-center justify-center rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={toggle}
          className={cn(
            'h-14 w-14 flex items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-105',
            running ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'
          )}
        >
          {running ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
        </button>
        <button onClick={onBack} className="h-11 w-11 flex items-center justify-center rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground text-xs font-medium">
          Back
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function BreathingPage() {
  const [selected, setSelected] = useState<typeof TECHNIQUES[0] | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleComplete(secs: number) {
    if (!selected) return
    const result = await logBreathingSession({ technique: selected.id, duration_secs: secs })
    if (!result.success) return
    setSaved(true)
    setSelected(null)
  }

  if (selected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <BreathingExercise technique={selected} onComplete={handleComplete} onBack={() => setSelected(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/wellness" className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wind className="h-6 w-6 text-purple-600" />
              Breathing Exercises
            </h1>
            <p className="text-sm text-muted-foreground">Guided techniques for focus, calm, and energy</p>
          </div>
        </div>

        {saved && (
          <div className="mb-6 flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Session saved to your wellness journey!
          </div>
        )}

        {/* Intro */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800/40 rounded-2xl p-6 mb-8">
          <p className="text-sm text-purple-700 dark:text-purple-300 leading-relaxed">
            <strong>Why breathing exercises?</strong> Controlled breathing activates your body's relaxation response, reducing cortisol levels in as little as 2 minutes. Choose a technique and follow along — no equipment needed.
          </p>
        </div>

        {/* Technique cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {TECHNIQUES.map(tech => (
            <div key={tech.id} className={cn('rounded-2xl border-2 p-6', tech.color)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{tech.emoji}</span>
                    <h3 className="font-bold text-foreground">{tech.name}</h3>
                  </div>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full bg-background/60', tech.accent)}>
                    {tech.tagline}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{tech.description}</p>

              {/* Phase preview */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {tech.phases.map((p, i) => (
                  <span key={i} className="text-xs bg-background/60 text-foreground px-2 py-1 rounded-lg font-medium">
                    {p.label} {p.duration}s
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{tech.cycles} cycles · ~{Math.round(tech.phases.reduce((t, p) => t + p.duration, 0) * tech.cycles / 60)} min</span>
                <button
                  onClick={() => { setSaved(false); setSelected(tech) }}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-background/60 hover:bg-background/90 transition-colors', tech.accent)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Start
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
