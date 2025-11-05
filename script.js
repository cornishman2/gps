// Metal Finder v5 – Part 1: Core Framework
document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "metal_finder_v5_data";

  // --- Element references ---
  const toast = document.getElementById("toast");
  const screens = {
    home: document.getElementById("screen-home"),
    targets: document.getElementById("screen-targets"),
    compass: document.getElementById("screen-compass"),
    settings: document.getElementById("screen-settings"),
  };
  const navBtns = [...document.querySelectorAll(".nav-item")];
  const surveyListEl = document.getElementById("surveyList");
  const btnNewSurvey = document.getElementById("btnNewSurvey");
  const btnNewSurveyAdd = document.getElementById("btnNewSurveyAdd");
  const btnCloseSurvey = document.getElementById("btnCloseSurvey");

  // --- State ---
  let data = load();
  data.surveys = data.surveys || [];
  let currentScreen = "home";

  // --- Utilities ---
  function uid(p = "id") {
    return p + Math.random().toString(36).slice(2, 9);
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    showToast("💾 Saved");
  }
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toast.style.display = "none"), 2000);
  }
  function escapeHtml(t) {
    const d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }

  // --- Screen navigation ---
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    screens[name].classList.remove("hidden");
    navBtns.forEach((b) =>
      b.classList.toggle("active", b.dataset.screen === name)
    );
    currentScreen = name;
    if (name === "home") renderSurveys();
  }
  navBtns.forEach((b) =>
    b.addEventListener("click", () => showScreen(b.dataset.screen))
  );

  // --- Survey Management ---
  function getOpenSurvey() {
    return data.surveys.find((s) => s.status === "Open" && !s.archived);
  }
  function setOnlyOpen(id) {
    data.surveys.forEach((s) => {
      s.status =
        s.id === id ? "Open" : s.status === "Open" ? "Closed" : s.status;
    });
  }
  function createSurvey(name) {
    setOnlyOpen(null);
    const s = {
      id: uid("s_"),
      name: name || "Survey " + new Date().toLocaleString(),
      createdAt: Date.now(),
      status: "Open",
      archived: false,
      targets: [],
    };
    data.surveys.push(s);
    save();
    renderSurveys();
    return s;
  }

  function renderSurveys() {
    surveyListEl.innerHTML = "";
    const open = data.surveys.filter((s) => s.status === "Open" && !s.archived);
    const closed = data.surveys.filter((s) => s.status === "Closed" && !s.archived);
    const archived = data.surveys.filter((s) => s.archived);
    const sortByDate = (arr) => arr.sort((a, b) => b.createdAt - a.createdAt);

    sortByDate(open).forEach((s) => addSurveyItem(s, "open"));
    sortByDate(closed).forEach((s) => addSurveyItem(s));
    if (archived.length) {
      surveyListEl.innerHTML += `<div class="divider">📦 Archived Surveys</div>`;
      sortByDate(archived).forEach((s) => addSurveyItem(s, "archived"));
    }
    if (!data.surveys.length) {
      surveyListEl.innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--muted)">No surveys yet. Create one to get started!</div>';
    }
  }

  function addSurveyItem(s, cls) {
    const item = document.createElement("div");
    item.className = "survey-item" + (cls ? " " + cls : "");
    let actions = "";
    if (s.archived) {
      actions = `<button class="btn btn-secondary btn-sm" data-action="restore" data-id="${s.id}">Restore</button>`;
    } else {
      actions += `<button class="btn btn-secondary btn-sm" data-action="view" data-id="${s.id}">View</button>`;
      if (s.status !== "Open")
        actions += `<button class="btn btn-secondary btn-sm" data-action="open" data-id="${s.id}">Set Open</button>`;
      if (s.status === "Open")
        actions += `<button class="btn btn-secondary btn-sm" data-action="close" data-id="${s.id}">Close</button>`;
      actions += `<button class="btn btn-secondary btn-sm" data-action="archive" data-id="${s.id}">Archive</button>`;
      actions += `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}">Delete</button>`;
    }
    const statusBadge =
      s.status === "Open"
        ? '<span class="badge badge-success">● Open</span>'
        : '<span class="badge badge-muted">Closed</span>';
    item.innerHTML = `
      <div class="item-header">
        <div>
          <div class="item-title">${escapeHtml(s.name)}</div>
          <div class="item-meta">
            <span>${new Date(s.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>${s.targets.length} targets</span>
            <span>•</span>
            ${statusBadge}
          </div>
        </div>
      </div>
      <div class="item-actions">${actions}</div>`;
    surveyListEl.appendChild(item);
    item.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", surveyAction)
    );
  }

  function surveyAction(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const idx = data.surveys.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const s = data.surveys[idx];

    switch (action) {
      case "view":
        showScreen("targets");
        break;
      case "open":
        setOnlyOpen(id);
        save();
        renderSurveys();
        showToast("✅ Set as open");
        break;
      case "close":
        s.status = "Closed";
        save();
        renderSurveys();
        showToast("🔒 Closed");
        break;
      case "archive":
        s.archived = true;
        s.status = "Closed";
        save();
        renderSurveys();
        showToast("📦 Archived");
        break;
      case "restore":
        s.archived = false;
        s.status = "Closed";
        save();
        renderSurveys();
        showToast("✅ Restored");
        break;
      case "delete":
        if (!confirm(`Delete survey “${s.name}”?`)) return;
        data.surveys.splice(idx, 1);
        save();
        renderSurveys();
        showToast("🗑️ Deleted");
        break;
    }
  }

  // --- New / Add / Close survey buttons ---
  btnNewSurvey.addEventListener("click", () => {
    const name = prompt("Survey name:", "Field " + new Date().toLocaleDateString());
    if (!name) return;
    createSurvey(name);
    showToast("✨ Survey created");
  });
  btnNewSurveyAdd.addEventListener("click", () => {
    showToast("🪄 Add + New Survey – to be implemented");
  });
  btnCloseSurvey.addEventListener("click", () => {
    const o = getOpenSurvey();
    if (!o) {
      alert("⚠️ No open survey");
      return;
    }
    if (!confirm("Close the current survey?")) return;
    o.status = "Closed";
    save();
    renderSurveys();
    showToast("🔒 Survey closed");
  });

  // --- Initial render ---
  renderSurveys();
  showScreen("home");

}); // end DOMContentLoaded
// --- END OF PART 1 ---
