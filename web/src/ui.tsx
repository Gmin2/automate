import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Fails, Guessed, Holds, Link, Plus } from './icons'

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

const text = 'var(--studio-chrome-text)'
const card = { borderColor: 'var(--studio-chrome-border)', backgroundColor: 'var(--studio-chrome-surface-raised)' }

// cards that belong together share their borders: the first loses its bottom corners, the next ones move up 1px
export function joined(i: number, n: number) {
  if (n < 2) return ''
  return i === 0 ? 'rounded-b-none' : i === n - 1 ? '-mt-px rounded-t-none' : '-mt-px rounded-none'
}

// a section's mark: an icon of what the section is about, dark while open
export function Section({ title, icon: I, defaultOpen = true, disabled, aside, children }: { title: string; icon?: (p: { className?: string }) => ReactNode; defaultOpen?: boolean; disabled?: boolean; aside?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const shown = open && !disabled
  return (
    <div data-state={shown ? 'open' : 'closed'} className="overflow-hidden rounded-[8px] border" style={{ borderColor: 'var(--studio-chrome-border)', backgroundColor: 'var(--studio-chrome-surface)' }}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={shown}
        onClick={() => setOpen(!open)}
        data-state={shown ? 'open' : 'closed'}
        className={cn('group flex h-[31px] w-full items-center justify-between px-[18px] text-left transition-colors', disabled && 'cursor-default opacity-55')}
        style={{ backgroundColor: 'var(--studio-chrome-surface-subtle)' }}
      >
        <span className="font-[var(--font-text)] text-[13px] font-medium leading-none" style={{ color: text }}>{title}</span>
        {aside && <span className="ml-auto mr-[10px] font-[var(--font-mono)] text-[10px] leading-none" style={{ color: 'var(--studio-chrome-muted-soft)' }}>{aside}</span>}
        {I
          ? <span className="inline-flex h-[16px] w-[16px] text-[var(--studio-chrome-muted)] transition-colors group-hover:text-[var(--studio-chrome-icon-idle)] group-data-[state=open]:text-[var(--studio-chrome-icon-idle)]"><I className="h-full w-full" /></span>
          : <span className="h-2 w-2 rounded-full border bg-transparent transition-colors group-data-[state=open]:bg-[var(--studio-chrome-muted)]" style={{ borderColor: 'var(--studio-chrome-muted)' }} />}
      </button>
      {shown && <div className="px-[9px] pb-[16px] pt-[12px]"><div className="section-body space-y-2">{children}</div></div>}
    </div>
  )
}

export const Sub = ({ children, first }: { children: ReactNode; first?: boolean }) => (
  <div className={cn('px-[2px] font-[var(--font-text)] text-[12px] font-normal leading-none', !first && 'pt-1')} style={{ color: text }}>{children}</div>
)

const pct = (v: number, min: number, max: number) => Math.max(0, Math.min(100, Math.round(((v - min) / (max - min)) * 100)))

function snap(v: number, min: number, max: number, step: number) {
  const places = (String(step).split('.')[1] ?? '').length
  const s = Math.round((v - min) / step) * step + min
  return Number(Math.max(min, Math.min(max, s)).toFixed(places))
}

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  disabled?: boolean
  className?: string
  link?: { on: boolean; toggle: () => void; title?: string }
  // the value as it reads (33.0 mm); the percent of the range when not given
  shown?: (v: number) => string
  // a word over the label, small and grey
  sub?: string
  // room on the left for a pair's line
  indent?: boolean
  // called once when the drag or key press ends (an edit that is one undo step); onChange then only follows the thumb
  onCommit?: (v: number) => void
}

// the tick slider: 1px ticks every 6px, a 14x28 black thumb, the value shown as the percent of its range
export function Slider({ label, value, min, max, step, onChange, disabled, className, link, shown, sub, indent, onCommit }: SliderProps) {
  const moduleRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const [local, setLocal] = useState<number | null>(null)
  const [active, setActive] = useState(false)
  const [hl, setHl] = useState(14)
  const pending = useRef<number | null>(null)
  const frame = useRef(0)
  const v = local ?? value
  const p = pct(v, min, max)

  const flush = () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    if (pending.current !== null) onChange(pending.current)
    pending.current = null
  }
  const push = (n: number) => {
    setLocal(n)
    pending.current = n
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; if (pending.current !== null) onChange(pending.current); pending.current = null })
  }

  useLayoutEffect(() => {
    const m = moduleRef.current, t = trackRef.current
    if (!m || !t) return
    const mr = m.getBoundingClientRect(), tr = t.getBoundingClientRect()
    const start = tr.left - mr.left
    setHl(Math.max(14, Math.min(start + 14 + (p / 100) * (tr.width - 14), mr.width - 6)))
  }, [p, active])

  const fromPointer = (x: number) => {
    const r = rootRef.current!.getBoundingClientRect()
    return snap(min + ((x - r.left) / r.width) * (max - min), min, max, step)
  }

  const down = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    rootRef.current!.setPointerCapture(e.pointerId)
    thumbRef.current?.focus()
    setActive(true)
    push(fromPointer(e.clientX))
  }
  const moveTo = (e: React.PointerEvent) => { if (active) push(fromPointer(e.clientX)) }
  const up = () => {
    if (!active) return
    const last = pending.current ?? local
    flush()
    setActive(false)
    setLocal(null)
    if (onCommit && last !== null) onCommit(last)
  }

  const key = (e: React.KeyboardEvent) => {
    if (disabled) return
    const big = step * 10
    const by: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big }
    let n: number | null = null
    if (e.key in by) n = v + (e.shiftKey && e.key.startsWith('Arrow') ? Math.sign(by[e.key]!) * big : by[e.key]!)
    if (e.key === 'Home') n = min
    if (e.key === 'End') n = max
    if (n === null) return
    e.preventDefault()
    onChange(snap(n, min, max, step))
    onCommit?.(snap(n, min, max, step))
  }

  // radix keeps the thumb inside the track: half its width in at 0, half its width back at 100
  const inBounds = 7 - (p / 50) * 7

  return (
    <div ref={moduleRef} className={cn('relative flex items-center overflow-hidden rounded-[8px] border px-[11px] py-[8px]', sub ? 'h-[50px]' : 'h-[40px]', disabled && 'opacity-60', className)} style={card}>
      <div
        className={cn('pointer-events-none absolute rounded-bl-[5px] rounded-br-[4px] rounded-tl-[5px] rounded-tr-[4px] transition-[width,opacity] ease-out', active ? 'opacity-100' : 'opacity-0')}
        style={{ left: '3px', top: '3px', bottom: '3px', width: `${hl}px`, transitionDuration: active ? '200ms, 200ms' : '200ms, 700ms', backgroundColor: 'var(--studio-chrome-highlight)' }}
      />
      <div className="relative z-[1] flex w-full items-center">
        {link && (
          <button
            type="button"
            aria-pressed={link.on}
            title={link.title ?? (link.on ? 'Unlink' : 'Link')}
            onClick={link.toggle}
            disabled={disabled}
            className={cn('flex size-[20px] shrink-0 items-center justify-center transition-opacity', link.on ? 'opacity-100' : 'opacity-95 hover:opacity-100', disabled && 'cursor-not-allowed opacity-50')}
          >
            <Link on={link.on} className="h-[19px] w-[19px]" />
          </button>
        )}
        <span className={cn('flex shrink-0 flex-col gap-[3px] font-[var(--font-text)] text-[12px] font-normal leading-none', link ? 'ml-[6px] w-[61px]' : 'w-[64px]', indent && 'pl-[18px]')} style={{ color: text }}>
          {sub && <span className="text-[10px]" style={{ color: 'var(--studio-chrome-muted)' }}>{sub}</span>}
          <span className="truncate">{label}</span>
        </span>
        <div
          ref={rootRef}
          className="relative ml-[6px] flex h-[30px] touch-none select-none items-center"
          style={{ width: `calc(100% - ${(link ? 104 : 98) + (shown ? 26 : 0) + (indent ? 18 : 0)}px)` }}
          onPointerDown={down}
          onPointerMove={moveTo}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <div ref={trackRef} className="relative h-[20px] w-full overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(to right, var(--studio-chrome-border) 0, var(--studio-chrome-border) 1px, transparent 1px, transparent 6px)' }} />
            {active && (
              <div
                className="pointer-events-none absolute inset-y-0 transition-[left,width] duration-75"
                style={{ left: '0%', width: `${p}%`, backgroundImage: 'repeating-linear-gradient(to right, var(--studio-chrome-muted) 0, var(--studio-chrome-muted) 1px, transparent 1px, transparent 6px)' }}
              />
            )}
          </div>
          <div className="absolute" style={{ left: `calc(${p}% + ${inBounds}px)`, transform: 'translateX(-50%)' }}>
            <div
              ref={thumbRef}
              role="slider"
              aria-label={label}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={v}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={key}
              onBlur={flush}
              className="block h-[28px] w-[14px] cursor-pointer rounded-[3px] border transition-transform focus:outline-none"
              style={{ borderColor: text, backgroundColor: text }}
            />
          </div>
        </div>
        <span className={cn('ml-[6px] shrink-0 whitespace-nowrap text-right font-[var(--font-mono)] text-[10px] font-normal leading-none tracking-[0.2px]', shown ? 'w-[50px]' : 'w-[24px]')} style={{ color: text, fontFamily: 'var(--font-mono)' }}>{shown ? shown(v) : p}</span>
      </div>
    </div>
  )
}

// two sliders that move together: a blue line in the label column from a dot on
// the first to the second, the rows sharing their borders. unlinked, the line is not drawn
export function Pair({ linked, children }: { linked: boolean; children: [ReactNode, ReactNode] }) {
  return (
    <div className="relative">
      <div className="[&>*:first-child]:rounded-b-none [&>*:last-child]:-mt-px [&>*:last-child]:rounded-t-none">{children}</div>
      <div aria-hidden className={cn('pointer-events-none absolute left-[13px] top-[19px] flex flex-col items-center transition-opacity duration-200', linked ? 'opacity-100' : 'opacity-0')} style={{ height: 'calc(50% + 6px)' }}>
        <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ backgroundColor: 'var(--studio-link, #1f3dff)' }} />
        <span className="w-[2px] flex-1" style={{ backgroundColor: 'var(--studio-link, #1f3dff)' }} />
      </div>
    </div>
  )
}

export function Toggle({ label, checked, onChange, disabled, className }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; className?: string }) {
  return (
    <label className={cn('flex h-[40px] cursor-pointer items-center justify-between rounded-[8px] border px-[11px] py-[8px]', disabled && 'opacity-60', className)} style={card}>
      <span className="font-[var(--font-text)] text-[12px] font-normal leading-none" style={{ color: text }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="peer inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center rounded-full border shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: 'var(--studio-chrome-border)', backgroundColor: 'var(--studio-chrome-surface)' }}
      >
        <span
          data-state={checked ? 'checked' : 'unchecked'}
          className="pointer-events-none block h-[14px] w-[14px] rounded-full bg-[#bdbdbd] shadow-none ring-0 transition-transform data-[state=checked]:translate-x-[20px] data-[state=checked]:bg-[#ff7a00] data-[state=unchecked]:translate-x-[2px]"
        />
      </button>
    </label>
  )
}

// what a toggle shows when it is on: grid rows from 0fr to 1fr, the children dropping in 16ms apart
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      aria-hidden={!open}
      data-state={open ? 'open' : 'closed'}
      className={cn('toggle-reveal-stack grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0.85,0.2,1)] motion-reduce:transition-none', open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0')}
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className={cn('toggle-reveal-content min-h-0 transition-transform duration-300 ease-[cubic-bezier(0.2,0.85,0.2,1)] motion-reduce:transition-none', open ? 'translate-y-0' : '-translate-y-1')}>{children}</div>
    </div>
  )
}

function useOutside(open: boolean, close: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { if (!refs.some((r) => r.current?.contains(e.target as Node))) close() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', esc, true) }
  }, [open])
}

export function Select<T extends string>({ label, value, options, onChange, disabled, className }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ left: number; top: number; width: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [hot, setHot] = useState(0)
  useOutside(open, () => setOpen(false), [trigger, content])
  const current = options.find((o) => o.value === value)

  // item aligned, as radix does by default: the list sits over the trigger with the chosen item on the value
  useLayoutEffect(() => {
    if (!open || !content.current || !trigger.current) return
    const tr = trigger.current.getBoundingClientRect()
    const items = content.current.querySelectorAll<HTMLElement>('[role=option]')
    const sel = items[Math.max(0, options.findIndex((o) => o.value === value))]
    const off = sel ? sel.offsetTop + sel.offsetHeight / 2 : 0
    const h = content.current.offsetHeight
    const top = Math.max(8, Math.min(tr.top + tr.height / 2 - off, window.innerHeight - h - 8))
    setAt({ left: tr.left - 8, top, width: tr.width + 16 })
    content.current.focus()
  }, [open])

  const pick = (v: T) => { onChange(v); setOpen(false); trigger.current?.focus() }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHot((h) => Math.min(options.length - 1, h + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHot((h) => Math.max(0, h - 1)) }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(options[hot]!.value) }
  }

  return (
    <div className={cn('flex h-[40px] items-center rounded-[8px] border px-[11px] py-[8px]', disabled && 'opacity-60', className)} style={card}>
      <span className="w-[56px] shrink-0 font-[var(--font-text)] text-[12px] font-normal leading-none" style={{ color: text }}>{label}</span>
      <div className="ml-[6px] min-w-0 flex-1">
        <button
          ref={trigger}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => { setHot(Math.max(0, options.findIndex((o) => o.value === value))); setAt(null); setOpen(!open) }}
          onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAt(null); setOpen(true) } }}
          className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_24px] items-center gap-x-[6px] bg-transparent font-[var(--font-text)] text-[12px] font-normal leading-none transition-colors focus:outline-none focus-visible:outline-none"
          style={{ color: text }}
        >
          <span className="pointer-events-none col-start-1 block min-w-0 truncate text-center">{current?.label}</span>
          <span className="col-start-2 inline-flex h-[14px] w-[14px] items-center justify-center justify-self-end" style={{ color: 'var(--studio-chrome-muted)' }}>
            <Plus className="h-[14px] w-[14px]" />
          </span>
        </button>
        {open && createPortal(
          <div
            ref={content}
            role="listbox"
            tabIndex={-1}
            onKeyDown={key}
            className="fixed z-50 overflow-hidden rounded-[8px] border shadow-md outline-none"
            style={{ borderColor: 'var(--studio-chrome-border)', backgroundColor: 'var(--studio-chrome-surface-raised)', color: text, left: at?.left ?? -9999, top: at?.top ?? -9999, minWidth: at?.width }}
          >
            <div className="p-1">
              {options.map((o, i) => (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  onPointerEnter={() => setHot(i)}
                  onClick={() => pick(o.value)}
                  className="relative flex cursor-pointer select-none items-center rounded px-6 py-[6px] font-[var(--font-text)] text-[12px] font-normal outline-none"
                  style={{ color: text }}
                >
                  {o.value === value && <span className="absolute left-1.5 block size-[6px] rounded-full" style={{ backgroundColor: text }} />}
                  {o.label}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
      </div>
    </div>
  )
}

// a fact in a card, the way the select and colour rows lay out theirs: the label, the value centred, a mark on the right
export function Row({ label, value, mark, className, title, onClick }: { label: string; value: ReactNode; mark?: ReactNode; className?: string; title?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} title={title} className={cn('flex h-[40px] w-full items-center rounded-[8px] border px-[11px] py-[8px] text-left', onClick && 'cursor-pointer', className)} style={card}>
      <span className="w-[56px] shrink-0 font-[var(--font-text)] text-[12px] font-normal leading-none" style={{ color: text }}>{label}</span>
      <span className="ml-[6px] grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_24px] items-center gap-x-[6px]">
        <span className="min-w-0 truncate text-center font-[var(--font-text)] text-[12px] font-normal leading-none" style={{ color: text }}>{value}</span>
        <span className="inline-flex justify-self-end">{mark}</span>
      </span>
    </Tag>
  )
}

// words in a card: what was asked, why a part is there
export function Note({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div className={cn('rounded-[8px] border px-[11px] py-[11px]', className)} style={card}>
      {label && <div className="mb-[6px] font-[var(--font-text)] text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--studio-chrome-muted)' }}>{label}</div>}
      <div className="font-[var(--font-text)] text-[12px] font-normal leading-[1.45]" style={{ color: text }}>{children}</div>
    </div>
  )
}

// the mark a row ends with: a tick when it holds, a question when it is a guess, a cross when it fails,
// nothing when it is not known
const MARKS = { pass: [Holds, 'holds'], guess: [Guessed, 'a guess'], fail: [Fails, 'fails'] } as const
export function Mark({ is }: { is: 'pass' | 'guess' | 'fail' | 'none' }) {
  if (is === 'none') return null
  const [I, what] = MARKS[is]
  return <span title={what} className="inline-flex h-[14px] w-[14px]" style={{ color: is === 'fail' ? text : 'var(--studio-chrome-icon-idle)' }}><I className="h-full w-full" /></span>
}

// a fact too long for one line: the label, then the words wrapped beside it
export function Line({ label, children, mark, title }: { label: string; children: ReactNode; mark?: ReactNode; title?: string }) {
  return (
    <div title={title} className="flex min-h-[40px] w-full items-start rounded-[8px] border px-[11px] py-[12px]" style={card}>
      <span className="w-[56px] shrink-0 truncate pt-[1px] font-[var(--font-text)] text-[12px] font-normal leading-[14px]" style={{ color: text }}>{label}</span>
      <span className="ml-[6px] min-w-0 flex-1 font-[var(--font-text)] text-[12px] font-normal leading-[16px]" style={{ color: text }}>{children}</span>
      {mark && <span className="ml-[6px] inline-flex w-[24px] shrink-0 justify-end pt-[1px]">{mark}</span>}
    </div>
  )
}

// a card that opens beside what is hovered (a row, an icon, an edge), outside any column that clips: it slides in
// from that side, stays while the pointer is on it or on its anchor, and goes a moment after the pointer leaves both
export function Flyout({ anchor, children, side = 'right', delay = 0, interactive = false, onClose }: {
  anchor: HTMLElement | null
  children: ReactNode
  side?: 'right' | 'left'
  delay?: number
  interactive?: boolean
  onClose?: () => void
}) {
  const [shown, setShown] = useState<{ at: { left: number; top: number } } | null>(null)
  const [on, setOn] = useState(false)
  const over = useRef(false)
  const card = useRef<HTMLDivElement>(null)
  const timer = useRef(0)
  // what the card says follows its children as they change; when it opens and closes follows the anchor only
  const body = useRef(children)
  if (anchor) body.current = children
  const where = (h: number) => {
    const r = anchor!.getBoundingClientRect()
    return { left: side === 'right' ? r.right + 10 : r.left - 10, top: Math.max(8, Math.min(r.top + r.height / 2 - (interactive ? 24 : h / 2), window.innerHeight - h - 8)) }
  }
  useLayoutEffect(() => {
    clearTimeout(timer.current)
    if (!anchor) {
      // the pointer may be on its way into the card: wait a moment before it goes
      timer.current = window.setTimeout(() => { if (!over.current) { setOn(false); onClose?.() } }, interactive ? 160 : 0)
      return
    }
    const place = () => { setShown({ at: where(card.current?.offsetHeight ?? 0) }); setOn(true) }
    if (delay && !on) timer.current = window.setTimeout(place, delay)
    else place()
  }, [anchor])
  useEffect(() => () => clearTimeout(timer.current), [])
  // the card's height is known once drawn: keep it on screen
  useLayoutEffect(() => {
    if (!shown || !card.current || !anchor) return
    const at = where(card.current.offsetHeight)
    if (Math.abs(at.top - shown.at.top) > 1) setShown({ at })
  }, [shown])
  if (!shown) return null
  return createPortal(
    <div
      ref={card}
      onPointerEnter={() => { over.current = true; clearTimeout(timer.current) }}
      onPointerLeave={() => { over.current = false; timer.current = window.setTimeout(() => { setOn(false); onClose?.() }, 120) }}
      className={cn('fixed z-50 transition-[opacity,transform] duration-150 ease-out', interactive && on ? 'pointer-events-auto' : 'pointer-events-none', on ? 'translate-x-0 opacity-100' : side === 'right' ? '-translate-x-[4px] opacity-0' : 'translate-x-[4px] opacity-0')}
      style={{ left: side === 'right' ? shown.at.left : undefined, right: side === 'left' ? window.innerWidth - shown.at.left : undefined, top: shown.at.top }}
    >
      {body.current}
    </div>,
    document.body,
  )
}

// the card a flyout holds: white, a hairline, the soft shadow
export function FlyCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[10px] border', className)} style={{ borderColor: 'var(--studio-chrome-border)', backgroundColor: 'var(--studio-chrome-surface-raised)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.04)' }}>
      {children}
    </div>
  )
}

// a short dark tag, for a name or a key: what an icon or an edge does
export function DarkTag({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex items-center gap-[8px] whitespace-nowrap rounded-[6px] px-[10px] py-[6px] font-[var(--font-text)] text-[12px] leading-none text-white" style={{ backgroundColor: 'var(--studio-chrome-active-surface)', boxShadow: 'var(--studio-chrome-shadow)' }}>
      {children}
    </div>
  )
}

export const Key = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[4px] px-[4px] font-[var(--font-mono)] text-[10px] leading-none" style={{ backgroundColor: 'rgba(255,255,255,0.16)', fontFamily: 'var(--font-mono)' }}>{children}</span>
)
