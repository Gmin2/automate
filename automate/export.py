"""tessellate parts for the web viewer, keeping which triangles belong to which face"""
import base64

import numpy as np
from OCP.Bnd import Bnd_Box
from OCP.BRep import BRep_Tool
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.TopAbs import TopAbs_REVERSED
from OCP.TopLoc import TopLoc_Location

from . import pose


def _b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def mesh_part(part):
    box = Bnd_Box()
    BRepBndLib.Add_s(part.shape, box)
    diag = box.CornerMin().Distance(box.CornerMax()) if not box.IsVoid() else 100
    BRepMesh_IncrementalMesh(part.shape, float(np.clip(diag * 0.001, 0.05, 0.5)), False, 0.3, True)
    pos, idx, ranges = [], [], []
    base = ntri = 0
    for i, f in enumerate(part.faces, start=1):
        L = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(f, L)
        if tri is None:
            continue
        tr = L.Transformation()
        nodes = []
        for k in range(1, tri.NbNodes() + 1):
            p = tri.Node(k)
            if not L.IsIdentity():
                p = p.Transformed(tr)
            nodes.append((p.X(), p.Y(), p.Z()))
        tris = np.array([tri.Triangle(k).Get() for k in range(1, tri.NbTriangles() + 1)], np.int64) - 1
        if f.Orientation() == TopAbs_REVERSED:
            tris = tris[:, [0, 2, 1]]
        # face id, first triangle, triangle count, first vertex, vertex count
        ranges.append([i, ntri, len(tris), base, len(nodes)])
        idx.append((tris + base).ravel())
        ntri += len(tris)
        pos.extend(nodes)
        base += len(nodes)
    pos = np.array(pos, np.float32).reshape(-1, 3)
    idx = np.concatenate(idx).astype(np.uint32) if idx else np.zeros(0, np.uint32)
    return {"name": part.name, "positions": _b64(pos), "indices": _b64(idx), "faces": ranges,
            "nfaces": len(part.faces)}


def scene(asm):
    parts, keys = {}, {}
    for k, part in enumerate(asm.parts.values()):
        keys[part.key] = f"p{k}"
        parts[f"p{k}"] = mesh_part(part)
    inst = [{"id": i.id, "part": keys[i.part.key], "name": i.part.name,
             "matrix": pose.loc_matrix(i.loc).T.ravel().round(6).tolist()}  # column major for three.js
            for i in asm.instances]
    return {"file": str(asm.path), "parts": parts, "instances": inst}
