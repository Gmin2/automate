import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { tick } from './tx/kit'

// the two tab pill at the top of a side column, its mark sliding to the one that is on
export function Tabs<T extends string>({ items, at, onPick, id }: { items: { id: T; label: string; count?: number | string }[]; at: T; onPick: (t: T) => void; id: string }) {
  return (
    <div className="th-tabs" role="tablist">
      {items.map((it) => {
        const on = it.id === at
        return (
          <button key={it.id} type="button" role="tab" aria-selected={on} onClick={() => { if (!on) { tick(); onPick(it.id) } }}>
            {on && <motion.span layoutId={id} className="th-tabs__mark" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
            <span>{it.label}</span>
            {it.count ? <i>{it.count}</i> : null}
          </button>
        )
      })}
    </div>
  )
}

// a spinner, a word with light running over it, and the seconds so far
export function Live({ word, since }: { word: string; since: number | null }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const secs = since ? Math.max(0, (now - since) / 1000) : 0
  return (
    <span className="live">
      <span className="spinner" />
      <span className="live__word">{word}</span>
      <span className="live__secs">{secs.toFixed(0)}&nbsp;s</span>
    </span>
  )
}

// the words that say what a face is
const KIND: Record<string, string> = { plane: 'Plane', cyl: 'Cylinder', cone: 'Cone', sphere: 'Sphere', other: 'Freeform' }
export const kindWord = (k?: string) => (k ? KIND[k] ?? k : '')

export const mm = (v: number, dp = 2) => `${v.toFixed(dp)} mm`
export const signed = (v: number, dp = 3) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dp)}`
