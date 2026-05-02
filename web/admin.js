const common = window.BookVoiceCommon;

const state = {
  session: null,
  meta: null,
  books: [],
  users: [],
  assetAudit: [],
  selectedBookId: null,
  selectedUsername: null,
};

const elements = {
  adminLoginGate: document.querySelector('#adminLoginGate'),
  adminApp: document.querySelector('#adminApp'),
  adminLoginForm: document.querySelector('#adminLoginForm'),
  adminLoginMessage: document.querySelector('#adminLoginMessage'),
  adminLoginTotpWrap: document.querySelector('#adminLoginTotpWrap'),
  adminLogoutBtn: document.querySelector('#adminLogoutBtn'),
  adminTwofaStatusPill: document.querySelector('#adminTwofaStatusPill'),
  adminTwofaIdle: document.querySelector('#adminTwofaIdle'),
  adminTwofaSetup: document.querySelector('#adminTwofaSetup'),
  adminTwofaEnabled: document.querySelector('#adminTwofaEnabled'),
  adminTwofaInitBtn: document.querySelector('#adminTwofaInitBtn'),
  adminTwofaCancelBtn: document.querySelector('#adminTwofaCancelBtn'),
  adminTwofaSecretDisplay: document.querySelector('#adminTwofaSecretDisplay'),
  adminTwofaOtpauthDisplay: document.querySelector('#adminTwofaOtpauthDisplay'),
  adminTwofaConfirmForm: document.querySelector('#adminTwofaConfirmForm'),
  adminTwofaConfirmCode: document.querySelector('#adminTwofaConfirmCode'),
  adminTwofaDisableForm: document.querySelector('#adminTwofaDisableForm'),
  adminTwofaDisableCode: document.querySelector('#adminTwofaDisableCode'),
  adminTwofaMessage: document.querySelector('#adminTwofaMessage'),
  adminSessionPill: document.querySelector('#adminSessionPill'),
  adminBooksMetric: document.querySelector('#adminBooksMetric'),
  adminPublishedMetric: document.querySelector('#adminPublishedMetric'),
  adminUsersMetric: document.querySelector('#adminUsersMetric'),
  adminCoreReadyMetric: document.querySelector('#adminCoreReadyMetric'),
  adminImmersiveReadyMetric: document.querySelector('#adminImmersiveReadyMetric'),
  adminBookList: document.querySelector('#adminBookList'),
  adminBookTitle: document.querySelector('#adminBookTitle'),
  adminPublicLink: document.querySelector('#adminPublicLink'),
  adminPublishBtn: document.querySelector('#adminPublishBtn'),
  adminUnpublishBtn: document.querySelector('#adminUnpublishBtn'),
  adminBookStatus: document.querySelector('#adminBookStatus'),
  adminBookNarrations: document.querySelector('#adminBookNarrations'),
  adminBookWorkflow: document.querySelector('#adminBookWorkflow'),
  adminBookMeta: document.querySelector('#adminBookMeta'),
  adminBookExcerpt: document.querySelector('#adminBookExcerpt'),
  adminBookMessage: document.querySelector('#adminBookMessage'),
  adminProfileForm: document.querySelector('#adminProfileForm'),
  adminHookInput: document.querySelector('#adminHookInput'),
  adminPriceInput: document.querySelector('#adminPriceInput'),
  adminSummaryInput: document.querySelector('#adminSummaryInput'),
  adminCtaLabelInput: document.querySelector('#adminCtaLabelInput'),
  adminCtaUrlInput: document.querySelector('#adminCtaUrlInput'),
  adminFeaturedInput: document.querySelector('#adminFeaturedInput'),
  adminCreateUserForm: document.querySelector('#adminCreateUserForm'),
  adminUserList: document.querySelector('#adminUserList'),
  adminUserTitle: document.querySelector('#adminUserTitle'),
  adminUserMeta: document.querySelector('#adminUserMeta'),
  adminUserAccessState: document.querySelector('#adminUserAccessState'),
  adminUserBooks: document.querySelector('#adminUserBooks'),
  adminGrantBtn: document.querySelector('#adminGrantBtn'),
  adminRevokeBtn: document.querySelector('#adminRevokeBtn'),
  adminAssetSummary: document.querySelector('#adminAssetSummary'),
  adminAssetAudit: document.querySelector('#adminAssetAudit'),
  adminAuditList: document.querySelector('#adminAuditList'),
  adminAuditRefresh: document.querySelector('#adminAuditRefresh'),
  adminFunnelList: document.querySelector('#adminFunnelList'),
  adminFunnelWindow: document.querySelector('#adminFunnelWindow'),
  adminFunnelRefresh: document.querySelector('#adminFunnelRefresh'),
};

const FUNNEL_STEP_LABELS = {
  view_catalog: 'Viewed catalog',
  view_book: 'Opened a chapter',
  click_buy: 'Clicked buy',
  checkout_start: 'Reached Stripe',
  purchase_success: 'Purchased',
  reader_opened: 'Opened reader',
};

async function renderFunnel() {
  if (!elements.adminFunnelList) return;
  const windowParam = elements.adminFunnelWindow?.value || '7d';
  elements.adminFunnelList.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const data = await api(`/api/admin/analytics/funnel?window=${encodeURIComponent(windowParam)}`);
    const steps = Array.isArray(data?.steps) ? data.steps : [];
    if (!steps.length || steps.every((s) => s.sessions === 0 && s.hits === 0)) {
      elements.adminFunnelList.innerHTML = '<p class="muted">No analytics events captured in this window yet.</p>';
      return;
    }
    const top = steps.reduce((max, s) => Math.max(max, s.sessions, s.hits), 0) || 1;
    const firstWithData = steps.find((s) => s.sessions > 0)?.sessions || 0;
    elements.adminFunnelList.innerHTML = steps.map((s, idx) => {
      const label = FUNNEL_STEP_LABELS[s.event] || s.event;
      const width = Math.max(2, Math.round((s.sessions / top) * 100));
      const pctFromStart = firstWithData ? ((s.sessions / firstWithData) * 100).toFixed(1) : '0.0';
      const dropoffNote = idx === 0 ? 'Top of funnel' : `${pctFromStart}% of opener step`;
      return `
        <div class="funnel-row">
          <div class="funnel-row-head">
            <strong>${idx + 1}. ${common.escapeHtml(label)}</strong>
            <span class="small-text muted">${common.escapeHtml(dropoffNote)}</span>
          </div>
          <div class="funnel-bar"><span class="funnel-bar-fill" style="width:${width}%"></span></div>
          <div class="funnel-row-foot small-text muted">
            <span>${s.sessions} sessions</span>
            <span>${s.hits} events</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    elements.adminFunnelList.innerHTML = `<p class="danger">Failed to load: ${common.escapeHtml(err.message || 'error')}</p>`;
  }
}

function formatRelativeTime(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function eventBadge(type) {
  const ok = ["login_success", "register_email_sent", "email_verified", "password_reset_success"];
  const warn = ["login_fail", "rate_limited", "locked_out", "password_reset_fail", "register_email_failed"];
  if (ok.includes(type)) return "ok";
  if (warn.includes(type)) return "warn";
  return "info";
}

async function renderAuthEvents() {
  if (!elements.adminAuditList) return;
  elements.adminAuditList.innerHTML = '<p class="muted">Loading...</p>';
  try {
    const events = await api("/api/admin/auth-events?limit=100");
    if (!events.length) {
      elements.adminAuditList.innerHTML = '<p class="muted">No auth events recorded yet.</p>';
      return;
    }
    elements.adminAuditList.innerHTML = events.map((e) => `
      <div class="audit-row audit-${eventBadge(e.event_type)}">
        <div class="audit-head">
          <strong>${common.escapeHtml(e.event_type)}</strong>
          <span class="muted small-text">${formatRelativeTime(e.created_at)}</span>
        </div>
        <div class="audit-meta small-text">
          ${e.username ? `<span>user: <code>${common.escapeHtml(e.username)}</code></span>` : ''}
          ${e.ip ? `<span>ip: <code>${common.escapeHtml(e.ip)}</code></span>` : ''}
          ${e.result ? `<span>${common.escapeHtml(e.result)}</span>` : ''}
        </div>
      </div>
    `).join("");
  } catch (err) {
    elements.adminAuditList.innerHTML = `<p class="danger">Failed to load: ${common.escapeHtml(err.message || "error")}</p>`;
  }
}

async function api(path, options) {
  return common.request(path, options);
}

function showTwofaState(key) {
  const states = {
    idle: elements.adminTwofaIdle,
    setup: elements.adminTwofaSetup,
    enabled: elements.adminTwofaEnabled,
  };
  Object.entries(states).forEach(([name, el]) => {
    el?.classList.toggle('hidden', name !== key);
  });
}

async function renderTwofa() {
  if (!elements.adminTwofaStatusPill) return;
  try {
    const status = await api('/api/admin/2fa/status');
    if (status.confirmed) {
      elements.adminTwofaStatusPill.textContent = '2FA enabled';
      elements.adminTwofaStatusPill.className = 'pill ok';
      showTwofaState('enabled');
    } else {
      elements.adminTwofaStatusPill.textContent = '2FA off';
      elements.adminTwofaStatusPill.className = 'pill warn';
      showTwofaState('idle');
    }
  } catch (err) {
    elements.adminTwofaStatusPill.textContent = 'Error';
    elements.adminTwofaStatusPill.className = 'pill warn';
    common.renderNotice(elements.adminTwofaMessage, err.message || 'Failed to load 2FA status', 'error');
  }
}

async function handleTwofaInit() {
  common.renderNotice(elements.adminTwofaMessage, '', 'info');
  try {
    const data = await api('/api/admin/2fa/init', { method: 'POST' });
    elements.adminTwofaSecretDisplay.value = data.secret_display || data.secret || '';
    elements.adminTwofaOtpauthDisplay.value = data.otpauth_uri || '';
    elements.adminTwofaConfirmCode.value = '';
    showTwofaState('setup');
    elements.adminTwofaConfirmCode.focus();
  } catch (err) {
    common.renderNotice(elements.adminTwofaMessage, err.message || 'Failed to start 2FA setup', 'error');
  }
}

async function handleTwofaCancel() {
  common.renderNotice(elements.adminTwofaMessage, 'Setup cancelled. The pending secret is still stored - run "Set up 2FA" again to generate a new one.', 'info');
  showTwofaState('idle');
}

async function handleTwofaConfirm(event) {
  event.preventDefault();
  const code = String(elements.adminTwofaConfirmCode.value || '').trim();
  if (!/^\d{6}$/.test(code)) {
    common.renderNotice(elements.adminTwofaMessage, 'Enter the 6-digit code from your authenticator.', 'error');
    return;
  }
  try {
    await api('/api/admin/2fa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    common.renderNotice(elements.adminTwofaMessage, '2FA enabled. Next sign-in will require your 6-digit code.', 'info');
    elements.adminTwofaConfirmCode.value = '';
    elements.adminTwofaSecretDisplay.value = '';
    elements.adminTwofaOtpauthDisplay.value = '';
    await renderTwofa();
  } catch (err) {
    common.renderNotice(elements.adminTwofaMessage, err.message || 'Failed to enable 2FA', 'error');
  }
}

async function handleTwofaDisable(event) {
  event.preventDefault();
  const code = String(elements.adminTwofaDisableCode.value || '').trim();
  if (!/^\d{6}$/.test(code)) {
    common.renderNotice(elements.adminTwofaMessage, 'Enter a current 6-digit code.', 'error');
    return;
  }
  if (!window.confirm('Disable 2FA? Your admin login will go back to username + password only.')) return;
  try {
    await api('/api/admin/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    common.renderNotice(elements.adminTwofaMessage, '2FA disabled.', 'warn');
    elements.adminTwofaDisableCode.value = '';
    await renderTwofa();
  } catch (err) {
    common.renderNotice(elements.adminTwofaMessage, err.message || 'Failed to disable 2FA', 'error');
  }
}

function selectedBook() {
  return state.books.find((book) => book.book_id === state.selectedBookId) || null;
}

function selectedUser() {
  return state.users.find((user) => user.username === state.selectedUsername) || null;
}

async function refreshSession() {
  state.session = await api('/api/session/status');
}

async function refreshData() {
  const [meta, books, users, assetAudit] = await Promise.all([
    api('/api/meta'),
    api('/api/admin/books'),
    api('/api/admin/users'),
    api('/api/admin/published-assets'),
  ]);
  state.meta = meta;
  state.books = books;
  state.users = users;
  state.assetAudit = assetAudit;
  if (!selectedBook() && books.length) {
    state.selectedBookId = books[0].book_id;
  }
  if (!selectedUser() && users.length) {
    state.selectedUsername = users[0].username;
  }
}

function setGate() {
  const isAdmin = state.session?.authenticated && state.session?.role === 'admin';
  elements.adminLoginGate.classList.toggle('hidden', isAdmin);
  elements.adminApp.classList.toggle('hidden', !isAdmin);
  elements.adminLogoutBtn.classList.toggle('hidden', !isAdmin);
  if (isAdmin) {
    elements.adminSessionPill.textContent = `Admin - ${state.session.username}`;
  }
}

function renderMetrics() {
  elements.adminBooksMetric.textContent = String(state.books.length);
  elements.adminPublishedMetric.textContent = String(state.books.filter((book) => book.published).length);
  elements.adminUsersMetric.textContent = String(state.users.length);
  elements.adminCoreReadyMetric.textContent = String(state.assetAudit.filter((item) => item.core_reader_ready).length);
  elements.adminImmersiveReadyMetric.textContent = String(state.assetAudit.filter((item) => item.immersive_reader_ready).length);
}

function renderAssetAudit() {
  if (!state.assetAudit.length) {
    elements.adminAssetSummary.textContent = 'No published books yet. Publish a chapter first, then check launch readiness here.';
    elements.adminAssetAudit.innerHTML = '<div class="empty-card"><h3>No live books yet</h3><p>The moment a title goes live, its PDF, slides, and audio assets will be checked here.</p></div>';
    return;
  }

  const coreReady = state.assetAudit.filter((item) => item.core_reader_ready).length;
  const immersiveReady = state.assetAudit.filter((item) => item.immersive_reader_ready).length;
  elements.adminAssetSummary.textContent = `${coreReady}/${state.assetAudit.length} live books are core-ready and ${immersiveReady}/${state.assetAudit.length} already have the full immersive stack.`;

  elements.adminAssetAudit.innerHTML = state.assetAudit.map((item) => {
    const badgeTone = item.core_reader_ready ? 'ok' : 'warn';
    const badgeLabel = item.core_reader_ready ? 'Ready for domain launch' : 'Needs asset fix';
    const audioLabel = item.published_audio_available
      ? 'Audio file ready'
      : (item.published_audio_declared ? 'Audio missing on disk' : 'No published audio yet');
    const slidesLabel = item.slides_available ? 'Slides ready' : 'Slides fallback to original PDF';
    const missingCopy = item.missing_assets.length
      ? `Missing: ${item.missing_assets.join(', ')}`
      : 'No missing published assets detected.';
    return `
      <article class="book-card asset-audit-card">
        <div class="stack-tight">
          <div class="asset-audit-header">
            <h3>${common.escapeHtml(item.title)}</h3>
            <span class="badge ${badgeTone}">${common.escapeHtml(badgeLabel)}</span>
          </div>
          <p class="small-text">@${common.escapeHtml(item.slug || '')}</p>
          <p>${common.escapeHtml(missingCopy)}</p>
        </div>
        <div class="pill-row asset-pill-row">
          <span class="pill ${item.source_pdf_available ? 'ok' : 'warn'}">${common.escapeHtml(item.source_pdf_available ? 'PDF ready' : 'PDF missing')}</span>
          <span class="pill ${item.slides_available ? 'ok' : 'warn'}">${common.escapeHtml(slidesLabel)}</span>
          <span class="pill ${item.published_audio_available ? 'ok' : (item.published_audio_declared ? 'warn' : '')}">${common.escapeHtml(audioLabel)}</span>
        </div>
      </article>
    `;
  }).join('');
}

function renderBookList() {
  if (!state.books.length) {
    elements.adminBookList.innerHTML = '<div class="empty-card"><h3>No books yet</h3><p>Upload them from the machine first, then come back here to publish.</p></div>';
    return;
  }

  elements.adminBookList.innerHTML = state.books.map((book) => {
    const status = common.bookStatus(book);
    return `
      <button type="button" class="${book.book_id === state.selectedBookId ? 'active' : ''}" data-book-id="${common.escapeHtml(book.book_id)}">
        <div class="stack-tight">
          <strong>${common.escapeHtml(book.title)}</strong>
          <span class="small-text">${book.word_count || 0} words - ${book.narrations?.length || 0} narrations</span>
          <span class="badge ${status.tone}">${status.label}</span>
        </div>
      </button>
    `;
  }).join('');
}

function syncProfileForm(book) {
  const profile = common.bookProfile(book);
  elements.adminHookInput.value = profile.hook;
  elements.adminPriceInput.value = profile.priceLabel;
  elements.adminSummaryInput.value = profile.summary;
  elements.adminCtaLabelInput.value = profile.ctaLabel;
  elements.adminCtaUrlInput.value = profile.ctaUrl;
  elements.adminFeaturedInput.checked = profile.featured;
}

function renderSelectedBook() {
  const book = selectedBook();
  if (!book) {
    elements.adminBookTitle.textContent = 'Select a book';
    return;
  }

  const profile = common.bookProfile(book);
  const status = common.bookStatus(book);
  const publicLink = book.public_path || `/library/${book.slug}`;
  elements.adminBookTitle.textContent = book.title;
  elements.adminBookStatus.className = `badge ${status.tone}`;
  elements.adminBookStatus.textContent = status.label;
  elements.adminBookNarrations.textContent = `${book.narrations?.length || 0} narrations`;
  elements.adminBookWorkflow.textContent = book.workflow?.can_publish
    ? 'Final audio is ready'
    : (book.workflow?.publish_block_reason || 'No final audio yet');
  elements.adminBookMeta.textContent = `${book.word_count || 0} words - ${book.estimated_read_minutes || 0} min read - created ${common.formatDate(book.created_at)}`;
  elements.adminBookExcerpt.textContent = profile.summary || book.excerpt || 'No summary yet.';
  elements.adminPublicLink.classList.toggle('hidden', !book.published);
  elements.adminPublicLink.href = publicLink;
  elements.adminPublishBtn.disabled = book.published || !book.workflow?.can_publish;
  elements.adminUnpublishBtn.disabled = !book.published;
  syncProfileForm(book);
}

function renderUserList() {
  if (!state.users.length) {
    elements.adminUserList.innerHTML = '<div class="empty-card"><h3>No readers yet</h3><p>Create the first reader account, then activate the books they paid for.</p></div>';
    return;
  }

  elements.adminUserList.innerHTML = state.users.map((user) => `
    <button type="button" class="${user.username === state.selectedUsername ? 'active' : ''}" data-username="${common.escapeHtml(user.username)}">
      <div class="stack-tight">
        <strong>${common.escapeHtml(user.display_name || user.username)}</strong>
        <span class="small-text">@${common.escapeHtml(user.username)}</span>
        <span class="pill">${user.book_ids?.length || 0} active books</span>
      </div>
    </button>
  `).join('');
}

function renderSelectedUser() {
  const user = selectedUser();
  const book = selectedBook();

  if (!user) {
    elements.adminUserTitle.textContent = 'Select a reader';
    elements.adminUserMeta.textContent = 'This is where access rights appear.';
    elements.adminUserBooks.innerHTML = '';
    return;
  }

  elements.adminUserTitle.textContent = `${user.display_name || user.username}`;
  elements.adminUserMeta.textContent = `User @${user.username} - created ${common.formatDate(user.created_at)}`;

  const hasSelectedBook = Boolean(book && user.book_ids?.includes(book.book_id));
  common.renderNotice(
    elements.adminUserAccessState,
    book
      ? hasSelectedBook
        ? `${user.display_name || user.username} already has access to the selected book.`
        : `${user.display_name || user.username} does not have access to the selected book yet.`
      : 'Select a book to manage access.',
    hasSelectedBook ? 'info' : 'warn'
  );

  const grantedBooks = state.books.filter((item) => user.book_ids?.includes(item.book_id));
  if (!grantedBooks.length) {
    elements.adminUserBooks.innerHTML = '<div class="empty-card"><h3>No active books</h3><p>This reader has no assigned access yet.</p></div>';
  } else {
    elements.adminUserBooks.innerHTML = grantedBooks.map((item) => `
      <article class="book-card">
        <div class="stack-tight">
          <h3>${common.escapeHtml(item.title)}</h3>
          <p>${common.escapeHtml(common.bookProfile(item).hook)}</p>
        </div>
        <div class="meta-inline">
          <span>${item.word_count || 0} words</span>
          <span>${item.published ? 'Published' : 'Draft'}</span>
        </div>
        <div class="actions">
          <a class="button-link ghost" href="/library/${encodeURIComponent(item.slug)}" target="_blank" rel="noreferrer">Open detail</a>
        </div>
      </article>
    `).join('');
  }

  elements.adminGrantBtn.disabled = !book || hasSelectedBook;
  elements.adminRevokeBtn.disabled = !book || !hasSelectedBook;
}

async function hydrateDashboard() {
  await refreshData();
  renderMetrics();
  renderAssetAudit();
  renderBookList();
  renderSelectedBook();
  renderUserList();
  renderSelectedUser();
  renderAuthEvents().catch(() => {});
  renderTwofa().catch(() => {});
  renderFunnel().catch(() => {});
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    username: String(formData.get('username') || ''),
    password: String(formData.get('password') || ''),
  };
  const totpCode = String(formData.get('totp_code') || '').trim();
  if (totpCode) payload.totp_code = totpCode;

  try {
    const response = await fetch('/api/session/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (body?.error === 'totp_required') {
        elements.adminLoginTotpWrap.classList.remove('hidden');
        const input = elements.adminLoginTotpWrap.querySelector('input');
        input?.focus();
        common.renderNotice(elements.adminLoginMessage, 'Enter the 6-digit code from your authenticator.', 'info');
        return;
      }
      if (body?.error === 'totp_invalid') {
        elements.adminLoginTotpWrap.classList.remove('hidden');
        common.renderNotice(elements.adminLoginMessage, 'Invalid 2FA code. Try again.', 'error');
        return;
      }
      throw new Error(body?.detail || body?.error || `Error ${response.status}`);
    }

    if (body.role !== 'admin') {
      throw new Error('This area is only for Eugene.');
    }
    elements.adminLoginTotpWrap.classList.add('hidden');
    common.renderNotice(elements.adminLoginMessage, '', 'info');
    await refreshSession();
    setGate();
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.adminLoginMessage, error.message, 'error');
  }
}

async function handleLogout() {
  await api('/api/session/logout', { method: 'POST' });
  await refreshSession();
  setGate();
}

async function handleProfileSave(event) {
  event.preventDefault();
  const book = selectedBook();
  if (!book) {
    return;
  }

  try {
    await api(`/api/admin/books/${encodeURIComponent(book.book_id)}/public-profile`, {
      method: 'PATCH',
      body: JSON.stringify({
        hook: elements.adminHookInput.value.trim(),
        summary: elements.adminSummaryInput.value.trim(),
        price_label: elements.adminPriceInput.value.trim(),
        cta_label: elements.adminCtaLabelInput.value.trim(),
        cta_url: elements.adminCtaUrlInput.value.trim(),
        featured: elements.adminFeaturedInput.checked,
      }),
    });
    common.renderNotice(elements.adminBookMessage, 'Public profile saved.', 'info');
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.adminBookMessage, error.message, 'error');
  }
}

async function publishSelectedBook() {
  const book = selectedBook();
  if (!book) {
    return;
  }
  try {
    await api(`/api/admin/books/${encodeURIComponent(book.book_id)}/publish`, { method: 'POST' });
    common.renderNotice(elements.adminBookMessage, 'Book published.', 'info');
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.adminBookMessage, error.message, 'error');
  }
}

async function unpublishSelectedBook() {
  const book = selectedBook();
  if (!book) {
    return;
  }
  try {
    await api(`/api/admin/books/${encodeURIComponent(book.book_id)}/unpublish`, { method: 'POST' });
    common.renderNotice(elements.adminBookMessage, 'Book hidden.', 'warn');
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.adminBookMessage, error.message, 'error');
  }
}

async function handleCreateUser(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const user = await api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        username: String(formData.get('username') || ''),
        display_name: String(formData.get('display_name') || ''),
        password: String(formData.get('password') || ''),
      }),
    });
    state.selectedUsername = user.username;
    event.currentTarget.reset();
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.adminUserAccessState, error.message, 'error');
  }
}

async function grantSelectedBook() {
  const user = selectedUser();
  const book = selectedBook();
  if (!user || !book) {
    return;
  }
  try {
    await api(`/api/admin/users/${encodeURIComponent(user.username)}/grants/${encodeURIComponent(book.book_id)}`, {
      method: 'POST',
    });
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.adminUserAccessState, error.message, 'error');
  }
}

async function revokeSelectedBook() {
  const user = selectedUser();
  const book = selectedBook();
  if (!user || !book) {
    return;
  }
  try {
    await api(`/api/admin/users/${encodeURIComponent(user.username)}/grants/${encodeURIComponent(book.book_id)}`, {
      method: 'DELETE',
    });
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.adminUserAccessState, error.message, 'error');
  }
}

function bindEvents() {
  elements.adminLoginForm?.addEventListener('submit', handleLogin);
  elements.adminLogoutBtn?.addEventListener('click', handleLogout);
  elements.adminProfileForm?.addEventListener('submit', handleProfileSave);
  elements.adminPublishBtn?.addEventListener('click', publishSelectedBook);
  elements.adminUnpublishBtn?.addEventListener('click', unpublishSelectedBook);
  elements.adminCreateUserForm?.addEventListener('submit', handleCreateUser);
  elements.adminGrantBtn?.addEventListener('click', grantSelectedBook);
  elements.adminRevokeBtn?.addEventListener('click', revokeSelectedBook);
  elements.adminAuditRefresh?.addEventListener('click', renderAuthEvents);
  elements.adminTwofaInitBtn?.addEventListener('click', handleTwofaInit);
  elements.adminTwofaCancelBtn?.addEventListener('click', handleTwofaCancel);
  elements.adminTwofaConfirmForm?.addEventListener('submit', handleTwofaConfirm);
  elements.adminTwofaDisableForm?.addEventListener('submit', handleTwofaDisable);
  elements.adminFunnelRefresh?.addEventListener('click', renderFunnel);
  elements.adminFunnelWindow?.addEventListener('change', renderFunnel);

  elements.adminBookList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-book-id]');
    if (!button) {
      return;
    }
    state.selectedBookId = button.getAttribute('data-book-id');
    renderBookList();
    renderSelectedBook();
    renderSelectedUser();
  });

  elements.adminUserList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-username]');
    if (!button) {
      return;
    }
    state.selectedUsername = button.getAttribute('data-username');
    renderUserList();
    renderSelectedUser();
  });
}

async function init() {
  bindEvents();
  await refreshSession();
  setGate();
  if (state.session?.authenticated && state.session?.role === 'admin') {
    await hydrateDashboard();
  }
}

init().catch((error) => {
  common.renderNotice(elements.adminLoginMessage, error.message, 'error');
});

