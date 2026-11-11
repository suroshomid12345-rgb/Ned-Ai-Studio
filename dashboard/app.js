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
  const language = activeProject?.language || "Dari + English";
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

document.getElementById("refresh").addEventListener("click", checkConnection);
checkConnection();
