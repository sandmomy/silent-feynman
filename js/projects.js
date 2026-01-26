/**
 * Projects Page - Slideshow + Category Tabs + Sequential Project View
 */

// Featured projects IDs (the 4 most important)
const FEATURED_IDS = [4, 11, 18, 26];

let currentSlide = 0;
let slideInterval = null;
let currentCategory = 'sustainability';
let categoryProjectIndex = {};

const CATEGORY_INFO = {
    sustainability: {
        icon: '🌿',
        name: 'Sustainability',
        description: 'Comprehensive projects focused on ecological balance, sustainable mining practices, and environmental preservation. These initiatives demonstrate commitment to reducing environmental impact while maintaining economic viability.'
    },
    food: {
        icon: '🍴',
        name: 'Food Security',
        description: 'Strategic initiatives addressing food security challenges across Africa and developing regions. Projects include agricultural development, capacity building, and innovative solutions for sustainable food production systems.'
    },
    realestate: {
        icon: '🏨',
        name: 'Real Estate',
        description: 'Diverse portfolio of real estate development and investment projects. From commercial properties to hospitality ventures, these projects combine strategic location analysis with sustainable development principles.'
    },
    investment: {
        icon: '💰',
        name: 'Investment',
        description: 'Strategic investment opportunities and financial analyses across multiple sectors. Comprehensive feasibility studies and investment guides for informed decision-making in emerging markets.'
    },
    technology: {
        icon: '⚡',
        name: 'Technology',
        description: 'Innovative technology solutions including renewable energy systems, smart infrastructure, and cutting-edge developments. Projects that leverage technology for sustainable development and improved quality of life.'
    },
    research: {
        icon: '📚',
        name: 'Research',
        description: 'In-depth research and academic publications covering sustainable development, economic analysis, and social impact studies. Evidence-based insights for policy and decision-making.'
    }
};

document.addEventListener('DOMContentLoaded', function () {
    // initSmoothScroll(); // Now handled globally in main.js
    initSlideshow();
    initCategoryTabs();
    initModal();
    initNavbar();
});

// ============================================
// FEATURED SLIDESHOW
// ============================================
function initSlideshow() {
    if (typeof DOCUMENTS_DATA === 'undefined') return;

    const container = document.getElementById('slideshow');
    if (!container) return;

    const featured = FEATURED_IDS.map(id => DOCUMENTS_DATA.find(d => d.id === id)).filter(Boolean);

    const slidesHTML = featured.map((doc, i) => `
        <div class="slide ${i === 0 ? 'active' : ''}" data-index="${i}">
            <div class="slide-preview">
                <span class="slide-preview-icon">${getDocIcon(doc.type)}</span>
                <span class="portal-type-badge">${doc.type}</span>
            </div>
            <div class="slide-content">
                <div class="slide-category">${doc.categoryLabel}</div>
                <h2 class="slide-title">${doc.title}</h2>
                <p class="slide-description">${doc.description}</p>
                <div class="slide-actions">
                    <button class="slide-btn slide-btn-primary" onclick="openModal('${escapeQuotes(doc.title)}', '${escapeQuotes(doc.filename)}')">
                        👁️ View Document
                    </button>
                    <a href="${DOCUMENTS_BASE_PATH}${doc.filename}" class="slide-btn slide-btn-secondary" download>
                        ⬇️ Download
                    </a>
                </div>
            </div>
        </div>
    `).join('');

    const controlsHTML = `
        <div class="slideshow-controls">
            <button class="slide-arrow" onclick="changeSlide(-1)">◀</button>
            <div class="slide-dots">
                ${featured.map((_, i) => `
                    <span class="slide-dot ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="goToSlide(${i})"></span>
                `).join('')}
            </div>
            <button class="slide-arrow" onclick="changeSlide(1)">▶</button>
        </div>
    `;

    container.innerHTML = slidesHTML + controlsHTML;
    startSlideshow();
}

function startSlideshow() {
    stopSlideshow();
    if (!document.hidden) {
        slideInterval = setInterval(() => changeSlide(1), 5000);
    }
}

function stopSlideshow() {
    if (slideInterval) clearInterval(slideInterval);
}

// Efficiency: pause on tab hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSlideshow();
    else startSlideshow();
});

function changeSlide(direction) {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.slide-dot');
    if (!slides.length) return;

    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');

    currentSlide = (currentSlide + direction + slides.length) % slides.length;

    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');

    startSlideshow();
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.slide-dot');
    if (!slides.length) return;

    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');

    currentSlide = index;

    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');

    startSlideshow();
}

// ============================================
// NAVBAR FUNCTIONALITY
// ============================================
function initNavbar() {
    console.log('Projects navigation initialized');
}

// ============================================
// CATEGORY TABS
// ============================================
function initCategoryTabs() {
    if (typeof DOCUMENTS_DATA === 'undefined') return;

    const tabsContainer = document.getElementById('categoryTabs');
    const contentsContainer = document.getElementById('categoryContents');
    if (!tabsContainer || !contentsContainer) return;

    // Group documents
    const grouped = {};
    DOCUMENTS_DATA.forEach(doc => {
        if (!grouped[doc.category]) grouped[doc.category] = [];
        grouped[doc.category].push(doc);
    });

    const categoryOrder = ['sustainability', 'food', 'realestate', 'investment', 'technology', 'research'];

    // Init project indices
    categoryOrder.forEach(cat => categoryProjectIndex[cat] = 0);

    // Render tabs
    tabsContainer.innerHTML = categoryOrder.map(cat => {
        const info = CATEGORY_INFO[cat];
        const docs = grouped[cat] || [];
        if (docs.length === 0) return '';

        return `
            <button class="category-tab ${cat === 'sustainability' ? 'active' : ''}" 
                    data-category="${cat}" 
                    onclick="selectCategory('${cat}')">
                <span class="category-tab-icon">${info.icon}</span>
                <span>${info.name}</span>
            </button>
        `;
    }).join('');

    // Render content for each category
    contentsContainer.innerHTML = categoryOrder.map(cat => {
        const info = CATEGORY_INFO[cat];
        const docs = grouped[cat] || [];
        if (docs.length === 0) return '';

        return `
            <div class="category-content ${cat === 'sustainability' ? 'active' : ''}" data-category="${cat}">
                <!-- Category Description -->
                <div class="category-description">
                    <div class="category-desc-header">
                        <span class="category-desc-icon">${info.icon}</span>
                        <h3 class="category-desc-title">${info.name}</h3>
                    </div>
                    <p class="category-desc-text">${info.description}</p>
                    <span class="category-project-count">${docs.length} Projects</span>
                </div>
                
                <!-- Projects Grid - All visible -->
                <div class="projects-grid">
                    ${docs.map(doc => `
                        <div class="project-card">
                            <div class="project-preview">
                                <span class="project-preview-icon">${getDocIcon(doc.type)}</span>
                                <span class="project-type-badge">${doc.type}</span>
                            </div>
                            <div class="project-content">
                                <div class="project-meta">
                                    <div class="meta-label">Category</div>
                                    <div class="meta-value">${doc.categoryLabel || (CATEGORY_INFO[doc.category]?.name || '')}</div>
                                    <div class="meta-label">Type</div>
                                    <div class="meta-value">${doc.type}</div>
                                    <div class="meta-label">File</div>
                                    <div class="meta-value meta-filename">${doc.filename}</div>
                                </div>
                                <h4 class="project-title">${doc.title}</h4>
                                <p class="project-description">${doc.description}</p>
                                <div class="project-actions">
                                    <button class="project-btn project-btn-view" onclick="openModal('${escapeQuotes(doc.title)}', '${escapeQuotes(doc.filename)}')">
                                        👁️ View
                                    </button>
                                    <a href="${DOCUMENTS_BASE_PATH}${doc.filename}" class="project-btn project-btn-download" download>
                                        ⬇️ Download
                                    </a>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function selectCategory(category) {
    // Update tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });

    // Update content
    document.querySelectorAll('.category-content').forEach(content => {
        content.classList.toggle('active', content.dataset.category === category);
    });

    currentCategory = category;
}

function changeProjectSlide(category, direction) {
    const viewer = document.getElementById(`viewer-${category}`);
    if (!viewer) return;

    const slides = viewer.querySelectorAll('.project-slide');
    const currentIndex = categoryProjectIndex[category];

    // Remove active
    slides[currentIndex].classList.remove('active');

    // Calculate new index
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = slides.length - 1;
    if (newIndex >= slides.length) newIndex = 0;

    // Set active
    slides[newIndex].classList.add('active');
    categoryProjectIndex[category] = newIndex;

    // Update counter
    document.getElementById(`counter-${category}`).textContent = newIndex + 1;
}

// ============================================
// UTILITIES
// ============================================
function getDocIcon(type) {
    const icons = { 'PDF': '📄', 'PPTX': '📊', 'DOCX': '📝' };
    return icons[type] || '📄';
}

function escapeQuotes(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ============================================
// MODAL
// ============================================
function initModal() {
    const modal = document.getElementById('pdfModal');
    const closeBtn = document.getElementById('modalClose');

    if (!modal || !closeBtn) return;

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function openModal(title, filename) {
    const modal = document.getElementById('pdfModal');
    const filePath = DOCUMENTS_BASE_PATH + filename;

    document.getElementById('modalTitle').textContent = title;

    // Use direct iframe for localhost, Google Docs for public sites
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        document.getElementById('pdfViewer').src = filePath;
    } else {
        // For GitHub Pages: Use Google Docs Viewer as fallback for better compatibility
        const fullUrl = window.location.origin + window.location.pathname.replace('projects.html', '') + filePath;
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
        document.getElementById('pdfViewer').src = viewerUrl;
    }

    document.getElementById('modalDownloadBtn').href = filePath;
    modal.style.display = 'flex';
    clearInterval(slideInterval);
}

function closeModal() {
    const modal = document.getElementById('pdfModal');
    if (modal) modal.style.display = 'none';
    document.getElementById('pdfViewer').src = '';
    startSlideshow();
}
