import { useMemo, useState } from 'react'
import { short, type Fit } from './api'
import { Box, EyeClosed, EyeOpen, Magnifier, Wand } from './icons'
import { focus, pickExample, toggleHidden, useApp } from './store'
import { cn } from './ui'

const text = 'var(--studio-chrome-text)'
const muted = 'var(--studio-chrome-muted)'
const soft = '#8a8a8a'

// what the last search says about an instance: the colour of its best match, or selected
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
  const groups = useMemo(() => {
    if (scene.state !== 'ready') return []
    const by = new Map<string, string[]>()
    for (const i of scene.data.instances) {
      if (q && !i.id.toLowerCase().includes(q.toLowerCase())) continue
      const k = i.name
      by.set(k, [...(by.get(k) ?? []), i.id])
    }
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [scene, q])

  if (scene.state !== 'ready') return <div className="px-[10px] py-[12px] text-[12px]" style={{ color: muted }}>{scene.state === 'loading' ? 'reading…' : ''}</div>
  return (
    <>
      <label className="mb-[6px] flex h-[30px] shrink-0 items-center gap-[8px] rounded-[6px] px-[8px]" style={{ backgroundColor: 'var(--studio-chrome-surface-raised)' }}>
        <span className="inline-flex h-[11px] w-[11px]" style={{ color: muted }}><Magnifier className="h-full w-full" /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a part" className="min-w-0 flex-1 bg-transparent font-[var(--font-text)] text-[12px] outline-none placeholder:text-[var(--studio-chrome-muted)]" style={{ color: text }} />
      </label>
      <div className="thin-scroll relative min-h-0 flex-1 overflow-y-auto">
        {groups.map(([name, ids]) => (
          <div key={name}>
            {ids.length > 1 && (
              <div className="sticky top-0 z-10 flex h-[26px] items-center justify-between px-[8px] font-[var(--font-text)] text-[10.5px] font-medium uppercase tracking-[0.06em]" style={{ color: soft, backgroundColor: 'var(--studio-chrome-surface)' }}>
                <span className="truncate">{name}</span>
                <span className="font-[var(--font-mono)]">{ids.length}</span>
              </div>
            )}
            {ids.map((id) => {
              const fit = fits[id]
              const off = hidden[id]
              return (
                <div
                  key={id}
                  title={id}
                  onClick={() => focus([id])}
                  className="group relative flex h-[32px] cursor-pointer items-center gap-[10px] rounded-[8px] px-[8px] transition-colors hover:bg-[var(--studio-chrome-surface-raised)]"
                  style={{ backgroundColor: fit === 'selected' ? 'var(--studio-chrome-surface-raised)' : undefined, opacity: off ? 0.45 : 1 }}
                >
                  <span className="inline-flex h-[13px] w-[13px] shrink-0" style={{ color: fit ? `var(--fit-${fit})` : 'var(--studio-chrome-icon-idle)' }}><Box className="h-full w-full" /></span>
                  <span className={cn('min-w-0 flex-1 truncate font-[var(--font-text)] text-[12.5px]', fit && 'font-medium')} style={{ color: fit ? text : '#3f3f3f' }}>{short(id)}</span>
                  {fit && fit !== 'selected' && <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ backgroundColor: `var(--fit-${fit})` }} />}
                  <button
                    type="button"
                    title={off ? 'Show' : 'Hide'}
                    onClick={(e) => { e.stopPropagation(); toggleHidden(id) }}
                    className={cn('inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center transition-opacity', off ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
                    style={{ color: soft }}
                  >
                    {off ? <EyeClosed className="h-[13px] w-[13px]" /> : <EyeOpen className="h-[13px] w-[13px]" />}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

function Examples() {
  const examples = useApp((s) => s.examples)
  const sel = useApp((s) => s.selection)
  if (!examples.length) return <div className="px-[10px] py-[12px] font-[var(--font-text)] text-[12px] leading-[16px]" style={{ color: soft }}>no saved selections for this file. click faces on a part to make one.</div>
  return (
    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
      {examples.map((e, i) => {
        const on = sel.inst === e.instance && sel.faces.join() === e.faces.join()
        return (
          <button
            key={i}
            type="button"
            onClick={() => pickExample(i)}
            className="group flex w-full cursor-pointer items-start gap-[10px] rounded-[8px] px-[8px] py-[9px] text-left transition-colors hover:bg-[var(--studio-chrome-surface-raised)]"
            style={{ backgroundColor: on ? 'var(--studio-chrome-surface-raised)' : undefined }}
          >
            <span className="mt-[1px] inline-flex h-[13px] w-[13px] shrink-0" style={{ color: on ? 'var(--fit-selected)' : 'var(--studio-chrome-icon-idle)' }}><Wand className="h-full w-full" /></span>
            <span className="min-w-0 flex-1">
              <span className={cn('block font-[var(--font-text)] text-[12.5px] leading-[16px]', on && 'font-medium')} style={{ color: text }}>{e.label}</span>
              <span className="mt-[3px] block truncate font-[var(--font-mono)] text-[10px] leading-none" style={{ color: muted }}>{short(e.instance)} · {e.faces.join(', ')}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Tree() {
  const [tab, setTab] = useState<'Parts' | 'Examples'>('Parts')
  const n = useApp((s) => s.examples.length)
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col rounded-[8px] border px-[6px] py-[6px]" style={{ borderColor: 'var(--studio-chrome-border)', backgroundColor: 'var(--studio-chrome-surface)' }}>
      <div className="mb-[6px] grid shrink-0 grid-cols-2 gap-[2px] rounded-[6px] p-[2px]" style={{ backgroundColor: 'var(--studio-chrome-hover)' }}>
        {(['Parts', 'Examples'] as const).map((t) => {
          const on = tab === t
          return (
            <button key={t} type="button" onClick={() => setTab(t)} className="h-[24px] cursor-pointer rounded-[5px] font-[var(--font-text)] text-[12px] transition-colors" style={{ color: on ? text : muted, backgroundColor: on ? 'var(--studio-chrome-surface-raised)' : 'transparent' }}>
              {t}{t === 'Examples' && n ? <span className="ml-[5px] font-[var(--font-mono)] text-[10px]" style={{ color: muted }}>{n}</span> : null}
            </button>
          )
        })}
      </div>
      {tab === 'Parts' ? <Parts /> : <Examples />}
    </div>
  )
}
