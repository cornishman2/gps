
document.addEventListener("DOMContentLoaded", () => {
  // ---------- Storage ----------
  const STORAGE_KEY = "metal_finder_v5_data";
  let data = load();
  data.surveys = Array.isArray(data.surveys) ? data.surveys : [];

  // ---------- Elements ----------
  const toast = $("#toast");

  const screens = {
    home: $("#screen-home"),
    targets: $("#screen-targets"),
    compass: $("#screen-compass"),
    settings: $("#screen-settings"),
  };

  const navBtns = $all(".bottom-nav .nav-item");

  // Home
  const detectoristNameEl = $("#detectoristName");
  const detectorUsedEl = $("#detectorUsed");
  const btnNewSurvey = $("#btnNewSurvey");
  const btnNewSurveyAdd = $("#btnNewSurveyAdd");
  const btnCloseSurvey = $("#btnCloseSurvey");
  const surveyListEl = $("#surveyList");

  // Targets
  const btnAddTarget = $("#btnAddTarget");
  const btnBatch = $("#btnBatch");
  const openSurveyNameEl = $("#openSurveyName");
  const targetsListEl = $("#targetsList");

  // Compass
  const compassTargetName = $("#compassTargetName");
  const headingEl = $("#heading");
  const bearingEl = $("#bearing");
  const bearingTextEl = $("#bearingText");
  const arrowEl = $("#arrow");
  const btnFirstTarget = $("#btnFirstTarget");
  const btnPrevTarget = $("#btnPrevTarget");
  const btnNextTarget = $("#btnNextTarget");
  const btnLastTarget = $("#btnLastTarget");
  const btnMarkFound = $("#btnMarkFound");

  // GPS header
  const gpsText = $("#gpsText");
  const accText = $("#accText");

  // Lightbox & modal
  const lightbox = $("#lightbox");
  const lightboxImage = $("#lightboxImage");
  const lightboxClose = $("#lightboxClose");
  const lightboxPrev = $("#lightboxPrev");
  const lightboxNext = $("#lightboxNext");
  const lightboxCounter = $("#lightboxCounter");
  const lightboxChange = $("#lightboxChange");
  const lightboxDelete = $("#lightboxDelete");

  const modal = $("#modal");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");
  const modalCancel = $("#modalCancel");
  const modalConfirm = $("#modalConfirm");

  // Settings actions
  const btnExport = $("#btnExport");
  const btnImport = $("#btnImport");
  const importFileEl = $("#importFile");
  const btnClear = $("#btnClear");

  // ---------- State ----------
  let currentScreen = "home";
  let selectedTargetId = null;
  let lastPosition = null;
  let batchInterval = null;

  // Lightbox state
  let currentLightboxImages = [];
  let currentLightboxIndex = 0;
  let currentLightboxTarget = null;

  // Compass state/constants
  const NAV_INTERVAL_MS = 500;
  const HEADING_SMOOTH = 6;
  const DECLINATION_DEG = 0; // tweak later if you want local magnetic declination
  let headingSamples = [];
  let smoothedHeading = 0;

  // ---------- Utils ----------
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
  function uid(p = "id") { return p + Math.random().toString(36).slice(2, 9); }
  function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); showToast("💾 Saved"); }
  function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toast.style.display = "none"), 1600);
  }
  function escapeHtml(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

  // ---------- Navigation ----------
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add("hidden"));
    screens[name].classList.remove("hidden");
    navBtns.forEach(b => b.classList.toggle("active", b.dataset.screen === name));
    currentScreen = name;
    if (name === "home") renderSurveys();
    if (name === "targets") renderTargets();
    if (name === "compass") updateNavImmediate();
  }
  navBtns.forEach(b => b.addEventListener("click", () => showScreen(b.dataset.screen)));

  // ---------- Survey helpers ----------
  function getOpenSurvey() {
    return data.surveys.find(s => s.status === "Open" && !s.archived) || null;
  }
  function setOnlyOpen(id) {
    data.surveys.forEach(s => {
      s.status = (s.id === id) ? "Open" : (s.status === "Open" ? "Closed" : s.status);
    });
  }
  function createSurvey(name) {
    setOnlyOpen(null); // close any open one
    const s = {
      id: uid("s_"),
      name: name || ("Survey " + new Date().toLocaleString()),
      createdAt: Date.now(),
      status: "Open",
      archived: false,
      targets: []
    };
    data.surveys.push(s);
    save();
    renderSurveys();
    return s;
  }

  // ---------- Render Surveys ----------
  function renderSurveys() {
    surveyListEl.innerHTML = "";
    const open = data.surveys.filter(s => s.status === "Open" && !s.archived);
    const closed = data.surveys.filter(s => s.status === "Closed" && !s.archived);
    const archived = data.surveys.filter(s => s.archived);
    const sortByDate = arr => arr.sort((a, b) => b.createdAt - a.createdAt);

    sortByDate(open).forEach(s => addSurveyItem(s, "open"));
    sortByDate(closed).forEach(s => addSurveyItem(s));
    if (archived.length) {
      surveyListEl.innerHTML += `<div class="divider">📦 Archived Surveys</div>`;
      sortByDate(archived).forEach(s => addSurveyItem(s, "archived"));
    }
    if (!data.surveys.length) {
      surveyListEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">No surveys yet. Create one to get started!</div>`;
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
      if (s.status !== "Open") actions += `<button class="btn btn-secondary btn-sm" data-action="open" data-id="${s.id}">Set Open</button>`;
      if (s.status === "Open") actions += `<button class="btn btn-secondary btn-sm" data-action="close" data-id="${s.id}">Close</button>`;
      actions += `<button class="btn btn-secondary btn-sm" data-action="archive" data-id="${s.id}">Archive</button>`;
      actions += `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}">Delete</button>`;
    }
    const statusBadge = s.status === "Open"
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
      <div class="item-actions">${actions}</div>
    `;
    surveyListEl.appendChild(item);
    item.querySelectorAll("button").forEach(b => b.addEventListener("click", surveyAction));
  }

  function surveyAction(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const idx = data.surveys.findIndex(x => x.id === id);
    if (idx === -1) return;
    const s = data.surveys[idx];

    switch (action) {
      case "view":
        showScreen("targets");
        renderTargets();
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
        if (!confirm(`Delete survey “${s.name}” and all its targets? This cannot be undone.`)) return;
        data.surveys.splice(idx, 1);
        save();
        renderSurveys();
        showToast("🗑️ Survey deleted");
        break;
    }
  }

  // ---------- Home buttons ----------
  btnNewSurvey.addEventListener("click", () => {
    const name = prompt("Survey name:", "Field " + new Date().toLocaleDateString());
    if (!name) return;
    createSurvey(name);
    showToast("✨ Survey created");
  });

  btnNewSurveyAdd.addEventListener("click", () => {
    if (!lastPosition) {
      alert("⚠️ No GPS fix yet. Please wait for GPS.");
      return;
    }
    const name = prompt("Survey name:", "Field " + new Date().toLocaleDateString());
    if (!name) return;
    const s = createSurvey(name);
    const note = prompt("First target name:", "") || "";
    s.targets.push({
      id: uid("t_"),
      lat: lastPosition.coords.latitude,
      lng: lastPosition.coords.longitude,
      notes: note,
      description: "",
      detectorist: data.detectoristName || "",
      detector: data.detectorUsed || "",
      createdAt: Date.now(),
      found: false,
      images: []
    });
    save();
    showToast("✅ Survey + first target added");
    renderTargets();
    showScreen("targets");
  });

  btnCloseSurvey.addEventListener("click", () => {
    const o = getOpenSurvey();
    if (!o) { alert("⚠️ No open survey"); return; }
    if (!confirm("Close the current survey?")) return;
    o.status = "Closed";
    save();
    renderSurveys();
    showToast("🔒 Survey closed");
  });

  // ---------- Targets ----------
  function renderTargets() {
    const open = getOpenSurvey();
    targetsListEl.innerHTML = "";
    if (!open) {
      openSurveyNameEl.textContent = "None";
      targetsListEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">No open survey. Please open one first.</div>`;
      return;
    }
    openSurveyNameEl.textContent = open.name;

    if (!open.targets.length) {
      targetsListEl.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">No targets yet. Add one!</div>`;
      return;
    }

    open.targets.forEach(t => {
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
              <div class="coord-item"><div class="coord-label">Latitude</div><div class="coord-value">${t.lat.toFixed(6)}</div></div>
              <div class="coord-item"><div class="coord-label">Longitude</div><div class="coord-value">${t.lng.toFixed(6)}</div></div>
            </div>
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

      // gallery
      const gallery = $("#gallery-" + t.id);
      if (t.images && t.images.length) {
        t.images.forEach((img, idx) => {
          const wrap = document.createElement("div");
          wrap.className = "gallery-image-wrapper";
          const im = document.createElement("img");
          im.src = img;
          im.className = "gallery-image";
          im.dataset.target = t.id;
          im.dataset.index = String(idx);
          im.alt = `Find photo ${idx + 1}`;
          wrap.appendChild(im);
          gallery.appendChild(wrap);
        });
      }
      const addBtn = document.createElement("div");
      addBtn.className = "add-image-btn";
      addBtn.textContent = "+";
      addBtn.dataset.target = t.id;
      gallery.appendChild(addBtn);
    });

    // binds
    targetsListEl.querySelectorAll("button").forEach(b => b.addEventListener("click", targetAction));
    targetsListEl.querySelectorAll(".gallery-image").forEach(img => {
      img.addEventListener("click", () => {
        const open = getOpenSurvey();
        const targetId = img.dataset.target;
        const index = parseInt(img.dataset.index, 10);
        const target = open && open.targets.find(tt => tt.id === targetId);
        if (target && target.images) openLightbox(target.images, index, target);
      });
    });
    targetsListEl.querySelectorAll(".add-image-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const open = getOpenSurvey();
        const targetId = btn.dataset.target;
        const target = open && open.targets.find(tt => tt.id === targetId);
        if (target) addImageToTarget(target);
      });
    });
  }

  function targetAction(e) {
    const a = e.currentTarget.dataset.action;
    const id = e.currentTarget.dataset.id;
    const open = getOpenSurvey();
    if (!open) return;
    const t = open.targets.find(x => x.id === id);
    if (!t) return;

    if (a === "goto") {
      selectedTargetId = id;
      showScreen("compass");
      showToast("🧭 Navigation started");
      updateNavImmediate();
    } else if (a === "edit") {
      showEditTargetModal(t);
    } else if (a === "delete") {
      if (!confirm("Delete this target?")) return;
      open.targets = open.targets.filter(x => x.id !== id);
      if (selectedTargetId === id) selectedTargetId = null;
      save();
      renderTargets();
      showToast("🗑️ Target deleted");
    }
  }

  // Add target button (fix for your case)
  btnAddTarget.addEventListener("click", () => {
    const open = getOpenSurvey();
    if (!open) { alert("⚠️ No open survey. Create or open one on Home."); return; }
    if (!lastPosition) { alert("⚠️ No GPS fix yet. Please wait for GPS."); return; }

    modalTitle.textContent = "Add New Target";
    modalBody.innerHTML = `
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:6px;color:var(--muted);font-size:14px">Name (optional)</label>
        <input type="text" id="newTargetName" placeholder="e.g., Roman coin signal" style="width:100%">
      </div>
      <div>
        <label style="display:block;margin-bottom:6px;color:var(--muted);font-size:14px">Description (optional)</label>
        <textarea id="newTargetDesc" placeholder="Add notes..." style="width:100%"></textarea>
      </div>
    `;
    modal.classList.add("active");

    modalConfirm.onclick = () => {
      const name = ($("#newTargetName")?.value || "").trim();
      const desc = ($("#newTargetDesc")?.value || "").trim();
      open.targets.push({
        id: uid("t_"),
        lat: lastPosition.coords.latitude,
        lng: lastPosition.coords.longitude,
        notes: name,
        description: desc,
        detectorist: data.detectoristName || "",
        detector: data.detectorUsed || "",
        createdAt: Date.now(),
        found: false,
        images: []
      });
      save();
      renderTargets();
      modal.classList.remove("active");
      showToast("✅ Target added");
    };
    modalCancel.onclick = () => modal.classList.remove("active");
  });

  // Batch add toggle
  btnBatch.addEventListener("click", () => {
    const open = getOpenSurvey();
    if (!open) { alert("⚠️ No open survey"); return; }
    if (!batchInterval) {
      btnBatch.classList.remove("btn-secondary");
      btnBatch.classList.add("btn-danger");
      btnBatch.textContent = "⏹️ Stop Batch";
      batchInterval = setInterval(() => {
        if (!lastPosition) return;
        open.targets.push({
          id: uid("t_"),
          lat: lastPosition.coords.latitude,
          lng: lastPosition.coords.longitude,
          notes: "",
          description: "",
          detectorist: data.detectoristName || "",
          detector: data.detectorUsed || "",
          createdAt: Date.now(),
          found: false,
          images: []
        });
        save();
        renderTargets();
      }, 3000);
      showToast("🔄 Batch mode started");
    } else {
      clearInterval(batchInterval);
      batchInterval = null;
      btnBatch.classList.remove("btn-danger");
      btnBatch.classList.add("btn-secondary");
      btnBatch.textContent = "🔄 Batch Add";
      showToast("⏹️ Batch mode stopped");
    }
  });

  // ---------- Edit Target ----------
  function showEditTargetModal(target) {
    modalTitle.textContent = "Edit Target";
    modalBody.innerHTML = `
      <div style="margin-bottom:12px">
        <label style="display:block;margin-bottom:6px;color:var(--muted);font-size:14px">Name</label>
        <input type="text" id="editName" value="${escapeHtml(target.notes || "")}" style="width:100%">
      </div>
      <div>
        <label style="display:block;margin-bottom:6px;color:var(--muted);font-size:14px">Description</label>
        <textarea id="editDesc" style="width:100%">${escapeHtml(target.description || "")}</textarea>
      </div>
    `;
    modal.classList.add("active");

    modalConfirm.onclick = () => {
      target.notes = $("#editName").value;
      target.description = $("#editDesc").value;
      save();
      renderTargets();
      modal.classList.remove("active");
      showToast("✅ Updated");
    };
    modalCancel.onclick = () => modal.classList.remove("active");
  }

  // ---------- Lightbox ----------
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
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.classList.remove("active"); });
  lightboxPrev.addEventListener("click", () => {
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
    showLightboxImage();
  });
  lightboxNext.addEventListener("click", () => {
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
    showLightboxImage();
  });
  lightboxChange.addEventListener("click", () => {
    if (!currentLightboxTarget) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
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
  });

  function addImageToTarget(target) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
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

  // ---------- Compass & GPS ----------
  function toRad(v) { return v * Math.PI / 180; }
  function toDeg(v) { return v * 180 / Math.PI; }

  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Bearing with ±180° wrap fix
  function bearingTo(lat1, lon1, lat2, lon2) {
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δλ_raw = toRad(lon2 - lon1);
    const Δλ = ((Δλ_raw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function getScreenRotationDeg() {
    const a = (screen.orientation && typeof screen.orientation.angle === "number")
      ? screen.orientation.angle
      : (typeof window.orientation === "number" ? window.orientation : 0);
    return ((a % 360) + 360) % 360;
  }

  function handleOrientation(e) {
    let heading = null;
    if (typeof e.webkitCompassHeading === "number") {
      heading = e.webkitCompassHeading; // iOS
    } else if (typeof e.alpha === "number") {
      const rot = getScreenRotationDeg(); // Android/Chrome
      heading = (360 - ((e.alpha + rot) % 360)) % 360;
    }
    if (heading == null || isNaN(heading)) return;

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

  function updateNavImmediate() {
    if (currentScreen !== "compass") return;
    const open = getOpenSurvey();
    if (!open || !selectedTargetId || !lastPosition) return;
    const t = open.targets.find(x => x.id === selectedTargetId);
    if (!t) return;

    const lat = lastPosition.coords.latitude;
    const lon = lastPosition.coords.longitude;
    const d = haversineMeters(lat, lon, t.lat, t.lng);
    const brg = bearingTo(lat, lon, t.lat, t.lng);
    const rel = ((brg - smoothedHeading) + 540) % 360 - 180;

    bearingEl.textContent = Math.round(brg);
    compassTargetName.textContent = t.notes || "Target";
    arrowEl.style.transform = `rotate(${rel}deg)`;

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

    if (navigator.vibrate && d < 4) navigator.vibrate([200, 100, 200]);
  }

  // Orientation permission (only if needed)
  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      // iOS-style prompt button (add below the compass controls so it's visible when needed)
      const permBtn = document.createElement("button");
      permBtn.textContent = "Enable Compass";
      permBtn.className = "btn btn-primary btn-sm";
      permBtn.style.marginTop = "8px";
      permBtn.addEventListener("click", async () => {
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
      });
      // Append when compass screen is shown
      screens.compass.querySelector(".compass-controls").appendChild(permBtn);
    } else {
      // Android/desktop
      window.addEventListener("deviceorientation", handleOrientation);
    }
  }

  // GPS
  function startGPS() {
    if (!navigator.geolocation) {
      gpsText.textContent = "Not supported";
      return;
    }
    navigator.geolocation.watchPosition(
      (p) => {
        lastPosition = p;
        gpsText.textContent = "Locked";
        accText.textContent = (p.coords.accuracy || 0).toFixed(1) + "m";
        updateNavImmediate();
      },
      (err) => {
        gpsText.textContent = "No signal";
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }
  setInterval(() => { if (lastPosition) updateNavImmediate(); }, NAV_INTERVAL_MS);

  // Compass target selectors
  btnFirstTarget.addEventListener("click", () => {
    const open = getOpenSurvey(); if (!open || !open.targets.length) return;
    selectedTargetId = open.targets[0].id;
    updateNavImmediate();
    showToast("⏮️ First target");
  });
  btnPrevTarget.addEventListener("click", () => {
    const open = getOpenSurvey(); if (!open || !open.targets.length) return;
    const i = open.targets.findIndex(x => x.id === selectedTargetId);
    selectedTargetId = i > 0 ? open.targets[i - 1].id : open.targets[open.targets.length - 1].id;
    updateNavImmediate();
    showToast("◀️ Previous target");
  });
  btnNextTarget.addEventListener("click", () => {
    const open = getOpenSurvey(); if (!open || !open.targets.length) return;
    const i = open.targets.findIndex(x => x.id === selectedTargetId);
    selectedTargetId = (i >= 0 && i < open.targets.length - 1) ? open.targets[i + 1].id : open.targets[0].id;
    updateNavImmediate();
    showToast("▶️ Next target");
  });
  btnLastTarget.addEventListener("click", () => {
    const open = getOpenSurvey(); if (!open || !open.targets.length) return;
    selectedTargetId = open.targets[open.targets.length - 1].id;
    updateNavImmediate();
    showToast("⏭️ Last target");
  });

  btnMarkFound.addEventListener("click", () => {
    const open = getOpenSurvey();
    if (!open || !selectedTargetId) { alert("⚠️ Select a target first"); return; }
    const t = open.targets.find(x => x.id === selectedTargetId);
    if (!t) return;

    modalTitle.textContent = "Mark as Found";
    modalBody.innerHTML = `
      <div style="margin-bottom:12px">
        <label>What did you find?</label>
        <input type="text" id="foundWhat" value="${escapeHtml(t.foundNote || "")}" placeholder="e.g., Gold ring" style="width:100%">
      </div>
      <div>
        <label>Description</label>
        <textarea id="foundDesc" placeholder="Add details..." style="width:100%">${escapeHtml(t.description || "")}</textarea>
      </div>
    `;
    modal.classList.add("active");

    modalConfirm.onclick = () => {
      t.found = true;
      t.foundNote = $("#foundWhat").value;
      t.description = $("#foundDesc").value;
      save();
      renderTargets();
      modal.classList.remove("active");
      showToast("✅ Marked as found!");
    };
    modalCancel.onclick = () => modal.classList.remove("active");
  });

  // ---------- Import/Export/Clear ----------
  btnExport.addEventListener("click", () => {
    const txt = JSON.stringify(data, null, 2);
    const blob = new Blob([txt], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metal_finder_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    showToast("💾 Data exported");
  });

  btnImport.addEventListener("click", () => importFileEl.click());
  importFileEl.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const txt = await f.text();
      const obj = JSON.parse(txt);
      if (obj && Array.isArray(obj.surveys)) {
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

  btnClear.addEventListener("click", () => {
    if (!confirm("⚠️ Clear ALL data? This cannot be undone!")) return;
    if (!confirm("Are you absolutely sure?")) return;
    data = { surveys: [] };
    save();
    renderSurveys();
    showToast("🗑️ All data cleared");
  });

  // ---------- Settings live save ----------
  detectoristNameEl.value = data.detectoristName || "";
  detectorUsedEl.value = data.detectorUsed || "";
  detectoristNameEl.addEventListener("input", () => { data.detectoristName = detectoristNameEl.value; save(); });
  detectorUsedEl.addEventListener("input", () => { data.detectorUsed = detectorUsedEl.value; save(); });

  // ---------- Init ----------
  renderSurveys();
  showScreen("home");
  startGPS();
});
document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "metal_finder_v5_data";
  const NAV_INTERVAL_MS = 500;
  const HEADING_SMOOTH = 6;
  const DECLINATION_DEG = 0; // adjust if you want magnetic declination compensation

  // --- Element references (match your existing HTML ids/classes) ---
  const toast = document.getElementById("toast");
  const screens = {
    home: document.getElementById("screen-home"),
    targets: document.getElementById("screen-targets"),
    compass: document.getElementById("screen-compass"),
    settings: document.getElementById("screen-settings"),
  };
  const navBtns = [...document.querySelectorAll(".nav-item")];
  const surveyListEl = document.getElementById("surveyList");
  const targetsListEl = document.getElementById("targetsList");
  const btnNewSurvey = document.getElementById("btnNewSurvey");
  const btnNewSurveyAdd = document.getElementById("btnNewSurveyAdd");
  const btnCloseSurvey = document.getElementById("btnCloseSurvey");

  const openSurveyNameEl = document.getElementById("openSurveyName");

  // Lightbox
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");
  const lightboxCounter = document.getElementById("lightboxCounter");
  const lightboxChange = document.getElementById("lightboxChange");
  const lightboxDelete = document.getElementById("lightboxDelete");

  // Modal
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalCancel = document.getElementById("modalCancel");
  const modalConfirm = document.getElementById("modalConfirm");

  // Compass
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

  // Settings + data I/O
  const btnExport = document.getElementById("btnExport");
  const btnImport = document.getElementById("btnImport");
  const importFileEl = document.getElementById("importFile");
  const btnClear = document.getElementById("btnClear");
  const detectoristNameEl = document.getElementById("detectoristName");
  const detectorUsedEl = document.getElementById("detectorUsed");

  // --- App State ---
  let data = load();
  data.surveys = data.surveys || [];
  let currentScreen = "home";

  // Targets / compass state
  let selectedTargetId = null;
  let lastPosition = null;
  let headingSamples = [];
  let smoothedHeading = 0;

  // Lightbox state
  let currentLightboxImages = [];
  let currentLightboxIndex = 0;
  let currentLightboxTarget = null;

  // --- Utilities ---
  function uid(p = "id") { return p + Math.random().toString(36).slice(2, 9); }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); showToast("💾 Saved"); }
  function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toast.style.display = "none"), 1800);
  }
  function escapeHtml(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

  // --- Screen navigation ---
  function showScreen(name) {
    Object.values(screens).forEach((s) => s && s.classList.add("hidden"));
    if (screens[name]) screens[name].classList.remove("hidden");
    navBtns.forEach((b) => b.classList.toggle("active", b.dataset.screen === name));
    currentScreen = name;
    if (name === "home") renderSurveys();
    if (name === "targets") renderTargets();
  }
  navBtns.forEach((b) => b.addEventListener("click", () => showScreen(b.dataset.screen)));

  // --- Survey Management ---
  function getOpenSurvey() { return data.surveys.find((s) => s.status === "Open" && !s.archived); }
  function setOnlyOpen(id) { data.surveys.forEach((s) => { s.status = (s.id === id) ? "Open" : (s.status === "Open" ? "Closed" : s.status); }); }
  function createSurvey(name) {
    setOnlyOpen(null);
    const s = { id: uid("s_"), name: name || ("Survey " + new Date().toLocaleString()), createdAt: Date.now(), status: "Open", archived: false, targets: [] };
    data.surveys.push(s);
    save(); renderSurveys();
    return s;
  }

  function renderSurveys() {
    if (!surveyListEl) return;
    surveyListEl.innerHTML = "";
    const open = data.surveys.filter((s) => s.status === "Open" && !s.archived);
    const closed = data.surveys.filter((s) => s.status === "Closed" && !s.archived);
    const archived = data.surveys.filter((s) => s.archived);
    const sortByDate = (arr) => arr.slice().sort((a, b) => b.createdAt - a.createdAt);

    sortByDate(open).forEach((s) => addSurveyItem(s, "open"));
    sortByDate(closed).forEach((s) => addSurveyItem(s));
    if (archived.length) {
      surveyListEl.innerHTML += `<div class="divider">📦 Archived Surveys</div>`;
      sortByDate(archived).forEach((s) => addSurveyItem(s, "archived"));
    }
    if (!data.surveys.length) {
      surveyListEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No surveys yet. Create one to get started!</div>';
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
      if (s.status !== "Open") actions += `<button class="btn btn-secondary btn-sm" data-action="open" data-id="${s.id}">Set Open</button>`;
      if (s.status === "Open") actions += `<button class="btn btn-secondary btn-sm" data-action="close" data-id="${s.id}">Close</button>`;
      actions += `<button class="btn btn-secondary btn-sm" data-action="archive" data-id="${s.id}">Archive</button>`;
      actions += `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}">Delete</button>`;
    }
    const statusBadge = s.status === "Open" ? '<span class="badge badge-success">● Open</span>' : '<span class="badge badge-muted">Closed</span>';
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
    item.querySelectorAll("button").forEach((b) => b.addEventListener("click", surveyAction));
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
        save(); renderSurveys();
        showToast("✅ Set as open");
        break;
      case "close":
        s.status = "Closed";
        save(); renderSurveys();
        showToast("🔒 Closed");
        break;
      case "archive":
        s.archived = true; s.status = "Closed";
        save(); renderSurveys();
        showToast("📦 Archived");
        break;
      case "restore":
        s.archived = false; s.status = "Closed";
        save(); renderSurveys();
        showToast("✅ Restored");
        break;
      case "delete":
        if (!confirm(`Delete survey “${s.name}” and all its targets? This cannot be undone.`)) return;
        data.surveys.splice(idx, 1);
        save(); renderSurveys();
        showToast("🗑️ Deleted");
        break;
    }
  }

  // --- Buttons (New/Add/Close survey) ---
  if (btnNewSurvey) btnNewSurvey.addEventListener("click", () => {
    const name = prompt("Survey name:", "Field " + new Date().toLocaleDateString());
    if (!name) return;
    createSurvey(name);
    showToast("✨ Survey created");
  });
  if (btnNewSurveyAdd) btnNewSurveyAdd.addEventListener("click", () => {
    if (!lastPosition) { alert("⚠️ No GPS fix yet. Please wait for GPS."); return; }
    const name = prompt("Survey name:", "Field " + new Date().toLocaleDateString());
    if (!name) return;
    const s = createSurvey(name);
    const note = prompt("First target name:", "") || "";
    s.targets.push({ id: uid("t_"), lat: lastPosition.coords.latitude, lng: lastPosition.coords.longitude, notes: note, description: "", detectorist: data.detectoristName || "", detector: data.detectorUsed || "", createdAt: Date.now(), found: false, images: [] });
    save();
    showScreen("targets");
    renderTargets();
    showToast("✅ Survey + first target created");
  });
  if (btnCloseSurvey) btnCloseSurvey.addEventListener("click", () => {
    const o = getOpenSurvey();
    if (!o) { alert("⚠️ No open survey"); return; }
    if (!confirm("Close the current survey?")) return;
    o.status = "Closed";
    save(); renderSurveys();
    showToast("🔒 Survey closed");
  });

  // --- Targets UI ---
  function renderTargets() {
    const open = getOpenSurvey();
    if (!targetsListEl) return;
    targetsListEl.innerHTML = "";
    if (!open) {
      targetsListEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No open survey. Please open one on the Home screen.</div>';
      if (openSurveyNameEl) openSurveyNameEl.textContent = "None";
      return;
    }
    if (openSurveyNameEl) openSurveyNameEl.textContent = open.name;
    if (!open.targets.length) {
      targetsListEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No targets yet. Add your first target!</div>';
      return;
    }

    open.targets.forEach((t) => {
      const item = document.createElement("div");
      item.className = "target-item";
      const foundBadge = t.found ? `<span class="badge badge-success">✓ Found${t.foundNote ? " – " + escapeHtml(t.foundNote) : ""}</span>` : '<span class="badge badge-muted">Not found</span>';
      item.innerHTML = `
        <div class="item-header">
          <div style="flex:1">
            <div class="item-title">${escapeHtml(t.notes || "Target")}</div>
            <div class="target-coords">
              <div class="coord-item"><div class="coord-label">Latitude</div><div class="coord-value">${t.lat.toFixed(6)}</div></div>
              <div class="coord-item"><div class="coord-label">Longitude</div><div class="coord-value">${t.lng.toFixed(6)}</div></div>
            </div>
            <div style="margin-top:6px">${foundBadge}</div>
            ${t.description ? `<div class="target-description">${escapeHtml(t.description)}</div>` : ""}
            <div class="image-gallery" id="gallery-${t.id}"></div>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn btn-primary btn-sm" data-action="goto" data-id="${t.id}">🧭 Navigate</button>
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${t.id}">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${t.id}">Delete</button>
        </div>`;
      targetsListEl.appendChild(item);

      // gallery
      const gallery = document.getElementById(`gallery-${t.id}`);
      if (gallery) {
        if (t.images && t.images.length) {
          t.images.forEach((img, idx) => {
            const wrapper = document.createElement("div");
            wrapper.className = "gallery-image-wrapper";
            const imgEl = document.createElement("img");
            imgEl.src = img;
            imgEl.className = "gallery-image";
            imgEl.dataset.target = t.id;
            imgEl.dataset.index = String(idx);
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
      }
    });

    // bind events
    targetsListEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", targetAction));
    targetsListEl.querySelectorAll(".gallery-image").forEach((img) => {
      img.addEventListener("click", () => {
        const open = getOpenSurvey();
        const targetId = img.dataset.target;
        const index = parseInt(img.dataset.index, 10);
        const target = open && open.targets.find((t) => t.id === targetId);
        if (target && target.images) openLightbox(target.images, index, target);
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
      updateNavImmediate();
      showToast("🧭 Navigation started");
    } else if (a === "edit") {
      showEditTargetModal(t);
    } else if (a === "delete") {
      if (!confirm("Delete this target?")) return;
      open.targets = open.targets.filter((x) => x.id !== id);
      if (selectedTargetId === id) selectedTargetId = null;
      save(); renderTargets();
      showToast("🗑️ Target deleted");
    }
  }

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
      save(); renderTargets();
      modal.classList.remove("active");
      showToast("✅ Updated");
    };
    modalCancel.onclick = () => modal.classList.remove("active");
  }

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
        save(); renderTargets();
        showToast("✅ Image added");
      };
      reader.onerror = () => showToast("❌ Failed to process image");
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // --- Lightbox ---
  function openLightbox(images, startIndex, target) {
    currentLightboxImages = images || [];
    currentLightboxIndex = startIndex || 0;
    currentLightboxTarget = target || null;
    showLightboxImage();
    if (lightbox) lightbox.classList.add("active");
  }
  function showLightboxImage() {
    if (!currentLightboxImages.length) return;
    if (lightboxImage) lightboxImage.src = currentLightboxImages[currentLightboxIndex];
    if (lightboxCounter) lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${currentLightboxImages.length}`;
    if (lightboxPrev) lightboxPrev.style.display = currentLightboxImages.length > 1 ? "flex" : "none";
    if (lightboxNext) lightboxNext.style.display = currentLightboxImages.length > 1 ? "flex" : "none";
  }
  if (lightboxClose) lightboxClose.addEventListener("click", () => lightbox.classList.remove("active"));
  if (lightbox) lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.classList.remove("active"); });
  if (lightboxPrev) lightboxPrev.addEventListener("click", () => { currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length; showLightboxImage(); });
  if (lightboxNext) lightboxNext.addEventListener("click", () => { currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length; showLightboxImage(); });
  if (lightboxChange) lightboxChange.addEventListener("click", () => {
    if (!currentLightboxTarget) return;
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (lightbox) lightbox.classList.remove("active");
      showToast("📸 Replacing image...");
      const reader = new FileReader();
      reader.onload = (ev) => {
        currentLightboxTarget.images[currentLightboxIndex] = ev.target.result;
        save(); renderTargets();
        showToast("✅ Image replaced");
      };
      reader.onerror = () => showToast("❌ Failed to replace image");
      reader.readAsDataURL(file);
    };
    input.click();
  });
  if (lightboxDelete) lightboxDelete.addEventListener("click", () => {
    if (!currentLightboxTarget) return;
    if (!confirm("Delete this image?")) return;
    currentLightboxTarget.images.splice(currentLightboxIndex, 1);
    save(); renderTargets();
    if (lightbox) lightbox.classList.remove("active");
    showToast("🗑️ Image deleted");
  });

  // --- Compass / GPS ---
  function toRad(v) { return v * Math.PI / 180; }
  function toDeg(v) { return v * 180 / Math.PI; }
  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  function bearingTo(lat1, lon1, lat2, lon2) {
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δλ_raw = toRad(lon2 - lon1);
    const Δλ = ((Δλ_raw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  function getScreenRotationDeg() {
    const a = (screen.orientation && typeof screen.orientation.angle === "number") ? screen.orientation.angle : (typeof window.orientation === "number" ? window.orientation : 0);
    return ((a % 360) + 360) % 360;
  }
  function handleOrientation(e) {
    let heading = null;
    if (typeof e.webkitCompassHeading === "number") {
      heading = e.webkitCompassHeading; // iOS
    } else if (typeof e.alpha === "number") {
      const rot = getScreenRotationDeg(); // Android / Chrome
      heading = (360 - ((e.alpha + rot) % 360)) % 360;
    }
    if (heading == null || isNaN(heading)) return;

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

  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      // iOS: show a button inside the compass screen area if available, else body
      const btn = document.createElement("button");
      btn.textContent = "Enable Compass";
      btn.className = "btn btn-primary btn-sm";
      btn.style.marginTop = "8px";
      btn.onclick = async () => {
        try {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
            btn.remove();
            showToast("🧭 Orientation enabled");
          } else {
            alert("Orientation permission denied");
          }
        } catch (err) {
          alert("Orientation error: " + err);
        }
      };
      (screens.compass || document.body).appendChild(btn);
    } else {
      // Android / desktop
      window.addEventListener("deviceorientation", handleOrientation);
    }
  }

  function startGPS() {
    if (!navigator.geolocation) {
      const gpsText = document.getElementById("gpsText");
      if (gpsText) gpsText.textContent = "Not supported";
      return;
    }
    navigator.geolocation.watchPosition(
      (p) => {
        lastPosition = p;
        const gpsText = document.getElementById("gpsText");
        const accText = document.getElementById("accText");
        if (gpsText) gpsText.textContent = "Locked";
        if (accText) accText.textContent = (p.coords.accuracy || 0).toFixed(1) + "m";
        updateNavImmediate();
      },
      () => {
        const gpsText = document.getElementById("gpsText");
        if (gpsText) gpsText.textContent = "No signal";
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }

  function updateNavImmediate() {
    const open = getOpenSurvey();
    if (!open || !selectedTargetId || !lastPosition) return;
    const t = open.targets.find((x) => x.id === selectedTargetId);
    if (!t) return;

    const lat = lastPosition.coords.latitude, lon = lastPosition.coords.longitude;
    const d = haversineMeters(lat, lon, t.lat, t.lng);
    const brg = bearingTo(lat, lon, t.lat, t.lng);
    const rel = ((brg - smoothedHeading) + 540) % 360 - 180;

    if (bearingEl) bearingEl.textContent = Math.round(brg);
    if (compassTargetName) compassTargetName.textContent = t.notes || "Target";
    if (arrowEl) arrowEl.style.transform = `rotate(${rel}deg)`;

    let direction = "";
    if (rel >= -10 && rel <= 10) direction = "Straight ahead";
    else if (rel > 10 && rel <= 45) direction = "Slight right";
    else if (rel > 45 && rel <= 90) direction = "Right";
    else if (rel > 90 && rel <= 135) direction = "Sharp right";
    else if (rel > 135 || rel < -135) direction = "Behind you";
    else if (rel < -90 && rel >= -135) direction = "Sharp left";
    else if (rel < -45 && rel >= -90) direction = "Left";
    else if (rel < -10 && rel >= -45) direction = "Slight left";
    if (bearingTextEl) bearingTextEl.textContent = `${direction} • ${Math.round(d)}m`;

    if (navigator.vibrate && d < 4) navigator.vibrate([200, 100, 200]);
  }
  setInterval(() => { if (lastPosition) updateNavImmediate(); }, NAV_INTERVAL_MS);

  // Target selector buttons
  if (btnFirstTarget) btnFirstTarget.addEventListener("click", () => {
    const open = getOpenSurvey(); if (!open || !open.targets.length) return;
    selectedTargetId = open.targets[0].id;
    updateNavImmediate(); showToast("⏮️ First target");
  });
  if (btnPrevTarget) btnPrevTarget.addEventListener("click", () => {
    const open = getOpenSurvey(); if (!open || !open.targets.length) return;
    const idx = open.targets.findIndex((x) => x.id === selectedTargetId);
    selectedTargetId = idx > 0 ? open.targets[idx - 1].id : open.targets[open.targets.length - 1].id;
    updateNavImmediate(); showToast("◀️ Previous target");
  });
  if (btnNextTarget) btnNextTarget.addEventListener("click", () => {
    const open = getOpenSurvey(); if (!open || !open.targets.length) return;
    const idx = open.targets.findIndex((x) => x.id === selectedTargetId);
    selectedTargetId = idx < open.targets.length - 1 ? open.targets[idx + 1].id : open.targets[0].id;
    updateNavImmediate(); showToast("▶️ Next target");
  });
  if (btnLastTarget) btnLastTarget.addEventListener("click", () => {
    const open = getOpenSurvey(); if (!open || !open.targets.length) return;
    selectedTargetId = open.targets[open.targets.length - 1].id;
    updateNavImmediate(); showToast("⏭️ Last target");
  });

  if (btnMarkFound) btnMarkFound.addEventListener("click", () => {
    const open = getOpenSurvey();
    if (!open || !selectedTargetId) { alert("⚠️ Select a target first"); return; }
    const t = open.targets.find((x) => x.id === selectedTargetId);
    if (!t) return;

    modalTitle.textContent = "Mark as Found";
    modalBody.innerHTML = `
      <div style="margin-bottom:16px">
        <label>What did you find?</label>
        <input type="text" id="foundWhat" value="${escapeHtml(t.foundNote || "")}" placeholder="e.g., Gold ring, Roman coin" style="width:100%">
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
      save(); renderTargets();
      modal.classList.remove("active");
      showToast("✅ Marked as found!");
    };
    modalCancel.onclick = () => modal.classList.remove("active");
  });

  // --- Import/Export/Clear & Settings ---
  if (btnExport) btnExport.addEventListener("click", () => {
    const txt = JSON.stringify(data, null, 2);
    const blob = new Blob([txt], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metal_finder_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1200);
    showToast("💾 Data exported");
  });
  if (btnImport) btnImport.addEventListener("click", () => importFileEl && importFileEl.click());
  if (importFileEl) importFileEl.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const txt = await f.text();
      const obj = JSON.parse(txt);
      if (obj && obj.surveys) {
        if (!confirm("Import data? This will replace current data.")) return;
        data = obj; save(); renderSurveys();
        showToast("✅ Data imported");
      } else {
        alert("Invalid data format");
      }
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  });
  if (btnClear) btnClear.addEventListener("click", () => {
    if (!confirm("⚠️ Clear ALL data? This cannot be undone!")) return;
    if (!confirm("Are you absolutely sure?")) return;
    data = { surveys: [] }; save(); renderSurveys();
    showToast("🗑️ All data cleared");
  });

  if (detectoristNameEl) detectoristNameEl.value = data.detectoristName || "";
  if (detectorUsedEl) detectorUsedEl.value = data.detectorUsed || "";
  if (detectoristNameEl) detectoristNameEl.addEventListener("input", () => { data.detectoristName = detectoristNameEl.value; save(); });
  if (detectorUsedEl) detectorUsedEl.addEventListener("input", () => { data.detectorUsed = detectorUsedEl.value; save(); });

  // --- Init ---
  renderSurveys();
  showScreen("home");
  startGPS();

  // Wake the orientation sensors early (harmless read)
  if (window.DeviceOrientationEvent) window.addEventListener("deviceorientation", () => {}, { once: true });

  showToast("✅ Metal Finder ready");
}); // end DOMContentLoaded
