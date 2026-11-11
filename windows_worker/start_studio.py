from __future__ import annotations

import json
import re
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
DASHBOARD = ROOT / "dashboard"
WORKSPACE = ROOT / "workspace" / "projects"
RENDERS = ROOT / "workspace" / "renders"
HOST = "127.0.0.1"
PORT = 8765
STAGES = ["ایده", "سناریو", "پرامپت و منابع", "تولید و تدوین", "بررسی کیفیت", "آماده‌سازی نشر", "آماده"]
FFMPEG_FALLBACK = Path(r"C:\ffmpeg\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe")


def find_ffmpeg():
    found = shutil.which("ffmpeg")
    if found:
        return found
    if FFMPEG_FALLBACK.is_file():
        return str(FFMPEG_FALLBACK)
    return None


def read_project(project_id: str):
    if not re.fullmatch(r"[a-f0-9-]{36}", project_id):
        return None
    for file in WORKSPACE.glob("*/project.json"):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
            if data.get("id") == project_id:
                return file, data
        except (OSError, json.JSONDecodeError):
            continue
    return None


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

    def read_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length < 2 or length > 200000:
            raise ValueError("معلومات ارسالی معتبر نیست.")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            return self.send_json(200, {"ok": True, "message": "برنامهٔ ویندوزی وصل است"})
        if path == "/api/ffmpeg/status":
            executable = find_ffmpeg()
            if not executable:
                return self.send_json(200, {"available": False, "message": "FFmpeg پیدا نشد."})
            try:
                result = subprocess.run(
                    [executable, "-version"], capture_output=True, text=True,
                    encoding="utf-8", errors="replace", timeout=15, check=False
                )
                first_line = (result.stdout or result.stderr).splitlines()[0]
                return self.send_json(200, {
                    "available": result.returncode == 0,
                    "message": first_line,
                    "path": executable
                })
            except (OSError, subprocess.TimeoutExpired) as error:
                return self.send_json(200, {"available": False, "message": str(error)})
        if path == "/api/projects":
            WORKSPACE.mkdir(parents=True, exist_ok=True)
            projects = []
            for file in sorted(WORKSPACE.glob("*/project.json"), key=lambda p: p.stat().st_mtime, reverse=True):
                try:
                    projects.append(json.loads(file.read_text(encoding="utf-8")))
                except (OSError, json.JSONDecodeError):
                    continue
            return self.send_json(200, {"projects": projects})
        if path.startswith("/api/projects/"):
            found = read_project(unquote(path.rsplit("/", 1)[-1]))
            if not found:
                return self.send_json(404, {"error": "پروژه پیدا نشد."})
            return self.send_json(200, {"project": found[1]})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/render/test":
            try:
                self.read_body()
                executable = find_ffmpeg()
                if not executable:
                    return self.send_json(400, {"error": "FFmpeg پیدا نشد. نصب و مسیر آن را بررسی کن."})
                RENDERS.mkdir(parents=True, exist_ok=True)
                filename = "ffmpeg_test_" + datetime.now().strftime("%Y%m%d_%H%M%S") + ".mp4"
                output = RENDERS / filename
                command = [
                    executable, "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "lavfi", "-i", "color=c=blue:s=640x360:r=25:d=3",
                    "-an", "-c:v", "libx264", "-preset", "ultrafast",
                    "-threads", "2", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    str(output)
                ]
                result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8",
                                        errors="replace", timeout=60, check=False)
                if result.returncode != 0 or not output.is_file() or output.stat().st_size == 0:
                    detail = (result.stderr or "فایل ویدیویی ساخته نشد.")[-2500:]
                    return self.send_json(500, {"error": detail})
                return self.send_json(200, {
                    "ok": True, "message": "ویدیوی آزمایشی با موفقیت ساخته شد.",
                    "file": str(output), "size_bytes": output.stat().st_size
                })
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
                return self.send_json(400, {"error": str(error) or "درخواست معتبر نیست."})
            except subprocess.TimeoutExpired:
                return self.send_json(500, {"error": "ساخت ویدیو بیش از ۶۰ ثانیه طول کشید و متوقف شد."})
            except OSError as error:
                return self.send_json(500, {"error": f"خطا در اجرای FFmpeg: {error}"})
        if path != "/api/projects":
            return self.send_json(404, {"error": "این مسیر شناخته نشد."})
        try:
            payload = self.read_body()
            name = str(payload.get("name", "")).strip()
            if not name or len(name) > 80:
                return self.send_json(400, {"error": "نام پروژه را وارد کن (حداکثر ۸۰ حرف)."})
            project = {
                "id": str(uuid.uuid4()), "name": name,
                "type": str(payload.get("type", "AI Video"))[:40],
                "language": str(payload.get("language", "Dari + English"))[:40],
                "status": "ایده", "created_at": datetime.now(timezone.utc).isoformat(),
                "idea": "", "audience": "مخاطبان عمومی", "duration": "60 ثانیه",
                "format": "عمودی 9:16", "script": "", "scene_prompts": "",
                "title_dari": "", "title_english": "", "description": "",
                "hashtags": "", "quality_notes": ""
            }
            slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name).strip("-_").lower()[:45] or "project"
            folder = WORKSPACE / f"{slug}-{project['id'][:8]}"
            folder.mkdir(parents=True, exist_ok=False)
            (folder / "project.json").write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
            return self.send_json(201, {"ok": True, "project": project})
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            return self.send_json(400, {"error": str(error) or "معلومات ارسالی قابل خواندن نیست."})
        except OSError as error:
            return self.send_json(500, {"error": f"خطا در ذخیرهٔ پروژه: {error}"})

    def do_PUT(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/projects/"):
            return self.send_json(404, {"error": "این مسیر شناخته نشد."})
        try:
            project_id = unquote(path.rsplit("/", 1)[-1])
            found = read_project(project_id)
            if not found:
                return self.send_json(404, {"error": "پروژه پیدا نشد."})
            file, current = found
            payload = self.read_body()
            allowed = {"name", "type", "language", "status", "idea", "audience", "duration", "format",
                       "script", "scene_prompts", "title_dari", "title_english", "description", "hashtags", "quality_notes"}
            for key in allowed:
                if key in payload:
                    value = str(payload[key]).strip()
                    if len(value) > 30000:
                        return self.send_json(400, {"error": f"متن بخش {key} بیش از حد طولانی است."})
                    current[key] = value
            if not current.get("name"):
                return self.send_json(400, {"error": "نام پروژه خالی است."})
            if current.get("status") not in STAGES:
                return self.send_json(400, {"error": "مرحلهٔ پروژه معتبر نیست."})
            current["updated_at"] = datetime.now(timezone.utc).isoformat()
            file.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
            return self.send_json(200, {"ok": True, "project": current})
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            return self.send_json(400, {"error": str(error) or "معلومات ارسالی قابل خواندن نیست."})
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
