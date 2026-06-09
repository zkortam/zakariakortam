'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'

/** Deterministic PRNG so server and client render the same graph. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 120
const H = 160

/**
 * Abstract node-graph "system" graphic — nodes wired by proximity, a few
 * accent nodes quietly pulsing. Reads as signal/agent topology, not an icon.
 */
export function Constellation({
  seed = 1,
  nodes: count = 13,
  className = '',
}: {
  seed?: number
  nodes?: number
  className?: string
}) {
  const { nodes, edges } = useMemo(() => {
    const r = mulberry32(seed * 9973 + 17)
    const pts = Array.from({ length: count }, (_, i) => ({
      x: 10 + r() * (W - 20),
      y: 10 + r() * (H - 20),
      accent: r() > 0.74,
      size: 0.9 + r() * 1.4,
      i,
    }))
    const es: { a: number; b: number; key: string }[] = []
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y)
        if (d < 46) es.push({ a, b, key: `${a}-${b}` })
      }
    }
    return { nodes: pts, edges: es }
  }, [seed, count])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      <g stroke="rgb(255 255 255 / 0.1)" strokeWidth={0.3}>
        {edges.map((e) => (
          <line
            key={e.key}
            x1={nodes[e.a].x}
            y1={nodes[e.a].y}
            x2={nodes[e.b].x}
            y2={nodes[e.b].y}
          />
        ))}
      </g>
      {nodes.map((n) =>
        n.accent ? (
          <motion.circle
            key={n.i}
            cx={n.x}
            cy={n.y}
            r={n.size + 0.4}
            fill="rgb(168 58 70)"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.35, 1, 0.35], scale: [1, 1.35, 1] }}
            transition={{
              duration: 3 + (n.i % 3),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: (n.i % 5) * 0.4,
            }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
        ) : (
          <circle
            key={n.i}
            cx={n.x}
            cy={n.y}
            r={n.size}
            fill="rgb(255 255 255 / 0.35)"
          />
        ),
      )}
    </svg>
  )
}
