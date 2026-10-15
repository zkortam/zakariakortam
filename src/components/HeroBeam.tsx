'use client'

import { useEffect, useRef } from 'react'
import { sanJoseHour } from '@/lib/sun'
import { hasGpu } from '@/lib/gpu'
import { getQuality, onQuality } from '@/lib/quality'
import { lightFor } from './PortraitLight'

/*
 * A studio beam behind the portrait: one soft cone of light falling from above onto the head, with slow
 * shafts inside it and dust drifting through. It enters from the side the San Jose sun is on, so it agrees
 * with the key light PortraitLight puts on the face, and takes the same tint (warm at golden hour, cool at
 * night). Drawn on black and screened over the oxblood, so it only ever adds light. Off at low quality,
 * half resolution at medium, one still frame for reduced motion, paused off screen.
 */

const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * .5 + .5; uv.y = 1. - uv.y; gl_Position = vec4(p, 0., 1.); }`

const FRAG = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform vec2 res;
uniform float t;
uniform vec2 src;   // light source, uv space (y down, above the top edge)
uniform vec2 aim;   // where the cone points, uv space
uniform vec3 col;
uniform float amt;

float h21(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
vec2 h22(vec2 q) { return fract(sin(vec2(dot(q, vec2(127.1, 311.7)), dot(q, vec2(269.5, 183.3)))) * 43758.5453); }
float vn(vec2 q) {
  vec2 i = floor(q), f = fract(q);
  f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 q) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vn(q); q *= 2.03; a *= .5; } return s; }

// Dust: one mote per cell, drifting, glinting only where the beam is.
float dust(vec2 p, float scale, float r, float soft, vec2 drift, float seed) {
  vec2 q = p * scale + drift * t + seed;
  vec2 i = floor(q), f = fract(q);
  float s = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 c = vec2(x, y);
    vec2 h = h22(i + c + seed);
    if (h.x > .42) continue; // sparse: most cells are empty
    vec2 m = c + .5 + .4 * sin(t * (.15 + .2 * h) + 6.2831 * h) - f;
    float tw = .55 + .45 * sin(t * (.6 + h.y) + h.x * 40.);
    s += tw * smoothstep(r, r * soft, length(m));
  }
  return s;
}

void main() {
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 s = vec2(src.x * asp, src.y);
  vec2 a = vec2(aim.x * asp, aim.y);
  vec2 d = p - s;
  float dist = length(d);
  vec2 dir = d / dist;
  vec2 axis = normalize(a - s);
  float ang = acos(clamp(dot(dir, axis), -1., 1.));

  // The cone: wide soft shoulder, brighter core, fading down the frame.
  float cone = smoothstep(.42, .0, ang);
  float core = smoothstep(.2, .0, ang);
  float fall = exp(-dist * .38) * smoothstep(1.3, .25, p.y);

  // Shafts: noise across the angle, sliding slowly so the beam breathes.
  float th = atan(dir.x, dir.y);
  float shafts = .55 + .45 * fbm(vec2(th * 22., t * .07));
  shafts *= .7 + .3 * fbm(vec2(th * 61. + 3., t * .11));
  // Haze the light passes through.
  float haze = .62 + .38 * fbm(p * 2.4 + vec2(t * .012, -t * .02));

  float beam = (cone * .55 + core * .45) * fall * mix(1., shafts, .75) * haze;

  // Dust in three depths: big soft motes near the lens, small sharp ones far back.
  float lit = cone * fall;
  float motes = dust(p, 5., .07, .1, vec2(.03, -.05), 1.7) * .55
              + dust(p, 11., .05, .25, vec2(-.02, -.035), 7.3) * .8
              + dust(p, 24., .045, .4, vec2(.012, -.02), 3.1) * .9;
  motes *= lit * (.35 + .65 * shafts);

  vec3 c = col * (beam * .5 + motes * .55) * amt;
  c += (h21(uv * res + t) - .5) / 255.; // dither: no banding on the dark ramp
  o = vec4(max(c, 0.), 1.);
}`

function compile(gl: WebGL2RenderingContext) {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader')
    return s
  }
  const p = gl.createProgram()!
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT))
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG))
  gl.bindAttribLocation(p, 0, 'p')
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link')
  return p
}

export function HeroBeam() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (save || !hasGpu() || getQuality() === 'low') return
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const forced = new URLSearchParams(location.search).get('sun')
    const at = () => (forced !== null && !Number.isNaN(Number(forced)) ? sanJoseHour(Number(forced)) : new Date())

    let prog: WebGLProgram
    try {
      prog = compile(gl)
    } catch {
      return
    }
    gl.useProgram(prog)
    const u = (n: string) => gl.getUniformLocation(prog, n)
    const U = { res: u('res'), t: u('t'), src: u('src'), aim: u('aim'), col: u('col'), amt: u('amt') }
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    // Sun side and tint, refreshed once a minute.
    let side = 0
    let tint: [number, number, number] = [1, 0.93, 0.86]
    const relight = () => {
      const L = lightFor(at())
      side = Math.max(-1, Math.min(1, L.key[0] / 0.7))
      tint = [L.keyCol[0] * 1, L.keyCol[1] * 0.93, L.keyCol[2] * 0.86]
    }
    relight()

    let scale = getQuality() === 'medium' ? 0.5 : 0.75
    const size = () => {
      const r = canvas.getBoundingClientRect()
      const k = Math.min(window.devicePixelRatio || 1, 2) * scale
      const w = Math.max(1, Math.round(r.width * k))
      const h = Math.max(1, Math.round(r.height * k))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    // Pointer leans the source a little, spring-damped.
    let lean = 0
    let leanT = 0
    let amt = reduced ? 1 : 0
    const t0 = performance.now()
    let raf = 0
    let visible = true
    let last = 0
    let on = false

    const draw = (now: number) => {
      size()
      gl.viewport(0, 0, canvas.width, canvas.height)
      const t = reduced ? 12 : (now - t0) / 1000
      gl.uniform2f(U.res, canvas.width, canvas.height)
      gl.uniform1f(U.t, t)
      gl.uniform2f(U.src, 0.5 + side * 0.2 + lean * 0.05, -0.5)
      gl.uniform2f(U.aim, 0.5, 0.52)
      gl.uniform3f(U.col, tint[0], tint[1], tint[2])
      gl.uniform1f(U.amt, amt)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!on) {
        on = true
        canvas.dataset.on = ''
      }
    }

    const frame = (now: number) => {
      raf = 0
      if (!visible) return
      // 30 fps is plenty for drifting light.
      if (now - last >= 32) {
        const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016)
        last = now
        amt = Math.min(1, amt + dt / 2.4)
        lean += (leanT - lean) * Math.min(1, dt * 2.5)
        draw(now)
      }
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (reduced) draw(performance.now())
      else if (!raf && visible) raf = requestAnimationFrame(frame)
    }
    start()

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && !document.hidden
      if (visible) start()
    })
    io.observe(canvas)
    const onVis = () => {
      visible = !document.hidden
      if (visible) {
        relight()
        start()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    const tick = window.setInterval(relight, 60000)

    const hero = canvas.closest('.hero') as HTMLElement | null
    const onMove = (e: PointerEvent) => {
      leanT = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1))
    }
    if (fine && !reduced && hero) hero.addEventListener('pointermove', onMove, { passive: true })

    const offQ = onQuality((q) => {
      if (q === 'low') {
        visible = false
        canvas.removeAttribute('data-on')
      } else {
        scale = q === 'medium' ? 0.5 : 0.75
      }
    })

    const ro = new ResizeObserver(() => reduced && on && draw(performance.now()))
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      offQ()
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
      hero?.removeEventListener('pointermove', onMove)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="hero-beam" />
}
