"""small local server for the viewer: serves the mesh and runs matches on request"""
import json
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .cli import to_json
from .export import scene
from .load import Assembly
from .match import Matcher

VIEWER = Path(__file__).resolve().parent.parent / "viewer"


class State:
    def __init__(self, path, examples):
        t = time.time()
        self.asm = Assembly(path)
        self.scene = json.dumps(scene(self.asm)).encode()
        self.examples = examples
        self.lock = threading.Lock()
        print(f"loaded {path} in {time.time() - t:.1f}s")

    def match(self, inst_id, faces):
        inst = next(i for i in self.asm.instances if i.id == inst_id)
        with self.lock:
            t = time.time()
            m = Matcher(self.asm)
            sel, band, found, here = m.run(inst, faces)
        return {
            "selection": {"instance": inst.id, "part": inst.part.name, "faces": faces,
                          "surfaces": [{"faces": s.ids, "kind": s.kind} for s in sel]},
            "gap_band_mm": list(band),
            "matches": [to_json(x) for x in found],
            "in_place_contacts": to_json(here) if here else None,
            "rejected": [{"part": p, "faces": f, "why": w} for p, f, w in m.rejected],
            "seconds": round(time.time() - t, 2),
        }


def handler(state):
    class H(SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(VIEWER), **k)

        def log_message(self, fmt, *args):
            pass

        def send(self, body, kind="application/json", code=200):
            self.send_response(code)
            self.send_header("content-type", kind)
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/api/scene":
                return self.send(state.scene)
            if self.path == "/api/examples":
                return self.send(json.dumps(state.examples).encode())
            return super().do_GET()

        def do_POST(self):
            if self.path != "/api/match":
                return self.send(b'{"error": "not found"}', code=404)
            req = json.loads(self.rfile.read(int(self.headers["content-length"])))
            try:
                out = state.match(req["instance"], [int(f) for f in req["faces"]])
            except Exception as e:  # surface errors like "face 14 is freeform" to the page
                return self.send(json.dumps({"error": str(e)}).encode(), code=400)
            self.send(json.dumps(out).encode())

    return H


def serve(path, port=8765, examples=None):
    state = State(path, examples or [])
    srv = ThreadingHTTPServer(("127.0.0.1", port), handler(state))
    print(f"viewer on http://127.0.0.1:{port}")
    srv.serve_forever()
