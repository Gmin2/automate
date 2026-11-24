import { create } from 'zustand'
import { api, type Example, type FaceInfo, type FileInfo, type Params, type Result, type Scene } from './api'

type Load<T> = { state: 'idle' } | { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; error: string }

type Selection = { inst: string | null; faces: number[] }

// a camera move the canvas carries out: frame these instances (and ghosts of these matches)
type Focus = { n: number; instances: string[]; ghosts: number[]; all?: boolean }

type State = {
  files: FileInfo[]
  file: string | null
  scene: Load<Scene>
  examples: Example[]
  defaults: Params | null
  params: Params | null
  selection: Selection
  faceInfo: Record<number, FaceInfo>
  result: Result | null
  running: boolean
  runError: string | null
  active: number | null
  hidden: Record<string, boolean>
  hover: { inst: string; face: number; x: number; y: number } | null
  xray: boolean
  ghosts: boolean
  edges: boolean
  focus: Focus
  theme: 'light' | 'dark'
  started: number | null
}

export const useApp = create<State>(() => ({
  files: [],
  file: null,
  scene: { state: 'idle' },
  examples: [],
  defaults: null,
  params: null,
  selection: { inst: null, faces: [] },
  faceInfo: {},
  result: null,
  running: false,
  runError: null,
  active: null,
  hidden: {},
  hover: null,
  xray: false,
  ghosts: true,
  edges: true,
  focus: { n: 0, instances: [], ghosts: [], all: true },
  theme: localStorage.getItem('automate-theme') === 'dark' ? 'dark' : 'light',
  started: null,
}))

document.documentElement.dataset.theme = useApp.getState().theme

const set = useApp.setState
const get = useApp.getState

export function focus(instances: string[], ghosts: number[] = []) {
  set((s) => ({ focus: { n: s.focus.n + 1, instances, ghosts } }))
}

export const focusAll = () => set((s) => ({ focus: { n: s.focus.n + 1, instances: [], ghosts: [], all: true } }))

export async function boot() {
  const [files, defaults] = await Promise.all([api.files(), api.params()])
  set({ files, defaults, params: defaults })
  const want = new URLSearchParams(location.search).get('file')
  const first = files.find((f) => f.name === want) ?? files[0]
  if (first) await open(first.name)
}

export async function open(file: string) {
  set({ file, started: Date.now(), scene: { state: 'loading' }, examples: [], selection: { inst: null, faces: [] }, faceInfo: {}, result: null, runError: null, active: null, hidden: {}, hover: null, xray: false })
  const url = new URL(location.href)
  url.searchParams.set('file', file)
  history.replaceState(null, '', url)
  try {
    const [scene, examples] = await Promise.all([api.scene(file), api.examples(file)])
    if (get().file !== file) return
    set((s) => ({ scene: { state: 'ready', data: scene }, examples, files: s.files.map((f) => (f.name === file ? { ...f, loaded: true } : f)) }))
    focusAll()
  } catch (e) {
    set({ scene: { state: 'error', error: (e as Error).message } })
  }
}

async function loadFaces(inst: string) {
  const file = get().file
  if (!file) return
  try {
    const list = await api.faces(file, inst)
    if (get().selection.inst !== inst) return
    set({ faceInfo: Object.fromEntries(list.map((f) => [f.id, f])) })
  } catch {
    // face info is only for the inspector, the canvas works without it
  }
}

export function toggleFace(inst: string, face: number) {
  const s = get().selection
  const same = s.inst === inst
  const faces = same ? (s.faces.includes(face) ? s.faces.filter((f) => f !== face) : [...s.faces, face]) : [face]
  set({ selection: { inst: faces.length ? inst : null, faces }, result: null, runError: null, active: null, ...(same ? {} : { faceInfo: {} }) })
  if (!same) loadFaces(inst)
}

export function dropFace(face: number) {
  const s = get().selection
  if (s.inst) toggleFace(s.inst, face)
}

export function clear() {
  set({ selection: { inst: null, faces: [] }, faceInfo: {}, result: null, runError: null, active: null, xray: false })
}

export function pickExample(i: number) {
  const e = get().examples[i]
  if (!e) return
  set({ selection: { inst: e.instance, faces: e.faces }, faceInfo: {}, result: null, active: null })
  loadFaces(e.instance)
  run()
}

export async function run() {
  const { file, selection, params } = get()
  if (!file || !selection.inst || !selection.faces.length || !params) return
  set({ running: true, runError: null, started: Date.now() })
  try {
    const result = await api.match(file, selection.inst, selection.faces, params)
    const now = get().selection
    if (now.inst !== selection.inst || now.faces.join() !== selection.faces.join()) return
    set({ result, active: null, xray: true })
    const targets = new Set<string>()
    for (const m of result.matches) for (const k of Object.keys(m.target_faces)) targets.add(k)
    if (!targets.size && result.in_place_contacts) for (const k of Object.keys(result.in_place_contacts.target_faces)) targets.add(k)
    targets.add(selection.inst)
    focus([...targets], result.matches.map((_, i) => i))
  } catch (e) {
    set({ result: null, runError: (e as Error).message })
  } finally {
    set({ running: false })
  }
}

export function setParam<K extends keyof Params>(k: K, v: number) {
  const p = get().params
  if (p) set({ params: { ...p, [k]: v } })
}

// a slider let go: search again with the new tolerance if there is something to search for
export function commitParams() {
  if (get().result || get().runError) run()
}

export function resetParams() {
  set({ params: get().defaults })
  commitParams()
}

export function setActive(i: number | null) {
  set({ active: i })
  const r = get().result
  if (i === null || !r) return
  const m = r.matches[i]
  if (m) focus(Object.keys(m.target_faces), m.in_place || !m.world ? [] : [i])
}

export function toggleHidden(id: string) {
  set((s) => ({ hidden: { ...s.hidden, [id]: !s.hidden[id] } }))
}

export const setView = (v: Partial<Pick<State, 'xray' | 'ghosts' | 'edges'>>) => set(v)
export const setHover = (hover: State['hover']) => set({ hover })

export function setTheme(theme: 'light' | 'dark') {
  const html = document.documentElement
  html.classList.add('tx-theming')
  html.dataset.theme = theme
  localStorage.setItem('automate-theme', theme)
  set({ theme })
  setTimeout(() => html.classList.remove('tx-theming'), 320)
}
