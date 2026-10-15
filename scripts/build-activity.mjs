// Commits per day in the current year, read from the local clones of the product repositories.
// Run by hand on a machine that has them (`node scripts/build-activity.mjs`); the output is committed,
// so builds elsewhere use the last snapshot. Commits are de-duplicated by hash across branches.
import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const HOME = homedir()
const REPOS = [
  { id: 'surf', title: 'Surf', dir: 'SurfVersion4' },
  { id: 'surf', title: 'Surf', dir: 'SurfWebsite' },
  { id: 'helio', title: 'Helio', dir: 'helio' },
  { id: 'airofind', title: 'AiroFind', dir: 'AiroFind' },
]
const year = new Date().getFullYear()
const since = `${year}-01-01`

const days = {}
const byRepo = {}
const seen = new Set()
for (const r of REPOS) {
  const dir = join(HOME, r.dir)
  if (!existsSync(join(dir, '.git'))) continue
  const out = execFileSync('git', ['-C', dir, 'log', '--all', `--since=${since}`, '--format=%H %ad', '--date=short'], {
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  })
  for (const line of out.split('\n')) {
    const [hash, date] = line.split(' ')
    if (!hash || !date || seen.has(hash) || !date.startsWith(String(year))) continue
    seen.add(hash)
    days[date] = (days[date] ?? 0) + 1
    byRepo[r.id] = (byRepo[r.id] ?? 0) + 1
  }
}

const total = Object.values(days).reduce((a, b) => a + b, 0)
if (!total) {
  console.log('build-activity: no local repositories found, keeping the committed snapshot')
  process.exit(0)
}
const snapshot = {
  year,
  through: new Date().toISOString().slice(0, 10),
  total,
  byProject: byRepo,
  days,
}
writeFileSync(new URL('../src/lib/activity.generated.json', import.meta.url), JSON.stringify(snapshot) + '\n')
console.log(`build-activity: ${total} commits across ${Object.keys(byRepo).length} projects`)
