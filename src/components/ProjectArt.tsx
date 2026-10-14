'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { ShaderGradient } from './ShaderGradient'

/**
 * Animated line illustrations, one per project. Drawn on a 400×280 board,
 * white ink with maroon accents. Strokes draw in when scrolled into view,
 * then a quiet loop keeps the piece alive.
 */

const INK = 'rgba(246,244,241,0.55)'
const FAINT = 'rgba(246,244,241,0.14)'
const RED = '#C2475A'
const EASE = [0.16, 1, 0.3, 1] as const

type Ctx = { on: boolean; still: boolean }

const draw = (on: boolean, delay = 0, duration = 1.4) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: on ? { pathLength: 1, opacity: 1 } : {},
  transition: { pathLength: { duration, delay, ease: EASE }, opacity: { duration: 0.3, delay } },
})

const pop = (on: boolean, delay = 0) => ({
  initial: { opacity: 0, scale: 0.6 },
  animate: on ? { opacity: 1, scale: 1 } : {},
  transition: { duration: 0.7, delay, ease: EASE },
})

/** Loop helper: repeats while on, freezes for reduced motion. */
const loop = (c: Ctx, frames: Record<string, number[] | string[]>, duration: number, delay = 0) =>
  c.on && !c.still
    ? { animate: frames, transition: { duration, delay, repeat: Infinity, ease: 'easeInOut' as const } }
    : {}

function DotGrid() {
  const dots: ReactNode[] = []
  for (let x = 20; x < 400; x += 20)
    for (let y = 20; y < 280; y += 20)
      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={0.9} fill={FAINT} />)
  return <g>{dots}</g>
}

/* ---------- pieces ---------- */

function Helio(c: Ctx) {
  // Axes, a parabola written by hand, a check when it's verified, a voice line.
  return (
    <>
      <DotGrid />
      <motion.path d="M70 200 H330" stroke={INK} strokeWidth={1.5} fill="none" {...draw(c.on, 0, 0.8)} />
      <motion.path d="M200 228 V48" stroke={INK} strokeWidth={1.5} fill="none" {...draw(c.on, 0.2, 0.8)} />
      <motion.path
        d="M112 64 C 150 210, 250 210, 288 64"
        stroke={RED}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        {...draw(c.on, 0.7, 1.8)}
      />
      <motion.path d="M300 70 l9 9 l17 -20" stroke={RED} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" {...draw(c.on, 2.5, 0.5)} />
      <motion.text x={216} y={84} fill={INK} fontSize={18} fontStyle="italic" fontFamily="Georgia, serif" {...pop(c.on, 2.2)}>
        y = x²
      </motion.text>
      {Array.from({ length: 22 }).map((_, i) => (
        <motion.rect
          key={i}
          x={112 + i * 8}
          y={246}
          width={3}
          rx={1.5}
          height={4}
          fill={i % 5 === 2 ? RED : INK}
          style={{ originY: '248px' }}
          {...loop(c, { height: [4, 6 + ((i * 7) % 16), 4], y: [246, 244 - ((i * 7) % 16) / 2, 246] }, 1.1 + (i % 4) * 0.2, i * 0.05)}
        />
      ))}
    </>
  )
}

function Surf(c: Ctx) {
  // A feed of glass cards that scrolls by.
  const card = (y: number, key: number) => (
    <g key={key} transform={`translate(0 ${y})`}>
      <rect x={120} y={0} width={160} height={118} rx={14} fill="rgba(255,255,255,0.04)" stroke={FAINT} />
      <circle cx={138} cy={18} r={7} fill={key % 2 ? RED : INK} opacity={0.8} />
      <rect x={152} y={13} width={60} height={4} rx={2} fill={INK} />
      <rect x={152} y={21} width={36} height={3} rx={1.5} fill={FAINT} />
      <rect x={130} y={34} width={140} height={64} rx={8} fill={`url(#surf-img-${key % 2})`} />
      <rect x={130} y={106} width={90} height={3} rx={1.5} fill={FAINT} />
    </g>
  )
  return (
    <>
      <defs>
        <linearGradient id="surf-img-0" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7A1A28" />
          <stop offset="1" stopColor="#2a0a10" />
        </linearGradient>
        <linearGradient id="surf-img-1" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1d1a1a" />
          <stop offset="1" stopColor="#5a2630" />
        </linearGradient>
        <clipPath id="surf-phone">
          <rect x={108} y={18} width={184} height={244} rx={26} />
        </clipPath>
      </defs>
      <motion.rect x={108} y={18} width={184} height={244} rx={26} fill="none" stroke={INK} strokeWidth={1.5} {...draw(c.on, 0, 1.2)} />
      <g clipPath="url(#surf-phone)">
        <motion.g
          initial={{ y: 30, opacity: 0 }}
          animate={c.on ? { opacity: 1, y: c.still ? 0 : [0, -132, -132, -264] } : {}}
          transition={
            c.still
              ? { duration: 0.8 }
              : { duration: 9, times: [0, 0.35, 0.5, 1], repeat: Infinity, ease: 'easeInOut', delay: 0.6 }
          }
        >
          {[0, 1, 2, 3, 4].map((k) => card(30 + k * 132, k))}
        </motion.g>
      </g>
      <motion.circle cx={318} cy={84} r={14} fill="none" stroke={RED} strokeWidth={1.5} {...pop(c.on, 1)} />
      <motion.path d="M318 78 c-4 -6 -12 -2 -8 5 l8 8 l8 -8 c4 -7 -4 -11 -8 -5" fill={RED} {...pop(c.on, 1.1)} {...loop(c, { scale: [1, 1.18, 1] }, 1.6, 1.4)} />
    </>
  )
}

function Messenger(c: Ctx) {
  // Bubbles arrive in turn, then typing dots.
  const bubbles = [
    { x: 86, y: 54, w: 150, me: false },
    { x: 196, y: 98, w: 118, me: true },
    { x: 86, y: 142, w: 112, me: false },
    { x: 172, y: 186, w: 142, me: true },
  ]
  return (
    <>
      <motion.rect x={66} y={26} width={268} height={228} rx={22} fill="rgba(255,255,255,0.025)" stroke={FAINT} {...pop(c.on, 0)} />
      {bubbles.map((b, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 14, scale: 0.9 }}
          animate={c.on ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.3 + i * 0.45, ease: EASE }}
          style={{ originX: b.me ? '100%' : '0%' }}
        >
          <rect x={b.x} y={b.y} width={b.w} height={32} rx={16} fill={b.me ? '#7A1A28' : 'rgba(255,255,255,0.08)'} stroke={b.me ? 'none' : FAINT} />
          <rect x={b.x + 14} y={b.y + 14} width={b.w * 0.55} height={4} rx={2} fill={b.me ? 'rgba(255,255,255,0.7)' : INK} />
        </motion.g>
      ))}
      <motion.g {...pop(c.on, 2.3)}>
        <rect x={86} y={222} width={58} height={22} rx={11} fill="rgba(255,255,255,0.08)" />
        {[0, 1, 2].map((i) => (
          <motion.circle key={i} cx={102 + i * 13} cy={233} r={3} fill={INK} {...loop(c, { opacity: [0.25, 1, 0.25] }, 1.2, i * 0.2)} />
        ))}
      </motion.g>
    </>
  )
}

function Spice(c: Ctx) {
  // An RC loop with current flowing, and the capacitor charging on a scope.
  const loopPath = 'M70 70 H170 l6 -10 l12 20 l12 -20 l12 20 l12 -20 l6 10 H300 V170 H70 Z'
  return (
    <>
      <motion.path d={loopPath} stroke={INK} strokeWidth={1.6} fill="none" strokeLinejoin="round" {...draw(c.on, 0, 2)} />
      {/* source */}
      <motion.g {...pop(c.on, 0.8)}>
        <rect x={58} y={104} width={24} height={34} fill="#0b0909" />
        <path d="M58 112 H82 M64 122 H76 M58 132 H82" stroke={INK} strokeWidth={1.6} />
      </motion.g>
      {/* capacitor */}
      <motion.g {...pop(c.on, 1)}>
        <rect x={290} y={108} width={20} height={26} fill="#0b0909" />
        <path d="M284 114 H316 M284 128 H316" stroke={RED} strokeWidth={2.4} />
      </motion.g>
      {c.on && !c.still &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} r={2.6} fill={RED}>
            <animateMotion dur="4.8s" begin={`${1.6 + i * 0.8}s`} repeatCount="indefinite" path={loopPath} />
          </circle>
        ))}
      {/* scope */}
      <motion.rect x={70} y={196} width={230} height={58} rx={8} fill="rgba(255,255,255,0.03)" stroke={FAINT} {...pop(c.on, 1.2)} />
      <motion.path d="M80 244 C 120 200, 160 210, 290 206" stroke={RED} strokeWidth={2} fill="none" strokeLinecap="round" {...draw(c.on, 1.6, 1.6)} />
      <motion.text x={80} y={212} fill={INK} fontSize={10} fontFamily="ui-monospace, monospace" {...pop(c.on, 1.5)}>
        .tran 5m
      </motion.text>
    </>
  )
}

function Airofind(c: Ctx) {
  // A route arc over a curved horizon, with a plane flying it.
  const route = 'M70 196 Q 200 40 330 150'
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <motion.ellipse key={i} cx={200} cy={330 + i * 10} rx={260 - i * 20} ry={120 - i * 8} fill="none" stroke={FAINT} {...draw(c.on, i * 0.15, 1.4)} />
      ))}
      <motion.path d={route} stroke={INK} strokeWidth={1.4} strokeDasharray="4 6" fill="none" {...draw(c.on, 0.4, 1.6)} />
      <motion.circle cx={70} cy={196} r={5} fill={INK} {...pop(c.on, 0.3)} />
      <motion.circle cx={330} cy={150} r={5} fill={RED} {...pop(c.on, 1.6)} />
      <motion.circle cx={330} cy={150} r={5} fill="none" stroke={RED} {...loop(c, { r: [5, 18], opacity: [0.8, 0] }, 1.8, 1.8)} />
      <motion.text x={52} y={222} fill={INK} fontSize={12} fontFamily="ui-monospace, monospace" {...pop(c.on, 0.4)}>SJC</motion.text>
      <motion.text x={316} y={178} fill={INK} fontSize={12} fontFamily="ui-monospace, monospace" {...pop(c.on, 1.7)}>JFK</motion.text>
      {c.on && !c.still && (
        <path d="M-8 -5 L8 0 L-8 5 L-4 0 Z" fill="#f6f4f1">
          <animateMotion dur="5s" begin="1s" repeatCount="indefinite" rotate="auto" path={route} />
        </path>
      )}
    </>
  )
}

function DigiCert(c: Ctx) {
  // Root, intermediate, leaf. The chain links up and the leaf is trusted.
  const nodes = [
    { x: 92, label: 'Root' },
    { x: 200, label: 'Intermediate' },
    { x: 308, label: 'Leaf' },
  ]
  return (
    <>
      <motion.path d="M118 130 H174 M226 130 H282" stroke={INK} strokeWidth={1.5} strokeDasharray="3 5" fill="none" {...draw(c.on, 0.8, 1)} />
      {nodes.map((n, i) => (
        <motion.g key={n.label} {...pop(c.on, 0.2 + i * 0.35)}>
          <rect x={n.x - 26} y={98} width={52} height={64} rx={10} fill="rgba(255,255,255,0.04)" stroke={i === 2 ? RED : INK} strokeWidth={1.4} />
          <path d={`M${n.x - 14} 116 H${n.x + 14} M${n.x - 14} 126 H${n.x + 8} M${n.x - 14} 136 H${n.x + 11}`} stroke={FAINT} strokeWidth={3} strokeLinecap="round" />
          <circle cx={n.x} cy={150} r={4} fill={i === 2 ? RED : INK} />
          <text x={n.x} y={186} textAnchor="middle" fill={INK} fontSize={11} fontFamily="ui-sans-serif, system-ui">
            {n.label}
          </text>
        </motion.g>
      ))}
      {/* padlock */}
      <motion.path d="M186 72 V58 a14 14 0 0 1 28 0 V72" stroke={INK} strokeWidth={2} fill="none" {...draw(c.on, 1.6, 0.8)} />
      <motion.rect x={178} y={70} width={44} height={8} rx={2} fill={INK} {...pop(c.on, 1.5)} />
      <motion.circle cx={308} cy={228} r={16} fill="none" stroke={RED} strokeWidth={2} {...draw(c.on, 2.2, 0.6)} />
      <motion.path d="M300 228 l6 6 l11 -12" stroke={RED} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" {...draw(c.on, 2.6, 0.4)} />
      <motion.circle cx={308} cy={228} r={16} fill="none" stroke={RED} {...loop(c, { r: [16, 30], opacity: [0.6, 0] }, 2, 3)} />
    </>
  )
}

function Facilis(c: Ctx) {
  // An agent in the middle, plant systems around it, signals going both ways.
  const sats = ['PLC', 'MES', 'SCADA', 'ERP', 'Historian', 'HMI'].map((label, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2
    return { label, x: 200 + Math.cos(a) * 112, y: 140 + Math.sin(a) * 92 }
  })
  return (
    <>
      {sats.map((s, i) => (
        <g key={s.label}>
          <motion.path d={`M200 140 L${s.x} ${s.y}`} stroke={FAINT} strokeWidth={1.2} {...draw(c.on, 0.3 + i * 0.1, 0.8)} />
          {c.on && !c.still && (
            <circle r={2.4} fill={RED}>
              <animateMotion dur="2.4s" begin={`${1.2 + i * 0.4}s`} repeatCount="indefinite" path={`M${s.x} ${s.y} L200 140`} />
            </circle>
          )}
          <motion.g {...pop(c.on, 0.6 + i * 0.1)}>
            <rect x={s.x - 30} y={s.y - 12} width={60} height={24} rx={12} fill="#0d0b0b" stroke={INK} strokeWidth={1.2} />
            <text x={s.x} y={s.y + 4} textAnchor="middle" fill={INK} fontSize={10} fontFamily="ui-monospace, monospace">
              {s.label}
            </text>
          </motion.g>
        </g>
      ))}
      <motion.circle cx={200} cy={140} r={24} fill="#7A1A28" {...pop(c.on, 0.1)} />
      <motion.circle cx={200} cy={140} r={24} fill="none" stroke={RED} {...loop(c, { r: [24, 46], opacity: [0.7, 0] }, 2.4, 1)} />
      <motion.path d="M190 140 h20 M200 130 v20" stroke="#fff" strokeWidth={2} strokeLinecap="round" {...pop(c.on, 0.3)} />
    </>
  )
}

function Incorta(c: Ctx) {
  // Bars that re-sort and a sparkline that draws over them.
  const heights = [60, 110, 84, 140, 96, 170, 128]
  return (
    <>
      <motion.path d="M60 230 H340" stroke={INK} strokeWidth={1.4} {...draw(c.on, 0, 0.8)} />
      {heights.map((h, i) => (
        <motion.rect
          key={i}
          x={74 + i * 38}
          width={22}
          rx={4}
          fill={i === 5 ? '#7A1A28' : 'rgba(255,255,255,0.14)'}
          initial={{ height: 0, y: 230 }}
          animate={
            c.on
              ? c.still
                ? { height: h, y: 230 - h }
                : { height: [h, heights[(i + 3) % 7], h], y: [230 - h, 230 - heights[(i + 3) % 7], 230 - h] }
              : {}
          }
          transition={c.still ? { duration: 1, delay: i * 0.08, ease: EASE } : { duration: 6, delay: i * 0.08, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <motion.path
        d="M85 150 L123 110 L161 128 L199 80 L237 104 L275 48 L313 70"
        stroke={RED}
        strokeWidth={2.4}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        {...draw(c.on, 0.8, 1.6)}
      />
      <motion.text x={60} y={40} fill={INK} fontSize={11} fontFamily="ui-monospace, monospace" {...pop(c.on, 0.4)}>
        {'{ "type": "bar" }'}
      </motion.text>
    </>
  )
}

function Inqueue(c: Ctx) {
  // People move up the line one at a time.
  return (
    <>
      <motion.rect x={300} y={92} width={56} height={96} rx={12} fill="none" stroke={RED} strokeWidth={1.6} {...draw(c.on, 0, 1)} />
      <motion.path d="M48 196 H290" stroke={FAINT} strokeWidth={1.2} {...draw(c.on, 0.2, 1)} />
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0 }}
          animate={
            c.on
              ? c.still
                ? { opacity: 1, x: 0 }
                : { opacity: [0, 1, 1, 1, 0], x: [-48, 0, 0, 48, 48] }
              : {}
          }
          transition={c.still ? { duration: 0.6 } : { duration: 3.2, times: [0, 0.2, 0.6, 0.85, 1], repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
        >
          <circle cx={78 + i * 48} cy={150} r={11} fill={i === 4 ? RED : INK} opacity={0.85} />
          <rect x={64 + i * 48} y={166} width={28} height={30} rx={10} fill={i === 4 ? RED : INK} opacity={0.5} />
        </motion.g>
      ))}
      <motion.text x={328} y={145} textAnchor="middle" fill="#f6f4f1" fontSize={28} fontFamily="Georgia, serif" {...pop(c.on, 0.6)}>
        3
      </motion.text>
      <motion.text x={328} y={168} textAnchor="middle" fill={INK} fontSize={9} fontFamily="ui-sans-serif, system-ui" {...pop(c.on, 0.7)}>
        ahead
      </motion.text>
    </>
  )
}

function Documap(c: Ctx) {
  // Two versions side by side, a scan line, and the changed clauses marked.
  const lines = (x: number, changed: number[]) =>
    Array.from({ length: 9 }).map((_, i) => (
      <motion.rect
        key={i}
        x={x + 16}
        y={58 + i * 20}
        width={i % 3 === 2 ? 70 : 104}
        height={5}
        rx={2.5}
        initial={{ fill: 'rgba(255,255,255,0.18)' }}
        animate={c.on && changed.includes(i) ? { fill: RED } : {}}
        transition={{ duration: 0.4, delay: 0.8 + i * 0.22 }}
      />
    ))
  return (
    <>
      <motion.rect x={60} y={36} width={136} height={208} rx={10} fill="rgba(255,255,255,0.03)" stroke={INK} strokeWidth={1.2} {...pop(c.on, 0)} />
      <motion.rect x={204} y={36} width={136} height={208} rx={10} fill="rgba(255,255,255,0.03)" stroke={INK} strokeWidth={1.2} {...pop(c.on, 0.15)} />
      {lines(60, [])}
      {lines(204, [2, 5, 6])}
      <motion.rect
        x={56}
        width={288}
        height={2}
        fill={RED}
        initial={{ y: 44, opacity: 0 }}
        animate={c.on ? (c.still ? { opacity: 0 } : { y: [44, 236], opacity: [0, 0.9, 0.9, 0] }) : {}}
        transition={{ duration: 3.4, repeat: c.still ? 0 : Infinity, ease: 'linear', delay: 0.6 }}
      />
    </>
  )
}

function Divide(c: Ctx) {
  // Rows of screens lighting up, lab by lab.
  return (
    <>
      {Array.from({ length: 24 }).map((_, i) => {
        const col = i % 6
        const row = Math.floor(i / 6)
        return (
          <motion.g key={i} {...pop(c.on, 0.05 * i)}>
            <motion.rect
              x={72 + col * 44}
              y={54 + row * 46}
              width={34}
              height={24}
              rx={4}
              stroke={INK}
              strokeWidth={1}
              initial={{ fill: 'rgba(255,255,255,0.02)' }}
              animate={c.on ? { fill: (i * 7) % 5 === 0 ? RED : 'rgba(255,255,255,0.12)' } : {}}
              transition={{ duration: 0.5, delay: 0.9 + ((i * 7) % 24) * 0.06 }}
            />
            <rect x={84 + col * 44} y={80 + row * 46} width={10} height={3} rx={1.5} fill={FAINT} />
          </motion.g>
        )
      })}
    </>
  )
}

function Nexus(c: Ctx) {
  const track = 'M50 200 C 110 80, 170 260, 230 140 S 330 60, 350 120'
  return (
    <>
      <motion.path d={track} stroke="rgba(255,255,255,0.22)" strokeWidth={10} strokeLinecap="round" fill="none" {...draw(c.on, 0, 1.6)} />
      {c.on && !c.still && (
        <g>
          <rect x={-9} y={-7} width={18} height={14} rx={3} fill={RED} />
          <animateMotion dur="6s" begin="1.4s" repeatCount="indefinite" rotate="auto" path={track} />
        </g>
      )}
    </>
  )
}

const PIECES: Record<string, (c: Ctx) => ReactNode> = {
  helio: Helio,
  surf: Surf,
  'surf-messenger': Messenger,
  'spice-plus-plus': Spice,
  airofind: Airofind,
  digicert: DigiCert,
  'facilis-ai': Facilis,
  'incorta-dashboards': Incorta,
  inqueue: Inqueue,
  'documap-ai': Documap,
  closingthedivide: Divide,
  'nexus-robot': Nexus,
}

export function hasArt(id: string) {
  return id in PIECES
}

export function ProjectArt({
  id,
  seed = 0.3,
  className = '',
}: {
  id: string
  seed?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const on = useInView(ref, { once: true, margin: '-10% 0px' })
  const still = !!useReducedMotion()
  const Piece = PIECES[id]

  return (
    <div ref={ref} className={`overflow-hidden ${className}`} aria-hidden="true">
      {/* maroon light underneath the glass */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(70% 60% at 70% 20%, rgba(122,26,40,0.45), transparent 70%), radial-gradient(60% 50% at 10% 100%, rgba(122,26,40,0.2), transparent 70%)',
        }}
      />
      {Piece ? (
        <svg viewBox="0 0 400 280" className="absolute inset-[6%] h-[88%] w-[88%]" preserveAspectRatio="xMidYMid meet">
          <Piece on={on} still={still} />
        </svg>
      ) : (
        <ShaderGradient seed={seed} className="absolute inset-0 block h-full w-full opacity-80" />
      )}
    </div>
  )
}
