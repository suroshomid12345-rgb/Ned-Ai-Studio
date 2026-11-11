from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DASHBOARD = ROOT / "dashboard"
WORKSPACE = ROOT / "workspace" / "projects"
HOST = "127.0.0.1"
PORT = 8765


class StudioHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DASHBOARD), **kwargs)

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            return self.send_json(200, {"ok": True, "message": "برنامهٔ ویندوزی وصل است"})
        if path == "/api/projects":
            WORKSPACE.mkdir(parents=True, exist_ok=True)
            projects = []
            for file in sorted(WORKSPACE.glob("*/project.json"), key=lambda p: p.stat().st_mtime, reverse=True):
                try:
                    projects.append(json.loads(file.read_text(encoding="utf-8")))
                except (OSError, json.JSONDecodeError):
                    continue
            return self.send_json(200, {"projects": projects})
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/projects":
            return self.send_json(404, {"error": "این مسیر شناخته نشد."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 2 or length > 10000:
                return self.send_json(400, {"error": "معلومات ارسالی معتبر نیست."})
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            name = str(payload.get("name", "")).strip()
            if not name or len(name) > 80:
                return self.send_json(400, {"error": "نام پروژه را وارد کن (حداکثر ۸۰ حرف)."})
            project = {
                "id": str(uuid.uuid4()),
                "name": name,
                "type": str(payload.get("type", "AI Video"))[:40],
                "language": str(payload.get("language", "Dari + English"))[:40],
                "status": "ایده",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name).strip("-_").lower()[:45] or "project"
            folder = WORKSPACE / f"{slug}-{project['id'][:8]}"
            folder.mkdir(parents=True, exist_ok=False)
            (folder / "project.json").write_text(
                json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            return self.send_json(201, {"ok": True, "project": project})
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            return self.send_json(400, {"error": "معلومات ارسالی قابل خواندن نیست."})
        except OSError as error:
            return self.send_json(500, {"error": f"خطا در ذخیرهٔ پروژه: {error}"})

    def log_message(self, format, *args):
        print("[Ned_Ai Studio] " + format % args)


if __name__ == "__main__":
    if not DASHBOARD.is_dir():
        raise SystemExit("پوشهٔ dashboard پیدا نشد. همهٔ فایل‌های پروژه را دانلود کن.")
    server = ThreadingHTTPServer((HOST, PORT), StudioHandler)
    print("Ned_Ai Studio آماده است.")
    print(f"در Google Chrome باز کن: http://{HOST}:{PORT}")
    print("برای توقف برنامه، Ctrl+C را فشار بده.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nبرنامه متوقف شد.")
    finally:
        server.server_close()
