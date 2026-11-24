"""find every place in an assembly where a group of selected faces mates"""
import math
from dataclasses import dataclass, field
from types import SimpleNamespace

import numpy as np
from OCP.BRep import BRep_Tool
from OCP.BRepClass import BRepClass_FaceClassifier
from OCP.BRepTools import BRepTools
from OCP.ElSLib import ElSLib
from OCP.GeomAPI import GeomAPI_ProjectPointOnSurf
from OCP.TopAbs import TopAbs_IN, TopAbs_ON
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.TopAbs import TopAbs_SOLID
from OCP.TopLoc import TopLoc_Location
from OCP.gp import gp_Pnt, gp_Pnt2d, gp_Trsf

from . import pose
from .faces import describe_part


@dataclass
class Params:
    gap_rel: float = 0.05      # max clearance as a fraction of the selection's thinnest dimension
    gap_max: float = 1.0       # mm, hard cap on clearance
    gap_min: float = 0.05      # mm, clearance always allowed (cad nominal noise)
    interference: float = 0.1  # mm, overlap still accepted as a (press) fit
    exact: float = 0.01        # mm, |gap| under this is line-to-line
    angle: float = 0.5         # degrees
    overlap: float = 0.25      # fraction of selected samples that must land on the target face
    collide: float = 0.005     # reject a pose if the solids overlap by more than this share of the smaller one


@dataclass
class Match:
    instance: str
    part: str
    targets: list              # [(selected surface, target surface)]
    T: np.ndarray              # selected part frame -> target part frame (pose free) or world
    gaps: list
    overlap: list
    dof: int = 0
    motion: str = ""
    free: list = field(default_factory=list)
    stops: list = field(default_factory=list)
    fit: str = ""
    symmetry: int = 1
    in_place: bool = False
    world: np.ndarray = None   # where the selected part would sit, in world coords
    parts: list = field(default_factory=list)  # for in place matches spanning several parts
    clearance: float = 0.0
    confidence: str = "high"   # low when the selection alone leaves 2+ dof, so lots of things fit
    partial: list = field(default_factory=list)  # in place: selected surfaces with no contact

    @property
    def target_faces(self):
        out = {}
        for _, t in self.targets:
            out.setdefault(getattr(t, "owner", self.instance), []).extend(t.ids)
        return {k: sorted(set(v)) for k, v in out.items()}

    def summary(self):
        g = ", ".join(f"{x:+.3f}" for x in self.gaps)
        where = " (in place)" if self.in_place else ""
        sym = f" x{self.symmetry} sym" if self.symmetry > 1 else ""
        sym += f" conf={self.confidence}" + (f" partial(no contact: {self.partial})" if self.partial else "")
        return (f"{self.instance}{where}: faces {self.target_faces} | fit={self.fit} motion={self.motion} "
                f"dof={self.dof} gaps=[{g}]{sym}")


# ---------- surface helpers

def direction(s):
    if s.kind == "plane":
        return s.n
    if s.kind in ("cyl", "cone"):
        return s.axis
    return None


def mated_dir(t):
    """direction a selected surface's direction must map onto"""
    if t.kind == "plane":
        return -t.n
    if t.kind in ("cyl", "cone"):
        return t.axis
    return None


def moved(s, T):
    """copy of a surface's geometry under rigid T"""
    o = SimpleNamespace(kind=s.kind, sense=s.sense, r=s.r, alpha=s.alpha, ids=s.ids, body=s.body,
                        pts=pose.apply(T, s.pts), src=s)
    if s.kind == "plane":
        o.n = pose.rot(T, s.n)
        o.d = float(np.mean(o.pts @ o.n))
    if s.kind in ("cyl", "cone"):
        o.axis = pose.rot(T, s.axis)
    if s.origin is not None:
        o.origin = pose.apply(T, s.origin[None])[0]
    return o


def inside(surf, pts, tol=1e-6):
    """fraction of points (part frame) whose projection lands inside one of the surface's faces"""
    hits = np.zeros(len(pts), bool)
    clf = BRepClass_FaceClassifier()
    for f in surf.faces:
        u0, u1, v0, v1 = BRepTools.UVBounds_s(f.topo)
        proj = None
        if f.recognized:
            proj = GeomAPI_ProjectPointOnSurf()
            proj.Init(BRep_Tool.Surface_s(f.topo), u0, u1, v0, v1)
        for i, p in enumerate(pts):
            if hits[i]:
                continue
            gp = gp_Pnt(*p)
            if proj is None:
                u, v = ElSLib.Parameters_s(f.geom, gp)
                if f.kind != "plane":
                    while u < u0 - 1e-9:
                        u += 2 * math.pi
                    while u > u0 + 2 * math.pi:
                        u -= 2 * math.pi
            else:
                proj.Perform(gp)
                if not proj.NbPoints():
                    continue
                u, v = proj.LowerDistanceParameters()
            clf.Perform(f.topo, gp_Pnt2d(u, v), 1e-4)
            hits[i] = clf.State() in (TopAbs_IN, TopAbs_ON)
    return hits.mean() if len(pts) else 0.0


# ---------- the search

class Matcher:
    def __init__(self, asm, params=None):
        self.asm = asm
        self.p = params or Params()
        self.cos = math.cos(math.radians(self.p.angle))
        self.rejected = []

    def selection(self, inst, face_ids):
        _, surfs = describe_part(inst.part)
        faces = {f.idx: f for f in inst.part._faces}
        sel = []
        for i in face_ids:
            f = faces[i]
            if f.kind == "other":
                raise ValueError(f"face {i} of {inst.part.name} is not plane/cyl/cone/sphere")
            s = surfs[f.surf]
            if s not in sel:
                sel.append(s)
        return sel

    def gap_band(self, sel):
        # scale clearance by the selection's thinnest dimension (a key's cross section, a pin's
        # diameter), not its length, or long parts get sloppy tolerances
        pts = np.vstack([s.pts for s in sel])
        c = pts - pts.mean(axis=0)
        ext = np.ptp(c @ np.linalg.svd(c, full_matrices=False)[2].T, axis=0)
        ext = ext[ext > 1e-3]
        size = float(ext.min()) if len(ext) else 1.0
        gmax = min(self.p.gap_max, max(self.p.gap_min, self.p.gap_rel * size))
        return -self.p.interference, gmax

    # unary: a target surface is the complement of the selected one
    def compatible(self, s, t, band):
        if s.kind != t.kind:
            return False
        if s.kind == "plane":
            return True
        if s.sense == t.sense:
            return False
        if s.kind == "cone":
            return abs(s.alpha - t.alpha) < math.radians(self.p.angle)
        g = (t.r - s.r) if s.sense > 0 else (s.r - t.r)
        return band[0] <= g <= band[1]

    # pairwise: rigid relations inside the selection must survive the mapping
    def consistent(self, si, sj, ti, tj, band):
        lo, hi = band
        di, dj = direction(si), direction(sj)
        if di is not None and dj is not None:
            a = float(di @ dj)
            b = float(mated_dir(ti) @ mated_dir(tj))
            if "cyl" in (si.kind, sj.kind):
                a, b = abs(a), abs(b)
            if abs(math.acos(max(-1, min(1, a))) - math.acos(max(-1, min(1, b)))) > math.radians(2 * self.p.angle):
                return False
        if si.kind == sj.kind == "plane":
            c = float(si.n @ sj.n)
            if c < -self.cos:
                slack = -(ti.d + tj.d) - (si.d + sj.d)
                return 2 * lo - 1e-6 <= slack <= 2 * hi + 1e-6
            if c > self.cos:
                slack = (tj.d - ti.d) + (sj.d - si.d)
                return abs(slack) <= hi - lo + 1e-6
        kinds = {si.kind, sj.kind}
        if kinds == {"plane", "cyl"}:
            (sp, tp), (sc, tc) = ((si, ti), (sj, tj)) if si.kind == "plane" else ((sj, tj), (si, ti))
            if abs(float(sp.n @ sc.axis)) < 1 - self.cos + 1e-3:
                h = sp.d - float(sp.n @ sc.origin)
                ht = tp.d - float(tp.n @ tc.origin)
                return lo - hi - 1e-6 <= -(h + ht) <= 2 * hi + 1e-6
        if si.kind == sj.kind == "cyl" and abs(float(si.axis @ sj.axis)) > self.cos:
            w = sj.origin - si.origin
            ds = np.linalg.norm(w - (w @ si.axis) * si.axis)
            w = tj.origin - ti.origin
            dt = np.linalg.norm(w - (w @ ti.axis) * ti.axis)
            return abs(ds - dt) <= 2 * hi + 1e-6
        return True

    def order(self, sel):
        rank = {"sphere": 0, "cone": 1, "cyl": 2, "plane": 3}
        rest = sorted(sel, key=lambda s: (rank[s.kind], -s.area))
        out = [rest.pop(0)]
        while rest:
            # next: the one most constrained by what is already placed
            def score(s):
                d = direction(s)
                return -sum(1 for o in out if d is not None and direction(o) is not None
                            and abs(float(d @ direction(o))) > self.cos)
            rest.sort(key=lambda s: (score(s), rank[s.kind]))
            out.append(rest.pop(0))
        return out

    def assignments(self, sel, targets, band):
        """every consistent assignment of target surfaces to the selection (interpretation tree)"""
        cands = [[t for t in targets if self.compatible(s, t, band)] for s in sel]
        if any(not c for c in cands):
            return []
        # pairwise tables up front, the tree then only intersects boolean rows
        ok = {}
        for k in range(1, len(sel)):
            for i in range(k):
                ok[i, k] = self._table(sel[i], sel[k], cands[i], cands[k], band)
        out = []

        def grow(k, chosen):
            if k == len(sel):
                out.append([cands[i][c] for i, c in enumerate(chosen)])
                return
            mask = np.ones(len(cands[k]), bool)
            for i in range(k):
                mask &= ok[i, k][chosen[i]]
            for b in np.flatnonzero(mask):
                chosen.append(b)
                grow(k + 1, chosen)
                chosen.pop()

        grow(0, [])
        return out

    def _table(self, si, sj, ci, cj, band):
        lo, hi = band
        same = np.array([[a is b for b in cj] for a in ci]) if ci and cj else np.zeros((len(ci), len(cj)), bool)
        if si.kind == sj.kind == "plane":
            Ni, Nj = np.array([t.n for t in ci]), np.array([t.n for t in cj])
            di, dj = np.array([t.d for t in ci]), np.array([t.d for t in cj])
            c = float(si.n @ sj.n)
            ang = np.degrees(np.arccos(np.clip(Ni @ Nj.T, -1, 1)))
            ok = np.abs(ang - math.degrees(math.acos(max(-1, min(1, c))))) <= 2 * self.p.angle
            if c < -self.cos:
                slack = -(di[:, None] + dj[None, :]) - (si.d + sj.d)
                ok &= (slack >= 2 * lo - 1e-6) & (slack <= 2 * hi + 1e-6)
            elif c > self.cos:
                slack = (dj[None, :] - di[:, None]) + (sj.d - si.d)
                ok &= np.abs(slack) <= hi - lo + 1e-6
            return ok & ~same
        ok = np.array([[self.consistent(si, sj, a, b, band) for b in cj] for a in ci], bool).reshape(len(ci), len(cj))
        return ok & ~same

    def solve(self, sel, tgt):
        """rigid T taking the selection onto its targets, one per cylinder axis sign choice"""
        cyl = [i for i, s in enumerate(sel) if s.kind == "cyl"]
        out = []
        for signs in range(1 << len(cyl)):
            src, dst = [], []
            for i, (s, t) in enumerate(zip(sel, tgt)):
                d = direction(s)
                if d is None:
                    continue
                m = mated_dir(t)
                if i in cyl and (signs >> cyl.index(i)) & 1:
                    m = -m
                src.append(d)
                dst.append(m)
            R = self._rotation(src, dst)
            if R is None:
                continue
            rows, rhs = [], []
            for s, t in zip(sel, tgt):
                if s.kind == "plane":
                    rows.append(t.n)
                    rhs.append(s.d + t.d)
                elif s.kind == "cyl":
                    for u in pose.perp(t.axis):
                        rows.append(u)
                        rhs.append(u @ (t.origin - R @ s.origin))
                else:
                    for e in np.eye(3):
                        rows.append(e)
                        rhs.append(e @ (t.origin - R @ s.origin))
            A, b = np.array(rows), np.array(rhs)
            tr = np.linalg.lstsq(A, b, rcond=None)[0]
            # slide along unconstrained directions so the faces overlap
            _, S, Vt = np.linalg.svd(A)
            rank = int((S > 1e-9).sum())
            null = Vt[rank:]
            if len(null):
                src_c = np.vstack([s.pts for s in sel]) @ R.T + tr
                dst_c = np.vstack([t.pts for t in tgt])
                delta = dst_c.mean(axis=0) - src_c.mean(axis=0)
                tr = tr + null.T @ (null @ delta)
            T = np.eye(4)
            T[:3, :3], T[:3, 3] = R, tr
            out.append(T)
        return out

    def _rotation(self, src, dst):
        if not src:
            return np.eye(3)
        src, dst = np.array(src), np.array(dst)
        if np.linalg.matrix_rank(src, tol=1e-3) >= 2:
            R = pose.kabsch(src, dst)
        else:
            a, b = src[0], dst[0]
            v, c = np.cross(a, b), float(a @ b)
            if c < -1 + 1e-9:
                u = pose.perp(a)[0]
                R = 2 * np.outer(u, u) - np.eye(3)
            else:
                vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
                R = np.eye(3) + vx + vx @ vx / (1 + c)
        if np.abs(src @ R.T - dst).max() > math.radians(2 * self.p.angle):
            return None
        return R

    def verify(self, sel, tgt, T, band):
        lo, hi = band
        gaps, cover = [], []
        xs = [pose.apply(T, s.pts) for s in sel]
        for x, t in zip(xs, tgt):
            # cheap reject: the moved faces must at least reach the target's bounding box
            if (x.max(axis=0) < t.lo - hi - 1e-3).any() or (x.min(axis=0) > t.hi + hi + 1e-3).any():
                return None
        for x, t in zip(xs, tgt):
            sd = pose.signed_dist(t, x)
            if np.percentile(sd, 10) < lo - 1e-6 or np.percentile(sd, 90) > hi + 1e-6:
                return None
            cov = inside(t, x)
            if cov < self.p.overlap:
                return None
            gaps.append(float(np.median(sd)))
            cover.append(float(cov))
        return gaps, cover

    def classify(self, m, sel_pts, body_surfs):
        """dof from the contact set, then seated vs sliding from stop faces"""
        k, label, trans, rots = pose.dof([t for _, t in m.targets])
        m.dof, m.motion, m.free = k, label, trans
        stops = []
        blocked = True
        tag = lambda t: (getattr(t, "owner", None), tuple(t.ids))
        used = {tag(t) for _, t in m.targets}
        tpts = np.vstack([t.pts for _, t in m.targets])
        for u in trans:
            L = np.ptp(sel_pts @ u)
            tu = tpts @ u
            hit = None
            for sgn in (1, -1):
                for c in body_surfs:
                    if tag(c) in used or c.kind != "plane" or float(c.n @ (sgn * u)) > -self.cos:
                        continue
                    # a stop closes off the far end of the mated faces, facing the oncoming part
                    pos = float(np.mean(c.pts @ u))
                    end = tu.max() if sgn > 0 else tu.min()
                    if abs(pos - end) <= max(0.5, 0.1 * L) and _footprint(sel_pts, c.pts, u) >= 0.2:
                        hit = (c.ids, sgn)
                        break
                if hit:
                    break
            if hit:
                stops.append(hit)
            else:
                blocked = False
        m.stops = stops
        # sliding: something can still translate and no stop face catches it.
        # free rotation only counts as sliding (a running fit) when there is real clearance;
        # a gap on a cone pair isnt clearance, the cone just isnt pushed fully home
        clear = any(g > self.p.exact for g, (s, _) in zip(m.gaps, m.targets) if s.kind != "cone")
        if min(m.gaps) < -self.p.exact:
            m.fit = "interference"
        elif not blocked or (rots and clear):
            m.fit = "sliding"
        else:
            m.fit = "exact"
        m.clearance = max(m.gaps)
        return m

    # ---------- the two passes

    def collides(self, sel_part, sel_body, T, part, body):
        """overlap volume if the selected body placed by T runs into the target body, else 0"""
        if not self.p.collide:
            return 0
        try:
            a, b = sel_part.solids[sel_body], part.solids[body]
        except IndexError:
            return 0
        if a.ShapeType() != TopAbs_SOLID or b.ShapeType() != TopAbs_SOLID:
            return 0
        tr = gp_Trsf()
        tr.SetValues(*T[:3, :4].ravel())
        common = BRepAlgoAPI_Common(a.Moved(TopLoc_Location(tr)), b)
        if not common.IsDone():
            return 0
        v = _volume(common.Shape())
        return v if v > self.p.collide * min(_volume(a, True), _volume(b, True)) else 0

    def place(self, sel_part, sel, tgt, T, band, part, body):
        """use the free dof (slide, spin) to find a pose where the solids dont collide,
        keeping the faces on each other"""
        _, _, trans, rots = pose.dof(tgt)
        steps = [0.0]
        if len(trans) == 1:
            L = float(np.ptp(pose.apply(T, np.vstack([s.pts for s in sel])) @ trans[0])) or 1.0
            steps += [sg * k * L / 8 for k in range(1, 9) for sg in (1, -1)]
        spins = [np.eye(4)]
        if rots:
            pivot = next((t.origin for t in tgt if t.kind in ("sphere", "cone", "cyl")), None)
            if pivot is not None:
                spins += [_spin(a, pivot, ang) for a in rots for ang in np.radians(range(45, 360, 45))]
                if len(rots) == 3:
                    rng = np.random.default_rng(0)
                    spins += [_spin(v / np.linalg.norm(v), pivot, ang)
                              for v, ang in zip(rng.normal(size=(40, 3)), rng.uniform(0, 2 * np.pi, 40))]
        for S in spins:
            for s in steps:
                T2 = S @ T
                if s:
                    T2[:3, 3] += s * trans[0]
                ok = self.verify(sel, tgt, T2, band)
                if ok and not self.collides(sel_part, sel[0].body, T2, part, body):
                    return T2, ok
        return None

    def pose_free(self, sel_inst, sel, band):
        results = []
        sel_pts = np.vstack([s.pts for s in sel])
        for part in self.asm.parts.values():
            _, surfs = describe_part(part)
            bodies = {}
            for s in surfs:
                bodies.setdefault(s.body, []).append(s)
            for body, targets in bodies.items():
                # every verified pose, grouped by the target faces it lands on. symmetric
                # variants (a square key turned 90 deg, flipped end for end) share a group
                groups = {}
                for tgt in self.assignments(sel, targets, band):
                    for T in self.solve(sel, tgt):
                        ok = self.verify(sel, tgt, T, band)
                        if ok:
                            key = frozenset(id(t) for t in tgt)
                            groups.setdefault(key, []).append((sum(abs(g) for g in ok[0]), tgt, T))
                # the solid check is the slow bit, so only run it until one variant places
                found = []
                for variants in groups.values():
                    variants.sort(key=lambda v: v[0])
                    for _, tgt, T in variants:
                        placed = self.place(sel_inst.part, sel, tgt, T, band, part, body)
                        if placed:
                            found.append((len(variants), tgt, placed[0], *placed[1]))
                            break
                    else:
                        self.rejected.append((part.name, sorted(i for t in variants[0][1] for i in t.ids),
                                              "solids collide in every pose"))
                for sym, tgt, T, gaps, cov in found:
                    for inst in self.asm.instances:
                        if inst.part is not part:
                            continue
                        if inst is sel_inst and body == sel[0].body:
                            continue
                        m = Match(inst.id, part.name, list(zip(sel, tgt)), T, gaps, cov, symmetry=sym)
                        W = pose.loc_matrix(inst.loc)
                        m.world = W @ T
                        self.classify(m, pose.apply(T, sel_pts), targets)
                        results.append(m)
        return results

    def in_place(self, sel_inst, sel, band):
        lo, hi = band
        Ws = pose.loc_matrix(sel_inst.loc)
        world_sel = [moved(s, Ws) for s in sel]
        allpts = np.vstack([s.pts for s in world_sel])
        bmin, bmax = allpts.min(axis=0) - hi - 1, allpts.max(axis=0) + hi + 1
        contacts = []
        for inst in self.asm.instances:
            _, surfs = describe_part(inst.part)
            W = pose.loc_matrix(inst.loc)
            for t in surfs:
                if inst is sel_inst and t.body == sel[0].body:
                    continue
                tp = pose.apply(W, t.pts)
                if len(tp) == 0 or (tp.max(axis=0) < bmin).any() or (tp.min(axis=0) > bmax).any():
                    continue
                tw = moved(t, W)
                tw.owner, tw.faces = inst.id, t.faces
                for s, sw in zip(sel, world_sel):
                    if not self.compatible(s, t, band):
                        continue
                    d, m = direction(sw), mated_dir(tw)
                    if d is not None:
                        c = abs(float(d @ m)) if s.kind == "cyl" else float(d @ m)
                        if c < self.cos:
                            continue
                    sd = pose.signed_dist(tw, sw.pts)
                    if np.percentile(sd, 10) < lo - 1e-6 or np.percentile(sd, 90) > hi + 1e-6:
                        continue
                    cov = inside(t, pose.apply(pose.inv(W), sw.pts))
                    if cov < self.p.overlap:
                        continue
                    contacts.append((s, tw, float(np.median(sd)), cov, inst))
        if not contacts:
            return None
        m = Match(sel_inst.id, sel_inst.part.name, [(s, t) for s, t, *_ in contacts], np.eye(4),
                  [c[2] for c in contacts], [c[3] for c in contacts], in_place=True)
        m.world = Ws
        touched = {id(c[0]) for c in contacts}
        m.partial = [s.ids for s in sel if id(s) not in touched]
        m.parts = sorted({c[4].id for c in contacts})
        m.instance = ", ".join(m.parts)
        m.part = ", ".join(sorted({c[4].part.name for c in contacts}))
        # stop faces can sit on any body we touch
        near = []
        for inst in {id(c[4]): c[4] for c in contacts}.values():
            W = pose.loc_matrix(inst.loc)
            bodies = {t.body for s, t, *_ in contacts if getattr(t, "owner", None) == inst.id}
            for t in describe_part(inst.part)[1]:
                if t.body in bodies:
                    tw = moved(t, W)
                    tw.owner = inst.id
                    near.append(tw)
        self.classify(m, allpts, near)
        return m

    def run(self, inst, face_ids):
        sel = self.selection(inst, face_ids)
        band = self.gap_band(sel)
        found = self.pose_free(inst, sel, band)
        here = self.in_place(inst, sel, band)
        conf = "low" if pose.dof(sel)[0] >= 2 else "high"
        for m in found + ([here] if here else []):
            m.confidence = conf
        if here:
            touching = {(k, tuple(v)) for k, v in here.target_faces.items()}
            for m in found:
                if all((k, tuple(v)) in touching for k, v in m.target_faces.items()):
                    m.in_place = True
        found.sort(key=lambda m: (not m.in_place, m.instance))
        return sel, band, found, here


def _spin(axis, pivot, ang):
    """rotation by ang about an axis through pivot, as a 4x4"""
    a = np.asarray(axis) / np.linalg.norm(axis)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    R = np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
    S = np.eye(4)
    S[:3, :3], S[:3, 3] = R, pivot - R @ pivot
    return S


def _footprint(sel_pts, stop_pts, u):
    """fraction of stop face samples inside the selection's shadow along u"""
    a, b = pose.perp(u)
    P = np.c_[sel_pts @ a, sel_pts @ b]
    Q = np.c_[stop_pts @ a, stop_pts @ b]
    lo, hi = P.min(axis=0), P.max(axis=0)
    return float(np.all((Q >= lo) & (Q <= hi), axis=1).mean())


_vol = {}


def _volume(shape, cache=False):
    if cache and id(shape) in _vol:
        return _vol[id(shape)][1]
    g = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, g)
    v = abs(g.Mass())
    if cache:
        _vol[id(shape)] = (shape, v)  # keep the shape alive so its id stays unique
    return v
