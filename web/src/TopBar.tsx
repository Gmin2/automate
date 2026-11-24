import { useLayoutEffect, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Bolt, Folder, Holds } from './icons'
import { open, run, useApp } from './store'
import { cn } from './ui'

const text = 'var(--studio-chrome-text)'
const border = { borderColor: 'var(--studio-chrome-border)' }

function FilePicker() {
  const files = useApp((s) => s.files)
  const file = useApp((s) => s.file)
  const [on, setOn] = useState(false)
  const [at, setAt] = useState<{ left: number; top: number; width: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!on || !trigger.current) return
    const r = trigger.current.getBoundingClientRect()
    setAt({ left: r.left, top: r.bottom + 6, width: Math.max(r.width, 300) })
  }, [on])

  useEffect(() => {
    if (!on) return
    const down = (e: PointerEvent) => {
      if (![trigger, list].some((r) => r.current?.contains(e.target as Node))) setOn(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOn(false)
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('keydown', esc, true)
    }
  }, [on])

  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOn(!on)} className="grid h-full w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[10px] px-[14px] transition-colors hover:bg-[var(--studio-chrome-hover)]">
        <span className="inline-flex h-[13px] w-[13px]" style={{ color: 'var(--studio-chrome-icon-idle)' }}><Folder className="h-full w-full" /></span>
        <span className="truncate text-center font-[var(--font-text)] text-[12px] leading-none" style={{ color: text }}>{file ?? 'no file'}</span>
        <span className="font-[var(--font-mono)] text-[10px] leading-none" style={{ color: 'var(--studio-chrome-muted)' }}>{files.length}</span>
      </button>
      {on && createPortal(
        <div ref={list} role="listbox" className="fixed z-50 overflow-hidden rounded-[10px] border p-1" style={{ ...border, left: at?.left ?? -9999, top: at?.top ?? -9999, minWidth: at?.width, backgroundColor: 'var(--studio-chrome-surface-raised)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.04)' }}>
          <div className="px-[10px] pb-[6px] pt-[8px] font-[var(--font-text)] text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--studio-chrome-muted)' }}>assemblies</div>
          {files.map((f) => (
            <div
              key={f.name}
              role="option"
              aria-selected={f.name === file}
              onClick={() => { setOn(false); if (f.name !== file) open(f.name) }}
              className="relative flex cursor-pointer select-none items-center gap-[10px] rounded-[6px] py-[7px] pl-6 pr-[10px] font-[var(--font-text)] text-[12px] transition-colors hover:bg-[var(--studio-chrome-hover)]"
              style={{ color: text }}
            >
              {f.name === file && <span className="absolute left-2 block size-[6px] rounded-full" style={{ backgroundColor: text }} />}
              <span className="flex-1 truncate">{f.name}</span>
              <span className="font-[var(--font-mono)] text-[10px]" style={{ color: 'var(--studio-chrome-muted-soft)' }}>{f.loaded ? 'open' : ''}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

function Status() {
  const scene = useApp((s) => s.scene)
  const running = useApp((s) => s.running)
  const result = useApp((s) => s.result)
  let words = ''
  if (scene.state === 'loading') words = 'reading the step file'
  else if (scene.state === 'error') words = 'could not read it'
  else if (scene.state === 'ready') {
    const faces = Object.values(scene.data.parts).reduce((n, p) => n + p.nfaces, 0)
    words = `${scene.data.instances.length} parts · ${faces.toLocaleString()} faces`
  }
  if (running) words = 'matching'
  else if (result) words = `${result.matches.length} ${result.matches.length === 1 ? 'match' : 'matches'} · ${result.seconds}s`
  return (
    <div className="flex h-full min-w-0 items-center justify-center gap-[8px] px-[14px] font-[var(--font-text)] text-[12px] leading-none" style={{ color: scene.state === 'error' ? 'var(--fit-interference)' : text }}>
      {(running || scene.state === 'loading') && <span className="spin inline-block h-[10px] w-[10px] rounded-full border-[1.5px] border-t-transparent" style={{ borderColor: 'var(--studio-chrome-icon-idle)', borderTopColor: 'transparent' }} />}
      <span className="truncate">{words}</span>
    </div>
  )
}

export function TopBar() {
  const ready = useApp((s) => s.selection.faces.length > 0 && !s.running)
  const done = useApp((s) => !!s.result)
  return (
    <div className="grid h-[35px] w-full min-w-0 grid-cols-[max-content_minmax(180px,300px)_minmax(0,1fr)_128px] items-stretch overflow-hidden rounded-[8px] border" style={{ ...border, backgroundColor: 'var(--studio-chrome-surface)' }}>
      <div className="flex h-full items-center gap-[10px] px-[18px]">
        <span className="inline-flex h-[14px] w-[14px]" style={{ color: 'var(--studio-chrome-icon-idle)' }}><Bolt className="h-full w-full" /></span>
        <span className="text-[16px] font-normal leading-none tracking-[0.02em]" style={{ fontFamily: 'var(--font-display)', color: text }}>AUTOMATE™</span>
      </div>
      <div className="h-full min-w-0 border-l" style={border}><FilePicker /></div>
      <div className="h-full min-w-0 border-l" style={border}><Status /></div>
      <div className="h-full border-l" style={border}>
        <button
          type="button"
          disabled={!ready}
          onClick={run}
          className={cn('flex h-full w-full items-center justify-between px-[15px] font-[var(--font-text)] text-[13px] font-medium leading-none transition-colors disabled:cursor-not-allowed', ready ? 'text-black hover:bg-[#38dd64]' : 'text-[var(--studio-chrome-icon-muted)]')}
        >
          <span>{done ? 'Search again' : 'Find mates'}</span>
          <Holds className="h-[12px] w-[12px]" />
        </button>
      </div>
    </div>
  )
}
