from __future__ import annotations
import json, re, shutil, subprocess, uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "workspace" / "media"
RENDERS = ROOT / "workspace" / "renders"
FALLBACK = Path(r"C:\ffmpeg\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe")
ALLOWED = {".jpg", ".jpeg", ".png", ".webp"}

def ffmpeg_path():
    return shutil.which("ffmpeg") or (str(FALLBACK) if FALLBACK.is_file() else None)

def upload(handler):
    query = parse_qs(urlparse(handler.path).query)
    name = query.get("name", ["image.jpg"])[0]
    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED:
        return handler.send_json(400, {"error":"فقط JPG، PNG و WEBP پذیرفته می‌شود."})
    length = int(handler.headers.get("Content-Length", "0"))
    if length < 1 or length > 15 * 1024 * 1024:
        return handler.send_json(400, {"error":"حجم هر تصویر باید کمتر از ۱۵ مگابایت باشد."})
    data = handler.rfile.read(length)
    if not data:
        return handler.send_json(400, {"error":"فایل خالی است."})
    MEDIA.mkdir(parents=True, exist_ok=True)
    filename = uuid.uuid4().hex + suffix
    target = MEDIA / filename
    target.write_bytes(data)
    return handler.send_json(201, {"ok":True,"name":filename,"original_name":Path(name).name,"size_bytes":len(data)})

def render(handler):
    try:
        length = int(handler.headers.get("Content-Length", "0"))
        if length < 2 or length > 50000:
            return handler.send_json(400, {"error":"تنظیمات ویدیو معتبر نیست."})
        payload = json.loads(handler.rfile.read(length).decode("utf-8"))
        names = payload.get("images", [])
        if not isinstance(names, list) or not 1 <= len(names) <= 12:
            return handler.send_json(400, {"error":"بین ۱ تا ۱۲ تصویر انتخاب کن."})
        seconds = int(payload.get("seconds", 4))
        if seconds < 2 or seconds > 10:
            return handler.send_json(400, {"error":"مدت هر تصویر باید بین ۲ تا ۱۰ ثانیه باشد."})
        aspect = payload.get("aspect", "9:16")
        if aspect == "16:9":
            width, height = 1280, 720
        else:
            width, height = 720, 1280
        files = []
        for name in names:
            if not isinstance(name, str) or not re.fullmatch(r"[a-f0-9]{32}\.(jpg|jpeg|png|webp)", name):
                return handler.send_json(400, {"error":"نام یکی از تصاویر معتبر نیست."})
            file = MEDIA / name
            if not file.is_file():
                return handler.send_json(400, {"error":"یکی از تصاویر آپلودشده پیدا نشد."})
            files.append(file)
        exe = ffmpeg_path()
        if not exe:
            return handler.send_json(400, {"error":"FFmpeg پیدا نشد."})
        RENDERS.mkdir(parents=True, exist_ok=True)
        job = uuid.uuid4().hex[:10]
        segments = []
        for index, image in enumerate(files):
            segment = RENDERS / f"segment_{job}_{index:02d}.mp4"
            vf = (f"scale={width}:{height}:force_original_aspect_ratio=increase,"
                  f"crop={width}:{height},zoompan=z='min(zoom+0.0008,1.12)':"
                  f"d=1:s={width}x{height}:fps=25,format=yuv420p")
            cmd = [exe,"-hide_banner","-loglevel","error","-y","-loop","1","-i",str(image),
                   "-vf",vf,"-t",str(seconds),"-r","25","-an","-c:v","libx264",
                   "-preset","ultrafast","-threads","2","-pix_fmt","yuv420p",str(segment)]
            result = subprocess.run(cmd,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=180)
            if result.returncode or not segment.is_file() or segment.stat().st_size == 0:
                for old in segments + [segment]:
                    old.unlink(missing_ok=True)
                return handler.send_json(500,{"error":(result.stderr or "ساخت صحنه ناموفق بود.")[-1800:]})
            segments.append(segment)
        concat = RENDERS / f"concat_{job}.txt"
        concat.write_text("".join("file '"+p.as_posix().replace("'","'\\''")+"\n" for p in segments),encoding="utf-8")
        output = RENDERS / f"ned_ai_video_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{job}.mp4"
        cmd = [exe,"-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(concat),
               "-c","copy","-movflags","+faststart",str(output)]
        result = subprocess.run(cmd,capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=120)
        for old in segments:
            old.unlink(missing_ok=True)
        concat.unlink(missing_ok=True)
        if result.returncode or not output.is_file() or output.stat().st_size == 0:
            return handler.send_json(500,{"error":(result.stderr or "اتصال صحنه‌ها ناموفق بود.")[-1800:]})
        return handler.send_json(200,{"ok":True,"message":"ویدیوی تصاویر با موفقیت ساخته شد.","file":str(output),"duration_seconds":seconds*len(files),"size_bytes":output.stat().st_size})
    except subprocess.TimeoutExpired:
        return handler.send_json(500,{"error":"ساخت ویدیو بیش از زمان مجاز طول کشید."})
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError, OSError) as error:
        return handler.send_json(400,{"error":str(error)})

