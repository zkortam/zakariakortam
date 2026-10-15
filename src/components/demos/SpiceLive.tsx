'use client'

import { Inter } from 'next/font/google'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SYMBOLS } from '@/vendor/spicepp/schematic/components'
import type { ComponentInstance, SchematicDoc } from '@/vendor/spicepp/schematic/types'
import type { SimResult } from '@/vendor/spicepp/sim/types'
import { useLive } from './shared'
import { EXAMPLES, FIRST, openExample, type ExampleKey } from './spice/circuits'
import { drawSheet, fitView, partScreenRect, type Cam } from './spice/draw'
import { Dock, seedProbes } from './spice/Dock'
import { AttrField, Icon, SourceEditor, SpiceCode, SpiceInput } from './spice/ui'
import type { SpiceJob, SpiceOut } from './spice/spice.worker'
import './spice.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

/*
 * SPICE++ in the page: the app's own example circuits, drawn by its schematic renderer and solved
 * by its engine in a worker in this tab, with its waveform dock, Inspector and analysis bar. The
 * engine, netlister, examples, symbols and plotter are vendored unmodified (src/vendor/spicepp);
 * the canvas, dock and panels are ported from the app's components (see spice/draw.ts,
 * spice/Dock.tsx and spice/ui.tsx). Click a part to edit it the way the app does; every edit
 * runs the circuit again. Nothing loads until the demo is near the viewport.
 */

/** The app's canvas text is set in "Inter"; next/font registers Inter under a hashed family name,
 *  so the same files are registered once more under the plain name for the two canvases. */
let interAliased: Promise<void> | null = null
function aliasInter(): Promise<void> {
  if (interAliased) return interAliased
  interAliased = (async () => {
    const fam = inter.style.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
    const faces: FontFace[] = []
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue
        const s = rule.style
        if (s.getPropertyValue('font-family').trim().replace(/^['"]|['"]$/g, '') !== fam) continue
        const src = s.getPropertyValue('src')
        if (!src) continue
        const face = new FontFace('Inter', src, {
          weight: s.getPropertyValue('font-weight') || 'normal',
          style: s.getPropertyValue('font-style') || 'normal',
          unicodeRange: s.getPropertyValue('unicode-range') || undefined,
        })
        document.fonts.add(face)
        faces.push(face)
      }
    }
    await Promise.allSettled(faces.map((f) => f.load()))
    await document.fonts.ready
  })()
  return interAliased
}

/** The worker, created once the demo is near; the newest request waits, older ones are dropped. */
function useSpice(start: boolean, onResult: (r: SpiceOut) => void) {
  const worker = useRef<Worker | null>(null)
  const busy = useRef(false)
  const queued = useRef<SpiceJob | null>(null)
  const cb = useRef(onResult)
  cb.current = onResult
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!start || worker.current) return
    const w = new Worker(new URL('./spice/spice.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<SpiceOut>) => {
      busy.current = false
      cb.current(e.data)
      const next = queued.current
      if (next) {
        queued.current = null
        busy.current = true
        w.postMessage(next)
      }
    }
    setReady(true)
    return () => {
      w.terminate()
      worker.current = null
      busy.current = false
      setReady(false)
    }
  }, [start])
  const solve = useCallback((job: SpiceJob) => {
    const w = worker.current
    if (!w) return
    if (busy.current) queued.current = job
    else {
      busy.current = true
      w.postMessage(job)
    }
  }, [])
  return { ready, solve }
}

const PARSED_UNITS: Record<string, string> = { res: 'Ω', cap: 'F', ind: 'H' }

export function SpiceLive() {
  const { ref, near } = useLive<HTMLDivElement>()
  const [example, setExample] = useState<ExampleKey>(FIRST)
  const [doc, setDoc] = useState<SchematicDoc>(() => openExample(FIRST))
  const [results, setResults] = useState<SimResult[] | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [probes, setProbes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  const [menu, setMenu] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [fontsTick, setFontsTick] = useState(0)

  useEffect(() => {
    if (!near) return
    let gone = false
    aliasInter().then(() => !gone && setFontsTick((t) => t + 1))
    return () => {
      gone = true
    }
  }, [near])

  // ── solving ──
  const latest = useRef(0)
  const fresh = useRef(true) // the next result belongs to a newly opened example
  const docRef = useRef(doc)
  docRef.current = doc
  const spice = useSpice(near, (r) => {
    if (r.id !== latest.current) return
    if (!r.results.length) {
      setError(r.error ?? 'The simulation failed.')
      return
    }
    setError(r.ok ? null : (r.error ?? 'The simulation did not converge.'))
    setResults(r.results)
    if (fresh.current) {
      fresh.current = false
      const ac = r.results.findIndex((x) => x.analysis.kind === 'ac')
      setActiveIndex(ac >= 0 ? ac : 0)
      setProbes(seedProbes(docRef.current, r.results))
    } else setActiveIndex((i) => Math.min(i, r.results.length - 1))
  })

  useEffect(() => {
    if (!spice.ready) return
    const solve = spice.solve
    const run = () => solve({ id: ++latest.current, doc })
    if (fresh.current) {
      run()
      return
    }
    const t = window.setTimeout(run, 160)
    return () => window.clearTimeout(t)
  }, [spice.ready, spice.solve, doc])

  const open = (key: ExampleKey) => {
    setMenu(false)
    if (key === example) return
    fresh.current = true
    setExample(key)
    setDoc(openExample(key))
    setResults(null)
    setProbes([])
    setError(null)
    setSelected(null)
  }

  // ── editing, the store's updateComponentAttr / setRefdes / directive actions ──
  const sheet = doc.sheets[doc.rootSheet]
  const editComp = (id: string, patch: (c: ComponentInstance) => ComponentInstance) =>
    setDoc((d) => {
      const sh = d.sheets[d.rootSheet]
      return { ...d, updatedAt: Date.now(), sheets: { ...d.sheets, [d.rootSheet]: { ...sh, components: { ...sh.components, [id]: patch(sh.components[id]) } } } }
    })
  const setAttr = (id: string, key: string, value: string) => editComp(id, (c) => ({ ...c, attrs: { ...c.attrs, [key]: value } }))
  const setRefdes = (id: string, refdes: string) => editComp(id, (c) => ({ ...c, refdes }))
  const setDirective = (id: string, patch: { text?: string; enabled?: boolean }) =>
    setDoc((d) => ({ ...d, updatedAt: Date.now(), directives: d.directives.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))

  // ── the canvas ──
  const paneRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 })
  useEffect(() => {
    const el = paneRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight, dpr: window.devicePixelRatio || 1 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const phone = size.w > 0 && size.w < 520
  const inspOpen = !!selected && !phone
  const target: Cam | null = useMemo(
    () =>
      size.w > 0
        ? fitView(doc, size.w, size.h, {
            top: phone ? 60 : 64,
            bottom: phone ? 60 : 64,
            left: phone ? 20 : 40,
            right: inspOpen && size.w > 560 ? 284 + 24 : phone ? 20 : 40,
          })
        : null,
    // the camera frames the example as opened; value edits never move it
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [example, size, phone, inspOpen],
  )
  // The camera glides to its new frame in the app's large motion (240 ms), or jumps under reduced motion.
  const [cam, setCam] = useState<Cam | null>(null)
  const camRef = useRef<Cam | null>(null)
  useEffect(() => {
    if (!target) return
    const from = camRef.current
    const still = !from || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still) {
      camRef.current = target
      setCam(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 240)
      const e = 1 - Math.pow(1 - k, 3)
      const c = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, zoom: from.zoom + (target.zoom - from.zoom) * e }
      camRef.current = c
      setCam(c)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !cam) return
    const { w, h, dpr } = size
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    const ctx = c.getContext('2d')
    if (ctx) drawSheet(ctx, doc, cam, size, { selected, hover })
  }, [doc, cam, size, selected, hover, fontsTick])

  const parts = Object.values(sheet.components).filter((c) => !SYMBOLS[c.symbolId]?.noRefdes)
  const comp = selected ? sheet.components[selected] : undefined
  const sym = comp ? SYMBOLS[comp.symbolId] : undefined
  const enabled = doc.directives.filter((d) => d.enabled)

  return (
    <div ref={ref} className={`sp ${inter.className}`} data-phone={phone ? '' : undefined}>
      <div className="sp-frame">
        <div ref={paneRef} className="sp-sheet">
          <canvas ref={canvasRef} className="sp-canvas" aria-hidden="true" onClick={() => setSelected(null)} />

          {cam &&
            parts.map((c) => {
              const r = partScreenRect(c, cam)
              if (!r) return null
              const s = SYMBOLS[c.symbolId]
              return (
                <button
                  key={c.id}
                  type="button"
                  className="sp-part"
                  style={{ left: r.x1 - 8, top: r.y1 - 8, width: r.x2 - r.x1 + 16, height: r.y2 - r.y1 + 16 }}
                  aria-label={`${c.refdes}, ${s?.name ?? c.symbolId}. Edit in the Inspector`}
                  aria-pressed={selected === c.id}
                  onClick={() => setSelected(selected === c.id ? null : c.id)}
                  onPointerEnter={() => setHover(c.id)}
                  onPointerLeave={() => setHover((h) => (h === c.id ? null : h))}
                />
              )
            })}

          <div className="sp-topleft">
            <button type="button" className="sp-glass sp-docname" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <span>{doc.name}</span>
              <Icon name="chevronDown" size={13} className="sp-t3" />
            </button>
            {menu && (
              <div className="sp-glass sp-menu" role="menu" aria-label="Examples" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
                {EXAMPLES.map((x) => (
                  <button key={x.key} type="button" role="menuitemradio" aria-checked={x.key === example} className="sp-menu-row" onClick={() => open(x.key)}>
                    <span className="sp-menu-name">{x.title}</span>
                    <span className="sp-menu-blurb">{x.proves}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sp-glass sp-analysis">
            <button type="button" className="sp-analysis-row" aria-expanded={analysisOpen} aria-label={analysisOpen ? 'Collapse analysis list' : 'Edit simulation analyses'} onClick={() => setAnalysisOpen((v) => !v)}>
              <span className="sp-label">Analysis</span>
              {!analysisOpen ? (
                <span className="sp-analysis-sum">{enabled.length ? enabled.map((d) => <SpiceCode key={d.id} text={d.text} />) : <span className="sp-t3">None</span>}</span>
              ) : (
                <span className="sp-flex1" />
              )}
              <Icon name="chevronDown" size={11} className={`sp-t3 sp-chev${analysisOpen ? ' sp-chev-up' : ''}`} />
            </button>
            <div className="sp-disclose" data-open={analysisOpen ? '' : undefined}>
              <div>
                <div className="sp-dirs" aria-hidden={!analysisOpen}>
                  {doc.directives.map((d) => (
                    <div key={d.id} className="sp-dir">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={d.enabled}
                        aria-label={d.enabled ? `Disable ${d.text}` : `Enable ${d.text}`}
                        className="sp-check"
                        tabIndex={analysisOpen ? 0 : -1}
                        onClick={() => setDirective(d.id, { enabled: !d.enabled })}
                      >
                        <svg viewBox="0 0 10 10" width="8" height="8" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
                          <path d="M1.5 5.2l2 2 4.5-4.6" />
                        </svg>
                      </button>
                      <SpiceInput ariaLabel={`Directive ${d.text}`} value={d.text} dim={!d.enabled} onChange={(t) => setDirective(d.id, { text: t })} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="sp-glass sp-insp" aria-label="Component inspector" aria-hidden={!comp} data-open={comp ? '' : undefined}>
            {comp && sym && (
              <>
                <header className="sp-insp-head">
                  <h3>{sym.name}</h3>
                  <button type="button" className="sp-iconbtn" aria-label="Close" onClick={() => setSelected(null)}>
                    <Icon name="close" size={14} />
                  </button>
                </header>
                <div className="sp-insp-body">
                  <div className="sp-stack-3">
                    <AttrField label="Reference" value={comp.refdes} onChange={(v) => setRefdes(comp.id, v)} placeholder={sym.prefix ? `${sym.prefix}1` : 'R1'} />
                    {comp.symbolId === 'vsource' ? (
                      <SourceEditor key={comp.id} value={comp.attrs.value ?? sym.attrs[0]?.default ?? '5'} onChange={(v) => setAttr(comp.id, 'value', v)} />
                    ) : (
                      sym.attrs.map((a, i) => (
                        <AttrField
                          key={a.key}
                          label={a.label}
                          value={comp.attrs[a.key] ?? a.default ?? ''}
                          unit={a.unit}
                          placeholder={a.default}
                          parseUnit={i === 0 ? PARSED_UNITS[comp.symbolId] : undefined}
                          eSeries={i === 0 && comp.symbolId === 'res'}
                          onChange={(v) => setAttr(comp.id, a.key, v)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>

        <Dock
          doc={doc}
          results={results}
          activeIndex={activeIndex}
          onActive={setActiveIndex}
          probes={probes}
          setProbes={setProbes}
          error={error}
          pending={near}
          full={full}
          onFull={() => setFull((f) => !f)}
          fontsTick={fontsTick}
        />
      </div>
    </div>
  )
}
