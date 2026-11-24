// small control icons, outlines in currentColor

type P = { className?: string }

const tool = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const Plus = ({ className }: P) => (
  <svg viewBox="0 0 14 14" className={className} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
    <path d="M7 2v10M2 7h10" />
  </svg>
)

export const Link = ({ on, className }: P & { on: boolean }) => (
  <svg viewBox="0 0 19 19" className={className} fill="none">
    <circle cx="9.5" cy="9.5" r={on ? 9 : 9.5} fill={on ? '#0009ff' : '#f1f1f1'} stroke={on ? '#0009ff' : 'none'} />
    <g stroke={on ? '#fff' : '#000'} strokeWidth={1.1} strokeLinecap="round">
      <path d="M8 7.1H6.6a2.4 2.4 0 0 0 0 4.8H8M11 7.1h1.4a2.4 2.4 0 0 1 0 4.8H11M7.4 9.5h4.2" />
    </g>
  </svg>
)

export const Holds = ({ className }: P) => (
  <svg viewBox="0 0 14 14" className={className} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 7.3 5.6 10.4 11.5 3.6" />
  </svg>
)

export const Guessed = ({ className }: P) => (
  <svg viewBox="0 0 14 14" className={className} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 5.1a2.3 2.3 0 1 1 3.3 2.1c-.7.3-1.1.8-1.1 1.5v.5" />
    <circle cx="7" cy="11.4" r=".5" fill="currentColor" stroke="none" />
  </svg>
)

export const Fails = ({ className }: P) => (
  <svg viewBox="0 0 14 14" className={className} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
    <path d="M3 3 11 11M11 3 3 11" />
  </svg>
)

export const SidePanel = ({ className, open, right }: P & { open: boolean; right?: boolean }) => (
  <svg viewBox="0 0 14 14" className={className} {...tool} style={right ? { transform: 'scaleX(-1)' } : undefined}>
    <rect x="1.5" y="2" width="11" height="10" rx="1.5" />
    <path d="M5 2v10" />
    <rect x="1.5" y="2" width="3.5" height="10" rx="1" fill="currentColor" fillOpacity={0.18} stroke="none" />
    <path d={open ? 'M9.6 5.4 8 7l1.6 1.6' : 'M8 5.4 9.6 7 8 8.6'} />
  </svg>
)

export * from './nucleo'
