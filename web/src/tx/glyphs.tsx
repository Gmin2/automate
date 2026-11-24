import { useId, type CSSProperties, type ReactNode } from 'react'

// the icons, drawn the way the transit app's are: a 24 grid, solid shapes in the current colour, 2 px lines with
// round ends, details cut out of the solid through a mask (black in `cut` takes away, white puts back)

type Glyph = { draw: ReactNode; cut?: ReactNode; top?: ReactNode }

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const thin = { ...line, strokeWidth: 1.5 }
const out = { fill: 'none', stroke: 'black', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const outBold = { ...out, strokeWidth: 2 }

const G: Record<string, Glyph> = {
  menu: { draw: <><rect x="4" y="5.5" width="16" height="2" rx="1" fill="currentColor" /><rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" /><rect x="4" y="16.5" width="16" height="2" rx="1" fill="currentColor" /></> },
  undo: { draw: <><path d="M8.5 13.5 4 9l4.5-4.5" {...line} /><path d="M4.5 9H14a5.5 5.5 0 0 1 0 11h-3" {...line} /></> },
  redo: { draw: <><path d="M15.5 13.5 20 9l-4.5-4.5" {...line} /><path d="M19.5 9H10a5.5 5.5 0 0 0 0 11h3" {...line} /></> },
  down: { draw: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" {...line} /> },
  up: { draw: <path d="m6.5 14.5 5.5-5.5 5.5 5.5" {...line} /> },
  left: { draw: <path d="M14.5 6.5 9 12l5.5 5.5" {...line} /> },
  right: { draw: <path d="m9.5 6.5 5.5 5.5-5.5 5.5" {...line} /> },
  close: { draw: <path d="m6.5 6.5 11 11m0-11-11 11" {...line} /> },
  // a magnifier on the 24 grid (after nucleo micro-bold magnifier), for search boxes
  search: { draw: <><circle cx="10.5" cy="10.5" r="6.5" {...line} /><path d="m15.5 15.5 4.5 4.5" {...line} /></> },
  // the theme: a sun for light, a half lit disc for dark
  sun: { draw: <><circle cx="12" cy="12" r="4" {...line} /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...line} /></> },
  moon: { draw: <><circle cx="12" cy="12" r="8" {...line} /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></> },
  // nucleo micro-bold arrows-expand-diagonal-7, at 24
  expand: { draw: <path d="M9.6 20.4H3.6v-6M3.6 20.4l6-6M14.4 3.6h6v6M20.4 3.6l-6 6" {...line} /> },
  collapse: { draw: <path d="M3.6 14.4h6v6M9.6 14.4l-6 6M20.4 9.6h-6v-6M14.4 9.6l6-6" {...line} /> },
  check: { draw: <path d="m5 12.5 4.5 4.5L19 7.5" {...line} /> },
  plus: { draw: <path d="M12 5v14M5 12h14" {...line} /> },
  arrowUp: { draw: <path d="M12 19V5.5M6.5 11 12 5.5l5.5 5.5" {...line} /> },
  arrowRight: { draw: <path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5" {...line} /> },
  warn: {
    draw: <path d="M10.3 3.9a2 2 0 0 1 3.4 0l8.1 14.1a2 2 0 0 1-1.7 3H3.9a2 2 0 0 1-1.7-3Z" fill="currentColor" />,
    cut: <><path d="M12 9v4.5" {...outBold} /><circle cx="12" cy="17" r="1.2" fill="black" /></>,
  },
  info: {
    draw: <circle cx="12" cy="12" r="9.5" fill="currentColor" />,
    cut: <><path d="M12 11v5.5" {...outBold} /><circle cx="12" cy="7.8" r="1.2" fill="black" /></>,
  },
  okCircle: {
    draw: <circle cx="12" cy="12" r="9.5" fill="currentColor" />,
    cut: <path d="m8 12.3 2.8 2.8L16 9.8" {...outBold} />,
  },
  zoomIn: {
    draw: <><circle cx="10.5" cy="10.5" r="7.5" fill="currentColor" /><path d="m16.5 16.5 4 4" {...line} /></>,
    cut: <path d="M10.5 7.5v6m-3-3h6" {...out} />,
  },
  zoomOut: {
    draw: <><circle cx="10.5" cy="10.5" r="7.5" fill="currentColor" /><path d="m16.5 16.5 4 4" {...line} /></>,
    cut: <path d="M7.5 10.5h6" {...out} />,
  },
  fit: { draw: <><path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9m6 0h2.5A2.5 2.5 0 0 1 20 6.5V9m0 6v2.5a2.5 2.5 0 0 1-2.5 2.5H15m-6 0H6.5A2.5 2.5 0 0 1 4 17.5V15" {...line} /><circle cx="12" cy="12" r="3" fill="currentColor" /></> },
  dots: { draw: <>{[6, 12, 18].flatMap((y) => [6, 12, 18].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.7" fill="currentColor" />))}</> },
  widgets: { draw: <><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2.2" fill="currentColor" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="2.2" fill="currentColor" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="2.2" fill="currentColor" /><rect x="13" y="13" width="7.5" height="7.5" rx="2.2" fill="currentColor" /></> },
  play: { draw: <path d="M7 5.2v13.6a1.9 1.9 0 0 0 2.9 1.6l10.6-6.8a1.9 1.9 0 0 0 0-3.2L9.9 3.6A1.9 1.9 0 0 0 7 5.2Z" fill="currentColor" /> },
  pause: { draw: <><rect x="6" y="4.5" width="4.5" height="15" rx="1.6" fill="currentColor" /><rect x="13.5" y="4.5" width="4.5" height="15" rx="1.6" fill="currentColor" /></> },
  share: { draw: <><path d="M4.5 14v2.5a3.5 3.5 0 0 0 3.5 3.5h8a3.5 3.5 0 0 0 3.5-3.5V14" {...line} /><path d="M12 15V4.5M8 8.5l4-4 4 4" {...line} /></> },
  download: { draw: <><path d="M4.5 14v2.5a3.5 3.5 0 0 0 3.5 3.5h8a3.5 3.5 0 0 0 3.5-3.5V14" {...line} /><path d="M12 4.5V15m-4-4 4 4 4-4" {...line} /></> },
  chat: {
    draw: <path d="M4 7a3.5 3.5 0 0 1 3.5-3.5h9A3.5 3.5 0 0 1 20 7v7a3.5 3.5 0 0 1-3.5 3.5h-5l-4.4 3.3c-.6.5-1.6 0-1.6-.8v-2.6A3.5 3.5 0 0 1 4 14Z" fill="currentColor" />,
    cut: <path d="M8.5 9h7m-7 3.5h4.5" {...out} />,
  },
  panel: {
    draw: <><rect x="3" y="4" width="18" height="16" rx="4" {...line} /><rect x="5" y="6" width="5" height="12" rx="2" fill="currentColor" /></>,
  },
  panelRight: {
    draw: <><rect x="3" y="4" width="18" height="16" rx="4" {...line} /><rect x="14" y="6" width="5" height="12" rx="2" fill="currentColor" /></>,
  },
  eye: {
    draw: <path d="M12 5c4.8 0 8.3 3.7 9.6 6a2 2 0 0 1 0 2c-1.3 2.3-4.8 6-9.6 6s-8.3-3.7-9.6-6a2 2 0 0 1 0-2C3.7 8.7 7.2 5 12 5Z" fill="currentColor" />,
    cut: <><circle cx="12" cy="12" r="3.6" fill="black" /><circle cx="12" cy="12" r="1.8" fill="white" /></>,
  },
  eyeOff: {
    draw: <path d="M12 5c4.8 0 8.3 3.7 9.6 6a2 2 0 0 1 0 2c-1.3 2.3-4.8 6-9.6 6s-8.3-3.7-9.6-6a2 2 0 0 1 0-2C3.7 8.7 7.2 5 12 5Z" fill="currentColor" />,
    cut: <><circle cx="12" cy="12" r="3.6" fill="black" /><path d="m4 4 16 16" stroke="black" strokeWidth="5" strokeLinecap="round" /></>,
    top: <path d="m4 4 16 16" {...line} />,
  },
  pin: {
    draw: <path d="M12 2.5a7.5 7.5 0 0 1 7.5 7.5c0 4.6-4.6 9.1-6.4 10.8a1.6 1.6 0 0 1-2.2 0C9.1 19.1 4.5 14.6 4.5 10A7.5 7.5 0 0 1 12 2.5Z" fill="currentColor" />,
    cut: <circle cx="12" cy="10" r="2.6" fill="black" />,
  },
  tag: {
    draw: <path d="M3.5 5.5a2 2 0 0 1 2-2h5.2a2 2 0 0 1 1.4.6l8.3 8.3a2 2 0 0 1 0 2.8l-5.4 5.4a2 2 0 0 1-2.8 0L3.9 12.3a2 2 0 0 1-.4-1.4Z" fill="currentColor" />,
    cut: <circle cx="8.3" cy="8.3" r="1.7" fill="black" />,
  },
  explode: {
    draw: <><rect x="8.5" y="8.5" width="7" height="7" rx="2" fill="currentColor" /><path d="M3.5 7.5v-4h4M3.5 3.5l3.5 3.5M20.5 7.5v-4h-4M20.5 3.5 17 7M3.5 16.5v4h4M3.5 20.5 7 17M20.5 16.5v4h-4M20.5 20.5 17 17" {...line} /></>,
  },
  glass: { draw: <><rect x="3" y="3" width="13" height="13" rx="3.5" fill="currentColor" opacity=".35" /><rect x="8" y="8" width="13" height="13" rx="3.5" {...line} /></> },
  slice: {
    draw: <><path d="M5.5 3.5h7L3.5 12.5v-7a2 2 0 0 1 2-2Z" fill="currentColor" /><path d="M18.5 20.5h-7l9-9v7a2 2 0 0 1-2 2Z" fill="currentColor" /><path d="m3.5 20.5 17-17" {...thin} strokeDasharray="1.5 3" /></>,
  },
  home: {
    draw: <path d="M10.6 3.5a2.2 2.2 0 0 1 2.8 0l6.4 5.3a2.2 2.2 0 0 1 .8 1.7v7.8a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2v-7.8a2.2 2.2 0 0 1 .8-1.7Z" fill="currentColor" />,
    cut: <path d="M10 20.5v-4a2 2 0 0 1 4 0v4" fill="black" />,
  },
  camera: {
    draw: <path d="M8.6 5.2A2 2 0 0 1 10.3 4h3.4a2 2 0 0 1 1.7 1.2l.5 1.3h2.6A3 3 0 0 1 21.5 9.5v7.5a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3V9.5a3 3 0 0 1 3-3h2.6Z" fill="currentColor" />,
    cut: <><circle cx="12" cy="13" r="4" fill="black" /><circle cx="12" cy="13" r="2.2" fill="white" /></>,
  },
  spin: { draw: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" {...line} /><path d="M19.5 4.5v4.2h-4.2" {...line} /></> },
  sheet: {
    draw: <path d="M5 5a2.5 2.5 0 0 1 2.5-2.5h6.3a2 2 0 0 1 1.4.6l3.7 3.7a2 2 0 0 1 .6 1.4V19a2.5 2.5 0 0 1-2.5 2.5h-9.5A2.5 2.5 0 0 1 5 19Z" fill="currentColor" />,
    cut: <path d="M8.5 11.5h7m-7 3.5h7m-7 3.5h4" {...out} />,
  },
  book: {
    draw: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.5.5H6.5a1 1 0 0 0 0 2H19a1 1 0 0 1 0 2H6.5A2.5 2.5 0 0 1 4 18.5Z" fill="currentColor" />,
    cut: <path d="M8 7.5h7.5M8 11h5" {...out} />,
  },
  palette: {
    draw: <path d="M12 2.5c5.2 0 9.5 3.8 9.5 8.5 0 3-2.4 5-5 5h-1.8a1.7 1.7 0 0 0-1.2 2.9 1.7 1.7 0 0 1-1.2 2.6h-.3a9.5 9.5 0 0 1 0-19Z" fill="currentColor" />,
    cut: <><circle cx="7.5" cy="11" r="1.5" fill="black" /><circle cx="10" cy="7" r="1.5" fill="black" /><circle cx="14.8" cy="7" r="1.5" fill="black" /></>,
  },
  cube: {
    draw: <path d="M10.8 2.8a2.4 2.4 0 0 1 2.4 0l6.6 3.8a2.4 2.4 0 0 1 1.2 2.1v6.6a2.4 2.4 0 0 1-1.2 2.1l-6.6 3.8a2.4 2.4 0 0 1-2.4 0l-6.6-3.8A2.4 2.4 0 0 1 3 15.3V8.7a2.4 2.4 0 0 1 1.2-2.1Z" fill="currentColor" />,
    cut: <path d="m4 7.5 8 4.5 8-4.5M12 12v9.5" {...out} />,
  },
  cubeWire: { draw: <><path d="M10.8 2.8a2.4 2.4 0 0 1 2.4 0l6.6 3.8a2.4 2.4 0 0 1 1.2 2.1v6.6a2.4 2.4 0 0 1-1.2 2.1l-6.6 3.8a2.4 2.4 0 0 1-2.4 0l-6.6-3.8A2.4 2.4 0 0 1 3 15.3V8.7a2.4 2.4 0 0 1 1.2-2.1Z" {...thin} /><path d="m4 7.5 8 4.5 8-4.5M12 12v9.5" {...thin} /></> },
  box: {
    draw: <path d="M3.5 7a2.5 2.5 0 0 1 1.3-2.2l6-3.2a2.5 2.5 0 0 1 2.4 0l6 3.2A2.5 2.5 0 0 1 20.5 7v10a2.5 2.5 0 0 1-1.3 2.2l-6 3.2a2.5 2.5 0 0 1-2.4 0l-6-3.2A2.5 2.5 0 0 1 3.5 17Z" fill="currentColor" />,
    cut: <path d="m4.5 6.5 7.5 4 7.5-4M12 10.5V22M8 4.4l7.5 4" {...out} />,
  },
  cart: {
    draw: <><path d="M2.5 3.5h2l2.2 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4l1.9-6.2a1.5 1.5 0 0 0-1.4-1.9H5.5" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="9" cy="20" r="1.6" fill="currentColor" /><circle cx="17" cy="20" r="1.6" fill="currentColor" /></>,
  },
  bag: {
    draw: <><path d="M5.2 8.6A2 2 0 0 1 7.2 7h9.6a2 2 0 0 1 2 1.6l1.6 9.5a2.5 2.5 0 0 1-2.5 2.9H6.1a2.5 2.5 0 0 1-2.5-2.9Z" fill="currentColor" /><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" {...line} /></>,
  },
  breadboard: {
    draw: <rect x="2.5" y="5" width="19" height="14" rx="3" fill="currentColor" />,
    cut: <>{[8.5, 15.5].flatMap((y) => [6.5, 9.5, 12.5, 15.5, 18.5].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1" fill="black" />))}<path d="M5 12h14" {...out} strokeWidth="1" /></>,
  },
  steps: { draw: <><circle cx="5" cy="6" r="2" fill="currentColor" /><circle cx="5" cy="12" r="2" fill="currentColor" /><circle cx="5" cy="18" r="2" fill="currentColor" /><path d="M10 6h10M10 12h10M10 18h6" {...line} /></> },
  chip: {
    draw: <><rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="currentColor" /><path d="M9.5 2.5v2m5-2v2m-5 15v2m5-2v2m-12-12h2m-2 5h2m15-5h2m-2 5h2" {...line} /></>,
    cut: <rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="black" />,
  },
  board: {
    draw: <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />,
    cut: <><path d="M7 7h4l3 3v7M17 7v4" {...out} /><circle cx="14" cy="17" r="1.5" fill="black" /><circle cx="17" cy="11" r="1.5" fill="black" /><circle cx="7" cy="7" r="1.5" fill="black" /></>,
  },
  wiring: { draw: <><path d="M2.5 12h4l1.5-4 3 8 3-8 3 8 1.5-4h3" {...line} /></> },
  layers: { draw: <><path d="M11 3.3a2 2 0 0 1 2 0l7.2 4a1 1 0 0 1 0 1.8l-7.2 4a2 2 0 0 1-2 0l-7.2-4a1 1 0 0 1 0-1.8Z" fill="currentColor" /><path d="m3.5 12.5 7.5 4.1a2 2 0 0 0 2 0l7.5-4.1M3.5 16.5l7.5 4.1a2 2 0 0 0 2 0l7.5-4.1" {...line} /></> },
  code: {
    draw: <rect x="2.5" y="4" width="19" height="16" rx="4" fill="currentColor" />,
    cut: <path d="m9 9.5-2.5 2.5L9 14.5m6-5 2.5 2.5-2.5 2.5M13 8.5l-2 7" {...out} />,
  },
  bolt: { draw: <path d="M13.4 2.8c.5-.8 1.7-.4 1.6.5l-.8 6.2h4.5a1 1 0 0 1 .8 1.6l-8.9 10.1c-.6.7-1.7.2-1.6-.7l.8-6H5.4a1 1 0 0 1-.8-1.6Z" fill="currentColor" /> },
  pulse: {
    draw: <rect x="2.5" y="4" width="19" height="16" rx="4" fill="currentColor" />,
    cut: <path d="M5.5 12.5h3l1.8-4 3.2 7.5 1.8-3.5h3.2" {...out} />,
  },
  user: { draw: <><circle cx="12" cy="8" r="4.5" fill="currentColor" /><path d="M3.8 19.5c1.2-3.5 4.4-5.5 8.2-5.5s7 2 8.2 5.5a1.4 1.4 0 0 1-1.3 1.8H5.1a1.4 1.4 0 0 1-1.3-1.8Z" fill="currentColor" /></> },
  sparkle: { draw: <path d="M11.1 3.3c.3-.9 1.5-.9 1.8 0l1.4 4.1a3 3 0 0 0 1.9 1.9l4.1 1.4c.9.3.9 1.5 0 1.8l-4.1 1.4a3 3 0 0 0-1.9 1.9l-1.4 4.1c-.3.9-1.5.9-1.8 0l-1.4-4.1a3 3 0 0 0-1.9-1.9l-4.1-1.4c-.9-.3-.9-1.5 0-1.8l4.1-1.4a3 3 0 0 0 1.9-1.9Z" fill="currentColor" /> },
  folder: {
    draw: <path d="M2.5 7A2.5 2.5 0 0 1 5 4.5h3.8a2 2 0 0 1 1.5.7l1.2 1.3H19A2.5 2.5 0 0 1 21.5 9v8.5A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5Z" fill="currentColor" />,
  },
  gear: {
    draw: <path d="M10.3 2.9a1.7 1.7 0 0 1 3.4 0l.2 1.3c.5.2 1 .4 1.5.8l1.2-.6a1.7 1.7 0 0 1 2.3.6l.4.7a1.7 1.7 0 0 1-.4 2.2l-1 .8a6 6 0 0 1 0 1.7l1 .8a1.7 1.7 0 0 1 .4 2.2l-.4.7a1.7 1.7 0 0 1-2.3.6l-1.2-.6c-.5.3-1 .6-1.5.8l-.2 1.3a1.7 1.7 0 0 1-3.4 0l-.2-1.3c-.5-.2-1-.5-1.5-.8l-1.2.6a1.7 1.7 0 0 1-2.3-.6l-.4-.7a1.7 1.7 0 0 1 .4-2.2l1-.8a6 6 0 0 1 0-1.7l-1-.8a1.7 1.7 0 0 1-.4-2.2l.4-.7A1.7 1.7 0 0 1 7.3 4.4l1.2.6c.5-.4 1-.6 1.5-.8Z" fill="currentColor" transform="translate(0 2.6)" />,
    cut: <circle cx="12" cy="12" r="3" fill="black" />,
  },
  ruler: {
    draw: <rect x="1.8" y="8" width="20.4" height="8" rx="2.5" fill="currentColor" transform="rotate(-45 12 12)" />,
    cut: <path d="m8 10.6 1.4 1.4m1.4-4.2 2.1 2.1m.7-4.9 1.4 1.4" {...out} transform="translate(-0.5 2.4)" />,
  },
  link: { draw: <><path d="M10 13.5a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.6l-1.2 1.2" {...line} /><path d="M14 10.5a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.6l1.2-1.2" {...line} /></> },
  trash: {
    draw: <><path d="M5.5 7.5h13l-.9 11.6a2.5 2.5 0 0 1-2.5 2.4H8.9a2.5 2.5 0 0 1-2.5-2.4Z" fill="currentColor" /><path d="M4 5.5h16M9.5 5.5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" {...line} /></>,
  },
  pencil: { draw: <><path d="M15.2 3.9a2.6 2.6 0 0 1 3.7 3.7L8.4 18.1a2 2 0 0 1-1 .5l-3.3.8a.6.6 0 0 1-.7-.7l.8-3.3a2 2 0 0 1 .5-1Z" fill="currentColor" /><path d="M13 21h7.5" {...line} /></> },
  random: {
    draw: <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" />,
    cut: <><circle cx="8" cy="8" r="1.6" fill="black" /><circle cx="16" cy="8" r="1.6" fill="black" /><circle cx="12" cy="12" r="1.6" fill="black" /><circle cx="8" cy="16" r="1.6" fill="black" /><circle cx="16" cy="16" r="1.6" fill="black" /></>,
  },
  clock: {
    draw: <circle cx="12" cy="12" r="9.5" fill="currentColor" />,
    cut: <path d="M12 7v5l3 2" {...outBold} />,
  },
  history: { draw: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" {...line} /><path d="M4.5 4.5V9H9M12 8v4l2.8 1.8" {...line} /></> },
  // the kinds of part, for the parts list
  wire: { draw: <><path d="M6.5 17.5c0-6.5 11-4.5 11-11" {...line} /><circle cx="6.5" cy="18.5" r="2.5" fill="currentColor" /><circle cx="17.5" cy="5.5" r="2.5" fill="currentColor" /></> },
  resistor: {
    draw: <><rect x="5.5" y="8" width="13" height="8" rx="4" fill="currentColor" /><path d="M2 12h3.5m13 0H22" {...line} /></>,
    cut: <path d="M10 9.5v5m4-5v5" {...out} />,
  },
  capacitor: { draw: <><rect x="8" y="4" width="3" height="16" rx="1.5" fill="currentColor" /><rect x="13" y="4" width="3" height="16" rx="1.5" fill="currentColor" /><path d="M2.5 12H8m8 0h5.5" {...line} /></> },
  electrolytic: {
    draw: <><rect x="6" y="2.5" width="12" height="14" rx="4" fill="currentColor" /><path d="M9.5 16.5v5m5-5v5" {...line} /></>,
    cut: <path d="M14.5 5v9" {...out} strokeWidth="2.5" />,
  },
  inductor: { draw: <path d="M2 14h1.5a2.6 2.6 0 0 1 5.2 0 2.6 2.6 0 0 1 5.2 0 2.6 2.6 0 0 1 5.2 0H22" {...line} /> },
  diode: { draw: <><path d="M7 6.3v11.4a1 1 0 0 0 1.5.9l8.4-5.7a1 1 0 0 0 0-1.7L8.5 5.4A1 1 0 0 0 7 6.3Z" fill="currentColor" /><path d="M17.5 5.5v13M2.5 12H7m10.5 0h4" {...line} /></> },
  led: { draw: <><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0v5h-11Z" fill="currentColor" /><rect x="5" y="14" width="14" height="2.5" rx="1.25" fill="currentColor" /><path d="M9.5 16.5v5m5-5v3.5" {...line} /><path d="M19.5 3.5 18 5M21 7.5h-2" {...thin} /></> },
  protection: {
    draw: <path d="M11.2 2.4a2 2 0 0 1 1.6 0l6.5 2.6a2 2 0 0 1 1.2 1.9v4.6c0 4.7-3.2 8.6-7.7 10a2.6 2.6 0 0 1-1.6 0C6.7 20.1 3.5 16.2 3.5 11.5V6.9a2 2 0 0 1 1.2-1.9Z" fill="currentColor" />,
    cut: <path d="m8.5 12 2.5 2.5 4.5-5" {...outBold} />,
  },
  crystal: {
    draw: <><rect x="5" y="6.5" width="14" height="11" rx="5.5" fill="currentColor" /><path d="M2.5 12H5m14 0h2.5" {...line} /></>,
    cut: <rect x="8.5" y="10" width="7" height="4" rx="2" {...out} />,
  },
  transistor: { draw: <><path d="M5 11.5a7 7 0 0 1 14 0v1a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 12.5Z" fill="currentColor" /><path d="M8 14v7m4-7v7m4-7v7" {...line} /></> },
  fuse: { draw: <><rect x="4.5" y="8" width="15" height="8" rx="2.5" {...line} /><rect x="2.5" y="9" width="3" height="6" rx="1" fill="currentColor" /><rect x="18.5" y="9" width="3" height="6" rx="1" fill="currentColor" /><path d="M7.5 12h9" {...thin} /></> },
  button: {
    draw: <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="currentColor" />,
    cut: <><circle cx="12" cy="12" r="5" fill="black" /><circle cx="12" cy="12" r="3.3" fill="white" /></>,
  },
  usb: {
    draw: <rect x="3" y="7.5" width="18" height="9" rx="4.5" fill="currentColor" />,
    cut: <rect x="7" y="10.5" width="10" height="3" rx="1.5" fill="black" />,
  },
  header: {
    draw: <rect x="2" y="8" width="20" height="8" rx="2.5" fill="currentColor" />,
    cut: <>{[5.5, 10, 14, 18.5].map((x) => <rect key={x} x={x - 1.5} y="10.5" width="3" height="3" rx="0.8" fill="black" />)}</>,
  },
  terminal: {
    draw: <rect x="3" y="5" width="18" height="14" rx="3.5" fill="currentColor" />,
    cut: <><circle cx="8.5" cy="12" r="2.6" fill="black" /><circle cx="15.5" cy="12" r="2.6" fill="black" /><path d="M7.4 13.1 9.6 10.9m4.8 2.2 2.2-2.2" stroke="white" strokeWidth="1.2" strokeLinecap="round" /></>,
  },
  battery: {
    draw: <><rect x="2.5" y="7" width="16.5" height="10" rx="3" fill="currentColor" /><rect x="19.5" y="10" width="2.5" height="4" rx="1" fill="currentColor" /></>,
    cut: <path d="M10.75 9.75v4.5M8.5 12H13" {...out} />,
  },
  charger: {
    draw: <><rect x="2.5" y="7" width="16.5" height="10" rx="3" fill="currentColor" /><rect x="19.5" y="10" width="2.5" height="4" rx="1" fill="currentColor" /></>,
    cut: <path d="m11.5 8.5-2.5 4h3.5l-2.5 3.5" {...out} />,
  },
  antenna: { draw: <><path d="M12 10v11" {...line} /><circle cx="12" cy="8.5" r="2.2" fill="currentColor" /><path d="M7.5 4.5a6.5 6.5 0 0 0 0 8m9-8a6.5 6.5 0 0 1 0 8" {...line} /></> },
  card: {
    draw: <path d="M8.2 2.5h8.3A2.5 2.5 0 0 1 19 5v14a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 19V7.5a2 2 0 0 1 .6-1.4l1.2-1.2a2 2 0 0 0 .6-1.4Z" fill="currentColor" />,
    cut: <path d="M10 5.5V8m3-2.5V8m3-2.5V8" {...out} />,
  },
  mcu: {
    draw: <><rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="currentColor" /><path d="M9.5 2.5v2m5-2v2m-5 15v2m5-2v2m-12-12h2m-2 5h2m15-5h2m-2 5h2" {...line} /></>,
    cut: <circle cx="9" cy="9" r="1.3" fill="black" />,
  },
  module: {
    draw: <rect x="3.5" y="2.5" width="17" height="19" rx="3" fill="currentColor" />,
    cut: <><rect x="7.5" y="10.5" width="9" height="8" rx="1.5" fill="black" /><path d="M7 5.5h2.5v2H12v-2h2.5v2H17" {...out} /></>,
  },
  ic: { draw: <><rect x="6.5" y="4" width="11" height="16" rx="2.5" fill="currentColor" /><path d="M3.5 7.5h3m-3 4.5h3m-3 4.5h3m11-9h3m-3 4.5h3m-3 4.5h3" {...line} /></>, cut: <circle cx="12" cy="7" r="1.2" fill="black" /> },
  power: {
    draw: <circle cx="12" cy="12" r="9.5" fill="currentColor" />,
    cut: <path d="m13 6.5-4 6h4l-2 5" {...outBold} />,
  },
  thermo: {
    draw: <path d="M9 5.5a3 3 0 0 1 6 0v7.6a5 5 0 1 1-6 0Z" fill="currentColor" />,
    cut: <><path d="M12 9v7" {...outBold} /><circle cx="12" cy="17" r="1.6" fill="black" /></>,
  },
  sensor: {
    draw: <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="currentColor" />,
    cut: <><circle cx="12" cy="12" r="4.5" {...out} /><circle cx="12" cy="12" r="1.6" fill="black" /></>,
  },
  mic: { draw: <><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4" {...line} /></> },
  light: { draw: <><circle cx="12" cy="12" r="4.5" fill="currentColor" /><path d="M12 2.5v2m0 15v2M2.5 12h2m15 0h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...line} /></> },
  motion: { draw: <><circle cx="6" cy="18" r="2.5" fill="currentColor" /><path d="M5.5 11.5a7 7 0 0 1 7 7M5.5 5a13.5 13.5 0 0 1 13.5 13.5" {...line} /></> },
  wireless: { draw: <><circle cx="12" cy="18" r="2" fill="currentColor" /><path d="M8.5 14.5a5 5 0 0 1 7 0M5.5 11.3a9.2 9.2 0 0 1 13 0M2.7 8.2a13.3 13.3 0 0 1 18.6 0" {...line} /></> },
  memory: {
    draw: <><rect x="3" y="6" width="18" height="10" rx="2.5" fill="currentColor" /><path d="M6.5 16v3.5m3.7-3.5v3.5m3.6-3.5v3.5m3.7-3.5v3.5" {...line} /></>,
    cut: <><rect x="6" y="9" width="3" height="4" rx="0.8" fill="black" /><rect x="10.5" y="9" width="3" height="4" rx="0.8" fill="black" /><rect x="15" y="9" width="3" height="4" rx="0.8" fill="black" /></>,
  },
  relay: {
    draw: <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" fill="currentColor" />,
    cut: <path d="M6.5 12h2l1.5-3 2 6 2-6 1.5 3h2" {...out} />,
  },
  buzzer: {
    draw: <><circle cx="12" cy="10.5" r="8" fill="currentColor" /><path d="M9.5 18.5v3m5-3v3" {...line} /></>,
    cut: <><circle cx="12" cy="10.5" r="2.5" {...out} /></>,
  },
  motor: {
    draw: <><circle cx="10" cy="12" r="7.5" fill="currentColor" /><path d="M17.5 12h4" {...line} strokeWidth="2.5" /></>,
    cut: <><circle cx="10" cy="12" r="2" fill="black" /></>,
  },
  amp: {
    draw: <><path d="M5 5.4v13.2a1.2 1.2 0 0 0 1.8 1l11-6.6a1.2 1.2 0 0 0 0-2l-11-6.6A1.2 1.2 0 0 0 5 5.4Z" fill="currentColor" /><path d="M2 9h3m-3 6h3m13.5-3H22" {...line} /></>,
    cut: <path d="M7.5 9h3M9 7.5v3M7.5 15h3" {...out} />,
  },
  testpoint: { draw: <><circle cx="12" cy="12" r="7.5" {...line} /><circle cx="12" cy="12" r="3.5" fill="currentColor" /></> },
  // more for the pages
  drop: { draw: <path d="M12 2.8c.4 0 .8.2 1 .5 1.8 2.4 6 7.9 6 11.2a7 7 0 0 1-14 0c0-3.3 4.2-8.8 6-11.2.2-.3.6-.5 1-.5Z" fill="currentColor" /> },
  image: {
    draw: <rect x="2.5" y="4" width="19" height="16" rx="4" fill="currentColor" />,
    cut: <><circle cx="8.5" cy="9.5" r="1.8" fill="black" /><path d="m4 18 5-5 3 3 3.5-4 5 5.5" {...outBold} /></>,
  },
  ball: { draw: <><circle cx="12" cy="12" r="8.5" {...line} /><circle cx="12" cy="12" r="4" fill="currentColor" /></> },
  stop: { draw: <rect x="5" y="5" width="14" height="14" rx="3.5" fill="currentColor" /> },
  swap: { draw: <path d="M4.5 8.5h14M15 5l3.5 3.5L15 12M19.5 15.5h-14M9 12l-3.5 3.5L9 19" {...line} /> },
  question: {
    draw: <circle cx="12" cy="12" r="9.5" fill="currentColor" />,
    cut: <><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.5" {...outBold} /><circle cx="12" cy="17" r="1.2" fill="black" /></>,
  },
  xCircle: {
    draw: <circle cx="12" cy="12" r="9.5" fill="currentColor" />,
    cut: <path d="m9 9 6 6m0-6-6 6" {...outBold} />,
  },
  pointer: { draw: <path d="M5.5 4.2c-.3-.8.5-1.6 1.3-1.3l12.4 4.7c.9.3.9 1.6 0 1.9l-5.2 1.8a1.5 1.5 0 0 0-.9.9l-1.8 5.2c-.3.9-1.6.9-1.9 0Z" fill="currentColor" /> },
  hand: { draw: <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10V4a1.5 1.5 0 0 1 3 0v6V5.5a1.5 1.5 0 0 1 3 0V11v-2a1.5 1.5 0 0 1 3 0v5a7.5 7.5 0 0 1-7.5 7.5h-.6a6.5 6.5 0 0 1-5-2.4l-3.2-4a1.6 1.6 0 0 1 2.4-2.1Z" fill="currentColor" /> },
  trace: { draw: <><path d="M4 18h5l6-12h5" {...line} /><circle cx="4" cy="18" r="2" fill="currentColor" /><circle cx="20" cy="6" r="2" fill="currentColor" /></> },
  badge: {
    draw: <path d="M10.6 2.7a2 2 0 0 1 2.8 0l1.2 1.1c.4.3.9.5 1.4.5h1.6a2 2 0 0 1 2 2V8c0 .5.2 1 .6 1.4l1.1 1.2a2 2 0 0 1 0 2.8l-1.1 1.2c-.4.4-.6.9-.6 1.4v1.6a2 2 0 0 1-2 2H16c-.5 0-1 .2-1.4.6l-1.2 1.1a2 2 0 0 1-2.8 0l-1.2-1.1A2 2 0 0 0 8 19.6H6.4a2 2 0 0 1-2-2V16c0-.5-.2-1-.6-1.4l-1.1-1.2a2 2 0 0 1 0-2.8l1.1-1.2c.4-.4.6-.9.6-1.4V6.4a2 2 0 0 1 2-2H8c.5 0 1-.2 1.4-.6Z" fill="currentColor" />,
    cut: <path d="m8.5 12 2.5 2.5 4.5-5" {...outBold} />,
  },
  copy: { draw: <><rect x="8" y="8" width="13" height="13" rx="3.5" fill="currentColor" /><path d="M16 5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16" {...line} /></> },
  reset: { draw: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" {...line} /><path d="M4.5 4.5V9H9" {...line} /></> },
  skip: { draw: <><path d="M4.5 5.6v12.8a1.6 1.6 0 0 0 2.5 1.3l9-6.4a1.6 1.6 0 0 0 0-2.6L7 4.3a1.6 1.6 0 0 0-2.5 1.3Z" fill="currentColor" /><rect x="17.5" y="4.5" width="3" height="15" rx="1.5" fill="currentColor" /></> },
  external: { draw: <path d="M8 6.5h9.5V16M17 7 6.5 17.5" {...line} /> },
}

export type GlyphName = keyof typeof G

export function Glyph({ name, size = 16, className, style }: { name: GlyphName; size?: number | undefined; className?: string | undefined; style?: CSSProperties | undefined }) {
  const id = useId()
  const g = G[name]
  if (!g) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      {g.cut ? (
        <>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="white" />
            {g.cut}
          </mask>
          <g mask={`url(#${id})`}>{g.draw}</g>
        </>
      ) : g.draw}
      {g.top}
    </svg>
  )
}

export const GLYPHS = Object.keys(G) as GlyphName[]
