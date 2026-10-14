import { WORDMARK } from '@/lib/wordmark'

function Svgs() {
  const L = WORDMARK.line
  return (
    <>
      <svg className="wm-line" viewBox={L.viewBox} width="100%" preserveAspectRatio="xMinYMax meet" aria-hidden="true" focusable="false">
        <g className="wm-part wm-z">
          <g className="wm-rise">
            <path d={L.zakaria.d} />
          </g>
        </g>
        <g className="wm-part wm-k">
          <g className="wm-rise">
            <path d={L.kortam.d} />
          </g>
        </g>
      </svg>
      <span className="wm-stack" aria-hidden="true">
        <svg className="wm-sz" viewBox={WORDMARK.zakaria.viewBox} width="100%" preserveAspectRatio="xMinYMax meet" focusable="false">
          <g className="wm-part wm-z">
            <g className="wm-rise">
              <path d={WORDMARK.zakaria.d} />
            </g>
          </g>
        </svg>
        <svg className="wm-sk" viewBox={WORDMARK.kortam.viewBox} width="100%" preserveAspectRatio="xMinYMax meet" focusable="false">
          <g className="wm-part wm-k">
            <g className="wm-rise">
              <path d={WORDMARK.kortam.d} />
            </g>
          </g>
        </svg>
      </span>
    </>
  )
}

/** His name as outlined Geist 600, cut exactly to the ink so it spans columns 1 to 12. */
export function Wordmark({ as = 'h1', className = '' }: { as?: 'h1' | 'p'; className?: string }) {
  if (as === 'h1') {
    return (
      <h1 className={`wordmark ${className}`}>
        <span className="sr-only">Zakaria Kortam</span>
        <Svgs />
      </h1>
    )
  }
  return (
    <p aria-hidden="true" className={`wordmark ${className}`}>
      <Svgs />
    </p>
  )
}
