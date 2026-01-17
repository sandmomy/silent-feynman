/**
 * Projects Page - Document Grid and Filtering
 */

document.addEventListener('DOMContentLoaded', function () {
    initDocumentsGrid();
    initCategoryFilters();
    initModal();
});

// ============================================
// Documents Grid
// ============================================
function initDocumentsGrid() {
    const grid = document.getElementById('documentsGrid');
    if (!grid || typeof DOCUMENTS_DATA === 'undefined') return;

    renderDocuments(DOCUMENTS_DATA);
}

function renderDocuments(documents) {
    const grid = document.getElementById('documentsGrid');
    if (!grid) return;

    grid.innerHTML = documents.map(doc => `
        <div class="document-card" data-category="${doc.category}">
            <div class="document-preview">
                <span class="document-type">${doc.type}</span>
            </div>
            <div class="document-info">
                <h3 class="document-title">${doc.title}</h3>
                <span class="document-category">${doc.categoryLabel}</span>
                <div class="document-actions">
                    <button class="document-btn document-btn-view" onclick="openModal('${doc.title}', '${doc.filename}')">
                        👁️ View
                    </button>
                    <a href="${DOCUMENTS_BASE_PATH}${doc.filename}" class="document-btn document-btn-download" download>
                        ⬇️ Download
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================
// Category Filters
// ============================================
function initCategoryFilters() {
    const pills = document.querySelectorAll('.category-pill');

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            // Update active state
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            // Filter documents
            const filter = pill.dataset.filter;
            filterDocuments(filter);
        });
    });
}

function filterDocuments(category) {
    if (typeof DOCUMENTS_DATA === 'undefined') return;

    if (category === 'all') {
        renderDocuments(DOCUMENTS_DATA);
    } else {
        const filtered = DOCUMENTS_DATA.filter(doc => doc.category === category);
        renderDocuments(filtered);
    }
}

// ============================================
// PDF Modal
// ============================================
function initModal() {
    const modal = document.getElementById('pdfModal');
    const closeBtn = document.getElementById('modalClose');

    if (!modal || !closeBtn) return;

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        document.getElementById('pdfViewer').src = '';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.getElementById('pdfViewer').src = '';
        }
    });
}

function openModal(title, filename) {
    const modal = document.getElementById('pdfModal');
    const modalTitle = document.getElementById('modalTitle');
    const pdfViewer = document.getElementById('pdfViewer');
    const downloadBtn = document.getElementById('downloadBtn');

    if (!modal) return;

    const filePath = DOCUMENTS_BASE_PATH + filename;

    modalTitle.textContent = title;
    pdfViewer.src = filePath;
    downloadBtn.href = filePath;

    modal.style.display = 'flex';
}
