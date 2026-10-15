// Relative imports on purpose: scripts/build-embeddings.cjs loads this file with jiti.
import { projects } from '../projects-data'
import { KNOWLEDGE_DOCS } from './knowledge.generated'

/** Which curated write-up in src/knowledge describes each project. */
const WRITEUP: Record<string, string> = {
  helio: 'helio',
  surf: 'surf',
  'surf-messenger': 'surf',
  'spice-plus-plus': 'spice-plus-plus',
  'rtl-plus-plus': 'rtl-plus-plus',
  wingman: 'wingman',
  airofind: 'airofind',
}

export type ProjectDoc = { id: string; title: string; text: string }

/** One searchable document per project and role: site copy plus its write-up. */
export function projectDocs(): ProjectDoc[] {
  return projects.map((p) => {
    const title = p.org ?? p.title
    const parts = [
      `${title}. ${p.kind === 'work' ? 'Job' : 'Project'}, ${p.year}. ${p.role}.`,
      p.line,
      p.overview,
      p.problem,
      p.approach,
      p.results?.join('. '),
      `Stack: ${p.stack.join(', ')}.`,
    ]
    const w = WRITEUP[p.id]
    const doc = w ? KNOWLEDGE_DOCS.find((d) => d.id === w)?.text : undefined
    if (doc) parts.push(doc.slice(0, 6000))
    return { id: p.id, title, text: parts.filter(Boolean).join('\n') }
  })
}
