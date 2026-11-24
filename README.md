# automate

give it a STEP assembly and a few faces picked on one part. it finds every place in the assembly
where that face group fits, says which part each match is on, and whether it is an exact fit or a
sliding one.

![the viewer: chuck key tip selected, the three pinion sockets found, a ghost key in each](docs/viewer-chuck-key.jpg)

the write up (what it compares and why, what breaks, next steps) is in [WRITEUP.md](WRITEUP.md).
results for every test case are in [results/](results/README.md).

the lathe assembly from the assignment (`WM290V_RedrawStart.stp`, 22 MB) is in the repo root, so the
commands below work straight after a clone.

## how it works

![flow: the step file and the picked faces go in, every face is described, a search and an in place check run side by side, then checks, motion, and the list of places it fits](docs/flow.svg)

1. **describe every face.** each face in the file becomes a plane, cylinder, cone or ball with its exact size,
   axis and outward normal, read straight from the STEP, not from a mesh. a cylinder knows if it is a shaft or a
   hole.
2. **complement filter.** a picked face can only land on a face that could actually touch it: flat on flat facing
   the other way, shaft in a hole of about the same diameter, cone in a cone of the same angle. so the search
   only ever looks at faces that could touch, out of the 8257 in the lathe.
3. **search tree + pose.** the picked faces are a group, so the angles and distances between them have to show up
   again between the target faces. every set that passes is kept (not just the best one), and each gets the single
   rigid move that lays the part on it.
4. **where it sits now.** the same faces are also checked where the part already is, so the existing mate is
   marked `already here` instead of being a surprise.
5. **checks.** the faces must really overlap (not just lie on the same infinite plane), every gap must be inside a
   band that scales with the size of the picked faces, and the two solids must not run into each other.
6. **what it can still do.** from the faces in contact it works out what motion is left (locked, slides, turns) and
   whether a face closes off the slide, which is what splits an exact fit from a sliding one.

## why this approach

the file already says exactly what every face is: a plane, a 7.8 mm wide flat, a 20 mm hole. so the tool works on
that, with plain geometry, instead of guessing from points or pictures.

- **it finds every place, not one.** the assignment asks for all instances. a best fit method (ICP, RANSAC, a
  learned net that predicts one mate) gives one answer. here the search keeps every branch, so the key gets all 3
  chuck sockets and the countersunk screw gets all 8 holes in the motor plate.
- **it matches the group, not single faces.** one flat face matches every flat face in a lathe. four flats at right
  angles 7.8 mm apart match very little. that is why the 12x12 and 10x13 decoy pockets in the fixture chuck are left
  out and only the 4 real sockets come back.
- **it is exact where it needs to be.** sizes come from the surface equations, so a 0.2 mm clearance or a 71 vs 73
  degree belt flank is visible. the small pulley near miss is correctly reported as no fit.
- **every answer can be checked by hand.** each match lists which picked face landed on which target face and the gap
  on each, so a person can open the CAD and measure it. nothing is a score from a black box.
- **no training data and it is quick.** it runs on any STEP with no model to train. after the file is read, a search
  took 0.1 to 2 s in the viewer.
- **it does not care how the part is turned.** fixture parts are baked in at random rotations and the same answers come
  back, and the sim model (whole lathe at different world coordinates, key rotated) gives the same 3 sockets.

what it gives up, and the other options looked at, are in [WRITEUP.md](WRITEUP.md).

## setup

tested with python 3.13 on macOS (pyproject asks for 3.11+). the only real dependency is OpenCascade through
the `cadquery-ocp` wheels, no conda needed.

```sh
python3.13 -m venv .venv
.venv/bin/pip install cadquery-ocp-novtk numpy pytest
```

## find mates from the command line

```sh
# faces 2,4,16,18 of the part called Key (the square tip of the chuck key)
.venv/bin/python -m automate match WM290V_RedrawStart.stp --part Key --faces 2,4,16,18 --out key.json
```

```
  Key  faces 2 4 16 18  (4 flat)
  gap allowed -0.10 to 0.39 mm, took 14.3 s

  3 places it fits

      fits on                        fit     moves    gap
  1   Pinion M1.8 10T.1 [4 6 8 12]   exact   slides   +0.20 mm   8 ways   already here
  2   Pinion M1.8 10T.2 [4 6 8 12]   exact   slides   +0.20 mm   8 ways
  3   Pinion M1.8 10T.3 [4 6 8 12]   exact   slides   +0.20 mm   8 ways

  touching now   Pinion M1.8 10T.1 [4 6 8 12]

  full detail in key.json
```

one row per place the faces fit. `fits on` is the part copy and its face ids, `moves` is what the key can
still do once it is in (slide in and out of the socket), `gap` is the clearance on each face (here 0.2 mm
all round), `8 ways` is how many ways a square drops into a square socket, and `already here` is the socket
the key sits in today. long names are cut short, the json keeps the full instance path.

a run took 15 to 22 s here. reading the 22 MB file is about 3 to 5 s and describing all 8257 faces about
9 s, the search itself is the rest. in the viewer the assembly stays loaded, so a repeat search took
0.1 s (belt) to about 2 s (key).

- face ids are 1-based, in OpenCascade `TopExp.MapShapes` order on the part.
  `python -m automate faces <step> "<part>"` lists the faces of a part with type, size and normal.
- the assignment gives the input as a separate STEP of the single part. pass it with `--part-step key.step`
  and the face ids refer to that file. the tool finds the same part inside the assembly by its face list
  (checked with the key written out on its own: same 3 pinions). if no part has the same face list it
  stops with an error.
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
.venv/bin/python -m automate serve WM290V_RedrawStart.stp fixtures/chuck_4slot.step ...
# open http://127.0.0.1:8765
```

give it one or more STEP files, switch between them from the file menu in the top bar. each opens the
first time it is picked (the lathe took about 7 s), then stays loaded. the first search in a file also
describes its faces (about 9 s on the lathe), later ones are quick.

- click faces on one part to select them, click again to drop one. the inspector lists each face with its
  type and size (plane area, cylinder or cone diameter, cone angle, shaft or hole).
- **find mates** paints every match on the target faces (green exact, blue sliding, red interference),
  x-rays the rest and drops a see-through copy of your part at each match. the camera flies there.
- click a match card to fly to it and see the gap on each face pair and the face that stops the slide.
- every tolerance is a slider. let go of one and the search runs again, so you can watch a fit appear or
  vanish (drag clearance under 2.6% and the chuck key stops fitting its 0.2 mm sockets).
- the left side lists every part instance (search, hide, click to frame), with whatever the last search touched
  pinned on top, and a tab of saved example selections.
- light and dark, the moon at the top right. keys: `f` frame, `x` x-ray, `g` ghosts, `e` feature lines,
  `[` and `]` fold the side panels away (also the round buttons in the top bar) so the model gets the whole window.

![dark: countersunk screw head and shank, ghosted into all eight countersinks of the motor plate](docs/viewer-motor-mount.jpg)

the page is react + three.js (react three fiber) in a floating tool style: pills, ring cards, fill sliders,
inter, small accent colours. it lives in `web/` and the built copy in `web/dist` is committed, so the
python server is all you need. to work on it:

```sh
cd web && pnpm install
AUTOMATE_API=http://127.0.0.1:8765 pnpm dev   # vite on :5173, /api goes to the python server
pnpm build                                     # rewrites web/dist
```

## tests

```sh
scripts/fetch_external.sh        # the third party bench vice, it has no license so it isnt committed
.venv/bin/python -m pytest -q    # 17 tests, one to two minutes
```

the lathe tests use `WM290V_RedrawStart.stp` in the repo root, or set `LATHE_STEP=/path/to/file`.
the sim model and motor mount from the grabcad page (login needed) are looked for in `../assignment/grabcad/`
(unzip the grabcad download there, or set `GRABCAD_DIR`). tests for files that are missing are skipped.
`python scripts/run_all.py` reruns every case and rewrites `results/`.

`fixtures/make_fixtures.py` rebuilds the synthetic assemblies (plain OCP, no extra deps): a 4 slot
chuck with decoy pockets, a keyed shaft with two hubs, a dovetail slide with 0.2 mm clearance, a
shoulder pin over a bolt circle and a ball stud with two sockets and an oversize decoy. the chuck key,
the spare hub, the shoulder pin and the ball stud have their geometry baked in at a random rotation, so
the matcher cant lean on parts being axis aligned.
