import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const COLORS = {
  base: new THREE.Color("#c9ced6"),
  sel: new THREE.Color("#f97316"),
  exact: new THREE.Color("#16a34a"),
  sliding: new THREE.Color("#2563eb"),
  interference: new THREE.Color("#dc2626"),
};
const $ = (id) => document.getElementById(id);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene3 = new THREE.Scene();
scene3.background = new THREE.Color("#eef0f2");
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 1e6);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene3.add(new THREE.HemisphereLight(0xffffff, 0x8a8f98, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
camera.add(sun);
sun.position.set(1, 2, 3);
scene3.add(camera);

const b64 = (s, T) => new T(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer);

let parts = {};      // key -> {geometry attrs, faces}
let meshes = [];     // one per instance
let byId = {};
let ghosts = [];
let selection = { inst: null, faces: new Set() };
let result = null;
let xray = false;

async function load() {
  const [sc, ex] = await Promise.all([fetch("/api/scene").then((r) => r.json()),
                                      fetch("/api/examples").then((r) => r.json())]);
  $("file").textContent = `${sc.file} · ${sc.instances.length} parts`;
  for (const [key, p] of Object.entries(sc.parts)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(b64(p.positions, Float32Array), 3));
    g.setIndex(new THREE.BufferAttribute(b64(p.indices, Uint32Array), 1));
    g.computeVertexNormals();
    parts[key] = { ...p, g };
  }
  const box = new THREE.Box3();
  for (const inst of sc.instances) {
    const p = parts[inst.part];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", p.g.attributes.position);
    g.setAttribute("normal", p.g.attributes.normal);
    g.setIndex(p.g.index);
    const col = new Float32Array(p.g.attributes.position.count * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.05,
      side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: 1 });
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    m.matrix.fromArray(inst.matrix);
    m.userData = { inst, part: p };
    scene3.add(m);
    meshes.push(m);
    byId[inst.id] = m;
    m.updateMatrixWorld(true);
    g.computeBoundingBox();
    box.union(g.boundingBox.clone().applyMatrix4(m.matrix));
  }
  paint();
  frame(box);
  if (ex.length) {
    $("examples-wrap").style.display = "";
    ex.forEach((e, i) => $("examples").add(new Option(e.label, i)));
    $("examples").onchange = () => {
      const e = ex[$("examples").value];
      if (!e) return;
      selection = { inst: e.instance, faces: new Set(e.faces) };
      run();
    };
  }
}

function faceAt(part, tri) {
  const f = part.faces;
  let lo = 0, hi = f.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (f[mid][1] <= tri) lo = mid; else hi = mid - 1;
  }
  return f[lo];
}

function colorFace(mesh, faceId, color) {
  const rec = mesh.userData.part.faces.find((f) => f[0] === faceId);
  if (!rec) return;
  const a = mesh.geometry.attributes.color;
  for (let v = rec[3]; v < rec[3] + rec[4]; v++) a.setXYZ(v, color.r, color.g, color.b);
}

function paint() {
  const involved = new Set();
  for (const m of meshes) {
    const a = m.geometry.attributes.color;
    for (let v = 0; v < a.count; v++) a.setXYZ(v, COLORS.base.r, COLORS.base.g, COLORS.base.b);
  }
  if (result) {
    for (const r of result.matches) {
      for (const [inst, faces] of Object.entries(r.target_faces)) {
        if (!byId[inst]) continue;
        involved.add(inst);
        faces.forEach((f) => colorFace(byId[inst], f, COLORS[r.fit]));
      }
    }
    const here = result.in_place_contacts;
    if (here) for (const [inst, faces] of Object.entries(here.target_faces)) {
      if (!byId[inst]) continue;
      involved.add(inst);
      faces.forEach((f) => colorFace(byId[inst], f, COLORS[here.fit]));
    }
  }
  if (selection.inst && byId[selection.inst]) {
    involved.add(selection.inst);
    selection.faces.forEach((f) => colorFace(byId[selection.inst], f, COLORS.sel));
  }
  for (const m of meshes) {
    m.geometry.attributes.color.needsUpdate = true;
    const id = m.userData.inst.id;
    // x-ray: bystanders nearly vanish, matched parts go glassy so faces inside them show
    let op = 1;
    if (xray && involved.size) op = !involved.has(id) ? 0.06 : id === selection.inst ? 1 : 0.55;
    m.material.opacity = op;
    m.material.depthWrite = op === 1;
  }
  $("xray").classList.toggle("on", xray);
  const chips = [...selection.faces].sort((a, b) => a - b).map((f) => `<span class="chip">#${f}</span>`).join("");
  $("selection").innerHTML = selection.inst
    ? `<div>${byId[selection.inst]?.userData.inst.name ?? selection.inst}</div><div class="chips">${chips}</div>`
    : "click faces on one part to select them. click again to drop a face.";
  $("selection").className = selection.inst ? "" : "hint";
  $("run").disabled = !selection.faces.size;
}

function clearGhosts() {
  ghosts.forEach((g) => scene3.remove(g));
  ghosts = [];
}

function addGhost(match) {
  const src = byId[selection.inst];
  if (!src || !match.world || match.in_place) return null;
  const mat = new THREE.MeshStandardMaterial({ color: COLORS[match.fit], transparent: true, opacity: 0.35,
    depthWrite: false, side: THREE.DoubleSide });
  const g = new THREE.Mesh(src.userData.part.g, mat);
  g.matrixAutoUpdate = false;
  g.matrix.set(...match.world.flat());
  scene3.add(g);
  ghosts.push(g);
  return g;
}

function frame(box) {
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2 || 50;
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (!dir.lengthSq() || isNaN(dir.x)) dir.set(1, -1.2, 0.8).normalize();
  camera.position.copy(c).add(dir.multiplyScalar(r * 2.6));
  camera.near = r / 100;
  camera.far = r * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(c);
}

function frameMeshes(list) {
  const box = new THREE.Box3();
  for (const m of list) {
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix));
  }
  if (!box.isEmpty()) frame(box);
}

async function run() {
  if (!selection.faces.size) return;
  $("busy").style.display = "block";
  $("run").disabled = true;
  try {
    const res = await fetch("/api/match", { method: "POST",
      body: JSON.stringify({ instance: selection.inst, faces: [...selection.faces] }) });
    const out = await res.json();
    if (out.error) throw new Error(out.error);
    result = out;
    xray = true;
    showResults();
  } catch (e) {
    result = null;
    $("results-wrap").style.display = "";
    $("results-title").textContent = "error";
    $("results").innerHTML = `<div class="err">${e.message}</div>`;
  } finally {
    $("busy").style.display = "none";
    paint();
  }
}

function showResults() {
  clearGhosts();
  const ms = result.matches;
  $("results-wrap").style.display = "";
  $("results-title").textContent = `${ms.length} match${ms.length === 1 ? "" : "es"} · ${result.seconds}s`;
  const el = $("results");
  el.innerHTML = "";
  const items = ms.map((m) => ({ m, ghost: addGhost(m) }));
  if (result.in_place_contacts && !ms.some((m) => m.in_place)) {
    items.push({ m: { ...result.in_place_contacts, contactOnly: true }, ghost: null });
  }
  if (!items.length) el.innerHTML = `<div class="hint">nothing in this assembly fits that face group.</div>`;
  for (const { m, ghost } of items) {
    const div = document.createElement("div");
    div.className = "match";
    const gaps = m.selected_to_target.map((p) => p.gap.toFixed(3)).join(", ");
    const faces = Object.entries(m.target_faces).map(([k, v]) => `${k.split("/").pop()}: ${v.join(", ")}`).join(" · ");
    div.innerHTML = `
      <div class="name">${m.instance.split("/").pop()}</div>
      <div class="meta"><span class="badge ${m.fit}">${m.fit}</span>${m.motion} · ${m.dof} dof${m.symmetry > 1 ? ` · ${m.symmetry} ways` : ""}
        ${m.in_place ? `<span class="badge ghost">in place</span>` : ""}${m.confidence === "low" ? `<span class="badge ghost">low confidence</span>` : ""}
        ${m.contactOnly ? `<span class="badge ghost">touching now, partial</span>` : ""}</div>
      <div class="meta">faces ${faces}</div>
      <div class="meta">gaps ${gaps} mm${m.stops.length ? ` · stop on face ${m.stops.map((s) => s.faces.join("/")).join(", ")}` : ""}</div>`;
    div.onclick = () => {
      document.querySelectorAll(".match").forEach((x) => x.classList.remove("active"));
      div.classList.add("active");
      const list = Object.keys(m.target_faces).map((k) => byId[k]).filter(Boolean);
      if (ghost) list.push(ghost);
      frameMeshes(list);
    };
    el.append(div);
  }
  if (result.rejected.length) {
    const d = document.createElement("details");
    d.innerHTML = `<summary>${result.rejected.length} rejected after the face check</summary><pre>${
      result.rejected.map((r) => `${r.part} ${r.faces.join(",")}: ${r.why}`).join("\n")}</pre>`;
    el.append(d);
  }
}

const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
function pick(ev) {
  mouse.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const vis = meshes.filter((m) => m.material.opacity > 0.3);
  const hit = ray.intersectObjects(vis, false)[0];
  if (!hit) return null;
  return { mesh: hit.object, face: faceAt(hit.object.userData.part, hit.faceIndex)[0] };
}

let down = null;
renderer.domElement.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  const p = pick(e);
  if (!p) return;
  const id = p.mesh.userData.inst.id;
  if (selection.inst !== id) selection = { inst: id, faces: new Set() };
  selection.faces.has(p.face) ? selection.faces.delete(p.face) : selection.faces.add(p.face);
  if (!selection.faces.size) selection.inst = null;
  result = null;
  clearGhosts();
  $("results-wrap").style.display = "none";
  paint();
});
renderer.domElement.addEventListener("pointermove", (e) => {
  const p = pick(e);
  const tip = $("tip");
  if (!p) return (tip.style.display = "none");
  tip.style.display = "block";
  tip.style.left = e.clientX + 14 + "px";
  tip.style.top = e.clientY + 10 + "px";
  tip.textContent = `${p.mesh.userData.inst.name} · face ${p.face}`;
});

$("run").onclick = run;
$("clear").onclick = () => {
  selection = { inst: null, faces: new Set() };
  result = null;
  xray = false;
  clearGhosts();
  $("results-wrap").style.display = "none";
  paint();
};
$("xray").onclick = () => { xray = !xray; paint(); };
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene3, camera); });
load();
