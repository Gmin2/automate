import { useState } from 'react'
import { Live } from './bits'
import { Menu, Pill, Round, type MenuAt } from './tx/kit'
import { Glyph } from './tx/glyphs'
import { open, run, setTheme, togglePanel, useApp } from './store'

function FilePill() {
  const files = useApp((s) => s.files)
  const file = useApp((s) => s.file)
  const [menu, setMenu] = useState<MenuAt | null>(null)
  return (
    <>
      <Pill
        icon="cube"
        caret
        open={!!menu}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setMenu(menu ? null : {
            title: 'Assemblies',
            x: r.left,
            y: r.bottom + 8,
            items: files.map((f) => ({ label: f.name + (f.loaded ? '' : ''), icon: f.name === file ? 'check' : f.loaded ? 'cube' : 'cubeWire', on: () => { if (f.name !== file) open(f.name) } })),
          })
        }}
      >
        <span style={{ color: 'var(--tx-text)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file ?? 'No file'}</span>
      </Pill>
      {menu && <Menu menu={menu} onClose={() => setMenu(null)} />}
    </>
  )
}

function Stats() {
  const scene = useApp((s) => s.scene)
  if (scene.state !== 'ready') return null
  const parts = scene.data.instances.length
  const faces = Object.values(scene.data.parts).reduce((n, p) => n + p.nfaces, 0)
  return (
    <div className="tx-stats">
      <span className="tx-stats__seg"><Glyph name="box" size={14} /><span className="tx-stats__v">{parts} <i>parts</i></span></span>
      <span className="tx-stats__seg"><Glyph name="layers" size={14} /><span className="tx-stats__v">{faces.toLocaleString()} <i>faces</i></span></span>
    </div>
  )
}

function Status() {
  const scene = useApp((s) => s.scene)
  const running = useApp((s) => s.running)
  const result = useApp((s) => s.result)
  const started = useApp((s) => s.started)
  if (scene.state === 'loading') return <div className="tx-pill tx-pill--quiet"><Live word="Reading the step file" since={started} /></div>
  if (running) return <div className="tx-pill tx-pill--quiet"><Live word="Matching" since={started} /></div>
  if (!result) return null
  const n = result.matches.length
  const exact = result.matches.filter((m) => m.fit === 'exact').length
  return (
    <div className="tx-stats">
      <span className="tx-stats__seg"><Glyph name="okCircle" size={14} style={{ color: n ? 'var(--tx-green)' : 'var(--tx-faint)' }} /><span className="tx-stats__v">{n} <i>{n === 1 ? 'match' : 'matches'}</i></span></span>
      {n > 0 && <span className="tx-stats__seg"><span className="tx-stats__v">{exact} <i>exact</i></span></span>}
      <span className="tx-stats__seg"><Glyph name="clock" size={14} /><span className="tx-stats__v">{result.seconds} <i>s</i></span></span>
    </div>
  )
}

export function Top() {
  const ready = useApp((s) => s.selection.faces.length > 0 && !s.running)
  const again = useApp((s) => !!s.result)
  const theme = useApp((s) => s.theme)
  const left = useApp((s) => s.leftOpen)
  const right = useApp((s) => s.rightOpen)
  return (
    <div className="tx-top">
      <div className="tx-group">
        <div className="tx-pill tx-pill--quiet" style={{ color: 'var(--tx-text)', fontWeight: 600 }}><Glyph name="bolt" size={16} style={{ color: 'var(--tx-orange)' }} />Automate</div>
        <Round icon="panel" on={left} label={left ? 'Shut the parts panel' : 'Open the parts panel'} tip={left ? 'Shut the side  [' : 'Open the side  ['} onClick={() => togglePanel('left')} />
        <FilePill />
        <Stats />
      </div>
      <span className="tx-top__push" />
      <div className="tx-group">
        <Status />
        <Pill primary icon={again ? 'reset' : 'play'} disabled={!ready} onClick={run}>{again ? 'Search again' : 'Find mates'}</Pill>
        <Round icon="panelRight" on={right} label={right ? 'Shut the mates panel' : 'Open the mates panel'} tip={right ? 'Shut the side  ]' : 'Open the side  ]'} onClick={() => togglePanel('right')} />
        <Round icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'Light' : 'Dark'} tip={theme === 'dark' ? 'Light' : 'Dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      </div>
    </div>
  )
}
