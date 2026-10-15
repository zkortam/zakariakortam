'use client'

import { Inter } from 'next/font/google'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './airofind.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

/*
 * AiroFind's search, ported from AiroFind/components: the results screen's SearchSummary pill, the
 * loading screen (ui/LoadingAnimation driving ui/FlightArc) and the results (ResultsList header,
 * ui/FlightCard). Every value on the cards is the real San Francisco to New York search from the
 * app's own results screenshot. Classes, sizes and colours are the compiled Tailwind of the real
 * app, including its quirk that `text-muted/NN` classes never compile (the muted colour is a CSS
 * variable), so those lines render in the foreground white exactly as AiroFind shows them.
 * The only change is time: a real search cruises for about a minute; here the results "arrive"
 * after a few seconds. Holds still off screen or in a hidden tab; reduced motion shows the results.
 */

// LoadingAnimation's real motion, on a compressed clock (seconds).
const EXPECTED = 6 // expectedSeconds (the real app uses 40 to 95)
const COMPLETE = 4.2 // when this demo's results come back
const LAND = 0.8 // the real 800 ms final approach
const FADE = 0.32 // FADE_MS
const HOLD = 7 // results on screen before the demo starts over
const OUT = 0.4

const cruise = (s: number) => 0.94 * (1 - Math.exp((-1.9 * s) / EXPECTED))
const FROM = cruise(COMPLETE)
// LoadingAnimation leaves once progress reaches 0.999.
const LEAVE = COMPLETE + LAND * (1 - Math.cbrt(0.001 / (1 - FROM)))
const RESULTS = LEAVE + FADE
const END = RESULTS + HOLD
const LOOP = END + OUT

function progressAt(s: number) {
  if (s < COMPLETE) return cruise(s)
  const t = Math.min(1, (s - COMPLETE) / LAND)
  return FROM + (1 - FROM) * (1 - Math.pow(1 - t, 3))
}

// The search as SearchSummary shows it.
const SEARCH = { origin: 'San Francisco', destination: 'New York', details: ['Nov 10 – Nov 24', '4–7d', 'Economy'] }

interface Leg {
  date: string // FlightCard's formatDate
  compact: string // formatDateCompact
  dep: string
  from: string
  arr: string
  to: string
  duration: string
}
interface Flight {
  price: string
  airline: string
  code: 'DL' | 'B6'
  outbound: Leg
  ret: Leg
  days: number
  temp: string // WeatherBadge: New York in November, 9 °C / 48 °F
}

const FLIGHTS: Flight[] = [
  {
    price: '$387',
    airline: 'Delta',
    code: 'DL',
    outbound: { date: 'Wed, Nov 11', compact: '11/11', dep: '22:25', from: 'SFO', arr: '06:47', to: 'JFK', duration: '5h 22m' },
    ret: { date: 'Tue, Nov 17', compact: '11/17', dep: '07:00', from: 'JFK', arr: '10:35', to: 'SFO', duration: '6h 35m' },
    days: 6,
    temp: '9° / 48°',
  },
  {
    price: '$387',
    airline: 'JetBlue',
    code: 'B6',
    outbound: { date: 'Wed, Nov 11', compact: '11/11', dep: '22:56', from: 'SFO', arr: '07:24', to: 'JFK', duration: '5h 28m' },
    ret: { date: 'Tue, Nov 17', compact: '11/17', dep: '06:00', from: 'JFK', arr: '09:30', to: 'SFO', duration: '6h 30m' },
    days: 6,
    temp: '9° / 48°',
  },
]

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/* ---------- ui/SearchSummary ---------- */

function SearchSummary() {
  return (
    <div className="af-summary">
      <div className="af-summary-text">
        <div className="af-route">
          <span className="af-truncate">{SEARCH.origin}</span>
          <svg className="af-route-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span className="af-truncate">{SEARCH.destination}</span>
        </div>
        <div className="af-details">
          {SEARCH.details.map((d, i) => (
            <span key={d} className="af-detail">
              <span>{d}</span>
              {i < SEARCH.details.length - 1 && <span className="af-sep">·</span>}
            </span>
          ))}
        </div>
      </div>
      <span className="af-new">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
        </svg>
      </span>
    </div>
  )
}

/* ---------- ui/FlightArc ---------- */

function FlightArc({ progress, origin, destination, maxWidth = 640 }: { progress: number; origin: string; destination: string; maxWidth?: number }) {
  const [width, setWidth] = useState(maxWidth)
  const boxRef = useRef<HTMLDivElement>(null)

  useIsoLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => setWidth(Math.max(240, Math.min(maxWidth, box.clientWidth)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [maxWidth])

  const inset = Math.max(60, Math.min(110, width * 0.17))
  const baseline = width * 0.3
  const p0 = { x: inset, y: baseline }
  const p1 = { x: width / 2, y: -width * 0.06 }
  const p2 = { x: width - inset, y: baseline }
  const arc = `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`
  const height = baseline + 16

  const t = Math.max(0, Math.min(1, progress))
  const u = 1 - t
  const at = {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    angle: (Math.atan2(2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y), 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x)) * 180) / Math.PI,
  }
  const arrived = t >= 0.999

  return (
    <div ref={boxRef} className="af-arc" style={{ maxWidth }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="af-arc-svg" fill="none" aria-hidden="true" focusable="false">
        <path d={arc} stroke="#fff" strokeOpacity="0.28" strokeWidth="2" strokeDasharray="0.01 9" strokeLinecap="round" />
        <path d={arc} stroke="#fff" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - t} />
        <circle cx={p0.x} cy={p0.y} r="4.5" fill="#fff" />
        <circle cx={p2.x} cy={p2.y} r="3.5" fill={arrived ? '#fff' : '#000'} stroke="#fff" strokeWidth="2" />
        <g transform={`translate(${at.x} ${at.y}) rotate(${at.angle})`} stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-11 0 H11" strokeWidth="5.5" />
          <path d="M3 0 L-4.5 -11.5 M3 0 L-4.5 11.5" strokeWidth="4.5" />
          <path d="M-10.5 0 L-13.5 -4.8 M-10.5 0 L-13.5 4.8" strokeWidth="3.5" />
        </g>
      </svg>
      <div className="af-arc-labels" style={{ width }}>
        {[
          { x: p0.x, name: origin },
          { x: p2.x, name: destination },
        ].map((end, i) => (
          <p key={i} className="af-arc-label" style={{ left: end.x, maxWidth: inset * 2 + 24 }}>
            {end.name}
          </p>
        ))}
      </div>
    </div>
  )
}

/* ---------- ui/FlightCard ---------- */

function FlightLeg({ leg }: { leg: Leg }) {
  return (
    <div className="af-leg">
      <div className="af-leg-end af-leg-start">
        <p className="af-time">{leg.dep}</p>
        <p className="af-airport">{leg.from}</p>
      </div>
      <div className="af-leg-mid">
        <p className="af-duration">{leg.duration}</p>
        <div className="af-leg-line">
          <div className="af-rule" />
          <div className="af-stop" />
          <div className="af-rule" />
        </div>
      </div>
      <div className="af-leg-end">
        <p className="af-time">{leg.arr}</p>
        <p className="af-airport">{leg.to}</p>
      </div>
    </div>
  )
}

function FlightCard({ flight, rank }: { flight: Flight; rank: number }) {
  return (
    <div className="af-card">
      <div className="af-card-head">
        <div className="af-card-price">
          <p className="af-price">{flight.price}</p>
          {rank === 1 && <span className="af-cheapest">Cheapest</span>}
        </div>
        <div className="af-card-airline">
          <span className="af-airline">{flight.airline}</span>
          <div className="af-logo">
            {/* The square logo AiroFind loads from Kiwi's CDN (images.kiwi.com/airlines/128), kept locally. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/work/airofind/${flight.code}.png`} alt="" width={28} height={28} />
          </div>
        </div>
      </div>
      <div className="af-legs">
        <div className="af-compact">
          <p className="af-label">
            {flight.outbound.compact} - {flight.ret.compact}
          </p>
        </div>
        <div>
          <p className="af-label af-label-full">{flight.outbound.date}</p>
          <FlightLeg leg={flight.outbound} />
        </div>
        <div>
          <p className="af-label af-label-full">{flight.ret.date}</p>
          <FlightLeg leg={flight.ret} />
        </div>
      </div>
      <div className="af-card-foot">
        <span>{flight.days} days</span>
        <span className="af-weather">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <span>{flight.temp}</span>
        </span>
      </div>
    </div>
  )
}

const Chevron = () => (
  <svg className="af-chev" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

/* ---------- ResultsList ---------- */

function Results() {
  return (
    <div className="af-results">
      <div className="af-results-head">
        <p className="af-count">20 options found</p>
        <div className="af-pills">
          <span className="af-pill">
            All airlines
            <Chevron />
          </span>
          <span className="af-pill">
            Any stops
            <Chevron />
          </span>
          <span className="af-sort">
            <span className="af-pill af-pill-left">
              Price
              <Chevron />
            </span>
            <span className="af-pill af-pill-right">
              <svg className="af-dir" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </span>
          </span>
        </div>
      </div>
      <div className="af-list">
        {FLIGHTS.map((f, i) => (
          <div key={i} className="af-slide-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <FlightCard flight={f} rank={i + 1} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- The demo ---------- */

export function AiroGrid() {
  const ref = useRef<HTMLElement>(null)
  const [still, setStill] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [visible, setVisible] = useState(true)
  const [t, setT] = useState(0)
  const [run, setRun] = useState(0)
  const clock = useRef(0)

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

  const running = playing && visible && !still
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const next = clock.current + dt
      if (next < LOOP) {
        clock.current = next
      } else {
        clock.current = 0
        setRun((r) => r + 1)
      }
      setT(clock.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const replay = () => {
    clock.current = 0
    setT(0)
    setRun((r) => r + 1)
    setPlaying(true)
  }

  const now = still ? RESULTS : t
  const loading = now < RESULTS

  return (
    <figure
      ref={ref}
      className={`af ${inter.className}`}
      aria-label="AiroFind searching San Francisco to New York: the plane flies the route while it searches, then the cheapest round trips appear, a $387 Delta flight first."
      data-still={still ? 'true' : undefined}
      data-halted={!running ? 'true' : undefined}
      data-no-swipe=""
    >
      <div className="af-screen" aria-hidden="true">
        <div className="af-page">
          <SearchSummary />
          {loading ? (
            <div key={`l${run}`} className="af-loading" data-leaving={now >= LEAVE ? 'true' : undefined}>
              <FlightArc progress={progressAt(now)} origin={SEARCH.origin} destination={SEARCH.destination} />
            </div>
          ) : (
            <div key={`r${run}`} className="af-out" data-out={now >= END ? 'true' : undefined}>
              <Results />
            </div>
          )}
        </div>
      </div>
      {!still && (
        <div className="af-controls">
          <button type="button" className="af-toggle" onClick={() => setPlaying((p) => !p)}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              {playing ? <path d="M9 6v12M15 6v12" /> : <path d="M8 5.5v13l10.5-6.5z" />}
            </svg>
            {playing ? 'Pause the demo' : 'Play the demo'}
          </button>
          <button type="button" className="af-toggle" onClick={replay}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />
            </svg>
            Replay the search
          </button>
        </div>
      )}
    </figure>
  )
}
