# automate

pick a few faces on one part of a STEP assembly. this finds every other place in the assembly where
those faces fit, which part each one is on, and whether its an exact fit or a sliding one.

**try it:** https://automate.delightfulsky-d10b8c02.centralindia.azurecontainerapps.io
(the lathe and the test parts. open examples, pick one, press find mates)

![the viewer: chuck key tip picked, all three pinion sockets found, a see-through key at each](docs/viewer-chuck-key.jpg)

## how it works

![flow from the step file and picked faces to every place they fit](docs/flow.svg)

1. every face in the file becomes a plane, cylinder, cone or ball with its exact size and direction
2. only faces that could touch stay in: flat against flat, shaft in a hole of the same size, cone in cone
3. the picked faces are matched as a group. angles and distances between them have to show up again on the target
4. each match gets the move that puts the part there, then three checks: small enough gap, faces really overlap, solids dont crash
5. what the part can still do decides the fit (below)
6. a square key drops into a square socket 8 ways. those count as one match

## what it compares

- **type and side.** a shaft only pairs with a hole, a flat only with a flat facing it. this stops a key matching another key
- **size.** hole minus shaft has to sit in the gap band. cone angles within 0.5 degrees
- **layout.** for every two picked faces: the angle between them and the signed distance. the key flats are 7.8 mm apart with metal between, the socket walls 8.2 mm apart with air between. the sign is what makes it fit
- **overlap.** at least 25% of each face has to land on the target face, not just on the same endless plane
- **collision.** the whole part placed there cant run into the target by more than 0.5% of its volume. this kills the vice jaw flipped into the T-slot

the gap band is 5% of the thinnest size of the selection, at least 0.05 mm, at most 1 mm. the 7.8 mm key gets 0.39 mm. every number here is a flag and a slider in the viewer.

## exact vs sliding

the gap alone gets it wrong. the lathe key has 0.2 mm on every side but the assignment calls it exact. the real vice jaw has 0 gap but its the sliding example.

so it goes by motion:

- **exact**: the part is held, or its only free direction hits a stop face (the bottom of the socket)
- **sliding**: it can still slide and nothing stops it, or it spins with real clearance
- **interference**: gap below -0.01 mm

## results

| case | file | found |
|---|---|---|
| chuck key | lathe | 3 pinion sockets, exact, 0.2 mm gap |
| chuck key | grabcad sim model, key turned 11 deg | same 3, exact |
| key, 4 sockets + 3 decoy pockets | synthetic | 4 of 4, decoys ignored |
| belt in big pulley | lathe, sim model | groove, exact |
| belt on small pulley | lathe, sim model | no fit, belt V is 38 deg, groove 34 |
| taper bushes | lathe, sim model | each finds its own pulley |
| pulley bore on motor shaft | lathe | no fit. the model has a 20 mm bore on a 24 mm shaft, shown as -2 mm interference if allowed |
| bench vice jaw | real CATIA vice | base rails, sliding |
| keyed shaft | synthetic | shaft keyway exact (blind end), both hubs sliding (through) |
| countersunk screw | grabcad motor mount | all 8 holes, exact |
| pin, ball stud, dovetail | synthetic | all found, decoys ignored |

json for all 20 runs in [results/](results/README.md).

## why this way

- **finds every place**, not just the best one
- **matches the group**, so one flat face doesnt match every flat face in the machine
- **exact sizes** from the file, so a 0.2 mm gap or a 4 degree difference shows up
- **easy to check**. every match lists which face landed where and the gap on each
- **no training data**. works on any STEP file, at any angle

point clouds (ICP) and RANSAC throw away the exact sizes and return one answer. learned models like
AutoMate and JoinABLe need training data and predict one joint, not a full list with gaps.

## what breaks

- a lone hole fits any shaft its size. those come back marked low confidence
- gear teeth, spirals and cams arent planes, cylinders, cones or balls, so theyre skipped
- a fit looser than 5% of the part size is missed unless you move the slider
- the collision check needs solids. the lathe motor is surfaces only
- face numbers follow the file order

## with another week

- treat contacts as one sided, so "can be pushed in" is solved properly instead of with stop faces
- suggest the selection (socket walls + floor) so its one click
- spot patterns (bolt circles) and check the rest of the pattern first
- cache the face descriptions per file
- test against labelled joints from the Fusion 360 Gallery

## run it

the lathe from the assignment (`WM290V_RedrawStart.stp`) is in the repo root.

```sh
python3.13 -m venv .venv
.venv/bin/pip install cadquery-ocp-novtk numpy pytest
```

**command line**

```sh
.venv/bin/python -m automate match WM290V_RedrawStart.stp --part Key --faces 2,4,16,18
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
```

`already here` is where the key sits now. add `--out key.json` for the full detail.
`python -m automate faces <file> "<part>"` lists the faces of a part.

**viewer**

```sh
.venv/bin/python -m automate serve WM290V_RedrawStart.stp fixtures/*.step
# open http://127.0.0.1:8765
```

click faces, press find mates. green is exact, blue is sliding. let go of a slider and it searches again.

**deploy**

`scripts/deploy_azure.sh` builds the docker image in azure and runs it on container apps. needs `az login` first.

**tests**

```sh
scripts/fetch_external.sh        # downloads the bench vice
.venv/bin/python -m pytest -q    # 17 tests
```
