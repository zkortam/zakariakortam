'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import './wingman.css'

/*
 * Wingman's incident screen, ported from zkortam/wingman apps/web: IncidentProof (the ProofBlock
 * layout), the Rail, PageHeader, CopyId, Evidence, Verdict, Assertion, Dots, Diff, Confirm and Toast,
 * the state presentation from domain/incidents.ts, and the CSS from ui/{tokens,base,layout,content,
 * incident,overlays,demo}.css with the light token set. The incidents are the app's own demo data
 * (data/demo-incidents.ts), in its inbox order. Applying OC-1042 does what the demo runtime does:
 * the reporter's config resolves to v2 while the control user stays on v1 (features/demo/DemoHarness),
 * and the reporter's next export confirms the outcome. Nothing animates beyond the app's 120ms
 * hover transition, which reduced motion turns off.
 */

type IncidentState =
  | 'OPEN' | 'CLUSTERED' | 'CLASSIFIED' | 'ASSERTED' | 'CANDIDATE' | 'APPLIED'
  | 'CONFIRMED' | 'DISCARDED' | 'PARKED' | 'REVERTED' | 'HUMAN_REVIEW' | 'EXPIRED'

interface Turn { role: 'user' | 'assistant'; text: string; signaled?: boolean }
interface Session { id: string; signal: string; confidence: number; baseline: number; turns: Turn[] }
interface Incident {
  id: string
  title: string
  users: number
  sessions: number
  state: IncidentState
  stateReason?: string
  verdict?: { kind: string; confidence: number; evidence: string[] }
  evidence: Session[]
  assertion?: { kind: string; expression: string; params: Record<string, unknown> }
  before?: { n: number; passCount: number }
  change?: { path: string; bytes: number; lines: Array<{ kind: 'context' | 'add' | 'remove'; text: string }> }
  after?: { n: number; passCount: number; positiveSuitePassed: number; positiveSuiteTotal: number }
  scope?: 'USER' | 'GLOBAL'
  confirmation?: { status: 'PENDING' | 'CONFIRMED' | 'REFUTED' | 'UNOBSERVED'; detail: string }
  handoff?: string
}

// apps/web/src/data/demo-incidents.ts
const evidence: Session[] = [
  {
    id: 'sess_7c91',
    signal: 'RETRY_REQUEST',
    confidence: 0.81,
    baseline: 0.12,
    turns: [
      { role: 'user', text: 'Export these opportunities to CSV.' },
      { role: 'assistant', text: 'Exported 50 opportunities.' },
      { role: 'user', text: 'No, just the ones I have filtered.', signaled: true },
    ],
  },
  {
    id: 'sess_04fd',
    signal: 'RESTATED_CONSTRAINT',
    confidence: 0.77,
    baseline: 0.18,
    turns: [
      { role: 'user', text: 'Only Negotiation-stage opportunities.' },
      { role: 'assistant', text: 'The export contains all opportunities.' },
      { role: 'user', text: 'I said only Negotiation.', signaled: true },
    ],
  },
  {
    id: 'sess_b322',
    signal: 'ABANDON_RESTART',
    confidence: 0.74,
    baseline: 0.09,
    turns: [
      { role: 'user', text: 'Export my filtered view.' },
      { role: 'assistant', text: 'Exported all 50 opportunities.' },
      { role: 'user', text: 'Cancel.', signaled: true },
    ],
  },
]

const candidate: Incident = {
  id: 'OC-1042',
  title: 'Export ignores active filters',
  users: 12,
  sessions: 19,
  state: 'CANDIDATE',
  evidence,
  verdict: {
    kind: 'CONFIG_DEFECT',
    confidence: 0.86,
    evidence: [
      'The export tool description does not mention active view filters.',
      'The user explicitly scoped the task to the visible view.',
      'Prior successful traces pass filters to export_records.',
    ],
  },
  assertion: {
    kind: 'TOOL_ARG_EQUALS',
    expression: 'export_records.filters == session.viewFilters',
    params: { tool: 'export_records', arg: 'filters', expected: { $ref: 'session.viewFilters' } },
  },
  before: { n: 5, passCount: 0 },
  change: {
    path: 'tools[export_records].description',
    bytes: 214,
    lines: [
      { kind: 'remove', text: 'Exports records from the current object.' },
      { kind: 'add', text: "Exports records. Pass the caller's active view filters" },
      { kind: 'add', text: 'in `filters` so the export matches the visible view.' },
    ],
  },
  after: { n: 5, passCount: 5, positiveSuitePassed: 41, positiveSuiteTotal: 41 },
  scope: 'USER',
}

const VARIANTS: Incident[] = [
  candidate,
  {
    ...candidate,
    id: 'OC-1038',
    title: 'Search returns closed opportunities',
    users: 7,
    sessions: 11,
    state: 'DISCARDED',
    verdict: { kind: 'VARIANCE', confidence: 0.71, evidence: ['The unchanged config passed two of five identical assertions.'] },
    before: { n: 5, passCount: 2 },
    change: undefined,
    after: undefined,
    scope: undefined,
  },
  {
    ...candidate,
    id: 'OC-1031',
    title: 'Summary drops the date range',
    users: 4,
    sessions: 6,
    state: 'APPLIED',
    verdict: { kind: 'PREFERENCE', confidence: 0.91, evidence: ['The user restated the same date constraint twice.'] },
    confirmation: { status: 'PENDING', detail: 'Confirmation window ends in 21h' },
  },
  {
    ...candidate,
    id: 'OC-1029',
    title: 'Refund tool runs without confirmation',
    users: 3,
    sessions: 4,
    state: 'HUMAN_REVIEW',
    stateReason: 'Tool behavior requires a code change in the customer environment.',
    verdict: { kind: 'CODE_DEFECT', confidence: 0.93, evidence: ['The tool executes before the required confirmation boundary.'] },
    change: undefined,
    after: undefined,
    scope: undefined,
    handoff: '{ "task": "Require confirmation before refund execution", "requireTestPass": true }',
  },
  {
    ...candidate,
    id: 'OC-1017',
    title: 'Owner field reset on bulk update',
    users: 2,
    sessions: 3,
    state: 'CONFIRMED',
    confirmation: { status: 'CONFIRMED', detail: 'Confirmed by the next matching task, 18m after apply' },
  },
  {
    ...candidate,
    id: 'OC-1008',
    title: 'Stage change skips the required note',
    users: 1,
    sessions: 2,
    state: 'PARKED',
    stateReason: 'assertion: SCHEMA_INVALID',
    change: undefined,
    after: undefined,
    scope: undefined,
  },
]

// apps/web/src/domain/demo.ts
const DEMO_REPORTER_HASH = 'e9c0c41fbf4a29beb7bc2b07d53478e1'
const DEMO_CONTROL_HASH = 'd2a491fed7049ca0053e5a03e8e86b3f'

// apps/web/src/domain/incidents.ts → incidentPresentation
type Action = 'apply' | 'dismiss' | 'reopen' | 'retry' | 'revert' | 'handoff'
type Show = { verdict: boolean; assertion: boolean; before: boolean; change: boolean; after: boolean; confirmation: boolean; handoff: boolean }
interface Presentation { status: string; tone: 'neutral' | 'accent' | 'pass' | 'fail' | 'warn' | 'faint'; show: Show; actions: Action[] }

function incidentPresentation(incident: Incident): Presentation {
  const early: Show = { verdict: false, assertion: false, before: false, change: false, after: false, confirmation: false, handoff: false }
  const common: Show = {
    verdict: Boolean(incident.verdict),
    assertion: Boolean(incident.assertion),
    before: Boolean(incident.before),
    change: Boolean(incident.change),
    after: Boolean(incident.after),
    confirmation: Boolean(incident.confirmation),
    handoff: Boolean(incident.handoff),
  }
  switch (incident.state) {
    case 'OPEN':
    case 'CLUSTERED':
      return { status: 'Collecting evidence', tone: 'neutral', show: early, actions: [] }
    case 'CLASSIFIED':
      return { status: 'Classified', tone: 'neutral', show: { ...early, verdict: Boolean(incident.verdict) }, actions: [] }
    case 'ASSERTED':
      return { status: 'Verifying', tone: 'neutral', show: { ...early, verdict: Boolean(incident.verdict), assertion: Boolean(incident.assertion), before: true }, actions: [] }
    case 'CANDIDATE':
      return { status: 'Ready to apply', tone: 'neutral', show: common, actions: ['apply', 'dismiss'] }
    case 'APPLIED':
      return { status: `Applied to ${incident.users} users, confirming`, tone: 'accent', show: common, actions: ['revert'] }
    case 'CONFIRMED':
      return { status: 'Assertion verified | User outcome confirmed', tone: 'pass', show: common, actions: ['revert'] }
    case 'REVERTED':
      return { status: 'Reverted: signal fired again', tone: 'fail', show: common, actions: ['reopen'] }
    case 'EXPIRED':
      return { status: 'Expired: no recurrence in 14 days', tone: 'faint', show: common, actions: ['reopen'] }
    case 'PARKED':
      return { status: `Parked at ${incident.stateReason ?? 'pipeline'}`, tone: 'warn', show: common, actions: ['retry', 'dismiss'] }
    case 'HUMAN_REVIEW': {
      const codeDefect = incident.verdict?.kind === 'CODE_DEFECT'
      return { status: codeDefect ? 'Handed off to Codex' : 'Needs a human', tone: 'warn', show: common, actions: codeDefect ? ['handoff', 'dismiss'] : ['dismiss'] }
    }
  }
  if (incident.stateReason === 'Dismissed by operator') return { status: 'Dismissed by operator', tone: 'faint', show: common, actions: ['reopen'] }
  const wrongRead = incident.before?.passCount === incident.before?.n
  return {
    status: wrongRead ? 'Discarded: our read was wrong' : 'Discarded: model variance',
    tone: 'faint',
    show: { ...common, change: false, after: false, confirmation: false },
    actions: ['reopen'],
  }
}

const copyText = (text: string) => navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('No clipboard'))

/* ---------- apps/web/src/ui ---------- */

const KeyHint = ({ keys }: { keys: string[] }) => (
  <span className="wg-key-hint">
    {keys.map((key) => (
      <kbd key={key}>{key}</kbd>
    ))}
  </span>
)

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 120)
    return () => window.clearTimeout(timeout)
  }, [copied])
  return (
    <button className="wg-copy-id" data-copied={copied} onClick={() => void copyText(id).then(() => setCopied(true), () => undefined)} type="button">
      {id}
    </button>
  )
}

const DIAMETER = 10
const GAP = 6

function Dots({ n, passCount }: { n: number; passCount: number }) {
  const width = n * DIAMETER + (n - 1) * GAP
  return (
    <span className="wg-dots-line">
      <svg aria-label={`${passCount} of ${n} runs passed`} className="wg-dots-svg" height={DIAMETER} role="img" viewBox={`0 0 ${width} ${DIAMETER}`} width={width}>
        {Array.from({ length: n }, (_, index) => {
          const passed = index >= n - passCount
          return (
            <circle
              cx={index * (DIAMETER + GAP) + DIAMETER / 2}
              cy={DIAMETER / 2}
              fill={passed ? 'none' : 'var(--fail)'}
              key={index}
              r={passed ? 4.25 : 5}
              stroke={passed ? 'var(--pass)' : 'none'}
              strokeWidth={passed ? 1.5 : 0}
            />
          )
        })}
      </svg>
      <span className="wg-dots-count">
        {passCount}/{n} passed
      </span>
    </span>
  )
}

const Diff = ({ path, lines }: NonNullable<Incident['change']>) => (
  <div>
    <div className="wg-diff-header">
      {lines.length}-line diff, {path}
    </div>
    <div className="wg-diff" aria-label={`Configuration diff for ${path}`}>
      {lines.map((line, index) => (
        <div className="wg-diff-line" data-kind={line.kind} key={`${line.kind}-${index}`}>
          <span className="wg-diff-gutter">{line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}</span>
          <span>{line.text}</span>
        </div>
      ))}
    </div>
  </div>
)

const Assertion = ({ assertion }: { assertion: NonNullable<Incident['assertion']> }) => (
  <details className="wg-assertion-line">
    <summary>
      {assertion.kind}&nbsp;&nbsp;{assertion.expression}
    </summary>
    <pre>{JSON.stringify(assertion.params, null, 2)}</pre>
  </details>
)

const Verdict = ({ verdict }: { verdict: NonNullable<Incident['verdict']> }) => (
  <div>
    <div className="wg-verdict-heading">
      {verdict.kind} | {verdict.confidence.toFixed(2)}
    </div>
    <ol className="wg-verdict-list">
      {verdict.evidence.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  </div>
)

const Evidence = ({ sessions, expanded }: { sessions: Session[]; expanded: boolean }) => (
  <div>
    <div className="wg-evidence-list">
      {sessions.map((session) => (
        <article className="wg-evidence-session" key={session.id}>
          <div className="wg-evidence-meta">
            {session.signal} | {session.confidence.toFixed(2)} | baseline {session.baseline.toFixed(2)} | {session.id}
          </div>
          {(expanded ? session.turns : session.turns.slice(-2)).map((turn, index) => (
            <div className="wg-transcript-line" data-signaled={turn.signaled || undefined} key={`${session.id}-${index}`}>
              <span className="wg-transcript-role">{turn.role}</span>
              <span>{turn.text}</span>
            </div>
          ))}
        </article>
      ))}
    </div>
    <p className="wg-refusal-copy">Redacted in the customer&apos;s process before transmission.</p>
  </div>
)

const ProofBlock = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="wg-proof-block">
    <div className="wg-proof-label">{label}</div>
    <div>{children}</div>
  </section>
)

function Confirm({ title, body, destructive, onCancel, onConfirm }: { title: string; body: string; destructive: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.focus()
    const listener = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
      if (event.key !== 'Tab') return
      const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])]
      const first = controls[0]
      const last = controls.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', listener)
    return () => {
      window.removeEventListener('keydown', listener)
      previousFocus?.focus()
    }
  }, [onCancel])
  return (
    <div className="wg-confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section aria-describedby="wg-confirm-body" aria-labelledby="wg-confirm-title" aria-modal="true" className="wg-confirm-panel" ref={panelRef} role="dialog">
        <h2 id="wg-confirm-title">{title}</h2>
        <p id="wg-confirm-body">{body}</p>
        <div className="wg-confirm-actions">
          <button onClick={onCancel} ref={cancelRef} type="button">
            Cancel
          </button>
          <button className={destructive ? 'wg-danger-button' : 'wg-primary-button'} onClick={onConfirm} type="button">
            Confirm
          </button>
        </div>
      </section>
    </div>
  )
}

/* ---------- Rail (ui/Rail.tsx) ---------- */

const RAIL_LINKS = ['Inbox', 'Outcomes', 'Config', 'Settings']
const SHORTCUTS = [
  ['a', 'Apply'],
  ['x', 'Dismiss'],
  ['e', 'Expand evidence'],
  ['[ / ]', 'Previous / next'],
  ['c', 'Copy incident id'],
]

function Rail({ theme, onTheme, shortcuts, onShortcuts }: { theme: 'light' | 'dark'; onTheme: () => void; shortcuts: boolean; onShortcuts: () => void }) {
  return (
    <aside className="wg-rail">
      <div className="wg-rail-brand">Wingman</div>
      <nav className="wg-rail-nav" aria-label="Wingman navigation">
        {RAIL_LINKS.map((label) => (
          <span className="wg-rail-link" key={label}>
            {label}
          </span>
        ))}
      </nav>
      <div className="wg-rail-footer">
        <button className="wg-theme-button" onClick={onShortcuts} type="button" aria-expanded={shortcuts}>
          <KeyHint keys={['?']} /> keys
        </button>
        <button aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} theme`} className="wg-theme-button wg-mono" onClick={onTheme} type="button">
          {theme === 'light' ? 'dark' : 'light'}
        </button>
      </div>
      {shortcuts ? (
        <div className="wg-shortcut-sheet" aria-label="Keyboard shortcuts">
          {SHORTCUTS.map(([keys, action]) => (
            <div className="wg-shortcut-row" key={keys}>
              <KeyHint keys={[keys]} />
              <span>{action}</span>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}

/* ---------- Demo windows (features/demo/DemoHarness.tsx) ---------- */

function DemoPane({ kind, userHash, version, onSend }: { kind: 'REPORTER' | 'CONTROL'; userHash: string; version: 'v1' | 'v2'; onSend: () => void }) {
  const [messages, setMessages] = useState<Turn[]>([])
  const [input, setInput] = useState('Export these to CSV')
  const send = (): void => {
    const message = input.trim()
    if (!message) return
    const response = version === 'v2' ? 'Exported 10 Negotiation-stage opportunities.' : 'Exported all 50 opportunities.'
    setMessages((value) => [...value, { role: 'user', text: message }, { role: 'assistant', text: response }].slice(-4) as Turn[])
    onSend()
  }
  return (
    <section className="wg-demo-pane" aria-label={`${kind.toLowerCase()} demo window`}>
      <header className="wg-demo-header">
        <span className="wg-demo-who">
          {kind}&nbsp;&nbsp;<span className="wg-demo-hash">{userHash}</span>
        </span>
        <span className="wg-demo-version" data-changed={version === 'v2'}>
          config {version}
        </span>
      </header>
      <div className="wg-demo-transcript" aria-live="polite">
        {messages.length === 0 ? <span className="wg-muted">Stage = Negotiation, 10 visible opportunities</span> : null}
        {messages.map((message, index) => (
          <div className="wg-demo-message" data-role={message.role} key={index}>
            {message.text}
          </div>
        ))}
      </div>
      <form
        className="wg-demo-composer"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <label className="wg-sr-only" htmlFor={`wg-${kind}-message`}>
          Message as the {kind.toLowerCase()} user
        </label>
        <input id={`wg-${kind}-message`} onChange={(event) => setInput(event.target.value)} value={input} autoComplete="off" />
        <button className="wg-primary-button" disabled={!input.trim()} type="submit">
          Send
        </button>
      </form>
    </section>
  )
}

/* ---------- IncidentProof ---------- */

export function WingmanReview() {
  const [incidents, setIncidents] = useState<Incident[]>(() => structuredClone(VARIANTS))
  const [index, setIndex] = useState(0)
  const [confirm, setConfirm] = useState<'global' | 'revert' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [expandedEvidence, setExpandedEvidence] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [shortcuts, setShortcuts] = useState(false)

  const incident = incidents[index]
  const presentation = useMemo(() => incidentPresentation(incident), [incident])
  const actions = presentation.actions
  const previousId = incidents[index - 1]?.id
  const nextId = incidents[index + 1]?.id

  const update = useCallback(
    (id: string, change: (value: Incident) => Incident) => setIncidents((list) => list.map((item) => (item.id === id ? change(item) : item))),
    [],
  )

  // The demo runtime resolves the reporter to config v2 once OC-1042 is applied to that user.
  const oc1042 = incidents[0]
  const reporterVersion = oc1042.state === 'APPLIED' || oc1042.state === 'CONFIRMED' ? 'v2' : 'v1'

  const performApply = (): void => {
    update(incident.id, (value) => ({ ...value, state: 'APPLIED', confirmation: { status: 'PENDING', detail: 'Confirmation window ends in 24h' } }))
    setToast('Applied to affected user')
  }
  const apply = (): void => {
    if (incident.scope === 'GLOBAL') setConfirm('global')
    else performApply()
  }
  const dismiss = (): void => {
    update(incident.id, (value) => ({ ...value, state: 'DISCARDED', stateReason: 'Dismissed by operator' }))
    setToast('Incident dismissed')
  }
  const revert = (): void => {
    update(incident.id, (value) => ({ ...value, state: 'REVERTED' }))
    setToast('Override reverted')
  }
  // The real reopen sends the incident back through the pipeline; here it returns to where it started.
  const reopen = (): void => {
    const original = VARIANTS.find((item) => item.id === incident.id)
    if (original) update(incident.id, () => structuredClone(original))
    setToast('Incident reopened')
  }
  const go = (id: string | undefined) => {
    if (!id) return
    setIndex(incidents.findIndex((item) => item.id === id))
  }
  const confirmReporter = (): void => {
    if (oc1042.state !== 'APPLIED') return
    update('OC-1042', (value) => ({ ...value, state: 'CONFIRMED', confirmation: { status: 'CONFIRMED', detail: 'Confirmed by the next matching task, just now' } }))
  }

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4_000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  // The app listens on window; on a portfolio page the keys only apply while focus is inside the demo.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing || event.repeat) return
    if (confirm) return
    if (event.key === '?') setShortcuts((value) => !value)
    if (event.key === 'Escape') setShortcuts(false)
    if (event.key === 'a' && actions.includes('apply')) apply()
    if (event.key === 'x' && actions.includes('dismiss')) dismiss()
    if (event.key === 'e') setExpandedEvidence((value) => !value)
    if (event.key === '[') go(previousId)
    if (event.key === ']') go(nextId)
    if (event.key === 'c') void copyText(incident.id).catch(() => undefined)
  }

  return (
    <div className="wg" data-theme={theme} onKeyDown={onKeyDown} role="group" aria-label="Wingman incident screen, interactive">
      <div className="wg-app">
        <div className="wg-shell">
          <Rail theme={theme} onTheme={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))} shortcuts={shortcuts} onShortcuts={() => setShortcuts((value) => !value)} />
          <div className="wg-main">
            <header className="wg-page-header">
              <div>
                <h3 className="wg-page-title">
                  <span className="wg-incident-title-line">
                    <CopyId id={incident.id} />
                    <span>{incident.title}</span>
                  </span>
                </h3>
                <div className="wg-page-header-meta">
                  {incident.users} users | {incident.sessions} sessions
                </div>
              </div>
              <div className="wg-page-actions">
                <button disabled={!previousId} onClick={() => go(previousId)} type="button">
                  Previous
                </button>
                <button disabled={!nextId} onClick={() => go(nextId)} type="button">
                  Next
                </button>
                <button onClick={() => setExpandedEvidence((value) => !value)} type="button">
                  {expandedEvidence ? 'Collapse evidence' : 'Expand evidence'}
                </button>
                {actions.includes('reopen') ? (
                  <button onClick={reopen} type="button">
                    Reopen
                  </button>
                ) : null}
                {actions.includes('retry') ? (
                  <button onClick={reopen} type="button">
                    Retry
                  </button>
                ) : null}
                {actions.includes('handoff') && incident.handoff ? (
                  <>
                    <button onClick={() => void copyText(incident.handoff ?? '').then(() => setToast('Handoff payload copied'), () => setToast('Copy failed'))} type="button">
                      Copy payload
                    </button>
                    <button onClick={() => setToast('Handoff resent')} type="button">
                      Resend
                    </button>
                  </>
                ) : null}
                {actions.includes('dismiss') && !actions.includes('apply') ? (
                  <button onClick={dismiss} type="button">
                    Dismiss
                  </button>
                ) : null}
                {actions.includes('revert') ? (
                  <button className="wg-danger-button" onClick={() => setConfirm('revert')} type="button">
                    Revert
                  </button>
                ) : null}
              </div>
            </header>
            <div aria-live="polite" className="wg-incident-status" data-tone={presentation.tone}>
              {presentation.status}
            </div>
            <div className="wg-proof">
              <ProofBlock label="EVIDENCE">
                <Evidence expanded={expandedEvidence} sessions={incident.evidence} />
              </ProofBlock>
              {presentation.show.verdict && incident.verdict ? (
                <ProofBlock label="CLASSIFIED">
                  <Verdict verdict={incident.verdict} />
                </ProofBlock>
              ) : null}
              {presentation.show.assertion && incident.assertion ? (
                <ProofBlock label="ASSERTION">
                  <Assertion assertion={incident.assertion} />
                </ProofBlock>
              ) : null}
              {presentation.show.before && incident.before ? (
                <ProofBlock label="BEFORE">
                  <Dots n={incident.before.n} passCount={incident.before.passCount} />
                  {incident.state === 'DISCARDED' && incident.stateReason !== 'Dismissed by operator' ? (
                    <p className="wg-refusal-copy">
                      {incident.before.passCount === incident.before.n
                        ? 'The assertion passed every run. The detection was a false positive. Nothing was applied.'
                        : `Passed ${incident.before.passCount} of ${incident.before.n} runs against the unchanged config. Intermittent, not a defect. Nothing was applied.`}
                    </p>
                  ) : null}
                </ProofBlock>
              ) : null}
              {presentation.show.change && incident.change ? (
                <ProofBlock label="CHANGE">
                  <Diff {...incident.change} />
                </ProofBlock>
              ) : null}
              {presentation.show.after && incident.after ? (
                <ProofBlock label="AFTER">
                  <div className="wg-dots-line wg-wrap">
                    <Dots n={incident.after.n} passCount={incident.after.passCount} />
                    <span>|</span>
                    <span className="wg-suite-count">
                      positive suite {incident.after.positiveSuitePassed}/{incident.after.positiveSuiteTotal} green
                    </span>
                  </div>
                </ProofBlock>
              ) : null}
              {incident.stateReason ? (
                <ProofBlock label="REASON">
                  <span className="wg-park-reason">{incident.stateReason}</span>
                </ProofBlock>
              ) : null}
              {presentation.show.handoff && incident.handoff ? (
                <ProofBlock label="HANDOFF">
                  <pre className="wg-diff wg-handoff">{incident.handoff}</pre>
                </ProofBlock>
              ) : null}
              {presentation.show.confirmation && incident.confirmation ? (
                <ProofBlock label="CONFIRMATION">
                  <div className="wg-confirmation-line">
                    <span>{incident.confirmation.detail}</span>
                  </div>
                </ProofBlock>
              ) : null}
              {actions.includes('apply') ? (
                <ProofBlock label="SCOPE">
                  <div className="wg-scope-line">
                    <span>{incident.scope === 'GLOBAL' ? 'All users' : `${incident.users} affected users`}</span>
                    <div className="wg-scope-actions">
                      <button onClick={dismiss} type="button">
                        Dismiss
                      </button>
                      <button className="wg-primary-button" onClick={apply} type="button">
                        {incident.scope === 'GLOBAL' ? 'Apply globally' : 'Apply'}
                      </button>
                    </div>
                  </div>
                </ProofBlock>
              ) : null}
            </div>
          </div>
        </div>
        {confirm ? (
          <Confirm
            body={confirm === 'global' ? 'This changes the active config for every user.' : 'This restores the previous config for the affected user.'}
            destructive={confirm === 'revert'}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              if (confirm === 'global') performApply()
              else revert()
              setConfirm(null)
            }}
            title={confirm === 'global' ? 'Apply globally?' : 'Revert this change?'}
          />
        ) : null}
        {toast ? (
          <div aria-live="polite" className="wg-toast" role="status">
            {toast}
          </div>
        ) : null}
      </div>
      <div className="wg-demo-grid">
        <DemoPane kind="REPORTER" userHash={DEMO_REPORTER_HASH} version={reporterVersion} onSend={confirmReporter} />
        <DemoPane kind="CONTROL" userHash={DEMO_CONTROL_HASH} version="v1" onSend={() => undefined} />
      </div>
    </div>
  )
}
