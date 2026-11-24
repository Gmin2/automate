import { useEffect } from 'react'
import { short } from './api'
import { Crosshairs, EyeOpen, Layers } from './icons'
import { Inspector } from './Inspector'
import { boot, focusAll, setView, useApp } from './store'
import { TopBar } from './TopBar'
import { Tree } from './Tree'
import { cn, DarkTag, Key } from './ui'
import { Viewport } from './Viewport'

function Tip() {
  const hover = useApp((s) => s.hover)
  const sel = useApp((s) => s.selection)
  if (!hover) return null
  const picked = sel.inst === hover.inst && sel.faces.includes(hover.face)
  return (
    <div className="pointer-events-none fixed z-40" style={{ left: hover.x + 14, top: hover.y + 12 }}>
      <DarkTag>
        <span className="max-w-[260px] truncate">{short(hover.inst)}</span>
        <Key>#{hover.face}</Key>
        <span className="text-[11px] opacity-60">{picked ? 'click to drop' : sel.inst && sel.inst !== hover.inst ? 'click to start over' : 'click to add'}</span>
      </DarkTag>
    </div>
  )
}

function Loading() {
  const scene = useApp((s) => s.scene)
  const file = useApp((s) => s.file)
  if (scene.state !== 'loading' && scene.state !== 'error') return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="w-[300px] rounded-[10px] border px-[16px] py-[14px]" style={{ borderColor: 'var(--studio-chrome-border)', backgroundColor: 'var(--studio-chrome-surface-raised)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-[10px] text-[13px] font-medium">
          {scene.state === 'loading' && <span className="spin inline-block h-[11px] w-[11px] rounded-full border-[1.5px] border-black border-t-transparent" />}
          {scene.state === 'loading' ? 'Reading the assembly' : 'Could not open it'}
        </div>
        <div className="mt-[6px] text-[12px] leading-[16px]" style={{ color: '#8a8a8a' }}>
          {scene.state === 'error' ? scene.error : `${file}: the first open reads and meshes every face, the big lathe takes about 15 s.`}
        </div>
      </div>
    </div>
  )
}

// the canvas's own bar, bottom centre: frame, x-ray, ghosts
function ViewBar() {
  const xray = useApp((s) => s.xray)
  const ghosts = useApp((s) => s.ghosts)
  const ready = useApp((s) => s.scene.state === 'ready')
  if (!ready) return null
  const item = 'flex h-full items-center gap-[7px] px-[12px] font-[var(--font-text)] text-[12px] leading-none transition-colors hover:bg-[var(--studio-chrome-hover)]'
  return (
    <div className="absolute bottom-[18px] left-1/2 flex h-[32px] -translate-x-1/2 items-stretch overflow-hidden rounded-[8px] border" style={{ borderColor: 'var(--studio-chrome-border)', backgroundColor: 'var(--studio-chrome-surface)', boxShadow: 'var(--studio-chrome-shadow)' }}>
      <button type="button" onClick={focusAll} className={item} style={{ color: 'var(--studio-chrome-text)' }}>
        <Crosshairs className="h-[12px] w-[12px]" />Frame
      </button>
      <button type="button" onClick={() => setView({ xray: !xray })} className={cn(item, 'border-l')} style={{ borderColor: 'var(--studio-chrome-border)', color: xray ? 'var(--studio-chrome-text)' : '#8a8a8a', backgroundColor: xray ? 'var(--studio-chrome-surface-raised)' : undefined }}>
        <Layers className="h-[12px] w-[12px]" />X-ray
      </button>
      <button type="button" onClick={() => setView({ ghosts: !ghosts })} className={cn(item, 'border-l')} style={{ borderColor: 'var(--studio-chrome-border)', color: ghosts ? 'var(--studio-chrome-text)' : '#8a8a8a', backgroundColor: ghosts ? 'var(--studio-chrome-surface-raised)' : undefined }}>
        <EyeOpen className="h-[12px] w-[12px]" />Ghosts
      </button>
    </div>
  )
}

export function App() {
  useEffect(() => { boot() }, [])
  return (
    <div className="relative h-full w-full font-[var(--font-text)]" style={{ backgroundColor: '#ffffff' }}>
      <div className="grid h-full min-h-0 w-full overflow-hidden px-[20px] pt-[20px]" style={{ gridTemplateColumns: '264px minmax(0,1fr) 336px', gridTemplateRows: '35px 18px minmax(0,1fr)' }}>
        <div className="relative z-40 col-span-2 row-start-1 min-w-0 pr-[20px]"><TopBar /></div>
        <aside className="relative z-20 col-start-1 row-start-3 flex min-h-0 flex-col pb-[20px] pr-[16px]"><Tree /></aside>
        <main className="relative col-start-2 row-start-3 min-h-0 min-w-0 overflow-hidden rounded-t-[10px]" style={{ background: 'radial-gradient(120% 90% at 50% 40%, #ffffff 0%, #f4f5f7 70%, #eceef1 100%)' }}>
          <Viewport />
          <Loading />
          <ViewBar />
        </main>
        <aside className="relative z-20 col-start-3 row-span-3 row-start-1 min-h-0 pl-[20px]" style={{ marginTop: '-20px', height: 'calc(100% + 20px)', width: 'calc(100% + 20px)' }}>
          <Inspector />
        </aside>
      </div>
      <Tip />
    </div>
  )
}
