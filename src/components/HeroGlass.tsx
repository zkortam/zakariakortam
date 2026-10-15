'use client'

import { useEffect, useRef } from 'react'
import { hasGpu } from '@/lib/gpu'
import { getQuality, onQuality } from '@/lib/quality'

/*
 * Reeded glass across the whole hero. Behind it, three slow pools of light (oxblood, rose, amber) drift
 * like a lit room seen through a fluted partition: each vertical flute squeezes a wider strip of the light
 * into itself, with a faint colour split at the edges and a thin specular line where the cylinder turns.
 * The pointer shifts the refraction a little, as if you were moving past the glass. Opaque, so it replaces
 * the bloom image underneath once its first frame is up; off at low quality, half resolution at medium,
 * one still frame for reduced motion, paused off screen.
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
uniform float fw;   // flute width, device px
uniform vec2 ptr;   // -1..1
uniform float amt;

const vec3 OX = vec3(.078, .024, .039);

float h21(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 q) {
  vec2 i = floor(q), f = fract(q);
  f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 q) { float s = 0., a = .5; for (int i = 0; i < 3; i++) { s += a * vn(q); q *= 2.02; a *= .5; } return s; }
float pool(vec2 q, vec2 c, vec2 r) { vec2 d = (q - c) / r; return exp(-dot(d, d)); }

// The room behind the glass.
vec3 room(vec2 q) {
  float asp = res.x / res.y;
  q.x *= asp;
  float w = fbm(q * 1.6 + vec2(t * .02, -t * .015)) - .5;
  q += w * .08;
  vec2 c1 = vec2((.5 + .16 * sin(t * .061)) * asp, .4 + .07 * cos(t * .047));
  vec2 c2 = vec2((.84 + .08 * sin(t * .039 + 1.3)) * asp, .82 + .07 * sin(t * .055));
  vec2 c3 = vec2((.12 + .07 * cos(t * .043 + .4)) * asp, .2 + .08 * sin(t * .036));
  vec3 c = OX;
  c += vec3(.36, .055, .09) * pool(q, c1, vec2(.3 * asp, .36));
  c += vec3(.5, .2, .07) * pool(q, c2, vec2(.2 * asp, .24)) * .55;
  c += vec3(.24, .04, .12) * pool(q, c3, vec2(.2 * asp, .3)) * .6;
  return c;
}

void main() {
  float xp = uv.x * res.x;
  float k = floor(xp / fw);
  float l = fract(xp / fw) - .5;           // -.5..5 across one flute
  float center = (k + .5) * fw / res.x;
  // Each flute shows a strip ~3x its width, squeezed; the pointer slides what it sees.
  float span = fw / res.x;
  float bend = l * span * 2.4 + ptr.x * span * .9 * (.5 - abs(l));
  vec3 c;
  c.r = room(vec2(center + bend * 1.05, uv.y + ptr.y * .006)).r;
  c.g = room(vec2(center + bend, uv.y + ptr.y * .006)).g;
  c.b = room(vec2(center + bend * .95, uv.y + ptr.y * .006)).b;

  // Cylinder shading: a touch darker toward each seam, a thin highlight where it turns to the light.
  float lum = dot(c, vec3(.3, .55, .15));
  c *= 1. - .1 * l * l * 4.;
  float spec = pow(max(0., 1. - abs(l - .28 - ptr.x * .06) * 7.), 6.);
  c += vec3(1., .9, .86) * spec * (.02 + lum * .22);
  c += vec3(.5, .45, .45) * smoothstep(.47, .5, abs(l)) * .012; // the seam itself

  c = mix(OX, c, amt);
  c += (h21(uv * res + fract(t)) - .5) / 255.;
  o = vec4(c, 1.);
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

export function HeroGlass() {
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

    let prog: WebGLProgram
    try {
      prog = compile(gl)
    } catch {
      return
    }
    gl.useProgram(prog)
    const u = (n: string) => gl.getUniformLocation(prog, n)
    const U = { res: u('res'), t: u('t'), fw: u('fw'), ptr: u('ptr'), amt: u('amt') }
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    let scale = getQuality() === 'medium' ? 0.5 : 1
    let k = 1
    const size = () => {
      const r = canvas.getBoundingClientRect()
      // Soft light needs no retina pixels: one device pixel per CSS pixel is a quarter of the work on a 2x screen.
      k = Math.min(window.devicePixelRatio || 1, 1) * scale
      const w = Math.max(1, Math.round(r.width * k))
      const h = Math.max(1, Math.round(r.height * k))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    const ptr = { x: 0, y: 0 }
    const ptrT = { x: 0, y: 0 }
    let amt = reduced ? 1 : 0
    const t0 = performance.now()
    let raf = 0
    let visible = true
    let last = 0
    let on = false

    const draw = (now: number) => {
      size()
      gl.viewport(0, 0, canvas.width, canvas.height)
      const cssW = canvas.width / k
      gl.uniform2f(U.res, canvas.width, canvas.height)
      gl.uniform1f(U.t, reduced ? 20 : 20 + (now - t0) / 1000)
      gl.uniform1f(U.fw, (cssW < 768 ? 40 : 64) * k)
      gl.uniform2f(U.ptr, ptr.x, ptr.y)
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
      if (now - last >= 32) {
        const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016)
        last = now
        amt = Math.min(1, amt + dt / 1.6)
        const e = Math.min(1, dt * 3)
        ptr.x += (ptrT.x - ptr.x) * e
        ptr.y += (ptrT.y - ptr.y) * e
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
      if (visible) start()
    }
    document.addEventListener('visibilitychange', onVis)

    const hero = canvas.closest('.hero') as HTMLElement | null
    const onMove = (e: PointerEvent) => {
      ptrT.x = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1))
      ptrT.y = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1))
    }
    if (fine && !reduced && hero) hero.addEventListener('pointermove', onMove, { passive: true })

    const offQ = onQuality((q) => {
      if (q === 'low') {
        visible = false
        canvas.removeAttribute('data-on')
      } else {
        scale = q === 'medium' ? 0.5 : 1
      }
    })

    const ro = new ResizeObserver(() => reduced && on && draw(performance.now()))
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      offQ()
      document.removeEventListener('visibilitychange', onVis)
      hero?.removeEventListener('pointermove', onMove)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="hero-glass" />
}
