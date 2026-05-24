'use client'

import { useRef } from 'react'

const KEYS = [
  { label: '/',   insert: '/' },
  { label: ';',   insert: '; ' },
  { label: '−',   insert: '−' },
  { label: '(',   insert: '(' },
  { label: ')',   insert: ')' },
  { label: ',',   insert: ',' },
  { label: '√',   insert: '√' },
  { label: 'π',   insert: 'π' },
  { label: '²',   insert: '²' },
  { label: '⌫',   insert: 'BACKSPACE' },
]

interface Props {
  value: string
  onChange: (val: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

export default function MathKeyboard({ value, onChange, inputRef }: Props) {
  const selRef = useRef({ start: 0, end: 0 })

  function saveSelection() {
    const el = inputRef.current
    if (el) {
      selRef.current = { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length }
    }
  }

  function insert(key: string) {
    const el = inputRef.current
    const { start, end } = el
      ? { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length }
      : selRef.current

    let next: string
    let cursor: number

    if (key === 'BACKSPACE') {
      if (start === end && start > 0) {
        next = value.slice(0, start - 1) + value.slice(end)
        cursor = start - 1
      } else {
        next = value.slice(0, start) + value.slice(end)
        cursor = start
      }
    } else {
      next = value.slice(0, start) + key + value.slice(end)
      cursor = start + key.length
    }

    onChange(next)
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2" onMouseDown={(e) => e.preventDefault()}>
      {KEYS.map((k) => (
        <button
          key={k.label}
          type="button"
          onClick={() => { saveSelection(); insert(k.insert) }}
          className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-mono text-sm px-3 py-1.5 rounded-lg transition select-none"
        >
          {k.label}
        </button>
      ))}
    </div>
  )
}
