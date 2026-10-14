/** The ZK mark: a small maroon tile with a serif Z. Matches the favicon. */
export function Mark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-7 w-7 items-center justify-center rounded-[9px] font-display text-[17px] leading-none text-white ${className}`}
      style={{
        background: 'linear-gradient(160deg, #9b2a3a, #4a0f19)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 18px -6px rgba(178,62,76,0.7)',
      }}
    >
      Z
    </span>
  )
}
