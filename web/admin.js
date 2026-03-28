const common = window.BookVoiceCommon;

const state = {
  session: null,
  meta: null,
  books: [],
  users: [],
  selectedBookId: null,
  selectedUsername: null,
};

const elements = {
  adminLoginGate: document.querySelector('#adminLoginGate'),
  adminApp: document.querySelector('#adminApp'),
  adminLoginForm: document.querySelector('#adminLoginForm'),
  adminLoginMessage: document.querySelector('#adminLoginMessage'),
  adminLogoutBtn: document.querySelector('#adminLogoutBtn'),
  adminSessionPill: document.querySelector('#adminSessionPill'),
  adminBooksMetric: document.querySelector('#adminBooksMetric'),
  adminPublishedMetric: document.querySelector('#adminPublishedMetric'),
  adminUsersMetric: document.querySelector('#adminUsersMetric'),
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
};

async function api(path, options) {
  return common.request(path, options);
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
  const [meta, books, users] = await Promise.all([
    api('/api/meta'),
    api('/api/admin/books'),
    api('/api/admin/users'),
  ]);
  state.meta = meta;
  state.books = books;
  state.users = users;
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
  renderBookList();
  renderSelectedBook();
  renderUserList();
  renderSelectedUser();
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    const session = await api('/api/session/login', {
      method: 'POST',
      body: JSON.stringify({
        username: String(formData.get('username') || ''),
        password: String(formData.get('password') || ''),
      }),
    });
    if (session.role !== 'admin') {
      throw new Error('This area is only for Eugene.');
    }
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

