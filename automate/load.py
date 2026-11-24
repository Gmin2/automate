"""read a STEP assembly into a flat list of leaf bodies with world transforms"""
import re
from dataclasses import dataclass, field

from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDataStd import TDataStd_Name
from OCP.TDF import TDF_Label
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_FACE, TopAbs_SHELL, TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer
from OCP.TopExp import TopExp
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS
from OCP.XCAFDoc import XCAFDoc_DocumentTool, XCAFDoc_ShapeTool
from OCP.collections import IndexedMap_TopoDS_Shape_TopTools_ShapeMapHasher as ShapeMap
from OCP.collections import Sequence_TDF_Label as LabelSeq


@dataclass
class Part:
    """a unique body (prototype). faces are 1-based in TopExp.MapShapes order"""
    key: str
    name: str
    shape: object
    faces: list = field(default_factory=list)
    body: list = field(default_factory=list)   # body index per face (0-based), for compounds holding several solids
    solids: list = field(default_factory=list)  # the body shapes, indexed like body


@dataclass
class Instance:
    id: str          # unique path like "Assem1/Pinion M1.8 10T.2"
    part: Part
    loc: object      # TopLoc_Location, local -> world

    @property
    def name(self):
        return self.part.name


def _name(label):
    attr = TDataStd_Name()
    if label.FindAttribute(TDataStd_Name.GetID_s(), attr):
        return attr.Get().ToExtString()
    return ""


GENERIC = ("SOLID", "COMPOUND", "SHELL", "COMPSOLID", "FACE")


def _generic(name):
    return not name or name.startswith("=>") or name in GENERIC


def _bodies(shape):
    """which solid (or free shell) each face belongs to, plus those sub shapes in order"""
    fmap = ShapeMap()
    TopExp.MapShapes_s(shape, TopAbs_FACE, fmap)
    idx, subs = {}, []
    for kind in (TopAbs_SOLID, TopAbs_SHELL):
        ex = TopExp_Explorer(shape, kind)
        while ex.More():
            sub = ex.Current()
            new = [fmap.FindIndex(f) - 1 for f in face_list(sub)]
            new = [i for i in new if i >= 0 and i not in idx]
            if new:
                for i in new:
                    idx[i] = len(subs)
                subs.append(sub)
            ex.Next()
    return [idx.get(i, len(subs)) for i in range(fmap.Extent())], subs


def face_list(shape):
    m = ShapeMap()
    TopExp.MapShapes_s(shape, TopAbs_FACE, m)
    return [TopoDS.Face(m.FindKey(i)) for i in range(1, m.Extent() + 1)]


class Assembly:
    def __init__(self, path):
        self.path = path
        self.doc = TDocStd_Document(TCollection_ExtendedString("XmlOcaf"))
        r = STEPCAFControl_Reader()
        r.SetNameMode(True)
        if r.ReadFile(str(path)) != IFSelect_RetDone:
            raise IOError(f"cant read {path}")
        r.Transfer(self.doc)
        self.tool = XCAFDoc_DocumentTool.ShapeTool_s(self.doc.Main())
        self.parts = {}
        self.instances = []
        roots = LabelSeq()
        self.tool.GetFreeShapes(roots)
        for i in range(1, roots.Length() + 1):
            lab = roots.Value(i)
            self._walk(lab, TopLoc_Location(), [_name(lab) or "root"])

    def _walk(self, lab, loc, path):
        if XCAFDoc_ShapeTool.IsAssembly_s(lab):
            comps = LabelSeq()
            XCAFDoc_ShapeTool.GetComponents_s(lab, comps, False)
            for i in range(1, comps.Length() + 1):
                c = comps.Value(i)
                ref = TDF_Label()
                XCAFDoc_ShapeTool.GetReferredShape_s(c, ref)
                cloc = loc.Multiplied(XCAFDoc_ShapeTool.GetLocation_s(c))
                self._walk(ref, cloc, path + [_name(c) or _name(ref)])
            return
        shape = XCAFDoc_ShapeTool.GetShape_s(lab)
        faces = face_list(shape)
        if not faces:
            return
        entry = lab.EntryDumpToString() if hasattr(lab, "EntryDumpToString") else str(lab.Tag())
        part = self.parts.get(entry)
        if part is None:
            # catia wraps bodies in "=>[0:1:1:3]" children, name the part after the product
            name = _name(lab)
            if _generic(name):
                named = [p for p in path if not _generic(p)]
                name = named[-1] if named else "body"
                name = re.sub(r"\.\d+$", "", name)
            body, subs = _bodies(shape)
            part = Part(entry, name, shape, faces, body, subs)
            self.parts[entry] = part
        # name instances after their part when the file only has "=>[0:1:1:3]" style labels
        names = [p if not _generic(p) else "" for p in path[1:]]
        if not names or not names[-1]:
            k = sum(1 for i in self.instances if i.part is part) + 1
            names = [n for n in names if n] + [f"{part.name}.{k}"]
        iid = "/".join(names) or path[0]
        self.instances.append(Instance(iid, part, loc))

    def by_name(self, name):
        return [i for i in self.instances if i.part.name == name or i.id.endswith(name)]


if __name__ == "__main__":
    import sys
    import time

    t = time.time()
    asm = Assembly(sys.argv[1])
    print(f"loaded in {time.time() - t:.1f}s: {len(asm.parts)} parts, {len(asm.instances)} instances, "
          f"{sum(len(p.faces) for p in asm.parts.values())} faces")
    for inst in asm.instances:
        tr = inst.loc.Transformation().TranslationPart()
        print(f"  {inst.part.name:45s} {len(inst.part.faces):5d} b{max(inst.part.body)+1}  {inst.id}  t=({tr.X():.1f},{tr.Y():.1f},{tr.Z():.1f})")
