// Metal Finder – Minimal Functional Version (for button testing only)

document.addEventListener('DOMContentLoaded', () => {

  const STORAGE_KEY = 'metal_finder_v4_data';
  const toast = document.getElementById('toast');

  const screens = {
    home: document.getElementById('screen-home'),
    targets: document.getElementById('screen-targets'),
    compass: document.getElementById('screen-compass'),
    settings: document.getElementById('screen-settings')
  };

  const navBtns = [...document.querySelectorAll('.nav-item')];
  const surveyListEl = document.getElementById('surveyList');
  const btnNewSurvey = document.getElementById('btnNewSurvey');
  const btnNewSurveyAdd = document.getElementById('btnNewSurveyAdd');
  const btnCloseSurvey = document.getElementById('btnCloseSurvey');
  const btnAddTarget = document.getElementById('btnAddTarget');
  const btnBatch = document.getElementById('btnBatch');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const importFileEl = document.getElementById('importFile');
  const btnClear = document.getElementById('btnClear');

  let data = load();
  data.surveys = data.surveys || [];

  // --- Utilities ---
  function uid(p = 'id') { return p + Math.random().toString(36).slice(2, 9); }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); showToast('💾 Saved'); }
  function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.style.display = 'none', 2000);
  }

  // --- Screen navigation ---
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.screen === name));
    if (name === 'home') renderSurveys();
  }

  navBtns.forEach(b =>
    b.addEventListener('click', () => showScreen(b.dataset.screen))
  );

  // --- Surveys ---
  function getOpenSurvey() {
    return data.surveys.find(s => s.status === 'Open' && !s.archived);
  }

  function createSurvey(name) {
    data.surveys.forEach(s => s.status = s.id === name ? 'Open' : 'Closed');
    const s = {
      id: uid('s_'),
      name: name || ('Survey ' + new Date().toLocaleString()),
      createdAt: Date.now(),
      status: 'Open',
      archived: false,
      targets: []
    };
    data.surveys.push(s);
    save();
    renderSurveys();
    return s;
  }

  function renderSurveys() {
    surveyListEl.innerHTML = '';
    if (!data.surveys.length) {
      surveyListEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No surveys yet. Create one to get started!</div>';
      return;
    }
    data.surveys.forEach(s => {
      const div = document.createElement('div');
      div.className = 'survey-item';
      div.innerHTML = `
        <div class="item-header">
          <div class="item-title">${s.name}</div>
          <div class="item-meta">${new Date(s.createdAt).toLocaleDateString()} • ${s.targets.length} targets</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-secondary btn-sm" data-action="view" data-id="${s.id}">View</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}">Delete</button>
        </div>
      `;
      surveyListEl.appendChild(div);
      div.querySelectorAll('button').forEach(b => b.addEventListener('click', surveyAction));
    });
  }

  function surveyAction(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.id;
    const sIndex = data.surveys.findIndex(x => x.id === id);
    if (sIndex === -1) return;

    if (btn.dataset.action === 'delete') {
      if (!confirm('Delete this survey?')) return;
      data.surveys.splice(sIndex, 1);
      save();
      renderSurveys();
      showToast('🗑️ Deleted');
    }
    if (btn.dataset.action === 'view') {
      showToast('👀 View pressed (stub)');
    }
  }

  // --- Button Handlers ---
  btnNewSurvey.addEventListener('click', () => {
    const name = prompt('Survey name:', 'Field ' + new Date().toLocaleDateString());
    if (!name) return;
    createSurvey(name);
    showToast('✨ Survey created');
  });

  btnNewSurveyAdd.addEventListener('click', () => {
    showToast('🪄 Add + New Survey (stub)');
  });

  btnCloseSurvey.addEventListener('click', () => {
    const o = getOpenSurvey();
    if (!o) { alert('⚠️ No open survey'); return; }
    o.status = 'Closed';
    save();
    renderSurveys();
    showToast('🔒 Survey closed');
  });

  btnAddTarget.addEventListener('click', () => {
    showToast('🎯 Add target (stub)');
  });

  btnBatch.addEventListener('click', () => {
    showToast('🔄 Batch add (stub)');
  });

  btnExport.addEventListener('click', () => {
    const txt = JSON.stringify(data, null, 2);
    const blob = new Blob([txt], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metal_finder_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
    showToast('💾 Data exported');
  });

  btnImport.addEventListener('click', () => importFileEl.click());
  importFileEl.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const obj = JSON.parse(txt);
      if (obj && obj.surveys) {
        if (!confirm('Import data? This will overwrite existing data.')) return;
        data = obj;
        save();
        renderSurveys();
        showToast('✅ Data imported');
      } else {
        alert('Invalid data format');
      }
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  });

  btnClear.addEventListener('click', () => {
    if (!confirm('⚠️ Clear ALL data?')) return;
    data = { surveys: [] };
    save();
    renderSurveys();
    showToast('🗑️ All data cleared');
  });

  // --- Initial render ---
  renderSurveys();
  showScreen('home');
});
