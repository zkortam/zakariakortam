'use client'

import { useEffect, useRef, useState } from 'react'
import { hasGpu } from '@/lib/gpu'
import { getQuality, onQuality } from '@/lib/quality'

/* Slow light behind the portrait: two warped fields of noise mixed into oxblood, rose and a low amber, drifting over
   minutes rather than seconds, leaning a little toward the cursor. Drawn at a fraction of the screen's resolution and
   dithered, so it is smooth with no banding and costs little. Optional: without WebGL, on software rendering or at
   low quality the bloom image under it is the hero. */

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uRise;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.05;
  // Domain warp: the field folds into itself, so the light moves like smoke rather than sliding.
  vec2 w = vec2(fbm(q * 1.0 + vec2(t, -t * 0.7)), fbm(q * 1.0 + vec2(-t * 0.8, t) + 4.3));
  float f = fbm(q * 0.85 + w * 1.4 + vec2(0.0, t * 0.5));
  // Light gathers behind the portrait and toward the cursor.
  vec2 c = vec2(0.0, -0.05) + uPointer * vec2(0.18, 0.12);
  float glow = exp(-dot(q - c, q - c) * 1.6);
  vec3 ox = vec3(0.078, 0.024, 0.039);
  vec3 wine = vec3(0.30, 0.06, 0.11);
  vec3 rose = vec3(0.62, 0.20, 0.25);
  vec3 amber = vec3(0.78, 0.42, 0.26);
  float k = smoothstep(0.22, 0.85, f) * (0.32 + 0.95 * glow);
  vec3 col = mix(ox, wine, smoothstep(0.0, 0.45, k));
  col = mix(col, rose, smoothstep(0.35, 0.8, k));
  col = mix(col, amber, smoothstep(0.72, 1.05, k + w.x * 0.2) * 0.42);
  // Darker toward the top and the bottom edge, where the words sit.
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.35, uv.y)) * mix(1.0, 0.7, smoothstep(0.7, 1.0, uv.y));
  col = mix(ox, col, uRise);
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0 * 1.5;
  o = vec4(col, 1.0);
}`

export function HeroLight() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [allowed, setAllowed] = useState(false)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const ok = () => hasGpu() && getQuality() !== 'low'
    setAllowed(ok())
    return onQuality(() => setAllowed(ok()))
  }, [])

  useEffect(() => {
    const canvas = ref.current
    const hero = canvas?.closest<HTMLElement>('.hero')
    if (!allowed || !canvas || !hero) return
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' })
    if (!gl) return
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u = (n: string) => gl.getUniformLocation(prog, n)
    const uRes = u('uRes')
    const uTime = u('uTime')
    const uPointer = u('uPointer')
    const uRise = u('uRise')

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // The light is soft: a third of the screen's pixels is plenty, and the browser scales it up smoothly.
    const scale = getQuality() === 'medium' ? 0.25 : 0.4
    let width = 0
    const size = (force = false) => {
      const b = hero.getBoundingClientRect()
      if (!force && Math.abs(b.width - width) < 1) return
      width = b.width
      canvas.width = Math.max(1, Math.round(b.width * scale))
      canvas.height = Math.max(1, Math.round(b.height * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    size(true)
    const onResize = () => size()
    window.addEventListener('resize', onResize)

    const target = { x: 0, y: 0 }
    const pointer = { x: 0, y: 0 }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const b = hero.getBoundingClientRect()
      target.x = ((e.clientX - b.left) / b.width) * 2 - 1
      target.y = 1 - ((e.clientY - b.top) / b.height) * 2
    }
    const onLeave = () => {
      target.x = 0
      target.y = 0
    }
    hero.addEventListener('pointermove', onMove, { passive: true })
    hero.addEventListener('pointerleave', onLeave)

    let raf = 0
    let visible = true
    let first = true
    const t0 = performance.now()
    const frame = (now: number) => {
      pointer.x += (target.x - pointer.x) * 0.03
      pointer.y += (target.y - pointer.y) * 0.03
      const s = (now - t0) / 1000
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, reduce ? 20 : 20 + s)
      gl.uniform2f(uPointer, pointer.x, pointer.y)
      gl.uniform1f(uRise, reduce ? 1 : Math.min(1, s / 2.4))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (first) {
        first = false
        setLive(true)
      }
      raf = reduce ? 0 : requestAnimationFrame(frame)
    }
    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(hero)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()

    return () => {
      stop()
      io.disconnect()
      window.removeEventListener('resize', onResize)
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVis)
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
      canvas.width = 1
      canvas.height = 1
    }
  }, [allowed])

  if (!allowed) return null
  return <canvas ref={ref} aria-hidden="true" className="hero-light" style={{ opacity: live ? 1 : 0 }} />
}
