import activity from './activity.generated.json'
import { ACCENT, OTHER } from './accent'

export type Part = { id: string; label: string; value: number; color: string }
export type Figure = { value: string; label: string; total: number; parts: Part[] }

const part = (id: string, label: string, value: number): Part => ({ id, label, value, color: ACCENT[id] ?? OTHER })

/** Lines and tests are counted from each repository (the same figures as the project pages); commits come from git. */
const LINES = 1_460_000
const TESTS = 28_295

const byProject = activity.byProject as Record<string, number>
const commitParts = [
  part('surf', 'Surf', byProject.surf ?? 0),
  part('helio', 'Helio', byProject.helio ?? 0),
  part('airofind', 'AiroFind', byProject.airofind ?? 0),
].filter((p) => p.value > 0)

export const FIGURES: Figure[] = [
  {
    value: '1.46M',
    label: 'lines of TypeScript, Rust, and Python',
    total: LINES,
    parts: [
      part('surf', 'Surf', 823_000),
      part('helio', 'Helio', 262_000),
      part('spice-plus-plus', 'SPICE++', 195_000),
      part('rtl-plus-plus', 'RTL++', 50_000),
      part('other', 'Other projects', LINES - 823_000 - 262_000 - 195_000 - 50_000),
    ],
  },
  {
    value: TESTS.toLocaleString('en-US'),
    label: 'automated tests',
    total: TESTS,
    parts: [part('surf', 'Surf', 24_249), part('helio', 'Helio', 3_503), part('other', 'Other projects', TESTS - 24_249 - 3_503)],
  },
  {
    value: activity.total.toLocaleString('en-US'),
    label: `commits in ${activity.year}`,
    total: activity.total,
    parts: commitParts,
  },
]

export const ACTIVITY = activity as { year: number; through: string; total: number; byProject: Record<string, number>; days: Record<string, number> }

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  return n.toLocaleString('en-US')
}
