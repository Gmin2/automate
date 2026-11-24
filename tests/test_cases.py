import json
import os
from pathlib import Path

import pytest

from automate.load import Assembly
from automate.match import Matcher

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "fixtures"
LATHE = Path(os.environ.get("LATHE_STEP", ROOT.parent / "assignment" / "WM290V_RedrawStart.stp"))
VICE = ROOT / "data" / "external" / "bench_vice.stp"

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
