'use client'

/**
 * Controls ported from zkortam/spiceplusplus (commit 81224b0), with their Tailwind classes turned
 * into the `sp-` classes in ../spice.css:
 *   Icon            src/components/ui/Icon.tsx (the glyphs this demo uses)
 *   SpiceCode       src/components/Shell/DirectivesBar.tsx (tokenizer and colouring)
 *   SpiceInput      src/components/Shell/DirectivesBar.tsx
 *   Field, parsedSuffix, SourceEditor   src/components/Shell/SourceEditor.tsx
 *   AttrField                           src/components/Shell/Inspector.tsx
 */
import { useMemo, useRef, useState, type ReactNode, type UIEvent } from 'react'
import { formatValue, parseValue, isExpression, nearestEValue } from '@/vendor/spicepp/units'

// ─── Icon ───────────────────────────────────────────────────────────────────────────────
const GLYPHS: Record<string, ReactNode> = {
  chevronDown: <path d="M7 10l5 5 5-5" />,
  close: <path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4" />,
  expand: <path d="M4.5 9.5v-5h5M19.5 9.5v-5h-5M4.5 14.5v5h5M19.5 14.5v5h-5" />,
  collapse: <path d="M9.5 4.5v5h-5M14.5 4.5v5h5M9.5 19.5v-5h-5M14.5 19.5v-5h5" />,
  plus: <path d="M12 5v14M5 12h14" />,
}
export function Icon({ name, size = 18, className = '' }: { name: keyof typeof GLYPHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      {GLYPHS[name]}
    </svg>
  )
}

// ─── SPICE tokenizer + SpiceCode ────────────────────────────────────────────────────────
type SpiceTokKind = 'directive' | 'keyword' | 'func' | 'number' | 'suffix' | 'ident' | 'punct' | 'comment' | 'space'
interface SpiceTok {
  t: SpiceTokKind
  s: string
}
const KEYWORDS = new Set(['lin', 'dec', 'oct', 'list', 'param', 'temp', 'uic', 'trap', 'be', 'gear'])

function tokenizeSpice(src: string): SpiceTok[] {
  const out: SpiceTok[] = []
  let i = 0
  let seenNonSpace = false
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      let j = i
      while (j < src.length && /\s/.test(src[j])) j++
      out.push({ t: 'space', s: src.slice(i, j) })
      i = j
      continue
    }
    if (c === ';' || (c === '*' && !seenNonSpace)) {
      out.push({ t: 'comment', s: src.slice(i) })
      break
    }
    seenNonSpace = true
    if (c === '.' && /[a-z]/i.test(src[i + 1] ?? '')) {
      let j = i + 1
      while (j < src.length && /[a-z0-9_]/i.test(src[j])) j++
      out.push({ t: 'directive', s: src.slice(i, j) })
      i = j
      continue
    }
    const numMatch = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(src.slice(i))
    if (numMatch && numMatch[0].replace(/^[-+]/, '').length > 0) {
      const core = numMatch[0]
      let j = i + core.length
      const sufMatch = /^(?:meg|mil|[tgkmuµnpf])?[a-zΩ°%]*/i.exec(src.slice(j))
      const suf = sufMatch ? sufMatch[0] : ''
      out.push({ t: 'number', s: core })
      if (suf) {
        out.push({ t: 'suffix', s: suf })
        j += suf.length
      }
      i = j
      continue
    }
    if (/[a-z_]/i.test(c)) {
      let j = i
      while (j < src.length && /[a-z0-9_.\-]/i.test(src[j])) j++
      const word = src.slice(i, j)
      if (src[j] === '(') out.push({ t: 'func', s: word })
      else out.push({ t: KEYWORDS.has(word.toLowerCase()) ? 'keyword' : 'ident', s: word })
      i = j
      continue
    }
    out.push({ t: 'punct', s: c })
    i++
  }
  return out
}

export function SpiceCode({ text, className = '' }: { text: string; className?: string }) {
  const toks = useMemo(() => tokenizeSpice(text), [text])
  return (
    <span className={`sp-code ${className}`}>
      {toks.map((t, i) => (
        <span key={i} data-t={t.t}>
          {t.s}
        </span>
      ))}
    </span>
  )
}

export function SpiceInput({ value, onChange, dim, ariaLabel }: { value: string; onChange: (v: string) => void; dim?: boolean; ariaLabel: string }) {
  const layerRef = useRef<HTMLDivElement>(null)
  const syncScroll = (e: UIEvent<HTMLInputElement>) => {
    if (layerRef.current) layerRef.current.scrollLeft = e.currentTarget.scrollLeft
  }
  return (
    <div className="sp-spin">
      <div ref={layerRef} aria-hidden="true" className="sp-spin-layer" data-dim={dim ? '' : undefined}>
        {dim ? <span>{value}</span> : <SpiceCode text={value} />}
      </div>
      <input
        aria-label={ariaLabel}
        value={value}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />
    </div>
  )
}

// ─── Field ──────────────────────────────────────────────────────────────────────────────
export function Field({
  label,
  value,
  placeholder,
  suffix,
  invalid,
  mono,
  hint,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  suffix?: ReactNode
  invalid?: boolean
  mono?: boolean
  hint?: ReactNode
  onChange: (v: string) => void
}) {
  return (
    <label className="sp-field">
      <span className="sp-label">{label}</span>
      <span className="sp-box" data-invalid={invalid ? '' : undefined}>
        <input className={mono ? 'sp-mono' : undefined} value={value} placeholder={placeholder} spellCheck={false} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
        {suffix != null && suffix !== '' && <span className="sp-suffix">{suffix}</span>}
      </span>
      {hint !== undefined && <span className="sp-hint">{hint}</span>}
    </label>
  )
}

export function parsedSuffix(raw: string, unit: string): string {
  const s = (raw ?? '').trim()
  const n = parseValue(s)
  if (s !== '' && isFinite(n) && /[a-zµΩ%]/i.test(s)) {
    const echo = formatValue(n, unit)
    const bare = echo.replace(/\s+/g, '').slice(0, unit ? -unit.length || undefined : undefined)
    return bare === s.replace(/\s+/g, '') ? unit : echo
  }
  return unit
}

export function AttrField({
  label,
  value,
  unit,
  placeholder,
  onChange,
  parseUnit,
  eSeries,
}: {
  label: string
  value: string
  unit?: string
  placeholder?: string
  onChange: (v: string) => void
  parseUnit?: string
  eSeries?: boolean
}) {
  const raw = (value ?? '').trim()
  const expr = isExpression(raw)
  const n = parseUnit != null && !expr ? parseValue(raw) : NaN
  const bad = parseUnit != null && !expr && raw !== '' && !isFinite(n)
  const snap = eSeries && isFinite(n) && n > 0 ? nearestEValue(n, 'E24') : NaN
  const showSnap = isFinite(snap) && Math.abs(snap - n) / Math.abs(n) > 0.005
  const hint =
    parseUnit == null ? undefined : bad ? (
      <span className="sp-hint-bad">Not a number - try 4.7k, 100n, 1Meg</span>
    ) : expr ? (
      <span className="sp-hint-dim">Resolved from .param at run time</span>
    ) : showSnap ? (
      <button type="button" className="sp-snap" onClick={() => onChange(formatValue(snap, '').replace(/\s+/g, ''))} title={`Snap to the nearest E24 standard value (${formatValue(snap, parseUnit)})`}>
        → {formatValue(snap, parseUnit)}
      </button>
    ) : null
  return <Field label={label} value={value} placeholder={placeholder} suffix={parsedSuffix(value, unit ?? '')} invalid={bad} hint={hint} onChange={onChange} />
}

// ─── SourceEditor ───────────────────────────────────────────────────────────────────────
type Kind = 'dc' | 'sine' | 'pulse' | 'step' | 'custom'
const KINDS: { id: Kind; label: string; title: string }[] = [
  { id: 'dc', label: 'DC', title: 'Constant level' },
  { id: 'sine', label: 'Sine', title: 'SIN(offset amplitude frequency)' },
  { id: 'pulse', label: 'Pulse', title: 'PULSE(low high delay rise fall width period)' },
  { id: 'step', label: 'Step', title: 'One edge, then hold' },
  { id: 'custom', label: 'Custom', title: 'Write the SPICE spec directly: EXP, PWL, SFFM, AM' },
]

function parse(spec: string): { kind: Kind; p: Record<string, string>; ac: string } {
  const s = (spec || '').trim()
  let ac = ''
  const am = s.match(/\bAC\s+([^\s]+)(?:\s+([^\s]+))?/i)
  if (am) ac = am[1] + (am[2] ? ' ' + am[2] : '')
  const rest = s.replace(/\bAC\s+[^\s]+(?:\s+[^\s]+)?/i, '').trim()
  const fm = rest.match(/^(SIN|PULSE)\s*\(([^)]*)\)/i)
  if (fm) {
    const a = fm[2].trim().split(/[\s,]+/).filter(Boolean)
    if (fm[1].toUpperCase() === 'SIN') return { kind: 'sine', ac, p: { off: a[0] ?? '0', amp: a[1] ?? '1', freq: a[2] ?? '1k' } }
    const isStep = a[5] && /^[0-9.]+\s*(g|t)$/i.test(a[5]) && a[6] && /^[0-9.]+\s*(g|t)$/i.test(a[6])
    if (isStep) return { kind: 'step', ac, p: { init: a[0] ?? '0', final: a[1] ?? '1', delay: a[2] ?? '0' } }
    return { kind: 'pulse', ac, p: { low: a[0] ?? '0', high: a[1] ?? '1', delay: a[2] ?? '0', rise: a[3] ?? '1u', fall: a[4] ?? '1u', width: a[5] ?? '1m', period: a[6] ?? '2m' } }
  }
  if (/^(EXP|PWL|SFFM|AM)\s*\(/i.test(rest)) return { kind: 'custom', ac, p: { text: s } }
  const dm = rest.match(/^(?:DC\s+)?([-+]?[0-9.][\w%]*)$/i)
  if (dm) return { kind: 'dc', ac, p: { value: dm[1] } }
  return rest === '' ? { kind: 'dc', ac, p: { value: '0' } } : { kind: 'custom', ac, p: { text: s } }
}

function build(kind: Kind, p: Record<string, string>, ac: string): string {
  const g = (k: string, d: string) => (p[k] ?? '').trim() || d
  const acStr = ac.trim() ? ` AC ${ac.trim()}` : ''
  switch (kind) {
    case 'dc':
      return `${g('value', '0')}${acStr}`
    case 'sine':
      return `SIN(${g('off', '0')} ${g('amp', '1')} ${g('freq', '1k')})${acStr}`
    case 'pulse':
      return `PULSE(${g('low', '0')} ${g('high', '1')} ${g('delay', '0')} ${g('rise', '1u')} ${g('fall', '1u')} ${g('width', '1m')} ${g('period', '2m')})`
    case 'step':
      return `PULSE(${g('init', '0')} ${g('final', '1')} ${g('delay', '0')} 1u 1u 1G 2G)`
    default:
      return g('text', '0')
  }
}

function checkSpec(kind: Kind, p: Record<string, string>, unit: string): { level: 'error' | 'warn'; message: string } | null {
  const n = (k: string) => parseValue(p[k] ?? '')
  if (kind === 'dc') {
    return isFinite(n('value')) || !(p.value ?? '').trim() ? null : { level: 'error', message: `“${p.value}” isn’t a number. Use a value like 5, 3.3 or 1.5${unit}.` }
  }
  if (kind === 'sine') {
    const f = n('freq')
    if (!isFinite(f)) return { level: 'error', message: 'Frequency must be a number, e.g. 1k for 1 kHz.' }
    if (f <= 0) return { level: 'error', message: 'Frequency must be greater than 0.' }
    if (!isFinite(n('amp'))) return { level: 'error', message: 'Amplitude must be a number.' }
    return null
  }
  if (kind === 'pulse') {
    const per = n('period'),
      w = n('width'),
      r = n('rise'),
      f = n('fall')
    if (!isFinite(per) || per <= 0) return { level: 'error', message: 'Period must be a number greater than 0.' }
    if (!isFinite(w) || w <= 0) return { level: 'error', message: 'Pulse width must be a number greater than 0.' }
    if (w + (isFinite(r) ? r : 0) + (isFinite(f) ? f : 0) > per) return { level: 'warn', message: 'Rise + width + fall exceeds the period - the pulse never completes.' }
    return null
  }
  if (kind === 'step') {
    if (!isFinite(n('init')) || !isFinite(n('final'))) return { level: 'error', message: 'Initial and final levels must be numbers.' }
    if (!isFinite(n('delay'))) return { level: 'error', message: 'Step time must be a number, e.g. 1m for 1 ms.' }
    return null
  }
  const t = (p.text ?? '').trim()
  if (!t) return { level: 'error', message: 'Enter a SPICE source spec, e.g. PWL(0 0 1m 5).' }
  if (/^[A-Za-z]+\s*\(/.test(t) && !/\)\s*$/.test(t)) return { level: 'error', message: 'Unbalanced parentheses - the spec must close every “(”.' }
  return null
}

function argsFor(kind: Kind, u: string): { label: string; key: string; unit: string; ph: string }[] {
  switch (kind) {
    case 'dc':
      return [{ label: 'Value', key: 'value', unit: u, ph: '5' }]
    case 'sine':
      return [
        { label: 'Amplitude', key: 'amp', unit: u, ph: '1' },
        { label: 'Frequency', key: 'freq', unit: 'Hz', ph: '1k' },
        { label: 'Offset', key: 'off', unit: u, ph: '0' },
      ]
    case 'pulse':
      return [
        { label: 'Low', key: 'low', unit: u, ph: '0' },
        { label: 'High', key: 'high', unit: u, ph: '5' },
        { label: 'Rise', key: 'rise', unit: 's', ph: '1u' },
        { label: 'Fall', key: 'fall', unit: 's', ph: '1u' },
        { label: 'Width', key: 'width', unit: 's', ph: '0.5m' },
        { label: 'Period', key: 'period', unit: 's', ph: '1m' },
        { label: 'Delay', key: 'delay', unit: 's', ph: '0' },
      ]
    default:
      return [
        { label: 'Initial', key: 'init', unit: u, ph: '0' },
        { label: 'Final', key: 'final', unit: u, ph: '5' },
        { label: 'Step at', key: 'delay', unit: 's', ph: '1m' },
      ]
  }
}

/** Mounted with a fresh key per selected source, as in the app. */
export function SourceEditor({ value, onChange }: { value: string; onChange: (spec: string) => void }) {
  const [init] = useState(() => parse(value))
  const [kind, setKind] = useState<Kind>(init.kind)
  const [p, setP] = useState<Record<string, string>>(init.p)
  const [ac, setAc] = useState(init.ac)
  const u = 'V'
  const emit = (k: Kind, np: Record<string, string>, nac: string) => onChange(build(k, np, nac))
  const set = (key: string, v: string) => {
    const np = { ...p, [key]: v }
    setP(np)
    emit(kind, np, ac)
  }
  const spec = build(kind, p, ac)
  const problem = checkSpec(kind, p, u)
  const badKeys = new Set<string>(
    problem?.level === 'error'
      ? kind === 'dc'
        ? ['value']
        : kind === 'sine'
          ? ['freq', 'amp'].filter((k) => !isFinite(parseValue(p[k] ?? '')))
          : kind === 'pulse'
            ? ['period', 'width'].filter((k) => {
                const n = parseValue(p[k] ?? '')
                return !isFinite(n) || n <= 0
              })
            : kind === 'step'
              ? ['init', 'final', 'delay'].filter((k) => !isFinite(parseValue(p[k] ?? '')))
              : ['text']
      : [],
  )
  return (
    <div className="sp-stack-3">
      <div className="sp-field">
        <span className="sp-label">Stimulus</span>
        <div role="radiogroup" aria-label="Source type" className="sp-kinds">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={k.id === kind}
              title={k.title}
              onClick={() => {
                setKind(k.id)
                emit(k.id, p, ac)
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      {kind === 'custom' ? (
        <Field label="Source spec" value={p.text ?? value} placeholder="PWL(0 0 1m 5)" mono invalid={badKeys.has('text')} onChange={(v) => set('text', v)} />
      ) : (
        <div className="sp-grid2">
          {argsFor(kind, u).map((f) => (
            <Field key={f.key} label={f.label} value={p[f.key] ?? ''} placeholder={f.ph} suffix={parsedSuffix(p[f.key] ?? '', f.unit)} invalid={badKeys.has(f.key)} onChange={(v) => set(f.key, v)} />
          ))}
          <Field
            label="AC amplitude"
            value={ac}
            placeholder="0"
            suffix={parsedSuffix(ac, u)}
            onChange={(v) => {
              setAc(v)
              emit(kind, p, v)
            }}
          />
        </div>
      )}
      <div className="sp-field">
        <span className="sp-label">Netlist</span>
        <div className="sp-box sp-netline">
          <SpiceCode text={spec} />
        </div>
        <div className="sp-disclose" data-open={problem ? '' : undefined}>
          <div>
            <p className={problem?.level === 'error' ? 'sp-hint-bad' : 'sp-hint-warn'}>{problem?.message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
