# write up

## the short version

every face is reduced to the primitive it lies on (plane, cylinder, cone, sphere) with its outward
normal and whether it is convex or concave. a match for the selected group is another group of faces
that is the *complement* of it (planes facing the other way, a bore for a shaft, same cone angle with
material on the other side) **and** keeps the same rigid layout: same angles between normals and axes,
same signed spacing between parallel faces, give or take the clearance. i search for those groups with
an interpretation tree, solve the rigid pose in closed form, check the faces really overlap and the
solids dont collide, then read the kind of fit off the degrees of freedom the contact leaves.

no learning, no meshes for the matching, everything comes from the exact B-rep geometry in the STEP file.

## why this approach

the assignment is basically "SmartMates, but searched over the whole assembly and returning every hit".
commercial mate inference (SolidWorks mate references, Inventor iMates, Onshape mate connectors) all do
the same thing underneath: reduce entities to typed primitives with a direction and a point, pair them
by type, and check alignment (aligned vs anti-aligned). none of them search for every place a group
fits, they mate things you already picked. so i kept their vocabulary and added the search.

options i looked at and dropped:

| option | why not |
|---|---|
| match each face on its own | the assignment calls it out: a plane matches every plane. the group geometry is the whole signal |
| point pair features / ICP on sampled points | throws away the exact radii and axes the file already has, noisy at 0.2 mm, returns one best pose |
| RANSAC | built to find the one consensus answer, i need every instance. with typed primitives the full search is cheap anyway |
| face adjacency subgraph matching | the faces a part mates with are rarely connected the same way (vice ways are separated by other faces). fine as a tie break, bad as the criterion |
| learned (JoinABLe, AutoMate, newer nets) | need training data, predict one joint between two given parts, no notion of clearance. good reading for the mate taxonomy, wrong tool for an exhaustive search |

the deterministic route also makes the output explainable: every match comes with the face pairs,
the gap on each and the motion left over, so a person can check it.

## what is compared, and why

**per face (unary).** a target face is only considered for a selected face if

- same primitive type. bsplines that are really planes or cylinders get recovered first with
  `ShapeAnalysis_CanonicalRecognition`, anything still freeform is ignored.
- opposite sense: a convex cylinder (shaft) only pairs with a concave one (bore), a convex cone with a
  concave cone, ball with socket. this is the "mate" sign every CAD system has (anti-aligned normals)
  and it is what stops a key matching another key.
- size: radii differ by the clearance band (bore minus shaft between -0.1 mm and the max clearance),
  cone half angles within 0.5 deg. plane sizes are not compared here, extents are checked later.

**per pair (the rigid layout).** for every two selected faces the tool stores numbers that dont change
when the part moves, and the target pair has to agree:

- angle between normals / axes (exact, rotations dont care about clearance)
- signed distance between two parallel or facing planes. *signed* matters: the two outward flats of a
  key are 7.8 apart with material between them, a socket has 8.2 between inward walls with air between.
  the sign is what makes "key fits socket" and rejects "key fits key".
- distance from a cylinder axis to a plane, and between two parallel axes

distance checks allow for the clearance on each face, so a 7.8 key still pairs with an 8.2 socket.
these tables are built once per selected pair (vectorised for planes) and the tree only intersects
boolean rows. on the lathe (8257 faces) with the assembly loaded, a search takes 0.1 s for the belt and
1.8 s for the key, most of that in the solid collision checks. before this the same search took 173 s.

**pose.** for each consistent assignment: rotation from the direction pairs by kabsch (selected normal
goes to minus the target normal, axes to axes, both signs tried for cylinders), translation by least
squares on the offsets. whatever the faces dont pin down (sliding along a slot, spinning in a bore) is
the null space of that system, and the part is slid / spun inside it until the faces overlap and the
solids dont collide.

**verification.** a pose only counts if

- every sample point of every selected face sits within the gap band of its target surface
  (signed distance, + is clearance)
- at least 25% of those points project *inside* the target face, not just onto its infinite surface.
  this is what kills two planes that line up but sit 200 mm apart.
- the selected solid placed there doesnt overlap the target solid by more than 0.5% of the smaller
  volume (`BRepAlgoAPI_Common`). this catches faces that genuinely mate but where the rest of the part
  would run through the target, like the bench vice jaw flipped upside down into the base T-slot.

**all instances, no duplicates.** a match is keyed by the set of target faces it lands on. a square key
drops into one socket 8 ways (4 turns, 2 ends), those collapse into one match with `symmetry 8`.
different sockets have different faces, so they stay separate. repeated parts (3 pinions sharing one
definition) are searched once and reported per instance.

**two passes.** the pose free search above, plus an in place pass that checks what the selection
touches where the part sits now. the second one catches contacts spread over several parts (the key
touching shaft and hub at once) and partial contact, and marks which pose free match is the current one.

## exact vs sliding

i first tried to decide this from the gap alone and the data said no:

- the lathe chuck key has **0.2 mm** clearance on every flat, and the assignment calls key in slot an exact fit
- the real bench vice jaw is modelled **line to line**, 0 gap, and it is the textbook sliding fit

so the rule is kinematic, with the gap as a second signal. the matched contacts give a 6 column
constraint jacobian (screw theory: a plane contact pins 3 dof, a cylinder 4, a cone 5, a sphere 3),
its null space is what the part can still do:

- **sliding**: something can still translate and nothing stops it, or it can rotate with real clearance (a running fit)
- **exact**: it is held, or the only free direction runs into a *stop*: a face closing off the far end
  of the mated faces, facing the part (the bottom of the socket). the clearance is only there to get it in.
  cones count as exact, a gap on a taper just means it isnt pushed home.
- **interference**: any gap below -0.01 mm

| case | gap | free motion | stop | result |
|---|---|---|---|---|
| lathe key in pinion socket | 0.2 | slide along key axis | socket bottom | exact |
| synthetic key in blind keyway | 0 | slide | keyway end | exact |
| same key in the hub keyway (through) | 0 | slide | none | sliding |
| real bench vice jaw | 0 | slide | none | sliding |
| dovetail jaw | 0.2 | slide | none | sliding |
| taper bush in pulley | 0 | spin | n/a (cone) | exact |
| belt in pulley groove | 0 | spin | n/a | exact |
| hub bore on shaft | 0 | slide + spin | none | sliding |
| shoulder pin in clearance hole | 0.1 | spin | n/a | sliding (running fit) |

`motion` is reported separately (prismatic, revolute, cylindrical, planar, spherical) so nothing is lost
by collapsing to two labels.

## tolerances

all are flags. the gap band scales with the **thinnest** dimension of the selection (key cross section,
pin diameter), not its length, otherwise a long key gets a sloppy tolerance:

| | default | why |
|---|---|---|
| max clearance | 5% of thinnest dimension, at least 0.05 mm, at most 1 mm | covers the 0.2 mm key (2.6%) and rejects a 12 mm socket for a 10 mm key |
| interference allowed | 0.1 mm | CAD noise and light press fits |
| line to line | 0.01 mm | |
| angle | 0.5 deg | |
| overlap | 25% of samples inside the target face | |
| collision | 0.5% of the smaller solid | |

## results

full table, json and screenshots: [results/README.md](results/README.md).

| scenario | assembly | outcome |
|---|---|---|
| chuck + key | lathe | all 3 pinion sockets, faces 4/6/8/12, exact, 0.200 mm per flat, one flagged in place |
| chuck + key, 4 slots | synthetic | 4 of 4, the round hole, a 12x12 pocket and a 10x13 pocket rejected |
| keyed shaft | synthetic | blind shaft keyway exact, both hubs (one placed at a random pose) sliding |
| bench vice | real CATIA model | jaw slides on the base, T-slot false positive rejected by the collision check |
| dovetail slide | synthetic | sliding, 0.2 mm on flanks and top |
| belt on pulley | lathe | belt inner faces sit in the 180 pulley groove only. the 80 pulley is a near miss: its groove is 34 deg, the belt 38, only the inner cylinder touches (reported as partial contact) |
| taper bush in pulley | lathe | each bush finds its own pulley, not the other one with the same 4 deg taper |
| pulley on motor shaft | lathe | **no match, correctly**: the bush is modelled with a 20 mm pilot bore and no keyway, the motor shaft is 24 mm. the 20 mm leadscrew does match (low confidence, a lone bore fits any 20 mm shaft) |
| hub bore on shaft | synthetic | cylindrical, low confidence |
| pin over bolt circle | synthetic | 12 = 6 holes from either side, 10 mm decoy rejected, running fit |
| ball stud | synthetic | 2 sockets, spherical, oversize decoy rejected |

things i found in the lathe file worth knowing: the part called `1610x38mm` is a taper bush, not the
belt. the belt is a second solid hidden inside the big pulley part, so the loader splits multi body
parts. both pulleys are named `1 Groove SPZ Type 1`. 38% of faces are bsplines (threads, the scroll,
the motor) but every mating face that matters is analytic.

## what breaks

- **degenerate selections**: one bore, or two parallel planes, leave 2+ dof and fit lots of things.
  they are still reported (correct by geometry) but flagged `confidence: low`.
- **freeform mates** (gear teeth, the scroll spiral, cams) are skipped. only plane, cylinder, cone and sphere.
- **contact is treated as two sided**. a key in a socket can be pulled out, but the jacobian counts the
  flat as pinning both ways. the stop logic papers over this for blind pockets, a proper unilateral
  (linear programming) treatment would be cleaner.
- **clearance band is a policy**. a deliberately loose fit beyond 5% of the feature size is missed,
  a tight decoy inside it is accepted. it is a flag for that reason.
- **sampling**. points are a 9x9 grid per face, so very thin or very trimmed faces can fail the
  overlap check. stops are found to within a grid cell.
- **collision check needs solids**. the motor is shells only, so it never vetoes anything there.
- **face ids** are index based. a standalone part file with a different face order is mapped by face
  list, if the lists differ the in place pass cant run (pose free still works).
- **speed**. describing all faces takes ~12 s on the lathe and is redone per CLI run. the boolean
  collision check is the slow part of a search, it only runs on poses that already passed everything else.

## with another week

1. **unilateral contact**: treat each plane contact as a half space and solve the free motion as an
   LP, which gives real "can be inserted / is retained" answers instead of the stop heuristic.
2. **features as groups**: auto suggest the selection (the 4 walls + floor of a socket, a bore + shoulder),
   like the implicit mate connectors in Onshape, so a user can click once.
3. **patterns**: after the first match, look for the circular / linear pattern it belongs to and
   check the rest of the pattern first. faster and a nice explanation in the output.
4. **cache** the face descriptors per file (they cost 12 s and never change).
5. **more data**: run on a batch of Fusion 360 Gallery assemblies, which ship labelled joints, and
   measure precision / recall against them instead of my own fixtures.
6. **torus and freeform**: tori are easy to add (O rings, fillet contacts). gears could go through
   involute recognition.

## related work

AutoMate (Jones et al. 2021) and JoinABLe (Willis et al. 2022) learn mates between two given parts from
Onshape / Fusion 360 data, using per face features very close to the ones here (surface type, the
reversed flag, axis, radius, area). Mates2Motion notes that whether a fit slides is designer intent,
which matches what the vice and key data showed. Dai et al. 2026 group faces into assembly features and
look for repeated patterns, the closest in spirit to this. none of them enumerate every fit or say
exact vs clearance, which is the part this tool is built around.
