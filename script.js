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
// --- PART 2 : Targets, Images and Lightbox ---

// Element handles carried over from Part 1
const targetsListEl = document.getElementById("targetsList");
const openSurveyNameEl = document.getElementById("openSurveyName");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalCancel = document.getElementById("modalCancel");
const modalConfirm = document.getElementById("modalConfirm");

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxPrev = document.getElementById("lightboxPrev");
const lightboxNext = document.getElementById("lightboxNext");
const lightboxCounter = document.getElementById("lightboxCounter");
const lightboxChange = document.getElementById("lightboxChange");
const lightboxDelete = document.getElementById("lightboxDelete");

let selectedTargetId = null;
let currentLightboxImages = [];
let currentLightboxIndex = 0;
let currentLightboxTarget = null;

// ---------- TARGET LIST RENDERING ----------
function renderTargets() {
  const open = getOpenSurvey();
  targetsListEl.innerHTML = "";
  if (!open) {
    targetsListEl.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted)">No open survey. Please open one first.</div>';
    openSurveyNameEl.textContent = "None";
    return;
  }
  openSurveyNameEl.textContent = open.name;

  if (!open.targets.length) {
    targetsListEl.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted)">No targets yet. Add one below!</div>';
    return;
  }

  open.targets.forEach((t) => {
    const item = document.createElement("div");
    item.className = "target-item";

    const foundBadge = t.found
      ? `<span class="badge badge-success">✓ Found${t.foundNote ? " – " + escapeHtml(t.foundNote) : ""}</span>`
      : '<span class="badge badge-muted">Not found</span>';

    item.innerHTML = `
      <div class="item-header">
        <div style="flex:1">
          <div class="item-title">${escapeHtml(t.notes || "Target")}</div>
          <div class="target-coords">
            <div class="coord-item"><div class="coord-label">Lat</div><div class="coord-value">${t.lat.toFixed(6)}</div></div>
            <div class="coord-item"><div class="coord-label">Lon</div><div class="coord-value">${t.lng.toFixed(6)}</div></div>
          </div>
          <div style="margin-top:6px">${foundBadge}</div>
                    <div style="margin-top:6px">${foundBadge}</div>
          ${t.description ? `<div class="target-description">${escapeHtml(t.description)}</div>` : ""}
          <div class="image-gallery" id="gallery-${t.id}"></div>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-primary btn-sm" data-action="goto" data-id="${t.id}">🧭 Navigate</button>
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${t.id}">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${t.id}">Delete</button>
      </div>
    `;
    targetsListEl.appendChild(item);

    // --- Gallery ---
    const gallery = document.getElementById(`gallery-${t.id}`);
    if (t.images && t.images.length) {
      t.images.forEach((img, idx) => {
        const wrapper = document.createElement("div");
        wrapper.className = "gallery-image-wrapper";
        const imgEl = document.createElement("img");
        imgEl.src = img;
        imgEl.className = "gallery-image";
        imgEl.dataset.target = t.id;
        imgEl.dataset.index = idx;
        imgEl.alt = `Find photo ${idx + 1}`;
        wrapper.appendChild(imgEl);
        gallery.appendChild(wrapper);
      });
    }
    const addBtn = document.createElement("div");
    addBtn.className = "add-image-btn";
    addBtn.textContent = "+";
    addBtn.dataset.target = t.id;
    gallery.appendChild(addBtn);
  });

  // --- Bind events ---
  targetsListEl.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", targetAction)
  );
  targetsListEl.querySelectorAll(".gallery-image").forEach((img) => {
    img.addEventListener("click", () => {
      const open = getOpenSurvey();
      const targetId = img.dataset.target;
      const index = parseInt(img.dataset.index, 10);
      const target = open && open.targets.find((t) => t.id === targetId);
      if (target && target.images)
        openLightbox(target.images, index, target);
    });
  });
  targetsListEl.querySelectorAll(".add-image-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = getOpenSurvey();
      const targetId = btn.dataset.target;
      const target = open && open.targets.find((t) => t.id === targetId);
      if (target) addImageToTarget(target);
    });
  });
}

// ---------- TARGET ACTIONS ----------
function targetAction(e) {
  const a = e.currentTarget.dataset.action;
  const id = e.currentTarget.dataset.id;
  const open = getOpenSurvey();
  if (!open) return;
  const t = open.targets.find((x) => x.id === id);
  if (!t) return;

  if (a === "goto") {
    selectedTargetId = id;
    showScreen("compass");
    showToast("🧭 Navigation started");
  }
  if (a === "edit") showEditTargetModal(t);
  if (a === "delete") {
    if (!confirm("Delete this target?")) return;
    open.targets = open.targets.filter((x) => x.id !== id);
    if (selectedTargetId === id) selectedTargetId = null;
    save();
    renderTargets();
    showToast("🗑️ Target deleted");
  }
}

// ---------- EDIT TARGET ----------
function showEditTargetModal(target) {
  modalTitle.textContent = "Edit Target";
  modalBody.innerHTML = `
    <div style="margin-bottom:16px">
      <label>Name</label>
      <input type="text" id="editName" value="${escapeHtml(target.notes || "")}" style="width:100%" />
    </div>
    <div style="margin-bottom:16px">
      <label>Description</label>
      <textarea id="editDesc" style="width:100%">${escapeHtml(target.description || "")}</textarea>
    </div>`;
  modal.classList.add("active");

  modalConfirm.onclick = () => {
    target.notes = document.getElementById("editName").value;
    target.description = document.getElementById("editDesc").value;
    save();
    renderTargets();
    modal.classList.remove("active");
    showToast("✅ Updated");
  };
  modalCancel.onclick = () => modal.classList.remove("active");
}

// ---------- ADD IMAGE ----------
function addImageToTarget(target) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!target.images) target.images = [];
    showToast("📸 Processing image...");
    const reader = new FileReader();
    reader.onload = (ev) => {
      target.images.push(ev.target.result);
      save();
      renderTargets();
      showToast("✅ Image added");
    };
    reader.onerror = () => showToast("❌ Failed to process image");
    reader.readAsDataURL(file);
  };
  input.click();
}

// ---------- LIGHTBOX ----------
function openLightbox(images, startIndex, target) {
  currentLightboxImages = images;
  currentLightboxIndex = startIndex;
  currentLightboxTarget = target;
  showLightboxImage();
  lightbox.classList.add("active");
}
function showLightboxImage() {
  if (currentLightboxImages.length === 0) return;
  lightboxImage.src = currentLightboxImages[currentLightboxIndex];
  lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${currentLightboxImages.length}`;
  lightboxPrev.style.display = currentLightboxImages.length > 1 ? "flex" : "none";
  lightboxNext.style.display = currentLightboxImages.length > 1 ? "flex" : "none";
}
lightboxClose.addEventListener("click", () => lightbox.classList.remove("active"));
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.classList.remove("active");
});
lightboxPrev.addEventListener("click", () => {
  currentLightboxIndex =
    (currentLightboxIndex - 1 + currentLightboxImages.length) %
    currentLightboxImages.length;
  showLightboxImage();
});
lightboxNext.addEventListener("click", () => {
  currentLightboxIndex =
    (currentLightboxIndex + 1) % currentLightboxImages.length;
  showLightboxImage();
});
lightboxChange.addEventListener("click", () => {
  if (!currentLightboxTarget) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    lightbox.classList.remove("active");
    showToast("📸 Replacing image...");
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentLightboxTarget.images[currentLightboxIndex] = ev.target.result;
      save();
      renderTargets();
      showToast("✅ Image replaced");
    };
    reader.onerror = () => showToast("❌ Failed to replace image");
    reader.readAsDataURL(file);
  };
  input.click();
});
lightboxDelete.addEventListener("click", () => {
  if (!currentLightboxTarget) return;
  if (!confirm("Delete this image?")) return;
  currentLightboxTarget.images.splice(currentLightboxIndex, 1);
  save();
  renderTargets();
  lightbox.classList.remove("active");
  showToast("🗑️ Image deleted");


// --- END OF PART 2 ---
// --- PART 3 : Compass, GPS & Navigation ---

// --- Compass and navigation elements ---
const compassTargetName = document.getElementById("compassTargetName");
const headingEl = document.getElementById("heading");
const bearingEl = document.getElementById("bearing");
const bearingTextEl = document.getElementById("bearingText");
const arrowEl = document.getElementById("arrow");
const btnNextTarget = document.getElementById("btnNextTarget");
const btnPrevTarget = document.getElementById("btnPrevTarget");
const btnFirstTarget = document.getElementById("btnFirstTarget");
const btnLastTarget = document.getElementById("btnLastTarget");
const btnMarkFound = document.getElementById("btnMarkFound");

// --- Constants & state ---
const NAV_INTERVAL_MS = 500;
const HEADING_SMOOTH = 6;
let lastPosition = null;
let smoothedHeading = 0;
let headingSamples = [];
let orientationActive = false;
const DECLINATION_DEG = 0; // tweak later if needed

// --- Math helpers ---
function toRad(v) { return v * Math.PI / 180; }
function toDeg(v) { return v * 180 / Math.PI; }

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Bearing fixed for wrap-around across ±180°
function bearingTo(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ_raw = toRad(lon2 - lon1);
  const Δλ = ((Δλ_raw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// --- Compass Update ---
function updateNavImmediate() {
  const open = getOpenSurvey();
  if (!open || !selectedTargetId || !lastPosition) return;
  const t = open.targets.find((x) => x.id === selectedTargetId);
  if (!t) return;

  const lat = lastPosition.coords.latitude,
    lon = lastPosition.coords.longitude;
  const d = haversineMeters(lat, lon, t.lat, t.lng);
  const brg = bearingTo(lat, lon, t.lat, t.lng);
  const rel = ((brg - smoothedHeading) + 540) % 360 - 180;

  // Update display
  bearingEl.textContent = Math.round(brg);
  compassTargetName.textContent = t.notes || "Target";
  arrowEl.style.transform = `rotate(${rel}deg)`;

  // Direction text
  let direction = "";
  if (rel >= -10 && rel <= 10) direction = "Straight ahead";
  else if (rel > 10 && rel <= 45) direction = "Slight right";
  else if (rel > 45 && rel <= 90) direction = "Right";
  else if (rel > 90 && rel <= 135) direction = "Sharp right";
  else if (rel > 135 || rel < -135) direction = "Behind you";
  else if (rel < -90 && rel >= -135) direction = "Sharp left";
  else if (rel < -45 && rel >= -90) direction = "Left";
  else if (rel < -10 && rel >= -45) direction = "Slight left";
  bearingTextEl.textContent = `${direction} • ${Math.round(d)}m`;

  // Haptics near target
  if (navigator.vibrate && d < 4) navigator.vibrate([200, 100, 200]);
}

// --- Smooth compass heading & rotation correction ---
function getScreenRotationDeg() {
  const a = (screen.orientation && typeof screen.orientation.angle === "number")
    ? screen.orientation.angle
    : (typeof window.orientation === "number" ? window.orientation : 0);
  return ((a % 360) + 360) % 360;
}

function handleOrientation(e) {
  let heading = null;
  if (typeof e.webkitCompassHeading === "number") {
    // iOS
    heading = e.webkitCompassHeading;
  } else if (typeof e.alpha === "number") {
    // Android / Chrome
    const rot = getScreenRotationDeg();
    heading = (360 - ((e.alpha + rot) % 360)) % 360;
  }

  if (heading === null || isNaN(heading)) {
    orientationActive = false;
    return;
  }

  orientationActive = true;
  heading = (heading + DECLINATION_DEG + 360) % 360;

  headingSamples.push(heading);
  if (headingSamples.length > HEADING_SMOOTH) headingSamples.shift();

  let x = 0, y = 0;
  for (const h of headingSamples) {
    const r = h * Math.PI / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  smoothedHeading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

  if (headingEl) headingEl.textContent = Math.round(smoothedHeading);
  updateNavImmediate();
}

// --- Enable device orientation ---
if (window.DeviceOrientationEvent) {
  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    // iOS-style permission
    const permBtn = document.createElement("button");
    permBtn.textContent = "Enable Compass";
    permBtn.className = "btn btn-primary btn-sm";
    permBtn.style.marginTop = "8px";
    permBtn.onclick = async () => {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === "granted") {
          window.addEventListener("deviceorientation", handleOrientation);
          permBtn.remove();
          showToast("🧭 Orientation enabled");
        } else {
          alert("Orientation permission denied");
        }
      } catch (err) {
        alert("Orientation error: " + err);
      }
    };
    document.body.appendChild(permBtn);
  } else {
    // Normal Android or desktop
    window.addEventListener("deviceorientation", handleOrientation);
  }
}

// --- GPS Watch ---
function startGPS() {
  if (!navigator.geolocation) {
    document.getElementById("gpsText").textContent = "Not supported";
    return;
  }
  navigator.geolocation.watchPosition(
    (p) => {
      lastPosition = p;
      document.getElementById("gpsText").textContent = "Locked";
      document.getElementById("accText").textContent =
        (p.coords.accuracy || 0).toFixed(1) + "m";
      updateNavImmediate();
    },
    (err) => {
      document.getElementById("gpsText").textContent = "No signal";
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
}

// --- Target selector buttons ---
btnFirstTarget.addEventListener("click", () => {
  const open = getOpenSurvey();
  if (!open || !open.targets.length) return;
  selectedTargetId = open.targets[0].id;
  updateNavImmediate();
  showToast("⏮️ First target");
});
btnPrevTarget.addEventListener("click", () => {
  const open = getOpenSurvey();
  if (!open || !open.targets.length) return;
  const idx = open.targets.findIndex((x) => x.id === selectedTargetId);
  selectedTargetId =
    idx > 0 ? open.targets[idx - 1].id : open.targets[open.targets.length - 1].id;
  updateNavImmediate();
  showToast("◀️ Previous target");
});
btnNextTarget.addEventListener("click", () => {
  const open = getOpenSurvey();
  if (!open || !open.targets.length) return;
  const idx = open.targets.findIndex((x) => x.id === selectedTargetId);
  selectedTargetId =
    idx < open.targets.length - 1
      ? open.targets[idx + 1].id
      : open.targets[0].id;
  updateNavImmediate();
  showToast("▶️ Next target");
});
btnLastTarget.addEventListener("click", () => {
  const open = getOpenSurvey();
  if (!open || !open.targets.length) return;
  selectedTargetId = open.targets[open.targets.length - 1].id;
  updateNavImmediate();
  showToast("⏭️ Last target");
});

btnMarkFound.addEventListener("click", () => {
  const open = getOpenSurvey();
  if (!open || !selectedTargetId) {
    alert("⚠️ Select a target first");
    return;
  }
  const t = open.targets.find((x) => x.id === selectedTargetId);
  if (!t) return;

  modalTitle.textContent = "Mark as Found";
  modalBody.innerHTML = `
    <div style="margin-bottom:16px">
      <label>What did you find?</label>
      <input type="text" id="foundWhat" value="${escapeHtml(t.foundNote || "")}" placeholder="e.g., Gold ring" style="width:100%">
    </div>
    <div style="margin-bottom:16px">
      <label>Description</label>
      <textarea id="foundDesc" placeholder="Add details..." style="width:100%">${escapeHtml(t.description || "")}</textarea>
    </div>`;
  modal.classList.add("active");

  modalConfirm.onclick = () => {
    t.found = true;
    t.foundNote = document.getElementById("foundWhat").value;
    t.description = document.getElementById("foundDesc").value;
    save();
    renderTargets();
    modal.classList.remove("active");
    showToast("✅ Marked as found!");
  };
  modalCancel.onclick = () => modal.classList.remove("active");
});

// --- Auto-refresh loop for compass ---
setInterval(() => {
  if (lastPosition) updateNavImmediate();
}, NAV_INTERVAL_MS);

// Start GPS when ready
startGPS();

// --- END OF PART 3 ---

// --- PART 4 : Import / Export / Clear + Settings ---

// Element references
const btnExport = document.getElementById("btnExport");
const btnImport = document.getElementById("btnImport");
const importFileEl = document.getElementById("importFile");
const btnClear = document.getElementById("btnClear");
const detectoristNameEl = document.getElementById("detectoristName");
const detectorUsedEl = document.getElementById("detectorUsed");

// --- Export data ---
btnExport.addEventListener("click", () => {
  const txt = JSON.stringify(data, null, 2);
  const blob = new Blob([txt], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `metal_finder_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 2000);
  showToast("💾 Data exported");
});

// --- Import data ---
btnImport.addEventListener("click", () => importFileEl.click());
importFileEl.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const txt = await f.text();
    const obj = JSON.parse(txt);
    if (obj && obj.surveys) {
      if (!confirm("Import data? This will replace current data.")) return;
      data = obj;
      save();
      renderSurveys();
      showToast("✅ Data imported");
    } else {
      alert("Invalid data format");
    }
  } catch (err) {
    alert("Import failed: " + err.message);
  }
});

// --- Clear all data ---
btnClear.addEventListener("click", () => {
  if (!confirm("⚠️ Clear ALL data? This cannot be undone!")) return;
  if (!confirm("Are you absolutely sure?")) return;
  data = { surveys: [] };
  save();
  renderSurveys();
  showToast("🗑️ All data cleared");
});

// --- Settings live save ---
detectoristNameEl.value = data.detectoristName || "";
detectorUsedEl.value = data.detectorUsed || "";
detectoristNameEl.addEventListener("input", () => {
  data.detectoristName = detectoristNameEl.value;
  save();
});
detectorUsedEl.addEventListener("input", () => {
  data.detectorUsed = detectorUsedEl.value;
  save();
});

// --- Final initialisation ---
showToast("✅ Metal Finder ready");
}); // end DOMContentLoaded
// --- END OF PART 4 ---

