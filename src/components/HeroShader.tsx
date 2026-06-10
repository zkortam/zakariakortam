'use client'

import { ShaderGradient } from './ShaderGradient'

/**
 * Signature shader backdrop for inner-page heroes — flowing maroon on the
 * right, fading into the black so the left-aligned headline stays clean.
 * Desktop only.
 */
export function HeroShader({ seed = 0.3 }: { seed?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] lg:block"
      style={{
        maskImage:
          'radial-gradient(120% 120% at 100% 50%, #000 30%, transparent 72%)',
        WebkitMaskImage:
          'radial-gradient(120% 120% at 100% 50%, #000 30%, transparent 72%)',
      }}
    >
      <ShaderGradient seed={seed} className="block h-full w-full" />
    </div>
  )
}
