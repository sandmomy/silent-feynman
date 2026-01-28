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
    initMobileScrollLock();
});

// ============================================
// MOBILE MODAL HELPERS
// ============================================
let savedScrollY = 0;

function initMobileScrollLock() {
    // Initialize mobile modal events
    const overlay = document.getElementById('mobile-modal-overlay');
    const closeBtn = document.getElementById('mobile-modal-close-btn');
    const viewBtn = document.getElementById('mobile-modal-view-btn');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeMobileModal);
    }

    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                closeMobileModal();
            }
        });
    }

    if (viewBtn) {
        viewBtn.addEventListener('click', function () {
            const title = document.getElementById('mobile-modal-name').textContent;
            const downloadLink = document.getElementById('mobile-modal-download-btn').href;
            const filename = downloadLink.split('/').pop();
            closeMobileModal();
            openModal(title, filename);
        });
    }

    // Keyboard escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeMobileModal();
        }
    });
}

function openMobileModal(title, filename, description) {
    const overlay = document.getElementById('mobile-modal-overlay');
    if (!overlay) return;

    const filePath = DOCUMENTS_BASE_PATH + filename;

    // Set content safely
    document.getElementById('mobile-modal-name').textContent = title;
    document.getElementById('mobile-modal-desc').textContent = description || '';
    document.getElementById('mobile-modal-download-btn').href = filePath;

    // Determine viewer source based on environment
    // Google Docs Viewer cannot read files from localhost
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
        document.getElementById('mobile-modal-preview').src = filePath;
    } else {
        const fullUrl = new URL(filePath, window.location.href).href;
        document.getElementById('mobile-modal-preview').src = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
    }

    // Lock background scroll
    document.body.style.overflow = 'hidden';
    if (window.lenis) {
        try { window.lenis.stop(); } catch (e) { }
    }

    overlay.classList.add('active');
}

function closeMobileModal() {
    const overlay = document.getElementById('mobile-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.getElementById('mobile-modal-preview').src = '';

        // Restore background scroll
        document.body.style.overflow = '';
        if (window.lenis) {
            try { window.lenis.start(); } catch (e) { }
        }
    }
}

// Clean up any potential legacy listeners
window.onpopstate = null;
if (window.history.state && window.history.state.isModalOpen) {
    window.history.replaceState(null, '');
}

// ============================================
// FEATURED SLIDESHOW
// ============================================
function initSlideshow() {
    if (typeof DOCUMENTS_DATA === 'undefined') return;

    const container = document.getElementById('slideshow');
    if (!container) return;

    const featured = FEATURED_IDS.map(id => DOCUMENTS_DATA.find(d => d.id === id)).filter(Boolean);

    const slidesHTML = featured.map((doc, i) => `
        <div class="slide ${i === 0 ? 'active' : ''}" data-index="${i}" style="background-image: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url('${doc.thumbnail || 'assets/placeholder.jpg'}'); background-size: cover; background-position: center;">
            <div class="slide-featured-header">
               <span>⭐ FEATURED INSIGHTS</span>
            </div>
            <div class="slide-content">
                <div class="slide-category">
                   <span class="category-icon">${doc.category === 'investment' ? '💰' : '⚡'}</span>
                   ${doc.categoryLabel.replace('🌿 ', '').replace('💰 ', '').replace('⚡ ', '')}
                </div>
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
                        <div class="project-card" onclick="toggleProjectCard(this, event)" 
                             data-title="${escapeQuotes(doc.title)}" 
                             data-filename="${escapeQuotes(doc.filename)}"
                             data-description="${escapeQuotes(doc.description || '')}"
                             style="${doc.thumbnail ? `--project-bg: url('../${doc.thumbnail}')` : ''}">
                            <div class="project-overlay"></div>
                            
                            <!-- Floating Title Tab (Mobile Only) -->
                            <div class="project-title-tab">${doc.title}</div>

                            <div class="project-preview">
                                ${doc.thumbnail ? `<img src="${doc.thumbnail}" class="project-thumb-img" alt="${doc.title}">` : `<span class="project-preview-icon">${getDocIcon(doc.type)}</span>`}
                                <span class="project-type-badge">${doc.type}</span>
                            </div>

                            <div class="project-header-mobile-trigger">
                                <span class="mobile-open-icon">+</span>
                            </div>

                            <div class="project-content">
                                <div class="project-header-mobile">
                                    <span class="mobile-chevron">✕</span>
                                </div>
                                <div class="project-modal-title">${doc.title}</div>

                                <div id="viewer-target-${doc.id}" class="project-viewer-target"></div>

                                <div class="project-meta">
                                    <div class="meta-label">Type</div>
                                    <div class="meta-value">${doc.type}</div>
                                    <div class="meta-label">File</div>
                                    <div class="meta-value meta-filename">${doc.filename}</div>
                                </div>
                                
                                <h4 class="project-title desktop-only">${doc.title}</h4>
                                
                                <div class="project-details-wrapper">
                                    <p class="project-description">${doc.description}</p>
                                    <div class="project-actions">
                                        <button class="project-btn project-btn-view" onclick="event.stopPropagation(); openModal('${escapeQuotes(doc.title)}', '${escapeQuotes(doc.filename)}')">
                                            👁️ Full Screen
                                        </button>
                                        <a href="${DOCUMENTS_BASE_PATH}${doc.filename}" class="project-btn project-btn-download" download onclick="event.stopPropagation()">
                                            ⬇️ Download
                                        </a>
                                    </div>
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
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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
    // REDIRECT TO MOBILE MODAL IF ON MOBILE
    if (window.innerWidth < 992) {
        // Try to find description from data if available
        let desc = '';
        if (typeof DOCUMENTS_DATA !== 'undefined') {
            const doc = DOCUMENTS_DATA.find(d => d.filename === filename);
            if (doc) desc = doc.description;
        }
        openMobileModal(title, filename, desc);
        return;
    }

    const modal = document.getElementById('pdfModal');
    const filePath = DOCUMENTS_BASE_PATH + filename;

    document.getElementById('modalTitle').textContent = title;

    // Unified handling: Always use the modal
    // Determine the viewer URL based on environment
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
        document.getElementById('pdfViewer').src = filePath;
    } else {
        // For GitHub Pages / Production: Use Google Docs Viewer for best cross-device compatibility
        // This keeps the user IN the modal instead of opening a new tab/screen
        const fullUrl = new URL(filePath, window.location.href).href;
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
        document.getElementById('pdfViewer').src = viewerUrl;
    }

    document.getElementById('modalDownloadBtn').href = filePath;
    // Use class activation instead of just inline style for consistency
    modal.classList.add('project-modal-active');
    modal.style.display = 'flex'; // Keep as fallback

    // Lock background scroll
    document.body.style.overflow = 'hidden';

    if (window.lenis) {
        try { window.lenis.stop(); } catch (e) { }
    }

    clearInterval(slideInterval);
}

function closeModal() {
    const modal = document.getElementById('pdfModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('project-modal-active');
    }
    document.getElementById('pdfViewer').src = '';

    // Restore background scroll
    document.body.style.overflow = '';

    if (window.lenis) {
        try { window.lenis.start(); } catch (e) { }
    }

    startSlideshow();
}

// ============================================
// MOBILE ACCORDION
// ============================================
function toggleProjectCard(card, event) {
    const title = card.getAttribute('data-title');
    const filename = card.getAttribute('data-filename');
    const description = card.getAttribute('data-description') || '';

    // Desktop: Open full-screen modal directly
    if (window.innerWidth >= 992) {
        if (title && filename) {
            openModal(title, filename);
        }
        return;
    }

    // Mobile: Open simple modal
    if (title && filename) {
        openMobileModal(title, filename, description);
    }
}
