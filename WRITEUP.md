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

the assignment points at CAD mating tools (SolidWorks mate references and SmartMates). i took their
vocabulary: an entity is a typed primitive with a direction and a point, entities pair by type, and a
mate is aligned or anti-aligned. what this tool adds is the search: every group of faces in the
assembly that the selection fits, not one mate for a part being dropped in.

options i looked at and dropped:

| option | why not |
|---|---|
| match each face on its own | the assignment calls it out: a plane matches every plane. the group geometry is the whole signal |
| point pair features / ICP on sampled points | throws away the exact radii and axes the file already has, and is built to return one best pose |
| RANSAC | built to find the one consensus answer, i need every instance. with typed primitives the full search is cheap anyway |
| face adjacency subgraph matching | the faces a part mates with are rarely connected the same way (vice ways are separated by other faces). fine as a tie break, bad as the criterion |
| learned (JoinABLe, AutoMate, newer nets) | need training data and predict a joint or mate between parts. i needed an exhaustive list with a gap per face, which is not what they output |

the deterministic route also makes the output explainable: every match comes with the face pairs,
the gap on each and the motion left over, so a person can check it.

## what is compared, and why

**per face (unary).** a target face is only considered for a selected face if

- same primitive type. bsplines that are really planes or cylinders get recovered first with
  `ShapeAnalysis_CanonicalRecognition`, anything still freeform is ignored.
- opposite sense: a convex cylinder (shaft) only pairs with a concave one (bore), a convex cone with a
  concave cone, ball with socket. this is the anti-aligned idea from CAD mates, and it is what stops a
  key matching another key.
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
boolean rows. on the lathe (8257 faces), with the assembly already loaded in the viewer, the belt search
took 0.1 s and the key search about 2 s.

**pose.** for each consistent assignment: rotation from the direction pairs by kabsch (selected normal
goes to minus the target normal, axes to axes, both signs tried for cylinders), translation by least
squares on the offsets. whatever the faces dont pin down (sliding along a slot, spinning in a bore) is
the null space of that system, and the part is slid / spun inside it until the faces overlap and the
solids dont collide.

**verification.** a pose only counts if

- the selected face's sample points sit within the gap band of the target surface: the 10th and 90th
  percentile of the signed distances (+ is clearance) must both be inside it, so a stray sample on a
  trimmed edge doesnt sink a real fit
- at least 25% of those points project *inside* the target face, not just onto its infinite surface.
  this is what kills two planes that line up but sit 200 mm apart. for a shank, cone or ball going into
  a hole it also passes the other way round, when the hole is covered by the selected face: an M8 screw
  in a 5 mm countersunk plate only meets 1 mm of straight bore, a tenth of its shank. planes and bores
  never get the reverse check, a big flat covers any sliver face and a long bore swallows every short boss.
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

- the assignment describes exact as "key in slot: faces nearly coincide" and sliding as "vice jaw: faces
  stay parallel/coaxial with a controlled gap, never coincide"
- but the lathe chuck key has **0.2 mm** on every flat (results/lathe-chuck-key), and the real bench vice
  jaw is modelled **line to line**, 0 gap (results/bench-vice-jaw). by gap alone the key would be the
  clearance fit and the vice the exact one, the opposite of the assignment's own examples

so the rule is kinematic, with the gap as a second signal. the matched contacts give a 6 column
constraint jacobian (screw theory: a plane contact pins 3 dof, a cylinder 4, a cone 5, a sphere 3),
its null space is what the part can still do:

- **sliding**: something can still translate and nothing stops it, or it can rotate with real clearance (a running fit)
- **exact**: it is held, or the only free direction runs into a *stop*: a face closing off the far end
  of the mated faces, facing the part (the bottom of the socket). the clearance is only there to get it in.
  cones count as exact, a gap on a taper just means it isnt pushed home, and once a cone seats a
  clearance hole next to it doesnt make it a running fit (the countersunk screw).
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
| countersunk screw, M8 in a 9 mm hole | 0.5 on the shank | spin | n/a (head cone seats) | exact |

`motion` is reported separately (prismatic, revolute, cylindrical, planar, spherical) so nothing is lost
by collapsing to two labels.

## tolerances

all are flags. the gap band scales with the **thinnest** size of the selection, its smallest width over
every direction (a key's cross section, not its length or its diagonal), and for cylinders, cones and
spheres at least the smallest diameter:

| | default | why |
|---|---|---|
| max clearance | 5% of the thinnest size, at least 0.05 mm, at most 1 mm | the 7.8 mm key gets 0.39 mm, covering its 0.2 mm (2.6%). a 10 mm key gets 0.5 mm and rejects a 12 mm socket (1 mm per side). a countersunk head is 2 mm tall but 12 mm across, so it counts as 12 |
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
| pulley on motor shaft | lathe | **no clean fit, because the model has none**: the bush on the motor is modelled with its 20 mm pilot bore (faces 12/13, x 231 to 254) round the 24 mm motor shaft (faces 984/992, x 212 to 253), on the same axis, so they overlap by 2 mm per side. at the default 0.1 mm press fit allowance that isnt a fit. with `--interference 2.5` the shaft comes back as **in place, interference, -2.000 mm** (results/lathe-pulley-on-motor-shaft). at the default the bore matches the 20 mm leadscrew and a 20 mm stub at the other end of the motor (faces 976/978, x -42 to -22), both low confidence, a lone bore fits any shaft its size |
| hub bore on shaft | synthetic | cylindrical, low confidence |
| pin over bolt circle | synthetic | 12 = 6 holes from either side, 10 mm decoy rejected, running fit |
| ball stud | synthetic | 2 sockets, spherical, oversize decoy rejected |
| chuck + key | grabcad sim model | same 3 pinions, 0.200 mm, exact. 252 parts, every part baked into world coordinates (no shared definitions) and the key turned 11 deg vs the original file |
| belt / taper bush | grabcad sim model | new belt and spindle pulley: big wrap fits, small wrap is again the 71 vs 73 deg near miss, 1610 bush finds the spindle pulley bore |
| pilot bore | grabcad sim model | still no fit on the 24 mm shaft. low confidence hits: the leadscrew, the motor's 20 mm stub, two lever grips, and at the 1.0 mm band edge an 18 mm tool post lever grip and a feed rod collar at 0.5 mm. a lone bore is a weak selection |
| countersunk screw | grabcad motor mount | head + shank find all 8 countersunk holes in the sliding plate (4 sunk from each side), exact, 0.5 mm shank clearance, the one it is in flagged. the head sits 0.35 mm proud in the model and is still found in place |

things i found in the lathe file worth knowing: the part called `1610x38mm` is a taper bush, not the
belt. the belt is a second solid inside the 180 pulley part (that part has 2 solids), so the loader
splits multi body parts. both pulley products carry the description `1 Groove SPZ Type 1`. 3165 of the
8257 faces (38%) are bsplines, but every face in the cases here is a plane, cylinder or cone.

the grabcad page has two more STEP files than the notion attachment (a newer simulator model of the
whole machine and a motor mount). they found two real bugs that the first set of cases missed: the
overlap check was one sided (fails a screw through a thin plate) and the gap band used the height of a
countersunk head instead of its diameter. a later review found a third: the thinnest size was read
off principal axes, which for a square key point anywhere between its side and its diagonal (the 7.8
key got 9.6). it is now the true smallest width, the same 7.8 in the original file and the rotated sim
model. all three are fixed, the results did not change.

## what breaks

- **degenerate selections**: one bore, or two parallel planes, leave 2+ dof and fit lots of things.
  they are still reported (correct by geometry) but flagged `confidence: low`. with the 5% band a 20 mm
  bore also takes an 18 mm grip at 1 mm per side.
- **freeform mates** (gear teeth, the scroll spiral, cams) are skipped. only plane, cylinder, cone and sphere.
- **contact is treated as two sided**. a key in a socket can be pulled out, but the jacobian counts the
  flat as pinning both ways. the stop logic papers over this for blind pockets, a proper unilateral
  (linear programming) treatment would be cleaner.
- **clearance band is a policy**. a deliberately loose fit beyond 5% of the feature size is missed,
  a tight decoy inside it is accepted. it is a flag for that reason.
- **sampling**. points are a 9x9 grid per face, so very thin or very trimmed faces can fail the
  overlap check. stops are found to within a grid cell.
- **collision check needs solids**. the motor is shells only, so it never vetoes anything there.
- **face ids** are index based. a standalone part file (`--part-step`) is matched to its part in the
  assembly by the face list (type and size of each face in order). if no part has the same list, it
  stops with an error, so a part file whose faces come out in another order isnt supported yet.
- **speed**. on the lathe, reading the file takes about 3 s and describing all faces about 9 s, redone on
  every CLI run (the viewer keeps them). the boolean collision check only runs on poses that already
  passed everything else.

## with another week

1. **unilateral contact**: treat each plane contact as a half space and solve the free motion as an
   LP, which gives real "can be inserted / is retained" answers instead of the stop heuristic.
2. **features as groups**: auto suggest the selection (the 4 walls + floor of a socket, a bore + shoulder),
   like the implicit mate connectors in Onshape, so a user can click once.
3. **patterns**: after the first match, look for the circular / linear pattern it belongs to and
   check the rest of the pattern first. faster and a nice explanation in the output.
4. **cache** the face descriptors per file (about 9 s on the lathe, and they never change).
5. **more data**: run on a batch of Fusion 360 Gallery assemblies, which ship labelled joints, and
   measure precision / recall against them instead of my own fixtures.
6. **torus and freeform**: tori are easy to add (O rings, fillet contacts). gears could go through
   involute recognition.

## related work

- AutoMate (Jones et al. 2021, arxiv 2105.12238) learns to predict mates on B-rep parts and releases an
  assembly dataset.
- JoinABLe (Willis et al. 2021, CVPR 2022, arxiv 2111.12772) learns joints between parts from the Fusion
  360 Gallery assembly data.
- Mates2Motion (Noeckel et al. 2022, arxiv 2208.01779) re-defines mates so they reflect how the assembly
  moves. same split as here between the fit label and the motion.
- Dai et al. 2026 (arxiv 2610.14633) group the faces of a mating interface into assembly features and use
  feature patterns to guide matching, the closest in spirit to the group matching here.

these are learned and predict mates for parts. this tool is deterministic and lists every place a face
group fits, with a gap per face.
