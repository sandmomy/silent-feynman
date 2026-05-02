(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const state = {
    session: null,
    profile: { email: null, name: null },
    catalog: [],
    library: [],
    view: "login",
    authTab: "signin",
  };

  const views = {
    login: $('.view-login'),
    catalog: $('.view-catalog'),
    library: $('.view-library'),
    account: $('.view-account'),
    book: $('.view-book'),
    bundle: $('.view-bundle'),
    reader: $('.view-reader'),
  };
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.eugenemierak.bookvoice';
  const PLAY_STORE_PUBLIC = false;
  const tabBar = $('#tabBar');
  const toast = $('#toast');

  // ── Analytics ──
  let _analyticsSid = null;
  function analyticsSid() {
    if (_analyticsSid) return _analyticsSid;
    try {
      _analyticsSid = sessionStorage.getItem('bv_analytics_sid');
      if (!_analyticsSid) {
        const b = new Uint8Array(16);
        crypto.getRandomValues(b);
        _analyticsSid = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem('bv_analytics_sid', _analyticsSid);
      }
    } catch {
      _analyticsSid = String(Date.now()) + Math.random().toString(36).slice(2, 10);
    }
    return _analyticsSid;
  }
  function trackAnalytics(eventType, opts) {
    try {
      const body = JSON.stringify({
        event_type: eventType,
        slug: opts?.slug || null,
        session_id: analyticsSid(),
        platform: 'mobile_web',
        metadata: opts?.metadata || undefined,
      });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/analytics/track', blob);
      } else {
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch { /* never throw */ }
  }

  // ── Toast ──
  let toastTimer = null;
  function showToast(msg, kind) {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast ' + (kind || '');
    toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 3400);
  }

  // ── Navigation ──
  function setView(name) {
    if (state.view === 'reader' && name !== 'reader') {
      const audio = $('#readerAudio');
      if (audio && !audio.paused) audio.pause();
    }
    state.view = name;
    for (const key in views) {
      if (!views[key]) continue;
      views[key].classList.toggle('hidden', key !== name);
    }
    if (name === 'login') {
      document.body.classList.add('on-login');
    } else {
      document.body.classList.remove('on-login');
    }
    // Dim the canvas field on content-heavy views so the editorial layout
    // can breathe. Keep it fully visible only on login + reader intro.
    const dimmedViews = ['catalog', 'library', 'account', 'book', 'bundle'];
    document.body.classList.toggle('scene-dimmed', dimmedViews.indexOf(name) !== -1);
    $$('.tab').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    tabBar.classList.toggle('hidden', name === 'login' || name === 'book' || name === 'reader');
    document.body.classList.toggle('reading', name === 'reader');
    try {
      if (name !== 'login' && name !== 'book' && name !== 'reader' && location.hash.slice(2) !== name) {
        history.replaceState(null, '', '#/' + name);
      }
    } catch (_) {}
  }

  // ── API helpers ──
  async function api(path, opts) {
    const res = await fetch(path, Object.assign({ credentials: 'include' }, opts || {}));
    const ct = res.headers.get('content-type') || '';
    let body = null;
    if (ct.includes('application/json')) {
      try { body = await res.json(); } catch (_) {}
    } else {
      try { body = await res.text(); } catch (_) {}
    }
    if (!res.ok) {
      const err = new Error((body && body.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  async function loadState() {
    try {
      state.session = await api('/api/session/status');
    } catch (_) {
      state.session = null;
    }
    try {
      const customer = await api('/api/customer/state');
      state.catalog = customer.catalog || [];
      state.library = customer.library || [];
      state.profile = { email: customer.email || null, name: customer.name || null };
    } catch (_) {
      state.catalog = [];
      state.library = [];
      state.profile = { email: null, name: null };
    }
  }

  // ── Rendering ──
  function renderAccount() {
    const name = state.profile?.name || state.session?.display_name || state.session?.username || 'Reader';
    const email = state.profile?.email || state.session?.username || '—';
    const nameEl = $('#accountName');
    const emailEl = $('#accountEmail');
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function bookCardHtml(book) {
    const title = escapeHtml(book.title || 'Untitled');
    const subtitle = escapeHtml(book.subtitle || book.description || '');
    const cover = book.cover_url || book.cover || '';
    const owned = isSlugOwned(book.slug);
    const hasAudio = !!book.has_audio;
    const priceLabel = book.price_label || (book.price_cents ? (book.price_cents / 100).toFixed(2) + '€' : '');

    const badges = [];
    if (owned) badges.push('<span class="badge badge-owned">In library</span>');
    if (!owned && priceLabel) badges.push('<span class="badge badge-price">' + escapeHtml(priceLabel) + '</span>');
    if (hasAudio) badges.push('<span class="badge badge-audio">Audio</span>');

    const coverHtml = cover
      ? '<img src="' + escapeHtml(cover) + '" alt="" loading="lazy" />'
      : '<div class="book-card-cover-fallback">' + escapeHtml((title[0] || 'B').toUpperCase()) + '</div>';

    return (
      '<button type="button" class="book-card" data-book-open="' + escapeHtml(book.slug) + '">' +
        '<div class="book-card-cover">' + coverHtml + '</div>' +
        '<div class="book-card-body">' +
          '<h3>' + title + '</h3>' +
          (subtitle ? '<p>' + subtitle + '</p>' : '') +
          (badges.length ? '<div class="book-card-meta">' + badges.join('') + '</div>' : '') +
        '</div>' +
      '</button>'
    );
  }

  // Roman numerals for I..XII — enough for the 8-chapter catalog + overflow.
  function toRoman(n) {
    const map = [['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
    let r = '';
    let x = Math.max(0, Math.floor(n));
    for (let i = 0; i < map.length; i++) {
      while (x >= map[i][1]) { r += map[i][0]; x -= map[i][1]; }
    }
    return r || 'I';
  }

  // Parse chapter number from slug "book_chapter_3" → 3, fallback to index+1.
  function chapterNumFromSlug(slug, fallbackIndex) {
    const m = String(slug || '').match(/chapter[_\s-]?(\d+)/i);
    return m ? parseInt(m[1], 10) : (fallbackIndex + 1);
  }

  // Strip "Chapter N -" prefix so titles read editorial in the TOC.
  function cleanChapterTitle(raw) {
    if (!raw) return '';
    const cleaned = String(raw).replace(/^Chapter\s+\d+\s*[-—–]\s*/i, '').trim();
    return cleaned || String(raw);
  }

  // Editorial TOC row: cover thumbnail, small Roman eyebrow, title, hook, price.
  function catalogTocRowHtml(book, index) {
    const num = chapterNumFromSlug(book.slug, index);
    // Arabic numerals instead of roman for clarity on mobile web.
    const label = String(num);
    const title = escapeHtml(cleanChapterTitle(book.title));
    const hook = escapeHtml(
      (book.public_profile && book.public_profile.hook) ||
      book.subtitle || book.description || ''
    );
    const owned = isSlugOwned(book.slug);
    const minutes = book.estimated_read_minutes || 0;
    const cover = book.cover_url || book.cover || '';
    const priceLabel =
      (book.public_profile && book.public_profile.priceLabel) ||
      book.price_label ||
      (book.price_cents ? '€' + (book.price_cents / 100).toFixed(0) : '€10');

    const coverHtml = cover
      ? '<img class="toc-cover-img" src="' + escapeHtml(cover) + '" alt="" loading="lazy" />'
      : '<span class="toc-cover-fallback">' + label + '</span>';

    const statusHtml = owned
      ? '<span class="toc-status owned" aria-label="In your library">In library</span>'
      : '<span class="toc-status price">' + escapeHtml(priceLabel) + '</span>';

    const eyebrowBits = ['Chapter ' + label];
    if (minutes) eyebrowBits.push(minutes + ' min');

    return (
      '<button type="button" class="toc-row" data-book-open="' + escapeHtml(book.slug) + '" ' +
        'aria-label="Chapter ' + label + ' — ' + title + '">' +
        '<span class="toc-cover" aria-hidden="true">' + coverHtml + '</span>' +
        '<div class="toc-body">' +
          '<span class="toc-eyebrow">' + escapeHtml(eyebrowBits.join(' · ')) + '</span>' +
          '<span class="toc-title">' + title + '</span>' +
          (hook ? '<span class="toc-hook">' + hook + '</span>' : '') +
        '</div>' +
        statusHtml +
      '</button>'
    );
  }

  // Bundle hero — animated offer at the top of the catalog, blends with the
  // editorial TOC below via a matching gold hairline.
  function catalogBundleHeroHtml() {
    const total = state.catalog.length || 8;
    if (!total) return '';
    const allOwned = state.catalog.every((b) => isSlugOwned(b.slug));
    if (allOwned) return '';
    const fullPrice = Math.round(total * 12);
    const savings = Math.max(0, fullPrice - 50);
    // Circular sigil (concentric rings + center dot) now anchored bottom-right;
    // the old figure-8 infinity mark has been retired.
    const ringsSvg =
      '<svg class="cbh-glyph cbh-glyph-rings" viewBox="0 0 80 80" aria-hidden="true">' +
        '<circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.4"/>' +
        '<circle cx="40" cy="40" r="20" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.55" stroke-dasharray="2 3"/>' +
        '<circle cx="40" cy="40" r="10" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.75"/>' +
        '<circle cx="40" cy="40" r="2.2" fill="currentColor" opacity="0.9"/>' +
      '</svg>';
    return (
      '<div class="catalog-bundle-hero" id="bundleCatalogBtn" role="button" tabindex="0" ' +
        'aria-label="Full book bundle, €50">' +
        '<div class="cbh-sheen" aria-hidden="true"></div>' +
        '<div class="cbh-content">' +
          '<span class="cbh-eyebrow">Best value &middot; Full book</span>' +
          '<h2 class="cbh-title">Unlock the complete reading</h2>' +
          '<p class="cbh-sub">Every chapter &middot; illustrated, narrated &amp; plain text &middot; lifetime access</p>' +
          '<div class="cbh-foot">' +
            '<div class="cbh-price">' +
              '<span class="cbh-strike">&euro;' + fullPrice + '</span>' +
              '<span class="cbh-total">&euro;50</span>' +
              '<span class="cbh-save">save &euro;' + savings + '</span>' +
            '</div>' +
            '<div class="cbh-cta-wrap">' +
              '<span class="cbh-cta">View offer &rarr;</span>' +
              ringsSvg +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // "La senda" — artistic vertical path. Big Roman numerals on the left,
  // gold thread down the middle (solid where walked, dotted ahead), tick
  // hairlines, sacred rosette ornament at the top.
  function librarySendaHtml() {
    const books = state.catalog.length ? state.catalog : state.library;
    if (!books || !books.length) return '';
    // Source of truth for ownership: presence in state.library (set by the
    // authenticated /api/customer endpoint). `catalog.has_access` is flaky
    // across re-auth — this is the field we trust elsewhere in the app.
    const ownedCount = books.filter((b) => isSlugOwned(b.slug)).length;
    const total = books.length;
    const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;

    // Sacred rosette ornament (small SVG) — purely decorative, at top of line
    const rosette = (
      '<svg class="senda-ornament" viewBox="0 0 40 40" aria-hidden="true">' +
        '<circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="0.7" opacity="0.5"/>' +
        '<circle cx="20" cy="20" r="6" fill="none" stroke="currentColor" stroke-width="0.7" opacity="0.7"/>' +
        '<circle cx="20" cy="20" r="1.5" fill="currentColor"/>' +
        '<line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" stroke-width="0.4" opacity="0.35"/>' +
        '<line x1="4" y1="20" x2="36" y2="20" stroke="currentColor" stroke-width="0.4" opacity="0.35"/>' +
        '<line x1="8.7" y1="8.7" x2="31.3" y2="31.3" stroke="currentColor" stroke-width="0.3" opacity="0.22"/>' +
        '<line x1="31.3" y1="8.7" x2="8.7" y2="31.3" stroke="currentColor" stroke-width="0.3" opacity="0.22"/>' +
      '</svg>'
    );

    // Track when we transition from walked → unwalked so the line changes texture
    let firstLockedReached = false;

    const stations = books.map((book, i) => {
      const num = chapterNumFromSlug(book.slug, i);
      // Arabic numerals on the senda path (not roman) for mobile clarity.
      const label = String(num);
      const title = escapeHtml(cleanChapterTitle(book.title));
      const owned = isSlugOwned(book.slug);
      const minutes = book.estimated_read_minutes || 5;
      const hasAudio = !!book.has_audio;
      const sState = owned ? 'owned' : 'locked';
      const meta = owned
        ? (hasAudio ? 'Read · Listen' : 'Read')
        : 'Locked';

      // The connector below each station — solid if we're still walking the
      // owned path, dotted from the first locked chapter onward.
      if (!owned && !firstLockedReached) firstLockedReached = true;
      const connectorClass = firstLockedReached ? 'senda-conn senda-conn-dotted' : 'senda-conn senda-conn-solid';
      const isLast = i === books.length - 1;

      return (
        '<div class="senda-station-wrap" data-state="' + sState + '">' +
          '<button type="button" class="senda-station" data-state="' + sState + '" ' +
            'data-book-open="' + escapeHtml(book.slug) + '">' +
            '<span class="senda-roman" data-state="' + sState + '" aria-hidden="true">' + label + '</span>' +
            '<span class="senda-axis" aria-hidden="true">' +
              '<span class="senda-dot" data-state="' + sState + '"></span>' +
              '<span class="senda-tick"></span>' +
            '</span>' +
            '<div class="senda-body">' +
              '<span class="senda-eyebrow">Movement ' + label + '</span>' +
              '<span class="senda-title">' + title + '</span>' +
              '<span class="senda-meta">' + escapeHtml(meta) + '</span>' +
            '</div>' +
          '</button>' +
          (isLast ? '' : '<span class="' + connectorClass + '" aria-hidden="true"></span>') +
        '</div>'
      );
    }).join('');

    return (
      '<div class="senda">' +
        '<div class="senda-head">' +
          '<span class="senda-ornament-wrap" aria-hidden="true">' + rosette + '</span>' +
          '<div class="senda-head-body">' +
            '<span class="senda-head-eyebrow">Your path</span>' +
            '<span class="senda-head-count">' + ownedCount + ' of ' + total + ' movements &middot; ' + pct + '%</span>' +
          '</div>' +
        '</div>' +
        '<span class="senda-conn senda-conn-head" aria-hidden="true"></span>' +
        stations +
      '</div>'
    );
  }

  // Bundle offer card — flat €50 grants every unowned chapter (same
  // /api/customer/bundle/checkout the desktop uses).
  function bundleCardHtml() {
    const total = state.catalog.length;
    if (!total) return '';
    const fullPrice = Math.round(total * 11.99);
    const savings = Math.max(0, fullPrice - 50);
    // Don't show the bundle if the user already owns everything
    const owned = state.catalog.every((b) => isSlugOwned(b.slug));
    if (owned) return '';
    return (
      '<button type="button" class="bundle-card" id="bundleCatalogBtn">' +
        '<span class="bundle-card-badge">Best value</span>' +
        '<span class="bundle-card-title">Unlock the full book</span>' +
        '<span class="bundle-card-sub">All ' + total + ' chapters &middot; save &euro;' + savings + '</span>' +
        '<span class="bundle-card-price">' +
          '<span class="bundle-card-strike">&euro;' + fullPrice + '</span>' +
          '<span class="bundle-card-total">&euro;50</span>' +
        '</span>' +
      '</button>'
    );
  }

  // Catalog card click → open the bundle detail screen (not straight to Stripe)
  function openBundleDetail() {
    // Populate dynamic price numbers based on current catalog
    const total = state.catalog.length || 8;
    const fullPrice = Math.round(total * 11.99);
    const savings = Math.max(0, fullPrice - 50);
    const strike = $('#bundleDetailStrike');
    const save = $('#bundleDetailSave');
    if (strike) strike.innerHTML = '&euro;' + fullPrice;
    if (save) save.innerHTML = 'save &euro;' + savings;
    setView('bundle');
  }

  async function handleBundleCheckout() {
    const btn = $('#bundleDetailCta');
    if (btn) {
      btn.setAttribute('disabled', 'true');
      btn.textContent = 'Opening secure checkout…';
    }
    try {
      const res = await api('/api/customer/bundle/checkout', { method: 'POST' });
      if (res && res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = 'Complete purchase &middot; &euro;50';
      }
      renderNotice(err && err.message ? err.message : 'Bundle checkout failed', 'error');
    }
  }

  function renderCatalog() {
    const list = $('#catalogList');
    if (!list) return;
    trackAnalytics('view_catalog');
    if (!state.catalog.length) {
      list.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">' +
            '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M19 2H8a2 2 0 0 0-2 2v14a3 3 0 0 0 3 3h10V4a2 2 0 0 0-2-2Zm-1 17H9a1 1 0 0 1 0-2h9Zm-2-9h-5V4h5Z"/></svg>' +
          '</div>' +
          '<h3>No chapters available yet</h3>' +
          '<p>New chapters by Eugene Mierak will appear here.</p>' +
        '</div>';
      return;
    }
    // Bundle hero at top + editorial table-of-contents below
    const rows = state.catalog.map((b, i) => catalogTocRowHtml(b, i)).join('');
    list.innerHTML = catalogBundleHeroHtml() + '<div class="toc">' + rows + '</div>';
    const bbtn = $('#bundleCatalogBtn');
    if (bbtn) {
      bbtn.addEventListener('click', openBundleDetail);
      bbtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBundleDetail(); }
      });
    }
    const dbtn = $('#bundleDetailCta');
    if (dbtn && !dbtn.dataset.bound) {
      dbtn.dataset.bound = '1';
      dbtn.addEventListener('click', handleBundleCheckout);
    }
  }

  function renderLibrary() {
    const list = $('#libraryList');
    if (!list) return;
    if (!state.catalog.length) {
      list.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">' +
            '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2 4v8l4-2 4 2V8Z"/></svg>' +
          '</div>' +
          '<h3>No chapters yet</h3>' +
          '<p>Chapters you buy will appear here. Browse the catalog to start reading.</p>' +
          '<button class="btn btn-primary" type="button" data-go-tab="catalog">Browse catalog</button>' +
        '</div>';
      return;
    }
    // "La senda" — vertical gold path with a station per chapter
    list.innerHTML = librarySendaHtml();
  }

  // ── Auth forms ──
  function setAuthTab(which) {
    state.authTab = which;
    $$('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-auth-tab') === which);
    });
    $('#formSignin').classList.toggle('hidden', which !== 'signin');
    $('#formRegister').classList.toggle('hidden', which !== 'register');
  }

  async function handleSignin(form) {
    const fd = new FormData(form);
    const username = (fd.get('username') || '').toString().trim();
    const password = (fd.get('password') || '').toString();
    if (!username || !password) {
      showToast('Enter email and password.', 'error');
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await api('/api/session/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      await loadState();
      renderAccount();
      renderCatalog();
      renderLibrary();
      const pendingHash = location.hash.slice(2);
      if (pendingHash && (pendingHash.startsWith('book/') || pendingHash.startsWith('read/'))) {
        hashRoute();
      } else {
        setView('catalog');
      }
    } catch (err) {
      const msg = err.body?.error === 'Incorrect credentials.'
        ? 'Email or password is incorrect.'
        : (err.status === 429 ? 'Too many attempts. Wait a few minutes.' : (err.message || 'Sign in failed.'));
      showToast(msg, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function handleRegister(form) {
    const fd = new FormData(form);
    const display_name = (fd.get('display_name') || '').toString().trim();
    const email = (fd.get('email') || '').toString().trim();
    const password = (fd.get('password') || '').toString();
    const accepts = $('#acceptTerms')?.checked;
    if (!accepts) {
      showToast('Accept the Terms to create your account.', 'error');
      return;
    }
    if (!email.includes('@') || password.length < 8) {
      showToast('Check your email and password (min 8 characters).', 'error');
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await api('/api/session/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name, email, password }),
      });
      await loadState();
      renderAccount();
      renderCatalog();
      renderLibrary();
      const pendingHash = location.hash.slice(2);
      if (pendingHash && (pendingHash.startsWith('book/') || pendingHash.startsWith('read/'))) {
        hashRoute();
      } else {
        setView('catalog');
      }
      showToast('Welcome! Check your email to verify your account.', 'success');
    } catch (err) {
      const code = err.body?.error;
      const messages = {
        'invalid_email': 'Enter a valid email.',
        'weak_password': 'Password must be at least 8 characters.',
        'email_already_registered': 'That email is already registered. Try signing in.',
        'registration_disabled': 'Registration is not open right now.',
      };
      showToast(messages[code] || err.message || 'Could not create your account.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function findBook(slug) {
    return state.library.find((b) => b.slug === slug) || state.catalog.find((b) => b.slug === slug) || null;
  }

  function isSlugOwned(slug) {
    return !!(state.library && state.library.some((b) => b.slug === slug));
  }

  function appSuggestionHtml(ctx) {
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const owned = !!(ctx && ctx.owned);
    const justPurchased = !!(ctx && ctx.justPurchased);
    if (isAndroid && PLAY_STORE_PUBLIC) {
      // Owned-chapter variant — subtle nudge to open in the app instead.
      if (owned) {
        const headline = justPurchased
          ? 'Chapter unlocked — continue in the app'
          : 'Your chapters live in the BookVoice app';
        const body = justPurchased
          ? 'It will open the moment you install.'
          : 'Page-flip, offline reading, narrated audio — built for reading.';
        return '<div class="app-suggestion app-suggestion-owned">' +
          '<div class="app-suggestion-icon">' +
            '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.54-.54L16.9 9.12a11.43 11.43 0 0 0-9.8 0L5.24 5.76a.4.4 0 0 0-.54.54L6.4 9.48A10.81 10.81 0 0 0 1 18h22a10.81 10.81 0 0 0-5.4-8.52Z"/></svg>' +
          '</div>' +
          '<div class="app-suggestion-body">' +
            '<strong>' + escapeHtml(headline) + '</strong>' +
            '<p>' + escapeHtml(body) + '</p>' +
          '</div>' +
          '<a class="app-suggestion-cta" href="' + PLAY_STORE_URL + '" target="_blank" rel="noopener">Open app</a>' +
        '</div>';
      }
      return '<div class="app-suggestion">' +
        '<div class="app-suggestion-icon">' +
          '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.54-.54L16.9 9.12a11.43 11.43 0 0 0-9.8 0L5.24 5.76a.4.4 0 0 0-.54.54L6.4 9.48A10.81 10.81 0 0 0 1 18h22a10.81 10.81 0 0 0-5.4-8.52ZM7 15.25a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 7 15.25Zm10 0a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 17 15.25Z"/></svg>' +
        '</div>' +
        '<div class="app-suggestion-body">' +
          '<strong>Read even better in the app</strong>' +
          '<p>Smoother page flip, integrated audio, offline reading.</p>' +
        '</div>' +
        '<a class="app-suggestion-cta" href="' + PLAY_STORE_URL + '" target="_blank" rel="noopener">Get app</a>' +
      '</div>';
    }
    if (isAndroid) {
      return '<div class="app-suggestion">' +
        '<div class="app-suggestion-icon">' +
          '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.54-.54L16.9 9.12a11.43 11.43 0 0 0-9.8 0L5.24 5.76a.4.4 0 0 0-.54.54L6.4 9.48A10.81 10.81 0 0 0 1 18h22a10.81 10.81 0 0 0-5.4-8.52ZM7 15.25a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 7 15.25Zm10 0a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 17 15.25Z"/></svg>' +
        '</div>' +
        '<div class="app-suggestion-body">' +
          '<strong>Android app coming soon</strong>' +
          '<p>We are polishing the native reader. Meanwhile, the web is fully featured.</p>' +
        '</div>' +
      '</div>';
    }
    if (isIos) {
      return '<div class="app-suggestion">' +
        '<div class="app-suggestion-icon">' +
          '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M16.37 12.13a3.36 3.36 0 0 1 1.58-2.79 3.36 3.36 0 0 0-2.64-1.43c-1.12-.11-2.2.66-2.76.66s-1.45-.64-2.4-.62A3.51 3.51 0 0 0 7.1 9.74c-1.26 2.19-.32 5.43.9 7.21.6.87 1.32 1.85 2.26 1.81s1.26-.58 2.36-.58 1.41.58 2.37.57c.98-.02 1.6-.89 2.2-1.76Z"/></svg>' +
        '</div>' +
        '<div class="app-suggestion-body">' +
          '<strong>Install on your Home Screen</strong>' +
          '<p>Tap Share in Safari, then Add to Home Screen for a full-screen app.</p>' +
        '</div>' +
        '<button type="button" class="app-suggestion-cta" data-show-ios-modal>Steps</button>' +
      '</div>';
    }
    return '';
  }

  async function renderBookDetail(slug, opts) {
    const wrap = $('#bookDetail');
    if (!wrap) return;
    trackAnalytics('view_book', { slug });
    const book = findBook(slug);
    if (!book) {
      wrap.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">' +
            '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"/></svg>' +
          '</div>' +
          '<h3>Chapter not found</h3>' +
          '<p>This chapter may not be published yet.</p>' +
          '<button class="btn btn-primary" type="button" data-go-tab="catalog">Back to catalog</button>' +
        '</div>';
      return;
    }
    const title = escapeHtml(book.title || 'Untitled');
    const subtitle = escapeHtml(book.subtitle || '');
    const desc = escapeHtml(book.description || '');
    const cover = book.cover_url || book.cover || '';
    const owned = isSlugOwned(slug);
    const hasAudio = !!book.has_audio;
    const priceLabel = book.price_label || (book.price_cents ? (book.price_cents / 100).toFixed(2) + '€' : '');

    const badges = [];
    if (owned) badges.push('<span class="badge badge-owned">In library</span>');
    if (!owned && priceLabel) badges.push('<span class="badge badge-price">' + escapeHtml(priceLabel) + '</span>');
    if (hasAudio) badges.push('<span class="badge badge-audio">Audio included</span>');

    const coverHtml = cover
      ? '<img src="' + escapeHtml(cover) + '" alt="" />'
      : '<div class="book-card-cover-fallback">' + escapeHtml((title[0] || 'B').toUpperCase()) + '</div>';

    const isAndroid = /android/i.test(navigator.userAgent);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const readBtn = '<button class="btn btn-primary" type="button" data-read="' + escapeHtml(book.slug) + '"><span>Read chapter</span><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 6l6 6-6 6"/></svg></button>';
    let action;
    if (!owned) {
      action = '<button class="btn btn-primary" type="button" data-buy="' + escapeHtml(book.slug) + '"><span>Buy now</span><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 14h-2v-6h2Zm0-8h-2V6h2Z"/></svg></button>';
    } else if (isAndroid && PLAY_STORE_PUBLIC) {
      const intentUrl = 'intent://library/' + encodeURIComponent(book.slug) + '#Intent;scheme=https;package=com.eugenemierak.bookvoice;S.browser_fallback_url=' + encodeURIComponent(PLAY_STORE_URL) + ';end';
      action = '<a class="btn btn-primary" href="' + intentUrl + '"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.54-.54L16.9 9.12a11.43 11.43 0 0 0-9.8 0L5.24 5.76a.4.4 0 0 0-.54.54L6.4 9.48A10.81 10.81 0 0 0 1 18h22a10.81 10.81 0 0 0-5.4-8.52Z"/></svg><span>Open in BookVoice app</span></a>' +
        '<button class="btn btn-text" type="button" data-read="' + escapeHtml(book.slug) + '" style="margin-top:6px">Read in browser instead</button>';
    } else if (isAndroid) {
      action = readBtn +
        '<p class="platform-note">Android app launching on Play Store soon — will open here automatically.</p>';
    } else if (isIos && isStandalone) {
      action = readBtn;
    } else if (isIos) {
      action = readBtn +
        '<p class="platform-note">Tip: add BookVoice to your Home Screen for a full-screen reading app. <button type="button" class="link-muted" data-show-ios-modal>Show me how</button></p>';
    } else {
      action = readBtn;
    }

    const showAppHint = opts?.justPurchased || (owned && !sessionStorage.getItem('app_hint_dismissed_' + slug));
    wrap.innerHTML =
      (opts?.justPurchased ? '<div class="purchase-success-banner">✓ Chapter added to your library</div>' : '') +
      '<div class="book-detail-cover">' + coverHtml + '</div>' +
      '<h1 class="book-detail-title">' + title + '</h1>' +
      (subtitle ? '<p class="book-detail-sub">' + subtitle + '</p>' : '') +
      (badges.length ? '<div class="book-detail-badges">' + badges.join('') + '</div>' : '') +
      (desc ? '<p class="book-detail-desc">' + desc + '</p>' : '') +
      '<div class="book-detail-actions">' + action + '</div>' +
      (showAppHint ? appSuggestionHtml({ owned: owned, justPurchased: !!opts?.justPurchased }) : '');
  }

  let pdfLibPromise = null;
  function loadPdfLib() {
    if (!pdfLibPromise) {
      pdfLibPromise = import('/pdf.legacy.min.mjs').then((mod) => {
        const lib = mod.default || mod;
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.legacy.min.mjs';
        return lib;
      });
    }
    return pdfLibPromise;
  }

  const renderedReaders = {};
  const readerState = { slug: null, variant: 'pdf', slidesAvailable: false };

  async function renderPdfToContainer(variant, slug, wrap) {
    const renderToken = (renderedReaders[slug] = (renderedReaders[slug] || 0) + 1);
    const pdfUrl = '/api/customer/books/' + encodeURIComponent(slug) + '/' + variant;
    wrap.innerHTML =
      '<div class="reader-loading">' +
        '<div class="reader-spinner"></div>' +
        '<span>Loading ' + (variant === 'slides' ? 'slides' : 'chapter') + '…</span>' +
      '</div>';
    try {
      const pdfLib = await loadPdfLib();
      if (renderedReaders[slug] !== renderToken) return;
      const doc = await pdfLib.getDocument({ url: pdfUrl, withCredentials: true }).promise;
      if (renderedReaders[slug] !== renderToken) return;

      wrap.innerHTML = '<div class="pdf-pages" id="pdfPages"></div>';
      const container = $('#pdfPages');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewportWidth = wrap.clientWidth || window.innerWidth;

      for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
        if (renderedReaders[slug] !== renderToken) return;
        const page = await doc.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = (viewportWidth / baseViewport.width) * dpr;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page';
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();
      }
    } catch (err) {
      if (renderedReaders[slug] !== renderToken) return;
      wrap.innerHTML =
        '<div class="reader-loading">' +
          '<svg viewBox="0 0 24 24" width="36" height="36" style="color:#f87171"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"/></svg>' +
          '<strong>Could not load this ' + (variant === 'slides' ? 'slides file' : 'chapter') + '</strong>' +
          '<span>' + escapeHtml(err?.message || 'Unknown error') + '</span>' +
          '<a class="btn btn-primary" style="width:auto;padding:10px 18px;margin-top:8px" href="' + pdfUrl + '" target="_blank" rel="noopener">Open PDF directly</a>' +
        '</div>';
    }
  }

  function setupReaderAudio(book, slug) {
    const audio = $('#readerAudio');
    const btn = $('#readerAudioBtn');
    if (!audio || !btn) return;
    if (!book || !book.has_audio) {
      btn.classList.add('hidden');
      audio.pause();
      audio.src = '';
      return;
    }
    btn.classList.remove('hidden');
    const audioUrl = '/api/customer/books/' + encodeURIComponent(slug) + '/audio';
    if (audio.getAttribute('data-src') !== audioUrl) {
      audio.pause();
      audio.setAttribute('data-src', audioUrl);
      audio.src = audioUrl;
      audio.load();
    }
    const iconPlay = btn.querySelector('.icon-play');
    const iconPause = btn.querySelector('.icon-pause');
    const syncIcon = () => {
      if (!audio.paused) {
        if (iconPlay) iconPlay.style.display = 'none';
        if (iconPause) iconPause.style.display = '';
        btn.classList.add('playing');
      } else {
        if (iconPlay) iconPlay.style.display = '';
        if (iconPause) iconPause.style.display = 'none';
        btn.classList.remove('playing');
      }
    };
    audio.onplay = syncIcon;
    audio.onpause = syncIcon;
    audio.onended = syncIcon;
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (audio.paused) {
        audio.play().catch(() => showToast('Could not play audio.', 'error'));
      } else {
        audio.pause();
      }
    };
    syncIcon();
  }

  async function setupReaderVariantTabs(book, slug) {
    const tabsEl = $('#readerVariantTabs');
    if (!tabsEl) return;
    const hasSlides = !!(book && book.has_slides);
    readerState.slidesAvailable = hasSlides;
    // Always show the variant tabs now that we have a "Text" mode available
    // for every chapter. If there are no slides, we still show Chapter + Text.
    tabsEl.classList.remove('hidden');
    // Hide the Slides tab specifically when slides aren't available
    const slidesTab = tabsEl.querySelector('[data-variant="slides"]');
    if (slidesTab) slidesTab.classList.toggle('hidden', !hasSlides);

    $$('#readerVariantTabs .variant-tab').forEach((t) => {
      t.classList.toggle('active', t.getAttribute('data-variant') === readerState.variant);
      t.onclick = async () => {
        const next = t.getAttribute('data-variant');
        if (next === readerState.variant) return;
        readerState.variant = next;
        $$('#readerVariantTabs .variant-tab').forEach((b) =>
          b.classList.toggle('active', b === t)
        );
        const wrap = $('#readerFrameWrap');
        const textPane = $('#readerTextPane');
        if (next === 'text') {
          if (wrap) wrap.classList.add('hidden');
          if (textPane) {
            textPane.classList.remove('hidden');
            await renderTextToPane(slug, textPane);
          }
        } else {
          if (textPane) textPane.classList.add('hidden');
          if (wrap) {
            wrap.classList.remove('hidden');
            await renderPdfToContainer(next, slug, wrap);
          }
        }
      };
    });
  }

  // Fetch + render the plain-text variant of a chapter
  const textCacheMobile = Object.create(null);
  async function renderTextToPane(slug, pane) {
    if (!pane) return;
    pane.innerHTML = '<div class="reader-loading"><div class="reader-spinner"></div><span>Loading text…</span></div>';
    let raw = textCacheMobile[slug];
    if (!raw) {
      try {
        const res = await fetch('/api/customer/books/' + encodeURIComponent(slug) + '/text', {
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error('not_available');
        raw = await res.text();
        textCacheMobile[slug] = raw;
      } catch (err) {
        pane.innerHTML = '<p class="reader-text-empty">Text view not available for this chapter.</p>';
        return;
      }
    }
    // Split paragraphs: prefer double-newline; fall back to single-newline
    const doubleSplit = raw.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
    const paras = doubleSplit.length > 3
      ? doubleSplit
      : raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);

    // Extract first line as title if it looks like a heading
    let title = '';
    let body = paras;
    if (paras.length && paras[0].length < 90 && !/[.!?]$/.test(paras[0])) {
      title = paras[0];
      body = paras.slice(1);
    }
    const html =
      '<div class="reader-text-inner">' +
      (title ? '<h2>' + escapeHtml(title) + '</h2>' : '') +
      body.map((p) => '<p>' + escapeHtml(p) + '</p>').join('') +
      '</div>';
    pane.innerHTML = html;
    pane.scrollTop = 0;
  }

  // Reader entry: mount reader IMMEDIATELY (PDF/text start loading) but keep
  // it invisible while the canvas inhales + editorial beat plays. When the
  // intro finishes the reader is already warm — no loader flicker.
  let readerEntryInFlight = false;
  function openReaderWithEntry(slug) {
    if (readerEntryInFlight) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvasInhale = typeof window.__bookvoiceFieldInhale === 'function'
      ? window.__bookvoiceFieldInhale : null;
    const beat = document.getElementById('readerEntryBeat');
    if (reduced || !canvasInhale) {
      setView('reader');
      renderReader(slug);
      return;
    }

    // Populate editorial beat card
    const book = findBook(slug);
    const rawTitle = (book && book.title) || 'Chapter';
    const cleanTitle = rawTitle.replace(/^Chapter\s+\d+\s*[-—–]\s*/i, '').trim() || rawTitle;
    const chapterMatch = rawTitle.match(/Chapter\s+(\d+)/i);
    const chapterLabel = chapterMatch ? 'Chapter ' + chapterMatch[1].padStart(2, '0') : 'Frequency Vibes';
    const titleEl = document.getElementById('readerBeatTitle');
    const eyebrowEl = document.getElementById('readerBeatEyebrow');
    if (titleEl) titleEl.textContent = cleanTitle;
    if (eyebrowEl) eyebrowEl.textContent = chapterLabel;

    readerEntryInFlight = true;

    // Inject rising particles (native v7.4 feel) — 16 gold dots at random x
    // along the bottom 40% of the viewport, with staggered delays.
    const particles = beat ? beat.querySelector('.rb-particles') : null;
    if (particles) {
      particles.innerHTML = '';
      for (let i = 0; i < 16; i++) {
        const p = document.createElement('span');
        p.className = 'rb-particle';
        const size = 2 + Math.random() * 1.8;
        p.style.left = (Math.random() * 100) + '%';
        p.style.top = (55 + Math.random() * 35) + '%';
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.animationDelay = (100 + Math.random() * 1400) + 'ms';
        particles.appendChild(p);
      }
    }

    // Pre-mount the reader so PDF/text start loading during the intro.
    // Held invisibly with .intro-hold — revealed AFTER content is ready.
    setView('reader');
    const readerView = document.querySelector('.view-reader');
    if (readerView) readerView.classList.add('intro-hold');

    // Kick off PDF/text load in the background — reveal happens at REVEAL_AT.
    renderReader(slug).catch(() => {});

    const INHALE = 750;
    const HOLD   = 1500;
    const EXHALE = 650;
    const EXPAND = 700;                    // overshoot outward at the end
    const REVEAL_AT = INHALE + HOLD + EXHALE; // reader fades in as canvas expands
    const TOTAL  = REVEAL_AT + EXPAND;

    if (beat) {
      beat.classList.remove('is-showing');
      void beat.offsetWidth;
      beat.classList.add('is-showing');
      setTimeout(() => beat.classList.remove('is-showing'), 2700);
    }

    const t0 = performance.now();
    let revealed = false;

    function reveal() {
      if (revealed || !readerView) return;
      revealed = true;
      // CSS transition on .view-reader handles the fade — no animation class.
      readerView.classList.remove('intro-hold');
    }

    function frame(now) {
      const t = now - t0;
      let phase;
      if (t < INHALE) {
        phase = easeInOut(t / INHALE);
      } else if (t < INHALE + HOLD) {
        phase = 1;
      } else if (t < REVEAL_AT) {
        phase = 1 - easeInOut((t - INHALE - HOLD) / EXHALE);
      } else if (t < TOTAL) {
        // Overshoot outward — scene breathes past normal, then settles
        const p = (t - REVEAL_AT) / EXPAND;
        phase = -Math.sin(p * Math.PI);      // 0 → -1 → 0
      } else {
        phase = 0;
      }
      canvasInhale(phase);

      // Reveal at the moment the canvas hits normal size, right before the
      // outward breath — the reader fades in while the field expands behind.
      if (!revealed && t >= REVEAL_AT) reveal();

      if (t < TOTAL) requestAnimationFrame(frame);
      else {
        canvasInhale(0);
        readerEntryInFlight = false;
      }
    }
    requestAnimationFrame(frame);
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  async function renderReader(slug) {
    trackAnalytics('reader_opened', { slug });
    const book = findBook(slug);
    const title = (book && book.title) || 'Chapter';
    const titleEl = $('#readerTitle');
    if (titleEl) titleEl.textContent = title;

    readerState.slug = slug;
    readerState.variant = 'pdf';

    setupReaderAudio(book, slug);
    await setupReaderVariantTabs(book, slug);

    const wrap = $('#readerFrameWrap');
    if (!wrap) return;
    await renderPdfToContainer('pdf', slug, wrap);
    maybeShowReaderOnboarding();
  }

  function maybeShowReaderOnboarding() {
    try {
      if (localStorage.getItem('bv_reader_onboarded') === '1') return;
    } catch { return; }
    const modal = $('#readerOnboardModal');
    if (!modal) return;
    setReaderOnboardStep(0);
    setTimeout(() => {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }, 600);
  }

  function setReaderOnboardStep(step) {
    const modal = $('#readerOnboardModal');
    if (!modal) return;
    modal.dataset.step = String(step);
    $$('.reader-onboard-step', modal).forEach((el) => {
      el.classList.toggle('is-active', Number(el.getAttribute('data-step')) === step);
    });
    $$('.reader-onboard-dot', modal).forEach((el) => {
      el.classList.toggle('is-active', Number(el.getAttribute('data-step-dot')) === step);
    });
    const nextBtn = $('#readerOnboardNext');
    if (nextBtn) nextBtn.textContent = step >= 2 ? 'Got it' : 'Next';
  }

  function dismissReaderOnboarding() {
    const modal = $('#readerOnboardModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    try { localStorage.setItem('bv_reader_onboarded', '1'); } catch {}
  }

  function advanceReaderOnboarding() {
    const modal = $('#readerOnboardModal');
    if (!modal) return;
    const current = Number(modal.dataset.step || '0');
    if (current >= 2) {
      dismissReaderOnboarding();
      return;
    }
    setReaderOnboardStep(current + 1);
  }

  async function handleBuyBook(slug) {
    if (!state.session || !state.session.authenticated) {
      setView('login');
      showToast('Sign in to buy this chapter.', 'error');
      return;
    }
    trackAnalytics('click_buy', { slug });
    try {
      const result = await api('/api/customer/books/' + encodeURIComponent(slug) + '/checkout?mobile=1', { method: 'POST' });
      if (result && result.url) {
        trackAnalytics('checkout_start', { slug });
        window.location.href = result.url;
        return;
      }
      showToast('Could not start checkout.', 'error');
    } catch (err) {
      showToast(err.message || 'Checkout failed.', 'error');
    }
  }

  async function confirmPurchase(slug, stripeSession) {
    setView('book');
    const wrap = $('#bookDetail');
    if (wrap) {
      wrap.innerHTML =
        '<div class="purchase-confirming">' +
          '<div class="reader-spinner"></div>' +
          '<h3>Finalizing your purchase…</h3>' +
          '<p>Unlocking the chapter. One moment.</p>' +
        '</div>';
    }
    let attempts = 0;
    const maxAttempts = 6;
    const delayMs = 1200;
    while (attempts < maxAttempts) {
      try {
        const url = '/api/customer/books/' + encodeURIComponent(slug) + '/confirm' + (stripeSession ? '?stripe_session=' + encodeURIComponent(stripeSession) : '');
        const result = await api(url);
        if (result && result.owned) {
          await loadState();
          renderCatalog();
          renderLibrary();
          history.replaceState(null, '', '/#/book/' + encodeURIComponent(slug));
          setView('book');
          renderBookDetail(slug, { justPurchased: true });
          showPurchaseReceipt(slug);
          return;
        }
      } catch (_) {}
      attempts += 1;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    if (wrap) {
      wrap.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">' +
            '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"/></svg>' +
          '</div>' +
          '<h3>Still processing</h3>' +
          '<p>Your payment is being verified. Refresh the catalog in a minute — if the chapter is not unlocked, contact support.</p>' +
          '<button class="btn btn-primary" type="button" data-go-tab="catalog">Back to catalog</button>' +
        '</div>';
    }
  }

  function showPurchaseReceipt(slug) {
    const overlay = $('#purchaseReceiptOverlay');
    if (!overlay) return;
    const book = state.catalog?.find((b) => b.slug === slug) || state.library?.find((b) => b.slug === slug);
    const chapterEl = $('#mReceiptChapter');
    const amountEl = $('#mReceiptAmount');
    const coverImg = $('#mReceiptCoverImg');
    const quoteEl = $('#mReceiptQuote');
    const name = state.session?.display_name || state.session?.username || '';

    if (chapterEl) chapterEl.textContent = book?.title || slug;
    if (amountEl) {
      const price = book?.public_profile?.price_label || book?.price_label || '€11.99';
      amountEl.textContent = price;
    }
    if (coverImg) {
      coverImg.src = '/covers/frequency-vibes.jpg';
      coverImg.alt = book ? `${book.title} cover` : 'Chapter cover';
    }
    if (quoteEl) {
      quoteEl.textContent = name
        ? `Thank you, ${name}. Your library has grown. Open the chapter whenever you're ready.`
        : `Your library has grown. Open the chapter whenever you're ready.`;
    }
    overlay.dataset.slug = slug || '';
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    trackAnalytics('purchase_success', { slug });
  }

  function hidePurchaseReceipt() {
    const overlay = $('#purchaseReceiptOverlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function hidePurchaseReceiptAndRead() {
    const overlay = $('#purchaseReceiptOverlay');
    const slug = overlay?.dataset?.slug || '';
    hidePurchaseReceipt();
    if (slug) {
      history.replaceState(null, '', '/#/read/' + encodeURIComponent(slug));
      openReaderWithEntry(slug);
    }
  }

  function hidePurchaseReceiptAndGoLibrary() {
    hidePurchaseReceipt();
    history.replaceState(null, '', '/#/library');
    setView('library');
    renderLibrary();
  }

  function openProfileModal() {
    const modal = $('#profileModal');
    if (!modal) return;
    $('#profileDisplayName').value = state.session?.display_name || state.session?.username || '';
    $('#profileEmail').value = state.profile?.email || '';
    const msg = $('#profileMessage');
    if (msg) { msg.className = 'profile-message hidden'; msg.textContent = ''; }
    $('#profilePasswordForm')?.reset();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeProfileModal() {
    const modal = $('#profileModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  function showProfileMessage(text, kind) {
    const msg = $('#profileMessage');
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'profile-message ' + (kind || 'info');
  }
  async function handleProfileEdit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      display_name: String(form.get('display_name') || '').trim(),
      email: String(form.get('email') || '').trim(),
    };
    try {
      const res = await api('/api/customer/me', { method: 'PATCH', body: JSON.stringify(payload) });
      if (res?.requires_reverify) {
        showProfileMessage('Profile saved. Check your new email for a verification link.', 'success');
      } else if (res?.updated) {
        showProfileMessage('Profile saved.', 'success');
      } else {
        showProfileMessage('No changes.', 'info');
      }
      await loadState();
      renderAccount();
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('email_in_use')) showProfileMessage('That email is already in use.', 'error');
      else if (msg.includes('invalid_email')) showProfileMessage('That email looks invalid.', 'error');
      else showProfileMessage('Could not save. Try again.', 'error');
    }
  }
  async function handlePasswordChange(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      current_password: String(form.get('current_password') || ''),
      new_password: String(form.get('new_password') || ''),
    };
    if (payload.new_password.length < 8) {
      showProfileMessage('New password must be at least 8 characters.', 'error');
      return;
    }
    try {
      await api('/api/customer/change-password', { method: 'POST', body: JSON.stringify(payload) });
      showProfileMessage('Password updated. You will need to sign in again.', 'success');
      setTimeout(() => { handleSignOut(); }, 1800);
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('wrong_password')) showProfileMessage('Current password is wrong.', 'error');
      else if (msg.includes('oauth_account')) showProfileMessage('This account uses Google Sign-In. Password change is not applicable.', 'error');
      else showProfileMessage('Could not update password.', 'error');
    }
  }

  async function handleSignOut() {
    try {
      await api('/api/session/logout', { method: 'POST' });
    } catch (_) {}
    state.session = null;
    state.library = [];
    setView('login');
    showToast('Signed out.', 'success');
  }

  // ── Routing ──
  function hashRoute() {
    const h = location.hash.slice(2);
    if (!state.session || !state.session.authenticated) {
      setView('login');
      return;
    }
    if (h.startsWith('book/')) {
      const slug = decodeURIComponent(h.slice(5));
      setView('book');
      renderBookDetail(slug);
      return;
    }
    if (h.startsWith('read/')) {
      const slug = decodeURIComponent(h.slice(5));
      openReaderWithEntry(slug);
      return;
    }
    const want = ['catalog', 'library', 'account'].includes(h) ? h : 'catalog';
    setView(want);
  }

  function openIosModal() {
    const m = $('#iosInstallModal');
    if (m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  }
  function closeIosModal() {
    const m = $('#iosInstallModal');
    if (m) { m.classList.add('hidden'); document.body.style.overflow = ''; }
  }

  function configureAppLinks() {
    const androidLink = $('#linkAndroid');
    const androidStatus = $('#linkAndroidStatus');
    if (androidLink) {
      if (PLAY_STORE_PUBLIC) {
        androidLink.setAttribute('href', PLAY_STORE_URL);
        androidLink.setAttribute('target', '_blank');
        androidLink.setAttribute('rel', 'noopener');
        androidLink.removeAttribute('aria-disabled');
        if (androidStatus) androidStatus.textContent = 'Get it on Google Play';
      } else {
        androidLink.setAttribute('aria-disabled', 'true');
      }
    }
    const iosBtn = $('#linkIos');
    iosBtn?.addEventListener('click', (e) => { e.preventDefault(); openIosModal(); });
  }

  // ── Bind ──
  function bindEvents() {
    $$('.seg-btn').forEach((b) => {
      b.addEventListener('click', () => setAuthTab(b.getAttribute('data-auth-tab')));
    });

    $('#formSignin')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSignin(e.currentTarget);
    });
    $('#formRegister')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleRegister(e.currentTarget);
    });
    $('#btnGoogle')?.addEventListener('click', () => {
      window.location.href = '/api/auth/google/start';
    });
    $('#btnSignOut')?.addEventListener('click', handleSignOut);
    $('#mReceiptReadNowBtn')?.addEventListener('click', hidePurchaseReceiptAndRead);
    $('#mReceiptEnterLibraryBtn')?.addEventListener('click', hidePurchaseReceiptAndGoLibrary);
    $('#readerOnboardNext')?.addEventListener('click', advanceReaderOnboarding);
    $('#readerOnboardSkip')?.addEventListener('click', dismissReaderOnboarding);
    $('#btnEditProfile')?.addEventListener('click', openProfileModal);
    $('#profileEditForm')?.addEventListener('submit', handleProfileEdit);
    $('#profilePasswordForm')?.addEventListener('submit', handlePasswordChange);
    $$('[data-close-profile]').forEach((el) => el.addEventListener('click', closeProfileModal));

    $$('.tab').forEach((b) => {
      b.addEventListener('click', () => {
        const next = b.getAttribute('data-tab');
        if (!next) return;
        if (!state.session || !state.session.authenticated) {
          setView('login');
          return;
        }
        setView(next);
      });
    });

    document.addEventListener('click', (e) => {
      const bookOpen = e.target?.closest?.('[data-book-open]');
      if (bookOpen) {
        e.preventDefault();
        const slug = bookOpen.getAttribute('data-book-open');
        if (slug) {
          history.pushState(null, '', '#/book/' + encodeURIComponent(slug));
          setView('book');
          renderBookDetail(slug);
        }
        return;
      }
      const readBtn = e.target?.closest?.('[data-read]');
      if (readBtn) {
        e.preventDefault();
        const slug = readBtn.getAttribute('data-read');
        if (slug) {
          history.pushState(null, '', '#/read/' + encodeURIComponent(slug));
          openReaderWithEntry(slug);
        }
        return;
      }
      const goTab = e.target?.closest?.('[data-go-tab]');
      if (goTab) {
        e.preventDefault();
        const t = goTab.getAttribute('data-go-tab');
        if (t) setView(t);
        return;
      }
      const buyBtn = e.target?.closest?.('[data-buy]');
      if (buyBtn) {
        e.preventDefault();
        handleBuyBook(buyBtn.getAttribute('data-buy'));
        return;
      }
      const closeIos = e.target?.closest?.('[data-close-ios]');
      if (closeIos) { closeIosModal(); return; }
      const openIos = e.target?.closest?.('[data-show-ios-modal]');
      if (openIos) { e.preventDefault(); openIosModal(); return; }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeIosModal();
    });

    window.addEventListener('hashchange', hashRoute);
  }

  async function boot() {
    bindEvents();
    configureAppLinks();
    setAuthTab('signin');

    const path = location.pathname || '';
    const params = new URLSearchParams(location.search);
    const purchased = params.get('purchased') === '1';
    const purchaseCancelled = params.get('purchase_cancelled') === '1';
    const stripeSession = params.get('stripe_session');
    let purchaseSlug = params.get('slug');

    // Legacy: if slug came in the pathname (/m/<slug> or /b/<slug> or /library/<slug>)
    if (!purchaseSlug) {
      const mMatch = path.match(/^\/m\/(.+)$/);
      const bMatch = path.match(/^\/(?:b|library)\/(.+)$/);
      if (mMatch) purchaseSlug = decodeURIComponent(mMatch[1]);
      else if (bMatch) purchaseSlug = decodeURIComponent(bMatch[1]);
    }

    if (purchaseSlug && !location.hash) {
      try {
        history.replaceState(null, '', '/#/book/' + encodeURIComponent(purchaseSlug));
      } catch (_) {}
    }

    try {
      await loadState();
    } catch (_) {}

    if (purchased && purchaseSlug && state.session?.authenticated) {
      renderAccount();
      renderCatalog();
      renderLibrary();
      await confirmPurchase(purchaseSlug, stripeSession);
      return;
    }

    if (purchaseCancelled && purchaseSlug) {
      showToast('Purchase cancelled. The chapter is still available when you are ready.', 'error');
      try { history.replaceState(null, '', '/#/book/' + encodeURIComponent(purchaseSlug)); } catch (_) {}
    }

    if (state.session && state.session.authenticated) {
      renderAccount();
      renderCatalog();
      renderLibrary();
      hashRoute();
    } else {
      setView('login');
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
})();
