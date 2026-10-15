/**
 * Ported from zkortam/spiceplusplus apps/rtlpp/src/app/(marketing)/_site/code.tsx (commit 81224b0):
 * source code as the RTL++ editor shows it, with the workspace's own lexer and the editor theme's
 * colours. Tailwind classes became rp- classes in ../rtl.css with the same values.
 *
 * One addition: `edit`, which lays a transparent textarea over the same lines (same font, size and
 * line height) so the visitor types into the highlighted file. The lines underneath are the real
 * CodeView rendering of whatever is in the textarea.
 */
import type { KeyboardEvent } from 'react'
import { tokenize, type TokenKind } from '@/vendor/rtlpp/site/lexer'

const INK = '#F4F4F6'
const INK_2 = '#9A9AA0'
const INK_3 = '#6E6E75'

const COLOR: Record<TokenKind, string> = {
  keyword: '#C9C9CF',
  ident: INK,
  number: '#E3B98A',
  string: '#A8D5A2',
  op: INK_2,
  directive: INK_2,
  system: '#7CB6FF',
}

type Run = { text: string; color: string; weight?: number; italic?: boolean }

/** Splits a source into lines of coloured runs. */
export function highlight(src: string): Run[][] {
  const runs: Run[] = []
  let at = 0
  for (const t of tokenize(src)) {
    if (t.from > at) runs.push({ text: src.slice(at, t.from), color: INK_3, italic: /\/[/*]/.test(src.slice(at, t.from)) })
    runs.push({ text: src.slice(t.from, t.to), color: COLOR[t.kind], ...(t.kind === 'keyword' ? { weight: 500 } : {}) })
    at = t.to
  }
  if (at < src.length) runs.push({ text: src.slice(at), color: INK_3 })
  const lines: Run[][] = [[]]
  for (const r of runs) {
    const parts = r.text.split('\n')
    parts.forEach((p, i) => {
      if (i > 0) lines.push([])
      if (p) lines[lines.length - 1].push({ ...r, text: p })
    })
  }
  return lines
}

export type CodeEdit = { onChange: (v: string) => void; onRun: () => void; label: string; shortcut: string }

/**
 * A file with line numbers. `marks` tints whole lines: "cause" for the line the Why chain names.
 * `edit` makes it editable (see the file comment).
 */
export function CodeView({
  src,
  file,
  marks = {},
  label,
  edit,
}: {
  src: string
  file: string
  marks?: Record<number, 'cause' | 'step'>
  label?: string
  edit?: CodeEdit
}) {
  const lines = highlight(src)
  const last = lines.length
  // Trailing newline: no empty last row.
  const end = lines[last - 1]?.length === 0 ? last - 1 : last

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      edit?.onRun()
    } else if (e.key === 'Escape') e.currentTarget.blur()
  }

  return (
    <figure className="rp-code" aria-label={label ?? file}>
      <figcaption className="rp-code-file">{file}</figcaption>
      <div className="rp-code-scroll">
        <div className="rp-code-body">
          <pre className="rp-code-pre" aria-hidden={edit ? true : undefined}>
            <code>
              {lines.slice(0, end).map((runs, i) => {
                const n = i + 1
                const mark = marks[n]
                return (
                  <span key={n} className="rp-row" data-mark={mark}>
                    <span aria-hidden className="rp-ln" style={{ color: mark ? INK_2 : '#4A4A50' }}>
                      {n}
                    </span>
                    <span>
                      {runs.length
                        ? runs.map((r, j) => (
                            <span key={j} style={{ color: r.color, fontWeight: r.weight, fontStyle: r.italic ? 'italic' : undefined }}>
                              {r.text}
                            </span>
                          ))
                        : ' '}
                    </span>
                  </span>
                )
              })}
            </code>
          </pre>
          {edit && (
            <textarea
              className="rp-code-input"
              value={src}
              onChange={(e) => edit.onChange(e.target.value)}
              onKeyDown={onKey}
              // The lines underneath set the size; the textarea never scrolls on its own.
              onScroll={(e) => {
                e.currentTarget.scrollTop = 0
                e.currentTarget.scrollLeft = 0
              }}
              aria-label={edit.label}
              aria-keyshortcuts={edit.shortcut}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              wrap="off"
            />
          )}
        </div>
      </div>
    </figure>
  )
}
