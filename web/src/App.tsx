import { useEffect } from 'react'
import { short } from './api'
import { Live } from './bits'
import { Left } from './Left'
import { Right } from './Right'
import { boot, focusAll, setView, togglePanel, useApp } from './store'
import { Top } from './Top'
import { Glyph } from './tx/glyphs'
import { Bar, Rule, Tool } from './tx/kit'
import { Viewport } from './Viewport'

function Tip() {
  const hover = useApp((s) => s.hover)
  const sel = useApp((s) => s.selection)
  if (!hover) return null
  const picked = sel.inst === hover.inst && sel.faces.includes(hover.face)
  const verb = picked ? 'Click to drop' : sel.inst && sel.inst !== hover.inst ? 'Click to start over' : 'Click to add'
  return (
    <div className="canvas-tip" style={{ left: hover.x + 14, top: hover.y + 14 }} key={`${hover.inst}${hover.face}`}>
      <b>{short(hover.inst)}</b>
      <i>Face {hover.face}</i>
      <i>· {verb}</i>
    </div>
  )
}

// what the stage shows while a file opens or when it cant
function Wait() {
  const scene = useApp((s) => s.scene)
  const file = useApp((s) => s.file)
  const started = useApp((s) => s.started)
  if (scene.state !== 'loading' && scene.state !== 'error') return null
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div className="tx-card" style={{ width: 340, padding: '18px 18px 16px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--tx-control)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: scene.state === 'error' ? 'var(--tx-red)' : 'var(--tx-faint)' }}>
          <Glyph name={scene.state === 'error' ? 'warn' : 'cube'} size={18} />
        </div>
        <div style={{ marginTop: 12, font: '600 15px/20px inherit', color: 'var(--tx-text)' }}>{scene.state === 'error' ? 'Could not open it' : 'Opening the assembly'}</div>
        <div style={{ marginTop: 4, fontSize: 13, lineHeight: '19.5px', fontWeight: 400, color: 'var(--tx-body)' }}>
          {scene.state === 'error' ? scene.error : <>{file}. The first open reads and meshes every face, the big lathe takes about 15&nbsp;s.</>}
        </div>
        {scene.state === 'loading' && <div style={{ marginTop: 12 }}><Live word="Reading faces" since={started} /></div>}
      </div>
    </div>
  )
}

function Tools() {
  const xray = useApp((s) => s.xray)
  const ghosts = useApp((s) => s.ghosts)
  const edges = useApp((s) => s.edges)
  const ready = useApp((s) => s.scene.state === 'ready')
  if (!ready) return null
  return (
    <Bar label="View">
      <Tool icon="fit" label="Frame everything" shortcut="F" onClick={focusAll} />
      <Rule />
      <Tool icon="layers" label="X-ray the rest" shortcut="X" on={xray} onClick={() => setView({ xray: !xray })} />
      <Tool icon="glass" label="Ghost at each match" shortcut="G" on={ghosts} onClick={() => setView({ ghosts: !ghosts })} />
      <Tool icon="cubeWire" label="Feature lines" shortcut="E" on={edges} onClick={() => setView({ edges: !edges })} />
    </Bar>
  )
}

export function App() {
  useEffect(() => { boot() }, [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      const s = useApp.getState()
      if (e.key === 'f') focusAll()
      if (e.key === 'x') setView({ xray: !s.xray })
      if (e.key === 'g') setView({ ghosts: !s.ghosts })
      if (e.key === 'e') setView({ edges: !s.edges })
      if (e.key === '[') togglePanel('left')
      if (e.key === ']') togglePanel('right')
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  return (
    <div className="tx" style={{ '--tx-left': '306px', '--tx-right': '326px' } as React.CSSProperties}>
      <div className="tx-stage">
        <div className="tx-page tx-page--full">
          <div className="stage-card stage-card--full">
            <Viewport />
            <Wait />
          </div>
        </div>
      </div>
      <Top />
      <Left />
      <Right />
      <Tools />
      <Tip />
    </div>
  )
}
