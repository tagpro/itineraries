#!/usr/bin/env python3
"""Serve the site on one origin, optionally forwarding /api to the sync API.

    python3 test/serve.py --port 8099 --root . --api http://127.0.0.1:8787

The page calls /api/v1 on its own origin, so testing sync for real means one
server in front of both. Without --api the site is served on its own, which is
all most of the specs need.
"""
import argparse, http.server, socketserver, urllib.request, urllib.error

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=8099)
ap.add_argument("--root", default=".")
ap.add_argument("--api", default="")
args = ap.parse_args()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=args.root, **kw)

    def log_message(self, *a):
        pass

    def _forward(self):
        if not args.api:
            self.send_error(502, "no --api configured")
            return
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(args.api + self.path, data=body, method=self.command)
        for header in ("Authorization", "Content-Type"):
            if self.headers.get(header):
                req.add_header(header, self.headers[header])
        try:
            # An API that accepts the connection and then says nothing would
            # otherwise hang the whole run; the timeout lands in except below.
            with urllib.request.urlopen(req, timeout=15) as r:
                data, code, ctype = r.read(), r.status, r.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            data, code, ctype = e.read(), e.code, e.headers.get("Content-Type", "application/json")
        except Exception as e:  # the API is not up; let the page see a failure
            data, code, ctype = str(e).encode(), 502, "text/plain"
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        return self._forward() if self.path.startswith("/api/") else super().do_GET()

    do_POST = do_PATCH = do_DELETE = _forward


socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", args.port), Handler) as httpd:
    print(f"serving {args.root} on http://127.0.0.1:{args.port}"
          + (f", /api -> {args.api}" if args.api else ""), flush=True)
    httpd.serve_forever()
