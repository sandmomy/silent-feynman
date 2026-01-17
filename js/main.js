/**
 * Eugene Mierak Portfolio - Main JavaScript
 */

document.addEventListener('DOMContentLoaded', function () {
    initNavigation();
    initScrollEffects();
    initStatsAnimation();
    initHeroGlobe();
});

// ============================================
// Hero Globe (WebGL Earth)
// ============================================
function initHeroGlobe() {
    console.log('Initializing Hero Globe (HTML/SVG Markers)...');

    const globeContainer = document.getElementById('hero-globe');
    if (!globeContainer) return;

    // Countries with active projects (will be BLUE)
    const activeCountries = ['Indonesia', 'Nigeria', 'Kenya'];

    // Project locations
    const pointsData = [
        { lat: -6.2, lng: 106.8, name: 'Jakarta', color: '#ef4444' },
        { lat: -8.4, lng: 115.2, name: 'Bali', color: '#ef4444' },
        { lat: 9.0, lng: 8.0, name: 'Nigeria', color: '#ef4444' },
        { lat: -1.3, lng: 36.8, name: 'Kenya', color: '#ef4444' }
    ];

    // Ocean Texture (Blue)
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, 2, 2);
    const oceanTexture = canvas.toDataURL();

    // Initialize Globe
    const globe = Globe()
        .backgroundColor('rgba(0,0,0,0)')
        .globeImageUrl(oceanTexture)
        .width(440)
        .height(440)
        .showAtmosphere(true)
        .atmosphereColor('#48bb78')
        .atmosphereAltitude(0.12)

        // --- LAYER 1: HTML MARKERS (SVG Google Pins) ---
        // Using DOM Elements instead of 3D Meshes to bypass rendering bugs.
        .htmlElementsData(pointsData)
        .htmlLat('lat')
        .htmlLng('lng')
        .htmlAltitude(0.05)
        .htmlElement(d => {
            const el = document.createElement('div');
            el.className = 'globe-pin';
            // SVG Google Maps Pin
            el.innerHTML = `
                <svg viewBox="0 0 24 24" width="30" height="30" fill="${d.color}" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5)); display: block;">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    <circle cx="12" cy="9" r="2.5" fill="white"/>
                </svg>
            `;
            // Positioning: Center Bottom
            el.style.transform = 'translate(-50%, -100%)';
            el.style.pointerEvents = 'auto'; // Allow interaction
            el.style.cursor = 'pointer';

            el.onclick = () => alert(`Project Location: ${d.name}`);
            return el;
        });

    // Mount to DOM
    globe(globeContainer);

    // Initial View
    globe.pointOfView({ lat: 0, lng: 10, altitude: 2 });

    // Controls
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = -3.4;
    controls.enableZoom = false;

    // Interaction Logic: Pause on interaction, resume after 5s
    let resumeTimeout;

    controls.addEventListener('start', () => {
        clearTimeout(resumeTimeout);
        controls.autoRotate = false;
    });

    controls.addEventListener('end', () => {
        resumeTimeout = setTimeout(() => {
            controls.autoRotate = true;
        }, 5000); // 5 seconds wait
    });

    // Load Countries (Async)
    fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
        .then(res => res.json())
        .then(countries => {
            globe
                .polygonsData(countries.features)
                .polygonCapColor(d => {
                    const countryName = d.properties.ADMIN || d.properties.name;
                    return activeCountries.includes(countryName) ? '#4299e1' : '#48bb78';
                })
                .polygonSideColor(() => 'rgba(100, 100, 100, 0.3)')
                .polygonStrokeColor(() => '#1a365d')
                .polygonAltitude(0.01);
        })
        .catch(err => console.error('Error loading countries:', err));
}

// ============================================
// Navigation & Effects
// ============================================
function initNavigation() {
    const nav = document.querySelector('.nav');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.querySelector('.nav-links');
    if (!nav || !navToggle || !navLinks) return;

    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 50);
    });

    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        navToggle.textContent = navLinks.classList.contains('active') ? '✕' : '☰';
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
                navLinks.classList.remove('active');
                navToggle.textContent = '☰';
            }
        });
    });
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
    const stats = document.querySelector('.about-stats');
    if (!stats) return;
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            document.querySelectorAll('.stat-number').forEach(stat => {
                const target = +stat.dataset.count;
                let cur = 0, inc = target / 50;
                const t = setInterval(() => {
                    cur += inc;
                    if (cur >= target) { stat.textContent = target; clearInterval(t); }
                    else stat.textContent = Math.ceil(cur);
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
        // Wrap around
        if (index >= slides.length) index = 0;
        if (index < 0) index = slides.length - 1;
        currentIndex = index;

        // Update slides
        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });

        // Update dots
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }

    function nextSlide() {
        showSlide(currentIndex + 1);
    }

    // Auto-play every 4 seconds
    function startAutoPlay() {
        autoPlayInterval = setInterval(nextSlide, 4000);
    }

    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
    }

    // Click on dots
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            stopAutoPlay();
            showSlide(parseInt(dot.dataset.slide));
            startAutoPlay();
        });
    });

    // Pause on hover - detect on entire carousel area
    carousel.addEventListener('mouseenter', () => {
        stopAutoPlay();
        console.log('Carousel paused');
    });
    carousel.addEventListener('mouseleave', () => {
        startAutoPlay();
        console.log('Carousel resumed');
    });

    // Also pause when hovering on slides
    const carouselSlides = carousel.querySelectorAll('.carousel-slide');
    carouselSlides.forEach(slide => {
        slide.addEventListener('mouseenter', stopAutoPlay);
    });

    // Touch swipe support
    let touchStartX = 0;
    carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        stopAutoPlay();
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) nextSlide();
            else showSlide(currentIndex - 1);
        }
        startAutoPlay();
    }, { passive: true });

    // Start
    startAutoPlay();
}

// Initialize carousel on DOM ready
document.addEventListener('DOMContentLoaded', initEventCarousel);
