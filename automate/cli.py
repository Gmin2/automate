"""automate match <assembly.step> --part NAME --faces 2,4,16,18 [--part-step part.step] [--out out.json]"""
import argparse
import json
import sys
import time

import numpy as np

from .faces import describe_part
from .load import Assembly
from .match import Matcher, Params


def signature(part):
    fs, _ = describe_part(part)
    return [(f.kind, round(f.area, 1)) for f in fs]


def find_twin(asm, part):
    """the assembly part with the same faces in the same order as a standalone part file"""
    sig = signature(part)
    for p in asm.parts.values():
        if len(p.faces) == len(sig) and signature(p) == sig:
            return p
    return None


def pick(asm, name, instance=None):
    cands = [i for i in asm.instances if i.part.name == name or i.id == name]
    if instance:
        cands = [i for i in cands if i.id == instance or i.id.endswith(instance)]
    if not cands:
        names = sorted({i.part.name for i in asm.instances})
        sys.exit(f"no part called {name!r}. parts: {names}")
    return cands[0]


KIND = {"plane": "flat", "cyl": "cylinder", "cone": "cone", "sphere": "ball"}
MOVES = {"fixed": "locked", "prismatic": "slides", "revolute": "turns", "cylindrical": "slides + turns",
         "planar": "slides on a plane", "spherical": "swivels"}


def short(id, room=36):
    name = id.rsplit("/", 1)[-1]
    stem, dot, n = name.rpartition(".")
    if not (dot and n.isdigit()):
        stem, n = name, ""
    if len(stem) > room:
        stem = stem[:room - 3].rstrip(" ,;") + "..."
    return stem + (f".{n}" if n else "")


def gap_text(gaps):
    lo, hi = round(min(gaps), 2) + 0.0, round(max(gaps), 2) + 0.0
    return f"{lo:+.2f} mm" if hi - lo < 0.005 else f"{lo:+.2f} to {hi:+.2f} mm"


def where(m):
    return "  ".join(f"{short(k)} [{' '.join(map(str, v))}]" for k, v in m.target_faces.items())


def report(inst, ids, sel, band, found, here, out, path=None):
    kinds = {}
    for s in sel:
        kinds[KIND[s.kind]] = kinds.get(KIND[s.kind], 0) + 1
    made = ", ".join(f"{n} {k}" for k, n in kinds.items())
    print(f"\n  {short(inst.part.name, 60)}  faces {' '.join(map(str, ids))}  ({made})")
    print(f"  gap allowed {band[0]:.2f} to {band[1]:.2f} mm, took {out['seconds']} s\n")
    if not found:
        print("  fits nowhere\n")
    else:
        rows = [(str(i + 1), where(m), m.fit, MOVES.get(m.motion, m.motion), gap_text(m.gaps),
                 f"{m.symmetry} ways" if m.symmetry > 1 else "",
                 "already here" if m.in_place else "")
                for i, m in enumerate(found)]
        head = ("", "fits on", "fit", "moves", "gap", "", "")
        w = [max(len(r[c]) for r in rows + [head]) for c in range(len(head))]
        line = lambda r: "  " + "   ".join(x.ljust(w[c]) for c, x in enumerate(r)).rstrip()
        print(f"  {len(found)} place{'s' if len(found) > 1 else ''} it fits\n")
        print(line(head))
        for r in rows:
            print(line(r))
        print()
    if found and found[0].confidence == "low":
        print("  low confidence: these faces alone leave the part free in 2+ ways, so many things fit\n")
    if here:
        print(f"  touching now   {where(here)}")
    if out["unchecked"]:
        print(f"  not checked    {out['unchecked']} poses kept without a collision check, the {out['params']['budget']:g} s budget ran out")
    for r in out["rejected"]:
        print(f"  ruled out      {short(r['part'])} [{' '.join(map(str, r['faces']))}]  {r['why']}")
    if path:
        print(f"\n  full detail in {path}")
    print()


def to_json(m):
    return {
        "instance": m.instance,
        "part": m.part,
        "target_faces": m.target_faces,
        "selected_to_target": [{"selected": s.ids, "target": t.ids, "kind": s.kind,
                                "gap": round(g, 4), "overlap": round(c, 2)}
                               for (s, t), g, c in zip(m.targets, m.gaps, m.overlap)],
        "fit": m.fit,
        "motion": m.motion,
        "dof": m.dof,
        "clearance": round(m.clearance, 4),
        "free_directions": [np.round(v, 4).tolist() for v in m.free],
        "stops": [{"faces": ids, "direction": d} for ids, d in m.stops],
        "symmetry": m.symmetry,
        "confidence": m.confidence,
        "in_place": m.in_place,
        "no_contact": m.partial,
        "world": np.round(m.world, 5).tolist() if m.world is not None else None,
    }


def run(args):
    t0 = time.time()
    asm = Assembly(args.assembly)
    params = Params(**{k: v for k, v in vars(args).items() if k in Params.__dataclass_fields__ and v is not None})
    ids = [int(x) for x in args.faces.split(",")]
    if args.part_step:
        solo = Assembly(args.part_step)
        twin = find_twin(asm, solo.instances[0].part)
        if twin is None:
            sys.exit("could not find that part inside the assembly (face lists differ)")
        inst = [i for i in asm.instances if i.part is twin][0]
    else:
        inst = pick(asm, args.part, args.instance)
    m = Matcher(asm, params)
    sel, band, found, here = m.run(inst, ids)
    out = {
        "assembly": str(args.assembly),
        "selection": {"part": inst.part.name, "instance": inst.id, "faces": ids,
                      "surfaces": [{"faces": s.ids, "kind": s.kind} for s in sel]},
        "gap_band_mm": [round(band[0], 4), round(band[1], 4)],
        "params": vars(params),
        "matches": [to_json(x) for x in found],
        "in_place_contacts": to_json(here) if here else None,
        "rejected": [{"part": p, "faces": f, "why": w} for p, f, w in m.rejected],
        "unchecked": m.unchecked,
        "seconds": round(time.time() - t0, 1),
    }
    text = json.dumps(out, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(text)
    if not args.quiet:
        report(inst, ids, sel, band, found, here, out, args.out)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(prog="automate", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    mp = sub.add_parser("match", help="find where a face group mates")
    mp.add_argument("assembly")
    mp.add_argument("--part", help="part name in the assembly")
    mp.add_argument("--instance", help="instance id when the part is used more than once")
    mp.add_argument("--part-step", help="standalone STEP of the selected part (face ids refer to it)")
    mp.add_argument("--faces", required=True, help="comma separated face ids, 1-based")
    mp.add_argument("--out", help="write json here")
    mp.add_argument("--quiet", action="store_true")
    for k, f in Params.__dataclass_fields__.items():
        mp.add_argument("--" + k.replace("_", "-"), dest=k, type=float)
    sp = sub.add_parser("serve", help="open the 3d viewer, for one or more assemblies")
    sp.add_argument("assembly", nargs="+")
    sp.add_argument("--port", type=int, default=8765)
    sp.add_argument("--host", default="127.0.0.1")
    sp.add_argument("--preload", action="store_true", help="load and describe every file before serving")
    lp = sub.add_parser("faces", help="list a part's faces")
    lp.add_argument("assembly")
    lp.add_argument("part", nargs="?")
    args = ap.parse_args(argv)
    if args.cmd == "serve":
        from pathlib import Path

        from .serve import serve
        ex = Path(__file__).resolve().parent.parent / "examples.json"
        examples = json.loads(ex.read_text()) if ex.exists() else {}
        serve(args.assembly, args.port, examples, args.host, args.preload)
        return
    if args.cmd == "match":
        if not args.part and not args.part_step:
            ap.error("need --part or --part-step")
        run(args)
    else:
        from .faces import line
        asm = Assembly(args.assembly)
        for p in asm.parts.values():
            if args.part and p.name != args.part:
                continue
            fs, ss = describe_part(p)
            print(f"== {p.name} ({len(fs)} faces, used {sum(i.part is p for i in asm.instances)}x)")
            if args.part:
                for f in fs:
                    print("  " + line(f))


if __name__ == "__main__":
    main()
