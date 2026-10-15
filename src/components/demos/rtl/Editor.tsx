'use client'

import { forwardRef, useMemo, type KeyboardEvent } from 'react'

/**
 * A small code editor: a plain textarea laid exactly over a highlighted copy of its own text, so
 * typing, selection, undo, the on-screen keyboard and screen readers all behave natively.
 */

const TOKEN =
  /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(`\w+)|(\$\w+)|(\d*'[sS]?[bodhBODH][0-9a-fA-FxzXZ_]+|'[01xzXZ]|\b\d+(?:\.\d+)?\b)|\b(module|endmodule|parameter|localparam|int|integer|input|output|inout|logic|wire|reg|bit|always_ff|always_comb|always|posedge|negedge|begin|end|if|else|assign|initial|final|for|repeat|case|endcase|default|function|endfunction|automatic|string|return)\b/g

const KIND = ['', 'cm', 'st', 'mc', 'sy', 'nu', 'kw'] as const

function paint(line: string) {
  const out: { t: string; k: string }[] = []
  let last = 0
  TOKEN.lastIndex = 0
  for (let m = TOKEN.exec(line); m; m = TOKEN.exec(line)) {
    if (m.index > last) out.push({ t: line.slice(last, m.index), k: '' })
    const g = m.findIndex((x, i) => i > 0 && x !== undefined)
    out.push({ t: m[0], k: KIND[g] ?? '' })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ t: line.slice(last), k: '' })
  return out
}

export type LineMark = 'bad' | 'good'

type Props = {
  value: string
  onChange?: (v: string) => void
  onRun?: () => void
  onEngage?: () => void
  readOnly?: boolean
  marks?: Record<number, LineMark>
  label: string
  className?: string
}

export const Editor = forwardRef<HTMLTextAreaElement, Props>(function Editor(
  { value, onChange, onRun, onEngage, readOnly, marks = {}, label, className = '' },
  ref,
) {
  const lines = useMemo(() => value.split('\n').map(paint), [value])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onRun?.()
      return
    }
    if (readOnly || e.key !== 'Enter' || e.shiftKey || e.altKey || e.nativeEvent.isComposing) return
    // Keep the indentation of the line the caret is on.
    const ta = e.currentTarget
    const start = ta.selectionStart
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
    const indent = /^[ \t]*/.exec(ta.value.slice(lineStart, start))?.[0] ?? ''
    if (!indent) return
    e.preventDefault()
    const text = `\n${indent}`
    // execCommand keeps the native undo stack; setRangeText is the fallback.
    if (!document.execCommand?.('insertText', false, text)) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end')
      onChange?.(ta.value)
    }
  }

  return (
    <div className={`ed ${className}`}>
      <div className="ed-gutter" aria-hidden="true">
        {lines.map((_, i) => (
          <span key={i} className={marks[i] ? `ed-ln ${marks[i]}` : 'ed-ln'}>
            {i + 1}
          </span>
        ))}
      </div>
      <div className="ed-body">
        <pre className="ed-hl" aria-hidden="true">
          {lines.map((toks, i) => (
            <span key={i} className={marks[i] ? `ed-line ${marks[i]}` : 'ed-line'}>
              {toks.map((t, j) => (t.k ? <span key={j} className={t.k}>{t.t}</span> : t.t))}
            </span>
          ))}
        </pre>
        <textarea
          ref={ref}
          className="ed-ta"
          value={value}
          readOnly={readOnly}
          onChange={(e) => {
            onEngage?.()
            onChange?.(e.target.value)
          }}
          onKeyDown={onKeyDown}
          onPointerDown={onEngage}
          aria-label={label}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="off"
          maxLength={6000}
          rows={1}
        />
      </div>
    </div>
  )
})
