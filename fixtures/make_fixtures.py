# synthetic mating fixtures with known ground truth
import json, sys
from build123d import *

out = sys.argv[1] if len(sys.argv) > 1 else "."
truth = {}

def save(name, parts):
    asm = Compound(children=parts, label=name)
    export_step(asm, f"{out}/{name}.step")

# keyed shaft, din 6885 for d=20: b=6 h=6 t1=3.5 t2=2.8
d, L, b, h, t1 = 20, 80, 6, 6, 3.5
shaft = Cylinder(d / 2, L, align=(Align.CENTER, Align.CENTER, Align.MIN))
shaft -= Box(b, t1 + 1, 30, align=(Align.CENTER, Align.MIN, Align.MIN)).moved(Location((0, d / 2 - t1, 25)))
shaft.label = "shaft"
key = Box(b, h, 30, align=(Align.CENTER, Align.MIN, Align.MIN)).moved(Location((0, d / 2 - t1, 25)))
key.label = "key"
hub = Cylinder(25, 30, align=(Align.CENTER, Align.CENTER, Align.MIN)) - Cylinder(d / 2, 30, align=(Align.CENTER, Align.CENTER, Align.MIN))
hub -= Box(b, h, 30, align=(Align.CENTER, Align.MIN, Align.MIN)).moved(Location((0, d / 2 - t1, 0)))
hub = hub.moved(Location((0, 0, 25)))
hub.label = "hub"
save("keyed_shaft", [shaft, key, hub])
truth["keyed_shaft"] = {"key side faces": {"shaft": "exact", "hub": "exact"}, "hub bore": {"shaft": "exact (coaxial, same r)"}}

# vice: dovetail rail on body, jaw slides on it with gap g
g = 0.2
w_top, w_bot, ht = 30, 40, 10   # dovetail: narrow at top of rail? use wider at top
def dovetail(wt, wb, hh, length):
    prof = Polygon((-wb / 2, 0), (wb / 2, 0), (wt / 2, hh), (-wt / 2, hh), align=None)
    return extrude(Plane.YZ * prof, length)
body = Box(120, 60, 20, align=(Align.MIN, Align.CENTER, Align.MAX))
body += dovetail(40, 30, 10, 120)            # rail wider at top -> real dovetail
body.label = "vice_body"
jaw = Box(30, 60, 30, align=(Align.MIN, Align.CENTER, Align.MIN)).moved(Location((60, 0, 0)))
jaw -= dovetail(40 + 2 * g, 30 + 2 * g, 10 + g, 30).moved(Location((60, 0, 0)))
jaw.label = "sliding_jaw"
save("vice_dovetail", [body, jaw])
truth["vice_dovetail"] = {"jaw groove faces": {"vice_body": f"sliding, gap {g} on flanks"}}

# chuck: 4 square key sockets in radial pattern, plus a decoy round hole
chuck = Cylinder(80, 40, align=(Align.CENTER, Align.CENTER, Align.MIN))
sock = Box(15, 10, 10, align=(Align.MAX, Align.CENTER, Align.CENTER)).moved(Location((80, 0, 20)))
for i in range(4):
    chuck -= sock.rotate(Axis.Z, 90 * i)
chuck -= Cylinder(5, 15).moved(Location((0, 0, 40)))
chuck.label = "chuck_body"
ckey = Box(10, 10, 40, align=(Align.CENTER, Align.CENTER, Align.MIN)).moved(Location((0, 0, 100)))
ckey.label = "chuck_key"
save("chuck_4slot", [chuck, ckey])
truth["chuck_4slot"] = {"chuck_key 4 side faces": {"chuck_body": "exact, 4 instances; round hole is a decoy"}}

json.dump(truth, open(f"{out}/ground_truth.json", "w"), indent=2)
print("ok")
