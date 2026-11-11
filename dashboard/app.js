const connection = document.getElementById("connection");
const projectsBox = document.getElementById("projects");
const form = document.getElementById("project-form");
const message = document.getElementById("form-message");

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "درخواست انجام نشد.");
  return data;
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
    const title = document.createElement("strong");
    title.textContent = project.name;
    const details = document.createElement("small");
    details.textContent = [project.type, project.language, new Date(project.created_at).toLocaleDateString()].join(" · ");
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = project.status || "ایده";
    item.append(title, details, document.createElement("br"), tag);
    projectsBox.append(item);
  }
}

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
    await api("/api/projects", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    message.textContent = "پروژه با موفقیت در لپ‌تاپ ثبت شد.";
    await loadProjects();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.getElementById("refresh").addEventListener("click", checkConnection);
checkConnection();
