'use client'

import { useEffect, useRef } from 'react'
import { sanJoseHour, sunPosition } from '@/lib/sun'
import { hasGpu } from '@/lib/gpu'

/*
 * The hero portrait, relit by San Jose's sun.
 *
 * A depth map was estimated offline (Depth Anything V2 small) and baked into surface normals
 * (/portrait/zakaria-normal.webp, 512px, RG = normal xy). Here a WebGL2 pass divides out the photo's
 * own frontal studio light and multiplies in a key from the sun's real azimuth and elevation, so the
 * cheeks, nose and brow take the light like a photograph, not a 3D filter. Warm low sun at golden hour,
 * neutral at noon, cool and dimmer at night. A fine pointer adds a soft fill; Android tilt nudges it
 * (iOS would need a permission prompt, so it is skipped there). The canvas sits over the <img> and
 * fades in only after its first frame; without WebGL2 the photo is simply the photo.
 */

const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * .5 + .5; uv.y = 1. - uv.y; gl_Position = vec4(p, 0., 1.); }`

const FRAG = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform sampler2D img;
uniform sampler2D nrm;
uniform vec3 key;      // key light direction (screen space, y up, z toward viewer)
uniform vec3 keyCol;   // linear tint, luminance ~1
uniform float keyAmt;  // 0..1 how far the photo's own light is replaced
uniform vec3 fill;     // cursor fill direction
uniform float fillAmt;
uniform float rimAmt;
uniform vec2 res;

const vec3 L0 = vec3(0., .28, .96); // the photo's own (frontal, slightly high) studio key
float shade(vec3 n, vec3 l) { return .42 + .58 * max(dot(n, l), 0.); }
float hash(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec4 b = textureLod(img, uv, 0.);
  if (b.a < .002) { o = vec4(0.); return; }
  vec2 nx = texture(nrm, uv).rg * 2. - 1.;
  vec3 n = vec3(nx, sqrt(max(.02, 1. - dot(nx, nx))));
  vec3 c = pow(b.rgb, vec3(2.2));

  // Ratio of new light to the photo's own, normalized so a surface facing the camera keeps its exposure:
  // only planes that turn toward or away from the sun change. Contrast and blacks stay the photograph's.
  float r = clamp((shade(n, key) / shade(n, L0)) * (shade(vec3(0., 0., 1.), L0) / shade(vec3(0., 0., 1.), key)), .6, 1.5);
  float lift = mix(1., r, keyAmt);
  // Tint follows the light: only where the key actually lands, so shadows stay neutral grey.
  vec3 tint = mix(vec3(1.), keyCol, clamp(max(dot(n, key), 0.) * keyAmt * 1.6, 0., 1.));
  c *= lift * tint;

  // Soft fill from the cursor: adds light, never removes it.
  c += c * fillAmt * max(dot(n, fill), 0.) * vec3(1., .97, .93);

  // The oxblood bloom behind him wraps the silhouette (a kicker on hair and shoulders).
  // A thin band just inside the cut edge (alpha from a coarse mip): a real kicker is a line, not a haze.
  float ba = .5 * (textureLod(img, uv, 2.).a + textureLod(img, uv, 3.).a);
  float band = b.a * smoothstep(.02, .45, 1. - ba);
  float side = clamp(.45 + .9 * n.y, 0., 1.); // the bloom sits high behind him: crown and shoulders
  c += vec3(.55, .1, .13) * rimAmt * band * side;

  c = pow(max(c, 0.), vec3(1. / 2.2));
  c += (hash(uv * res) - .5) / 255.; // dither: no banding on the dark ramps
  o = vec4(c * b.a, b.a);
}`

type V3 = [number, number, number]
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Light for a moment in San Jose. Portrait faces south: morning sun from screen right, evening from the left. */
export function lightFor(date: Date) {
  const { azimuth, elevation } = sunPosition(date)
  const az = (azimuth * Math.PI) / 180
  const el = (Math.max(-2, elevation) * Math.PI) / 180
  const sun: V3 = [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)]
  // Never a pure profile light: the photo was lit from the front and must stay readable.
  const sunKey = norm([sun[0] * 0.9, sun[1] * 0.7 + 0.18, Math.max(-0.2, sun[2]) + 0.55])
  const moonKey = norm([0.42, 0.62, 0.66])
  const day = smooth(-7, 4, elevation)
  const golden = 1 - smooth(3, 28, elevation)
  const keyDir = norm(mix3(moonKey, sunKey, day))
  const dayCol = mix3([1.0, 0.985, 0.955], [1.035, 0.96, 0.885], golden)
  const raw = mix3([0.94, 0.98, 1.06], dayCol, day)
  // Tints carry hue only: unit luminance, so the light never dims or brightens the photograph by itself.
  const lum = 0.2126 * raw[0] + 0.7152 * raw[1] + 0.0722 * raw[2]
  const keyCol: V3 = [raw[0] / lum, raw[1] / lum, raw[2] / lum]
  return {
    key: keyDir,
    keyCol,
    keyAmt: 0.55 * day + 0.4 * (1 - day),
    rimAmt: 0.05 + 0.04 * golden * day,
    elevation,
    azimuth,
  }
}

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

function texture(gl: WebGL2RenderingContext, unit: number, src: TexImageSource) {
  const t = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return t
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.decoding = 'async'
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
}

export function PortraitLight({ normal = '/portrait/zakaria-normal.webp' }: { normal?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const photo = canvas?.parentElement?.querySelector('img')
    if (!canvas || !photo) return
    const save = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (save || !hasGpu()) return
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true, powerPreference: 'low-power' })
    if (!gl) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const html = document.documentElement
    const params = new URLSearchParams(location.search)
    const forced = params.get('sun')
    const at = () => (forced !== null && !Number.isNaN(Number(forced)) ? sanJoseHour(Number(forced)) : new Date())

    let disposed = false
    let raf = 0
    let visible = true
    let ready = false
    let L = lightFor(at())
    // Cursor fill, spring-damped toward its target.
    const fillT = { x: 0, y: 0, a: 0 }
    const fillS = { x: 0, y: 0, a: 0, vx: 0, vy: 0, va: 0 }
    const uni: Record<string, WebGLUniformLocation | null> = {}
    let prog: WebGLProgram | null = null

    const size = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(r.width * dpr))
      const h = Math.max(1, Math.round(r.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    const draw = () => {
      if (!prog || disposed) return
      size()
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform3fv(uni.key, L.key)
      gl.uniform3fv(uni.keyCol, L.keyCol)
      gl.uniform1f(uni.keyAmt, L.keyAmt)
      gl.uniform1f(uni.rimAmt, L.rimAmt)
      const f = norm([fillS.x, fillS.y, 0.9])
      gl.uniform3fv(uni.fill, f)
      gl.uniform1f(uni.fillAmt, fillS.a)
      gl.uniform2f(uni.res, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!ready) {
        ready = true
        canvas.dataset.on = ''
      }
    }

    let last = 0
    const step = (t: number) => {
      raf = 0
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 1 / 60)
      last = t
      // Critically damped spring, ~0.6s settle: light moves like a softbox on a stand, not a laser.
      const k = 40
      const d = 2 * Math.sqrt(k)
      let moving = false
      for (const [p, v] of [['x', 'vx'], ['y', 'vy'], ['a', 'va']] as const) {
        const acc = k * (fillT[p] - fillS[p]) - d * fillS[v]
        fillS[v] += acc * dt
        fillS[p] += fillS[v] * dt
        if (Math.abs(fillT[p] - fillS[p]) > 0.001 || Math.abs(fillS[v]) > 0.001) moving = true
      }
      draw()
      if (moving && visible) raf = requestAnimationFrame(step)
      else last = 0
    }
    const kick = () => {
      if (!raf && visible && ready) raf = requestAnimationFrame(step)
    }

    const init = async () => {
      try {
        if (!photo.complete) await new Promise((r) => photo.addEventListener('load', r, { once: true }))
        const nimg = await loadImage(normal)
        if (disposed) return
        const src = photo.currentSrc ? await loadImage(photo.currentSrc) : photo
        if (disposed) return
        prog = compile(gl)
        gl.useProgram(prog)
        for (const n of ['img', 'nrm', 'key', 'keyCol', 'keyAmt', 'fill', 'fillAmt', 'rimAmt', 'res']) uni[n] = gl.getUniformLocation(prog, n)
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        texture(gl, 0, src)
        texture(gl, 1, nimg)
        gl.uniform1i(uni.img, 0)
        gl.uniform1i(uni.nrm, 1)
        draw()
      } catch {
        // Any failure leaves the photograph exactly as it was.
      }
    }
    init()

    // The sun moves slowly: once a minute is plenty.
    const tick = window.setInterval(() => {
      if (!visible || forced !== null) return
      L = lightFor(at())
      draw()
    }, 60000)

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && !document.hidden
      if (visible) kick()
    })
    io.observe(canvas)
    const onVis = () => {
      visible = !document.hidden
      if (visible) {
        L = lightFor(at())
        draw()
      }
    }
    document.addEventListener('visibilitychange', onVis)

    const hero = canvas.closest('.hero') as HTMLElement | null
    const cleanups: (() => void)[] = []
    if (!reduced && fine && hero) {
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse' || html.dataset.intro === 'play' || html.classList.contains('lite')) return
        const r = canvas.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height * 0.36
        fillT.x = Math.max(-1.4, Math.min(1.4, (e.clientX - cx) / (r.width * 0.6)))
        fillT.y = Math.max(-1.2, Math.min(1.2, -(e.clientY - cy) / (r.height * 0.6)))
        fillT.a = 0.22
        kick()
      }
      const onLeave = () => {
        fillT.a = 0
        kick()
      }
      hero.addEventListener('pointermove', onMove, { passive: true })
      hero.addEventListener('pointerleave', onLeave)
      cleanups.push(() => {
        hero.removeEventListener('pointermove', onMove)
        hero.removeEventListener('pointerleave', onLeave)
      })
    }

    // Tilt only where it needs no permission prompt (Android Chrome). iOS gates it behind a dialog: skipped.
    type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }
    const DO = (window as unknown as { DeviceOrientationEvent?: DOE }).DeviceOrientationEvent
    if (!reduced && !fine && DO && typeof DO.requestPermission !== 'function') {
      let base: { b: number; g: number } | null = null
      const onTilt = (e: DeviceOrientationEvent) => {
        if (e.beta == null || e.gamma == null) return
        if (!base) base = { b: e.beta, g: e.gamma }
        fillT.x = Math.max(-1, Math.min(1, (e.gamma - base.g) / 25))
        fillT.y = Math.max(-1, Math.min(1, (base.b - e.beta) / 25))
        fillT.a = 0.16 * Math.min(1, Math.hypot(fillT.x, fillT.y) * 1.5)
        kick()
      }
      window.addEventListener('deviceorientation', onTilt, { passive: true })
      cleanups.push(() => window.removeEventListener('deviceorientation', onTilt))
    }

    const ro = new ResizeObserver(() => ready && draw())
    ro.observe(canvas)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.clearInterval(tick)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      cleanups.forEach((c) => c())
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [normal])

  return <canvas ref={ref} className="portrait-light" aria-hidden="true" />
}
