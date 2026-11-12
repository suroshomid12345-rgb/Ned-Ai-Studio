const connection = document.getElementById("connection");
const projectsBox = document.getElementById("projects");
const form = document.getElementById("project-form");
const message = document.getElementById("form-message");
const editor = document.getElementById("editor");
const editorForm = document.getElementById("project-editor");
const editorMessage = document.getElementById("editor-message");
let activeProject = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "درخواست انجام نشد.");
  return data;
}

function setField(name, value) {
  const field = editorForm.elements.namedItem(name);
  if (field) field.value = value ?? "";
}

function editorValues() {
  return Object.fromEntries(new FormData(editorForm).entries());
}

async function loadProjects() {
  const data = await api("/api/projects");
  projectsBox.replaceChildren();
  if (!data.projects.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "هنوز پروژه‌ای ثبت نشده است.";
    projectsBox.append(empty);
    return;
  }
  for (const project of data.projects) {
    const item = document.createElement("article");
    item.className = "project";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = project.name;
    const details = document.createElement("small");
    details.textContent = [project.type, project.language, new Date(project.created_at).toLocaleDateString()].join(" · ");
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = project.status || "ایده";
    info.append(title, details, document.createElement("br"), tag);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "secondary project-open";
    open.textContent = "باز کردن پروژه";
    open.addEventListener("click", () => openProject(project.id));
    item.append(info, open);
    projectsBox.append(item);
  }
}

async function openProject(id) {
  try {
    const data = await api("/api/projects/" + encodeURIComponent(id));
    activeProject = data.project;
    document.getElementById("editor-title").textContent = "ویرایش: " + activeProject.name;
    for (const key of ["name","status","audience","duration","format","idea","script","scene_prompts","title_dari","title_english","description","hashtags","quality_notes"]) {
      setField(key, activeProject[key]);
    }
    editor.classList.remove("hidden");
    editor.scrollIntoView({behavior:"smooth", block:"start"});
    editorMessage.textContent = "پروژه باز شد. تغییرات را ذخیره کن.";
  } catch (error) {
    editorMessage.textContent = error.message;
  }
}

document.querySelectorAll(".nav-tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach(tab => tab.classList.toggle("active", tab === button));
    document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === button.dataset.view));
  });
});

async function checkConnection() {
  try {
    const data = await api("/api/health");
    connection.classList.add("online");
    connection.lastElementChild.textContent = data.message || "برنامهٔ ویندوزی وصل است";
    await loadProjects();
  } catch {
    connection.classList.remove("online");
    connection.lastElementChild.textContent = "برنامهٔ ویندوزی اجرا نیست";
    projectsBox.replaceChildren();
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = "فایل start_studio.py را اجرا کن تا داشبورد به برنامه وصل شود.";
    projectsBox.append(hint);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  message.textContent = "در حال ساخت...";
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const data = await api("/api/projects", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    message.textContent = "پروژه با موفقیت در لپ‌تاپ ثبت شد.";
    await loadProjects();
    await openProject(data.project.id);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

editorForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!activeProject) return;
  const save = editorForm.querySelector('button[type="submit"]');
  save.disabled = true;
  editorMessage.textContent = "در حال ذخیره...";
  try {
    const data = await api("/api/projects/" + encodeURIComponent(activeProject.id), {
      method: "PUT", body: JSON.stringify(editorValues())
    });
    activeProject = data.project;
    editorMessage.textContent = "تغییرات در لپ‌تاپ ذخیره شد.";
    document.getElementById("editor-title").textContent = "ویرایش: " + activeProject.name;
    await loadProjects();
  } catch (error) {
    editorMessage.textContent = error.message;
  } finally {
    save.disabled = false;
  }
});

document.getElementById("draft-kit").addEventListener("click", () => {
  const name = editorForm.elements.name.value.trim() || "موضوع ویدیو";
  const idea = editorForm.elements.idea.value.trim() || name;
  setField("script", [
    "شروع جذاب (۰ تا ۳ ثانیه): یک سؤال یا اتفاق غیرمنتظره دربارهٔ " + idea,
    "بخش اصلی: موضوع را در ۳ بخش کوتاه و تصویری توضیح بده.",
    "اوج: نکتهٔ شگفت‌انگیز یا تغییر غیرمنتظره را نشان بده.",
    "پایان: یک نتیجهٔ کوتاه و دعوت طبیعی به نظر دادن مخاطب."
  ].join("\n\n"));
  setField("scene_prompts", [
    "صحنه ۱ — Hook: نمای نزدیک و حرکت دوربین سریع؛ موضوع: " + idea,
    "صحنه ۲ — توضیح: نمایش تصویری واضح از بخش اصلی داستان؛ نورپردازی سینمایی.",
    "صحنه ۳ — اوج: تغییر یا لحظهٔ غافلگیرکننده؛ ترکیب‌بندی عمودی 9:16.",
    "صحنه ۴ — پایان: نمای جمع‌بندی و فضای مناسب برای زیرنویس."
  ].join("\n\n"));
  setField("title_dari", name);
  setField("title_english", name);
  setField("description", "در این ویدیو: " + idea + "\n\nاگر خوشت آمد، دیدگاهت را بنویس و Ned_Ai را دنبال کن.");
  setField("hashtags", "#NedAi #AIvideo #TikTok #YouTubeShorts");
  editorMessage.textContent = "قالب اولیه ساخته شد؛ متن‌ها را بازبینی و مطابق محتوای واقعی اصلاح کن. این قالب، تولید هوش مصنوعی نیست.";
});

document.getElementById("export-project").addEventListener("click", () => {
  if (!activeProject) return;
  const data = {...activeProject, ...editorValues()};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = (data.name || "ned-ai-project").replace(/[^a-z0-9-_]/gi, "-") + ".json";
  link.click();
  URL.revokeObjectURL(url);
  editorMessage.textContent = "فایل JSON پروژه آماده شد.";
});

document.getElementById("close-editor").addEventListener("click", () => {
  editor.classList.add("hidden");
  activeProject = null;
});

document.getElementById("run-ffmpeg-test").addEventListener("click", async event => {
  const button = event.currentTarget;
  const output = document.getElementById("render-test-message");
  button.disabled = true;
  output.textContent = "در حال آزمایش FFmpeg و ساخت ویدیوی سه‌ثانیه‌ای...";
  try {
    const result = await api("/api/render/test", {
      method: "POST", body: JSON.stringify({ test: true })
    });
    output.textContent = result.message + " فایل ذخیره شد: " + result.file;
  } catch (error) {
    output.textContent = "آزمایش انجام نشد: " + error.message;
  } finally {
    button.disabled = false;
  }
});

document.getElementById("refresh").addEventListener("click", checkConnection);
checkConnection();


// Local image-to-video workflow (no paid AI service required).
document.getElementById("make-image-video").addEventListener("click", async event => {
  const button = event.currentTarget;
  const picker = document.getElementById("video-images");
  const uploadStatus = document.getElementById("image-upload-message");
  const output = document.getElementById("image-video-message");
  const files = Array.from(picker.files || []);
  if (!files.length) {
    uploadStatus.textContent = "اول حداقل یک تصویر انتخاب کن.";
    return;
  }
  if (files.length > 12) {
    uploadStatus.textContent = "حداکثر ۱۲ تصویر انتخاب کن.";
    return;
  }
  const allowed = [".jpg", ".jpeg", ".png", ".webp"];
  for (const file of files) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext) || file.size > 15 * 1024 * 1024) {
      uploadStatus.textContent = "فایل " + file.name + " فرمت یا حجم مجاز ندارد.";
      return;
    }
  }
  button.disabled = true;
  output.textContent = "";
  const uploaded = [];
  try {
    for (let i = 0; i < files.length; i++) {
      uploadStatus.textContent = "در حال انتقال تصویر " + (i + 1) + " از " + files.length + "...";
      const response = await fetch("/api/media/upload?name=" + encodeURIComponent(files[i].name), {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: files[i]
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "آپلود تصویر ناموفق بود.");
      uploaded.push(result.name);
    }
    uploadStatus.textContent = files.length + " تصویر با موفقیت به لپ‌تاپ منتقل شد.";
    output.textContent = "در حال ساخت صحنه‌ها و تدوین ویدیو؛ لطفاً پنجره را نبند...";
    const result = await api("/api/render/slideshow", {
      method: "POST",
      body: JSON.stringify({
        images: uploaded,
        seconds: Number(document.getElementById("image-seconds").value),
        aspect: document.getElementById("video-aspect").value
      })
    });
    output.textContent = result.message + " مدت ویدیو: " + result.duration_seconds +
      " ثانیه. فایل ذخیره شد: " + result.file;
  } catch (error) {
    output.textContent = "ساخت ویدیو انجام نشد: " + error.message;
  } finally {
    button.disabled = false;
  }
});


// Persistent local studio settings.
async function loadStudioSettings() {
  const output = document.getElementById("settings-message");
  try {
    const data = await api("/api/settings");
    const s = data.settings;
    document.getElementById("setting-subtitles").checked = !!s.subtitles_toggle;
    document.getElementById("setting-quality").checked = !!s.quality_check;
    document.getElementById("setting-approval").checked = !!s.publishing_requires_approval;
    document.getElementById("setting-backup").checked = !!s.automatic_backup;
    document.getElementById("setting-resource").checked = !!s.resource_management;
    document.getElementById("setting-manager").checked = !!s.central_manager;
    document.getElementById("setting-resolution").value = s.default_resolution || "1080p";
    output.textContent = "تنظیمات از فایل محلی خوانده شد.";
  } catch (error) {
    output.textContent = "بارگذاری تنظیمات ناموفق بود: " + error.message;
  }
}

document.getElementById("save-settings").addEventListener("click", async event => {
  const button = event.currentTarget;
  const output = document.getElementById("settings-message");
  button.disabled = true;
  output.textContent = "در حال ذخیرهٔ تنظیمات روی لپ‌تاپ...";
  const payload = {
    subtitles_toggle: document.getElementById("setting-subtitles").checked,
    quality_check: document.getElementById("setting-quality").checked,
    publishing_requires_approval: document.getElementById("setting-approval").checked,
    automatic_backup: document.getElementById("setting-backup").checked,
    resource_management: document.getElementById("setting-resource").checked,
    central_manager: document.getElementById("setting-manager").checked,
    default_resolution: document.getElementById("setting-resolution").value
  };
  try {
    await api("/api/settings", { method: "PUT", body: JSON.stringify(payload) });
    output.textContent = "تنظیمات با موفقیت در لپ‌تاپ ذخیره شد.";
  } catch (error) {
    output.textContent = "ذخیره انجام نشد: " + error.message;
  } finally {
    button.disabled = false;
  }
});

document.getElementById("reload-settings").addEventListener("click", loadStudioSettings);
loadStudioSettings();

async function loadBackupStatus() {
  const output = document.getElementById("backup-message");
  try {
    const data = await api("/api/backup/status");
    output.textContent = "تعداد پشتیبان‌ها: " + data.count + " · آخرین نسخه: " + (data.latest || "هنوز ساخته نشده") + " · محل: " + data.directory;
  } catch (error) {
    output.textContent = "خواندن وضعیت پشتیبان ناموفق بود: " + error.message;
  }
}

document.getElementById("create-backup").addEventListener("click", async event => {
  const button = event.currentTarget;
  const output = document.getElementById("backup-message");
  button.disabled = true;
  output.textContent = "در حال ساخت فایل ZIP پشتیبان...";
  try {
    const data = await api("/api/backup/create", { method: "POST", body: JSON.stringify({}) });
    output.textContent = "پشتیبان ساخته شد: " + data.file;
    await loadBackupStatus();
  } catch (error) {
    output.textContent = "ساخت پشتیبان ناموفق بود: " + error.message;
  } finally {
    button.disabled = false;
  }
});

document.getElementById("refresh-backup").addEventListener("click", loadBackupStatus);
loadBackupStatus();


// Local Windows CPU, RAM and NVIDIA GPU monitor. Manual refresh keeps background load low.
async function loadResourceStatus() {
  const output = document.getElementById("resource-message");
  output.textContent = "در حال بررسی منابع سیستم...";
  try {
    const data = await api("/api/resources/status");
    if (!data.ok) throw new Error(data.message || "اطلاعات منابع در دسترس نیست.");
    document.getElementById("resource-cpu").textContent = data.cpu_percent + "%";
    document.getElementById("resource-ram").textContent = data.memory.used_percent + "%";
    document.getElementById("resource-ram-detail").textContent =
      data.memory.available_gb + " GB آزاد از " + data.memory.total_gb + " GB";
    const gpu = data.gpu || {};
    document.getElementById("resource-gpu").textContent = gpu.available ? gpu.usage_percent + "%" : "نامشخص";
    document.getElementById("resource-gpu-detail").textContent = gpu.available
      ? gpu.name + " · " + gpu.memory_used_mb + "/" + gpu.memory_total_mb + " MB"
      : (gpu.message || "اطلاعات GPU در دسترس نیست.");
    document.getElementById("resource-recommendation").textContent =
      data.recommendation + " وضوح پیشنهادی: " + data.recommended_resolution + ".";
    document.getElementById("resource-warnings").textContent =
      (data.warnings && data.warnings.length) ? data.warnings.join(" ") : "هشدار خاصی شناسایی نشد.";
    document.getElementById("resource-note").textContent =
      "تعداد پردازنده‌های منطقی: " + data.logical_processors + ". " + (data.note || "");
    output.textContent = "بررسی منابع با موفقیت انجام شد.";
  } catch (error) {
    output.textContent = "بررسی منابع ناموفق بود: " + error.message;
  }
}
document.getElementById("refresh-resources").addEventListener("click", loadResourceStatus);
