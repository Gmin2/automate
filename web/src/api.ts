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
  seconds: number
}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url)
  const body = await r.json()
  if (!r.ok || body?.error) throw new Error(body?.error ?? r.statusText)
  return body as T
}

const q = (file: string, more: Record<string, string> = {}) => new URLSearchParams({ file, ...more }).toString()

export const api = {
  files: () => get<FileInfo[]>('/api/files'),
  params: () => get<Params>('/api/params'),
  scene: (file: string) => get<Scene>(`/api/scene?${q(file)}`),
  examples: (file: string) => get<Example[]>(`/api/examples?${q(file)}`),
  faces: (file: string, instance: string) => get<FaceInfo[]>(`/api/faces?${q(file, { instance })}`),
  match: async (file: string, instance: string, faces: number[], params: Params) => {
    const r = await fetch('/api/match', { method: 'POST', body: JSON.stringify({ file, instance, faces, params }) })
    const body = await r.json()
    if (!r.ok || body?.error) throw new Error(body?.error ?? r.statusText)
    return body as Result
  },
}

// the last bit of an instance path, what a person calls it
export const short = (id: string) => id.split('/').pop() ?? id
