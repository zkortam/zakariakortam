/**
 * A small exact algebra engine for linear equations in one unknown: parse, expand, collect, clear
 * fractions, isolate. Every number is a rational of BigInts, never a float, and every step's claim
 * is checked by evaluating both sides before the step is allowed onto the board.
 */

// ---------- Rationals ----------

export type Q = { n: bigint; d: bigint } // d > 0, gcd(n, d) = 1

const abs = (a: bigint) => (a < BigInt(0) ? -a : a)
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a)
  b = abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}
const ZERO_N = BigInt(0)
const ONE_N = BigInt(1)

export function q(n: bigint | number, d: bigint | number = 1): Q {
  let N = BigInt(n)
  let D = BigInt(d)
  if (D === ZERO_N) throw new AlgebraError('That divides by zero.')
  if (D < ZERO_N) {
    N = -N
    D = -D
  }
  const g = gcd(N, D) || ONE_N
  return { n: N / g, d: D / g }
}
export const Z = q(0)
export const ONE = q(1)
export const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
export const neg = (a: Q) => q(-a.n, a.d)
export const sub = (a: Q, b: Q) => add(a, neg(b))
export const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
export const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n)
export const isZero = (a: Q) => a.n === ZERO_N
export const eq = (a: Q, b: Q) => a.n === b.n && a.d === b.d
export const isInt = (a: Q) => a.d === ONE_N
export const sign = (a: Q) => (a.n > ZERO_N ? 1 : a.n < ZERO_N ? -1 : 0)
const lcm = (a: bigint, b: bigint) => (a / gcd(a, b)) * b

const MINUS = '−'

/** "3", "−3", "5/2", "−5/2". */
export function fmtQ(a: Q): string {
  const s = a.n < ZERO_N ? MINUS : ''
  return isInt(a) ? `${s}${abs(a.n)}` : `${s}${abs(a.n)}/${a.d}`
}

export class AlgebraError extends Error {}

// ---------- Parsing ----------

type Node =
  | { k: 'num'; v: Q; raw?: string }
  | { k: 'var' }
  | { k: 'neg'; a: Node }
  | { k: 'add' | 'sub'; a: Node; b: Node }
  | { k: 'mul'; a: Node; b: Node; implicit: boolean }
  | { k: 'div'; a: Node; b: Node }
  | { k: 'pow'; a: Node; e: number }
  | { k: 'paren'; a: Node }

type Tok = { t: 'num'; v: Q; raw: string } | { t: 'var'; name: string } | { t: 'op'; v: string }

const MAX_LEN = 60

function lex(src: string): { toks: Tok[]; letter: string } {
  const s = src
    .replace(/[−–—]/g, '-')
    .replace(/[×·∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[\[{]/g, '(')
    .replace(/[\]}]/g, ')')
  const toks: Tok[] = []
  const letters = new Set<string>()
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    const num = /^(\d+(?:\.\d+)?|\.\d+)/.exec(s.slice(i))
    if (num) {
      const [whole, frac = ''] = num[1].split('.')
      if (whole.length + frac.length > 12) throw new AlgebraError('Keep each number under 12 digits.')
      toks.push({ t: 'num', v: q(BigInt((whole || '0') + frac), BigInt(10) ** BigInt(frac.length)), raw: num[1] })
      i += num[1].length
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      letters.add(c)
      toks.push({ t: 'var', name: c })
      i++
      continue
    }
    if ('+-*/()^='.includes(c)) {
      toks.push({ t: 'op', v: c })
      i++
      continue
    }
    throw new AlgebraError(`The board reads numbers, one letter, + − × ÷ and brackets, not “${c}”.`)
  }
  if (letters.size > 1) throw new AlgebraError(`Use one letter for the unknown. This has ${[...letters].join(' and ')}.`)
  if (letters.size === 0) throw new AlgebraError('Add a letter for the unknown, like x.')
  return { toks, letter: [...letters][0] }
}

function parseSide(toks: Tok[]): Node {
  let i = 0
  const peek = () => toks[i]
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v
  const near = () => {
    const t = toks[i] ?? toks[i - 1]
    return t ? (t.t === 'op' ? t.v : t.t === 'var' ? t.name : fmtQ(t.v)) : ''
  }

  function expr(): Node {
    let a = term()
    while (isOp('+') || isOp('-')) {
      const op = (toks[i++] as { v: string }).v
      a = { k: op === '+' ? 'add' : 'sub', a, b: term() }
    }
    return a
  }
  function term(): Node {
    let a = unary()
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[i++] as { v: string }).v
        const b = unary()
        a = op === '*' ? { k: 'mul', a, b, implicit: false } : { k: 'div', a, b }
      } else if (peek() && (peek().t !== 'op' || isOp('('))) {
        a = { k: 'mul', a, b: power(), implicit: true }
      } else return a
    }
  }
  function unary(): Node {
    if (isOp('-')) {
      i++
      return { k: 'neg', a: unary() }
    }
    if (isOp('+')) {
      i++
      return unary()
    }
    return power()
  }
  function power(): Node {
    const a = primary()
    if (isOp('^')) {
      i++
      const t = peek()
      if (!t || t.t !== 'num' || !isInt(t.v) || t.v.n > BigInt(6)) throw new AlgebraError('Use a small whole number as a power.')
      i++
      return { k: 'pow', a, e: Number(t.v.n) }
    }
    return a
  }
  function primary(): Node {
    const t = peek()
    if (!t) throw new AlgebraError('Something is missing at the end of a side.')
    if (t.t === 'num') {
      i++
      return { k: 'num', v: t.v, raw: t.raw }
    }
    if (t.t === 'var') {
      i++
      return { k: 'var' }
    }
    if (t.v === '(') {
      i++
      const a = expr()
      if (!isOp(')')) throw new AlgebraError('A bracket is missing its partner.')
      i++
      return { k: 'paren', a }
    }
    if (t.v === ')') throw new AlgebraError('A bracket is missing its partner.')
    throw new AlgebraError(`Something is missing near “${near()}”.`)
  }

  const n = expr()
  if (i < toks.length) {
    const t = toks[i]
    if (t.t === 'op' && t.v === ')') throw new AlgebraError('A bracket is missing its partner.')
    throw new AlgebraError(`Something is missing near “${near()}”.`)
  }
  return n
}

// ---------- Linear forms ----------

/** a·x + b */
type Lin = { a: Q; b: Q }

const NONLINEAR = 'That one is not linear. Keep the letter to the first power, like 3x + 2 = 11.'

function lin(n: Node): Lin {
  switch (n.k) {
    case 'num':
      return { a: Z, b: n.v }
    case 'var':
      return { a: ONE, b: Z }
    case 'paren':
      return lin(n.a)
    case 'neg': {
      const r = lin(n.a)
      return { a: neg(r.a), b: neg(r.b) }
    }
    case 'add':
    case 'sub': {
      const l = lin(n.a)
      const r = lin(n.b)
      const f = n.k === 'add' ? add : sub
      return { a: f(l.a, r.a), b: f(l.b, r.b) }
    }
    case 'mul': {
      const l = lin(n.a)
      const r = lin(n.b)
      if (!isZero(l.a) && !isZero(r.a)) throw new AlgebraError(NONLINEAR)
      return { a: add(mul(l.a, r.b), mul(r.a, l.b)), b: mul(l.b, r.b) }
    }
    case 'div': {
      const l = lin(n.a)
      const r = lin(n.b)
      if (!isZero(r.a)) throw new AlgebraError(NONLINEAR)
      if (isZero(r.b)) throw new AlgebraError('That divides by zero.')
      return { a: div(l.a, r.b), b: div(l.b, r.b) }
    }
    case 'pow': {
      const l = lin(n.a)
      if (n.e === 0) return { a: Z, b: ONE }
      if (n.e === 1) return l
      if (!isZero(l.a)) throw new AlgebraError(NONLINEAR)
      let v = ONE
      for (let k = 0; k < n.e; k++) v = mul(v, l.b)
      return { a: Z, b: v }
    }
  }
}

const evalAt = (l: Lin, x: Q) => add(mul(l.a, x), l.b)

// ---------- Printing ----------

type Term = { c: Q; x: boolean }

function prec(n: Node): number {
  return n.k === 'add' || n.k === 'sub' ? 1 : n.k === 'neg' ? 2 : n.k === 'mul' || n.k === 'div' ? 3 : 4
}

/** Print a node the way it would be written on a board; `at` substitutes a value for the letter. */
function print(n: Node, x: string, at?: Q, lead = true): string {
  const p = (m: Node) => print(m, x, at, false)
  const wrap = (m: Node, min: number) => (prec(m) < min ? `(${print(m, x, at, true)})` : p(m))
  switch (n.k) {
    case 'num':
      return n.raw ?? fmtQ(n.v)
    case 'var':
      // A substituted value keeps its own brackets unless it leads its group and is a plain integer.
      return at ? ((sign(at) < 0 && !lead) || !isInt(at) ? `(${fmtQ(at)})` : fmtQ(at)) : x
    case 'paren':
      return `(${print(n.a, x, at, true)})`
    case 'neg':
      return `${MINUS}${wrap(n.a, 3)}`
    case 'add':
      return `${print(n.a, x, at, lead)} + ${wrap(n.b, 2)}`
    case 'sub':
      return `${print(n.a, x, at, lead)} ${MINUS} ${wrap(n.b, 2)}`
    case 'mul': {
      const right = n.b.k === 'var' && at ? `(${fmtQ(at)})` : wrap(n.b, 4)
      const tight = n.implicit && (n.b.k === 'var' || n.b.k === 'paren') && n.a.k !== 'var'
      return tight ? `${wrap(n.a, 3)}${right}` : `${wrap(n.a, 3)} × ${wrap(n.b, 4)}`
    }
    case 'div':
      return `${n.a.k === 'mul' && n.a.implicit && !at ? p(n.a) : wrap(n.a, 4)}/${wrap(n.b, 4)}`
    case 'pow':
      return `${wrap(n.a, 4)}^${n.e}`
  }
}

/** "3x", "x", "−x", "x/2", "3x/4", "5". */
function mono(c: Q, isX: boolean, x: string): string {
  if (!isX) return fmtQ(c)
  const s = c.n < ZERO_N ? MINUS : ''
  const n = abs(c.n)
  const head = n === ONE_N ? x : `${n}${x}`
  return c.d === ONE_N ? `${s}${head}` : `${s}${head}/${c.d}`
}

function printTerms(ts: Term[], x: string): string {
  if (ts.length === 0) return '0'
  return ts
    .map((t, i) => {
      const body = mono(sign(t.c) < 0 && i > 0 ? neg(t.c) : t.c, t.x, x)
      return i === 0 ? body : `${sign(t.c) < 0 ? MINUS : '+'} ${body}`
    })
    .join(' ')
}

/** A collected side, x term first unless the side was written constant first. */
function sideTerms(l: Lin, xFirst: boolean): Term[] {
  const xs: Term[] = isZero(l.a) ? [] : [{ c: l.a, x: true }]
  const cs: Term[] = isZero(l.b) ? [] : [{ c: l.b, x: false }]
  return xFirst ? [...xs, ...cs] : [...cs, ...xs]
}

// ---------- Expansion ----------

const negT = (ts: Term[]) => ts.map((t) => ({ c: neg(t.c), x: t.x }))
const sumT = (ts: Term[]): Lin => ts.reduce<Lin>((acc, t) => (t.x ? { a: add(acc.a, t.c), b: acc.b } : { a: acc.a, b: add(acc.b, t.c) }), { a: Z, b: Z })

/** Distribute without collecting: 3(x − 2) + x → 3x − 6 + x. */
function expand(n: Node): Term[] {
  switch (n.k) {
    case 'num':
      return isZero(n.v) ? [] : [{ c: n.v, x: false }]
    case 'var':
      return [{ c: ONE, x: true }]
    case 'paren':
      return expand(n.a)
    case 'neg':
      return negT(expand(n.a))
    case 'add':
      return [...expand(n.a), ...expand(n.b)]
    case 'sub':
      return [...expand(n.a), ...negT(expand(n.b))]
    case 'mul': {
      const l = expand(n.a)
      const r = expand(n.b)
      const lc = l.every((t) => !t.x)
      const rc = r.every((t) => !t.x)
      if (!lc && !rc) throw new AlgebraError(NONLINEAR)
      if (lc && rc) {
        const v = mul(sumT(l).b, sumT(r).b)
        return isZero(v) ? [] : [{ c: v, x: false }]
      }
      const k = lc ? sumT(l).b : sumT(r).b
      return (lc ? r : l).map((t) => ({ c: mul(k, t.c), x: t.x })).filter((t) => !isZero(t.c))
    }
    case 'div': {
      const r = lin(n.b)
      if (!isZero(r.a)) throw new AlgebraError(NONLINEAR)
      if (isZero(r.b)) throw new AlgebraError('That divides by zero.')
      return expand(n.a).map((t) => ({ c: div(t.c, r.b), x: t.x }))
    }
    case 'pow': {
      if (n.e === 1) return expand(n.a)
      const v = lin(n)
      return isZero(v.b) ? [] : [{ c: v.b, x: false }]
    }
  }
}

/** Is this side already written as plain terms (3x, −x, x/2, 5), so expanding changes nothing? */
function isFlat(n: Node): boolean {
  const monoN = (m: Node): boolean =>
    m.k === 'num' ||
    m.k === 'var' ||
    (m.k === 'mul' && m.implicit && m.a.k === 'num' && m.b.k === 'var') ||
    (m.k === 'div' && m.b.k === 'num' && (m.a.k === 'var' || monoN(m.a)) && m.a.k !== 'div') ||
    (m.k === 'neg' && monoN(m.a))
  if (n.k === 'add' || n.k === 'sub') return isFlat(n.a) && monoN(n.b)
  return monoN(n)
}

/** The bracket a single "multiply into the brackets" step is about, when there is exactly one. */
function distributions(n: Node, out: Node[] = []): Node[] {
  if (n.k === 'mul' && (n.a.k === 'paren' || n.b.k === 'paren')) out.push(n)
  if ('a' in n && typeof n.a === 'object') distributions(n.a, out)
  if ('b' in n && typeof n.b === 'object') distributions(n.b, out)
  return out
}

// ---------- Solving ----------

export type Beat = {
  /** What is written on the board in this beat. */
  ink: string
  /** What the tutor says while writing it. */
  say: string
  /** What is checked before anything is said. */
  claim: string
  /** Shown once the check holds. */
  ok: string
  /** The check, run for real. */
  verified: boolean
}

export type Solution = { beats: Beat[]; answer: string; kind: 'one' | 'all' | 'none'; letter: string; check: string }

export function solve(input: string): Solution {
  const src = input.trim()
  if (!src) throw new AlgebraError('Type an equation, like 4(x + 3) = 2x − 6.')
  if (src.length > MAX_LEN) throw new AlgebraError(`Keep it under ${MAX_LEN} characters.`)
  const { toks, letter: x } = lex(src)
  const eqAt = toks.findIndex((t) => t.t === 'op' && t.v === '=')
  if (eqAt < 0) throw new AlgebraError('Add an equals sign, like 2x + 1 = 7.')
  if (toks.findIndex((t, i) => i > eqAt && t.t === 'op' && t.v === '=') > 0) throw new AlgebraError('Use one equals sign.')
  if (eqAt === 0 || eqAt === toks.length - 1) throw new AlgebraError('Write something on both sides of the equals sign.')
  const L = parseSide(toks.slice(0, eqAt))
  const R = parseSide(toks.slice(eqAt + 1))
  const linL = lin(L)
  const linR = lin(R)

  const beats: Beat[] = []
  const say = (b: Omit<Beat, 'verified'>, verified: boolean) => beats.push({ ...b, verified })
  const eqn = (l: string, r: string) => `${l} = ${r}`

  const original = eqn(print(L, x), print(R, x))
  say({ ink: original, say: 'Let’s solve this one together.', claim: 'Reading the problem', ok: 'Problem parsed' }, true)

  // 1. Expand.
  let tl = expand(L)
  let tr = expand(R)
  const flatL = isFlat(L)
  const flatR = isFlat(R)
  if (!flatL || !flatR) {
    const sites = [...distributions(L), ...distributions(R)]
    const one = sites.length === 1 && sites[0].k === 'mul' ? sites[0] : null
    const k = one ? (one.a.k === 'paren' ? one.b : one.a) : null
    const site = one ? expand(one) : null
    const claim = one && site ? `${print(one, x)} = ${printTerms(site, x)}` : `${print(flatL ? R : L, x)} = ${printTerms(flatL ? tr : tl, x)}`
    const holds = (n: Node, ts: Term[]) => {
      const a = lin(n)
      const b = sumT(ts)
      return eq(a.a, b.a) && eq(a.b, b.b)
    }
    const ok = (one ? holds(one, site!) : true) && holds(L, tl) && holds(R, tr)
    const what = one && k && (k.k === 'num' || k.k === 'neg' || k.k === 'var') ? `multiply the ${print(k, x)} into the brackets` : 'expand the brackets'
    say({ ink: eqn(printTerms(tl, x), printTerms(tr, x)), say: `First, ${what}.`, claim, ok: claim }, ok)
  }

  // 2. Collect like terms.
  const needs = (ts: Term[]) => ts.filter((t) => t.x).length > 1 || ts.filter((t) => !t.x).length > 1
  const xFirstL = !tl.length || tl[0].x || !tl.some((t) => t.x)
  const xFirstR = !tr.length || tr[0].x || !tr.some((t) => t.x)
  let l: Lin = sumT(tl)
  let r: Lin = sumT(tr)
  if (needs(tl) || needs(tr)) {
    const side = needs(tl) ? tl : tr
    const xs = side.filter((t) => t.x)
    const cs = side.filter((t) => !t.x)
    const group = xs.length > 1 ? xs : cs
    const total = sumT(group)
    const claim = `${printTerms(group, x)} = ${printTerms(sideTerms(total, true), x)}`
    tl = sideTerms(l, xFirstL)
    tr = sideTerms(r, xFirstR)
    const ok = eq(sumT(tl).a, linL.a) && eq(sumT(tl).b, linL.b) && eq(sumT(tr).a, linR.a) && eq(sumT(tr).b, linR.b)
    say({ ink: eqn(printTerms(tl, x), printTerms(tr, x)), say: 'Collect the like terms.', claim, ok: claim }, ok)
  }
  let xFirst = xFirstL
  const show = () => eqn(printTerms(sideTerms(l, xFirst), x), printTerms(sideTerms(r, true), x))

  // 3. Clear fractions.
  const dens = [l.a.d, l.b.d, r.a.d, r.b.d]
  const m = dens.reduce((a, b) => lcm(a, b), ONE_N)
  if (m !== ONE_N) {
    const M = q(m)
    const before = `${printTerms(sideTerms(l, xFirst), x)}`
    const nl = { a: mul(l.a, M), b: mul(l.b, M) }
    const nr = { a: mul(r.a, M), b: mul(r.b, M) }
    const ok = [nl.a, nl.b, nr.a, nr.b].every(isInt) && eq(evalAt(nl, ONE), mul(evalAt(l, ONE), M))
    l = nl
    r = nr
    const claim = `${m} × (${before}) = ${printTerms(sideTerms(l, xFirst), x)}`
    const what = /\./.test(src) && !/\//.test(src) ? 'decimals' : 'fractions'
    say({ ink: show(), say: `Multiply both sides by ${m} to clear the ${what}.`, claim, ok: claim }, ok)
  }

  // 4. Letter on the left only.
  if (isZero(l.a) && !isZero(r.a)) {
    ;[l, r] = [r, l]
    xFirst = true
    say({ ink: show(), say: `Swap the sides, so ${x} is on the left.`, claim: 'a = b means b = a', ok: 'a = b means b = a' }, true)
  } else if (!isZero(r.a)) {
    const k = r.a
    const nl = { a: sub(l.a, k), b: l.b }
    const term = mono(sign(k) < 0 ? neg(k) : k, true, x)
    const claim = `${mono(l.a, true, x)} ${sign(k) < 0 ? '+' : MINUS} ${term} = ${isZero(nl.a) ? '0' : mono(nl.a, true, x)}`
    const ok = eq(add(nl.a, k), l.a)
    l = nl
    r = { a: Z, b: r.b }
    if (isZero(l.a)) xFirst = true
    const cancel = isZero(l.a) ? ` The ${x} terms cancel.` : ''
    say({ ink: show(), say: `${sign(k) < 0 ? 'Add' : 'Take'} ${term} ${sign(k) < 0 ? 'to' : 'away from'} both sides.${cancel}`, claim, ok: claim }, ok)
  }

  // No letter left: every x works, or none does.
  if (isZero(l.a)) {
    const all = eq(l.b, r.b)
    const claim = all ? `${fmtQ(l.b)} = ${fmtQ(r.b)}` : `${fmtQ(l.b)} ≠ ${fmtQ(r.b)}`
    const ink = all ? `Every ${x} works` : 'No solution'
    const words = all ? `Both sides are always equal, so every ${x} works.` : `${fmtQ(l.b)} can never equal ${fmtQ(r.b)}, so no ${x} works.`
    // Checked on the original equation at two values: equal at both for "all", unequal at both for "none".
    const v1 = eq(evalAt(linL, q(0)), evalAt(linR, q(0)))
    const v2 = eq(evalAt(linL, q(7)), evalAt(linR, q(7)))
    say({ ink, say: words, claim, ok: `Checked: ${claim}` }, all ? v1 && v2 : !v1 && !v2)
    return { beats, answer: ink, kind: all ? 'all' : 'none', letter: x, check: `Checked: ${claim}` }
  }

  // 5. Constant to the right.
  if (!isZero(l.b)) {
    const c = l.b
    const nr = { a: Z, b: sub(r.b, c) }
    const claim = `${fmtQ(r.b)} ${sign(c) < 0 ? '+' : MINUS} ${fmtQ(sign(c) < 0 ? neg(c) : c)} = ${fmtQ(nr.b)}`
    const ok = eq(add(nr.b, c), r.b)
    r = nr
    l = { a: l.a, b: Z }
    say({ ink: show(), say: `${sign(c) < 0 ? 'Add' : 'Take'} ${fmtQ(sign(c) < 0 ? neg(c) : c)} ${sign(c) < 0 ? 'to' : 'away from'} both sides.`, claim, ok: claim }, ok)
  }

  // 6. Divide.
  if (!eq(l.a, ONE)) {
    const k = l.a
    const v = div(r.b, k)
    const claim = `${fmtQ(r.b)} ÷ ${sign(k) < 0 ? `(${fmtQ(k)})` : fmtQ(k)} = ${fmtQ(v)}`
    const ok = eq(mul(v, k), r.b)
    l = { a: ONE, b: Z }
    r = { a: Z, b: v }
    say({ ink: show(), say: `Divide both sides by ${fmtQ(k)}.`, claim, ok: claim }, ok)
  }

  // Answer, checked by substitution into the original.
  const sol = r.b
  const vl = evalAt(linL, sol)
  const vr = evalAt(linR, sol)
  const held = eq(vl, vr)
  const last = beats[beats.length - 1]
  if (beats.length === 1) last.say = `${x} is already on its own.`
  last.say = `${last.say} So ${x} is ${fmtQ(sol)}.`
  last.verified = last.verified && held
  const parts = [print(L, x, sol), fmtQ(vl), print(R, x, sol)].filter((v, i, all) => i === 0 || v !== all[i - 1])
  const subst = parts.join(' = ')
  return { beats, answer: `${x} = ${fmtQ(sol)}`, kind: 'one', letter: x, check: subst }
}
