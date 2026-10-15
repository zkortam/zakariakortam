/**
 * A sentence that lights up word by word as you scroll, while its section holds still on screen. Pure CSS
 * (scroll-driven animations, on the compositor): each word knows its share of the way through (--k) and brightens
 * over its own slice of the pinned scroll. Without scroll-timeline support, or with reduced motion, it is simply
 * the sentence.
 */
export function ScrollWords({ lead, rest }: { lead: string; rest: string }) {
  const a = lead.split(' ')
  const b = rest.split(' ')
  const n = a.length + b.length
  const word = (w: string, i: number) => (
    <span key={i} className="sw" style={{ ['--k' as string]: (i / n).toFixed(4) }}>
      {w}
    </span>
  )
  return (
    <>
      <span className="sr-only">
        {lead} {rest}
      </span>
      <span aria-hidden="true">
        {a.map((w, i) => (
          <span key={`a${i}`}>
            {word(w, i)}{' '}
          </span>
        ))}
        <span className="c-ink50">
          {b.map((w, i) => (
            <span key={`b${i}`}>
              {word(w, a.length + i)}
              {i < b.length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      </span>
    </>
  )
}
