'use client'

import { useEffect, useRef } from 'react'

/**
 * A soft light that flows around the edge of the viewport while the assistant is open,
 * in the site's palette (oxblood, rose, warm amber, a touch of cool blue). Drawn by a
 * small WebGL shader at half resolution with dithering, so the falloff never bands.
 * `level` is how present the glow is (0 hides it); `busy` adds a slow inward ripple
 * while an answer streams or the mic listens. With reduced motion the glow is static.
 */
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLevel;
uniform float uBusy;
uniform float uWidth;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec2 p = gl_FragCoord.xy;
  float d = min(min(p.x, uRes.x - p.x), min(p.y, uRes.y - p.y));
  vec2 c = (p - 0.5 * uRes) / uRes;
  float a = atan(c.y, c.x);
  float t = uTime;

  // Three slow bands of colour travelling around the frame in different directions.
  float h1 = 0.5 + 0.5 * sin(a * 2.0 + t * 0.55);
  float h2 = 0.5 + 0.5 * sin(a * 3.0 - t * 0.40 + 1.7);
  float h3 = 0.5 + 0.5 * sin(a * 1.0 + t * 0.30 + 3.1);
  vec3 oxblood = vec3(0.62, 0.10, 0.20);
  vec3 rose    = vec3(0.98, 0.52, 0.60);
  vec3 amber   = vec3(1.00, 0.70, 0.40);
  vec3 blue    = vec3(0.48, 0.62, 1.00);
  vec3 col = mix(rose, amber, smoothstep(0.15, 0.85, h1));
  col = mix(col, oxblood, smoothstep(0.35, 1.0, h2) * 0.55);
  col = mix(col, blue, smoothstep(0.72, 1.0, h3) * 0.55);

  // Width breathes along the edge so the light reads as flowing, not a frame.
  float w = uWidth * (0.75 + 0.25 * sin(a * 4.0 - t * 0.9) + 0.18 * uBusy * sin(t * 2.2 + a * 2.0));
  float glow = exp(-d / w) * 0.85 + exp(-d / (w * 0.22)) * 0.45;
  float ripple = 1.0 + uBusy * 0.22 * sin(t * 2.6 - d / w * 2.4);
  float alpha = clamp(glow * ripple * uLevel, 0.0, 1.0);

  alpha += (hash(p + fract(t)) - 0.5) / 255.0;
  alpha = clamp(alpha, 0.0, 1.0);
  gl_FragColor = vec4(col * alpha, alpha);
}`

const SCALE = 0.5

export function EdgeGlow({ level, busy, lite = false }: { level: number; busy: boolean; lite?: boolean }) {
  return lite ? <LiteGlow level={level} /> : <ShaderGlow level={level} busy={busy} />
}

/** Phones and tablets: a static rim of light that only fades, so it stays on the compositor. */
function LiteGlow({ level }: { level: number }) {
  return <div aria-hidden="true" className="edge-lite" style={{ opacity: Math.min(1, level) }} />
}

function ShaderGlow({ level, busy }: { level: number; busy: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const target = useRef({ level, busy: busy ? 1 : 0 })
  const kick = useRef<() => void>(() => {})

  target.current = { level, busy: busy ? 1 : 0 }

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const gl = el.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true })
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
    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uLevel = gl.getUniformLocation(prog, 'uLevel')
    const uBusy = gl.getUniformLocation(prog, 'uBusy')
    const uWidth = gl.getUniformLocation(prog, 'uWidth')

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let last = performance.now()
    let t = 0
    let lv = 0
    let bz = 0

    const size = () => {
      const w = Math.max(1, Math.round(window.innerWidth * SCALE))
      const h = Math.max(1, Math.round(window.innerHeight * SCALE))
      if (el.width !== w || el.height !== h) {
        el.width = w
        el.height = h
      }
      gl.viewport(0, 0, w, h)
    }

    const draw = () => {
      size()
      gl.uniform2f(uRes, el.width, el.height)
      gl.uniform1f(uTime, t)
      gl.uniform1f(uLevel, lv)
      gl.uniform1f(uBusy, bz)
      gl.uniform1f(uWidth, Math.min(el.width, el.height) * (window.innerWidth < 768 ? 0.07 : 0.05))
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const tg = target.current
      if (reduced.matches) {
        lv = tg.level
        bz = 0
        t = 2.0
      } else {
        t += dt * (1 + bz * 0.8)
        lv += (tg.level - lv) * Math.min(1, dt * (tg.level > lv ? 3.2 : 4.5))
        bz += (tg.busy - bz) * Math.min(1, dt * 2.5)
      }
      el.style.display = lv < 0.004 && tg.level === 0 ? 'none' : 'block'
      if (el.style.display === 'block') draw()
      const settled = Math.abs(tg.level - lv) < 0.004 && Math.abs(tg.busy - bz) < 0.004
      // Keep animating while visible (the light flows); stop entirely once hidden or static.
      if ((lv > 0.004 && !reduced.matches) || !settled) raf = requestAnimationFrame(frame)
      else raf = 0
    }

    kick.current = () => {
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    kick.current()
    const onResize = () => kick.current()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      kick.current = () => {}
    }
  }, [])

  useEffect(() => {
    kick.current()
  }, [level, busy])

  return <canvas ref={canvas} className="edge-glow" aria-hidden="true" style={{ display: 'none' }} />
}
