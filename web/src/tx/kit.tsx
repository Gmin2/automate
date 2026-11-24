// transit design kit (React 19, motion/react, sonner). Glyph comes from glyphs.tsx beside it

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Glyph, type GlyphName } from './glyphs'

// the pieces of the look: pills, round buttons, the bar of tools with its tips, cards with a
// pager, the modal of tiles, menus, toasts, and the small click every press makes

// a click: a few ms of noise through a band pass, so quiet it is felt more than heard
let audio: AudioContext | null = null
let muted = false
export function setMuted(m: boolean) { muted = m }
export function tick({ pitch = 3400, gain = 0.06, ms = 12 }: { pitch?: number; gain?: number; ms?: number } = {}) {
  if (muted || typeof window === 'undefined') return
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const now = audio.currentTime
    const len = Math.max(16, Math.floor((audio.sampleRate * ms) / 1000))
    const buf = audio.createBuffer(1, len, audio.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.06))
    const src = audio.createBufferSource()
    src.buffer = buf
    const band = audio.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = pitch
    band.Q.value = 3
    const amp = audio.createGain()
    amp.gain.setValueAtTime(gain, now)
    amp.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
    src.connect(band).connect(amp).connect(audio.destination)
    src.start(now)
    src.stop(now + ms / 1000)
  } catch { /* no audio here */ }
}

type Press = { onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean | undefined }

export function Pill({ icon, children, on, open, primary, count, warn, caret, tip, onClick, disabled, className, ...rest }: Press & {
  icon?: GlyphName; children?: ReactNode; on?: boolean | undefined; open?: boolean | undefined; primary?: boolean; count?: number | undefined; warn?: boolean; caret?: boolean; tip?: string; className?: string
} & { 'data-a'?: string; 'aria-label'?: string }) {
  return (
    <button type="button" className={`tx-pill${primary ? ' tx-pill--primary' : ''}${className ? ` ${className}` : ''}`} aria-pressed={on} aria-expanded={open} aria-haspopup={caret ? 'menu' : undefined} data-tip={tip} disabled={disabled}
      onClick={(e) => { tick(); onClick?.(e) }} {...rest}>
      {icon && <Glyph name={icon} size={16} />}
      {children}
      {count != null && count > 0 && <span className="tx-pill__count" data-tone={warn ? 'warn' : undefined}>{count}</span>}
      {caret && <Glyph name="down" size={14} className="tx-pill__caret" />}
    </button>
  )
}

export function Round({ icon, size = 34, soft, on, open, tip, label, onClick, disabled, iconSize, className, style }: Press & {
  icon: GlyphName; size?: 34 | 28 | 24 | 22; soft?: boolean; on?: boolean | undefined; open?: boolean | undefined; tip?: string; label: string; iconSize?: number; className?: string; style?: CSSProperties
}) {
  return (
    <button type="button" className={`tx-round${soft ? ' tx-round--soft' : ''}${size !== 34 ? ` tx-round--${size}` : ''}${className ? ` ${className}` : ''}`} aria-label={label} aria-pressed={on} aria-expanded={open} data-tip={tip} disabled={disabled} style={style}
      onClick={(e) => { tick(); onClick?.(e) }}>
      <Glyph name={icon} size={iconSize ?? (size >= 34 ? 16 : size >= 28 ? 13 : 12)} />
    </button>
  )
}

// a tool in the bar at the foot: its tip rises after a beat, with its key
export function Tool({ icon, label, shortcut, on, onClick, disabled }: Press & { icon: GlyphName; label: string; shortcut?: string | undefined; on?: boolean | undefined }) {
  const [tip, setTip] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
  useEffect(() => () => { if (t.current) clearTimeout(t.current) }, [])
  return (
    <div className="tx-tool">
      <button type="button" aria-label={label} aria-pressed={on} disabled={disabled}
        onMouseEnter={() => { if (hover) t.current = setTimeout(() => setTip(true), 150) }}
        onMouseLeave={() => { if (t.current) clearTimeout(t.current); setTip(false) }}
        onClick={(e) => { tick(); setTip(false); onClick?.(e) }}>
        <Glyph name={icon} size={20} />
      </button>
      {tip && <div className="tx-tool__tip" data-key={shortcut ? '' : undefined}>{label}{shortcut && <span className="tx-key">{shortcut}</span>}</div>}
    </div>
  )
}

export function Bar({ children, label }: { children: ReactNode; label: string }) {
  return <div className="tx-bar" role="toolbar" aria-label={label}>{children}</div>
}
export const Rule = () => <span className="tx-bar__rule" />

// a row of views as one pill, the mark sliding under the one that is on
export function Segments<T extends string>({ items, at, onPick, disabled, layoutId }: { items: { id: T; label: string; icon: GlyphName }[]; at: T | null; onPick: (id: T) => void; disabled?: boolean; layoutId: string }) {
  return (
    <div className="tx-seg" role="tablist">
      {items.map((it) => {
        const on = it.id === at
        return (
          <button key={it.id} type="button" role="tab" className="tx-seg__item" aria-pressed={on} aria-selected={on} disabled={disabled} data-a={`view-${it.id}`} onClick={() => { tick(); onPick(it.id) }}>
            {on && <motion.span layoutId={layoutId} className="tx-seg__mark" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <Glyph name={it.icon} size={15} />
            <span style={{ whiteSpace: 'nowrap' }}>{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Card({ title, note, extra, foot, children, className, style, bodyClass }: { title?: ReactNode; note?: ReactNode; extra?: ReactNode; foot?: ReactNode; children?: ReactNode; className?: string; style?: CSSProperties; bodyClass?: string }) {
  return (
    <section className={`tx-card${className ? ` ${className}` : ''}`} style={style}>
      {(title || extra) && (
        <header className="tx-card__head">
          <span className="tx-card__title">{title}</span>
          {note != null && <span className="tx-card__note">{note}</span>}
          {extra}
        </header>
      )}
      <div className={`tx-card__body${bodyClass ? ` ${bodyClass}` : ''}`}>{children}</div>
      {foot && <footer className="tx-card__foot">{foot}</footer>}
    </section>
  )
}

// dots for the pages of a card, the one at stretched into a bar, and the arrows that turn them
export function Pager({ count, at, onAt }: { count: number; at: number; onAt: (n: number) => void }) {
  if (count < 2) return null
  return (
    <div className="tx-pager">
      <div className="tx-pager__dots">
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" className="tx-pager__dot" aria-label={`Page ${i + 1}`} aria-current={i === at} onClick={() => { tick(); onAt(i) }} />
        ))}
      </div>
      <div className="tx-pager__arrows">
        <Round icon="left" size={24} soft label="Back" onClick={() => onAt((at - 1 + count) % count)} />
        <Round icon="right" size={24} soft label="Next" onClick={() => onAt((at + 1) % count)} />
      </div>
    </div>
  )
}

export function Modal({ title, chip, onClose, children }: { title: string; chip?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return createPortal(
    <div className="tx tx-modal" style={{ position: 'fixed', background: 'transparent' }} role="dialog" aria-modal aria-label={title}>
      <div className="tx-modal__scrim" onClick={onClose} />
      <div className="tx-modal__panel">
        <header className="tx-modal__head">
          <span className="tx-modal__title">{title}{chip != null && <span className="tx-chip">{chip}</span>}</span>
          <Round icon="close" size={28} soft label="Close" iconSize={13} onClick={onClose} />
        </header>
        <div className="tx-modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tx-modal__section">
      <div className="tx-group-label">{label}</div>
      {children}
    </div>
  )
}

// a tile: its little picture, its name, and a dot of its colour while it is on
export function Tile({ label, on, colour, art, onClick, disabled }: { label: string; on: boolean; colour: string; art: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="tx-tile" aria-pressed={on} disabled={disabled} style={{ '--tx-tile-on': mix(colour, 255, 0.32), '--tx-dot': colour } as CSSProperties} onClick={() => { tick(); onClick() }}>
      <div className="tx-tile__art">{art}</div>
      <div className="tx-tile__label">{label}{on && <span className="tx-dot tx-dot--glow" />}</div>
    </button>
  )
}

// a colour pulled toward white (255) or black (0) by t, for the tile's border as transit tints its own
export function mix(hex: string, to: number, t: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t))
  return `rgb(${c.join(',')})`
}

export type MenuItem = { label: string; sub?: string; icon?: GlyphName; on?: () => void; off?: boolean } | 'rule'
export type MenuAt = { title?: string; items: MenuItem[]; x: number; y: number; right?: boolean }

// a menu dropped from a pill, kept on screen
export function Menu({ menu, onClose }: { menu: MenuAt; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [nudge, setNudge] = useState(0)
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (r && r.right > window.innerWidth - 8) setNudge(window.innerWidth - 8 - r.right)
  }, [menu])
  useEffect(() => {
    const off = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest('[aria-haspopup]')) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('pointerdown', off)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', off); window.removeEventListener('keydown', key) }
  }, [onClose])
  const style: CSSProperties = menu.right ? { right: menu.x, top: menu.y, transformOrigin: 'top right' } : { left: menu.x + nudge, top: menu.y }
  return (
    <div ref={ref} className="tx-menu" role="menu" style={style}>
      {menu.title && <p className="tx-menu__title">{menu.title}</p>}
      {menu.items.map((it, i) => it === 'rule' ? <div key={`r${i}`} className="tx-menu__rule" /> : (
        <button key={`${it.label}${i}`} type="button" role="menuitem" className="tx-menu__row" disabled={it.off} onClick={() => { tick(); onClose(); it.on?.() }}>
          {it.icon && <Glyph name={it.icon} size={15} />}
          <span style={{ whiteSpace: 'nowrap' }}>{it.label}</span>
          {it.sub && <span style={{ marginLeft: 'auto', paddingLeft: 16, fontSize: 11.5, color: 'var(--tx-faint)', whiteSpace: 'nowrap', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</span>}
        </button>
      ))}
    </div>
  )
}

// a toast: a white pill at the foot, its icon by tone, gone after a while unless it warns
export function say(text: string, tone: 'ok' | 'info' | 'warn' = 'info') {
  const icon: GlyphName = tone === 'warn' ? 'warn' : tone === 'ok' ? 'okCircle' : 'info'
  const colour = tone === 'warn' ? '#ff8d28' : tone === 'ok' ? '#34c759' : '#858585'
  return toast.custom((id) => (
    <div className="tx-toast" role="status">
      <Glyph name={icon} size={15} style={{ color: colour }} />
      <span>{text}</span>
      {tone === 'warn' && <button type="button" className="tx-toast__close" aria-label="Dismiss" onClick={() => toast.dismiss(id)}><Glyph name="close" size={12} /></button>}
    </div>
  ), { duration: tone === 'warn' ? Infinity : 3200 })
}

// a slider the whole row wide, as a good hardware panel has it: the fill is a raised pill out to the value with the
// name inside it, the number at the right. drag anywhere on the row, or use the arrows; the value is said on release
export function FillSlider({ label, value, min, max, step = 1, unit, onInput, onCommit, dark }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onInput?: (v: number) => void; onCommit: (v: number) => void; dark?: boolean
}) {
  const [v, setV] = useState(value)
  const [drag, setDrag] = useState(false)
  // past either end the slider stretches toward the hand, less the further it goes, and springs back when let go
  const [pull, setPull] = useState(0)
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!drag) setV(value) }, [value, drag])
  const snap = (x: number) => Math.min(max, Math.max(min, Math.round((x - min) / step) * step + min))
  const at = (clientX: number) => {
    const r = row.current!.getBoundingClientRect()
    const w = r.width / (1 + Math.abs(pull) / 220)
    const left = pull < 0 ? r.right - w : r.left
    const over = clientX < left ? clientX - left : clientX > left + w ? clientX - (left + w) : 0
    setPull(Math.sign(over) * 14 * (1 - Math.exp(-Math.abs(over) / 60)))
    return snap(min + ((clientX - left) / w) * (max - min))
  }
  const put = (n: number) => { if (n !== v) { setV(n); onInput?.(n) } }
  const share = (v - min) / (max - min)
  const dp = step < 1 ? Math.min(2, String(step).split('.')[1]?.length ?? 1) : 0
  return (
    <div ref={row} className={`tx-slider${dark ? ' tx-slider--dark' : ''}`} style={{ transform: pull ? `scaleX(${1 + Math.abs(pull) / 220}) scaleY(${1 - Math.abs(pull) / 600})` : undefined, transformOrigin: pull < 0 ? 'right center' : 'left center' }} data-pull={pull ? true : undefined} data-drag={drag || undefined} data-empty={share <= 0.001 || undefined} role="slider" tabIndex={0}
      aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={v} aria-valuetext={`${v.toFixed(dp)}${unit ?? ''}`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); put(at(e.clientX)) }}
      onPointerMove={(e) => { if (drag) put(at(e.clientX)) }}
      onPointerUp={() => { setPull(0); if (drag) { setDrag(false); tick({ pitch: 2800, gain: 0.04 }); onCommit(v) } }}
      onKeyDown={(e) => {
        const k = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
        if (k) { e.preventDefault(); const n = snap(v + k * step * (e.shiftKey ? 10 : 1)); put(n); onCommit(n) }
        if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); const n = e.key === 'Home' ? min : max; put(n); onCommit(n) }
      }}>
      <span className="tx-slider__bar" style={{ width: share > 0.001 ? `max(26px, ${share * 100}%)` : 0 }} />
      <span className="tx-slider__label">{label}</span>
      <span className="tx-slider__value">{v.toFixed(dp)}{unit && <i>{unit}</i>}</span>
    </div>
  )
}
