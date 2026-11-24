"""local server for the web viewer: meshes, face info and matches for one or more assemblies"""
import json
import threading
import time
from dataclasses import asdict, fields
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .cli import to_json
from .export import scene
from .faces import describe_part
from .load import Assembly
from .match import Matcher, Params

WEB = Path(__file__).resolve().parent.parent / "web" / "dist"


class Model:
    """one assembly, loaded the first time something asks for it"""

    def __init__(self, path, examples):
        self.path = Path(path)
        self.examples = examples
        self.asm = None
        self.scene = None
        self.lock = threading.Lock()

    def load(self):
        with self.lock:
            if self.asm is None:
                t = time.time()
                self.asm = Assembly(self.path)
                self.scene = json.dumps(scene(self.asm)).encode()
                print(f"loaded {self.path.name} in {time.time() - t:.1f}s")
        return self

    def instance(self, inst_id):
        return next(i for i in self.load().asm.instances if i.id == inst_id)

    def faces(self, inst_id):
        part = self.instance(inst_id).part
        with self.lock:
            fs, _ = describe_part(part)
        out = []
        for f in fs:
            d = {"id": f.idx, "kind": f.kind, "area": round(f.area, 2)}
            if f.kind in ("cyl", "cone", "sphere"):
                d["r"] = round(f.r, 3)
                d["side"] = "out" if f.sense > 0 else "in"
            if f.kind == "cone":
                d["angle"] = round(float(f.alpha) * 57.29578, 2)
            out.append(d)
        return out

    def match(self, inst_id, faces, params):
        inst = self.instance(inst_id)
        p = Params(**{k: float(v) for k, v in (params or {}).items() if k in Params.__dataclass_fields__})
        with self.lock:
            t = time.time()
            m = Matcher(self.asm, p)
            sel, band, found, here = m.run(inst, faces)
        return {
            "selection": {"instance": inst.id, "part": inst.part.name, "faces": faces,
                          "surfaces": [{"faces": s.ids, "kind": s.kind} for s in sel]},
            "gap_band_mm": list(band),
            "params": asdict(p),
            "matches": [to_json(x) for x in found],
            "in_place_contacts": to_json(here) if here else None,
            "rejected": [{"part": p, "faces": f, "why": w} for p, f, w in m.rejected],
            "seconds": round(time.time() - t, 2),
        }


def handler(models):
    class H(SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(WEB), **k)

        def log_message(self, fmt, *args):
            pass

        def send(self, body, code=200):
            if not isinstance(body, bytes):
                body = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def model(self, q):
            name = q.get("file", [None])[0]
            return models.get(name) or next(iter(models.values()))

        def do_GET(self):
            url = urlparse(self.path)
            q = parse_qs(url.query)
            try:
                if url.path == "/api/files":
                    return self.send([{"name": k, "loaded": m.asm is not None} for k, m in models.items()])
                if url.path == "/api/params":
                    return self.send({f.name: f.default for f in fields(Params)})
                if url.path == "/api/scene":
                    return self.send(self.model(q).load().scene)
                if url.path == "/api/examples":
                    return self.send(self.model(q).examples)
                if url.path == "/api/faces":
                    return self.send(self.model(q).faces(q["instance"][0]))
            except Exception as e:
                return self.send({"error": str(e)}, 400)
            if url.path.startswith("/api/"):
                return self.send({"error": "not found"}, 404)
            # a single page app: anything that isnt a built file gets the page
            if not (WEB / url.path.lstrip("/")).is_file():
                self.path = "/index.html"
            return super().do_GET()

        def do_POST(self):
            url = urlparse(self.path)
            if url.path != "/api/match":
                return self.send({"error": "not found"}, 404)
            req = json.loads(self.rfile.read(int(self.headers["content-length"])))
            try:
                m = models.get(req.get("file")) or next(iter(models.values()))
                out = m.match(req["instance"], [int(f) for f in req["faces"]], req.get("params"))
            except Exception as e:  # surface errors like "face 14 is freeform" to the page
                return self.send({"error": str(e)}, 400)
            self.send(out)

    return H


def serve(paths, port=8765, examples=None, host="127.0.0.1", preload=False):
    examples = examples or {}
    models = {Path(p).name: Model(p, examples.get(Path(p).name, [])) for p in paths}
    if not WEB.exists():
        print("no web/dist yet: run `pnpm install && pnpm build` in web/, or `pnpm dev` there for the dev server")
    if preload:
        # read every file and describe every face before taking requests, so nobody waits on a cold load
        for m in models.values():
            t = time.time()
            for part in m.load().asm.parts.values():
                describe_part(part)
            print(f"ready {m.path.name} in {time.time() - t:.1f}s", flush=True)
    srv = ThreadingHTTPServer((host, port), handler(models))
    print(f"viewer on http://{host}:{port}  ({', '.join(models)})", flush=True)
    srv.serve_forever()
