import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, MeshBVH } from 'three-mesh-bvh'
import type { Match, PartMesh, Scene } from './api'
import { setHover, toggleFace, useApp } from './store'

THREE.Mesh.prototype.raycast = acceleratedRaycast
;(THREE.BufferGeometry.prototype as unknown as { computeBoundsTree: typeof computeBoundsTree }).computeBoundsTree = computeBoundsTree

// the faces take the transit accents; dark gets its own ground and brighter parts
const PALETTE = {
  light: { base: '#d9dce1', line: '#3d424a', selected: '#ff8d28', exact: '#34c759', sliding: '#0088ff', interference: '#ff383c' },
  dark: { base: '#8b9099', line: '#15171a', selected: '#ff9a3d', exact: '#3ddc68', sliding: '#54b0fa', interference: '#ff5a5e' },
} as const
type Palette = (typeof PALETTE)['light'] | (typeof PALETTE)['dark']
let COLORS: Palette = PALETTE.light

const b64 = <T extends Float32Array | Uint32Array>(s: string, T: new (b: ArrayBuffer) => T) => {
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new T(bytes.buffer)
}

type Part = { mesh: PartMesh; geo: THREE.BufferGeometry; edges: THREE.BufferGeometry | null; bvh: MeshBVH }
type Built = { group: THREE.Group; meshes: Map<string, THREE.Mesh>; parts: Map<string, Part>; boxes: Map<string, THREE.Box3> }

const noRay = () => {}
const LINE = 0.8
const lineMat = () => new THREE.LineBasicMaterial({ color: COLORS.line, transparent: true, opacity: LINE })

function build(scene: Scene): Built {
  const parts = new Map<string, Part>()
  for (const [key, p] of Object.entries(scene.parts)) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(b64(p.positions, Float32Array), 3))
    geo.setIndex(new THREE.BufferAttribute(b64(p.indices, Uint32Array), 1))
    geo.computeVertexNormals()
    geo.computeBoundingBox()
    geo.computeBoundingSphere()
    parts.set(key, { mesh: p, geo, edges: null, bvh: new MeshBVH(geo, { indirect: true }) })  // indirect keeps the index in order, the face ranges depend on it
  }
  const group = new THREE.Group()
  const meshes = new Map<string, THREE.Mesh>()
  const boxes = new Map<string, THREE.Box3>()
  for (const inst of scene.instances) {
    const part = parts.get(inst.part)
    if (!part) continue
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', part.geo.getAttribute('position'))
    g.setAttribute('normal', part.geo.getAttribute('normal'))
    g.setIndex(part.geo.index)
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(part.geo.getAttribute('position').count * 3), 3))
    g.boundingBox = part.geo.boundingBox
    g.boundingSphere = part.geo.boundingSphere
    ;(g as unknown as { boundsTree: MeshBVH }).boundsTree = part.bvh
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.06, side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    const m = new THREE.Mesh(g, mat)
    m.matrixAutoUpdate = false
    m.matrix.fromArray(inst.matrix)
    m.matrixWorldNeedsUpdate = true
    m.userData = { inst: inst.id, part: inst.part }
    group.add(m)
    meshes.set(inst.id, m)
    boxes.set(inst.id, part.geo.boundingBox!.clone().applyMatrix4(m.matrix))
  }
  return { group, meshes, parts, boxes }
}

function edgesOf(part: Part) {
  if (!part.edges) part.edges = new THREE.EdgesGeometry(part.geo, 28)
  return part.edges
}

// which face a triangle belongs to: the ranges are sorted by first triangle
function faceAt(p: PartMesh, tri: number) {
  const f = p.faces
  let lo = 0
  let hi = f.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (f[mid]![1] <= tri) lo = mid
    else hi = mid - 1
  }
  return f[lo]![0]
}

const tmp = new THREE.Color()

function fill(m: THREE.Mesh, part: PartMesh, face: number | null, color: string) {
  const a = m.geometry.getAttribute('color') as THREE.BufferAttribute
  tmp.set(color)
  if (face === null) {
    for (let v = 0; v < a.count; v++) a.setXYZ(v, tmp.r, tmp.g, tmp.b)
    return
  }
  const rec = part.faces.find((f) => f[0] === face)
  if (!rec) return
  for (let v = rec[3]; v < rec[3] + rec[4]; v++) a.setXYZ(v, tmp.r, tmp.g, tmp.b)
}

// every face that gets a colour, per instance, from the selection and the result
function painted(sel: { inst: string | null; faces: number[] }, matches: Match[], here: Match | null, active: number | null) {
  const out = new Map<string, Map<number, string>>()
  const put = (inst: string, face: number, c: string) => {
    if (!out.has(inst)) out.set(inst, new Map())
    out.get(inst)!.set(face, c)
  }
  if (here && !matches.some((m) => m.in_place)) for (const [k, fs] of Object.entries(here.target_faces)) fs.forEach((f) => put(k, f, COLORS[here.fit]))
  matches.forEach((m, i) => {
    // with one match picked, the others fade back towards the base colour
    const c = active === null || active === i ? COLORS[m.fit] : '#' + new THREE.Color(COLORS[m.fit]).lerp(new THREE.Color(COLORS.base), 0.65).getHexString()
    for (const [k, fs] of Object.entries(m.target_faces)) fs.forEach((f) => put(k, f, c))
  })
  if (sel.inst) sel.faces.forEach((f) => put(sel.inst!, f, COLORS.selected))
  return out
}

function Assembly({ scene }: { scene: Scene }) {
  const built = useMemo(() => build(scene), [scene])
  const selection = useApp((s) => s.selection)
  const result = useApp((s) => s.result)
  const active = useApp((s) => s.active)
  const hidden = useApp((s) => s.hidden)
  const xray = useApp((s) => s.xray)
  const showGhosts = useApp((s) => s.ghosts)
  const edges = useApp((s) => s.edges)
  const theme = useApp((s) => s.theme)
  COLORS = PALETTE[theme]
  const hoverKey = useApp((s) => (s.hover ? `${s.hover.inst}\u0000${s.hover.face}` : ''))
  const paintRef = useRef(new Map<string, Map<number, string>>())
  const ghostGroup = useMemo(() => new THREE.Group(), [])
  const lines = useRef(new WeakMap<THREE.Mesh, THREE.LineSegments>())

  useEffect(() => () => {
    built.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    })
    for (const p of built.parts.values()) {
      p.geo.dispose()
      p.edges?.dispose()
    }
  }, [built])

  // feature lines, built the first time they are asked for
  useEffect(() => {
    for (const m of built.meshes.values()) {
      let l = lines.current.get(m)
      if (edges && !l) {
        l = new THREE.LineSegments(edgesOf(built.parts.get(m.userData.part)!), lineMat())
        l.raycast = noRay
        m.add(l)
        lines.current.set(m, l)
      }
      if (l) l.visible = edges
    }
  }, [built, edges])

  // colours and opacity
  useEffect(() => {
    const matches = result?.matches ?? []
    const map = painted(selection, matches, result?.in_place_contacts ?? null, active)
    paintRef.current = map
    const involved = new Set(map.keys())
    for (const [id, m] of built.meshes) {
      const part = built.parts.get(m.userData.part)!.mesh
      fill(m, part, null, COLORS.base)
      for (const [f, c] of map.get(id) ?? []) fill(m, part, f, c)
      ;(m.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
      let op = 1
      if (xray && involved.size) op = !involved.has(id) ? 0.07 : id === selection.inst ? 1 : 0.5
      const mat = m.material as THREE.MeshStandardMaterial
      mat.opacity = op
      mat.depthWrite = op === 1
      m.visible = !hidden[id]
      m.raycast = op < 0.3 ? noRay : THREE.Mesh.prototype.raycast
      const l = lines.current.get(m)
      if (l) {
        const lm = l.material as THREE.LineBasicMaterial
        lm.opacity = op < 1 ? op * 0.45 : LINE
        lm.color.set(COLORS.line)
      }
    }
  }, [built, selection, result, active, hidden, xray, edges, theme])

  // the face under the pointer, a shade darker
  useEffect(() => {
    if (!hoverKey) return
    const [inst, f] = hoverKey.split('\u0000')
    const m = built.meshes.get(inst!)
    if (!m) return
    const face = Number(f)
    const part = built.parts.get(m.userData.part)!.mesh
    const base = paintRef.current.get(inst!)?.get(face) ?? COLORS.base
    fill(m, part, face, '#' + new THREE.Color(base).multiplyScalar(0.8).getHexString())
    const a = m.geometry.getAttribute('color') as THREE.BufferAttribute
    a.needsUpdate = true
    return () => {
      fill(m, part, face, paintRef.current.get(inst!)?.get(face) ?? COLORS.base)
      a.needsUpdate = true
    }
  }, [built, hoverKey])

  // a see-through copy of the selected part at every match
  useEffect(() => {
    ghostGroup.clear()
    const src = selection.inst ? built.meshes.get(selection.inst) : null
    if (!src || !result || !showGhosts) return
    const part = built.parts.get(src.userData.part)!
    // past a couple dozen the copies just pile into a blob, then only the open match gets one
    const crowd = result.matches.length > 24
    result.matches.forEach((m, i) => {
      if (!m.world || m.in_place) return
      if (crowd && active !== i) return
      const on = active === null || active === i
      const mat = new THREE.MeshStandardMaterial({ color: COLORS[m.fit], transparent: true, opacity: on ? 0.34 : 0.1, depthWrite: false, side: THREE.DoubleSide, roughness: 0.4 })
      const g = new THREE.Mesh(part.geo, mat)
      g.matrixAutoUpdate = false
      g.matrix.set(...(m.world.flat() as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]))
      g.raycast = noRay
      g.userData = { ghost: i }
      const l = new THREE.LineSegments(edgesOf(part), new THREE.LineBasicMaterial({ color: COLORS[m.fit], transparent: true, opacity: on ? 0.7 : 0.2 }))
      l.raycast = noRay
      g.add(l)
      ghostGroup.add(g)
    })
    return () => {
      ghostGroup.children.forEach((g) => {
        ;((g as THREE.Mesh).material as THREE.Material).dispose()
        g.children.forEach((l) => ((l as THREE.LineSegments).material as THREE.Material).dispose())
      })
    }
  }, [built, result, selection.inst, showGhosts, active, ghostGroup, theme])

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const m = e.object as THREE.Mesh
    if (!m.userData?.inst || e.faceIndex == null) return null
    return { inst: m.userData.inst as string, face: faceAt(built.parts.get(m.userData.part)!.mesh, e.faceIndex) }
  }

  return (
    <>
      <primitive
        object={built.group}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return
          e.stopPropagation()
          const p = pick(e)
          if (p) toggleFace(p.inst, p.face)
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          const p = pick(e)
          setHover(p ? { ...p, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } : null)
        }}
        onPointerOut={() => setHover(null)}
      />
      <primitive object={ghostGroup} />
      <Framer built={built} ghosts={ghostGroup} />
    </>
  )
}

// moves the camera when the store asks: the whole assembly on load, matched parts after a search
function Framer({ built, ghosts }: { built: Built; ghosts: THREE.Group }) {
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const focusReq = useApp((s) => s.focus)
  const first = useRef(true)

  useEffect(() => {
    if (!controls) return
    const box = new THREE.Box3()
    const ids = focusReq.all || !focusReq.instances.length ? [...built.boxes.keys()] : focusReq.instances
    for (const id of ids) {
      const b = built.boxes.get(id)
      if (b) box.union(b)
    }
    // ghosts are added in an effect, give them a frame
    const go = () => {
      for (const g of ghosts.children) {
        if (!focusReq.ghosts.includes(g.userData.ghost)) continue
        const mesh = g as THREE.Mesh
        if (mesh.geometry.boundingBox) box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix))
      }
      if (box.isEmpty()) return
      const sphere = box.getBoundingSphere(new THREE.Sphere())
      // the side panels float over the canvas: fit into the open middle, not the whole width
      const w = size.width
      const { leftOpen, rightOpen, phone } = useApp.getState()
      if (phone) {
        // a sheet covers the bottom of the screen, fit into what is left above it
        const h = size.height
        const free = h - (leftOpen || rightOpen ? h * SHEET : 0)
        // a phone is narrow, so the width limits the fit more than the height does
        sphere.radius *= Math.min(h / free, 2.2) * (free === h ? 1.0 : 0.9)
      } else {
        const open = Math.max(w - (leftOpen ? PANEL_L : 0) - (rightOpen ? PANEL_R : 0), 320)
        // a bounding sphere is loose round long parts, so it can come in a little
        sphere.radius *= Math.min(w / open, 1.45) * 0.72
      }
      const r = Math.max(sphere.radius, 1)
      camera.near = r / 200
      camera.far = r * 400
      camera.updateProjectionMatrix()
      if (first.current) {
        first.current = false
        const c = sphere.center
        controls.setLookAt(c.x + r * 1.6, c.y - r * 2.2, c.z + r * 1.4, c.x, c.y, c.z, false)
      }
      controls.fitToSphere(sphere, true)
    }
    const t = requestAnimationFrame(go)
    return () => cancelAnimationFrame(t)
  }, [focusReq, built, controls])

  useEffect(() => { first.current = true }, [built])
  return null
}

// how much of the canvas each open side column covers
const PANEL_L = 312
const PANEL_R = 342
// share of the screen height a bottom sheet takes on a phone
const SHEET = 0.52

// keeps the picture centred in the space the panels leave, easing over as one opens or shuts
function ViewShift() {
  const left = useApp((s) => s.leftOpen)
  const right = useApp((s) => s.rightOpen)
  const phone = useApp((s) => s.phone)
  const shift = useRef(0)
  const lift = useRef(0)
  useFrame(({ camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera
    // side panels push the picture sideways, a phone sheet pushes it up
    const want = phone ? 0 : ((left ? PANEL_L : 0) - (right ? PANEL_R : 0)) / 2
    const wantUp = phone && (left || right) ? (size.height * SHEET) / 2 : 0
    const ease = (cur: number, to: number) => { const n = cur + (to - cur) * 0.14; return Math.abs(to - n) < 0.2 ? to : n }
    shift.current = ease(shift.current, want)
    lift.current = ease(lift.current, wantUp)
    const v = cam.view
    if (!v || Math.abs(v.offsetX + shift.current) > 0.01 || Math.abs(v.offsetY - lift.current) > 0.01 || v.fullWidth !== size.width || v.fullHeight !== size.height) {
      cam.setViewOffset(size.width, size.height, -shift.current, lift.current, size.width, size.height)
    }
  })
  return null
}

function CameraLight() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const light = useMemo(() => new THREE.DirectionalLight('#ffffff', 1.6), [])
  useEffect(() => {
    light.position.set(0.6, 1.2, 1.5)
    camera.add(light)
    scene.add(camera)
    return () => { camera.remove(light) }
  }, [camera, scene, light])
  return null
}

function Lights() {
  const dark = useApp((s) => s.theme === 'dark')
  return (
    <>
      <hemisphereLight args={['#ffffff', dark ? '#3a3d42' : '#aeb3bb', dark ? 1.1 : 1.35]} />
      <ambientLight intensity={dark ? 0.15 : 0.25} />
    </>
  )
}

export function Viewport() {
  const scene = useApp((s) => s.scene)
  return (
    <Canvas
      camera={{ fov: 32, up: [0, 0, 1], position: [300, -400, 300], near: 0.1, far: 1e6 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      onPointerMissed={() => setHover(null)}
    >
      <Lights />
      <CameraLight />
      <ViewShift />
      <CameraControls makeDefault smoothTime={0.32} draggingSmoothTime={0.08} dollyToCursor />
      {scene.state === 'ready' && <Assembly scene={scene.data} />}
    </Canvas>
  )
}
