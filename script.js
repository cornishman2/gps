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
const compassScreen = document.getElementById('screen-compass');
const targetListContainer = document.getElementById('target-list-container');
const surveyListContainer = document.getElementById('survey-list-container');

// --- Global State for Gallery Modal ---
const THUMBNAILS_PER_ROW = 2; // Used by CSS: grid-template-columns: 1fr 1fr;
let activeGallery = {
    targetId: null,
    index: 0,
    images: []
};

// Modal Elements
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalImage = document.getElementById('modalImage');
const btnModalPrev = document.getElementById('btnModalPrev');
const btnModalNext = document.getElementById('btnModalNext');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnDeleteImage = document.getElementById('btnDeleteImage');
const btnReplaceImage = document.getElementById('btnReplaceImage');
const imageInput = document.getElementById('imageInput');


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
    } else if (screenId === 'screen-surveys') {
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
// === TARGET MANAGEMENT (INCLUDING IMAGES) ===
// =======================================

function createTarget() {
    if (!appState.activeSurveyId) {
        showToast("Please select or create an active survey first.");
        navigate('screen-surveys');
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
            images: [] // Image array stored here
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

    targetListContainer.innerHTML = `<h2 class="card-title">${survey.name} Targets</h2>`;

    if (survey.targets.length === 0) {
        targetListContainer.innerHTML += '<p class="card">No targets in this survey.</p>';
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

            <div class="divider">Images (${target.images.length})</div>
            <div id="gallery-${target.id}" class="image-gallery">
                <div id="galleryGrid-${target.id}" class="image-gallery-grid">
                    </div>
                <button class="add-image-btn" onclick="triggerImageInput(${target.id})">
                    + Add New Image
                </button>
            </div>

            <div class="item-actions">
                <button class="btn btn-sm btn-primary" onclick="setTargetLocation(${target.id})">Get Current Location</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTarget(${target.id})">Delete</button>
            </div>
        `;
        targetListContainer.appendChild(targetEl);
        renderTargetImages(target.id, target.images);
    });
}

// --- Image Handling Functions ---

function renderTargetImages(targetId, images) {
    const gridEl = document.getElementById(`galleryGrid-${targetId}`);
    if (!gridEl) return;

    gridEl.innerHTML = ''; // Clear existing thumbnails

    // Set the grid template based on the constant for visual alignment
    gridEl.style.gridTemplateColumns = `repeat(${THUMBNAILS_PER_ROW}, 1fr)`;

    images.forEach((base64Image, index) => {
        const thumbnailEl = document.createElement('div');
        thumbnailEl.className = 'image-thumbnail';
        thumbnailEl.style.backgroundImage = `url(${base64Image})`;
        
        // Open modal on click
        thumbnailEl.onclick = () => openGalleryModal(targetId, index, images);
        gridEl.appendChild(thumbnailEl);
    });
}

function triggerImageInput(targetId, isReplace = false, imageIndex = null) {
    // Set global context for what the input is doing
    imageInput.dataset.targetId = targetId;
    imageInput.dataset.isReplace = isReplace;
    imageInput.dataset.imageIndex = imageIndex;
    imageInput.click();
}

imageInput.onchange = function(event) {
    const file = event.target.files[0];
    const targetId = parseInt(imageInput.dataset.targetId);
    const isReplace = imageInput.dataset.isReplace === 'true';
    const imageIndex = parseInt(imageInput.dataset.imageIndex);

    if (file && targetId) {
        const reader = new FileReader();
        reader.onloadend = function() {
            const base64Image = reader.result;
            handleImageUpload(targetId, base64Image, isReplace, imageIndex);
        };
        reader.readAsDataURL(file);
    }
    // Reset the input field so the change event fires even if the same file is selected
    imageInput.value = null;
};

function handleImageUpload(targetId, base64Image, isReplace, imageIndex) {
    const survey = appState.surveys.find(s => s.id === appState.activeSurveyId);
    const target = survey?.targets.find(t => t.id === targetId);

    if (!target) return;

    if (isReplace) {
        // Replace existing image
        if (imageIndex !== null && imageIndex >= 0 && imageIndex < target.images.length) {
            target.images[imageIndex] = base64Image;
            showToast('Image replaced successfully.');
        }
    } else {
        // Add new image
        target.images.push(base64Image);
        showToast('Image added successfully.');
    }

    saveState();
    renderTargets();

    // If replacing inside the modal, update the modal immediately
    if (modal.classList.contains('active') && isReplace) {
        activeGallery.images = target.images;
        updateGalleryModal();
    }
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
// === GALLERY MODAL LOGIC ===
// =======================================

function openGalleryModal(targetId, index, images) {
    const survey = appState.surveys.find(s => s.id === appState.activeSurveyId);
    const target = survey?.targets.find(t => t.id === targetId);
    if (!target || images.length === 0) return;

    activeGallery = {
        targetId: targetId,
        index: index,
        images: images 
    };

    modalTitle.textContent = target.name;
    modal.classList.add('active');
    updateGalleryModal();
}

function updateGalleryModal() {
    const { index, images } = activeGallery;
    const total = images.length;

    if (total === 0) {
        modal.classList.remove('active');
        return;
    }

    // Update image source
    modalImage.src = images[index];

    // Update navigation buttons state
    btnModalPrev.disabled = index === 0;
    btnModalNext.disabled = index === total - 1;
    
    // Update delete button logic
    btnDeleteImage.onclick = () => deleteImage(activeGallery.targetId, index);
    
    // Update replace button logic
    btnReplaceImage.onclick = () => triggerImageInput(activeGallery.targetId, true, index);
}

function deleteImage(targetId, index) {
    if (!confirm("Are you sure you want to delete this image?")) return;

    const survey = appState.surveys.find(s => s.id === appState.activeSurveyId);
    const target = survey?.targets.find(t => t.id === targetId);

    if (target) {
        target.images.splice(index, 1);
        saveState();
        renderTargets();
        showToast('Image deleted.');
        
        // Re-evaluate gallery state after deletion
        if (target.images.length === 0) {
            modal.classList.remove('active'); // Close modal if no images remain
        } else {
            // Adjust index if the last item was deleted
            activeGallery.index = Math.min(index, target.images.length - 1);
            activeGallery.images = target.images;
            updateGalleryModal();
        }
    }
}

// =======================================
// === MODAL EVENT LISTENERS ===
// =======================================

// Close modal when clicking the close button
btnCloseModal.addEventListener('click', () => {
    modal.classList.remove('active');
});

// Close modal when pressing the ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
    }
});

// Navigation buttons with the necessary console error fix (added 'e')
btnModalPrev.addEventListener('click', (e) => {
    // ⚠️ Defensive check for disabled state (fixes potential runtime issues)
    if (e.currentTarget.disabled) { 
        return; 
    }
    
    if (activeGallery.index > 0) {
      activeGallery.index--;
      updateGalleryModal();
    }
});

btnModalNext.addEventListener('click', () => {
    if (activeGallery.index < activeGallery.images.length - 1) {
      activeGallery.index++;
      updateGalleryModal();
    }
});


// =======================================
// === APP STARTUP ===
// =======================================

function init() {
    loadState();
    renderSurveys();
    // Start on the Surveys screen if no active survey, otherwise Targets
    if (appState.activeSurveyId) {
        navigate('screen-targets');
    } else {
        navigate('screen-surveys');
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
window.triggerImageInput = triggerImageInput;
window.openGalleryModal = openGalleryModal; // Used by dynamically created thumbnails
