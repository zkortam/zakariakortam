'use client'

import { Inter } from 'next/font/google'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { BOARDS, type InkBoard } from './helio/boards'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

/*
 * Helio's landing lesson, ported from helio/web/src/surfaces/site/LessonDemo.tsx: Helio's own
 * handwriting (the strokes its Rust core compiled), its captions, its timing tokens (site.demo.*)
 * and the board, caption pill and presence chip as helio.education draws them. Helio writes the
 * equation line by line while the caption speaks, a highlight sweeps the 3(x − 2) it is talking
 * about, the pen draws arrows to share the 3, then hands over: the student writes x = 11 in their
 * own colour and Helio rings and checks it. Opens mid-lesson; holds still off screen or in a
 * hidden tab; one still frame (the finished board) under reduced motion.
 */

const EM = 40 // the board grid's em
const LINES = ['l0', 'l1', 'l2']
const HL_RADIUS = 6
const SECOND_ARROW = 0.5
const widthEm = (w: number) => ({ width: `${(w / EM).toFixed(3)}em` })

// site.demo.* tokens
const MS = { word: 230, write: 1100, sweep: 700, hold: 1200, rest: 3200 }

const SAY = [
  'Let’s solve this one together.',
  'First, share the 3 with both terms inside.',
  'Now take 2x away from both sides.',
  'Your turn. What is x?',
  'Yes. You added 6 to both sides.',
]
const CHIP = { speaking: 'Speaking', your_turn: 'Your turn', listening: 'Listening' }

interface Frame {
  say: number
  done: number
  writing: number
  highlight: 'off' | 'sweep' | 'on'
  arrows: 'off' | 'drawing' | 'done'
  student: 'off' | 'writing' | 'done'
  circle: 'off' | 'drawing' | 'done'
  chip: keyof typeof CHIP
  speak: boolean
}

const BLANK: Frame = { say: -1, done: 0, writing: -1, highlight: 'off', arrows: 'off', student: 'off', circle: 'off', chip: 'listening', speak: false }
const FRAMES: Frame[] = [
  BLANK,
  { ...BLANK, say: 0, writing: 0, chip: 'speaking', speak: true },
  { ...BLANK, say: 1, done: 1, highlight: 'sweep', arrows: 'drawing', chip: 'speaking', speak: true },
  { ...BLANK, say: 1, done: 1, writing: 1, highlight: 'on', arrows: 'done', chip: 'speaking' },
  { ...BLANK, say: 2, done: 2, writing: 2, arrows: 'done', chip: 'speaking', speak: true },
  { ...BLANK, say: 3, done: 3, arrows: 'done', chip: 'speaking', speak: true },
  { ...BLANK, say: 3, done: 3, arrows: 'done', student: 'writing', chip: 'your_turn' },
  { ...BLANK, say: 4, done: 3, arrows: 'done', student: 'done', circle: 'drawing', chip: 'speaking', speak: true },
]
const OPEN = 3
const OPENING: Frame = { ...FRAMES[OPEN], arrows: 'drawing' }
const FINAL: Frame = { ...FRAMES[FRAMES.length - 1], circle: 'done', speak: false }

const words = (i: number) => (i < 0 ? [] : SAY[i].split(' '))

function timeline(): number[] {
  const said = (i: number) => words(i).length * MS.word
  return [
    MS.hold,
    Math.max(said(0), MS.write) + MS.hold,
    MS.sweep + MS.hold,
    Math.max(said(1) - MS.sweep - MS.hold, MS.write) + MS.hold,
    Math.max(said(2), MS.write) + MS.hold,
    said(3) + MS.hold,
    MS.write + MS.hold,
    Math.max(said(4), MS.write) + MS.rest,
  ]
}
const DURATIONS = timeline()

function useLesson(playing: boolean, visible: boolean, still: boolean) {
  const [index, setIndex] = useState(OPEN)
  const [opening, setOpening] = useState(true)
  const [word, setWord] = useState(0)

  useEffect(() => {
    if (still || !playing || !visible) return
    const id = window.setTimeout(() => {
      const next = (index + 1) % FRAMES.length
      setOpening(false)
      setIndex(next)
      if (FRAMES[next].speak) setWord(0)
    }, DURATIONS[index] ?? MS.hold)
    return () => window.clearTimeout(id)
  }, [index, playing, visible, still])

  const frame = opening && index === OPEN ? OPENING : FRAMES[index]
  useEffect(() => {
    if (still || !playing || !visible || frame.say < 0) return
    if (word >= words(frame.say).length) return
    const id = window.setTimeout(() => setWord((w) => w + 1), MS.word)
    return () => window.clearTimeout(id)
  }, [word, frame.say, playing, visible, still])

  return still ? { frame: FINAL, word: -1 } : { frame, word }
}

function InkSvg({
  board,
  style,
  states,
  lag,
  under,
}: {
  board: InkBoard
  style?: CSSProperties
  states: (id: string) => 'hidden' | 'writing' | 'done'
  lag?: (id: string) => number
  under?: ReactNode
}) {
  const [x, y, w, h] = board.view
  return (
    <svg className="hx-ink" viewBox={`${x} ${y} ${w} ${h}`} width={w} height={h} aria-hidden="true" focusable="false" style={style}>
      {under}
      {board.parts.map((p) => (
        <path
          key={p.id}
          className="hx-part"
          data-tone={p.tone}
          data-state={states(p.id)}
          d={p.d}
          pathLength={1}
          strokeWidth={p.width}
          style={{ '--lag': `${lag?.(p.id) ?? 0}ms` } as CSSProperties}
        />
      ))}
    </svg>
  )
}

function Caption({ say, word }: { say: number; word: number }) {
  if (say < 0) return <span className="hx-caption hx-caption-empty" />
  const ws = words(say)
  return (
    <span className="hx-caption" key={say}>
      <span>
        {ws.map((w, i) => (
          <span key={`${w}-${i}`}>
            <span className={i === word ? 'hx-word' : undefined}>{w}</span>
            {i < ws.length - 1 ? ' ' : null}
          </span>
        ))}
      </span>
    </span>
  )
}

export function HelioLesson() {
  const ref = useRef<HTMLElement>(null)
  const [still, setStill] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setStill(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const el = ref.current
    let onScreen = true
    const sync = () => setVisible(onScreen && document.visibilityState === 'visible')
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting)
      sync()
    })
    if (el) io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  const { frame, word } = useLesson(playing, visible, still)
  const lineState = (i: number) => (i < frame.done ? 'done' : i === frame.writing ? 'writing' : 'hidden')
  const write = (on: 'off' | 'writing' | 'drawing' | 'done') => (on === 'off' ? 'hidden' : on === 'done' ? 'done' : 'writing')
  const lineOf = (id: string) => {
    const i = LINES.indexOf(id)
    return i >= 0 ? lineState(i) : write(frame.arrows)
  }
  const answerOf = (id: string) => (id === 'answer' ? write(frame.student) : write(frame.circle))
  const lines = BOARDS.heroLines
  const answer = BOARDS.heroAnswer
  const term = lines.boxes.term

  return (
    <figure
      ref={ref}
      className={`hx ${inter.className}`}
      aria-label="A short lesson. Helio solves an equation on the board, then hands the pen to the student."
      data-still={still ? 'true' : undefined}
      data-halted={!playing || !visible ? 'true' : undefined}
      data-no-swipe=""
    >
      <div className="hx-frame" aria-hidden="true">
        <div className="hx-board">
          <span className="hx-topic">Grade 8 math</span>
          <div className="hx-work">
            <div className="hx-lines">
              <InkSvg
                board={lines}
                style={widthEm(lines.view[2])}
                states={lineOf}
                lag={(id) => (id.startsWith('a2') ? MS.sweep * SECOND_ARROW : 0)}
                under={<rect className="hx-hl" data-highlight={frame.highlight} x={term.x} y={term.y} width={term.w} height={term.h} rx={HL_RADIUS} />}
              />
            </div>
            <span className="hx-answer">
              <InkSvg board={answer} style={widthEm(answer.view[2])} states={answerOf} lag={(id) => (id === 'check' ? MS.write : 0)} />
            </span>
          </div>
          <div className="hx-bottom">
            <Caption say={frame.say} word={word} />
            <span className="hx-dock" data-speaking={frame.chip === 'speaking' ? '' : undefined}>
              <span className="hx-glow" />
              <span className="hx-chip" data-chip={frame.chip}>
                {CHIP[frame.chip]}
              </span>
            </span>
          </div>
        </div>
      </div>
      {!still && (
        <div className="hx-controls">
          <button type="button" className="hx-toggle" onClick={() => setPlaying((p) => !p)}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              {playing ? <path d="M9 6v12M15 6v12" /> : <path d="M8 5.5v13l10.5-6.5z" />}
            </svg>
            {playing ? 'Pause the demo' : 'Play the demo'}
          </button>
        </div>
      )}
    </figure>
  )
}
