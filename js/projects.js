/**
 * Projects Page - Slideshow + Projects Dashboard
 */

// Featured projects IDs (the 4 most important)
const FEATURED_IDS = [4, 11, 18, 26];

let currentSlide = 0;
let slideInterval = null;

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
    initSlideshow();
    initProjectsDashboard();
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
            // Open PDF in new tab for full screen viewing
            const downloadLink = document.getElementById('mobile-modal-download-btn').href;
            window.open(downloadLink, '_blank');
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

    // Scroll to top so modal is visible
    window.scrollTo({ top: 0, behavior: 'smooth' });

    overlay.classList.add('active');
}

function closeMobileModal() {
    const overlay = document.getElementById('mobile-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.getElementById('mobile-modal-preview').src = '';

        // Restore background scroll
        // document.body.style.overflow = '';
        // document.documentElement.style.overflow = '';
        // if (window.lenis) {
        //     try { window.lenis.start(); } catch (e) { }
        // }
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
    initTouchSwipe(container);
}

// Touch swipe support for mobile
function initTouchSwipe(container) {
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;

    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const distance = touchEndX - touchStartX;
        if (Math.abs(distance) < minSwipeDistance) return;

        if (distance > 0) {
            // Swipe right - previous slide
            changeSlide(-1);
        } else {
            // Swipe left - next slide
            changeSlide(1);
        }
    }
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
// PROJECTS DASHBOARD
// ============================================
let currentFilter = 'all';
let currentView = 'grid';

function initProjectsDashboard() {
    if (typeof DOCUMENTS_DATA === 'undefined') return;

    const filterTabs = document.getElementById('filterTabs');
    const gallery = document.getElementById('projectsGallery');

    if (!filterTabs || !gallery) return;

    // Group documents by category
    const grouped = {};
    DOCUMENTS_DATA.forEach(doc => {
        if (!grouped[doc.category]) grouped[doc.category] = [];
        grouped[doc.category].push(doc);
    });

    const categoryOrder = ['sustainability', 'food', 'realestate', 'investment', 'technology', 'research'];
    const defaultCategory = categoryOrder[0];

    // Render filter tabs (no "All" option - show one category at a time)
    filterTabs.innerHTML = categoryOrder.map(cat => {
        const info = CATEGORY_INFO[cat];
        const count = grouped[cat]?.length || 0;

        if (count === 0) return '';

        return `
            <button class="filter-tab ${cat === defaultCategory ? 'active' : ''}"
                    data-filter="${cat}"
                    onclick="filterProjects('${cat}')">
                <span class="filter-tab-icon">${info.icon}</span>
                <span>${info.name}</span>
                <span class="filter-tab-count">${count}</span>
            </button>
        `;
    }).join('');

    // Initial render - show first category only
    currentFilter = defaultCategory;
    renderProjects(grouped[defaultCategory] || []);

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            gallery.classList.toggle('list-view', currentView === 'list');
        });
    });
}

function filterProjects(category) {
    currentFilter = category;

    // Update tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === category);
    });

    // Filter and render
    const filtered = DOCUMENTS_DATA.filter(doc => doc.category === category);
    renderProjects(filtered);
}

function renderProjects(projects) {
    const gallery = document.getElementById('projectsGallery');
    const emptyState = document.getElementById('emptyState');

    if (!gallery) return;

    if (projects.length === 0) {
        gallery.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    gallery.innerHTML = projects.map(doc => `
        <div class="project-card" data-title="${escapeQuotes(doc.title)}" onclick="openProjectModal('${escapeQuotes(doc.title)}', '${escapeQuotes(doc.filename)}')">
            <div class="project-thumbnail">
                ${doc.thumbnail
                    ? `<img src="${doc.thumbnail}" alt="${escapeQuotes(doc.title)}" loading="lazy">`
                    : `<span class="project-thumbnail-icon">${getDocIcon(doc.type)}</span>`
                }
                <div class="project-badge">
                    <span class="badge-dot"></span>
                    ${doc.type}
                </div>
                <div class="project-thumbnail-overlay">
                    <div class="thumbnail-actions">
                        <button class="thumb-btn thumb-btn-primary" onclick="event.stopPropagation(); openModal('${escapeQuotes(doc.title)}', '${escapeQuotes(doc.filename)}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            View
                        </button>
                        <a href="${DOCUMENTS_BASE_PATH}${doc.filename}" class="thumb-btn thumb-btn-secondary" download onclick="event.stopPropagation()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
            <div class="project-body">
                <div class="project-category">${CATEGORY_INFO[doc.category]?.name || doc.category}</div>
                <h3 class="project-title">${doc.title}</h3>
                <p class="project-description">${doc.description || ''}</p>
            </div>
            <div class="project-footer">
                <div class="project-meta">
                    <div class="meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        ${doc.type}
                    </div>
                </div>
                <div class="project-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); openModal('${escapeQuotes(doc.title)}', '${escapeQuotes(doc.filename)}')" title="View">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <a href="${DOCUMENTS_BASE_PATH}${doc.filename}" class="action-btn" download onclick="event.stopPropagation()" title="Download">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    `).join('');

    // Apply current view
    gallery.classList.toggle('list-view', currentView === 'list');
}

function openProjectModal(title, filename) {
    openModal(title, filename);
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
    if (window.innerWidth < 768) {
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

    // Determine the viewer URL based on environment
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
        document.getElementById('pdfViewer').src = filePath;
    } else {
        const fullUrl = new URL(filePath, window.location.href).href;
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
        document.getElementById('pdfViewer').src = viewerUrl;
    }

    document.getElementById('modalDownloadBtn').href = filePath;

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    clearInterval(slideInterval);
}

function closeModal() {
    const modal = document.getElementById('pdfModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.getElementById('pdfViewer').src = '';
    document.body.style.overflow = '';

    startSlideshow();
}

// ============================================
// MOBILE ACCORDION & PDF HANDLER
// ============================================
function handleViewPdf(filename, title) {
    const isMobile = window.innerWidth < 992;
    const filePath = DOCUMENTS_BASE_PATH + filename;

    if (isMobile) {
        // Mobile: Open in new tab for full screen experience
        window.open(filePath, '_blank');
    } else {
        // Desktop: Open modal
        openModal(title, filename);
    }
}

