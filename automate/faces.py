"""face descriptors: every face reduced to an analytic primitive in its part frame"""
import math
from dataclasses import dataclass

import numpy as np
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.BRepClass import BRepClass_FaceClassifier
from OCP.BRepGProp import BRepGProp, BRepGProp_Face
from OCP.BRepTools import BRepTools
from OCP.GeomAbs import GeomAbs_SurfaceType as ST
from OCP.GProp import GProp_GProps
from OCP.ShapeAnalysis import ShapeAnalysis_CanonicalRecognition
from OCP.TopAbs import TopAbs_EDGE, TopAbs_IN, TopAbs_ON
from OCP.TopExp import TopExp, TopExp_Explorer
from OCP.collections import IndexedMap_TopoDS_Shape_TopTools_ShapeMapHasher as ShapeMap
from OCP.gp import gp_Cone, gp_Cylinder, gp_Pln, gp_Pnt, gp_Pnt2d, gp_Sphere, gp_Vec


def _v(p):
    return np.array([p.X(), p.Y(), p.Z()])


@dataclass
class Face:
    idx: int                 # 1-based face id within the part
    body: int
    kind: str                # plane, cyl, cone, sphere, other
    area: float
    centroid: np.ndarray
    pts: np.ndarray          # samples on the face
    nrm: np.ndarray          # outward normals at the samples
    n: np.ndarray = None     # plane normal (outward)
    d: float = 0.0           # plane offset, n.x = d
    axis: np.ndarray = None  # cyl / cone axis (cone: apex -> wide end)
    origin: np.ndarray = None  # point on axis (cone: apex), sphere centre
    r: float = 0.0
    alpha: float = 0.0       # cone half angle, radians
    sense: int = 0           # +1 convex (shaft, ball), -1 concave (bore, socket)
    recognized: bool = False  # came from a bspline via canonical recognition
    surf: int = -1           # merged surface id within the part
    geom: object = None      # gp_Pln / gp_Cylinder / ... in the part frame
    topo: object = None      # the TopoDS_Face


def _samples(face, n=9):
    u0, u1, v0, v1 = BRepTools.UVBounds_s(face)
    gp = BRepGProp_Face(face)
    clf = BRepClass_FaceClassifier()
    pts, nrm = [], []
    for i in range(n):
        for j in range(n):
            u = u0 + (u1 - u0) * (i + 0.5) / n
            v = v0 + (v1 - v0) * (j + 0.5) / n
            clf.Perform(face, gp_Pnt2d(u, v), 1e-7)
            if clf.State() not in (TopAbs_IN, TopAbs_ON):
                continue
            p, vec = gp_Pnt(), gp_Vec()
            gp.Normal(u, v, p, vec)
            m = vec.Magnitude()
            if m < 1e-12:
                continue
            pts.append(_v(p))
            nrm.append(_v(vec) / m)
    return np.array(pts).reshape(-1, 3), np.array(nrm).reshape(-1, 3)


def _surface(face):
    """analytic surface of a face, recovering it from bsplines when possible"""
    s = BRepAdaptor_Surface(face)
    t = s.GetType()
    if t == ST.GeomAbs_Plane:
        return "plane", s.Plane(), False
    if t == ST.GeomAbs_Cylinder:
        return "cyl", s.Cylinder(), False
    if t == ST.GeomAbs_Cone:
        return "cone", s.Cone(), False
    if t == ST.GeomAbs_Sphere:
        return "sphere", s.Sphere(), False
    if t in (ST.GeomAbs_BSplineSurface, ST.GeomAbs_BezierSurface,
             ST.GeomAbs_SurfaceOfExtrusion, ST.GeomAbs_SurfaceOfRevolution):
        cr = ShapeAnalysis_CanonicalRecognition(face)
        tol = 1e-3
        for kind, obj, fn in (("plane", gp_Pln(), cr.IsPlane), ("cyl", gp_Cylinder(), cr.IsCylinder),
                              ("cone", gp_Cone(), cr.IsCone), ("sphere", gp_Sphere(), cr.IsSphere)):
            try:
                if fn(tol, obj):
                    return kind, obj, True
            except Exception:
                pass
    return "other", None, False


def describe(face, idx, body=0):
    g = GProp_GProps()
    BRepGProp.SurfaceProperties_s(face, g)
    f = Face(idx, body, "other", g.Mass(), _v(g.CentreOfMass()), np.zeros((0, 3)), np.zeros((0, 3)))
    kind, geom, rec = _surface(face)
    if kind == "other":
        return f
    pts, nrm = _samples(face)
    if len(pts) == 0:
        pts, nrm = _samples(face, 25)
    if len(pts) == 0:
        return f
    f.pts, f.nrm = pts, nrm
    f.recognized, f.geom, f.topo = rec, geom, face
    mean_n = nrm.mean(axis=0)
    if kind == "plane":
        n = _v(geom.Axis().Direction())
        if np.dot(n, mean_n) < 0:
            n = -n
        f.n = n
        f.d = float(np.dot(n, pts.mean(axis=0)))
    elif kind in ("cyl", "cone"):
        ax = geom.Axis()
        a = _v(ax.Direction())
        if kind == "cyl":
            o = _v(ax.Location())
            f.r = geom.Radius()
        else:
            o = _v(geom.Apex())
            f.alpha = abs(geom.SemiAngle())
            # point the axis from the apex towards the wide end
            if np.dot(pts.mean(axis=0) - o, a) < 0:
                a = -a
        f.axis, f.origin = a, o
        rel = pts - o
        radial = rel - np.outer(rel @ a, a)
        f.sense = 1 if np.einsum("ij,ij->i", radial, nrm).mean() > 0 else -1
        if kind == "cone":
            # radius at the centroid, handy for printing only
            f.r = float(np.linalg.norm(radial, axis=1).mean())
    elif kind == "sphere":
        c = _v(geom.Location())
        f.origin, f.r = c, geom.Radius()
        f.sense = 1 if np.einsum("ij,ij->i", pts - c, nrm).mean() > 0 else -1
    f.kind = kind
    return f


def _same_surface(a, b, tol=1e-4, atol=1e-4):
    if a.kind != b.kind or a.body != b.body or a.sense != b.sense:
        return False
    if a.kind == "plane":
        return np.dot(a.n, b.n) > 1 - atol and abs(a.d - b.d) < tol
    if a.kind in ("cyl", "cone"):
        if abs(abs(np.dot(a.axis, b.axis)) - 1) > atol or abs(a.r - b.r) > tol and a.kind == "cyl":
            return False
        if a.kind == "cone":
            return np.dot(a.axis, b.axis) > 0 and abs(a.alpha - b.alpha) < atol and np.linalg.norm(a.origin - b.origin) < tol
        w = b.origin - a.origin
        return np.linalg.norm(w - np.dot(w, a.axis) * a.axis) < tol
    if a.kind == "sphere":
        return abs(a.r - b.r) < tol and np.linalg.norm(a.origin - b.origin) < tol
    return False


def _touch(f, g):
    """do two faces share an edge"""
    m = ShapeMap()
    TopExp.MapShapes_s(f, TopAbs_EDGE, m)
    ex = TopExp_Explorer(g, TopAbs_EDGE)
    while ex.More():
        if m.Contains(ex.Current()):
            return True
        ex.Next()
    return False


class Surface:
    """one or more faces of a part lying on the same analytic surface"""
    COPY = ("kind", "body", "n", "d", "axis", "origin", "r", "alpha", "sense", "recognized")

    def __init__(self, id, faces):
        self.id, self.faces = id, faces
        for k in self.COPY:
            setattr(self, k, getattr(faces[0], k))
        self.ids = [f.idx for f in faces]
        self.area = sum(f.area for f in faces)
        self.pts = np.vstack([f.pts for f in faces])
        self.nrm = np.vstack([f.nrm for f in faces])
        self.lo, self.hi = self.pts.min(axis=0), self.pts.max(axis=0)

    def __repr__(self):
        return f"Surface({self.kind} {self.ids})"


def describe_part(part):
    """face records + merged surfaces for a load.Part, cached on the part"""
    if getattr(part, "_faces", None) is None:
        fs = [describe(f, i + 1, part.body[i] if part.body else 0) for i, f in enumerate(part.faces)]
        # merge faces that lie on one surface and touch (cylinders split at the seam etc).
        # coplanar faces that dont touch stay apart, they are usually separate features
        root = list(range(len(fs)))

        def find(i):
            while root[i] != i:
                root[i] = root[root[i]]
                i = root[i]
            return i

        by_kind = {}
        for i, f in enumerate(fs):
            if f.kind != "other":
                by_kind.setdefault((f.kind, f.body, f.sense), []).append(i)
        for idx in by_kind.values():
            for x, i in enumerate(idx):
                for j in idx[x + 1:]:
                    if find(i) != find(j) and _same_surface(fs[i], fs[j]) and _touch(part.faces[i], part.faces[j]):
                        root[find(i)] = find(j)
        groups = {}
        for i, f in enumerate(fs):
            if f.kind != "other":
                groups.setdefault(find(i), []).append(f)
        surfs = []
        for members in groups.values():
            s = Surface(len(surfs), members)
            for f in members:
                f.surf = s.id
            surfs.append(s)
        part._faces, part._surfs = fs, surfs
    return part._faces, part._surfs


def line(f):
    out = f"#{f.idx:<4d} b{f.body} {f.kind:6s} A={f.area:9.2f} c={np.round(f.centroid, 2)}"
    if f.kind == "plane":
        out += f" n={np.round(f.n, 3)} d={f.d:.3f}"
    elif f.kind in ("cyl", "cone"):
        out += f" ax={np.round(f.axis, 3)} r={f.r:.3f} {'OUT' if f.sense > 0 else 'IN'}"
        if f.kind == "cone":
            out += f" ha={math.degrees(f.alpha):.2f}"
    elif f.kind == "sphere":
        out += f" r={f.r:.3f} {'OUT' if f.sense > 0 else 'IN'}"
    if f.recognized:
        out += " (rec)"
    return out + f" s{f.surf}"


if __name__ == "__main__":
    import sys
    from collections import Counter

    from .load import Assembly

    asm = Assembly(sys.argv[1])
    names = sys.argv[2:]
    for p in asm.parts.values():
        if names and p.name not in names:
            continue
        fs, ss = describe_part(p)
        print(f"== {p.name}: {len(fs)} faces, {len(ss)} surfaces, {dict(Counter(f.kind for f in fs))}")
        if names:
            for f in fs:
                print("  " + line(f))
