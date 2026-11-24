// what the python server (automate/serve.py) answers

export type FileInfo = { name: string; loaded: boolean }

export type PartMesh = {
  name: string
  positions: string // base64 float32 xyz
  indices: string // base64 uint32
  faces: [face: number, triStart: number, triCount: number, vStart: number, vCount: number][]
  nfaces: number
}

export type Instance = { id: string; part: string; name: string; matrix: number[] }

export type Scene = { file: string; parts: Record<string, PartMesh>; instances: Instance[] }

export type Example = { label: string; instance: string; faces: number[] }

export type FaceInfo = { id: number; kind: 'plane' | 'cyl' | 'cone' | 'sphere' | 'other'; area: number; r?: number; side?: 'in' | 'out'; angle?: number }

export type Params = {
  gap_rel: number
  gap_max: number
  gap_min: number
  interference: number
  exact: number
  angle: number
  overlap: number
  collide: number
}

export type Fit = 'exact' | 'sliding' | 'interference'

export type Match = {
  instance: string
  part: string
  target_faces: Record<string, number[]>
  selected_to_target: { selected: number[]; target: number[]; kind: string; gap: number; overlap: number }[]
  fit: Fit
  motion: string
  dof: number
  clearance: number
  free_directions: number[][]
  stops: { faces: number[]; direction: number }[]
  symmetry: number
  confidence: 'high' | 'low'
  in_place: boolean
  no_contact: number[][]
  world: number[][] | null
}

export type Result = {
  selection: { instance: string; part: string; faces: number[]; surfaces: { faces: number[]; kind: string }[] }
  gap_band_mm: [number, number]
  params: Params
  matches: Match[]
  in_place_contacts: Match | null
  rejected: { part: string; faces: number[]; why: string }[]
  unchecked?: number
  too_loose?: boolean
  seconds: number
}

// a proxy that times out answers with a plain text page, not json
async function read<T>(r: Response): Promise<T> {
  const text = await r.text()
  let body: { error?: string } | null = null
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(r.status === 504 || r.status === 502 ? 'The server took too long. Try again in a moment.' : `Server error ${r.status}`)
  }
  if (!r.ok || body?.error) throw new Error(body?.error ?? r.statusText)
  return body as T
}

const get = async <T,>(url: string) => read<T>(await fetch(url))

const q = (file: string, more: Record<string, string> = {}) => new URLSearchParams({ file, ...more }).toString()

export const api = {
  files: () => get<FileInfo[]>('/api/files'),
  params: () => get<Params>('/api/params'),
  scene: (file: string) => get<Scene>(`/api/scene?${q(file)}`),
  examples: (file: string) => get<Example[]>(`/api/examples?${q(file)}`),
  faces: (file: string, instance: string) => get<FaceInfo[]>(`/api/faces?${q(file, { instance })}`),
  match: async (file: string, instance: string, faces: number[], params: Params) => {
    return read<Result>(await fetch('/api/match', { method: 'POST', body: JSON.stringify({ file, instance, faces, params }) }))
  },
}

// what a person calls each model, the file name stays in the menu as a hint
const TITLES: Record<string, string> = {
  'WM290V_RedrawStart.stp': 'Lathe',
  'wm290v_sim_model_2026-11-16.step': 'Lathe, sim model',
  'motor_mount_alt_A_2026-11-10.step': 'Motor mount',
  'bench_vice.stp': 'Bench vice',
  'chuck_4slot.step': '4 slot chuck',
  'keyed_shaft.step': 'Keyed shaft',
  'vice_dovetail.step': 'Dovetail slide',
  'pin_plate.step': 'Pin plate',
  'ball_socket.step': 'Ball and socket',
}
export const title = (file: string) => TITLES[file] ?? file.replace(/\.(step|stp)$/i, '').replaceAll('_', ' ')

// the last bit of an instance path, what a person calls it
export const short = (id: string) => id.split('/').pop() ?? id
