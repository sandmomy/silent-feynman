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
});

// ============================================
// SMOOTH SCROLL WITH LENIS
// ============================================
function initSmoothScroll() {
    // Prevent multiple instances
    if (window.lenis) {
        console.log('Lenis already initialized, skipping');
        return;
    }

    // Check if Lenis is available
    if (typeof Lenis === 'undefined') {
        console.log('Lenis not loaded, skipping smooth scroll');
        return;
    }

    try {
        // Initialize Lenis - same config as projects.js for consistency
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: true,
            mouseMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
            infinite: false,
        });

        // Sync Lenis with Three.js - share the same RAF loop
        // This prevents conflicts between multiple animation loops
        lenis.on('scroll', () => {
            // Trigger scroll events for other listeners
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        // Store lenis instance globally for globe sync
        window.lenisInstance = lenis;

        // Expose lenis to window for debugging
        window.lenis = lenis;
        console.log('Lenis smooth scroll initialized');
    } catch (error) {
        console.error('Error initializing Lenis:', error);
    }
}

// ============================================
// Hero Globe (WebGL Earth)
// ============================================
function initHeroGlobe() {
    console.log('Initializing Hero Globe (HTML/SVG Markers)...');

    const globeContainer = document.getElementById('hero-globe');
    if (!globeContainer) return;

    // NOTE: Layout is now handled by CSS Grid - no JS calculations needed

    // Countries with active projects (will be BLUE)
    const activeCountries = ['Indonesia', 'Nigeria', 'Kenya'];

    // Project locations
    const pointsData = [
        { lat: -6.2, lng: 106.8, name: 'Jakarta', color: '#ef4444' },
        { lat: -8.4, lng: 115.2, name: 'Bali', color: '#ef4444' },
        { lat: 9.0, lng: 8.0, name: 'Nigeria', color: '#ef4444' },
        { lat: -1.3, lng: 36.8, name: 'Kenya', color: '#ef4444' }
    ];

    // Natural Earth texture: localized for reliability
    const earthTexture = 'assets/earth-day.jpg';

    // Initialize Globe - responsive sizing from container
    const rect = globeContainer.getBoundingClientRect();
    // Use minimum size of 140px for mobile, or container size for desktop
    const isMobile = window.innerWidth <= 992;
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

    const updateSize = () => {
        const isMobileNow = window.innerWidth <= 992;
        if (isMobileNow) {
            globe.width(165).height(165);
        } else {
            const currentRect = globeContainer.getBoundingClientRect();
            const size = Math.max(Math.min(currentRect.width, currentRect.height || 400), 150);
            globe.width(size).height(size);
        }
    };

    // Auto-resize on window change with robust debounce
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateSize, 150);
    });

    // --- LAYER 1: HTML MARKERS (SVG Google Pins) ---
    // --- LAYER 1: HTML MARKERS (CSS Pins) ---
    // Use DOCUMENTS_DATA if available, filtering for items with coordinates
    let globeData = [];
    if (typeof DOCUMENTS_DATA !== 'undefined') {
        globeData = DOCUMENTS_DATA.filter(d => d.lat !== undefined && d.lng !== undefined);
    } else {
        // Fallback or dev data
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

            // Pin Icon (CSS)
            const pin = document.createElement('div');
            pin.className = 'map-pin small-ping';
            pin.style.background = 'transparent'; // Transparent background, only SVG visible

            // Or use SVG inside
            pin.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24" fill="#ef4444" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); display: block;">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    <circle cx="12" cy="9" r="2.5" fill="white"/>
                </svg>
            `;

            el.appendChild(pin);

            // Tooltip (Hidden by default, shown on hover/click)
            const tooltip = document.createElement('div');
            tooltip.className = 'globe-tooltip';
            tooltip.innerHTML = `
                <div class="tooltip-category">${d.categoryLabel || 'Project'}</div>
                <div class="tooltip-title">${d.title}</div>
            `;
            // Inline styles for tooltip (or move to CSS)
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

            // Tooltip Text Styles
            const titleStyle = `font-size: 12px; font-weight: 700; color: #1a202c; display: block; margin-top: 2px;`;
            const catStyle = `font-size: 10px; font-weight: 600; color: #38a169; text-transform: uppercase; letter-spacing: 0.5px;`;

            tooltip.querySelector('.tooltip-title').style.cssText = titleStyle;
            tooltip.querySelector('.tooltip-category').style.cssText = catStyle;

            el.appendChild(tooltip);

            // Event Listeners for Interaction
            // Hover
            el.addEventListener('mouseenter', () => {
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateX(-50%) translateY(-5px)';
                pin.style.transform = 'scale(1.2) translateY(-2px)';
                globe.controls().autoRotate = false; // Pause rotation
            });

            el.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateX(-50%) translateY(0)';
                pin.style.transform = 'scale(1) translateY(0)';
                globe.controls().autoRotate = true; // Resume rotation
            });

            // Click -> Open Modal (Reuse openModal from projects.js if available globally, otherwise alert)
            el.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent drag
                if (typeof openModal === 'function') {
                    openModal(d.title, d.filename);
                } else {
                    // Fallback if openModal isn't global yet (it might need to be exposed)
                    alert(`${d.title}\n\n${d.description}`);
                }
            });

            return el;
        });

    // Mount to DOM

    // Mount to DOM
    globe(globeContainer);

    const syncGlobeSizeToContainer = () => {
        const rect = globeContainer.getBoundingClientRect();
        const isMobileViewport = window.innerWidth <= 992;

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

    // Ensure WebGL canvas matches responsive CSS size
    syncGlobeSizeToContainer();

    // Initial View - Set transition to 0 to prevent "zoom in" glitch on load
    globe.pointOfView({ lat: 0, lng: 10, altitude: 2.5 }, 0);

    // Controls - Optimized for performance
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = -1.5;  // Slower rotation = less GPU usage
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Reduce render quality for performance
    const renderer = globe.renderer();
    if (renderer) {
        renderer.setPixelRatio(1);
    }

    // Animation state
    let animationId = null;
    let isGlobeActive = false;

    // Set initial state - visible immediately for reliable rendering
    globeContainer.style.opacity = '1';
    globeContainer.style.transform = 'scale(1)';
    globeContainer.style.transition = 'opacity 0.6s ease, transform 0.6s ease';

    function startRendering() {
        if (!animationId && renderer) {
            function animate() {
                animationId = requestAnimationFrame(animate);
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
            // Animate in
            requestAnimationFrame(() => {
                globeContainer.style.opacity = '1';
                globeContainer.style.transform = 'scale(1)';
            });
            controls.autoRotate = true;
        }
    }

    function hideGlobe() {
        if (isGlobeActive) {
            isGlobeActive = false;
            controls.autoRotate = false;
            // Animate out
            globeContainer.style.opacity = '0';
            globeContainer.style.transform = 'scale(0.8)';
            // Stop rendering after animation completes
            setTimeout(() => {
                if (!isGlobeActive) {
                    stopRendering();
                }
            }, 600);
        }
    }

    // Use IntersectionObserver to show/hide globe with animation
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                showGlobe();
            } else {
                hideGlobe();
            }
        });
    }, {
        threshold: 0.2
    });

    observer.observe(globeContainer);

    // Start immediately - don't wait for observer
    isGlobeActive = true;
    startRendering();

    // Sync globe size on resize with debounce
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            syncGlobeSizeToContainer();
        }, 150);
    });
    setTimeout(syncGlobeSizeToContainer, 50);
    setTimeout(syncGlobeSizeToContainer, 300);
    setTimeout(syncGlobeSizeToContainer, 1000);

    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (isGlobeActive && animationId) {
            stopRendering();
        }
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (isGlobeActive && !animationId) {
                startRendering();
            }
        }, 100); // Resume 100ms after scroll stops
    }, { passive: true });

    // Interaction Logic: Pause on interaction, resume after 3s
    let resumeTimeout;

    controls.addEventListener('start', () => {
        clearTimeout(resumeTimeout);
        controls.autoRotate = false;
    });

    controls.addEventListener('end', () => {
        resumeTimeout = setTimeout(() => {
            controls.autoRotate = true;
        }, 3000); // 3 seconds wait
    });

    // Load ONLY active countries from localized GeoJSON
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
// Navigation & Effects
// ============================================
// Navigation logic removed to restore original clean aesthetic
function initNavigation() {
    console.log('Mobile navigation removed per user request');
}

function initScrollEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => entry.isIntersecting && entry.target.classList.add('visible'));
    }, { threshold: 0.1 });

    document.querySelectorAll('.section-title, .stat-card, .project-card').forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}

function initStatsAnimation() {
    // Target the new hero stats row in the diagram
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
// Event Carousel
// ============================================
function initEventCarousel() {
    const carousel = document.getElementById('eventCarousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots = carousel.querySelectorAll('.dot');
    let currentIndex = 0;
    let autoPlayInterval;

    function showSlide(index) {
        if (index >= slides.length) index = 0;
        if (index < 0) index = slides.length - 1;
        currentIndex = index;

        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }

    function nextSlide() {
        showSlide(currentIndex + 1);
    }

    function startAutoPlay() {
        stopAutoPlay();
        autoPlayInterval = setInterval(nextSlide, 4000);
    }

    function stopAutoPlay() {
        if (autoPlayInterval) clearInterval(autoPlayInterval);
    }

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            stopAutoPlay();
            showSlide(parseInt(dot.dataset.slide));
            startAutoPlay();
        });
    });

    // Pause on interaction
    carousel.addEventListener('mouseenter', stopAutoPlay);
    carousel.addEventListener('mouseleave', startAutoPlay);
    carousel.addEventListener('touchstart', stopAutoPlay, { passive: true });
    carousel.addEventListener('touchend', startAutoPlay, { passive: true });

    startAutoPlay();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initEventCarousel);

// ============================================
// Country Flags Slider
// ============================================
function initCountrySlider() {
    const slider = document.querySelector('.country-slider');
    if (!slider) return;

    const slides = slider.querySelectorAll('.country-slide');
    if (slides.length === 0) return;

    const countryImages = {
        Indonesia: [
            'assets/karangasem-water-temple-palace-bali.jpg', // Karangasem water temple, Bali
            'assets/bali-pagoda-indonesia.jpg', // Bali pagoda temple
            'assets/pexels-maxravier-2253818.jpg'  // Third temple image
        ],
        Nigeria: [
            'assets/ahmad-jaafar-toQTkWFvWyo-unsplash.jpg', // Mosque in Nigeria
            'assets/muhammed-a-mustapha-aaIsU06zWrg-unsplash.jpg', // Islamic architecture
            'assets/ovinuchi-ejiohuo-q4U9Pyfz-vQ-unsplash.jpg'  // Mosque
        ],
        Kenya: [
            'assets/ahmed-qinawy-9Ia_6613pYk-unsplash.jpg', // Church in Kenya
            'assets/murad-swaleh-7tDidSXbgD8-unsplash.jpg', // Church building
            'assets/ab-saf-sgFNwIc51lM-unsplash.jpg'  // Church interior
        ]
    };

    function preloadImages() {
        const allImages = Object.values(countryImages).flat();
        allImages.forEach(url => {
            const img = new Image();
            img.src = url;
        });
    }

    preloadImages();

    let currentCountryIndex = 0;
    let currentImageIndex = 0;

    function getCountryName(slide) {
        const labelSub = slide.querySelector('.country-label-sub');
        return (labelSub ? labelSub.textContent : '').trim();
    }

    function setSlideImage(slide, imageIndex) {
        const img = slide.querySelector('img');
        if (!img) return;

        const country = getCountryName(slide);
        const images = countryImages[country];
        if (!images || images.length === 0) return;

        const url = images[imageIndex % images.length];
        img.src = url;
        img.alt = `${country} - Events`;
    }

    function showCountry(index) {
        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });
        setSlideImage(slides[index], currentImageIndex);
    }

    function nextFrame() {
        // Change country every frame
        currentCountryIndex = (currentCountryIndex + 1) % slides.length;

        // When we've shown all countries for the current image, move to next image
        if (currentCountryIndex === 0) {
            currentImageIndex = (currentImageIndex + 1) % 3;
        }

        showCountry(currentCountryIndex);
    }

    showCountry(currentCountryIndex);

    let rotateInterval;
    const startRotate = () => { rotateInterval = setInterval(nextFrame, 3000); };
    const stopRotate = () => { clearInterval(rotateInterval); };

    // Efficiency: pause on tab hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopRotate();
        else startRotate();
    });

    startRotate();
}

// ============================================
// SECTION FADE ANIMATIONS
// ============================================
function initFadeAnimations() {
    const fadeElements = document.querySelectorAll('.fade-section, .fade-scale, .fade-left, .fade-right');

    if (fadeElements.length === 0) return;

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -100px 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    fadeElements.forEach(el => observer.observe(el));
}

// Initialize fade animations
document.addEventListener('DOMContentLoaded', initFadeAnimations);




