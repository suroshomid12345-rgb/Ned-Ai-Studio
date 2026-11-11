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

async function checkConnection() {
  try {
    const data = await api("/api/health");
    connection.classList.add("online");
    connection.lastElementChild.textContent = data.message || "برنامهٔ ویندوزی وصل است";
    await loadProjects();
  } catch {
    connection.classList.remove("online");
    connection.lastElementChild.textContent = "برنامهٔ ویندوزی اجرا نیست";
    projectsBox.innerHTML = '<p class="muted">فایل start_studio.py را اجرا کن تا داشبورد به برنامه وصل شود.</p>';
  }
}

async function loadProjects() {
  try {
    const data = await api("/api/projects");
    if (!data.projects.length) {
      projectsBox.innerHTML = '<p class="muted">هنوز پروژه‌ای ثبت نشده است.</p>';
      return;
    }
    projectsBox.innerHTML = data.projects.map(project => {
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
      return item;
    });
    // Replace children with DOM nodes; project text is never interpreted as HTML.
    const nodes = Array.from(projectsBox.children);
    projectsBox.replaceChildren(...nodes);
  } catch (error) {
    projectsBox.textContent = error.message;
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
