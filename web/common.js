window.BookVoiceCommon = (() => {
  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const finalOptions = { credentials: 'same-origin', ...options, headers };
    if (finalOptions.body && !(finalOptions.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(path, finalOptions);
    const contentType = response.headers.get('content-type') || '';
    let payload = null;

    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      const detail = payload && typeof payload === 'object' ? payload.detail : payload;
      throw new Error(detail || `Error ${response.status}`);
    }

    return payload;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDate(value) {
    if (!value) {
      return 'No date';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatDateTime(value) {
    if (!value) {
      return 'No date';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function bookProfile(book) {
    const profile = book.public_profile || {};
    return {
      hook: profile.hook || book.title || 'Book',
      summary: profile.summary || book.excerpt || '',
      priceLabel: profile.price_label || 'Private access',
      ctaLabel: profile.cta_label || 'Open book',
      ctaUrl: profile.cta_url || '',
      featured: Boolean(profile.featured),
    };
  }

  function publishedNarration(book) {
    return book.published_narration || book.narrations?.[0] || null;
  }

  function hasPublishedAudio(book) {
    if (typeof book?.published_audio_available === 'boolean') {
      return book.published_audio_available;
    }
    return Boolean(publishedNarration(book)?.audio_url);
  }

  function bookStatus(book) {
    if (book.published) {
      return { label: 'Published', tone: 'ok' };
    }
    if (book.workflow?.can_publish) {
      return { label: 'Ready to publish', tone: 'warn' };
    }
    if (book.narrations?.length) {
      return { label: 'In review', tone: 'warn' };
    }
    return { label: 'Draft', tone: 'locked' };
  }

  function renderNotice(element, message, tone = 'info') {
    if (!element) {
      return;
    }
    if (!message) {
      element.className = 'notice hidden';
      element.innerHTML = '';
      return;
    }
    element.className = `notice ${tone}`;
    element.innerHTML = `<p>${escapeHtml(message)}</p>`;
  }

  function slugFromLocation() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if ((segments[0] === 'library' || segments[0] === 'b') && segments[1]) {
      return decodeURIComponent(segments.slice(1).join('/'));
    }
    return null;
  }

  function roleName(role) {
    if (role === 'admin') {
      return 'Admin';
    }
    if (role === 'customer') {
      return 'Reader';
    }
    return 'Guest';
  }

  let analyticsSessionId = null;
  function getAnalyticsSessionId() {
    if (analyticsSessionId) return analyticsSessionId;
    try {
      analyticsSessionId = sessionStorage.getItem('bv_analytics_sid');
      if (!analyticsSessionId) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        analyticsSessionId = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem('bv_analytics_sid', analyticsSessionId);
      }
    } catch {
      analyticsSessionId = String(Date.now()) + Math.random().toString(36).slice(2, 10);
    }
    return analyticsSessionId;
  }

  function detectPlatform() {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/android/.test(ua)) return 'mobile_web_android';
    if (/iphone|ipad|ipod/.test(ua)) return 'mobile_web_ios';
    return 'desktop_web';
  }

  function trackEvent(eventType, opts = {}) {
    try {
      const body = JSON.stringify({
        event_type: eventType,
        slug: opts.slug || null,
        session_id: getAnalyticsSessionId(),
        platform: opts.platform || detectPlatform(),
        metadata: opts.metadata || undefined,
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
    } catch { /* never throw from analytics */ }
  }

  return {
    request,
    escapeHtml,
    formatDate,
    formatDateTime,
    bookProfile,
    publishedNarration,
    hasPublishedAudio,
    bookStatus,
    renderNotice,
    slugFromLocation,
    roleName,
    trackEvent,
    getAnalyticsSessionId,
  };
})();
