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
  };
})();
