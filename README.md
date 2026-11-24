# automate

give it a STEP assembly and a few faces picked on one part. it finds every place in the assembly
where that face group fits, says which part each match is on, and whether it is an exact fit or a
sliding one.

![chuck key into the three pinion sockets of the lathe chuck](results/lathe-chuck-key/screenshot.jpg)

the write up (what it compares and why, what breaks, next steps) is in [WRITEUP.md](WRITEUP.md).
results for every test case are in [results/](results/README.md).

## setup

python 3.11 to 3.13. the only real dependency is OpenCascade through the `cadquery-ocp` wheels, no conda needed.

```sh
python3.13 -m venv .venv
.venv/bin/pip install cadquery-ocp-novtk numpy pytest
```

## find mates from the command line

```sh
# faces 2,4,16,18 of the part called Key (the square tip of the chuck key)
.venv/bin/python -m automate match ../assignment/WM290V_RedrawStart.stp --part Key --faces 2,4,16,18 --out key.json
```

```
Key faces [2, 4, 16, 18] -> 3 match(es) in 18.7s
  TOS Svitavy 125.1/Assem1.1/Pinion M1.8 10T.1 (in place): faces {'TOS Svitavy 125.1/Assem1.1/Pinion M1.8 10T.1': [4, 6, 8, 12]} | fit=exact motion=prismatic dof=1 gaps=[+0.200, +0.200, +0.200, +0.200] x8 sym conf=high
  TOS Svitavy 125.1/Assem1.1/Pinion M1.8 10T.2: faces {'TOS Svitavy 125.1/Assem1.1/Pinion M1.8 10T.2': [4, 6, 8, 12]} | fit=exact motion=prismatic dof=1 gaps=[+0.200, +0.200, +0.200, +0.200] x8 sym conf=high
  TOS Svitavy 125.1/Assem1.1/Pinion M1.8 10T.3: faces {'TOS Svitavy 125.1/Assem1.1/Pinion M1.8 10T.3': [4, 6, 8, 12]} | fit=exact motion=prismatic dof=1 gaps=[+0.200, +0.200, +0.200, +0.200] x8 sym conf=high
  touching now: TOS Svitavy 125.1/Assem1.1/Pinion M1.8 10T.1 (in place): ...
```

most of the 18 s is reading the 22 MB file and describing all 8257 faces once. in the viewer the
assembly stays loaded and a repeat search takes 0.1 to 2 s (the slow part is the solid collision check).

- face ids are 1-based, in OpenCascade `TopExp.MapShapes` order on the part (same idea as FreeCAD `Face12`).
  `python -m automate faces <step> "<part>"` lists the faces of a part with type, size and normal.
- the assignment gives the input as a separate STEP of the single part. pass it with `--part-step key.step`
  and the face ids refer to that file. the tool finds the same part inside the assembly by its face list.
- `--instance` picks one copy when a part is used more than once.
- every threshold is a flag: `--gap-rel --gap-max --gap-min --interference --exact --angle --overlap --collide`.

### what comes back

`matches.json` has one entry per place the group fits:

| field | meaning |
|---|---|
| `instance`, `part`, `target_faces` | where it fits, as face ids per part instance |
| `selected_to_target` | which selected face lands on which target face, the gap (mm, + is clearance) and how much of it overlaps |
| `fit` | `exact`, `sliding` or `interference` (rule in the write up) |
| `motion`, `dof`, `free_directions` | what the selected part can still do once mated: fixed, prismatic, revolute, cylindrical, planar, spherical |
| `stops` | faces that close off a free direction (the bottom of a socket) |
| `symmetry` | how many ways the group drops into the same spot (a square key: 8) |
| `in_place` | this is where the part already sits in the assembly |
| `confidence` | `low` when the selection alone leaves 2+ dof (a single bore), so lots of things will fit |
| `world` | 4x4 pose the selected part would have at this match |

`in_place_contacts` lists what the selection touches right now, across parts, including partial contact.
`rejected` lists face matches thrown out because the solids would run into each other.

## viewer

```sh
.venv/bin/python -m automate serve ../assignment/WM290V_RedrawStart.stp
# open http://127.0.0.1:8765
```

click faces on one part to select them (click again to drop one), then **find mates**. matches are
painted on the target parts (green exact, blue sliding, red interference) and a translucent copy of
your part is drawn at each match. the examples menu has the test selections. three.js is pulled
from unpkg, so the page needs internet the first time.

## tests

```sh
scripts/fetch_external.sh        # the third party bench vice, it has no license so it isnt committed
.venv/bin/python -m pytest -q    # 14 tests, ~20 s
```

the lathe tests look for `../assignment/WM290V_RedrawStart.stp`, or set `LATHE_STEP=/path/to/file`.
`python scripts/run_all.py` reruns every case and rewrites `results/`.

`fixtures/make_fixtures.py` rebuilds the synthetic assemblies (plain OCP, no extra deps): a 4 slot
chuck with decoy pockets, a keyed shaft with two hubs, a dovetail slide with 0.2 mm clearance, a
shoulder pin over a bolt circle and a ball stud with two sockets and an oversize decoy. floating parts
have their geometry baked in at a random rotation so nothing leans on parts being axis aligned.

## layout

```
automate/load.py     STEP -> parts, instances, world transforms, bodies (XCAF)
automate/faces.py    every face -> plane / cylinder / cone / sphere with outward normal and sense
automate/pose.py     transforms, signed distance to each primitive, kabsch, screw theory dof
automate/match.py    the search: complement filter, pair tables, interpretation tree, pose, checks
automate/export.py   per face tessellation for the viewer
automate/serve.py    local server for the viewer
automate/cli.py      command line
viewer/              three.js page
fixtures/            synthetic assemblies + their expected answers (cases.json)
tests/               pytest
results/             json + screenshots for every case
```
