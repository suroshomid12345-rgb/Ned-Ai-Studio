from __future__ import annotations

import ctypes
import os
import shutil
import subprocess
import time


def _memory_status():
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]
    status = MEMORYSTATUSEX()
    status.dwLength = ctypes.sizeof(status)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        raise OSError("خواندن حافظهٔ سیستم ممکن نشد.")
    total = status.ullTotalPhys / (1024 ** 3)
    available = status.ullAvailPhys / (1024 ** 3)
    return {
        "total_gb": round(total, 1),
        "available_gb": round(available, 1),
        "used_percent": round((1 - available / total) * 100, 1) if total else 0,
    }


def _cpu_times():
    class FILETIME(ctypes.Structure):
        _fields_ = [("dwLowDateTime", ctypes.c_ulong), ("dwHighDateTime", ctypes.c_ulong)]
    idle, kernel, user = FILETIME(), FILETIME(), FILETIME()
    ok = ctypes.windll.kernel32.GetSystemTimes(
        ctypes.byref(idle), ctypes.byref(kernel), ctypes.byref(user)
    )
    if not ok:
        raise OSError("خواندن مصرف CPU ممکن نشد.")
    def value(ft):
        return (ft.dwHighDateTime << 32) | ft.dwLowDateTime
    return value(idle), value(kernel), value(user)


def _cpu_percent():
    first = _cpu_times()
    time.sleep(0.18)
    second = _cpu_times()
    idle = second[0] - first[0]
    total = (second[1] - first[1]) + (second[2] - first[2])
    return round(max(0.0, min(100.0, (1 - idle / total) * 100)), 1) if total else 0.0


def _gpu_status():
    executable = shutil.which("nvidia-smi")
    if not executable:
        return {"available": False, "name": "GPU", "message": "ابزار nvidia-smi پیدا نشد؛ مقدار GPU قابل خواندن نیست."}
    try:
        result = subprocess.run(
            [executable, "--query-gpu=name,utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=3, check=False
        )
        if result.returncode != 0 or not result.stdout.strip():
            return {"available": False, "name": "GPU", "message": "درایور NVIDIA مقدار GPU را گزارش نکرد."}
        parts = [part.strip() for part in result.stdout.strip().splitlines()[0].split(",")]
        if len(parts) < 4:
            raise ValueError("پاسخ nvidia-smi قابل تشخیص نیست.")
        return {
            "available": True, "name": parts[0],
            "usage_percent": float(parts[1]),
            "memory_used_mb": int(float(parts[2])),
            "memory_total_mb": int(float(parts[3])),
            "message": "اطلاعات از درایور NVIDIA خوانده شد."
        }
    except (OSError, subprocess.TimeoutExpired, ValueError) as error:
        return {"available": False, "name": "GPU", "message": f"خواندن GPU ناموفق بود: {error}"}


def get_resource_status():
    if os.name != "nt":
        return {"ok": False, "message": "مدیریت منابع فعلاً برای Windows پیاده‌سازی شده است."}
    memory = _memory_status()
    cpu = _cpu_percent()
    gpu = _gpu_status()
    warnings = []
    if memory["available_gb"] < 3:
        warnings.append("حافظهٔ آزاد RAM کم است؛ برنامه‌های غیرضروری را ببند.")
    if cpu >= 80:
        warnings.append("مصرف CPU بلند است؛ رندر را سبک یا به تعویق بینداز.")
    if gpu.get("available") and gpu.get("memory_total_mb", 0) <= 2500:
        warnings.append("حافظهٔ گرافیکی محدود است؛ از رندر CPU-first و وضوح 720p یا 1080p سبک استفاده کن.")
    if memory["available_gb"] < 2 or cpu >= 90:
        recommendation = "فعلاً رندر سنگین را اجرا نکن؛ ابتدا منابع سیستم را آزاد کن."
        quality = "720p"
    elif memory["available_gb"] < 4 or cpu >= 75:
        recommendation = "برای رندر سبک، 720p و یک کار هم‌زمان پیشنهاد می‌شود."
        quality = "720p"
    else:
        recommendation = "سیستم برای کار سبک آماده است؛ 1080p با یک کار هم‌زمان مناسب‌تر است."
        quality = "1080p"
    return {
        "ok": True, "cpu_percent": cpu, "memory": memory, "gpu": gpu,
        "logical_processors": os.cpu_count() or 1,
        "recommended_resolution": quality, "recommendation": recommendation,
        "warnings": warnings,
        "note": "این سنجش فقط وضعیت لحظه‌ای را نشان می‌دهد؛ GPUهای Intel ممکن است جداگانه گزارش نشوند."
    }
