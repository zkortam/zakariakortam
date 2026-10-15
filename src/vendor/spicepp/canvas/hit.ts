/**
 * Hit-testing helpers for the schematic canvas. All math is in *world* coordinates.
 * Tolerances passed in should already be scaled (e.g. 6 / camera.zoom).
 */
import {
  ComponentInstance, SymbolDef, SymbolPrimitive, Wire, NetLabel, GridPoint,
  transformPoint, pinWorldPos,
  netLabelTextRect,
} from "../schematic/types";

export type Pt = GridPoint;

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Distance from point p to segment a-b. */
export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from a point to a polyline. */
export function distToPolyline(p: Pt, pts: Pt[]): number {
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return dist(p, pts[0]);
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, distToSegment(p, pts[i], pts[i + 1]));
  return best;
}

export function pointInRect(p: Pt, x1: number, y1: number, x2: number, y2: number): boolean {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
}

export function rectsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number
): boolean {
  const aMinX = Math.min(ax1, ax2), aMaxX = Math.max(ax1, ax2);
  const aMinY = Math.min(ay1, ay2), aMaxY = Math.max(ay1, ay2);
  const bMinX = Math.min(bx1, bx2), bMaxX = Math.max(bx1, bx2);
  const bMinY = Math.min(by1, by2), bMaxY = Math.max(by1, by2);
  return aMinX <= bMaxX && aMaxX >= bMinX && aMinY <= bMaxY && aMaxY >= bMinY;
}

/** Transform a symbol-local point by component orientation + translation → world. */
export function localToWorld(c: ComponentInstance, p: Pt): Pt {
  const t = transformPoint(p, c.orient);
  return { x: c.pos.x + t.x, y: c.pos.y + t.y };
}

/** Distance from a point to an axis-aligned rect (0 when inside). */
export function distToRect(p: Pt, x1: number, y1: number, x2: number, y2: number): number {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const dx = Math.max(minX - p.x, 0, p.x - maxX);
  const dy = Math.max(minY - p.y, 0, p.y - maxY);
  return Math.hypot(dx, dy);
}

/** Does segment a-b touch the axis-aligned rect (edges or interior)? Used by the canvas
 *  to flag a live wire leg that would be drawn straight through a component body. */
export function segIntersectsRect(a: Pt, b: Pt, x1: number, y1: number, x2: number, y2: number): boolean {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  // Liang-Barsky clip of the segment against the slab; no allocation, handles the
  // axis-aligned (dx or dy == 0) cases that every schematic wire actually is.
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - minX, maxX - a.x, a.y - minY, maxY - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }  // parallel and outside this slab
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

/** World-space axis-aligned bounding box for a component (from its symbol bbox).
 *  Allocation-free: this is called for every component on every frame (labels +
 *  selection rings) and the old array/spread form was minting ~6 objects per call,
 *  which at 200 components is >1000 short-lived allocations per frame — enough GC
 *  churn to show up as periodic frame drops while panning. */
export function componentWorldBBox(c: ComponentInstance, sym: SymbolDef): { x1: number; y1: number; x2: number; y2: number } {
  return localBoxToWorld(c, sym.bbox.x1, sym.bbox.y1, sym.bbox.x2, sym.bbox.y2);
}

/** Transform a symbol-local axis-aligned box to a world-space AABB. Orientations are
 *  90° rotations / mirrors, so the AABB of the transformed corners is exact (not a
 *  conservative envelope). */
function localBoxToWorld(c: ComponentInstance, lx1: number, ly1: number, lx2: number, ly2: number) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (let i = 0; i < 4; i++) {
    const t = transformPoint({ x: i === 0 || i === 3 ? lx1 : lx2, y: i < 2 ? ly1 : ly2 }, c.orient);
    const wx = c.pos.x + t.x, wy = c.pos.y + t.y;
    if (wx < x1) x1 = wx; if (wx > x2) x2 = wx;
    if (wy < y1) y1 = wy; if (wy > y2) y2 = wy;
  }
  return { x1, y1, x2, y2 };
}

/** Symbol-local box enclosing EVERYTHING drawable: the declared bbox, every primitive
 *  vertex, and every pin. componentHit() rejects against this before touching any
 *  polyline math, so the enclosure must be a true superset or we'd start missing hits
 *  on symbols whose art pokes outside sym.bbox. Memoised per SymbolDef (symbol data is
 *  immutable module state). */
const DRAW_BBOX = new WeakMap<SymbolDef, { x1: number; y1: number; x2: number; y2: number }>();
function symbolDrawBBox(sym: SymbolDef) {
  let b = DRAW_BBOX.get(sym);
  if (b) return b;
  let x1 = sym.bbox.x1, y1 = sym.bbox.y1, x2 = sym.bbox.x2, y2 = sym.bbox.y2;
  if (x1 > x2) { const t = x1; x1 = x2; x2 = t; }
  if (y1 > y2) { const t = y1; y1 = y2; y2 = t; }
  const eat = (p: Pt) => { if (p.x < x1) x1 = p.x; if (p.x > x2) x2 = p.x; if (p.y < y1) y1 = p.y; if (p.y > y2) y2 = p.y; };
  for (const prim of sym.primitives) for (const poly of primitivePolylines(prim)) for (const p of poly) eat(p);
  for (const pin of sym.pins) eat(pin.pos);
  b = { x1, y1, x2, y2 };
  DRAW_BBOX.set(sym, b);
  return b;
}

/** Approximate the world-space points making up a primitive's outline (for segment hit-testing).
 *  Memoised per primitive OBJECT: circles/arcs are sampled into 13-17 point arrays, and
 *  re-sampling them for every component on every pointer move was the single largest
 *  allocation source in the interaction path. Callers must treat the result as read-only. */
const PRIM_POLY = new WeakMap<object, Pt[][]>();
export function primitivePolylines(prim: SymbolPrimitive): Pt[][] {
  const cached = PRIM_POLY.get(prim as unknown as object);
  if (cached) return cached;
  const out = computePrimitivePolylines(prim);
  PRIM_POLY.set(prim as unknown as object, out);
  return out;
}

function computePrimitivePolylines(prim: SymbolPrimitive): Pt[][] {
  switch (prim.kind) {
    case "line":
      return [[{ x: prim.x1, y: prim.y1 }, { x: prim.x2, y: prim.y2 }]];
    case "rect":
      return [[
        { x: prim.x1, y: prim.y1 }, { x: prim.x2, y: prim.y1 },
        { x: prim.x2, y: prim.y2 }, { x: prim.x1, y: prim.y2 }, { x: prim.x1, y: prim.y1 },
      ]];
    case "circle": {
      const pts: Pt[] = [];
      const N = 16;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        pts.push({ x: prim.cx + prim.r * Math.cos(a), y: prim.cy + prim.r * Math.sin(a) });
      }
      return [pts];
    }
    case "arc": {
      const pts: Pt[] = [];
      const N = 12;
      const a0 = (prim.start * Math.PI) / 180, a1 = (prim.end * Math.PI) / 180;
      // Canvas y is down; SymbolPrimitive arc angles are "CCW from +x" in math sense.
      for (let i = 0; i <= N; i++) {
        const a = a0 + ((a1 - a0) * i) / N;
        pts.push({ x: prim.cx + prim.r * Math.cos(a), y: prim.cy - prim.r * Math.sin(a) });
      }
      return [pts];
    }
    case "poly": {
      const pts = prim.pts.slice();
      if (prim.closed && pts.length > 0) pts.push(pts[0]);
      return [pts];
    }
  }
}

export interface PinHit { compId: string; pinIndex: number; world: Pt; }

/** Find the closest component pin within tolerance. Iterates all components. */
export function hitTestPin(
  world: Pt,
  components: Record<string, ComponentInstance>,
  symbols: Record<string, SymbolDef | undefined>,
  tol: number
): PinHit | null {
  let best: PinHit | null = null;
  let bestD = tol;
  for (const c of Object.values(components)) {
    const sym = symbols[c.symbolId];
    if (!sym) continue;
    for (let i = 0; i < sym.pins.length; i++) {
      const wp = pinWorldPos(c, sym, i);
      const d = dist(world, wp);
      if (d <= bestD) { bestD = d; best = { compId: c.id, pinIndex: i, world: wp }; }
    }
  }
  return best;
}

/** Hit a single component? Considers transformed primitive outlines + transformed bbox interior. */
export function componentHit(world: Pt, c: ComponentInstance, sym: SymbolDef, tol: number): boolean {
  // Cheap conservative reject FIRST. Every primitive vertex and every pin is inside the
  // symbol's draw box by construction, so a cursor further than `tol` from the transformed
  // draw box cannot be within `tol` of anything — and the O(primitives x samples) polyline
  // walk below is what makes hover cost O(n) over the whole sheet on every mouse move.
  const db = symbolDrawBBox(sym);
  const dw = localBoxToWorld(c, db.x1, db.y1, db.x2, db.y2);
  if (distToRect(world, dw.x1, dw.y1, dw.x2, dw.y2) > tol) return false;

  // bbox interior (transformed)
  const bb = componentWorldBBox(c, sym);
  if (pointInRect(world, bb.x1, bb.y1, bb.x2, bb.y2)) return true;
  // primitive outlines
  for (const prim of sym.primitives) {
    for (const poly of primitivePolylines(prim)) {
      const wp = poly.map((p) => localToWorld(c, p));
      if (distToPolyline(world, wp) <= tol) return true;
    }
  }
  // pins
  for (let i = 0; i < sym.pins.length; i++) {
    if (dist(world, pinWorldPos(c, sym, i)) <= tol) return true;
  }
  return false;
}

export function wireHit(world: Pt, w: Wire, tol: number): boolean {
  return distToPolyline(world, w.pts) <= tol;
}

/** Net-label chip rect in world coords. Width is approximated from the name length. */
export function netLabelRect(l: NetLabel): { x1: number; y1: number; x2: number; y2: number } {
  // The connection square plus the text, wherever the label's direction puts it.
  const t = netLabelTextRect(l);
  return { x1: Math.min(t.x1, l.pos.x - 4), y1: Math.min(t.y1, l.pos.y - 4), x2: Math.max(t.x2, l.pos.x + 4), y2: Math.max(t.y2, l.pos.y + 4) };
}

export function netLabelHit(world: Pt, l: NetLabel): boolean {
  const r = netLabelRect(l);
  return pointInRect(world, r.x1, r.y1, r.x2, r.y2);
}
