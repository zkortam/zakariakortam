// Is there real graphics hardware? Software rasterizers (SwiftShader, llvmpipe, blocklisted GPUs) report a
// "major performance caveat"; the GPU-only effects (portrait relight, refractive glass) stay off there.
// `?gpu=force` overrides for testing in headless browsers.

let cached: boolean | null = null

export function hasGpu(): boolean {
  if (cached !== null) return cached
  try {
    if (new URLSearchParams(location.search).get('gpu') === 'force') return (cached = true)
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ||
      c.getContext('webgl', { failIfMajorPerformanceCaveat: true })) as WebGLRenderingContext | null
    cached = !!gl
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) cached = false
    }
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
