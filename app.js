// ============== STATE MANAGEMENT ==============
const state = {
    currentDate: new Date(),
    sessions: [], // Array of all sessions
    scheduledSessions: {}, // Format: { 'YYYY-MM-DD': [sessionIds] }
    selectedDay: null,
    draggedSession: null,
    isDragging: false,
};


const categoryColors = {
    ef: '#228B22', // vert forêt
    sv1: '#0074D9', // bleu
    sv2: '#ff9800', // orange
    vma: '#e53935', // rouge
    aerobic: '#fbbf24',
    sprint: '#f87171',
    force: '#a78bfa',
    flexibility: '#22c55e',
    technique: '#60a5fa',
    other: '#94a3b8',
};


const categoryLabels = {
    ef: 'EF',
    sv1: 'SV1 Seuil Aérobie- SV2 Anaérobie',
    sv2: 'SV2 Seuil Anaérobie - VMA',
    vma: 'VMA - Vitesse- VO2max',
    aerobic: 'Aérobie',
    sprint: 'Sprint',
    force: 'Force',
    flexibility: 'Flexibilité',
    technique: 'Technique',
    other: 'Autre',
};

// ============== DOM ELEMENTS ==============
const elements = {
    sessionTitle: document.getElementById('sessionTitle'),
    sessionComment: document.getElementById('sessionComment'),
    sessionCategory: document.getElementById('sessionCategory'),
    addSessionBtn: document.getElementById('addSessionBtn'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    todayBtn: document.getElementById('todayBtn'),
    monthYear: document.getElementById('monthYear'),
    calendarDays: document.getElementById('calendarDays'),
    selectedDayTitle: document.getElementById('selectedDayTitle'),
    daySessionsList: document.getElementById('daySessionsList'),
    sessionModal: document.getElementById('sessionModal'),
    modalBody: document.getElementById('modalBody'),
    deleteSessionBtn: document.getElementById('deleteSessionBtn'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    closeModalX: document.querySelector('.close-modal'),
};

// ============== INITIALIZATION ==============
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    renderCalendar();
    renderSessions();
    setupEventListeners();
    selectToday();
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
}

// ============== SESSION MANAGEMENT ==============
function addSession() {
    const title = elements.sessionTitle.value.trim();
    const comment = elements.sessionComment.value.trim();
    const category = elements.sessionCategory.value || 'other';

    if (!title) {
        alert('Veuillez entrer un titre pour la séance');
        return;
    }

    const session = {
        id: Date.now().toString(),
        title,
        comment,
        category,
        dateAdded: new Date().toISOString(),
    };

    state.sessions.push(session);
    saveToLocalStorage();
    renderSessions();

    // Clear form
    elements.sessionTitle.value = '';
    elements.sessionComment.value = '';
    elements.sessionCategory.value = '';
    elements.sessionTitle.focus();
}

function renderSessions() {
    const categories = Object.keys(categoryLabels);
    const library = document.getElementById('libraryCategories');
    library.innerHTML = '';

    categories.forEach((cat) => {
        const catSessions = state.sessions.filter(s => s.category === cat);
        if (catSessions.length === 0) return;

        const section = document.createElement('div');
        section.className = 'library-category-section';

        const title = document.createElement('div');
        title.className = 'library-category-title';
        title.innerHTML = `<span class="toggle-arrow">▼</span> ${categoryLabels[cat]}`;
        title.style.borderLeft = `6px solid ${categoryColors[cat]}`;
        section.appendChild(title);

        const list = document.createElement('div');
        list.className = 'sessions-list';
        catSessions.forEach(session => {
            list.appendChild(createSessionElement(session));
        });
        section.appendChild(list);

        // Toggle logic
        title.addEventListener('click', () => {
            list.classList.toggle('collapsed');
            title.classList.toggle('collapsed');
            const arrow = title.querySelector('.toggle-arrow');
            if (list.classList.contains('collapsed')) {
                arrow.textContent = '►';
            } else {
                arrow.textContent = '▼';
            }
        });

        library.appendChild(section);
    });
}

function createSessionElement(session) {
    const div = document.createElement('div');
    div.className = 'session-item';
    div.draggable = true;
    div.dataset.sessionId = session.id;
    div.dataset.category = session.category;

    div.innerHTML = `
        <div class="session-title">${escapeHtml(session.title)}</div>
        <button class="delete-library-btn" title="Supprimer la séance">×</button>
    `;

    // Set border color based on category
    const categoryColors = {
        aerobic: '#fbbf24',
        sprint: '#f87171',
        force: '#a78bfa',
        flexibility: '#22c55e',
        technique: '#60a5fa',
        other: '#94a3b8',
    };
    div.style.borderLeftColor = categoryColors[session.category] || categoryColors.other;

    // Drag events
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);

    // Click to view details (only if not dragging)
    div.addEventListener('click', (e) => {
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
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    elements.monthYear.textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Adjust for Monday start (ISO week)
    let adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

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
            chipElement.className = `day-session-chip ${session.category}`;
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
        return;
    }

    const date = new Date(state.selectedDay);
    const dayName = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][date.getDay()];
    const monthNames = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    elements.selectedDayTitle.textContent = `${dayName} ${date.getDate()} ${monthNames[date.getMonth()]}`;

    const sessionIds = state.scheduledSessions[state.selectedDay] || [];
    elements.daySessionsList.innerHTML = '';

    if (sessionIds.length === 0) {
        const noSessions = document.createElement('p');
        noSessions.textContent = 'Aucune séance planifiée';
        noSessions.style.color = '#9ca3af';
        elements.daySessionsList.appendChild(noSessions);
        return;
    }

    sessionIds.forEach((sessionId) => {
        const session = state.sessions.find((s) => s.id === sessionId);
        if (session) {
            const div = document.createElement('div');
            div.className = `session-detail-item ${session.category}`;
            div.innerHTML = `
                <div class="session-detail-title">${escapeHtml(session.title)}</div>
                ${session.comment ? `<div class="session-detail-info">${escapeHtml(session.comment)}</div>` : ''}
            `;
            div.addEventListener('click', () => showSessionModal(session, state.selectedDay));
            elements.daySessionsList.appendChild(div);
        }
    });
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
    elements.modalBody.innerHTML = `
        <p><strong>Titre:</strong> ${escapeHtml(session.title)}</p>
        <p><strong>Catégorie:</strong> ${categoryLabels[session.category]}</p>
        ${session.comment ? `<p><strong>Commentaire:</strong> ${escapeHtml(session.comment)}</p>` : ''}
    `;

    // Clear delete button data since this is just viewing
    elements.deleteSessionBtn.style.display = 'none';
    elements.closeModalBtn.textContent = 'Fermer';

    elements.sessionModal.classList.add('show');
}

function showSessionModal(session, dateStr) {
    elements.modalBody.innerHTML = `
        <p><strong>Titre:</strong> ${escapeHtml(session.title)}</p>
        <p><strong>Catégorie:</strong> ${categoryLabels[session.category]}</p>
        ${session.comment ? `<p><strong>Commentaire:</strong> ${escapeHtml(session.comment)}</p>` : ''}
        <p><strong>Date:</strong> ${new Date(dateStr).toLocaleDateString('fr-FR')}</p>
    `;

    // Store current session and date for deletion
    elements.deleteSessionBtn.dataset.sessionId = session.id;
    elements.deleteSessionBtn.dataset.dateStr = dateStr;
    elements.deleteSessionBtn.style.display = 'block';
    elements.closeModalBtn.textContent = 'Fermer';

    elements.sessionModal.classList.add('show');
}

function closeModal() {
    elements.sessionModal.classList.remove('show');
    elements.deleteSessionBtn.style.display = 'none';
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
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    }
}

// ============== UTILITIES ==============
function formatDateForStorage(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
