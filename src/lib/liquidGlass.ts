// Displacement and shading maps for refractive glass, drawn once per surface size on a 2D canvas.
//
// feDisplacementMap reads P(x + s * (R - .5), y + s * (G - .5)). Inside a bezel along each live edge we
// encode a vector pointing inward whose length follows the slope of a convex squircle profile, so the
// backdrop is pulled in and compressed toward the rim the way a thick convex edge bends light. The flat
// middle is untouched (R = G = .5), which keeps everything behind the glass, and text on it, steady.

export type Edges = { t: boolean; r: boolean; b: boolean; l: boolean }
export type Drop = { x: number; y: number; r: number }

export type GlassSpec = {
  w: number
  h: number
  radius: number
  bezel: number
  edges: Edges
  drops?: Drop[]
  /** Height of the visible pane when the element extends below it to give the rim real pixels to bend in. */
  visH?: number
}

/** Max displacement in px at the very rim. Kept small: a bend at the edge, never a funhouse. */
export const REFRACT_PX = 9

function sdRoundRect(px: number, py: number, w: number, h: number, r: number) {
  // Signed distance (negative inside) to a rounded rect centered at w/2, h/2.
  const qx = Math.abs(px - w / 2) - (w / 2 - r)
  const qy = Math.abs(py - h / 2) - (h / 2 - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - r
}

/** Slope of a convex squircle rim, 1 at the edge easing to 0 at the end of the bezel. */
function rim(t: number) {
  const u = 1 - Math.min(1, Math.max(0, t))
  return u * u * (3 - 2 * u) * u
}

export function displacementMap(spec: GlassSpec) {
  const { w, h, radius, bezel, edges, drops = [], visH = h } = spec
  // With spare backdrop beyond the visible edge, the rim samples outward: the band compresses what lies
  // just past the edge into itself, like a thick convex bevel. Without it, sampling inward would only stretch.
  const sign = visH < h ? -1 : 1
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const img = ctx.createImageData(w, h)
  const d = img.data
  // Clarity mask: where the glass is clear rather than frosted (the rim, and wherever water sits).
  const mc = document.createElement('canvas')
  mc.width = w
  mc.height = h
  const mctx = mc.getContext('2d', { willReadFrequently: true })!
  const mimg = mctx.createImageData(w, h)
  const md = mimg.data
  const maxPx = REFRACT_PX
  const scale = maxPx * 2
  // Edges that are not live (the nav's top and sides sit on the viewport edge) are pushed far away.
  const ext = 4 * bezel + radius
  const x0 = edges.l ? 0 : -ext
  const y0 = edges.t ? 0 : -ext
  const x1 = edges.r ? w : w + ext
  const y1 = edges.b ? visH : visH + ext
  const W = x1 - x0
  const H = y1 - y0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - x0
      const py = y + 0.5 - y0
      const sd = -sdRoundRect(px, py, W, H, radius)
      let vx = 0
      let vy = 0
      let clear = 0
      if (y >= visH) {
        // Below the visible pane: never shown, left neutral.
      } else if (sd < bezel) {
        const t = Math.max(0, sd) / bezel
        clear = 1 - t * t * (3 - 2 * t)
        // Inward normal from the SDF gradient (central differences).
        const e = 0.5
        const gx = sdRoundRect(px - e, py, W, H, radius) - sdRoundRect(px + e, py, W, H, radius)
        const gy = sdRoundRect(px, py - e, W, H, radius) - sdRoundRect(px, py + e, W, H, radius)
        const gl = Math.hypot(gx, gy) || 1
        const m = rim(sd / bezel) * maxPx
        vx = sign * (gx / gl) * m
        vy = sign * (gy / gl) * m
      }
      for (const dr of drops) {
        const dx = x + 0.5 - dr.x
        const dy = y + 0.5 - dr.y
        const q = (dx * dx + dy * dy) / (dr.r * dr.r)
        if (q < 1) {
          // Water wets the frost away, so a drop is clear even in the middle of the pane.
          clear = Math.max(clear, Math.min(1, (1 - q) * 5))
          // A droplet is a tiny plano-convex lens: it shows a shrunken, inverted patch of what is behind it.
          const k = -0.55 * Math.sqrt(1 - q) - 0.25
          vx = dx * (k - 1) * 0.6
          vy = dy * (k - 1) * 0.6
        }
      }
      const vl = Math.hypot(vx, vy)
      if (vl > maxPx) {
        vx *= maxPx / vl
        vy *= maxPx / vl
      }
      const i = (y * w + x) * 4
      d[i] = Math.round(128 + (vx / scale) * 255)
      d[i + 1] = Math.round(128 + (vy / scale) * 255)
      d[i + 2] = 128
      d[i + 3] = 255
      md[i] = md[i + 1] = md[i + 2] = 0
      md[i + 3] = Math.round(clear * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  mctx.putImageData(mimg, 0, 0)
  return { url: c.toDataURL('image/png'), mask: mc.toDataURL('image/png'), scale }
}

/** Water on the outside of the glass: a soft contact shadow, a dark refraction ring and one specular. */
export function dropsShading(w: number, h: number, drops: Drop[], light = false) {
  // On pale frosted glass water is nearly invisible: a dark meniscus and a pinpoint, no glow.
  const cau = light ? 0.06 : 0.3
  const spec = light ? 0.8 : 0.95
  const men = light ? 0.3 : 0.42
  const c = document.createElement('canvas')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  c.width = Math.round(w * dpr)
  c.height = Math.round(h * dpr)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.scale(dpr, dpr)
  for (const dr of drops) {
    const { x, y, r } = dr
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.clip()
    // Meniscus: light leaves the thin lower edge sideways, so the bottom rim reads dark and the top stays clear.
    const m = ctx.createRadialGradient(x, y - r * 0.4, r * 0.7, x, y - r * 0.4, r * 1.4)
    m.addColorStop(0, 'rgba(12,3,5,0)')
    m.addColorStop(1, `rgba(12,3,5,${men})`)
    ctx.fillStyle = m
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
    // Caustic: the drop focuses the light from above into a soft crescent low inside it.
    const k = ctx.createRadialGradient(x, y + r * 0.55, 0, x, y + r * 0.55, r * 0.6)
    k.addColorStop(0, `rgba(255,246,244,${cau})`)
    k.addColorStop(1, 'rgba(255,246,244,0)')
    ctx.fillStyle = k
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
    ctx.restore()
    // Specular: one small, sharp highlight up and to the left.
    const sx = x - r * 0.34
    const sy = y - r * 0.36
    const sr = Math.max(0.7, r * (light ? 0.16 : 0.24))
    const s = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr)
    s.addColorStop(0, `rgba(255,255,255,${spec})`)
    s.addColorStop(0.45, `rgba(255,255,255,${spec / 2})`)
    s.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = s
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }
  return c.toDataURL('image/png')
}

/** Sparse, irregular drops: Poisson-ish placement with a seeded generator so a size always gets the same rain. */
export function scatterDrops(w: number, h: number, count: number, seed = 7, avoid: DOMRectReadOnly[] = []): Drop[] {
  let s = seed >>> 0
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const out: Drop[] = []
  let tries = 0
  while (out.length < count && tries++ < count * 40) {
    const r = 2.4 + Math.pow(rnd(), 2) * 3.4
    const x = r + 2 + rnd() * (w - 2 * r - 4)
    const y = r + 2 + rnd() * (h - 2 * r - 4)
    if (out.some((o) => Math.hypot(o.x - x, o.y - y) < (o.r + r) * 3.2)) continue
    // Never on the words: legibility first.
    if (avoid.some((a) => x + r + 6 > a.left && x - r - 6 < a.right && y + r + 4 > a.top && y - r - 4 < a.bottom)) continue
    out.push({ x, y, r })
  }
  return out
}
