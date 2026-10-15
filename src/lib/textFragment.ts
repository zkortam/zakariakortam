/**
 * URL Text Fragments (#:~:text=[prefix-,]start[,end][,-suffix]) for "link to any sentence", plus a plain
 * #s-<slug> anchor for browsers that do not support them.
 */

/** Blocks that can be linked. Anything interactive or decorative is excluded. */
export const CITE_BLOCKS = '#main p, #main h1, #main h2, #main h3, #main li, #main blockquote, #main dd'
export const CITE_EXCLUDE =
  'a, button, nav, figure, .demo, [data-demo], .wordmark, [aria-hidden="true"], [contenteditable], input, textarea, select, [data-no-cite]'

/** Collapse ordinary whitespace only; no-break spaces stay, because the page text has them. */
export const squash = (s: string) => s.replace(/[ \t\n\r\f]+/g, ' ').trim()

/** Percent-encode one term; "-", "," and "&" are syntax in a text directive. */
export const encodeTerm = (s: string) =>
  encodeURIComponent(s).replace(/-/g, '%2D').replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())

export function supportsTextFragments(): boolean {
  return typeof document !== 'undefined' && 'fragmentDirective' in document
}

export function citeBlockOf(node: Node | null): HTMLElement | null {
  const el = node instanceof Element ? node : node?.parentElement
  const block = el?.closest<HTMLElement>(CITE_BLOCKS.replace(/#main /g, '')) ?? null
  if (!block || !block.closest('#main')) return null
  if (block.closest(CITE_EXCLUDE) || block.querySelector('a, button')?.textContent === block.textContent) return null
  // Prefer the outermost list item or paragraph, never a nested fragment.
  return squash(block.textContent ?? '').length > 1 ? block : null
}

export function slugOf(text: string): string {
  return squash(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join('-')
}

function count(hay: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let i = hay.indexOf(needle)
  while (i !== -1) {
    n++
    i = hay.indexOf(needle, i + needle.length)
  }
  return n
}

/** Words of `s` with their character offsets. */
function words(s: string) {
  const out: { w: string; i: number }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) out.push({ w: m[0], i: m.index })
  return out
}

/**
 * Text directive for `passage`, a substring of `blockText`, chosen so the first match on the page is the
 * passage itself: short passages are quoted whole, long ones as start,end, with a prefix when the start
 * also appears elsewhere.
 */
export function textDirective(passage: string, blockText: string, pageText: string): string {
  const p = squash(passage)
  const ws = words(p)
  if (!ws.length) return ''
  const at = blockText.indexOf(p)
  const before = at > 0 ? squash(blockText.slice(0, at)).split(' ').slice(-3).join(' ') : ''
  const prefix = (needle: string) => (before && count(pageText, needle) > 1 ? encodeTerm(before) + '-,' : '')

  if (ws.length <= 8) return 'text=' + prefix(p) + encodeTerm(p)

  let k = 3
  let start = p.slice(0, ws[k].i).trim()
  while (k < ws.length - 4 && count(pageText, start) > 1) {
    k++
    start = p.slice(0, ws[k].i).trim()
  }
  const end = p.slice(ws[ws.length - 3].i)
  return 'text=' + prefix(start) + encodeTerm(start) + ',' + encodeTerm(end)
}

/** The sentence around [from, to) in `text`, for when a touch selection is a word or two. */
export function sentenceAround(text: string, from: number, to: number): string {
  const head = text.slice(0, from)
  const s = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '))
  const startAt = s === -1 ? 0 : s + 2
  const m = /[.?!](\s|$)/.exec(text.slice(to))
  const endAt = m ? to + m.index + 1 : text.length
  return text.slice(startAt, endAt).trim()
}

export type ParsedDirective = { prefix?: string; start: string; end?: string; suffix?: string }

export function parseDirective(raw: string): ParsedDirective | null {
  const m = /:~:(?:.*&)?text=([^&]+)/.exec(raw)
  if (!m) return null
  const parts = m[1].split(',')
  let prefix: string | undefined
  let suffix: string | undefined
  if (parts[0]?.endsWith('-')) prefix = parts.shift()!.slice(0, -1)
  if (parts.length && parts[parts.length - 1].startsWith('-')) suffix = parts.pop()!.slice(1)
  const dec = (s?: string) => {
    if (s === undefined) return undefined
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  }
  const start = dec(parts[0])
  if (!start) return null
  return { prefix: dec(prefix), start, end: dec(parts[1]), suffix: dec(suffix) }
}

/** Find a directive in the page and return a DOM Range over it (our own fallback matcher). */
export function rangeForDirective(d: ParsedDirective, root: Element = document.body): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let full = ''
  const offsets: number[] = []
  while (walker.nextNode()) {
    const t = walker.currentNode as Text
    if (t.parentElement?.closest('script, style, [aria-hidden="true"]')) continue
    offsets.push(full.length)
    nodes.push(t)
    full += t.data
  }
  // Compare on a squashed copy, then map back to raw offsets.
  const map: number[] = []
  let flat = ''
  let ws = false
  for (let i = 0; i < full.length; i++) {
    const c = full[i]
    if (/[ \t\n\r\f]/.test(c)) {
      if (ws) continue
      ws = true
      flat += ' '
    } else {
      ws = false
      flat += c
    }
    map.push(i)
  }
  const lower = flat.toLowerCase()
  const find = (needle: string, from: number) => lower.indexOf(squash(needle).toLowerCase(), from)

  let s = -1
  let from = 0
  for (;;) {
    if (d.prefix) {
      const p = find(d.prefix, from)
      if (p === -1) return null
      const after = p + squash(d.prefix).length
      const nxt = find(d.start, after)
      if (nxt === -1) return null
      if (lower.slice(after, nxt).trim() !== '') {
        from = p + 1
        continue
      }
      s = nxt
    } else {
      s = find(d.start, from)
      if (s === -1) return null
    }
    break
  }
  let e = s + squash(d.start).length
  if (d.end) {
    const ei = find(d.end, e)
    if (ei === -1) return null
    e = ei + squash(d.end).length
  }
  const raw = (flatIdx: number) => map[Math.min(flatIdx, map.length - 1)]
  const rs = raw(s)
  const re = raw(e - 1) + 1
  const locate = (pos: number) => {
    let lo = 0
    let hi = offsets.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (offsets[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return { node: nodes[lo], off: pos - offsets[lo] }
  }
  const a = locate(rs)
  const b = locate(re - 1)
  const range = document.createRange()
  range.setStart(a.node, a.off)
  range.setEnd(b.node, b.off + 1)
  return range
}
