'use client'

import { useEffect, useRef } from 'react'

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

// Domain-warped value-noise FBM → maroon "liquid light" over black, with grain.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uSeed;

float hash(vec2 x){ return fract(sin(dot(x, vec2(12.9898,78.233))) * 43758.5453); }
float noise(vec2 x){
  vec2 i = floor(x), f = fract(x);
  float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 x){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a*noise(x); x *= 2.0; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = uv;
  p.x *= uRes.x / uRes.y;
  float t = uTime * 0.035 + uSeed * 7.0;

  vec2 q = vec2(fbm(p*1.4 + vec2(0.0, t)), fbm(p*1.4 + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(p*1.4 + 3.0*q + vec2(1.7, 9.2) + 0.10*t),
    fbm(p*1.4 + 3.0*q + vec2(8.3, 2.8) - 0.08*t)
  );
  float f = fbm(p*1.4 + 3.0*r);

  vec3 maroon = vec3(0.72, 0.26, 0.32);
  vec3 deep   = vec3(0.11, 0.035, 0.06);
  vec3 col = mix(vec3(0.0), deep, smoothstep(0.18, 0.9, f));
  col = mix(col, maroon, smoothstep(0.58, 1.08, f) * 0.9);

  // film grain
  float g = hash(gl_FragCoord.xy * 0.6 + fract(uTime));
  col += (g - 0.5) * 0.035;

  gl_FragColor = vec4(col, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  return sh
}

/**
 * Flowing maroon gradient on a GPU canvas. Animates only while on-screen.
 * `animate={false}` renders a single static frame (cheap — for many tiles).
 */
export function ShaderGradient({
  seed = 0,
  animate = true,
  className = '',
}: {
  seed?: number
  animate?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    })
    if (!gl) return

    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    )
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uSeed = gl.getUniformLocation(prog, 'uSeed')
    gl.uniform1f(uSeed, seed)

    const drawStatic = () => {
      gl.uniform1f(uTime, seed * 13.0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.25)
    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      gl.uniform2f(uRes, canvas.width, canvas.height)
      if (!animate) drawStatic()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let raf = 0
    let visible = true
    if (animate) {
      const start = performance.now()
      const render = (now: number) => {
        gl.uniform1f(uTime, (now - start) / 1000)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        raf = visible ? requestAnimationFrame(render) : 0
      }
      raf = requestAnimationFrame(render)

      const io = new IntersectionObserver(
        ([e]) => {
          visible = e.isIntersecting
          if (visible && !raf) raf = requestAnimationFrame(render)
        },
        { threshold: 0 },
      )
      io.observe(canvas)

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        io.disconnect()
        const ext = gl.getExtension('WEBGL_lose_context')
        ext?.loseContext()
      }
    }

    return () => {
      ro.disconnect()
      const ext = gl.getExtension('WEBGL_lose_context')
      ext?.loseContext()
    }
  }, [seed, animate])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
