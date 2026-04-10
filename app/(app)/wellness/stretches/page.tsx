'use client'

import { useState } from 'react'
import Link from 'next/link'
import { logStretchSession } from '@/lib/actions/wellness'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Play, Pause, CheckCircle2, RotateCcw,
  Timer, Loader2, ChevronRight, Dumbbell, Star,
} from 'lucide-react'

// ── Stretch library ───────────────────────────────────────────

const STRETCHES = [
  {
    id: 'neck-rolls',
    name: 'Neck Rolls',
    duration: 45,
    category: 'Upper Body',
    difficulty: 'Easy',
    emoji: '🔄',
    color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40',
    iconColor: 'text-blue-600',
    instructions: [
      'Sit tall with shoulders relaxed',
      'Slowly drop your right ear to your right shoulder',
      'Roll your head forward and to the left',
      'Hold each position for 3-5 seconds',
      'Repeat in the opposite direction',
    ],
    benefit: 'Releases tension from long screen time',
    image: '🧘',
  },
  {
    id: 'shoulder-shrugs',
    name: 'Shoulder Shrugs',
    duration: 30,
    category: 'Upper Body',
    difficulty: 'Easy',
    emoji: '⬆️',
    color: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/40',
    iconColor: 'text-indigo-600',
    instructions: [
      'Sit or stand up straight',
      'Raise both shoulders up toward your ears',
      'Hold for 3 seconds, then release',
      'Roll shoulders back in a circular motion',
      'Repeat 5-8 times',
    ],
    benefit: 'Relieves shoulder and neck tension',
    image: '💪',
  },
  {
    id: 'wrist-circles',
    name: 'Wrist Circles',
    duration: 30,
    category: 'Hands & Wrists',
    difficulty: 'Easy',
    emoji: '✋',
    color: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/40',
    iconColor: 'text-purple-600',
    instructions: [
      'Extend both arms in front of you',
      'Make loose fists with your hands',
      'Rotate your wrists clockwise 10 times',
      'Then rotate counter-clockwise 10 times',
      'Finish by shaking out your hands',
    ],
    benefit: 'Prevents repetitive strain from typing',
    image: '🤲',
  },
  {
    id: 'chest-opener',
    name: 'Chest Opener',
    duration: 40,
    category: 'Upper Body',
    difficulty: 'Easy',
    emoji: '🫁',
    color: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40',
    iconColor: 'text-rose-600',
    instructions: [
      'Clasp hands behind your back',
      'Squeeze shoulder blades together',
      'Lift chest up and open the front of your body',
      'Hold for 15-20 seconds',
      'Breathe deeply throughout',
    ],
    benefit: 'Counteracts hunched posture from screens',
    image: '🌟',
  },
  {
    id: 'seated-spinal-twist',
    name: 'Seated Spinal Twist',
    duration: 60,
    category: 'Core & Back',
    difficulty: 'Medium',
    emoji: '🔀',
    color: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40',
    iconColor: 'text-amber-600',
    instructions: [
      'Sit tall in your chair, feet flat on floor',
      'Place right hand on left knee',
      'Place left hand on the back of your chair',
      'Gently twist your torso to the left',
      'Hold 20 seconds, then switch sides',
    ],
    benefit: 'Improves spinal mobility and relieves back pain',
    image: '🌀',
  },
  {
    id: 'hip-flexor-stretch',
    name: 'Hip Flexor Stretch',
    duration: 60,
    category: 'Lower Body',
    difficulty: 'Medium',
    emoji: '🦵',
    color: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/40',
    iconColor: 'text-green-600',
    instructions: [
      'Stand up and step one foot forward',
      'Lower your back knee toward the floor',
      'Keep your front knee over your ankle',
      'Lean forward slightly to feel the stretch',
      'Hold 30 seconds, then switch legs',
    ],
    benefit: 'Counteracts hip tightness from prolonged sitting',
    image: '🏃',
  },
  {
    id: 'calf-raises',
    name: 'Calf Raises',
    duration: 45,
    category: 'Lower Body',
    difficulty: 'Easy',
    emoji: '⬆️',
    color: 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/40',
    iconColor: 'text-teal-600',
    instructions: [
      'Stand up near your desk for balance',
      'Rise up on the balls of your feet',
      'Hold for 2 seconds at the top',
      'Slowly lower back down',
      'Repeat 15-20 times',
    ],
    benefit: 'Improves circulation and prevents ankle stiffness',
    image: '🦶',
  },
  {
    id: 'eye-palming',
    name: 'Eye Rest (20-20-20)',
    duration: 25,
    category: 'Eyes',
    difficulty: 'Easy',
    emoji: '👁️',
    color: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/40',
    iconColor: 'text-sky-600',
    instructions: [
      'Look away from your screen',
      'Focus on something 20 feet (6m) away',
      'Hold your gaze for 20 seconds',
      'Rub palms together to warm them',
      'Cup warm palms gently over closed eyes for 20 seconds',
    ],
    benefit: 'Reduces eye strain and digital fatigue',
    image: '👀',
  },
]

const CATEGORIES = ['All', 'Upper Body', 'Hands & Wrists', 'Core & Back', 'Lower Body', 'Eyes']

// ── Guided session ────────────────────────────────────────────

function GuidedSession({ stretches, onComplete, onCancel }: {
  stretches: typeof STRETCHES
  onComplete: () => void
  onCancel: () => void
}) {
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(stretches[0]?.duration ?? 30)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null)

  const stretch = stretches[current]

  function start() {
    setRunning(true)
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id)
          setRunning(false)
          if (current < stretches.length - 1) {
            setTimeout(() => {
              setCurrent(c => c + 1)
              setTimeLeft(stretches[current + 1]?.duration ?? 30)
            }, 800)
          } else {
            setDone(true)
          }
          return 0
        }
        return t - 1
      })
    }, 1000)
    setIntervalId(id)
  }

  function pause() {
    if (intervalId) clearInterval(intervalId)
    setRunning(false)
  }

  function skip() {
    if (intervalId) clearInterval(intervalId)
    setRunning(false)
    if (current < stretches.length - 1) {
      setCurrent(c => c + 1)
      setTimeLeft(stretches[current + 1]?.duration ?? 30)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Session Complete!</h2>
        <p className="text-muted-foreground mb-6">You completed {stretches.length} stretches. Great work!</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
            Back to library
          </button>
          <button onClick={onComplete} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors">
            Save & finish
          </button>
        </div>
      </div>
    )
  }

  const progress = ((stretch.duration - timeLeft) / stretch.duration) * 100

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {stretches.map((_, i) => (
          <div key={i} className={cn('flex-1 h-1.5 rounded-full transition-colors', i < current ? 'bg-green-500' : i === current ? 'bg-green-300' : 'bg-border')} />
        ))}
      </div>

      <div className={cn('rounded-2xl border-2 p-8 text-center mb-6', stretch.color)}>
        <div className="text-5xl mb-4">{stretch.image}</div>
        <h2 className="text-xl font-bold text-foreground mb-1">{stretch.name}</h2>
        <p className="text-sm text-muted-foreground mb-6">{stretch.benefit}</p>

        {/* Timer ring */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative h-24 w-24">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-border" />
              <circle
                cx="48" cy="48" r="40" fill="none" strokeWidth="6"
                stroke="currentColor" className="text-green-500"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{timeLeft}s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          {!running ? (
            <button onClick={start} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              <Play className="h-4 w-4" /> Start
            </button>
          ) : (
            <button onClick={pause} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              <Pause className="h-4 w-4" /> Pause
            </button>
          )}
          <button onClick={skip} className="flex items-center gap-2 px-4 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
            Skip <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Instructions</h3>
        <ol className="space-y-2">
          {stretch.instructions.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 text-xs flex items-center justify-center font-bold mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel session
        </button>
        <span className="text-sm text-muted-foreground">{current + 1} / {stretches.length}</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function StretchesPage() {
  const [category, setCategory] = useState('All')
  const [session, setSession] = useState<typeof STRETCHES | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sessionStart] = useState(Date.now())

  const filtered = category === 'All' ? STRETCHES : STRETCHES.filter(s => s.category === category)

  async function handleSessionComplete() {
    if (!session) return
    setSaving(true)
    const duration = Math.round((Date.now() - sessionStart) / 1000)
    const result = await logStretchSession({
      session_type: 'guided',
      stretches_done: session.length,
      duration_secs: duration,
    })
    setSaving(false)
    if (!result.success) return
    setSaved(true)
    setSession(null)
  }

  if (session) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <GuidedSession
            stretches={session}
            onComplete={handleSessionComplete}
            onCancel={() => setSession(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/wellness" className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Dumbbell className="h-6 w-6 text-blue-600" />
                Stretch Library
              </h1>
              <p className="text-sm text-muted-foreground">Desk-friendly exercises for every part of your body</p>
            </div>
          </div>
        </div>

        {saved && (
          <div className="mb-6 flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Session saved to your journey!
          </div>
        )}

        {/* Quick session starters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { label: '3-min quick stretch', stretches: STRETCHES.slice(0, 3), color: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/40 text-green-700', icon: '⚡' },
            { label: 'Upper body focus', stretches: STRETCHES.filter(s => s.category === 'Upper Body'), color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40 text-blue-700', icon: '💪' },
            { label: 'Full body session', stretches: STRETCHES, color: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/40 text-purple-700', icon: '🌟' },
          ].map(s => (
            <button
              key={s.label}
              onClick={() => setSession(s.stretches)}
              className={cn('flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.01] hover:shadow-sm', s.color)}
            >
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className="font-semibold text-sm">{s.label}</p>
                <p className="text-xs opacity-70">{s.stretches.length} exercises · {Math.round(s.stretches.reduce((t, x) => t + x.duration, 0) / 60)} min</p>
              </div>
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Stretch cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(stretch => (
            <div key={stretch.id} className={cn('rounded-2xl border-2 p-5 transition-all', stretch.color)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{stretch.image}</span>
                  <div>
                    <h3 className="font-bold text-foreground">{stretch.name}</h3>
                    <p className="text-xs text-muted-foreground">{stretch.category} · {stretch.difficulty}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/70 px-2 py-1 rounded-lg">
                  <Timer className="h-3 w-3" />
                  {stretch.duration}s
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{stretch.benefit}</p>
              <button
                onClick={() => setSession([stretch])}
                className={cn('w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold bg-background/60 hover:bg-background/90 transition-colors', stretch.iconColor)}
              >
                <Play className="h-3.5 w-3.5" />
                Start stretch
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
