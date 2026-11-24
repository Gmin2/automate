"""synthetic test assemblies with known answers, built with plain OCP so there is no extra dependency.

python fixtures/make_fixtures.py [outdir]

every floating part has its geometry baked in at a random rotation, so the matcher cant lean on
parts being axis aligned. near-miss decoys (wrong size, wrong shape, wrong angle) sit next to the
real targets and must not match.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakePolygon, BRepBuilderAPI_MakeFace, BRepBuilderAPI_Transform
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder, BRepPrimAPI_MakePrism, BRepPrimAPI_MakeSphere
from OCP.STEPCAFControl import STEPCAFControl_Writer
from OCP.STEPControl import STEPControl_AsIs
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDataStd import TDataStd_Name
from OCP.TDocStd import TDocStd_Document
from OCP.TopLoc import TopLoc_Location
from OCP.XCAFDoc import XCAFDoc_DocumentTool
from OCP.gp import gp_Ax2, gp_Dir, gp_Pnt, gp_Trsf, gp_Vec

rng = np.random.default_rng(7)


def box(x, y, z, dx, dy, dz):
    return BRepPrimAPI_MakeBox(gp_Pnt(x, y, z), dx, dy, dz).Shape()


def cyl(r, h, at=(0, 0, 0), axis=(0, 0, 1)):
    return BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(*at), gp_Dir(*axis)), r, h).Shape()


def sphere(r, at=(0, 0, 0)):
    return BRepPrimAPI_MakeSphere(gp_Pnt(*at), r).Shape()


def cut(a, *bs):
    for b in bs:
        a = BRepAlgoAPI_Cut(a, b).Shape()
    return a


def fuse(a, *bs):
    for b in bs:
        a = BRepAlgoAPI_Fuse(a, b).Shape()
    return a


def prism_yz(pts, x0, length):
    """extrude a polygon given in the yz plane along +x"""
    poly = BRepBuilderAPI_MakePolygon()
    for y, z in pts:
        poly.Add(gp_Pnt(x0, y, z))
    poly.Close()
    face = BRepBuilderAPI_MakeFace(poly.Wire()).Face()
    return BRepPrimAPI_MakePrism(face, gp_Vec(length, 0, 0)).Shape()


def trsf(T):
    tr = gp_Trsf()
    tr.SetValues(*np.asarray(T)[:3, :4].ravel())
    return tr


def bake(shape, T):
    """copy the geometry under T so the part frame itself is rotated"""
    return BRepBuilderAPI_Transform(shape, trsf(T), True).Shape()


def random_pose(at):
    q = rng.normal(size=4)
    q /= np.linalg.norm(q)
    w, x, y, z = q
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    T = np.eye(4)
    T[:3, :3], T[:3, 3] = R, at
    return T


def rotz(deg, at=(0, 0, 0)):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    T = np.eye(4)
    T[:2, :2] = [[c, -s], [s, c]]
    T[:3, 3] = at
    return T


def save(path, name, parts):
    """parts: [(name, shape, [4x4 locations])]. repeated locations become instances of one prototype"""
    doc = TDocStd_Document(TCollection_ExtendedString("XmlOcaf"))
    tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    root = tool.NewShape()
    TDataStd_Name.Set_s(root, TCollection_ExtendedString(name))
    for pname, shape, locs in parts:
        lab = tool.AddShape(shape, False)
        TDataStd_Name.Set_s(lab, TCollection_ExtendedString(pname))
        for k, T in enumerate(locs):
            comp = tool.AddComponent(root, lab, TopLoc_Location(trsf(T)))
            TDataStd_Name.Set_s(comp, TCollection_ExtendedString(f"{pname}.{k + 1}"))
    tool.UpdateAssemblies()
    w = STEPCAFControl_Writer()
    w.Transfer(doc, STEPControl_AsIs)
    w.Write(str(path))


def face_ids(shape, test):
    """1-based ids of the faces where test(c, n, p) holds: centroid, normal and a point on the face"""
    from OCP.BRepGProp import BRepGProp, BRepGProp_Face
    from OCP.BRepTools import BRepTools
    from OCP.GProp import GProp_GProps
    from OCP.TopAbs import TopAbs_FACE
    from OCP.TopExp import TopExp
    from OCP.TopoDS import TopoDS
    from OCP.collections import IndexedMap_TopoDS_Shape_TopTools_ShapeMapHasher as M
    m = M()
    TopExp.MapShapes_s(shape, TopAbs_FACE, m)
    out = []
    for i in range(1, m.Extent() + 1):
        f = TopoDS.Face(m.FindKey(i))
        g = GProp_GProps()
        BRepGProp.SurfaceProperties_s(f, g)
        c = g.CentreOfMass()
        u0, u1, v0, v1 = BRepTools.UVBounds_s(f)
        p, n = gp_Pnt(), gp_Vec()
        BRepGProp_Face(f).Normal((u0 + u1) / 2, (v0 + v1) / 2, p, n)
        n = np.array([n.X(), n.Y(), n.Z()])
        if test(np.array([c.X(), c.Y(), c.Z()]), n / (np.linalg.norm(n) or 1), np.array([p.X(), p.Y(), p.Z()])):
            out.append(i)
    return out


def chuck(out):
    """four radial square key sockets. decoys: round hole, 11 mm square pocket, 10x12 pocket"""
    body = cyl(80, 40)
    for k in range(4):
        body = cut(body, bake(box(65, -5, 15, 20, 10, 10), rotz(90 * k)))
    body = cut(body, cyl(5, 15, (0, 0, 25)), box(34, -6, 25, 12, 12, 15), box(-45, -6.5, 25, 10, 13, 15))
    T = random_pose((0, 0, 120))
    key = bake(box(-5, -5, 0, 10, 10, 40), T)
    sides = face_ids(key, lambda c, n, p: abs(n @ T[:3, 2]) < 0.1)
    save(out / "chuck_4slot.step", "chuck_4slot", [("chuck_body", body, [np.eye(4)]), ("chuck_key", key, [np.eye(4)])])
    return {"file": "chuck_4slot.step", "part": "chuck_key", "faces": sides,
            "expect": {"count": 4, "part": "chuck_body", "fit": "exact", "motion": "prismatic", "gap": 0.0},
            "note": "4 radial sockets; round hole, 12x12 pocket and 10x13 pocket are decoys"}


def keyed_shaft(out):
    """shaft with a blind keyway, key, and the same hub used twice (one on the shaft, one spare)"""
    shaft = cut(cyl(10, 80), box(-3, 6.5, 25, 6, 5, 30))
    key = box(-3, 6.5, 25, 6, 6, 30)
    hub = cut(cyl(25, 30), cyl(10, 30), box(-3, 6.5, 0, 6, 7, 30))
    sides_bottom = face_ids(key, lambda c, n, p: abs(n[0]) > 0.9 or n[1] < -0.9)
    sides_top = face_ids(key, lambda c, n, p: abs(n[0]) > 0.9 or n[1] > 0.9)
    bore = face_ids(hub, lambda c, n, p: abs(np.hypot(p[0], p[1]) - 10) < 0.01 and abs(n[2]) < 0.1)
    save(out / "keyed_shaft.step", "keyed_shaft",
         [("shaft", shaft, [np.eye(4)]), ("key", key, [np.eye(4)]),
          ("hub", hub, [rotz(0, (0, 0, 25)), random_pose((150, 40, 30))])])
    return [
        {"file": "keyed_shaft.step", "part": "key", "faces": sides_bottom,
         "expect": {"targets": {"shaft": ("exact", "prismatic"), "hub": ("sliding", "prismatic")}},
         "note": "key flipped also fits the through keyway of both hubs (sliding, no stop); shaft keyway is blind (exact)"},
        {"file": "keyed_shaft.step", "part": "hub", "faces": bore,
         "expect": {"targets": {"shaft": ("sliding", "cylindrical")}, "confidence": "low"},
         "note": "a bore alone is a 2 dof cylindrical fit, any 20 mm shaft would do"},
    ]


def dovetail(g):
    """rail cross section (y, z): 30 wide at the root, 40 at the top, 10 high. g offsets every
    face outward along its own normal so a groove cut with it keeps the flank angle"""
    lines = [((-15, 0), (15, 0)), ((15, 0), (20, 10)), ((20, 10), (-20, 10)), ((-20, 10), (-15, 0))]
    off = []
    for k, (a, b) in enumerate(lines):
        a, b = np.array(a, float), np.array(b, float)
        d = (b - a) / np.linalg.norm(b - a)
        n = np.array([d[1], -d[0]])  # outward for this winding
        s = 0 if k == 0 else g       # the bottom stays put
        off.append((a + s * n, d))
    pts = []
    for k in range(4):
        (p1, d1), (p2, d2) = off[k - 1], off[k]
        t = np.linalg.solve(np.c_[d1, -d2], p2 - p1)[0]
        pts.append(tuple(p1 + t * d1))
    return pts


def vice(out):
    g = 0.2
    body = fuse(box(0, -30, -20, 120, 60, 20), prism_yz(dovetail(0), 0, 120))
    jaw = cut(box(60, -30, 0, 30, 60, 30), prism_yz([(y, z - 0.01 if z < 0.01 else z) for y, z in dovetail(g)], 59, 32))
    groove = face_ids(jaw, lambda c, n, p: abs(c[1]) < 25 and c[2] < 12 and abs(n[0]) < 0.1)
    save(out / "vice_dovetail.step", "vice_dovetail", [("vice_body", body, [np.eye(4)]), ("sliding_jaw", jaw, [np.eye(4)])])
    return {"file": "vice_dovetail.step", "part": "sliding_jaw", "faces": groove,
            "expect": {"targets": {"vice_body": ("sliding", "prismatic")}, "gap": g},
            "note": f"jaw groove {g} mm clear of the rail on flanks and top, base sits on the body"}


def pin_plate(out):
    """six clearance holes on a bolt circle; decoys: a 10 mm hole and an 8.2 hole with no counterbore room"""
    plate = box(-60, -60, 0, 120, 120, 10)
    for k in range(6):
        a = math.radians(60 * k)
        plate = cut(plate, cyl(4.1, 10, (40 * math.cos(a), 40 * math.sin(a), 0)))
    plate = cut(plate, cyl(5, 10, (0, 0, 0)))
    T = random_pose((0, 0, 80))
    pin = bake(fuse(cyl(4, 30, (0, 0, -30)), cyl(7, 5)), T)
    ax = T[:3, 2]
    sel = face_ids(pin, lambda c, n, p: (abs(n @ ax) < 0.1 and abs(np.linalg.norm(np.cross(p - T[:3, 3], ax)) - 4) < 0.01)
                   or (n @ ax < -0.9 and abs((c - T[:3, 3]) @ ax) < 0.1))
    save(out / "pin_plate.step", "pin_plate", [("plate", plate, [np.eye(4)]), ("shoulder_pin", pin, [np.eye(4)])])
    return {"file": "pin_plate.step", "part": "shoulder_pin", "faces": sel,
            "expect": {"count": 12, "part": "plate", "fit": "sliding", "motion": "revolute", "gap": 0.1},
            "note": "shank + shoulder underside; 0.1 radial clearance so it is a running fit. 6 holes x either side of "
                    "the plate = 12. the 10 mm centre hole is a decoy"}


def ball(out):
    """two spherical sockets and a decoy one 2 mm bigger"""
    block = box(-60, -20, -20, 120, 40, 20)
    block = cut(block, sphere(10.1, (-30, 0, 0)), sphere(10.1, (0, 0, 0)), sphere(12, (30, 0, 0)))
    T = random_pose((0, 0, 60))
    b = bake(fuse(sphere(10), cyl(3, 25)), T)
    sel = face_ids(b, lambda c, n, p: abs(np.linalg.norm(p - T[:3, 3]) - 10) < 0.01)
    save(out / "ball_socket.step", "ball_socket", [("socket_block", block, [np.eye(4)]), ("ball_stud", b, [np.eye(4)])])
    return {"file": "ball_socket.step", "part": "ball_stud", "faces": sel,
            "expect": {"count": 2, "part": "socket_block", "motion": "spherical", "gap": 0.1},
            "note": "two 20.2 sockets match, the 24 mm one is too loose"}


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent)
    out.mkdir(parents=True, exist_ok=True)
    cases = [chuck(out), *keyed_shaft(out), vice(out), pin_plate(out), ball(out)]
    (out / "cases.json").write_text(json.dumps(cases, indent=2))
    for c in cases:
        print(c["file"], c["part"], c["faces"])
