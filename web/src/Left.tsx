import { useMemo, useState } from 'react'
import { short, type Fit } from './api'
import { Tabs } from './bits'
import { Glyph } from './tx/glyphs'
import { tick } from './tx/kit'
import { focus, pickExample, toggleHidden, useApp } from './store'

const FIT_WORD: Record<Fit | 'selected', string> = { exact: 'Exact', sliding: 'Sliding', interference: 'Too tight', selected: 'Picked' }

// what the last search says about each instance: picked, or the best fit found on it
function useFits() {
  const result = useApp((s) => s.result)
  const sel = useApp((s) => s.selection.inst)
  return useMemo(() => {
    const out: Record<string, Fit | 'selected'> = {}
    for (const m of result?.matches ?? []) for (const k of Object.keys(m.target_faces)) out[k] = out[k] === 'exact' ? 'exact' : m.fit
    if (sel) out[sel] = 'selected'
    return out
  }, [result, sel])
}

function Parts() {
  const scene = useApp((s) => s.scene)
  const hidden = useApp((s) => s.hidden)
  const [q, setQ] = useState('')
  const fits = useFits()
  const shelves = useMemo(() => {
    if (scene.state !== 'ready') return []
    const by = new Map<string, string[]>()
    for (const i of scene.data.instances) {
      if (q && !i.id.toLowerCase().includes(q.toLowerCase())) continue
      by.set(i.name, [...(by.get(i.name) ?? []), i.id])
    }
    // parts used once go together, repeated parts get a shelf each
    const single = [...by.entries()].filter(([, ids]) => ids.length === 1).map(([, ids]) => ids[0]!).sort()
    const many = [...by.entries()].filter(([, ids]) => ids.length > 1).sort((a, b) => a[0].localeCompare(b[0]))
    // what the last search touched goes on top, so the answer is in view
    const hit = Object.keys(fits).filter((id) => !q || id.toLowerCase().includes(q.toLowerCase()))
    const order = (id: string) => (fits[id] === 'selected' ? 0 : 1)
    hit.sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    return [...(hit.length ? [['In this search', hit] as [string, string[]]] : []), ...(single.length ? [['Single parts', single] as [string, string[]]] : []), ...many]
  }, [scene, q, fits])

  if (scene.state === 'loading') {
    return (
      <div style={{ padding: '10px 10px' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', height: 32 }}>
            <div className="skel" style={{ width: 16, height: 16, borderRadius: 5 }} />
            <div className="skel" style={{ width: `${40 + ((i * 37) % 45)}%` }} />
          </div>
        ))}
      </div>
    )
  }
  if (scene.state !== 'ready') return null
  let n = 0
  return (
    <>
      <label className="find">
        <Glyph name="search" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a part" />
        {q && <button type="button" aria-label="Clear" onClick={() => setQ('')} style={{ display: 'inline-flex', border: 0, background: 'none', padding: 0, color: 'var(--tx-faint)' }}><Glyph name="close" size={12} /></button>}
      </label>
      {shelves.map(([name, ids]) => (
        <section key={name} className="tx-shelf">
          <h5 className="tx-shelf__head"><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span><i>{ids.length}</i></h5>
          {ids.map((id) => {
            const fit = fits[id]
            const off = hidden[id]
            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                title={id}
                className="tx-row"
                aria-selected={fit === 'selected'}
                data-off={off || undefined}
                style={{ animationDelay: `${Math.min(n++, 14) * 16}ms` }}
                onClick={() => { tick(); focus([id]) }}
                onKeyDown={(e) => { if (e.key === 'Enter') focus([id]) }}
              >
                <span className="tx-row__icon" style={{ color: fit ? `var(--fit-${fit})` : undefined }}><Glyph name={fit ? 'cube' : 'cubeWire'} size={16} /></span>
                <span className="tx-row__name" style={{ color: fit ? 'var(--tx-text)' : undefined }}>{short(id)}</span>
                {fit && <span className="tx-row__note" style={{ color: `var(--fit-${fit})` }}>{FIT_WORD[fit]}</span>}
                <button
                  type="button"
                  className="row-act"
                  data-on={off || undefined}
                  aria-label={off ? 'Show' : 'Hide'}
                  onClick={(e) => { e.stopPropagation(); tick(); toggleHidden(id) }}
                  style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <Glyph name={off ? 'eyeOff' : 'eye'} size={15} />
                </button>
              </div>
            )
          })}
        </section>
      ))}
      {!shelves.length && <p className="hint">Nothing called <b>{q}</b> here.</p>}
    </>
  )
}

const LINES = ['--tx-red', '--tx-orange', '--tx-yellow', '--tx-green', '--tx-mint', '--tx-cyan', '--tx-blue', '--tx-indigo']

function Examples() {
  const examples = useApp((s) => s.examples)
  const sel = useApp((s) => s.selection)
  if (!examples.length) return <p className="hint">No saved selections for this file. Click faces on a part to make one.</p>
  return (
    <section className="tx-shelf">
      <h5 className="tx-shelf__head"><span>Saved selections</span><i>{examples.length}</i></h5>
      {examples.map((e, i) => {
        const on = sel.inst === e.instance && sel.faces.join() === e.faces.join()
        return (
          <button key={i} type="button" className="tx-row" aria-selected={on} style={{ alignItems: 'flex-start', paddingTop: 7, paddingBottom: 7, animationDelay: `${i * 16}ms` }} onClick={() => { tick(); pickExample(i) }}>
            <span className="tx-row__line" style={{ '--tx-dot': `var(${LINES[i % LINES.length]})` } as React.CSSProperties} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="tx-row__name tx-row__name--wrap" style={{ display: 'block', color: 'var(--tx-text)' }}>{(e.label[0]!.toUpperCase() + e.label.slice(1)).replaceAll('->', '→')}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: 'var(--tx-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{short(e.instance)} · faces {e.faces.join(', ')}</span>
            </span>
          </button>
        )
      })}
    </section>
  )
}

export function Left() {
  const [tab, setTab] = useState<'parts' | 'examples'>('parts')
  const scene = useApp((s) => s.scene)
  const examples = useApp((s) => s.examples.length)
  const parts = scene.state === 'ready' ? scene.data.instances.length : undefined
  const faces = scene.state === 'ready' ? Object.values(scene.data.parts).reduce((n, p) => n + p.nfaces, 0) : 0
  return (
    <aside className="tx-left">
      <Tabs id="left-tab" at={tab} onPick={setTab} items={[{ id: 'parts', label: 'Parts', count: parts }, { id: 'examples', label: 'Examples', count: examples }]} />
      <div className="side-stack" key={tab}>
        <section className="tx-card tx-fill">
          <div className="tx-card__body" style={{ paddingTop: 8 }}>{tab === 'parts' ? <Parts /> : <Examples />}</div>
          {tab === 'parts' && scene.state === 'ready' && (
            <footer className="tx-card__foot"><span><b>{parts}</b> parts</span><span><b>{faces.toLocaleString()}</b> faces</span></footer>
          )}
        </section>
      </div>
    </aside>
  )
}
