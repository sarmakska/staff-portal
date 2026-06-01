'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
const CW = 960
const CH = 640

const CFW = 16, CFH = 32, CS = 2

const CDN = 'https://raw.githubusercontent.com/pablodelucca/pixel-agents/main/webview-ui/public/assets/characters'

// Named seat assignment — first name (lowercase) → seat index
const NAMED_SEATS: Record<string, number> = {
  'wendy': 0, 'liz': 1, 'erin': 2, 'cat': 3,
  'caroline': 4, 'anuja': 5, 'ushmi': 6, 'athene': 7,
  'michelle': 8, 'varsha': 9,
  'sonal': 10, 'prakash': 11,
  'aziz': 12, 'semih': 13, 'sai': 14, 'jai': 15,
  'prateek': 16,
}

// 20 fixed seats matching actual office floor plan layout
const DIR_DOWN = 0

const SEATS: { x: number; y: number; dir: number; name: string }[] = [
  // Zone A — top-left cluster
  { x: 82,  y: 100, dir: DIR_DOWN, name: 'Wendy'    }, { x: 82,  y: 196, dir: DIR_DOWN, name: 'Liz'      },
  { x: 210, y: 100, dir: DIR_DOWN, name: 'Erin'     }, { x: 210, y: 196, dir: DIR_DOWN, name: 'Cat'      },
  { x: 338, y: 100, dir: DIR_DOWN, name: 'Caroline' }, { x: 338, y: 196, dir: DIR_DOWN, name: 'Anuja'    },
  { x: 466, y: 100, dir: DIR_DOWN, name: 'Ushmi'    }, { x: 466, y: 196, dir: DIR_DOWN, name: 'Athene'   },
  // Zone B — top-right open desks
  { x: 626, y: 126, dir: DIR_DOWN, name: 'Michelle' }, { x: 718, y: 126, dir: DIR_DOWN, name: 'Varsha'   },
  // Zone C — right-column rooms
  { x: 876, y: 158, dir: DIR_DOWN, name: 'Sonal'    },
  { x: 876, y: 478, dir: DIR_DOWN, name: 'Prakash'  },
  // Zone D — bottom-left cluster
  { x: 82,  y: 442, dir: DIR_DOWN, name: 'Aziz'     }, { x: 82,  y: 538, dir: DIR_DOWN, name: 'Semih'    },
  { x: 246, y: 490, dir: DIR_DOWN, name: 'the admin'      }, { x: 388, y: 490, dir: DIR_DOWN, name: 'Jai'      },
  // Zone E — bottom-middle room
  { x: 572, y: 480, dir: DIR_DOWN, name: 'Prateek'  },
]

const OVERFLOW_SEAT_INDICES: number[] = []

// ═══════════════════════════════════════════════════════════════
//  ANIMATION
// ═══════════════════════════════════════════════════════════════
type AnimKey = 'idle' | 'type' | 'think' | 'walk' | 'coffee'

const ANIMS: Record<AnimKey, { cols: number[]; fps: number }> = {
  idle:   { cols: [1],       fps: 1 },
  walk:   { cols: [0,1,2,3], fps: 5 },
  type:   { cols: [3,4],     fps: 4 },
  think:  { cols: [5,6],     fps: 2 },
  coffee: { cols: [1,2,1,0], fps: 3 },
}
const ALL_ANIMS: AnimKey[] = ['idle', 'type', 'think', 'coffee', 'type', 'idle']

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════
interface Person { id: string; name: string; sprite: number; gender: string }
interface Char   { p: Person; x: number; y: number; anim: AnimKey; frame: number; dir: number; lastTick: number }

// ═══════════════════════════════════════════════════════════════
//  SPRITE LOADING
// ═══════════════════════════════════════════════════════════════
const spriteCache: (HTMLImageElement | null)[] = Array(6).fill(null)
let spritesReady = false

function ensureSprites(cb: () => void) {
  if (spritesReady) return cb()
  let n = 6
  const done = () => { if (--n === 0) { spritesReady = true; cb() } }
  for (let i = 0; i < 6; i++) {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload  = () => { spriteCache[i] = img; done() }
    img.onerror = () => done()
    img.src = `${CDN}/char_${i}.png`
  }
}

// ═══════════════════════════════════════════════════════════════
//  FALLBACK PIXEL ART CHARACTER
// ═══════════════════════════════════════════════════════════════
const PX = 3
const _ = '', S = 'S', H = 'H', E = 'E', C = 'C', P = 'P', B = 'B'
const PAL: Record<string, string> = { S: '#eab88a', H: '#3b2010', E: '#0a0601', P: '#1d3354', B: '#0c1018' }
type F = string[][]
const HEAD_F: F = [
  [_,_,H,H,H,H,_,_],[_,H,S,S,S,S,H,_],[_,S,E,S,S,E,S,_],[_,S,S,S,S,S,S,_],[_,_,S,S,S,S,_,_],
]
const mkFB = (arms: F, legs: F): F => [...HEAD_F, ...arms, ...legs]
const A0: F = [[C,C,C,C,C,C,C,C],[C,C,C,C,C,C,C,C]]
const A1: F = [[C,C,C,C,C,C,C,C],[C,S,C,C,C,C,S,C]]
const L0: F = [[_,_,P,P,P,P,_,_],[_,_,P,_,_,P,_,_],[_,_,P,_,_,P,_,_],[_,_,B,_,_,B,_,_],[_,_,_,_,_,_,_,_]]
const L1: F = [[_,_,P,P,P,P,_,_],[_,P,P,_,_,P,_,_],[_,_,P,_,_,P,_,_],[_,_,B,_,_,P,_,_],[_,_,_,_,_,B,_,_]]

const FB_ANIMS: Record<AnimKey, F[]> = {
  idle:   [mkFB(A0, L0)],
  type:   [mkFB(A1, L0), mkFB(A0, L0)],
  think:  [mkFB(A0, L0), mkFB(A0, L0)],
  walk:   [mkFB(A0, L1), mkFB(A0, L0), mkFB(A0, L1), mkFB(A0, L0)],
  coffee: [mkFB(A1, L0), mkFB(A0, L0)],
}

const SHIRT_COLORS = ['#3b82f6','#a855f7','#ec4899','#f59e0b','#10b981','#ef4444','#f97316','#14b8a6','#6366f1','#84cc16']

function drawFallback(ctx: CanvasRenderingContext2D, x: number, y: number, shirt: string, anim: AnimKey, frame: number) {
  const frames = FB_ANIMS[anim]
  const f = frames[frame % frames.length]
  f.forEach((row, r) => row.forEach((k, c) => {
    if (!k) return
    ctx.fillStyle = k === C ? shirt : (PAL[k] ?? '#000')
    ctx.fillRect(x + c * PX, y + r * PX, PX, PX)
  }))
}

// ═══════════════════════════════════════════════════════════════
//  SCENE HELPERS
// ═══════════════════════════════════════════════════════════════
function drawFloor(ctx: CanvasRenderingContext2D) {
  const plankH = 32
  const planks = ['#7a5618','#875f1c','#7a5618','#875f1c','#7a5618','#875f1c','#875f1c','#7a5618','#875f1c','#7a5618']
  for (let i = 0; i < Math.ceil(CH / plankH); i++) {
    ctx.fillStyle = planks[i % planks.length]
    ctx.fillRect(0, i * plankH, CW, plankH)
  }
  ctx.strokeStyle = '#5c3e0e'; ctx.lineWidth = 1
  for (let y = plankH; y < CH; y += plankH) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
  }
}

function drawWalls(ctx: CanvasRenderingContext2D) {
  // Outer walls
  ctx.fillStyle = '#1e1a2e'
  ctx.fillRect(0, 0, CW, 18)
  ctx.fillRect(0, 0, 14, CH)
  ctx.fillRect(CW - 14, 0, 14, CH)
  ctx.fillRect(0, CH - 10, CW, 10)
  // Inner wall accent
  ctx.fillStyle = '#2d2840'
  ctx.fillRect(12, 0, 4, CH)
  ctx.fillRect(CW - 16, 0, 4, CH)
  // Right-column partition wall (vertical)
  ctx.fillStyle = '#1e1a2e'
  ctx.fillRect(800, 18, 10, CH - 28)
  // Horizontal divider between the two right-column rooms
  ctx.fillRect(800, 318, 148, 8)
  ctx.fillStyle = '#2d2840'
  ctx.fillRect(808, 18, 3, CH - 28)
}

function drawZones(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#2a2050'; ctx.lineWidth = 4
  // Zone A: top-left cluster
  ctx.strokeRect(16, 18, 538, 218)
  // Zone B: top-right open area
  ctx.strokeRect(558, 18, 228, 218)
  // Zone D: bottom-left cluster
  ctx.strokeRect(16, 376, 458, 212)
  // Zone E: bottom-middle private room
  ctx.strokeRect(482, 376, 215, 212)
  // Right column rooms (filled with very faint tint)
  ctx.fillStyle = 'rgba(40,32,80,0.15)'
  ctx.fillRect(814, 18, 132, 300)
  ctx.fillRect(814, 326, 132, 300)
  ctx.strokeStyle = '#2a2050'; ctx.lineWidth = 2
  ctx.strokeRect(814, 18, 132, 300)
  ctx.strokeRect(814, 326, 132, 300)
}

function drawShelf(ctx: CanvasRenderingContext2D, x: number, y: number, count: number) {
  ctx.fillStyle = '#7a5018'; ctx.fillRect(x, y, 72, 6)
  ctx.fillStyle = '#5c3a10'; ctx.fillRect(x, y + 5, 72, 1)
  const bookPal = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#16a085']
  for (let i = 0; i < count; i++) {
    const bx = x + 2 + i * 10, bh = 18 + (i % 3) * 4
    ctx.fillStyle = bookPal[i % bookPal.length]
    ctx.fillRect(bx, y - bh, 8, bh)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(bx, y - bh, 1, bh)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';        ctx.fillRect(bx + 7, y - bh, 1, bh)
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#b84c14'; ctx.fillRect(x + 5, y + 14, 18, 16)
  ctx.fillStyle = '#963a0a'; ctx.fillRect(x + 3, y + 12, 22, 4)
  ctx.fillStyle = '#2d1808'; ctx.fillRect(x + 5, y + 14, 18, 5)
  ctx.strokeStyle = '#1a5c18'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x + 14, y + 13); ctx.lineTo(x + 14, y + 5); ctx.stroke()
  const leaf = (lx: number, ly: number, r: number, col: string) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill()
  }
  leaf(x + 14, y + 3, 8, '#1a6b1a')
  leaf(x + 6,  y + 9, 6, '#1e8020')
  leaf(x + 22, y + 9, 6, '#1e8020')
  leaf(x + 10, y - 3, 5, '#22a022')
  leaf(x + 18, y - 3, 5, '#22a022')
}

function drawDesk(ctx: CanvasRenderingContext2D, cx: number, y: number) {
  const DW = 72, DH = 20, DTH = 10
  const x = cx - DW / 2
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 4, y + 4, DW, DH + DTH)
  ctx.fillStyle = '#c8894a'; ctx.fillRect(x, y - DH, DW, DH)
  ctx.fillStyle = '#dfa058'; ctx.fillRect(x, y - DH, DW, 3)
  ctx.strokeStyle = '#7a4f18'; ctx.lineWidth = 1; ctx.strokeRect(x, y - DH, DW, DH)
  ctx.fillStyle = '#8b5520'; ctx.fillRect(x, y, DW, DTH)
  ctx.fillStyle = '#6a3f12'; ctx.fillRect(x, y + DTH - 2, DW, 2)
  ctx.fillStyle = '#5c3510'
  ctx.fillRect(x + 3, y + DTH, 6, 12)
  ctx.fillRect(x + DW - 9, y + DTH, 6, 12)
  const mx = cx + 8
  ctx.fillStyle = '#606060'; ctx.fillRect(mx - 11, y - DH - 20, 22, 16)
  ctx.fillStyle = '#96e0f0'; ctx.fillRect(mx - 9, y - DH - 18, 18, 12)
  ctx.fillStyle = '#4aaabb'
  ctx.fillRect(mx - 7, y - DH - 16, 14, 2)
  ctx.fillRect(mx - 7, y - DH - 12, 10, 2)
  ctx.fillStyle = '#555'
  ctx.fillRect(mx - 2, y - DH - 4, 4, 4)
  ctx.fillRect(mx - 6, y - DH, 12, 2)
  ctx.fillStyle = '#b0b0b0'; ctx.fillRect(cx - 18, y - DH + 7, 20, 8)
  ctx.fillStyle = '#d0d0d0'; ctx.fillRect(cx - 17, y - DH + 8, 18, 6)
  ctx.fillStyle = '#999'
  for (let k = 0; k < 4; k++) ctx.fillRect(cx - 16 + k * 4, y - DH + 9, 3, 2)
  for (let k = 0; k < 4; k++) ctx.fillRect(cx - 16 + k * 4, y - DH + 12, 3, 2)
  ctx.fillStyle = '#b0b0b0'; ctx.fillRect(cx + 6, y - DH + 7, 8, 11)
  ctx.fillStyle = '#888';    ctx.fillRect(cx + 9, y - DH + 7, 1, 11)
}

function drawClock(ctx: CanvasRenderingContext2D) {
  const d = new Date()
  const cxc = 50, cyc = 10
  ctx.fillStyle = '#f0e8d8'; ctx.beginPath(); ctx.arc(cxc, cyc, 9, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cxc, cyc, 9, 0, Math.PI * 2); ctx.stroke()
  const min = d.getMinutes(), hr = d.getHours() % 12
  const ma = (min / 60) * Math.PI * 2 - Math.PI / 2
  const ha = ((hr + min / 60) / 12) * Math.PI * 2 - Math.PI / 2
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cxc, cyc); ctx.lineTo(cxc + Math.cos(ma) * 6, cyc + Math.sin(ma) * 6); ctx.stroke()
  ctx.lineWidth = 2;   ctx.beginPath(); ctx.moveTo(cxc, cyc); ctx.lineTo(cxc + Math.cos(ha) * 4, cyc + Math.sin(ha) * 4); ctx.stroke()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ═══════════════════════════════════════════════════════════════
//  DRAW SCENE
// ═══════════════════════════════════════════════════════════════
function drawScene(ctx: CanvasRenderingContext2D, chars: Char[], now: number) {
  drawFloor(ctx)
  drawWalls(ctx)
  drawZones(ctx)

  // Bookshelves on left wall
  drawShelf(ctx, 18, 52, 7)
  drawShelf(ctx, 18, 128, 6)

  // Plants in dead corners
  drawPlant(ctx, 20, 256)
  drawPlant(ctx, 20, 360)
  drawPlant(ctx, 558, 256)
  drawPlant(ctx, 482, 360)

  drawClock(ctx)

  // All desks always visible; name label only on empty seats
  const occupiedPositions = new Set(chars.map(c => `${c.x},${c.y}`))
  SEATS.forEach(s => {
    drawDesk(ctx, s.x, s.y)
    if (!occupiedPositions.has(`${s.x},${s.y}`)) {
      ctx.font = 'bold 7px monospace'
      ctx.textAlign = 'center'
      const tw = ctx.measureText(s.name).width
      ctx.fillStyle = 'rgba(10,8,20,0.55)'
      roundRect(ctx, s.x - tw / 2 - 4, s.y + 2, tw + 8, 10, 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fillText(s.name, s.x, s.y + 10)
    }
  })

  // Characters sorted by y for depth
  const sorted = [...chars].sort((a, b) => a.y - b.y)
  sorted.forEach((ch, idx) => {
    const def = ANIMS[ch.anim]
    if (now - ch.lastTick > 1000 / def.fps) {
      ch.frame = (ch.frame + 1) % def.cols.length
      ch.lastTick = now
    }

    const charH = CFH * CS, charW = CFW * CS
    const cx3 = Math.round(ch.x - charW / 2)
    const cy3 = Math.round(ch.y - charH)

    const img = spriteCache[ch.p.sprite % 6]
    if (img) {
      const col = def.cols[ch.frame]
      const row = ch.dir
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, col * CFW, row * CFH, CFW, CFH, cx3, cy3, charW, charH)
    } else {
      const fbW = 8 * PX
      drawFallback(ctx, Math.round(ch.x - fbW / 2), Math.round(ch.y - 12 * PX), SHIRT_COLORS[idx % SHIRT_COLORS.length], ch.anim, ch.frame)
    }

    // Name tag
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    const tw = ctx.measureText(ch.p.name).width
    const tagY = cy3 - 4
    ctx.fillStyle = 'rgba(10,8,20,0.78)'
    roundRect(ctx, ch.x - tw / 2 - 5, tagY - 9, tw + 10, 11, 3)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(ch.p.name, ch.x, tagY)
  })
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════
export interface OfficePerson { id: string; name: string; sprite: number; gender: string }

export default function OfficeCanvas({ persons }: { persons: OfficePerson[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const charsRef  = useRef<Char[]>([])
  const rafRef    = useRef(0)
  const [clock, setClock]   = useState('')
  const [date, setDate]     = useState('')
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60000)
    return () => clearInterval(t)
  }, [router])

  // Build characters from persons — named staff go to their fixed seat
  useEffect(() => {
    const usedSeats = new Set<number>()
    let overflowIdx = 0
    charsRef.current = persons.slice(0, SEATS.length).map((p) => {
      const key = p.name.toLowerCase()
      let seatIdx = NAMED_SEATS[key]
      if (seatIdx === undefined || usedSeats.has(seatIdx)) {
        while (overflowIdx < OVERFLOW_SEAT_INDICES.length && usedSeats.has(OVERFLOW_SEAT_INDICES[overflowIdx])) overflowIdx++
        seatIdx = OVERFLOW_SEAT_INDICES[overflowIdx] ?? 0
        overflowIdx++
      }
      usedSeats.add(seatIdx)
      return {
        p,
        x: SEATS[seatIdx].x,
        y: SEATS[seatIdx].y,
        anim: ALL_ANIMS[seatIdx % ALL_ANIMS.length],
        frame: 0,
        dir: SEATS[seatIdx].dir,
        lastTick: 0,
      }
    })
    ensureSprites(() => setLoaded(true))
  }, [persons])

  // Clock
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setClock(n.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDate(n.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // Random animation changes
  useEffect(() => {
    const t = setInterval(() => {
      const chars = charsRef.current
      if (!chars.length) return
      const pick = chars[Math.floor(Math.random() * chars.length)]
      const others = ALL_ANIMS.filter(a => a !== pick.anim)
      pick.anim = others[Math.floor(Math.random() * others.length)]
      pick.frame = 0
    }, 3200)
    return () => clearInterval(t)
  }, [])

  // Render loop
  useEffect(() => {
    if (!loaded && !spritesReady) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop)
      ctx.clearRect(0, 0, CW, CH)
      drawScene(ctx, charsRef.current, now)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [loaded])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background p-3 md:p-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-3 max-w-screen-xl mx-auto">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground">Office Today</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">{date}</p>
          <span className="inline-block mt-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-0.5 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
            ● {persons.length} in office
          </span>
        </div>
        <div className="text-right">
          <div className="text-xl md:text-2xl font-black tabular-nums text-foreground">{clock}</div>
          <div className="text-emerald-500 text-[10px] font-bold mt-0.5">● LIVE</div>
        </div>
      </div>

      {/* Canvas — scrollable on mobile, full-width on desktop */}
      <div className="max-w-screen-xl mx-auto rounded-2xl overflow-hidden border border-border shadow-lg overflow-x-auto">
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="w-full h-auto block min-w-[480px]"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Mobile person cards — only shown on small screens */}
      {persons.length > 0 && (
        <div className="max-w-screen-xl mx-auto mt-4 md:hidden">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">People in today</p>
          <div className="grid grid-cols-2 gap-2">
            {persons.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2.5 shadow-sm">
                <span className="text-xl leading-none">{p.gender?.toLowerCase() === 'female' ? '👩' : '👨'}</span>
                <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {persons.length === 0 && (
        <div className="max-w-screen-xl mx-auto mt-6 text-center py-10 rounded-2xl border border-dashed border-border">
          <p className="text-3xl mb-2">🏢</p>
          <p className="text-muted-foreground font-medium">No one is clocked in yet today</p>
          <Link href="/attendance" className="inline-block mt-3 text-sm text-primary font-semibold hover:underline">Clock in now</Link>
        </div>
      )}

      <p className="max-w-screen-xl mx-auto mt-3 text-center text-[11px] text-muted-foreground/50">
        Updates live as staff clock in &amp; out · refreshes every 60s
      </p>
    </div>
  )
}
