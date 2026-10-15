/* The hero's field of light: rows of points running to a horizon behind the portrait, rising and falling like a slow
   sea. One WebGL2 draw call; every point's position is a pure function of its grid coordinate and the time, so the CPU
   uploads a few uniforms per frame. The cursor parts the field in screen space. Same family as the Surf site's tide,
   lit in this site's rose and bone. */

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aGrid;
in float aSeed;
uniform float uTime;
uniform float uAspect;
uniform vec2 uPointer;
uniform float uPointerOn;
uniform float uSize;
uniform float uShift;
uniform float uRise;
uniform float uGain;
out float vLight;
out float vTint;

float height(vec2 p, float t) {
  float h = 0.0;
  h += sin(p.x * 0.9 + t * 0.5 + p.y * 0.35) * 0.42;
  h += sin(p.x * 1.7 - p.y * 0.8 + t * 0.72) * 0.2;
  h += sin(p.x * 0.35 + p.y * 1.3 - t * 0.32) * 0.35;
  h += sin(p.x * 3.1 + p.y * 2.3 + t * 1.2) * 0.06;
  return h;
}

void main() {
  float t = uTime;
  float depth = pow(aGrid.y, 1.55);
  float z = -(1.2 + depth * 34.0);
  float spread = 3.2 + depth * 58.0;
  float x = (aGrid.x - 0.5) * spread;
  float h = height(vec2(x, z), t);
  float y = -1.05 + h * (0.5 + depth * 1.1);
  // The sea rises out of the dark as the page opens.
  y -= (1.0 - uRise) * (1.4 + depth * 2.0);
  float crest = smoothstep(0.1, 0.9, h);
  float light = mix(0.6, 1.4, crest) * (1.0 - depth * 0.4);

  // The eye looks down at the water a little, so the horizon sits just above the middle of the frame.
  float pitch = 0.14;
  float vy = y * cos(pitch) - z * sin(pitch);
  float vz = z * cos(pitch) + y * sin(pitch);

  float fy = 1.0 / tan(radians(25.0));
  vec2 ndc = vec2(x * fy / uAspect, vy * fy) / -vz;
  ndc.y += uShift;

  vec2 d = ndc - uPointer;
  d.x *= uAspect;
  float dist = length(d);
  float push = uPointerOn * exp(-dist * dist * 16.0) * 0.12;
  ndc += (dist > 1e-4 ? normalize(vec2(d.x / uAspect, d.y)) : vec2(0.0)) * push;
  light += uPointerOn * exp(-dist * dist * 9.0) * 0.5;

  float depthScale = clamp(5.0 / -vz, 0.8, 2.2);
  gl_PointSize = uSize * depthScale * mix(0.75, 1.25, fract(aSeed * 17.0));
  gl_Position = vec4(ndc, 0.0, 1.0);
  vLight = light * (1.0 - smoothstep(28.0, 50.0, -vz)) * uRise * uGain;
  vTint = aSeed;
}
`

const FRAG = /* glsl */ `#version 300 es
precision mediump float;
in float vLight;
in float vTint;
out vec4 o;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float disc = smoothstep(0.5, 0.28, r);
  // Oxblood to rose to bone: the brightest crests close to the wordmark's white.
  vec3 deep = vec3(0.50, 0.10, 0.17);
  vec3 rose = vec3(0.86, 0.38, 0.40);
  vec3 bone = vec3(1.0, 0.90, 0.84);
  float k = clamp(vLight * 0.75 + vTint * 0.22, 0.0, 1.0);
  vec3 col = mix(deep, rose, smoothstep(0.0, 0.7, k));
  col = mix(col, bone, smoothstep(0.95, 1.45, vLight) * 0.7);
  float a = disc * clamp(vLight, 0.0, 1.8) * 0.55;
  o = vec4(col * a, a);
}
`

export type FieldFrame = { time: number; pointer: [number, number]; pointerOn: number; shift: number; rise: number; gain: number }

export class FieldRenderer {
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private vao: WebGLVertexArrayObject
  private count: number
  private u: Record<string, WebGLUniformLocation | null> = {}

  constructor(
    private canvas: HTMLCanvasElement,
    cols: number,
    rows: number,
  ) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' })
    if (!gl) throw new Error('webgl2 unavailable')
    this.gl = gl
    this.prog = this.link(VERT, FRAG)
    for (const n of ['uTime', 'uAspect', 'uPointer', 'uPointerOn', 'uSize', 'uShift', 'uRise', 'uGain']) this.u[n] = gl.getUniformLocation(this.prog, n)

    this.count = cols * rows
    const grid = new Float32Array(this.count * 2)
    const seed = new Float32Array(this.count)
    let s = 1337
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        grid[i * 2] = (c + (rand() - 0.5) * 0.35) / (cols - 1)
        grid[i * 2 + 1] = r / (rows - 1)
        seed[i] = rand()
      }
    }
    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    this.attr('aGrid', grid, 2)
    this.attr('aSeed', seed, 1)
    gl.bindVertexArray(null)
  }

  private attr(name: string, data: Float32Array, size: number) {
    const gl = this.gl
    const loc = gl.getAttribLocation(this.prog, name)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
  }

  private link(vs: string, fs: string) {
    const gl = this.gl
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'compile failed')
      return sh
    }
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link failed')
    return p
  }

  resize(width: number, height: number, dpr: number) {
    const w = Math.max(1, Math.round(width * dpr))
    const h = Math.max(1, Math.round(height * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.gl.viewport(0, 0, w, h)
  }

  draw(f: FieldFrame, pointSize: number) {
    const gl = this.gl
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.prog)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.uniform1f(this.u.uTime, f.time)
    gl.uniform1f(this.u.uAspect, this.canvas.width / this.canvas.height)
    gl.uniform2f(this.u.uPointer, f.pointer[0], f.pointer[1])
    gl.uniform1f(this.u.uPointerOn, f.pointerOn)
    gl.uniform1f(this.u.uSize, pointSize)
    gl.uniform1f(this.u.uShift, f.shift)
    gl.uniform1f(this.u.uRise, f.rise)
    gl.uniform1f(this.u.uGain, f.gain)
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.POINTS, 0, this.count)
    gl.bindVertexArray(null)
  }

  dispose() {
    const gl = this.gl
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.prog)
    this.canvas.width = 1
    this.canvas.height = 1
  }
}
