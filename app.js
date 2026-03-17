// ============== STATE MANAGEMENT ==============
const state = {
    currentDate: new Date(),
    sessions: [], // Array of all sessions
    scheduledSessions: {}, // Format: { 'YYYY-MM-DD': [sessionIds] }
    dayNotes: {}, // Format: { 'YYYY-MM-DD': { text, visible } }
    selectedDay: null,
    draggedSession: null,
    isDragging: false,
    activeModalSessionId: null,
    activeModalDateStr: null,
    isEditingSession: false,
    volumeDays: 7,
};


const categoryLabels = {
    ef: 'EF',
    sv1: 'SV1 Seuil Aérobie - SV2 Seuil Anaérobie',
    sv2: 'SV2 Seuil Anaérobie - VMA',
    vma: 'VMA - Vitesse - VO2max',
    aerobic: 'Aérobie',
    sprint: 'Sprint',
    force: 'Force',
    flexibility: 'Flexibilité',
    technique: 'Technique',
    other: 'Autre',
};

const sportLabels = {
    running: 'Course à pied',
    cycling: 'Cyclisme',
    hike_alpi: 'Randonnée & Alpi',
    ski_rando: 'Ski de rando',
    ski_fond: 'Ski de fond',
    climbing: 'Escalade',
    strength: 'Musculation',
};

const slowRunningCategories = new Set([
    'ef',
    'sv1',
    'aerobic',
    'flexibility',
    'technique',
    'other',
]);

const defaultDayNote = `AS 5K: ... : ... '/km | 10K: ... : ... '/km | 21K: ... : ... '/km | 42K: ... : ... '/km
FC : i1: ... - ... bpm | i2: ... - ... bpm | i3: ... - ... bpm | i4: ... - ... bpm | i5: ... - ... bpm`;

function getRunningIconType(category) {
    return slowRunningCategories.has(category) ? 'slow' : 'fast';
}

// ============== DOM ELEMENTS ==============
const elements = {
    sessionTitle: document.getElementById('sessionTitle'),
    sessionComment: document.getElementById('sessionComment'),
    sessionCategory: document.getElementById('sessionCategory'),
    sessionSport: document.getElementById('sessionSport'),
    addSessionBtn: document.getElementById('addSessionBtn'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    todayBtn: document.getElementById('todayBtn'),
    monthYear: document.getElementById('monthYear'),
    calendarDays: document.getElementById('calendarDays'),
    selectedDayTitle: document.getElementById('selectedDayTitle'),
    daySessionsList: document.getElementById('daySessionsList'),
    dayNote: document.getElementById('dayNote'),
    dayNoteContent: document.getElementById('dayNoteContent'),
    noteMenuBtn: document.getElementById('noteMenuBtn'),
    noteMenu: document.getElementById('noteMenu'),
    noteVisibilityMenu: document.getElementById('noteVisibilityMenu'),
    dayNoteEditor: document.getElementById('dayNoteEditor'),
    dayNoteTextarea: document.getElementById('dayNoteTextarea'),
    dayNoteSave: document.getElementById('dayNoteSave'),
    dayNoteCancel: document.getElementById('dayNoteCancel'),
    volumeEstimateContent: document.getElementById('volumeEstimateContent'),
    volumeEstimateTotal: document.getElementById('volumeEstimateTotal'),
    volumeDaysSelect: document.getElementById('volumeDaysSelect'),
    sessionVolumeRange: document.getElementById('sessionVolumeRange'),
    sessionVolumeValue: document.getElementById('sessionVolumeValue'),
    sessionVolumeMin: document.getElementById('sessionVolumeMin'),
    sessionVolumeMax: document.getElementById('sessionVolumeMax'),
    sessionModal: document.getElementById('sessionModal'),
    modalBody: document.getElementById('modalBody'),
    deleteSessionBtn: document.getElementById('deleteSessionBtn'),
    editSessionBtn: document.getElementById('editSessionBtn'),
    saveSessionBtn: document.getElementById('saveSessionBtn'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    closeModalX: document.querySelector('.close-modal'),
};

// ============== INITIALIZATION ==============
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    purgePastScheduledSessions();
    renderCalendar();
    renderSessions();
    setupEventListeners();
    setupResponsiveLayout();
    selectToday();
    scheduleDailyCleanup();
});

function setupEventListeners() {
    // Add session
    elements.addSessionBtn.addEventListener('click', addSession);
    elements.sessionTitle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSession();
    });

    // Toggle add form
    const toggleBtn = document.getElementById('toggleAddForm');
    const addSection = document.getElementById('addSessionSection');
    toggleBtn.addEventListener('click', () => {
        addSection.classList.toggle('hidden');
    });

    // Calendar navigation
    elements.prevMonth.addEventListener('click', () => changeMonth(-1));
    elements.nextMonth.addEventListener('click', () => changeMonth(1));
    if (elements.todayBtn) {
        elements.todayBtn.addEventListener('click', () => {
            state.currentDate = new Date();
            renderCalendar();
        });
    }

    // Modal
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.closeModalX.addEventListener('click', closeModal);
    elements.deleteSessionBtn.addEventListener('click', deleteScheduledSession);
    elements.sessionModal.addEventListener('click', (e) => {
        if (e.target === elements.sessionModal) closeModal();
    });
    if (elements.editSessionBtn) {
        elements.editSessionBtn.addEventListener('click', () => {
            const session = state.sessions.find(s => s.id === state.activeModalSessionId);
            if (session) {
                openSessionEditForm(session);
            }
        });
    }
    if (elements.saveSessionBtn) {
        elements.saveSessionBtn.addEventListener('click', saveEditedSession);
    }

    // Library toggle
    const libraryToggle = document.getElementById('libraryToggle');
    const libraryPanel = document.getElementById('libraryPanel');
    if (libraryToggle && libraryPanel) {
        libraryToggle.addEventListener('click', () => {
            const isCollapsed = libraryPanel.classList.toggle('collapsed');
            libraryToggle.setAttribute('aria-expanded', String(!isCollapsed));
        });
    }

    // Day note menu and editor
    if (elements.noteMenuBtn) {
        elements.noteMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (elements.noteMenu && elements.noteMenu.classList.contains('show')) {
                closeNoteMenus();
            } else {
                openNoteMenu();
            }
        });
    }

    if (elements.noteMenu) {
        elements.noteMenu.addEventListener('click', (e) => {
            const button = e.target.closest('.note-menu-item');
            if (!button) return;
            const action = button.dataset.action;
            if (action === 'edit') {
                closeNoteMenus();
                openNoteEditor();
            }
            if (action === 'visibility') {
                openVisibilityMenu();
            }
        });
    }

    if (elements.noteVisibilityMenu) {
        elements.noteVisibilityMenu.addEventListener('click', (e) => {
            const button = e.target.closest('.note-menu-item');
            if (!button) return;
            const visibility = button.dataset.visibility;
            if (!visibility) return;
            setDayNoteData(state.selectedDay, { visible: visibility === 'visible' });
            updateDayNoteUI();
        });
    }

    if (elements.dayNoteSave) {
        elements.dayNoteSave.addEventListener('click', () => {
            const value = elements.dayNoteTextarea?.value ?? '';
            setDayNoteData(state.selectedDay, { text: value.trim() || defaultDayNote });
            updateDayNoteUI();
        });
    }

    if (elements.dayNoteCancel) {
        elements.dayNoteCancel.addEventListener('click', () => {
            closeNoteEditor();
        });
    }

    document.addEventListener('click', (e) => {
        if (elements.dayNote && !elements.dayNote.contains(e.target)) {
            closeNoteMenus();
        }
    });

    initVolumeInputs('session');
    setupVolumeDaysSelect();
}

function setupVolumeDaysSelect() {
    const select = elements.volumeDaysSelect;
    if (!select) return;
    select.innerHTML = '';
    for (let days = 2; days <= 31; days += 1) {
        const option = document.createElement('option');
        option.value = String(days);
        option.textContent = String(days);
        if (days === state.volumeDays) option.selected = true;
        select.appendChild(option);
    }
    select.addEventListener('change', () => {
        const next = parseInt(select.value, 10);
        if (!Number.isNaN(next)) {
            state.volumeDays = Math.min(31, Math.max(2, next));
            saveToLocalStorage();
            updateVolumeEstimate();
        }
    });
}

function setupResponsiveLayout() {
    relocateDayDetails();
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(relocateDayDetails, 150);
    });
}

function relocateDayDetails() {
    const dayDetails = document.getElementById('dayDetails');
    const anchor = document.getElementById('dayDetailsAnchor');
    const sidebar = document.querySelector('.sidebar');
    const sidebarHeader = sidebar?.querySelector('.sidebar-header');
    const addSection = document.getElementById('addSessionSection');
    const libraryContainer = sidebar?.querySelector('.all-sessions-container');
    if (!dayDetails || !anchor || !sidebar || !sidebarHeader) return;

    const isMobile = window.matchMedia('(max-width: 900px)').matches;
    if (isMobile) {
        let referenceNode = null;
        if (addSection) {
            referenceNode = addSection.nextSibling;
        } else if (libraryContainer) {
            referenceNode = libraryContainer;
        } else {
            referenceNode = sidebarHeader.nextSibling;
        }
        if (referenceNode) {
            if (referenceNode !== dayDetails) {
                sidebar.insertBefore(dayDetails, referenceNode);
            }
        } else if (dayDetails.parentElement !== sidebar) {
            sidebar.appendChild(dayDetails);
        }
        return;
    }

    const targetParent = anchor.parentElement;
    if (!targetParent) return;
    if (dayDetails.parentElement !== targetParent || anchor.nextSibling !== dayDetails) {
        targetParent.insertBefore(dayDetails, anchor.nextSibling);
    }
}

function getDayNoteData(dateStr) {
    if (!dateStr) return { text: defaultDayNote, visible: true };
    const existing = state.dayNotes[dateStr];
    if (!existing) {
        return { text: defaultDayNote, visible: true };
    }
    return {
        text: existing.text || defaultDayNote,
        visible: existing.visible !== false,
    };
}

function setDayNoteData(dateStr, updates) {
    if (!dateStr) return;
    const current = getDayNoteData(dateStr);
    const next = { ...current, ...updates };
    state.dayNotes[dateStr] = next;
    saveToLocalStorage();
}

function closeNoteMenus() {
    if (elements.noteMenu) elements.noteMenu.classList.remove('show');
    if (elements.noteVisibilityMenu) elements.noteVisibilityMenu.classList.remove('show');
}

function openNoteMenu() {
    if (!elements.noteMenu) return;
    closeNoteMenus();
    elements.noteMenu.classList.add('show');
}

function openVisibilityMenu() {
    if (!elements.noteVisibilityMenu) return;
    closeNoteMenus();
    elements.noteVisibilityMenu.classList.add('show');
}

function openNoteEditor() {
    if (!elements.dayNoteEditor || !elements.dayNoteTextarea) return;
    const note = getDayNoteData(state.selectedDay);
    elements.dayNoteTextarea.value = note.text;
    elements.dayNoteEditor.style.display = 'block';
}

function closeNoteEditor() {
    if (elements.dayNoteEditor) {
        elements.dayNoteEditor.style.display = 'none';
    }
}

function updateDayNoteUI() {
    if (!elements.dayNote) return;
    if (!state.selectedDay) {
        elements.dayNote.style.display = 'none';
        return;
    }
    elements.dayNote.style.display = 'block';
    const note = getDayNoteData(state.selectedDay);
    if (elements.dayNoteContent) {
        const safeText = escapeHtml(note.text);
        const formatted = safeText
            .replace(/^AS\b/m, '<strong><em>AS</em></strong>')
            .replace(/^FC\b/m, '<strong><em>FC</em></strong>')
            .replace(/\n/g, '<br>');
        elements.dayNoteContent.innerHTML = formatted;
        elements.dayNoteContent.style.display = note.visible ? 'block' : 'none';
    }
    closeNoteMenus();
    closeNoteEditor();
}

function buildCategoryOptions(selected) {
    return Object.entries(categoryLabels)
        .map(([value, label]) => {
            const isSelected = value === (selected || 'other') ? 'selected' : '';
            return `<option value="${escapeHtml(value)}" ${isSelected}>${escapeHtml(label)}</option>`;
        })
        .join('');
}

function buildSportOptions(selected) {
    return Object.entries(sportLabels)
        .map(([value, label]) => {
            const isSelected = value === (selected || 'running') ? 'selected' : '';
            return `<option value="${escapeHtml(value)}" ${isSelected}>${escapeHtml(label)}</option>`;
        })
        .join('');
}

function parseVolumeInput(value) {
    if (!value) return null;
    const normalized = value.toString().replace(',', '.').trim();
    if (!normalized) return null;
    const num = parseFloat(normalized);
    return Number.isFinite(num) ? num : null;
}

function parseTimePart(value) {
    const trimmed = value?.toString().trim() ?? '';
    if (!trimmed) return null;
    const num = parseInt(trimmed, 10);
    if (!Number.isFinite(num)) return null;
    return Math.max(0, num);
}

function readTimeGroup(prefix, groupKey) {
    const hInput = document.getElementById(`${prefix}${groupKey}H`);
    const mInput = document.getElementById(`${prefix}${groupKey}M`);

    const hRaw = hInput?.value ?? '';
    const mRaw = mInput?.value ?? '';
    const hasAny = [hRaw, mRaw].some(value => value.toString().trim() !== '');
    if (!hasAny) return null;

    const hParsed = parseTimePart(hRaw);
    const mParsed = parseTimePart(mRaw);

    if ((hParsed === null && hRaw.toString().trim() !== '') ||
        (mParsed === null && mRaw.toString().trim() !== '')) {
        return null;
    }

    const hours = hParsed ?? 0;
    const minutes = mParsed ?? 0;
    return (hours * 3600) + (minutes * 60);
}

function getTimeFromInputs(prefix) {
    const isRange = document.getElementById(`${prefix}VolumeRange`)?.checked;
    if (isRange) {
        let minSeconds = readTimeGroup(prefix, 'TimeMin');
        let maxSeconds = readTimeGroup(prefix, 'TimeMax');
        if (minSeconds === null && maxSeconds === null) return null;
        if (minSeconds === null) minSeconds = maxSeconds;
        if (maxSeconds === null) maxSeconds = minSeconds;
        if (minSeconds > maxSeconds) [minSeconds, maxSeconds] = [maxSeconds, minSeconds];
        return { type: 'range', minSeconds, maxSeconds };
    }

    const seconds = readTimeGroup(prefix, 'Time');
    if (seconds === null) return null;
    return { type: 'fixed', seconds };
}

function formatVolumeForInput(value) {
    if (!Number.isFinite(value)) return '';
    const str = value.toString();
    return str.includes('.') ? str.replace('.', ',') : str;
}

function getVolumeFromInputs(prefix) {
    const isRange = document.getElementById(`${prefix}VolumeRange`)?.checked;
    if (isRange) {
        let min = parseVolumeInput(document.getElementById(`${prefix}VolumeMin`)?.value || '');
        let max = parseVolumeInput(document.getElementById(`${prefix}VolumeMax`)?.value || '');
        if (min === null && max === null) return null;
        if (min === null) min = max;
        if (max === null) max = min;
        if (min > max) [min, max] = [max, min];
        return { type: 'range', min, max };
    }

    const value = parseVolumeInput(document.getElementById(`${prefix}VolumeValue`)?.value || '');
    if (value === null) return null;
    return { type: 'fixed', value };
}

function setVolumeInputsVisibility(prefix, isRange) {
    const fixed = document.getElementById(`${prefix}VolumeFixed`);
    const range = document.getElementById(`${prefix}VolumeRangeFields`);
    if (fixed) {
        fixed.classList.toggle('is-hidden', isRange);
    }
    if (range) {
        range.classList.toggle('is-hidden', !isRange);
    }
}

function splitSeconds(totalSeconds) {
    const total = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return { hours, minutes };
}

function setTimeGroup(prefix, groupKey, seconds) {
    const hInput = document.getElementById(`${prefix}${groupKey}H`);
    const mInput = document.getElementById(`${prefix}${groupKey}M`);
    if (!hInput || !mInput) return;

    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
        hInput.value = '';
        mInput.value = '';
        return;
    }

    const parts = splitSeconds(seconds);
    hInput.value = String(parts.hours);
    mInput.value = String(parts.minutes);
}

function initVolumeInputs(prefix, volume, volumeTime) {
    const toggle = document.getElementById(`${prefix}VolumeRange`);
    if (!toggle) return;

    const isRange = volume?.type === 'range' || volumeTime?.type === 'range';
    toggle.checked = isRange;
    setVolumeInputsVisibility(prefix, isRange);

    const fixedValue = volume?.type === 'fixed' ? formatVolumeForInput(volume.value) : '';
    const minValue = volume?.type === 'range' ? formatVolumeForInput(volume.min) : '';
    const maxValue = volume?.type === 'range' ? formatVolumeForInput(volume.max) : '';

    const fixedInput = document.getElementById(`${prefix}VolumeValue`);
    const minInput = document.getElementById(`${prefix}VolumeMin`);
    const maxInput = document.getElementById(`${prefix}VolumeMax`);

    if (fixedInput) fixedInput.value = fixedValue;
    if (minInput) minInput.value = minValue;
    if (maxInput) maxInput.value = maxValue;

    if (volumeTime?.type === 'fixed') {
        setTimeGroup(prefix, 'Time', volumeTime.seconds);
        setTimeGroup(prefix, 'TimeMin', null);
        setTimeGroup(prefix, 'TimeMax', null);
    } else if (volumeTime?.type === 'range') {
        setTimeGroup(prefix, 'Time', null);
        setTimeGroup(prefix, 'TimeMin', volumeTime.minSeconds);
        setTimeGroup(prefix, 'TimeMax', volumeTime.maxSeconds);
    } else {
        setTimeGroup(prefix, 'Time', null);
        setTimeGroup(prefix, 'TimeMin', null);
        setTimeGroup(prefix, 'TimeMax', null);
    }

    toggle.onchange = () => {
        setVolumeInputsVisibility(prefix, toggle.checked);
    };
}

function formatVolumeNumber(value) {
    if (!Number.isFinite(value)) return '';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
}

function getSessionVolume(session) {
    if (!session?.volume) return null;
    if (session.volume.type === 'fixed') {
        const value = Number(session.volume.value);
        if (!Number.isFinite(value)) return null;
        return { min: value, max: value };
    }
    if (session.volume.type === 'range') {
        let min = Number(session.volume.min);
        let max = Number(session.volume.max);
        if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
        if (!Number.isFinite(min)) min = max;
        if (!Number.isFinite(max)) max = min;
        if (min > max) [min, max] = [max, min];
        return { min, max };
    }
    return null;
}

function getSessionTime(session) {
    if (!session?.volumeTime) return null;
    if (session.volumeTime.type === 'fixed') {
        const seconds = Number(session.volumeTime.seconds);
        if (!Number.isFinite(seconds)) return null;
        return { min: seconds, max: seconds };
    }
    if (session.volumeTime.type === 'range') {
        let min = Number(session.volumeTime.minSeconds);
        let max = Number(session.volumeTime.maxSeconds);
        if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
        if (!Number.isFinite(min)) min = max;
        if (!Number.isFinite(max)) max = min;
        if (min > max) [min, max] = [max, min];
        return { min, max };
    }
    return null;
}

function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const mm = String(minutes).padStart(2, '0');
    return `${hours} h : ${mm} '`;
}

function formatDurationRange(minSeconds, maxSeconds) {
    if (!Number.isFinite(minSeconds) || !Number.isFinite(maxSeconds)) return 'Non renseigné';
    if (minSeconds === maxSeconds) return formatDuration(minSeconds);
    return `${formatDuration(minSeconds)} - ${formatDuration(maxSeconds)}`;
}

function formatSessionTimeText(session) {
    const time = getSessionTime(session);
    if (!time) return 'Non renseigné';
    return formatDurationRange(time.min, time.max);
}

function formatSessionVolumeText(session) {
    const volume = getSessionVolume(session);
    if (!volume) return 'Non renseigné';
    if (volume.min === volume.max) {
        return `${formatVolumeNumber(volume.min)} km`;
    }
    return `${formatVolumeNumber(volume.min)} - ${formatVolumeNumber(volume.max)} km`;
}

function openSessionEditForm(session) {
    state.isEditingSession = true;
    elements.modalBody.innerHTML = `
        <label class="modal-label">Titre</label>
        <input type="text" id="editSessionTitle" class="input-field" value="${escapeHtml(session.title)}">
        <label class="modal-label">Commentaire</label>
        <textarea id="editSessionComment" class="input-field" rows="2">${escapeHtml(session.comment || '')}</textarea>
        <label class="modal-label">Catégorie</label>
        <select id="editSessionCategory" class="input-field">
            ${buildCategoryOptions(session.category)}
        </select>
        <label class="modal-label">Sport</label>
        <select id="editSessionSport" class="input-field">
            ${buildSportOptions(session.sport)}
        </select>
        <label class="modal-label">Volume estimé (optionnel)</label>
        <div class="volume-field">
            <div class="volume-field-header">
                <span class="volume-label">Volume estimé</span>
                <div class="volume-toggle">
                    <span class="volume-toggle-label">Fixe</span>
                    <label class="switch">
                        <input type="checkbox" id="editSessionVolumeRange">
                        <span class="slider"></span>
                    </label>
                    <span class="volume-toggle-label">Plage</span>
                </div>
            </div>
            <div class="volume-inputs" id="editSessionVolumeFixed">
                <input type="text" id="editSessionVolumeValue" class="input-field volume-input" placeholder="km" inputmode="decimal">
                <div class="volume-time-group">
                    <input type="text" id="editSessionTimeH" class="input-field volume-time-input" placeholder="h" inputmode="numeric">
                    <span class="volume-time-sep">:</span>
                    <input type="text" id="editSessionTimeM" class="input-field volume-time-input" placeholder="min" inputmode="numeric">
                    <span class="volume-time-sep">:</span>
                    <input type="text" id="editSessionTimeS" class="input-field volume-time-input" placeholder="sec" inputmode="numeric">
                </div>
            </div>
            <div class="volume-inputs is-hidden" id="editSessionVolumeRangeFields">
                <div class="volume-distance-range">
                    <input type="text" id="editSessionVolumeMin" class="input-field volume-input" placeholder="min km" inputmode="decimal">
                    <input type="text" id="editSessionVolumeMax" class="input-field volume-input" placeholder="max km" inputmode="decimal">
                </div>
                <div class="volume-time-range">
                    <div class="volume-time-group">
                        <input type="text" id="editSessionTimeMinH" class="input-field volume-time-input" placeholder="h" inputmode="numeric">
                        <span class="volume-time-sep">:</span>
                        <input type="text" id="editSessionTimeMinM" class="input-field volume-time-input" placeholder="min" inputmode="numeric">
                        <span class="volume-time-sep">:</span>
                        <input type="text" id="editSessionTimeMinS" class="input-field volume-time-input" placeholder="sec" inputmode="numeric">
                    </div>
                    <span class="volume-time-range-sep">-</span>
                    <div class="volume-time-group">
                        <input type="text" id="editSessionTimeMaxH" class="input-field volume-time-input" placeholder="h" inputmode="numeric">
                        <span class="volume-time-sep">:</span>
                        <input type="text" id="editSessionTimeMaxM" class="input-field volume-time-input" placeholder="min" inputmode="numeric">
                        <span class="volume-time-sep">:</span>
                        <input type="text" id="editSessionTimeMaxS" class="input-field volume-time-input" placeholder="sec" inputmode="numeric">
                    </div>
                </div>
            </div>
        </div>
    `;

    elements.deleteSessionBtn.style.display = 'none';
    if (elements.editSessionBtn) elements.editSessionBtn.style.display = 'none';
    if (elements.saveSessionBtn) elements.saveSessionBtn.style.display = 'inline-flex';
    elements.closeModalBtn.textContent = 'Annuler';

    initVolumeInputs('editSession', session.volume, session.volumeTime);
}

function saveEditedSession() {
    const sessionId = state.activeModalSessionId;
    const session = state.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const title = document.getElementById('editSessionTitle')?.value.trim() || '';
    if (!title) {
        alert('Veuillez entrer un titre pour la séance');
        return;
    }
    session.title = title;
    session.comment = document.getElementById('editSessionComment')?.value.trim() || '';
    session.category = document.getElementById('editSessionCategory')?.value || 'other';
    session.sport = document.getElementById('editSessionSport')?.value || 'running';
    session.volume = getVolumeFromInputs('editSession');
    session.volumeTime = getTimeFromInputs('editSession');

    saveToLocalStorage();
    renderSessions();
    renderCalendar();
    updateDayDetails();

    state.isEditingSession = false;
    const dateStr = state.activeModalDateStr;
    if (dateStr) {
        showSessionModal(session, dateStr);
    } else {
        showSessionLibraryModal(session);
    }
}

// ============== SESSION MANAGEMENT ==============
function addSession() {
    const title = elements.sessionTitle.value.trim();
    const comment = elements.sessionComment.value.trim();
    const category = elements.sessionCategory.value || 'other';
    const sport = elements.sessionSport.value || 'running';
    const volume = getVolumeFromInputs('session');
    const volumeTime = getTimeFromInputs('session');

    if (!title) {
        alert('Veuillez entrer un titre pour la séance');
        return;
    }

    const session = {
        id: Date.now().toString(),
        title,
        comment,
        category,
        sport,
        volume,
        volumeTime,
        dateAdded: new Date().toISOString(),
    };

    state.sessions.push(session);
    saveToLocalStorage();
    renderSessions();

    // Clear form
    elements.sessionTitle.value = '';
    elements.sessionComment.value = '';
    elements.sessionCategory.value = '';
    elements.sessionSport.value = 'running';
    initVolumeInputs('session');
    elements.sessionTitle.focus();
}

function renderSessions() {
    const categories = Object.keys(categoryLabels);
    const library = document.getElementById('libraryCategories');
    library.innerHTML = '';

    categories.forEach((cat) => {
        const catSessions = state.sessions
            .map((session, index) => ({ session, index }))
            .filter(({ session }) => session.category === cat);
        if (catSessions.length === 0) return;

        const section = document.createElement('div');
        section.className = 'library-category-section';

        const title = document.createElement('div');
        title.className = 'library-category-title';
        title.innerHTML = `<span class="toggle-arrow">▼</span> ${categoryLabels[cat]}`;
        section.appendChild(title);

        const list = document.createElement('div');
        list.className = 'sessions-list';
        const sportOrder = new Map();
        catSessions.forEach(({ session, index }) => {
            const sportKey = session.sport || 'running';
            if (!sportOrder.has(sportKey)) {
                sportOrder.set(sportKey, index);
            }
        });
        catSessions
            .sort((a, b) => {
                const aSport = a.session.sport || 'running';
                const bSport = b.session.sport || 'running';
                const aGroup = sportOrder.get(aSport);
                const bGroup = sportOrder.get(bSport);
                if (aGroup !== bGroup) return aGroup - bGroup;
                return a.index - b.index;
            })
            .forEach(({ session }) => {
                list.appendChild(createSessionElement(session));
        });
        section.appendChild(list);

        // Toggle logic
        title.addEventListener('click', () => {
            list.classList.toggle('collapsed');
            title.classList.toggle('collapsed');
        });

        library.appendChild(section);
    });
}

function createSessionElement(session) {
    const div = document.createElement('div');
    div.className = 'session-item';
    div.draggable = true;
    div.dataset.sessionId = session.id;
    const sessionCategory = session.category || 'other';
    div.dataset.category = sessionCategory;
    const sessionSport = session.sport || 'running';
    div.dataset.sport = sessionSport;

    div.innerHTML = `
        <div class="session-title">${escapeHtml(session.title)}</div>
        <button class="delete-library-btn" title="Supprimer la séance">×</button>
    `;
    if (sessionSport === 'running') {
        div.dataset.runningIcon = getRunningIconType(sessionCategory);
    }

    // Drag events
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);

    // Click to view details (only if not dragging)
    div.addEventListener('click', () => {
        if (!state.isDragging) {
            showSessionLibraryModal(session);
        }
    });

    // Delete button
    const deleteBtn = div.querySelector('.delete-library-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Supprimer définitivement cette séance de la librairie ?')) {
            removeLibrarySession(session.id);
        }
    });

    return div;
}

// ============== DRAG AND DROP ==============
function handleDragStart(e) {
    const sessionId = e.target.closest('.session-item').dataset.sessionId;
    state.draggedSession = sessionId;
    state.isDragging = true;
    e.target.closest('.session-item').classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
}

function handleDragEnd(e) {
    e.target.closest('.session-item').classList.remove('dragging');
    document.querySelectorAll('.calendar-day').forEach((day) => {
        day.classList.remove('drop-over');
    });
    state.draggedSession = null;
    state.isDragging = false;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drop-over');
}

function handleDragLeave(e) {
    if (e.currentTarget === e.target) {
        e.currentTarget.classList.remove('drop-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const dayElement = e.currentTarget;
    dayElement.classList.remove('drop-over');

    if (!state.draggedSession) return;

    const dateStr = dayElement.dataset.date;
    if (!dateStr) return;

    // Add session to scheduled sessions
    if (!state.scheduledSessions[dateStr]) {
        state.scheduledSessions[dateStr] = [];
    }

    // Avoid duplicates
    if (!state.scheduledSessions[dateStr].includes(state.draggedSession)) {
        state.scheduledSessions[dateStr].push(state.draggedSession);
        saveToLocalStorage();
        renderCalendar();
        updateDayDetails();
    }

    state.draggedSession = null;
}

// ============== CALENDAR ==============
function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();

    // Update header
    const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    elements.monthYear.textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Adjust for Monday start (ISO week)
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    elements.calendarDays.innerHTML = '';

    // Previous month days
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const date = new Date(year, month - 1, day);
        const dayElement = createDayElement(date, true);
        elements.calendarDays.appendChild(dayElement);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayElement = createDayElement(date, false);
        elements.calendarDays.appendChild(dayElement);
    }

    // Next month days
    const totalCells = elements.calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 rows x 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const date = new Date(year, month + 1, day);
        const dayElement = createDayElement(date, true);
        elements.calendarDays.appendChild(dayElement);
    }
}

function createDayElement(date, isOtherMonth) {
    const div = document.createElement('div');
    div.className = 'calendar-day';
    if (isOtherMonth) div.classList.add('other-month');

    const dateStr = formatDateForStorage(date);
    div.dataset.date = dateStr;

    // Check if today
    const today = new Date();
    if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    ) {
        div.classList.add('today');
    }

    // Day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = date.getDate();
    div.appendChild(dayNumber);

    // Sessions for this day
    const sessionsContainer = document.createElement('div');
    sessionsContainer.className = 'day-sessions';

    const sessionIds = state.scheduledSessions[dateStr] || [];
    sessionIds.forEach((sessionId) => {
        const session = state.sessions.find((s) => s.id === sessionId);
        if (session) {
            const chipElement = document.createElement('div');
            const sessionSport = session.sport || 'running';
            const sessionCategory = session.category || 'other';
            chipElement.className = `day-session-chip ${sessionSport} ${sessionCategory}`;
            chipElement.dataset.category = sessionCategory;
            if (sessionSport === 'running') {
                chipElement.dataset.runningIcon = getRunningIconType(sessionCategory);
            }
            chipElement.textContent = session.title;
            chipElement.title = `${session.title}\n${session.comment || ''}`;
            chipElement.addEventListener('click', () => {
                state.selectedDay = dateStr;
                selectDay(div);
                showSessionModal(session, dateStr);
            });
            sessionsContainer.appendChild(chipElement);
        }
    });

    div.appendChild(sessionsContainer);

    // Drag and drop
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('dragleave', handleDragLeave);
    div.addEventListener('drop', handleDrop);

    // Click to select day
    div.addEventListener('click', () => {
        state.selectedDay = dateStr;
        selectDay(div);
        updateDayDetails();
    });

    return div;
}

function updateDayDetails() {
    if (!state.selectedDay) {
        elements.selectedDayTitle.textContent = 'Sélectionner un jour';
        elements.daySessionsList.innerHTML = '';
        updateDayNoteUI();
        updateVolumeEstimate();
        return;
    }

    const date = new Date(state.selectedDay);
    const dayName = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][date.getDay()];
    const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    elements.selectedDayTitle.textContent = `${dayName} ${date.getDate()} ${monthNames[date.getMonth()]}`;

    const sessionIds = state.scheduledSessions[state.selectedDay] || [];
    elements.daySessionsList.innerHTML = '';

    if (sessionIds.length === 0) {
        const noSessions = document.createElement('p');
        noSessions.textContent = 'Aucune séance planifiée';
        noSessions.style.color = '#9ca3af';
        elements.daySessionsList.appendChild(noSessions);
    } else {
        sessionIds.forEach((sessionId) => {
            const session = state.sessions.find((s) => s.id === sessionId);
            if (session) {
                const div = document.createElement('div');
                const sessionSport = session.sport || 'running';
                const sessionCategory = session.category || 'other';
                div.className = `session-detail-item ${sessionSport} ${sessionCategory}`;
                div.dataset.category = sessionCategory;
                if (sessionSport === 'running') {
                    div.dataset.runningIcon = getRunningIconType(sessionCategory);
                }
                div.innerHTML = `
                    <div class="session-detail-title">${escapeHtml(session.title)}</div>
                    ${session.comment ? `<div class="session-detail-info">${escapeHtml(session.comment)}</div>` : ''}
                `;
                div.addEventListener('click', () => showSessionModal(session, state.selectedDay));
                elements.daySessionsList.appendChild(div);
            }
        });
    }
    updateDayNoteUI();
    updateVolumeEstimate();
}

function updateVolumeEstimate() {
    const container = elements.volumeEstimateContent;
    if (!container) return;

    if (!state.selectedDay) {
        container.innerHTML = '<p class="volume-estimate-empty">Sélectionner un jour pour voir le volume estimé.</p>';
        if (elements.volumeEstimateTotal) elements.volumeEstimateTotal.innerHTML = '';
        return;
    }

    const startDate = new Date(state.selectedDay);
    if (Number.isNaN(startDate.getTime())) {
        container.innerHTML = '<p class="volume-estimate-empty">Sélectionner un jour pour voir le volume estimé.</p>';
        if (elements.volumeEstimateTotal) elements.volumeEstimateTotal.innerHTML = '';
        return;
    }
    startDate.setHours(0, 0, 0, 0);

    const sessionMap = new Map(state.sessions.map(session => [session.id, session]));
    const totals = {};
    const totalDays = Math.min(31, Math.max(2, state.volumeDays || 7));

    for (let i = 0; i < totalDays; i += 1) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateStr = formatDateForStorage(date);
        const sessionIds = state.scheduledSessions[dateStr] || [];
        sessionIds.forEach((sessionId) => {
            const session = sessionMap.get(sessionId);
            if (!session) return;
            const distance = getSessionVolume(session);
            const time = getSessionTime(session);
            if (!distance && !time) return;

            const sportKey = session.sport || 'running';
            if (!totals[sportKey]) {
                totals[sportKey] = {
                    kmMin: 0,
                    kmMax: 0,
                    timeMin: 0,
                    timeMax: 0,
                    hasKm: false,
                    hasTime: false,
                    missingKm: false,
                    missingTime: false,
                };
            }

            if (distance) {
                totals[sportKey].kmMin += distance.min;
                totals[sportKey].kmMax += distance.max;
                totals[sportKey].hasKm = true;
            } else {
                totals[sportKey].missingKm = true;
            }
            if (time) {
                totals[sportKey].timeMin += time.min;
                totals[sportKey].timeMax += time.max;
                totals[sportKey].hasTime = true;
            } else {
                totals[sportKey].missingTime = true;
            }
        });
    }

    const orderedSports = Object.keys(sportLabels);
    const sportsWithData = orderedSports.filter((sport) => {
        const data = totals[sport];
        return data?.hasKm || data?.hasTime;
    });

    let totalKmMin = 0;
    let totalKmMax = 0;
    let totalTimeMin = 0;
    let totalTimeMax = 0;
    let totalHasKm = false;
    let totalHasTime = false;
    Object.values(totals).forEach((data) => {
        if (!data) return;
        if (data.hasKm) {
            totalKmMin += data.kmMin;
            totalKmMax += data.kmMax;
            totalHasKm = true;
        }
        if (data.hasTime) {
            totalTimeMin += data.timeMin;
            totalTimeMax += data.timeMax;
            totalHasTime = true;
        }
    });

    if (sportsWithData.length === 0) {
        container.innerHTML = `<p class="volume-estimate-empty">Aucun volume estimé sur ${totalDays} jours.</p>`;
        return;
    }

    container.innerHTML = sportsWithData
        .map((sportKey) => {
            const data = totals[sportKey];
            const label = getSportLabel(sportKey);
            const kmText = data.hasKm
                ? (data.kmMin === data.kmMax
                    ? `${formatVolumeNumber(data.kmMin)} km`
                    : `${formatVolumeNumber(data.kmMin)} - ${formatVolumeNumber(data.kmMax)} km`)
                : null;
            const timeText = data.hasTime
                ? formatDurationRange(data.timeMin, data.timeMax)
                : null;
            const kmIncomplete = data.hasKm && data.missingKm;
            const timeIncomplete = data.hasTime && data.missingTime;
            return `
                <div class="volume-estimate-row">
                    <span class="volume-estimate-sport">${escapeHtml(label)}</span>
                    <div class="volume-estimate-values">
                        ${kmText ? `
                            <div class="volume-estimate-line">
                                <span class="volume-estimate-label">DIST</span>
                                <span class="volume-estimate-value">${escapeHtml(kmText)}</span>
                                ${kmIncomplete ? '<span class="volume-estimate-incomplete">incomplet</span>' : ''}
                            </div>
                        ` : ''}
                        ${timeText ? `
                            <div class="volume-estimate-line">
                                <span class="volume-estimate-label">temps</span>
                                <span class="volume-estimate-value volume-estimate-time">${escapeHtml(timeText)}</span>
                                ${timeIncomplete ? '<span class="volume-estimate-incomplete">incomplet</span>' : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        })
        .join('');

    if (elements.volumeEstimateTotal) {
        if (!totalHasKm && !totalHasTime) {
            elements.volumeEstimateTotal.innerHTML = '';
        } else {
            const totalKmText = totalHasKm
                ? (totalKmMin === totalKmMax
                    ? `${formatVolumeNumber(totalKmMin)} km`
                    : `${formatVolumeNumber(totalKmMin)} - ${formatVolumeNumber(totalKmMax)} km`)
                : null;
            const totalTimeText = totalHasTime
                ? formatDurationRange(totalTimeMin, totalTimeMax)
                : null;
            elements.volumeEstimateTotal.innerHTML = `
                <div class="volume-estimate-total-row">
                    <span class="volume-estimate-total-label">Total</span>
                    <div class="volume-estimate-values">
                        ${totalKmText ? `
                            <div class="volume-estimate-line">
                                <span class="volume-estimate-label">DIST</span>
                                <span class="volume-estimate-value">${escapeHtml(totalKmText)}</span>
                            </div>
                        ` : ''}
                        ${totalTimeText ? `
                            <div class="volume-estimate-line">
                                <span class="volume-estimate-label">temps</span>
                                <span class="volume-estimate-value volume-estimate-time">${escapeHtml(totalTimeText)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    }
}

function selectDay(dayElement) {
    document.querySelectorAll('.calendar-day.selected').forEach((el) => {
        el.classList.remove('selected');
    });
    dayElement.classList.add('selected');
}

function selectToday() {
    const today = new Date();
    const dateStr = formatDateForStorage(today);
    state.selectedDay = dateStr;

    const todayElement = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
    if (todayElement) {
        selectDay(todayElement);
        updateDayDetails();
    }
}

function changeMonth(offset) {
    state.currentDate.setMonth(state.currentDate.getMonth() + offset);
    renderCalendar();
}

// ============== MODAL ==============
function showSessionLibraryModal(session) {
    state.activeModalSessionId = session.id;
    state.activeModalDateStr = null;
    state.isEditingSession = false;
    elements.modalBody.innerHTML = `
        <p><strong>Titre:</strong> ${escapeHtml(session.title)}</p>
        <p><strong>Catégorie:</strong> ${categoryLabels[session.category]}</p>
        <p><strong>Sport:</strong> ${escapeHtml(getSportLabel(session.sport))}</p>
        <p><strong>Volume estimé:</strong> ${escapeHtml(formatSessionVolumeText(session))}</p>
        <p><strong>Volume horaire estimé:</strong> ${escapeHtml(formatSessionTimeText(session))}</p>
        ${session.comment ? `<p><strong>Commentaire:</strong> ${escapeHtml(session.comment)}</p>` : ''}
    `;

    // Clear delete button data since this is just viewing
    elements.deleteSessionBtn.style.display = 'none';
    if (elements.editSessionBtn) elements.editSessionBtn.style.display = 'inline-flex';
    if (elements.saveSessionBtn) elements.saveSessionBtn.style.display = 'none';
    elements.closeModalBtn.textContent = 'Fermer';

    elements.sessionModal.classList.add('show');
}

function showSessionModal(session, dateStr) {
    state.activeModalSessionId = session.id;
    state.activeModalDateStr = dateStr;
    state.isEditingSession = false;
    elements.modalBody.innerHTML = `
        <p><strong>Titre:</strong> ${escapeHtml(session.title)}</p>
        <p><strong>Catégorie:</strong> ${categoryLabels[session.category]}</p>
        <p><strong>Sport:</strong> ${escapeHtml(getSportLabel(session.sport))}</p>
        <p><strong>Volume estimé:</strong> ${escapeHtml(formatSessionVolumeText(session))}</p>
        <p><strong>Volume horaire estimé:</strong> ${escapeHtml(formatSessionTimeText(session))}</p>
        ${session.comment ? `<p><strong>Commentaire:</strong> ${escapeHtml(session.comment)}</p>` : ''}
        <p><strong>Date:</strong> ${new Date(dateStr).toLocaleDateString('fr-FR')}</p>
    `;

    // Store current session and date for deletion
    elements.deleteSessionBtn.dataset.sessionId = session.id;
    elements.deleteSessionBtn.dataset.dateStr = dateStr;
    elements.deleteSessionBtn.style.display = 'block';
    if (elements.editSessionBtn) elements.editSessionBtn.style.display = 'inline-flex';
    if (elements.saveSessionBtn) elements.saveSessionBtn.style.display = 'none';
    elements.closeModalBtn.textContent = 'Fermer';

    elements.sessionModal.classList.add('show');
}

function closeModal() {
    if (state.isEditingSession) {
        state.isEditingSession = false;
    }
    elements.sessionModal.classList.remove('show');
    elements.deleteSessionBtn.style.display = 'none';
    if (elements.editSessionBtn) elements.editSessionBtn.style.display = 'inline-flex';
    if (elements.saveSessionBtn) elements.saveSessionBtn.style.display = 'none';
    elements.closeModalBtn.textContent = 'Fermer';
}

function deleteScheduledSession() {
    const sessionId = elements.deleteSessionBtn.dataset.sessionId;
    const dateStr = elements.deleteSessionBtn.dataset.dateStr;

    if (state.scheduledSessions[dateStr]) {
        state.scheduledSessions[dateStr] = state.scheduledSessions[dateStr].filter((id) => id !== sessionId);
        if (state.scheduledSessions[dateStr].length === 0) {
            delete state.scheduledSessions[dateStr];
        }
    }

    saveToLocalStorage();
    renderCalendar();
    updateDayDetails();
    closeModal();
}

// ============== STORAGE ==============
function saveToLocalStorage() {
    const data = {
        sessions: state.sessions,
        scheduledSessions: state.scheduledSessions,
        dayNotes: state.dayNotes,
        volumeDays: state.volumeDays,
    };
    localStorage.setItem('trainingPlatformData', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('trainingPlatformData');
    if (data) {
        try {
            const parsed = JSON.parse(data);
            state.sessions = parsed.sessions || [];
            state.scheduledSessions = parsed.scheduledSessions || {};
            state.dayNotes = parsed.dayNotes || {};
            if (typeof parsed.volumeDays === 'number') {
                state.volumeDays = Math.min(31, Math.max(2, parsed.volumeDays));
            }
            const legacyPattern = /Allure\s+sp[ée]cifique|FC range/i;
            let migrated = false;
            Object.keys(state.dayNotes).forEach((dateStr) => {
                const note = state.dayNotes[dateStr];
                if (note && typeof note.text === 'string' && legacyPattern.test(note.text)) {
                    state.dayNotes[dateStr] = { ...note, text: defaultDayNote };
                    migrated = true;
                }
            });
            if (migrated) {
                saveToLocalStorage();
            }
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    }
}

function purgePastScheduledSessions() {
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0);
    cutoffDate.setDate(cutoffDate.getDate() - 14);
    const cutoffStr = formatDateForStorage(cutoffDate);
    let hasChanges = false;

    Object.keys(state.scheduledSessions).forEach((dateStr) => {
        if (dateStr <= cutoffStr) {
            delete state.scheduledSessions[dateStr];
            hasChanges = true;
        }
    });

    if (hasChanges) {
        saveToLocalStorage();
    }
}

function scheduleDailyCleanup() {
    const now = new Date();
    const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5
    );
    const delayMs = nextMidnight.getTime() - now.getTime();

    setTimeout(() => {
        purgePastScheduledSessions();
        renderCalendar();
        selectToday();
        updateDayDetails();
        scheduleDailyCleanup();
    }, delayMs);
}

// ============== UTILITIES ==============
function formatDateForStorage(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getSportLabel(sportKey) {
    return sportLabels[sportKey] || sportLabels.running;
}

function removeLibrarySession(sessionId) {
    state.sessions = state.sessions.filter((s) => s.id !== sessionId);
    // also remove from scheduled
    for (const date in state.scheduledSessions) {
        state.scheduledSessions[date] = state.scheduledSessions[date].filter((id) => id !== sessionId);
        if (state.scheduledSessions[date].length === 0) delete state.scheduledSessions[date];
    }
    saveToLocalStorage();
    renderSessions();
    renderCalendar();
    updateDayDetails();
}
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}
