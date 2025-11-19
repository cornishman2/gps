// =======================================
// === CORE APP INITIALIZATION AND STATE ===
// =======================================

const STORAGE_KEY = 'surveyApp_v3';
let appState = {
    surveys: [],
    targets: [],
    activeSurveyId: null
};

// --- DOM Element References ---
const screens = document.querySelectorAll('.screen');
const navItems = document.querySelectorAll('.nav-item');
const toast = document.getElementById('toast');
const targetListContainer = document.getElementById('targetsList'); 
const surveyListContainer = document.getElementById('surveyList');  

// Modal Elements (Simplified for generic confirmation/prompt)
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');


// =======================================
// === LOCAL STORAGE & DATA MANAGEMENT ===
// =======================================

function loadState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
        appState = JSON.parse(savedState);
    }
    // Set default active view if none is set
    if (appState.activeSurveyId && !appState.surveys.find(s => s.id === appState.activeSurveyId)) {
        appState.activeSurveyId = null;
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// =======================================
// === UI & NAVIGATION FUNCTIONS ===
// =======================================

function navigate(screenId) {
    screens.forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');

    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.screen === screenId) {
            item.classList.add('active');
        }
    });

    if (screenId === 'screen-targets' && appState.activeSurveyId) {
        renderTargets();
    } else if (screenId === 'screen-home') {
        renderSurveys();
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// =======================================
// === SURVEY MANAGEMENT ===
// =======================================

function createSurvey() {
    const name = prompt("Enter new survey name:");
    if (name) {
        const newSurvey = {
            id: Date.now(),
            name: name,
            date: new Date().toLocaleDateString(),
            status: 'Active',
            targets: []
        };
        appState.surveys.push(newSurvey);
        appState.activeSurveyId = newSurvey.id;
        saveState();
        renderSurveys();
        navigate('screen-targets');
        showToast(`Survey "${name}" created and set as active.`);
    }
}

function setActiveSurvey(surveyId) {
    appState.activeSurveyId = surveyId;
    saveState();
    renderSurveys();
    renderTargets();
    navigate('screen-targets');
    showToast(`Active survey switched.`);
}

function renderSurveys() {
    surveyListContainer.innerHTML = '';
    appState.surveys.forEach(survey => {
        const isActive = survey.id === appState.activeSurveyId;
        const surveyEl = document.createElement('div');
        surveyEl.className = `survey-item ${isActive ? 'open' : ''}`;
        surveyEl.innerHTML = `
            <div class="item-header">
                <div>
                    <div class="item-title">${survey.name}</div>
                    <div class="item-meta">
                        <span>Date: ${survey.date}</span>
                        <span>Targets: ${survey.targets.length}</span>
                    </div>
                </div>
                <div class="badge ${isActive ? 'badge-success' : 'badge-muted'}">
                    ${isActive ? 'Active' : survey.status}
                </div>
            </div>
            <div class="item-actions">
                ${!isActive ? `<button class="btn btn-sm btn-primary" onclick="setActiveSurvey(${survey.id})">Activate</button>` : ''}
                </div>
        `;
        surveyListContainer.appendChild(surveyEl);
    });
}

// =======================================
// === TARGET MANAGEMENT ===
// =======================================

function createTarget() {
    if (!appState.activeSurveyId) {
        showToast("Please select or create an active survey first.");
        navigate('screen-home'); 
        return;
    }
    const name = prompt("Enter new target name:");
    if (name) {
        const newTarget = {
            id: Date.now(),
            name: name,
            lat: 0, // Placeholder
            lon: 0, // Placeholder
            status: 'New',
            // Removed 'images' array
        };
        const survey = appState.surveys.find(s => s.id === appState.activeSurveyId);
        survey.targets.push(newTarget);
        saveState();
        renderTargets();
        showToast(`Target "${name}" added.`);
    }
}

function renderTargets() {
    const survey = appState.surveys.find(s => s.id === appState.activeSurveyId);
    if (!survey) {
        targetListContainer.innerHTML = '<p class="card">No active survey selected.</p>';
        return;
    }

    document.getElementById('openSurveyName').textContent = survey.name;

    targetListContainer.innerHTML = ''; // Clear existing targets

    if (survey.targets.length === 0) {
        targetListContainer.innerHTML = '<p class="card">No targets in this survey.</p>';
        return;
    }

    survey.targets.forEach(target => {
        const targetEl = document.createElement('div');
        targetEl.className = 'target-item card';
        
        targetEl.innerHTML = `
            <div class="item-header">
                <div>
                    <div class="item-title">${target.name}</div>
                    <div class="target-coords">
                        <div class="coord-item"><span class="coord-label">Latitude:</span><span class="coord-value">${target.lat.toFixed(6)}</span></div>
                        <div class="coord-item"><span class="coord-label">Longitude:</span><span class="coord-value">${target.lon.toFixed(6)}</span></div>
                    </div>
                </div>
                <div class="badge badge-success">${target.status}</div>
            </div>

            <div class="item-actions">
                <button class="btn btn-sm btn-primary" onclick="setTargetLocation(${target.id})">Get Current Location</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTarget(${target.id})">Delete</button>
            </div>
        `;
        targetListContainer.appendChild(targetEl);
    });
}

// --- Location & Deletion Functions ---

function setTargetLocation(targetId) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const survey = appState.surveys.find(s => s.id === appState.activeSurveyId);
                const target = survey?.targets.find(t => t.id === targetId);
                
                if (target) {
                    target.lat = lat;
                    target.lon = lon;
                    target.status = 'Located';
                    saveState();
                    renderTargets();
                    showToast(`Location set for ${target.name}.`);
                }
            },
            (error) => {
                showToast(`Error getting location: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        showToast("Geolocation is not supported by this browser.");
    }
}

function deleteTarget(targetId) {
    if (!confirm("Are you sure you want to delete this target?")) return;

    const survey = appState.surveys.find(s => s.id === appState.activeSurveyId);
    if (survey) {
        const initialLength = survey.targets.length;
        survey.targets = survey.targets.filter(t => t.id !== targetId);
        if (survey.targets.length < initialLength) {
            saveState();
            renderTargets();
            showToast("Target deleted.");
        }
    }
}

// =======================================
// === MODAL LOGIC (Simplified) ===
// =======================================

// NOTE: We no longer need the complex Gallery modal functions here.
// The default browser 'confirm' prompt is used for deletion.

// =======================================
// === APP STARTUP ===
// =======================================

function init() {
    loadState();
    renderSurveys();
    
    if (appState.activeSurveyId) {
        navigate('screen-targets');
    } else {
        navigate('screen-home'); 
    }
}

// Attach navigation handlers
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navigate(item.dataset.screen);
    });
});

// Initial run
init();

// Expose global functions for HTML buttons
window.createSurvey = createSurvey;
window.setActiveSurvey = setActiveSurvey;
window.createTarget = createTarget;
window.setTargetLocation = setTargetLocation;
window.deleteTarget = deleteTarget;
