import { short, type FaceInfo, type Match, type Params } from './api'
import { Crosshairs, Fails, Layers, Sliders, Target } from './icons'
import { clear, commitParams, dropFace, focusAll, resetParams, run, setActive, setParam, setView, useApp } from './store'
import { cn, joined, Line, Note, Row, Section, Slider, Toggle } from './ui'

const text = 'var(--studio-chrome-text)'
const muted = 'var(--studio-chrome-muted)'
const soft = '#8a8a8a'
const card = { borderColor: 'var(--studio-chrome-border)', backgroundColor: 'var(--studio-chrome-surface-raised)' }

const KIND: Record<string, string> = { plane: 'plane', cyl: 'cylinder', cone: 'cone', sphere: 'sphere', other: 'freeform' }

function faceWords(f?: FaceInfo) {
  if (!f) return ''
  const parts: string[] = []
  if (f.r !== undefined) parts.push(`${f.kind === 'sphere' ? 'R' : 'Ø'}${(f.kind === 'sphere' ? f.r : f.r * 2).toFixed(f.r < 10 ? 2 : 1)}`)
  if (f.angle !== undefined) parts.push(`${f.angle.toFixed(1)}°`)
  if (f.side) parts.push(f.side === 'out' ? 'shaft' : 'hole')
  if (f.kind === 'plane') parts.push(`${f.area.toFixed(f.area < 100 ? 1 : 0)} mm²`)
  return parts.join(' · ')
}

function SelectionSection() {
  const sel = useApp((s) => s.selection)
  const info = useApp((s) => s.faceInfo)
  const running = useApp((s) => s.running)
  const error = useApp((s) => s.runError)
  const n = sel.faces.length
  return (
    <Section title="Selection" icon={Crosshairs} aside={n ? `${n} ${n === 1 ? 'face' : 'faces'}` : undefined}>
      {!sel.inst ? (
        <Note label="pick faces">click faces on one part in the canvas, then find where that group fits. click a face again to drop it. the examples tab on the left has ready made ones.</Note>
      ) : (
        <>
          <Row label="part" value={short(sel.inst)} title={sel.inst} />
          <div>
            {sel.faces.map((f, i) => {
              const fi = info[f]
              return (
                <div key={f} className={cn('flex h-[40px] items-center rounded-[8px] border px-[11px]', joined(i, n))} style={card}>
                  <span className="w-[56px] shrink-0 font-[var(--font-mono)] text-[11px] leading-none" style={{ color: text }}>#{f}</span>
                  <span className="ml-[6px] min-w-0 flex-1 truncate font-[var(--font-text)] text-[12px] leading-none" style={{ color: text }}>
                    {fi ? KIND[fi.kind] : <span style={{ color: muted }}>…</span>}
                    {fi && <span className="ml-[8px] font-[var(--font-mono)] text-[10px]" style={{ color: soft }}>{faceWords(fi)}</span>}
                  </span>
                  <button type="button" title="Drop this face" onClick={() => dropFace(f)} className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] transition-colors hover:bg-[var(--studio-chrome-hover)]" style={{ color: soft }}>
                    <Fails className="h-[10px] w-[10px]" />
                  </button>
                </div>
              )
            })}
          </div>
          {sel.faces.some((f) => info[f]?.kind === 'other') && <Note label="heads up">freeform faces (splines that arent really a plane, cylinder, cone or sphere) cant be matched, the search will say so.</Note>}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-[6px] pt-[2px]">
            <button
              type="button"
              disabled={running}
              onClick={run}
              className="flex h-[40px] items-center justify-center gap-[8px] rounded-[8px] font-[var(--font-text)] text-[13px] font-medium leading-none transition-[background-color,opacity] hover:bg-[#1c1c1c] disabled:cursor-wait disabled:opacity-70"
              style={{ backgroundColor: 'var(--studio-chrome-active-surface)', color: 'var(--studio-chrome-active-text)' }}
            >
              {running && <span className="spin inline-block h-[10px] w-[10px] rounded-full border-[1.5px] border-white border-t-transparent" />}
              {running ? 'Matching' : 'Find mates'}
            </button>
            <button type="button" onClick={clear} className="h-[40px] rounded-[8px] border px-[16px] font-[var(--font-text)] text-[12px] transition-colors hover:bg-[var(--studio-chrome-hover)]" style={{ ...card, color: text }}>Clear</button>
          </div>
          {error && <Note label="could not match">{error}</Note>}
        </>
      )}
    </Section>
  )
}

type Knob = { k: keyof Params; label: string; min: number; max: number; step: number; shown: (v: number) => string; sub?: string }

const KNOBS: Knob[] = [
  { k: 'gap_rel', label: 'clearance', sub: 'max, of size', min: 0, max: 0.2, step: 0.005, shown: (v) => `${(v * 100).toFixed(1)}%` },
  { k: 'gap_min', label: 'floor', sub: 'always ok', min: 0, max: 0.5, step: 0.01, shown: (v) => `${v.toFixed(2)} mm` },
  { k: 'gap_max', label: 'ceiling', sub: 'never over', min: 0.1, max: 3, step: 0.05, shown: (v) => `${v.toFixed(2)} mm` },
  { k: 'interference', label: 'press fit', sub: 'overlap ok', min: 0, max: 0.5, step: 0.01, shown: (v) => `${v.toFixed(2)} mm` },
  { k: 'exact', label: 'line to line', min: 0, max: 0.1, step: 0.005, shown: (v) => `${v.toFixed(3)}` },
  { k: 'angle', label: 'angle', min: 0.1, max: 3, step: 0.1, shown: (v) => `${v.toFixed(1)}°` },
  { k: 'overlap', label: 'overlap', sub: 'face on face', min: 0.05, max: 1, step: 0.05, shown: (v) => `${Math.round(v * 100)}%` },
  { k: 'collide', label: 'collision', sub: 'solid overlap', min: 0, max: 0.05, step: 0.001, shown: (v) => `${(v * 100).toFixed(1)}%` },
]

function TolerancesSection() {
  const params = useApp((s) => s.params)
  const defaults = useApp((s) => s.defaults)
  const band = useApp((s) => s.result?.gap_band_mm)
  if (!params) return null
  const changed = defaults && (Object.keys(params) as (keyof Params)[]).some((k) => params[k] !== defaults[k])
  return (
    <Section title="Tolerances" icon={Sliders} aside={changed ? 'edited' : undefined} defaultOpen>
      {KNOBS.map((s) => (
        <Slider key={s.k} label={s.label} sub={s.sub} value={params[s.k]} min={s.min} max={s.max} step={s.step} shown={s.shown} onChange={(v) => setParam(s.k, v)} onCommit={commitParams} />
      ))}
      {band && <Row label="band" value={<span className="font-[var(--font-mono)] text-[11px]">{band[0] >= 0 ? '+' : ''}{band[0].toFixed(2)} to +{band[1].toFixed(2)} mm</span>} title="the gap a face may have and still count, for this selection" />}
      {changed && <Row label="reset" value="back to the defaults" onClick={resetParams} />}
    </Section>
  )
}

const FIT_WORD = { exact: 'exact', sliding: 'sliding', interference: 'interference' } as const

function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className="rounded-[5px] px-[6px] py-[3px] font-[var(--font-text)] text-[10.5px] leading-none" style={{ backgroundColor: tone ? `color-mix(in srgb, ${tone} 12%, white)` : 'var(--studio-chrome-surface-subtle)', color: tone ?? '#6b6b6b' }}>{children}</span>
}

function MatchCard({ m, i, n, on, contact }: { m: Match; i: number; n: number; on: boolean; contact?: boolean }) {
  const color = `var(--fit-${m.fit})`
  const faces = Object.entries(m.target_faces)
  const name = faces.length > 1 ? faces.map(([k]) => short(k)).join(' + ') : short(m.instance)
  return (
    <button
      type="button"
      onClick={() => !contact && setActive(on ? null : i)}
      className={cn('relative block w-full overflow-hidden rounded-[8px] border px-[11px] py-[10px] text-left transition-colors', joined(i, n), !contact && 'hover:bg-[var(--studio-chrome-surface-subtle)]', contact && 'cursor-default')}
      style={{ ...card, backgroundColor: on ? 'var(--studio-chrome-surface-subtle)' : card.backgroundColor }}
    >
      <span className="absolute inset-y-[6px] left-0 w-[3px] rounded-r-[2px] transition-opacity" style={{ backgroundColor: color, opacity: on ? 1 : 0 }} />
      <span className="flex items-center gap-[8px]">
        <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1 truncate font-[var(--font-text)] text-[12.5px] font-medium leading-none" style={{ color: text }} title={m.instance}>{name}</span>
        <span className="rounded-full px-[7px] py-[3px] font-[var(--font-text)] text-[10px] font-medium leading-none text-white" style={{ backgroundColor: color }}>{FIT_WORD[m.fit]}</span>
      </span>
      <span className="mt-[7px] block truncate font-[var(--font-mono)] text-[10px] leading-none" style={{ color: soft }}>
        {faces.map(([k, fs]) => (faces.length > 1 ? `${short(k)}: ` : 'faces ') + fs.join(' · ')).join('  ')}
      </span>
      <span className="mt-[8px] flex flex-wrap gap-[4px]">
        <Chip>{m.motion}</Chip>
        <Chip>gap {m.clearance >= 0 ? '+' : ''}{m.clearance.toFixed(3)}</Chip>
        {m.symmetry > 1 && <Chip>{m.symmetry} ways</Chip>}
        {m.in_place && <Chip tone="#7a5cff">where it sits</Chip>}
        {contact && <Chip tone="#7a5cff">touching now</Chip>}
        {m.confidence === 'low' && <Chip tone="#c27a00">low confidence</Chip>}
        {m.no_contact.length > 0 && <Chip tone="#c27a00">partial</Chip>}
      </span>
      {on && (
        <span className="mt-[10px] block border-t pt-[8px]" style={{ borderColor: 'var(--studio-chrome-border)' }}>
          {m.selected_to_target.map((p, k) => (
            <span key={k} className="flex items-center justify-between py-[3px] font-[var(--font-mono)] text-[10px] leading-none" style={{ color: '#5c5c5c' }}>
              <span>#{p.selected.join('/')} → #{p.target.join('/')} <span style={{ color: muted }}>{p.kind}</span></span>
              <span>{p.gap >= 0 ? '+' : ''}{p.gap.toFixed(3)} mm · {Math.round(p.overlap * 100)}%</span>
            </span>
          ))}
          {m.stops.length > 0 && <span className="block pt-[4px] font-[var(--font-text)] text-[11px] leading-[15px]" style={{ color: soft }}>stopped by face {m.stops.map((s) => s.faces.join('/')).join(', ')}, so the slide ends seated</span>}
        </span>
      )}
    </button>
  )
}

function MatchesSection() {
  const result = useApp((s) => s.result)
  const running = useApp((s) => s.running)
  const active = useApp((s) => s.active)
  if (!result && !running) return null
  if (!result) return <Section title="Matches" icon={Target} aside="…"><Note>searching every part for the same face group, then checking the solids dont run into each other.</Note></Section>
  const ms = result.matches
  const here = result.in_place_contacts
  const contactOnly = here && !ms.some((m) => m.in_place)
  const counts = { exact: 0, sliding: 0, interference: 0 }
  ms.forEach((m) => counts[m.fit]++)
  return (
    <Section title="Matches" icon={Target} aside={`${ms.length} · ${result.seconds}s`}>
      {ms.length > 0 && (
        <div className="flex gap-[6px] px-[2px] pb-[2px]">
          {(['exact', 'sliding', 'interference'] as const).filter((k) => counts[k]).map((k) => (
            <span key={k} className="flex items-center gap-[5px] font-[var(--font-text)] text-[11px]" style={{ color: '#5c5c5c' }}>
              <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: `var(--fit-${k})` }} />{counts[k]} {k}
            </span>
          ))}
        </div>
      )}
      {ms.length > 0 && <div>{ms.map((m, i) => <MatchCard key={i} m={m} i={i} n={ms.length} on={active === i} />)}</div>}
      {!ms.length && <Note label="no fit">nothing in this assembly takes that face group within the tolerances. loosen them in the section above to see near misses.</Note>}
      {contactOnly && here && <MatchCard m={here} i={0} n={1} on={false} contact />}
      {result.rejected.length > 0 && (
        <Line label="rejected">
          <span className="block font-[var(--font-text)] text-[11.5px] leading-[16px]" style={{ color: '#5c5c5c' }}>
            {result.rejected.length} face {result.rejected.length === 1 ? 'match' : 'matches'} where the solids would run into each other:{' '}
            {result.rejected.slice(0, 4).map((r) => `${short(r.part)} #${r.faces.join(',')}`).join(', ')}{result.rejected.length > 4 ? '…' : ''}
          </span>
        </Line>
      )}
    </Section>
  )
}

function ViewSection() {
  const xray = useApp((s) => s.xray)
  const ghosts = useApp((s) => s.ghosts)
  const edges = useApp((s) => s.edges)
  return (
    <Section title="View" icon={Layers} defaultOpen={false}>
      <Toggle label="x-ray the rest" checked={xray} onChange={(v) => setView({ xray: v })} />
      <Toggle label="ghost at each match" checked={ghosts} onChange={(v) => setView({ ghosts: v })} />
      <Toggle label="feature lines" checked={edges} onChange={(v) => setView({ edges: v })} />
      <Row label="camera" value="frame everything" onClick={focusAll} />
      <Line label="colours">
        <span className="flex flex-wrap gap-x-[10px] gap-y-[6px]">
          {(['selected', 'exact', 'sliding', 'interference'] as const).map((k) => (
            <span key={k} className="flex items-center gap-[5px] text-[11.5px]"><span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: `var(--fit-${k})` }} />{k}</span>
          ))}
        </span>
      </Line>
    </Section>
  )
}

export function Inspector() {
  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="flex w-[calc(100%-20px)] flex-col gap-[16px] pb-[20px] pt-[20px]">
        <SelectionSection />
        <MatchesSection />
        <TolerancesSection />
        <ViewSection />
      </div>
    </div>
  )
}
