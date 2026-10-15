/**
 * The whole body of work in three measured numbers, counted from the repositories:
 * TypeScript, TSX, Rust and Python lines, test cases, commits. They rise in with the
 * rest of the page rather than counting up.
 */
const FIGURES = [
  { value: '1.46M', label: 'lines of TypeScript, Rust, and Python' },
  { value: '28,295', label: 'tests' },
  { value: '8,580', label: 'commits, all in 2026' },
]

export function BodyOfWork() {
  return (
    <div className="col-span-full grid grid-cols-1 gap-y-[40px] md:grid-cols-3 md:gap-x-[var(--g)]">
      {FIGURES.map((f, i) => (
        <div key={f.label} className="bow" data-reveal="" style={{ ['--d' as string]: `${i * 90}ms` }}>
          <p className="bow-v tnum">{f.value}</p>
          <p className="bow-l">{f.label}</p>
        </div>
      ))}
    </div>
  )
}
