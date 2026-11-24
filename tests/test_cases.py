import json
import os
from pathlib import Path

import pytest

from automate.load import Assembly
from automate.match import Matcher

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "fixtures"
LATHE = Path(os.environ.get("LATHE_STEP", ROOT / "WM290V_RedrawStart.stp"))
VICE = ROOT / "data" / "external" / "bench_vice.stp"
# the grabcad download (login needed), unzipped next to the assignment file
GRABCAD = Path(os.environ.get("GRABCAD_DIR", ROOT.parent / "assignment" / "grabcad"))
SIM = GRABCAD / "wm290v_sim_model_2026-11-16.step"
MOUNT = GRABCAD / "motor_mount_alt_A_2026-11-10.step"
SCREW = "MA-06 motor screw M8 x 30 countersunk, large washer and lock nut on the foot, 1 of 4"

_asm = {}


def run(path, part, faces, instance=None):
    if path not in _asm:
        _asm[path] = Assembly(path)
    asm = _asm[path]
    inst = [i for i in asm.instances if i.part.name == part and (not instance or instance in i.id)][0]
    return Matcher(asm).run(inst, faces)


CASES = json.loads((FIX / "cases.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=[f"{c['file']}:{c['part']}" for c in CASES])
def test_fixture(case):
    _, _, found, _ = run(FIX / case["file"], case["part"], case["faces"])
    exp = case["expect"]
    if "count" in exp:
        assert len(found) == exp["count"]
        assert {m.part for m in found} == {exp["part"]}
        assert all(m.motion == exp["motion"] for m in found)
        if "fit" in exp:
            assert all(m.fit == exp["fit"] for m in found)
    if "targets" in exp:
        got = {}
        for m in found:
            got.setdefault(m.part, set()).add((m.fit, m.motion))
        assert set(got) == set(exp["targets"])
        for part, (fit, motion) in exp["targets"].items():
            assert got[part] == {(fit, motion)}
    if "gap" in exp:
        for m in found:
            assert max(m.gaps) == pytest.approx(exp["gap"], abs=0.02)
    if "confidence" in exp:
        assert all(m.confidence == exp["confidence"] for m in found)


def test_chuck_ignores_decoys():
    _, _, found, _ = run(FIX / "chuck_4slot.step", "chuck_key", CASES[0]["faces"])
    hit = {f for m in found for fs in m.target_faces.values() for f in fs}
    # sockets only: no face of the round hole or the two odd pockets
    assert len(hit) == 16


lathe = pytest.mark.skipif(not LATHE.exists(), reason="lathe STEP not found")


@lathe
def test_lone_flat_face_is_not_searched():
    # one flat slides anywhere on any flat, so it would "fit" all over. it should say so instead
    asm = _asm.setdefault(FIX / "chuck_4slot.step", Assembly(FIX / "chuck_4slot.step"))
    inst = [i for i in asm.instances if i.part.name == "chuck_key"][0]
    m = Matcher(asm)
    _, _, found, _ = m.run(inst, [1])
    assert m.too_loose and found == []
    m = Matcher(asm)
    _, _, found, _ = m.run(inst, [1, 2])  # two opposite sides are parallel, still too loose
    assert m.too_loose and found == []
    m = Matcher(asm)
    _, _, found, _ = m.run(inst, [1, 2, 3, 4])
    assert not m.too_loose and len(found) == 4


def test_lathe_chuck_key_finds_all_three_pinions():
    _, _, found, here = run(LATHE, "Key", [2, 4, 16, 18])
    assert sorted(m.instance.split("/")[-1] for m in found) == [f"Pinion M1.8 10T.{k}" for k in (1, 2, 3)]
    for m in found:
        assert list(m.target_faces.values()) == [[4, 6, 8, 12]]
        assert m.fit == "exact" and m.motion == "prismatic"
        assert m.gaps == pytest.approx([0.2] * 4, abs=0.005)
    assert sum(m.in_place for m in found) == 1
    assert here and here.fit == "exact"


@lathe
def test_lathe_belt_sits_in_big_pulley_only():
    part = "01. Test00-180 x 1 SPZ Type 1 1610 TL"
    _, _, found, _ = run(LATHE, part, [27, 23, 31])
    assert len(found) == 1
    assert list(found[0].target_faces.values()) == [[9, 10, 12, 13, 16, 17]]
    assert found[0].motion == "revolute" and found[0].fit == "exact"


@lathe
def test_lathe_belt_does_not_fit_small_pulley_groove():
    # small pulley flanks are 73 deg, the belt is 71: only the inner cylinder touches
    _, _, found, here = run(LATHE, "01. Test00-180 x 1 SPZ Type 1 1610 TL", [29, 25, 33])
    assert found == []
    assert here is not None and here.partial == [[25], [33]]


@lathe
@pytest.mark.parametrize("bush,cone,pulley", [
    ("1610x38mm", 5, "180 x 1 SPZ"),
    ("1210 TL Ø20 PILOT BORE", 3, "03-80 x 1 SPZ"),
])
def test_lathe_taper_bush_finds_its_own_pulley(bush, cone, pulley):
    _, _, found, _ = run(LATHE, bush, [cone])
    assert len(found) == 1 and pulley in found[0].instance
    assert found[0].fit == "exact" and found[0].motion == "revolute"


@lathe
def test_lathe_pilot_bore_does_not_fit_motor_shaft():
    # 20 mm pilot bore vs 24 mm shaft: 2 mm interference is not a fit
    _, _, found, _ = run(LATHE, "1210 TL Ø20 PILOT BORE", [12])
    assert not any(30 >= max(f for fs in m.target_faces.values() for f in fs) and "M90S" in m.instance
                   and m.gaps[0] < -0.5 for m in found)
    assert all(m.confidence == "low" for m in found)


@pytest.mark.skipif(not VICE.exists(), reason="run scripts/fetch_external.sh first")
def test_real_bench_vice_jaw_slides_and_tslot_is_rejected():
    asm_path = VICE
    _, _, found, _ = run(asm_path, "Vice Jaw", [3, 27, 4, 6])
    assert len(found) == 1
    m = found[0]
    assert m.in_place and m.fit == "sliding" and m.motion == "prismatic"
    assert list(m.target_faces.values()) == [[5, 11, 17, 26]]


def faces_of(m):
    return list(m.target_faces.values())[0]


@pytest.mark.skipif(not SIM.exists(), reason="grabcad files not unzipped into assignment/grabcad")
def test_sim_model_key_same_answer_in_a_bigger_rotated_assembly():
    # 252 parts, geometry baked into world coords, key turned 11 deg vs the original file
    _, _, found, _ = run(SIM, "Key.1", [2, 4, 16, 18])
    assert len(found) == 3
    assert all("Pinion" in m.instance and faces_of(m) == [4, 6, 8, 12] for m in found)
    assert all(m.fit == "exact" and abs(m.clearance - 0.2) < 1e-3 for m in found)
    assert sum(m.in_place for m in found) == 1


@pytest.mark.skipif(not SIM.exists(), reason="grabcad files not unzipped into assignment/grabcad")
def test_sim_model_belt_and_bushes():
    _, _, big, _ = run(SIM, "SIM belt SPZ", [6, 14, 10])
    assert len(big) == 1 and "spindle pulley" in big[0].instance and big[0].fit == "exact"
    _, _, small, _ = run(SIM, "SIM belt SPZ", [8, 16, 12])
    assert small == []
    _, _, bush, _ = run(SIM, "01. Test00-1610x38mm.1", [5, 6])
    assert len(bush) == 1 and "spindle pulley" in bush[0].instance and bush[0].in_place


@pytest.mark.skipif(not MOUNT.exists(), reason="grabcad files not unzipped into assignment/grabcad")
def test_countersunk_screw_finds_all_eight_holes():
    # m8 shank in a 9 mm clearance hole through a 5 mm plate: the straight bit of the hole is 1 mm,
    # so only the hole is covered by the shank, not the other way round
    _, _, found, here = run(MOUNT, SCREW, [1, 3])
    assert len(found) == 8
    assert all(m.fit == "exact" and m.motion == "revolute" and abs(m.clearance - 0.5) < 1e-3 for m in found)
    assert [faces_of(m) for m in found if m.in_place] == [[22, 30]]
    # the head sits 0.35 mm proud in the model, still found where it is
    _, _, cone, here = run(MOUNT, SCREW, [1])
    assert len(cone) == 8 and here is not None
