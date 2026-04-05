/**
 * Eugene Mierak Portfolio - Main JavaScript
 */

document.addEventListener('DOMContentLoaded', function () {
    initSmoothScroll();
    initNavigation();
    initScrollEffects();
    initStatsAnimation();
    initHeroGlobe();
    initCountrySlider();
    initFadeAnimations();
    initPartnersDropdown();
});

// ============================================
// SMOOTH SCROLL WITH LENIS
// ============================================
function initSmoothScroll() {
    // Skip Lenis on mobile — native scroll handles touch better
    var isMobile = ('ontouchstart' in window) || window.innerWidth <= 1024;
    if (isMobile) return;

    if (window.lenis) return;
    if (typeof Lenis === 'undefined') return;

    try {
        const lenis = new Lenis({
            lerp: 0.14,
            wheelMultiplier: 0.92,
            touchMultiplier: 1.2,
            smoothWheel: true,
            syncTouch: false,
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        window.lenisInstance = lenis;
        window.lenis = lenis;
    } catch (error) {
        console.error('Error initializing Lenis:', error);
    }
}

// ============================================
// Hero Globe (WebGL Earth)
// ============================================
function initHeroGlobe() {
    const globeContainer = document.getElementById('hero-globe');
    if (!globeContainer) return;

    const activeCountries = ['Indonesia', 'Nigeria', 'Kenya'];

    const pointsData = [
        { lat: -6.2, lng: 106.8, name: 'Jakarta', color: '#ef4444' },
        { lat: -8.4, lng: 115.2, name: 'Bali', color: '#ef4444' },
        { lat: 9.0, lng: 8.0, name: 'Nigeria', color: '#ef4444' },
        { lat: -1.3, lng: 36.8, name: 'Kenya', color: '#ef4444' }
    ];

    const earthTexture = 'assets/optimized/earth-day.480w.webp';

    const rect = globeContainer.getBoundingClientRect();
    const isMobile = window.innerWidth <= 1024;
    const mobileSize = 165;
    const initialSize = isMobile ? mobileSize : Math.max(Math.min(rect.width, rect.height || 400), 150);

    const globe = Globe()
        .width(initialSize)
        .height(initialSize)
        .backgroundColor('rgba(0,0,0,0)')
        .globeImageUrl(earthTexture)
        .showAtmosphere(true)
        .atmosphereColor('#48bb78')
        .atmosphereAltitude(0.12);

    let globeData = [];
    if (typeof DOCUMENTS_DATA !== 'undefined') {
        globeData = DOCUMENTS_DATA.filter(d => d.lat !== undefined && d.lng !== undefined);
    } else {
        globeData = pointsData;
    }

    globe
        .htmlElementsData(globeData)
        .htmlLat('lat')
        .htmlLng('lng')
        .htmlAltitude(0.05)
        .htmlElement(d => {
            const el = document.createElement('div');
            el.className = 'globe-pin-container';
            el.style.position = 'relative';
            el.style.transform = 'translate(-50%, -100%)';
            el.style.cursor = 'pointer';
            el.style.pointerEvents = 'auto';

            const pin = document.createElement('div');
            pin.className = 'map-pin small-ping';
            pin.style.background = 'transparent';
            pin.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#ef4444" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); display: block;">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    <circle cx="12" cy="9" r="2.5" fill="white"/>
                </svg>
            `;
            el.appendChild(pin);

            const tooltip = document.createElement('div');
            tooltip.className = 'globe-tooltip';
            tooltip.innerHTML = `
                <div class="tooltip-category">${d.categoryLabel || 'Project'}</div>
                <div class="tooltip-title">${d.title}</div>
            `;
            Object.assign(tooltip.style, {
                position: 'absolute',
                bottom: '120%',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                padding: '8px 12px',
                borderRadius: '8px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: '0',
                transition: 'opacity 0.2s, transform 0.2s',
                marginTop: '10px',
                zIndex: '100',
                border: '1px solid rgba(0,0,0,0.05)',
                textAlign: 'center',
                minWidth: '150px'
            });

            tooltip.querySelector('.tooltip-title').style.cssText = 'font-size: 12px; font-weight: 700; color: #1a202c; display: block; margin-top: 2px;';
            tooltip.querySelector('.tooltip-category').style.cssText = 'font-size: 10px; font-weight: 600; color: #38a169; text-transform: uppercase; letter-spacing: 0.5px;';

            el.appendChild(tooltip);

            el.addEventListener('mouseenter', () => {
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateX(-50%) translateY(-5px)';
                pin.style.transform = 'scale(1.2) translateY(-2px)';
                globe.controls().autoRotate = false;
            });

            el.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateX(-50%) translateY(0)';
                pin.style.transform = 'scale(1) translateY(0)';
                globe.controls().autoRotate = true;
            });

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof openModal === 'function') {
                    openModal(d.title, d.filename);
                }
            });

            // Touch events for mobile — show tooltip on tap
            let touchTimeout;
            el.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                clearTimeout(touchTimeout);
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateX(-50%) translateY(-5px)';
                pin.style.transform = 'scale(1.2) translateY(-2px)';
                globe.controls().autoRotate = false;
            }, { passive: true });

            el.addEventListener('touchend', () => {
                touchTimeout = setTimeout(() => {
                    tooltip.style.opacity = '0';
                    tooltip.style.transform = 'translateX(-50%) translateY(0)';
                    pin.style.transform = 'scale(1) translateY(0)';
                    globe.controls().autoRotate = true;
                }, 2000);
            });

            return el;
        });

    globe(globeContainer);

    const syncGlobeSizeToContainer = () => {
        const rect = globeContainer.getBoundingClientRect();
        const isMobileViewport = window.innerWidth <= 1024;

        if (isMobileViewport) {
            const mobileSize = Math.max(150, Math.min(170, Math.round(rect.width) || 0));
            globe.width(mobileSize);
            globe.height(mobileSize);
            return;
        }

        const w = Math.max(320, Math.round(rect.width));
        const h = Math.max(320, Math.round(rect.height));
        globe.width(w);
        globe.height(h);
    };

    syncGlobeSizeToContainer();
    globe.pointOfView({ lat: 0, lng: 10, altitude: 2.5 }, 0);

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = -1.5;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const renderer = globe.renderer();
    if (renderer) {
        renderer.setPixelRatio(1);
    }

    let animationId = null;
    let isGlobeActive = false;

    globeContainer.style.opacity = '1';
    globeContainer.style.transform = 'scale(1)';
    globeContainer.style.transition = 'opacity 0.6s ease, transform 0.6s ease';

    const isMobileDevice = window.innerWidth <= 1024;
    let frameCount = 0;

    function startRendering() {
        if (!animationId && renderer) {
            function animate() {
                animationId = requestAnimationFrame(animate);
                // Throttle to ~30fps on mobile to save battery
                if (isMobileDevice && ++frameCount % 2 !== 0) return;
                controls.update();
                renderer.render(globe.scene(), globe.camera());
            }
            animate();
        }
    }

    function stopRendering() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    function showGlobe() {
        if (!isGlobeActive) {
            isGlobeActive = true;
            startRendering();
            requestAnimationFrame(() => {
                globeContainer.style.opacity = '1';
            });
            controls.autoRotate = true;
        }
    }

    function hideGlobe() {
        if (isGlobeActive) {
            isGlobeActive = false;
            controls.autoRotate = false;
            globeContainer.style.opacity = '0';
            setTimeout(() => {
                if (!isGlobeActive) stopRendering();
            }, 600);
        }
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) showGlobe();
            else hideGlobe();
        });
    }, { threshold: 0.2 });

    observer.observe(globeContainer);

    // Let IntersectionObserver control rendering start
    // Initial render only if globe is already visible
    if (globeContainer.getBoundingClientRect().top < window.innerHeight) {
        isGlobeActive = true;
        startRendering();
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(syncGlobeSizeToContainer, 150);
    });
    window.addEventListener('orientationchange', () => {
        setTimeout(syncGlobeSizeToContainer, 300);
    });
    setTimeout(syncGlobeSizeToContainer, 50);
    setTimeout(syncGlobeSizeToContainer, 300);

    let resumeTimeout;
    controls.addEventListener('start', () => {
        clearTimeout(resumeTimeout);
        controls.autoRotate = false;
    });
    controls.addEventListener('end', () => {
        resumeTimeout = setTimeout(() => {
            controls.autoRotate = true;
        }, 3000);
    });

    fetch('assets/countries.geojson')
        .then(res => res.json())
        .then(countries => {
            const activeOnly = countries.features.filter(d => {
                const name = d.properties.ADMIN || d.properties.name;
                return activeCountries.includes(name);
            });
            globe
                .polygonsData(activeOnly)
                .polygonCapColor(() => '#4299e1')
                .polygonSideColor(() => 'rgba(66, 153, 225, 0.5)')
                .polygonStrokeColor(() => '#2c5282')
                .polygonAltitude(0.015);
        })
        .catch(err => console.error('Error loading countries:', err));
}

// ============================================
// Navigation
// ============================================
function initNavigation() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.top-nav-links');

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenuBtn.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (navLinks.classList.contains('active') &&
                !navLinks.contains(e.target) &&
                !mobileMenuBtn.contains(e.target)) {
                mobileMenuBtn.classList.remove('active');
                navLinks.classList.remove('active');
            }
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuBtn.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }
}

// ============================================
// Scroll Effects
// ============================================
function initScrollEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -48px 0px'
    });

    document.querySelectorAll('.section-title, .stat-card, .project-card').forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}

// ============================================
// Stats Animation
// ============================================
function initStatsAnimation() {
    const stats = document.querySelector('.hero-stats-row');
    if (!stats) return;
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            document.querySelectorAll('.stat-num').forEach(stat => {
                const rawText = stat.innerText;
                const target = parseInt(rawText.replace(/\D/g, ''));
                if (isNaN(target)) return;

                let cur = 0, inc = Math.ceil(target / 50);
                const t = setInterval(() => {
                    cur += inc;
                    if (cur >= target) {
                        stat.textContent = rawText;
                        clearInterval(t);
                    }
                    else stat.textContent = cur;
                }, 40);
            });
            observer.disconnect();
        }
    }, { threshold: 0.5 });
    observer.observe(stats);
}

// ============================================
// Country Flags Slider
// ============================================
function initCountrySlider() {
    const slider = document.querySelector('.country-slider');
    if (!slider) return;

    const slides = slider.querySelectorAll('.country-slide');
    if (slides.length === 0) return;

    const dots = document.querySelectorAll('.slider-dot');
    const locationEl = document.querySelector('.slide-location');
    const locationNames = ['Yogyakarta', 'Malang & Batu', 'Bali', 'Sumba'];
    let currentIndex = 0;

    function showSlide(index) {
        slides.forEach(function(slide, i) {
            slide.classList.toggle('active', i === index);
        });
        dots.forEach(function(dot, i) {
            dot.classList.toggle('active', i === index);
        });
        if (locationEl) {
            locationEl.style.opacity = '0';
            setTimeout(function() {
                locationEl.textContent = locationNames[index] || '';
                locationEl.style.opacity = '1';
            }, 300);
        }
    }

    function nextSlide() {
        currentIndex = (currentIndex + 1) % slides.length;
        showSlide(currentIndex);
    }

    // Click on dots to navigate
    dots.forEach(function(dot, i) {
        dot.addEventListener('click', function() {
            currentIndex = i;
            showSlide(currentIndex);
            stopRotate();
            startRotate();
        });
    });

    showSlide(currentIndex);

    var rotateInterval;
    var startRotate = function() { rotateInterval = setInterval(nextSlide, 4000); };
    var stopRotate = function() { clearInterval(rotateInterval); };

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) stopRotate();
        else startRotate();
    });

    startRotate();
}

// ============================================
// Section Fade Animations
// ============================================
function initFadeAnimations() {
    const fadeElements = document.querySelectorAll('.fade-section, .fade-scale, .fade-left, .fade-right');
    if (fadeElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        root: null,
        rootMargin: '0px 0px -72px 0px',
        threshold: 0.12
    });

    fadeElements.forEach(el => observer.observe(el));
}

// ============================================
// Partners Dropdown
// ============================================
function initPartnersDropdown() {
    const partnersBtn = document.getElementById('partnersBtn');
    const partnersDropdown = document.getElementById('partnersDropdown');

    if (!partnersBtn || !partnersDropdown) return;

    partnersBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = partnersBtn.getAttribute('aria-expanded') === 'true';
        partnersBtn.setAttribute('aria-expanded', !isExpanded);
        partnersDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!partnersDropdown.contains(e.target) && !partnersBtn.contains(e.target)) {
            partnersBtn.setAttribute('aria-expanded', 'false');
            partnersDropdown.classList.remove('active');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && partnersDropdown.classList.contains('active')) {
            partnersBtn.setAttribute('aria-expanded', 'false');
            partnersDropdown.classList.remove('active');
            partnersBtn.focus();
        }
    });
}
