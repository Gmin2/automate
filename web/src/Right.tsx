import { useState } from 'react'
import { short, type FaceInfo, type Match, type Params } from './api'
import { kindWord, signed, Tabs } from './bits'
import { Glyph } from './tx/glyphs'
import { FillSlider, Pill, Round, tick } from './tx/kit'
import { clear, commitParams, dropFace, resetParams, run, setActive, setParam, useApp } from './store'

const FIT_WORD = { exact: 'Exact', sliding: 'Sliding', interference: 'Too tight' } as const

function size(f?: FaceInfo) {
  if (!f) return ''
  const bits: string[] = []
  if (f.r !== undefined) bits.push(f.kind === 'sphere' ? `R ${f.r.toFixed(2)}` : `Ø ${(f.r * 2).toFixed(f.r < 10 ? 2 : 1)}`)
  if (f.angle !== undefined) bits.push(`${f.angle.toFixed(1)}°`)
  if (f.side) bits.push(f.side === 'out' ? 'shaft' : 'hole')
  if (f.kind === 'plane') bits.push(`${f.area.toFixed(f.area < 100 ? 1 : 0)} mm²`)
  return bits.join(' · ')
}

function Selection() {
  const sel = useApp((s) => s.selection)
  const info = useApp((s) => s.faceInfo)
  const error = useApp((s) => s.runError)
  const n = sel.faces.length
  return (
    <section className="tx-card sel-card" style={{ flex: 'none', maxHeight: '45%' }}>
      <header className="tx-card__head">
        <span className="tx-card__title">Selection</span>
        {n > 0 && <span className="tx-card__note">{n} {n === 1 ? 'face' : 'faces'}</span>}
        {n > 0 && <Round icon="close" size={24} soft label="Clear" tip="Clear" iconSize={11} onClick={clear} />}
      </header>
      <div className="tx-card__body">
        {!sel.inst ? (
          <p className="hint" style={{ paddingTop: 0 }}>Click faces on one part in the view, then <b>Find mates</b> to see every place that group fits. Click a face again to drop it.</p>
        ) : (
          <div className="th__kv">
            <div className="th__row"><span className="th__k">Part</span><span className="th__v" title={sel.inst}>{short(sel.inst)}</span></div>
            {sel.faces.map((f) => {
              const fi = info[f]
              return (
                <div key={f} className="th__row" data-warn={fi?.kind === 'other' || undefined} data-wait={!fi || undefined}>
                  <span className="th__k">{fi?.kind === 'other' && <Glyph name="warn" size={12} />}Face {f}</span>
                  <span className="th__v" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {fi ? kindWord(fi.kind) : 'Reading'}
                      {fi && <span style={{ color: 'var(--tx-faint)', marginLeft: 6 }}>{fi.kind === 'other' ? 'cant be matched' : size(fi)}</span>}
                    </span>
                    <button type="button" aria-label={`Drop face ${f}`} onClick={() => { tick(); dropFace(f) }} style={{ display: 'inline-flex', border: 0, background: 'none', padding: 2, color: 'var(--tx-faint)', cursor: 'pointer' }}>
                      <Glyph name="close" size={11} />
                    </button>
                  </span>
                </div>
              )
            })}
            {error && <div className="th__row" data-warn><span className="th__k"><Glyph name="warn" size={12} />No match</span><span className="th__v">{error}</span></div>}
          </div>
        )}
      </div>
    </section>
  )
}

function MatchRow({ m, i, on, contact }: { m: Match; i: number; on: boolean; contact?: boolean }) {
  const faces = Object.entries(m.target_faces)
  const name = faces.length > 1 ? faces.map(([k]) => short(k)).join(' + ') : short(m.instance)
  return (
    <div style={{ animation: `tx-row-in 240ms var(--tx-out) ${Math.min(i, 14) * 16}ms both` }}>
      <button type="button" className="tx-row" aria-selected={on} style={{ animation: 'none' }} onClick={() => { if (!contact) { tick(); setActive(on ? null : i) } }}>
        <span className="tx-row__line" style={{ '--tx-dot': `var(--fit-${m.fit})`, marginTop: 0, alignSelf: 'center' } as React.CSSProperties} />
        <span className="tx-row__name" style={{ color: 'var(--tx-text)' }} title={m.instance}>{name}</span>
        <span className="tx-row__note" style={{ color: `var(--fit-${m.fit})` }}>{FIT_WORD[m.fit]}</span>
        {!contact && <Glyph name={on ? 'up' : 'down'} size={13} style={{ color: 'var(--tx-faint)' }} />}
      </button>
      <div className="match-detail">
        <div style={{ fontSize: 11.5, color: 'var(--tx-faint)', fontVariantNumeric: 'tabular-nums' }}>
          {faces.map(([k, fs]) => (faces.length > 1 ? `${short(k)} ` : 'Faces ') + fs.join(', ')).join(' · ')}
        </div>
        <div className="match-chips">
          <span>{m.motion[0]!.toUpperCase() + m.motion.slice(1)}</span>
          <span>Gap {signed(m.clearance)}&nbsp;mm</span>
          {m.symmetry > 1 && <span>{m.symmetry} ways</span>}
          {m.in_place && <span data-tone="place">Where it sits</span>}
          {contact && <span data-tone="place">Touching now</span>}
          {m.confidence === 'low' && <span data-tone="warn">Loose, many fit</span>}
          {m.no_contact.length > 0 && <span data-tone="warn">Partial</span>}
        </div>
        {on && (
          <div className="th__kv" style={{ marginTop: 8 }}>
            {m.selected_to_target.map((p, k) => (
              <div key={k} className="th__row" style={{ gridTemplateColumns: '88px 1fr' }} title={`${Math.round(p.overlap * 100)}% of the selected face lands on its mate`}>
                <span className="th__k">Face {p.selected.join('/')} → {p.target.join('/')}</span>
                <span className="th__v" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{signed(p.gap)}&nbsp;mm<span style={{ color: 'var(--tx-faint)' }}> · {Math.round(p.overlap * 100)}%</span></span>
              </div>
            ))}
            {m.stops.length > 0 && (
              <div className="th__row"><span className="th__k">Stop</span><span className="th__v">Face {m.stops.map((s) => s.faces.join('/')).join(', ')} ends the slide, so it seats</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Matches() {
  const result = useApp((s) => s.result)
  const running = useApp((s) => s.running)
  const active = useApp((s) => s.active)
  if (running && !result) {
    return (
      <section className="tx-card tx-fill">
        <header className="tx-card__head"><span className="tx-card__title">Matches</span></header>
        <div className="tx-card__body" style={{ padding: '0 16px' }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ padding: '10px 0' }}><div className="skel" style={{ width: `${55 + i * 9}%` }} /><div className="skel" style={{ width: '35%', height: 9, marginTop: 7 }} /></div>
          ))}
        </div>
      </section>
    )
  }
  if (!result) return null
  const ms = result.matches
  const here = result.in_place_contacts
  const contactOnly = here && !ms.some((m) => m.in_place)
  return (
    <section className="tx-card tx-fill">
      <header className="tx-card__head">
        <span className="tx-card__title">Matches</span>
        <span className="tx-card__note">{ms.length}</span>
      </header>
      <div className="tx-card__body">
        {ms.map((m, i) => <MatchRow key={i} m={m} i={i} on={active === i} />)}
        {result.too_loose && (
          <p className="hint" style={{ paddingTop: 0 }}>
            <b>Add another face.</b> Flat faces that all point the same way can slide anywhere on any flat face, so they fit almost everything in the machine. Pick one more at an angle (a side, a hole, a shoulder) and search again.{here ? ' Below is only what they touch right now.' : ''}
          </p>
        )}
        {!ms.length && !result.too_loose && <p className="hint" style={{ paddingTop: 0 }}>Nothing in this assembly takes that face group within the tolerances. Loosen them to see near misses.</p>}
        {contactOnly && here && <MatchRow m={here} i={ms.length} on={false} contact />}
        {result.rejected.length > 0 && (
          <p className="hint">
            <b>{result.rejected.length}</b> more face {result.rejected.length === 1 ? 'match' : 'matches'} dropped, the solids would run into each other: {result.rejected.slice(0, 3).map((r) => `${short(r.part)} ${r.faces.join(',')}`).join(', ')}{result.rejected.length > 3 ? '…' : ''}
          </p>
        )}
        {!!result.unchecked && (
          <p className="hint">
            <b>{result.unchecked}</b> {result.unchecked === 1 ? 'fit was' : 'fits were'} kept without the solid collision check, the time for it ran out. A single face fits almost anywhere, pick a few more to narrow it down.
          </p>
        )}
      </div>
      <footer className="tx-card__foot">
        <span>Band <b>{signed(result.gap_band_mm[0], 2)}</b> to <b>{signed(result.gap_band_mm[1], 2)}</b>&nbsp;mm</span>
        <span style={{ marginLeft: 'auto' }}><b>{result.seconds}</b>&nbsp;s</span>
      </footer>
    </section>
  )
}

type Knob = { k: keyof Params; label: string; min: number; max: number; step: number; unit: string; scale?: number; note: string }

// scale turns a fraction into the percent the slider shows
const KNOBS: Knob[] = [
  { k: 'gap_rel', label: 'Clearance', min: 0, max: 20, step: 0.5, unit: '%', scale: 100, note: 'Largest gap, as a share of the selection’s thinnest size' },
  { k: 'gap_min', label: 'Always fine', min: 0, max: 0.5, step: 0.01, unit: 'mm', note: 'A gap this small always counts' },
  { k: 'gap_max', label: 'Never over', min: 0.1, max: 3, step: 0.05, unit: 'mm', note: 'A gap past this never counts' },
  { k: 'interference', label: 'Press fit', min: 0, max: 0.5, step: 0.01, unit: 'mm', note: 'Overlap still taken as a fit' },
  { k: 'exact', label: 'Line to line', min: 0, max: 0.1, step: 0.005, unit: 'mm', note: 'Gaps under this are zero' },
  { k: 'angle', label: 'Angle', min: 0.1, max: 3, step: 0.1, unit: '°', note: 'How far two faces may lean' },
  { k: 'overlap', label: 'Face on face', min: 5, max: 100, step: 5, unit: '%', scale: 100, note: 'How much of a face must land on its mate' },
  { k: 'collide', label: 'Collision', min: 0, max: 5, step: 0.1, unit: '%', scale: 100, note: 'Solid overlap allowed before a fit is dropped' },
]

function Tolerances() {
  const params = useApp((s) => s.params)
  const defaults = useApp((s) => s.defaults)
  const band = useApp((s) => s.result?.gap_band_mm)
  if (!params) return null
  const changed = defaults && (Object.keys(params) as (keyof Params)[]).some((k) => params[k] !== defaults[k])
  return (
    <section className="tx-card tx-fill">
      <div className="tx-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
        {KNOBS.map((s) => {
          const f = s.scale ?? 1
          return (
            <div key={s.k} title={s.note} className="knob" data-edited={defaults && params[s.k] !== defaults[s.k] ? true : undefined}>
              {defaults && params[s.k] !== defaults[s.k] && <span className="knob__home" style={{ left: `clamp(6px, ${((defaults[s.k] * f - s.min) / (s.max - s.min)) * 100}%, calc(100% - 6px))` }} />}
              <FillSlider
                label={s.label}
                value={+(params[s.k] * f).toFixed(4)}
                min={s.min}
                max={s.max}
                step={s.step}
                unit={s.unit}
                onInput={(v) => setParam(s.k, v / f)}
                onCommit={(v) => { setParam(s.k, v / f); commitParams() }}
              />
            </div>
          )
        })}
        {changed && <div style={{ display: 'flex', marginTop: 4 }}><Pill icon="reset" onClick={resetParams} className="grow-pill">Back to the defaults</Pill></div>}
        <p className="hint" style={{ padding: '8px 4px 2px' }}>
          Let go of a slider and the search runs again.{band ? <> This selection takes gaps from <b>{signed(band[0], 2)}</b> to <b>{signed(band[1], 2)}&nbsp;mm</b>.</> : null}
        </p>
      </div>
    </section>
  )
}

export function Right() {
  const [tab, setTab] = useState<'mates' | 'tol'>('mates')
  const open = useApp((s) => s.rightOpen)
  const n = useApp((s) => s.result?.matches.length)
  const edited = useApp((s) => s.defaults && s.params && (Object.keys(s.params) as (keyof Params)[]).some((k) => s.params![k] !== s.defaults![k]))
  return (
    <aside className="tx-right" data-shut={!open || undefined} aria-hidden={!open}>
      <Tabs id="right-tab" at={tab} onPick={setTab} items={[{ id: 'mates', label: 'Mates', count: n }, { id: 'tol', label: 'Tolerances', count: edited ? 'Edited' : undefined }]} />
      <div className="side-stack" key={tab}>
        {tab === 'mates' ? <><Selection /><Matches /><Find /></> : <Tolerances />}
      </div>
    </aside>
  )
}

// the main action again at the foot of the panel, where the hand already is
function Find() {
  const ready = useApp((s) => s.selection.faces.length > 0)
  const running = useApp((s) => s.running)
  const has = useApp((s) => !!s.result || s.running)
  if (!ready || has) return null
  return <div style={{ display: 'flex' }}><Pill primary icon="play" disabled={running} onClick={run} className="grow-pill">Find mates</Pill></div>
}
