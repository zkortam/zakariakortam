/** One line drawing per project without a picture of its own, all on the same 64-unit grid and the same stroke. */
const G: Record<string, React.ReactNode> = {
  'documap-ai': (
    <>
      <path d="M18 8h20l10 10v38H18z" />
      <path d="M38 8v10h10" />
      <path d="M24 28h18M24 35h18M24 42h12" />
      <rect x="22.5" y="31.5" width="21" height="7" rx="1.5" className="g-fill" />
    </>
  ),
  wingman: (
    <>
      <path d="M32 8l18 7v14c0 12-8 21-18 26-10-5-18-14-18-26V15z" />
      <path d="M24 32l6 6 11-12" />
    </>
  ),
  dealflow: (
    <>
      <path d="M10 44l12-12 9 8 15-17" />
      <path d="M38 23h8v8" />
      <path d="M10 54h44" />
    </>
  ),
  'sentiment-analysis': (
    <>
      <path d="M12 44a20 20 0 0 1 40 0" />
      <path d="M32 44l10-12" />
      <circle cx="32" cy="44" r="2.5" className="g-fill" />
      <path d="M16 50h32" />
    </>
  ),
  'alex-ai': (
    <>
      <path d="M14 54V24l18-12 18 12v30" />
      <path d="M24 54V36h16v18" />
      <path d="M10 54h44" />
    </>
  ),
  'risk-factors-viz': (
    <>
      <circle cx="16" cy="20" r="4" />
      <circle cx="46" cy="16" r="4" />
      <circle cx="32" cy="36" r="5" className="g-fill" />
      <circle cx="14" cy="48" r="4" />
      <circle cx="50" cy="46" r="4" />
      <path d="M19 23l9 9M43 19l-8 13M28 39l-11 7M36 39l11 5" />
    </>
  ),
  legiscan: (
    <>
      <path d="M32 10v44M20 54h24" />
      <path d="M14 18h36" />
      <path d="M14 18l-6 16h12zM50 18l-6 16h12z" />
    </>
  ),
  'clippy-2': (
    <path d="M40 22v20a8 8 0 0 1-16 0V16a5.5 5.5 0 0 1 11 0v25a3 3 0 0 1-6 0V22" />
  ),
  'hypersonic-sprinkler': (
    <>
      <path d="M32 54V40" />
      <path d="M32 40c-6-12-16-16-24-14M32 40c-2-14-4-22-4-28M32 40c6-12 16-16 24-14M32 40c2-14 4-22 4-28" />
      <path d="M22 54h20" />
    </>
  ),
}

export function hasGlyph(id: string) {
  return id in G
}

export function Glyph({ id, className = '' }: { id: string; className?: string }) {
  const g = G[id]
  if (!g) return null
  return (
    <svg viewBox="0 0 64 64" className={`glyph ${className}`} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {g}
    </svg>
  )
}
