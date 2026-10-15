/**
 * A sentence that lights up word by word as you scroll, while its section holds still on screen. Pure CSS
 * (scroll-driven animations, on the compositor): each word knows its share of the way through (--k) and brightens
 * over its own slice of the pinned scroll. Without scroll-timeline support, or with reduced motion, it is simply
 * the sentence.
 */
/** The second sentence is the one that lands, so it carries the full ink. */
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
        <span className="c-ink50">
          {a.map((w, i) => (
            <span key={`a${i}`}>
              {word(w, i)}{' '}
            </span>
          ))}
        </span>
        <span>
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
