from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SETTINGS_DIR = ROOT / "workspace" / "settings"
SETTINGS_FILE = SETTINGS_DIR / "studio_settings.json"

DEFAULT_SETTINGS = {
    "visual_style": "واقع‌گرایانه سینمایی",
    "character_mode": "هر دو؛ بسته به موضوع",
    "image_creation": "خودکار با امکان ویرایش",
    "voice_options": "مردانه و زنانه؛ قابل انتخاب",
    "voice_language": "انتخاب زبان بر اساس پروژه",
    "voice_style": "متناسب با موضوع؛ خودکار",
    "subtitles_language": "انتخاب خودکار بر اساس پروژه",
    "subtitles_toggle": True,
    "music_and_effects": "انتخاب خودکار بر اساس موضوع و صحنه؛ قابل ویرایش",
    "editing_mode": "خودکار با امکان ویرایش دستی",
    "default_resolution": "1080p",
    "allowed_resolutions": ["720p", "1080p", "4K در صورت پشتیبانی"],
    "quality_check": True,
    "publishing_requires_approval": True,
    "trend_research": "روزانه؛ منابع رایگان و قابل دسترس",
    "analytics": "پس از اتصال معتبر حساب‌ها",
    "automatic_backup": True,
    "resource_management": True,
    "central_manager": True,
    "default_languages": ["دری", "English"],
    "updated_at": None
}

def load_settings() -> dict:
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    if not SETTINGS_FILE.is_file():
        save_settings(DEFAULT_SETTINGS)
    try:
        saved = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        merged = {**DEFAULT_SETTINGS, **saved}
        return merged
    except (OSError, json.JSONDecodeError):
        return dict(DEFAULT_SETTINGS)

def save_settings(values: dict) -> dict:
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    current = load_settings() if SETTINGS_FILE.is_file() else dict(DEFAULT_SETTINGS)
    allowed = set(DEFAULT_SETTINGS) - {"updated_at"}
    for key, value in values.items():
        if key not in allowed:
            continue
        if key in {"quality_check", "publishing_requires_approval", "subtitles_toggle",
                   "automatic_backup", "resource_management", "central_manager"}:
            if not isinstance(value, bool):
                raise ValueError(f"مقدار تنظیم {key} باید روشن یا خاموش باشد.")
        elif key in {"allowed_resolutions", "default_languages"}:
            if not isinstance(value, list) or len(value) > 8 or any(not isinstance(item, str) for item in value):
                raise ValueError(f"مقدار تنظیم {key} معتبر نیست.")
        elif not isinstance(value, str) or len(value) > 300:
            raise ValueError(f"مقدار تنظیم {key} معتبر نیست.")
        current[key] = value
    from datetime import datetime, timezone
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    SETTINGS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    return current
