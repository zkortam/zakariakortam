/**
 * The SPICE++ schematic renderer, ported from zkortam/spiceplusplus
 * src/components/Canvas/SchematicCanvas.tsx (commit 81224b0): the grid lattice, wires, junctions,
 * drawSymbol, drawPrimitive, the label block and its anchor solve, and drawNetLabel. The bodies are
 * copied as they are in the app; only the parts this read-only demo never reaches (the placement
 * ghost, agent-edit marks, wire editing, pin captions of functional parts, 7-segment lighting,
 * dangling-end squares) are left out, and the store reads are replaced by arguments.
 */
import { TOKENS } from '@/vendor/spicepp/styles/tokens'
import { componentWorldBBox } from '@/vendor/spicepp/canvas/hit'
import {
  SYMBOLS,
  componentDisplayValue,
  labelRectForSlot,
  solveLabelAnchors,
  clampLabelRect,
  ellipsizeToWidth,
  LABEL_GAP_X,
  LABEL_HALF_H,
  LABEL_LINE_HALF_H,
  LABEL_LINE_DY,
  type LabelSlot,
  type LabelCandidate,
  type LabelRect,
  type LabelSeg,
} from '@/vendor/spicepp/schematic/components'
import {
  transformPoint,
  type ComponentInstance,
  type SymbolDef,
  type SymbolPrimitive,
  type GridPoint,
  type NetLabelDir,
  type SchematicDoc,
} from '@/vendor/spicepp/schematic/types'

export type Cam = { x: number; y: number; zoom: number }
type Vec = { x: number; y: number }

const GRID = TOKENS.gridStep
const FONT = '11px Inter, ui-sans-serif, system-ui, sans-serif'
const GRID_FADE_LO = 7,
  GRID_FADE_HI = 14

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}
function devLine(css: number, dpr: number): number {
  return Math.max(1, Math.round(css * dpr)) / dpr
}

// ─── grid ─────────────────────────────────────────────────────────────────────────────────
type GridLevel = { s: number; a: number }
function gridLevels(step: number, w: number, h: number): GridLevel[] {
  const out: GridLevel[] = []
  const maxSide = Math.max(w, h)
  for (let m = 1; m <= 64; m *= 4) {
    const s = step * m
    const a = smoothstep((s - GRID_FADE_LO) / (GRID_FADE_HI - GRID_FADE_LO))
    if (a > 0.004 && (w / s) * (h / s) <= 30000) {
      out.push({ s, a })
      if (a > 0.996) break
    }
    if (s > maxSide) break
  }
  return out
}
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Cam, dpr: number) {
  const levels = gridLevels(GRID * cam.zoom, w, h)
  if (!levels.length) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const wDev = w * dpr,
    hDev = h * dpr
  const d = Math.max(1, Math.round(dpr))
  const o = d >> 1
  ctx.fillStyle = TOKENS.grid
  for (const lv of levels) {
    const s = lv.s * dpr
    if (s < 1) continue
    const startX = (((cam.x * dpr) % s) + s) % s
    const startY = (((cam.y * dpr) % s) + s) % s
    const ys: number[] = []
    for (let j = 0; ; j++) {
      const y = startY + j * s
      if (y > hDev) break
      ys.push(Math.round(y) - o)
    }
    ctx.globalAlpha = lv.a
    ctx.beginPath()
    for (let i = 0; ; i++) {
      const x = startX + i * s
      if (x > wDev) break
      const px = Math.round(x) - o
      for (const y of ys) ctx.rect(px, y, d, d)
    }
    ctx.fill()
  }
  ctx.restore()
}

// ─── camera ───────────────────────────────────────────────────────────────────────────────
/** store.fitView, with the insets of this frame (no part palette on the left; room for the
 *  Inspector on the right while it is open). */
export function fitView(doc: SchematicDoc, viewW: number, viewH: number, inset: { top: number; bottom: number; left: number; right: number }): Cam {
  const sh = doc.sheets[doc.rootSheet]
  const pts: GridPoint[] = []
  for (const c of Object.values(sh.components)) {
    const sym = SYMBOLS[c.symbolId]
    if (!sym) continue
    for (const corner of [
      { x: sym.bbox.x1, y: sym.bbox.y1 },
      { x: sym.bbox.x2, y: sym.bbox.y2 },
    ]) {
      const t = transformPoint(corner, c.orient)
      pts.push({ x: c.pos.x + t.x, y: c.pos.y + t.y })
    }
  }
  for (const w of Object.values(sh.wires)) pts.push(...w.pts)
  for (const l of Object.values(sh.netLabels)) pts.push(l.pos)
  const availW = Math.max(80, viewW - inset.left - inset.right)
  const availH = Math.max(80, viewH - inset.top - inset.bottom)
  const cx = inset.left + availW / 2,
    cy = inset.top + availH / 2
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const w = Math.max(64, maxX - minX),
    h = Math.max(64, maxY - minY)
  const pad = 1.18
  const zoom = Math.max(0.25, Math.min(2.4, Math.min(availW / (w * pad), availH / (h * pad))))
  return { x: cx - ((minX + maxX) / 2) * zoom, y: cy - ((minY + maxY) / 2) * zoom, zoom }
}

// ─── labels ───────────────────────────────────────────────────────────────────────────────
function labelBlockOf(ctx: CanvasRenderingContext2D, c: ComponentInstance, sym: SymbolDef): { w: number; h: number; refdes: string; value: string } | null {
  if (sym.noRefdes) return null
  const raw = sym.attrs && sym.attrs[0] ? (c.attrs[sym.attrs[0].key] ?? sym.attrs[0].default ?? '') : ''
  const value = raw ? String(componentDisplayValue(c.symbolId, raw)) : ''
  const refdes = sym.valueOnlyLabel ? '' : (c.refdes ?? '')
  if (!refdes && !value) return null
  ctx.font = FONT
  const w = Math.max(refdes ? ctx.measureText(refdes).width : 0, value ? ctx.measureText(value).width : 0)
  if (w <= 0) return null
  return { w, h: 2 * (refdes && value ? LABEL_HALF_H : LABEL_LINE_HALF_H), refdes, value }
}

function bodyScreenRect(c: ComponentInstance, sym: SymbolDef, cam: Cam): LabelRect {
  const bb = componentWorldBBox(c, sym)
  return {
    x1: Math.min(bb.x1, bb.x2) * cam.zoom + cam.x,
    y1: Math.min(bb.y1, bb.y2) * cam.zoom + cam.y,
    x2: Math.max(bb.x1, bb.x2) * cam.zoom + cam.x,
    y2: Math.max(bb.y1, bb.y2) * cam.zoom + cam.y,
  }
}

function solveVisibleLabelAnchors(ctx: CanvasRenderingContext2D, comps: ComponentInstance[], wirePolys: GridPoint[][], cam: Cam, viewport?: LabelRect): Map<string, LabelSlot> {
  const bodies: LabelRect[] = []
  const items: LabelCandidate[] = []
  for (const c of comps) {
    const sym = SYMBOLS[c.symbolId]
    if (!sym) continue
    const body = bodyScreenRect(c, sym, cam)
    bodies.push(body)
    const blk = labelBlockOf(ctx, c, sym)
    if (blk) items.push({ key: c.id, body, w: blk.w, h: blk.h, fixed: c.labelAnchor })
  }
  if (items.length === 0) return new Map<string, LabelSlot>()
  const segments: LabelSeg[] = []
  for (const pts of wirePolys) {
    for (let i = 1; i < pts.length; i++) {
      segments.push({
        x1: pts[i - 1].x * cam.zoom + cam.x,
        y1: pts[i - 1].y * cam.zoom + cam.y,
        x2: pts[i].x * cam.zoom + cam.x,
        y2: pts[i].y * cam.zoom + cam.y,
      })
    }
  }
  return solveLabelAnchors(items, { bodies, segments, viewport }, LABEL_GAP_X)
}

// ─── symbols ──────────────────────────────────────────────────────────────────────────────
interface DrawSymbolOpts {
  selected: boolean
  alpha: number
  showLabels: boolean
  hoverGlow?: number
  dpr?: number
  labelSlot?: LabelSlot
  viewport?: LabelRect
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawSymbol(ctx: CanvasRenderingContext2D, c: ComponentInstance, sym: SymbolDef, cam: Cam, opts: DrawSymbolOpts) {
  ctx.save()
  ctx.globalAlpha = opts.alpha
  const W = (p: GridPoint) => {
    const t = transformPoint(p, c.orient)
    return { x: (c.pos.x + t.x) * cam.zoom + cam.x, y: (c.pos.y + t.y) * cam.zoom + cam.y }
  }
  const dpr = opts.dpr ?? 1
  ctx.strokeStyle = opts.selected ? TOKENS.accent : TOKENS.ink.primary
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = devLine(2.4, dpr)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const prim of sym.primitives) drawPrimitive(ctx, prim, cam, W)

  if (opts.showLabels) {
    const blk = labelBlockOf(ctx, c, sym)
    if (blk) {
      const slot: LabelSlot = opts.labelSlot ?? { anchor: c.labelAnchor ?? 'right', slide: 0 }
      let r = labelRectForSlot(bodyScreenRect(c, sym, cam), slot, blk.w, blk.h, LABEL_GAP_X)
      ctx.font = FONT
      let refdes = blk.refdes,
        value = blk.value
      const view = opts.viewport
      if (view) {
        r = clampLabelRect(r, view)
        const maxW = Math.max(0, view.x2 - r.x1)
        if (blk.w > maxW) {
          const measure = (s: string) => ctx.measureText(s).width
          refdes = ellipsizeToWidth(refdes, maxW, measure)
          value = ellipsizeToWidth(value, maxW, measure)
        }
      }
      const cyS = (r.y1 + r.y2) / 2
      ctx.globalAlpha = opts.alpha
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      if (refdes && value) {
        ctx.fillStyle = TOKENS.ink.primary
        ctx.fillText(refdes, r.x1, cyS - LABEL_LINE_DY)
        ctx.fillStyle = TOKENS.ink.secondary
        ctx.fillText(value, r.x1, cyS + LABEL_LINE_DY)
      } else if (refdes) {
        ctx.fillStyle = TOKENS.ink.primary
        ctx.fillText(refdes, r.x1, cyS)
      } else {
        ctx.fillStyle = TOKENS.ink.secondary
        ctx.fillText(value, r.x1, cyS)
      }
    }
  }

  const glow = opts.selected ? 0 : (opts.hoverGlow ?? 0)
  if (opts.selected || glow > 0.004) {
    const bb = componentWorldBBox(c, sym)
    const a = { x: bb.x1 * cam.zoom + cam.x, y: bb.y1 * cam.zoom + cam.y }
    const b = { x: bb.x2 * cam.zoom + cam.x, y: bb.y2 * cam.zoom + cam.y }
    const pad = opts.selected ? 6 : 6 + 2 * (1 - glow)
    const x = Math.min(a.x, b.x) - pad,
      y = Math.min(a.y, b.y) - pad
    const rw = Math.abs(a.x - b.x) + pad * 2,
      rh = Math.abs(a.y - b.y) + pad * 2
    ctx.globalAlpha = opts.selected ? 1 : glow * 0.55
    ctx.strokeStyle = opts.selected ? TOKENS.accent : TOKENS.ink.secondary
    ctx.lineWidth = devLine(1.5, dpr)
    ctx.setLineDash([])
    roundRectPath(ctx, x, y, rw, rh, 10)
    ctx.stroke()
  }
  ctx.restore()
}

function drawPrimitive(ctx: CanvasRenderingContext2D, prim: SymbolPrimitive, cam: Cam, W: (p: GridPoint) => Vec) {
  switch (prim.kind) {
    case 'line': {
      const lw = ctx.lineWidth
      if (prim.wide) ctx.lineWidth = lw * 2
      const a = W({ x: prim.x1, y: prim.y1 })
      const b = W({ x: prim.x2, y: prim.y2 })
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.lineWidth = lw
      return
    }
    case 'rect': {
      const a = W({ x: prim.x1, y: prim.y1 })
      const c = W({ x: prim.x2, y: prim.y2 })
      const x = Math.min(a.x, c.x),
        y = Math.min(a.y, c.y),
        w = Math.abs(a.x - c.x),
        h = Math.abs(a.y - c.y)
      const r = prim.radius != null ? Math.min(prim.radius * cam.zoom, w / 2, h / 2) : Math.min(w / 2, h / 2)
      const fs = ctx.fillStyle
      ctx.fillStyle = TOKENS.canvas.dark
      roundRectPath(ctx, x, y, w, h, r)
      ctx.fill()
      ctx.fillStyle = fs
      ctx.stroke()
      return
    }
    case 'circle': {
      const center = W({ x: prim.cx, y: prim.cy })
      const r = prim.r * cam.zoom
      ctx.beginPath()
      ctx.arc(center.x, center.y, Math.max(0.5, r), 0, Math.PI * 2)
      if (prim.fill) ctx.fill()
      else {
        const fs = ctx.fillStyle
        ctx.fillStyle = TOKENS.canvas.dark
        ctx.fill()
        ctx.fillStyle = fs
        ctx.stroke()
      }
      return
    }
    case 'arc': {
      const N = 24
      const a0 = (prim.start * Math.PI) / 180,
        a1 = (prim.end * Math.PI) / 180
      ctx.beginPath()
      for (let i = 0; i <= N; i++) {
        const ang = a0 + ((a1 - a0) * i) / N
        const p = W({ x: prim.cx + prim.r * Math.cos(ang), y: prim.cy - prim.r * Math.sin(ang) })
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      return
    }
    case 'poly': {
      if (prim.pts.length === 0) return
      ctx.beginPath()
      const p0 = W(prim.pts[0])
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < prim.pts.length; i++) {
        const p = W(prim.pts[i])
        ctx.lineTo(p.x, p.y)
      }
      if (prim.closed) ctx.closePath()
      if (prim.fill) ctx.fill()
      else {
        if (prim.closed) {
          const fs = ctx.fillStyle
          ctx.fillStyle = TOKENS.canvas.dark
          ctx.fill()
          ctx.fillStyle = fs
        }
        ctx.stroke()
      }
      return
    }
  }
}

function drawNetLabel(ctx: CanvasRenderingContext2D, pos: GridPoint, name: string, cam: Cam, selected: boolean, dir?: NetLabelDir) {
  const ap = { x: pos.x * cam.zoom + cam.x, y: pos.y * cam.zoom + cam.y }
  ctx.save()
  ctx.fillStyle = selected ? TOKENS.accent : TOKENS.wire.idle
  ctx.fillRect(ap.x - 2.5, ap.y - 2.5, 5, 5)
  ctx.font = `600 ${FONT}`
  ctx.fillStyle = selected ? TOKENS.accent : TOKENS.ink.secondary
  const text = name || 'NET'
  if (dir === 'left') {
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'right'
    ctx.fillText(text, ap.x - 6, ap.y - 4)
  } else if (dir === 'up') {
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'center'
    ctx.fillText(text, ap.x, ap.y - 6)
  } else if (dir === 'down') {
    ctx.textBaseline = 'top'
    ctx.textAlign = 'center'
    ctx.fillText(text, ap.x, ap.y + 6)
  } else {
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'left'
    ctx.fillText(text, ap.x + 6, ap.y - 4)
  }
  ctx.restore()
}

// ─── the frame ────────────────────────────────────────────────────────────────────────────
/** One frame of SchematicCanvas.draw for a sheet at rest: background, grid, wires, junctions,
 *  parts with their labels, net labels. */
export function drawSheet(
  ctx: CanvasRenderingContext2D,
  doc: SchematicDoc,
  cam: Cam,
  size: { w: number; h: number; dpr: number },
  state: { selected: string | null; hover: string | null },
) {
  const { w, h, dpr } = size
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = TOKENS.canvas.dark
  ctx.fillRect(0, 0, w, h)
  drawGrid(ctx, w, h, cam, dpr)

  const sheet = doc.sheets[doc.rootSheet]
  const pathIdle = new Path2D()
  const wirePolys: GridPoint[][] = []
  for (const wire of Object.values(sheet.wires ?? {})) {
    const pts = wire.pts
    if (pts.length >= 2) {
      pathIdle.moveTo(pts[0].x * cam.zoom + cam.x, pts[0].y * cam.zoom + cam.y)
      for (let i = 1; i < pts.length; i++) pathIdle.lineTo(pts[i].x * cam.zoom + cam.x, pts[i].y * cam.zoom + cam.y)
    }
    wirePolys.push(pts)
  }
  ctx.save()
  ctx.lineWidth = devLine(2.4, dpr)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = TOKENS.wire.idle
  ctx.stroke(pathIdle)
  ctx.restore()

  const jp = new Path2D()
  let anyJ = false
  for (const j of Object.values(sheet.junctions ?? {})) {
    const p = { x: j.pos.x * cam.zoom + cam.x, y: j.pos.y * cam.zoom + cam.y }
    jp.moveTo(p.x + 3, p.y)
    jp.arc(p.x, p.y, 3, 0, Math.PI * 2)
    anyJ = true
  }
  if (anyJ) {
    ctx.fillStyle = TOKENS.wire.idle
    ctx.fill(jp)
  }

  const comps = Object.values(sheet.components ?? {}).filter((c) => c && c.pos && SYMBOLS[c.symbolId])
  const viewport: LabelRect = { x1: LABEL_GAP_X, y1: LABEL_GAP_X, x2: w - LABEL_GAP_X, y2: h - LABEL_GAP_X }
  const anchors = solveVisibleLabelAnchors(ctx, comps, wirePolys, cam, viewport)
  for (const c of comps) {
    drawSymbol(ctx, c, SYMBOLS[c.symbolId]!, cam, {
      selected: state.selected === c.id,
      alpha: 1,
      showLabels: true,
      hoverGlow: state.selected === c.id ? 0 : state.hover === c.id ? 1 : 0,
      dpr,
      labelSlot: anchors.get(c.id),
      viewport,
    })
  }
  for (const l of Object.values(sheet.netLabels ?? {})) drawNetLabel(ctx, l.pos, l.name, cam, false, l.dir)
  ctx.restore()
}

/** Screen-space box of a part, for placing a keyboard focus ring over the canvas. */
export function partScreenRect(c: ComponentInstance, cam: Cam): LabelRect | null {
  const sym = SYMBOLS[c.symbolId]
  return sym ? bodyScreenRect(c, sym, cam) : null
}

