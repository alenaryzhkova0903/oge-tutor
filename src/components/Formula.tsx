'use client'

import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// Renders text that may contain inline LaTeX between $...$
// Plain text (no $ delimiters) is rendered as-is.
export default function Formula({ children, block = false }: { children: string; block?: boolean }) {
  const parts = useMemo(() => {
    const segments: { type: 'text' | 'math'; content: string }[] = []
    const regex = /\$([^$]+)\$/g
    let last = 0
    let m: RegExpExecArray | null

    while ((m = regex.exec(children)) !== null) {
      if (m.index > last) segments.push({ type: 'text', content: children.slice(last, m.index) })
      segments.push({ type: 'math', content: m[1] })
      last = m.index + m[0].length
    }
    if (last < children.length) segments.push({ type: 'text', content: children.slice(last) })
    return segments
  }, [children])

  if (block) {
    try {
      const html = katex.renderToString(children, { throwOnError: false, displayMode: true })
      return <div dangerouslySetInnerHTML={{ __html: html }} />
    } catch {
      return <div>{children}</div>
    }
  }

  return (
    <span>
      {parts.map((p, i) => {
        if (p.type === 'text') return <span key={i}>{p.content}</span>
        try {
          const html = katex.renderToString(p.content, { throwOnError: false })
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        } catch {
          return <span key={i}>{p.content}</span>
        }
      })}
    </span>
  )
}
