const WIZARD_TITLES = {
  1: 'Entrar al studio para empezar la prueba.',
  2: 'Elegir un libro para esta demo.',
  3: 'Guardar o seleccionar la voz que vamos a usar.',
  4: 'Generar la primera narracion real.',
  5: 'Revisar el resultado antes de publicar.',
};

const state = {
  books: [],
  voices: [],
  engines: [],
  jobs: [],
  publishedBooks: [],
  selectedBookId: null,
  selectedVoiceProfileId: null,
  wizardStep: 1,
  bookStepMode: 'catalog',
  voiceStepMode: 'saved',
  publicBookMode: 'listen',
  publicBookText: '',
  publicBookTextBookId: null,
  route: detectRoute(),
  routeBook: null,
  auth: { login_enabled: true, authenticated: false, username: null, hint_username: 'eugene' },
};

const elements = {
  homeSections: document.querySelector('#homeSections'),
  publicHomeSections: document.querySelector('#publicHomeSections'),
  studioSections: document.querySelector('#studioSections'),
  publicBookPage: document.querySelector('#publicBookPage'),
  publicBookContent: document.querySelector('#publicBookContent'),
  publicBookMissing: document.querySelector('#publicBookMissing'),
  copyPublicUrlBtn: document.querySelector('#copyPublicUrlBtn'),
  publicBookTitle: document.querySelector('#publicBookTitle'),
  publicBookHook: document.querySelector('#publicBookHook'),
  publicBookBadge: document.querySelector('#publicBookBadge'),
  publicBookPrice: document.querySelector('#publicBookPrice'),
  publicBookSummary: document.querySelector('#publicBookSummary'),
  publicBookExcerpt: document.querySelector('#publicBookExcerpt'),
  publicBookWords: document.querySelector('#publicBookWords'),
  publicBookReadTime: document.querySelector('#publicBookReadTime'),
  publicBookPublishedAt: document.querySelector('#publicBookPublishedAt'),
  publicBookAudioMeta: document.querySelector('#publicBookAudioMeta'),
  publicBookAudioWrap: document.querySelector('#publicBookAudioWrap'),
  publicBookAudio: document.querySelector('#publicBookAudio'),
  publicBookDownload: document.querySelector('#publicBookDownload'),
  publicBookModeHint: document.querySelector('#publicBookModeHint'),
  publicModeListenBtn: document.querySelector('#publicModeListenBtn'),
  publicModeReadBtn: document.querySelector('#publicModeReadBtn'),
  publicExperienceTitle: document.querySelector('#publicExperienceTitle'),
  publicExperienceHint: document.querySelector('#publicExperienceHint'),
  publicReadPanel: document.querySelector('#publicReadPanel'),
  loadPublicTextBtn: document.querySelector('#loadPublicTextBtn'),
  publicReadStatus: document.querySelector('#publicReadStatus'),
  publicBookText: document.querySelector('#publicBookText'),
  publicBookCta: document.querySelector('#publicBookCta'),
  publicBookSource: document.querySelector('#publicBookSource'),
  publicBookUrlHint: document.querySelector('#publicBookUrlHint'),
  booksMetric: document.querySelector('#booksMetric'),
  voicesMetric: document.querySelector('#voicesMetric'),
  publishedMetric: document.querySelector('#publishedMetric'),
  booksList: document.querySelector('#booksList'),
  voicesList: document.querySelector('#voicesList'),
  jobsList: document.querySelector('#jobsList'),
  publishedBooksList: document.querySelector('#publishedBooksList'),
  renderScopeSelect: document.querySelector('#renderScopeSelect'),
  renderScopeHint: document.querySelector('#renderScopeHint'),
  engineSelect: document.querySelector('#engineSelect'),
  voiceProfileSelect: document.querySelector('#voiceProfileSelect'),
  emptyState: document.querySelector('#emptyState'),
  bookDetail: document.querySelector('#bookDetail'),
  bookTitle: document.querySelector('#bookTitle'),
  bookSourceLink: document.querySelector('#bookSourceLink'),
  bookWords: document.querySelector('#bookWords'),
  bookReadTime: document.querySelector('#bookReadTime'),
  bookChars: document.querySelector('#bookChars'),
  bookPublished: document.querySelector('#bookPublished'),
  publishReadiness: document.querySelector('#publishReadiness'),
  bookExcerpt: document.querySelector('#bookExcerpt'),
  bookTextPreview: document.querySelector('#bookTextPreview'),
  narrationsList: document.querySelector('#narrationsList'),
  publishBtn: document.querySelector('#publishBtn'),
  unpublishBtn: document.querySelector('#unpublishBtn'),
  toast: document.querySelector('#toast'),
  featuredTitle: document.querySelector('#featuredTitle'),
  featuredHook: document.querySelector('#featuredHook'),
  featuredSummary: document.querySelector('#featuredSummary'),
  featuredPrice: document.querySelector('#featuredPrice'),
  featuredFormat: document.querySelector('#featuredFormat'),
  featuredAudioWrap: document.querySelector('#featuredAudioWrap'),
  featuredAudio: document.querySelector('#featuredAudio'),
  featuredCta: document.querySelector('#featuredCta'),
  featuredSource: document.querySelector('#featuredSource'),
  publicHookInput: document.querySelector('#publicHookInput'),
  publicPriceInput: document.querySelector('#publicPriceInput'),
  publicSummaryInput: document.querySelector('#publicSummaryInput'),
  publicCtaLabelInput: document.querySelector('#publicCtaLabelInput'),
  publicCtaUrlInput: document.querySelector('#publicCtaUrlInput'),
  publicFeaturedInput: document.querySelector('#publicFeaturedInput'),
  studioStatusText: document.querySelector('#studioStatusText'),
  authStatusText: document.querySelector('#authStatusText'),
  loginForm: document.querySelector('#loginForm'),
  loginUsernameInput: document.querySelector('#loginUsernameInput'),
  loginPasswordInput: document.querySelector('#loginPasswordInput'),
  logoutBtn: document.querySelector('#logoutBtn'),
  studioAuthReady: document.querySelector('#studioAuthReady'),
  wizardIntroText: document.querySelector('#wizardIntroText'),
  wizardStepCount: document.querySelector('#wizardStepCount'),
  wizardTrack: document.querySelector('#wizardTrack'),
  summaryAuth: document.querySelector('#summaryAuth'),
  summaryBook: document.querySelector('#summaryBook'),
  summaryVoice: document.querySelector('#summaryVoice'),
  summaryAudio: document.querySelector('#summaryAudio'),
  bookModeTabs: document.querySelector('#bookModeTabs'),
  bookModeCatalog: document.querySelector('#bookModeCatalog'),
  bookModeUpload: document.querySelector('#bookModeUpload'),
  voiceModeTabs: document.querySelector('#voiceModeTabs'),
  voiceModeSaved: document.querySelector('#voiceModeSaved'),
  voiceModeNew: document.querySelector('#voiceModeNew'),
  selectedBookStep2: document.querySelector('#selectedBookStep2'),
  selectedVoiceSummary: document.querySelector('#selectedVoiceSummary'),
  selectedBookForAudio: document.querySelector('#selectedBookForAudio'),
  selectedVoiceForAudio: document.querySelector('#selectedVoiceForAudio'),
  renderScopeCards: document.querySelector('#renderScopeCards'),
  wizardStep1Next: document.querySelector('#wizardStep1Next'),
  wizardStep2Next: document.querySelector('#wizardStep2Next'),
  wizardStep3Next: document.querySelector('#wizardStep3Next'),
  wizardStep4Next: document.querySelector('#wizardStep4Next'),
  reviewFocus: document.querySelector('#reviewFocus'),
  publicProfileSection: document.querySelector('#publicProfileSection'),
};

function detectRoute() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (segments[0] === 'studio') {
    return { name: 'studio', slug: null };
  }
  if (segments[0] === 'b' && segments[1]) {
    return { name: 'public-book', slug: decodeURIComponent(segments.slice(1).join('/')) };
  }
  if (window.location.hash === '#studio') {
    return { name: 'studio', slug: null };
  }
  return { name: 'home', slug: null };
}

function hasStudioAccess() {
  return !state.auth.login_enabled || state.auth.authenticated;
}

function getSelectedBook() {
  return state.books.find((item) => item.book_id === state.selectedBookId) || null;
}

function getSelectedVoice() {
  return state.voices.find((item) => item.voice_profile_id === state.selectedVoiceProfileId) || null;
}

function getSelectedBookNarrations() {
  return getSelectedBook()?.narrations || [];
}

function getSelectedBookRunningJob() {
  const book = getSelectedBook();
  if (!book) {
    return null;
  }
  return state.jobs.find((job) => job.book_id === book.book_id && (job.status === 'queued' || job.status === 'running')) || null;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function publicProfileFor(book) {
  const profile = book.public_profile || {};
  return {
    hook: profile.hook || book.title,
    summary: profile.summary || book.excerpt || '',
    price_label: profile.price_label || 'Disponible',
    cta_label: profile.cta_label || 'Abrir libro',
    cta_url: profile.cta_url || '',
    featured: Boolean(profile.featured),
  };
}

function latestNarration(book) {
  return book.narrations?.[0] || null;
}

function publishedNarrationFor(book) {
  return book.published_narration || latestNarration(book);
}

function hasApprovedPreviewFor(book, voiceProfileId = state.selectedVoiceProfileId, engineKey = elements.engineSelect.value || preferredEngineKey()) {
  if (!book) {
    return false;
  }
  return book.narrations?.some((narration) =>
    ['demo_excerpt', 'chapter_1'].includes(narration.render_scope) &&
    narration.approved &&
    narration.engine === engineKey &&
    narration.voice_profile_id === voiceProfileId
  );
}

function publicUrlFor(book) {
  return new URL(book.public_path || `/b/${book.slug}`, window.location.origin).href;
}

function publishedDateLabel(book) {
  if (!book.published_at) {
    return 'Sin fecha';
  }
  const date = new Date(book.published_at);
  return `Publicado ${date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

function bookStatusLabel(book) {
  if (book.published) {
    return 'Publicado';
  }
  if (book.narrations?.length) {
    return 'Listo para revisar';
  }
  return 'Borrador';
}

function resolvePublicCta(book) {
  const profile = publicProfileFor(book);
  const narration = latestNarration(book);
  if (profile.cta_url) {
    return { href: profile.cta_url, label: profile.cta_label, external: true };
  }
  if (narration) {
    return { href: narration.audio_url, label: 'Escuchar audio', external: true };
  }
  return { href: book.source_url, label: 'Leer texto', external: true };
}

function setLinkState(link, href, label, options = {}) {
  const { disabled = false, external = false, download = false } = options;
  link.textContent = label;
  if (disabled) {
    link.href = '#';
    link.classList.add('disabled-link');
    link.setAttribute('aria-disabled', 'true');
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.removeAttribute('download');
    return;
  }
  link.href = href;
  link.classList.remove('disabled-link');
  link.removeAttribute('aria-disabled');
  if (external) {
    link.target = '_blank';
    link.rel = 'noreferrer';
  } else {
    link.removeAttribute('target');
    link.removeAttribute('rel');
  }
  if (download) {
    link.setAttribute('download', '');
  } else {
    link.removeAttribute('download');
  }
}

function setPublicBookMode(mode) {
  const hasAudio = Boolean(state.routeBook && publishedNarrationFor(state.routeBook));
  const safeMode = mode === 'read' ? 'read' : 'listen';
  state.publicBookMode = safeMode === 'listen' && !hasAudio ? 'read' : safeMode;

  const listenActive = state.publicBookMode === 'listen';
  elements.publicModeListenBtn.classList.toggle('active', listenActive);
  elements.publicModeReadBtn.classList.toggle('active', !listenActive);
  elements.publicBookAudioWrap.classList.toggle('hidden', !listenActive || !hasAudio);
  elements.publicReadPanel.classList.toggle('hidden', listenActive);

  if (listenActive) {
    elements.publicExperienceTitle.textContent = 'Escuchar el libro';
    elements.publicExperienceHint.textContent = hasAudio
      ? 'Reproduce el audio directamente desde esta pagina.'
      : 'Todavia no hay audio publicado para este libro.';
    elements.publicBookModeHint.textContent = hasAudio
      ? 'Puedes cambiar entre escuchar el audio o leer el texto completo.'
      : 'Ahora mismo solo esta disponible la lectura online.';
    return;
  }

  elements.publicExperienceTitle.textContent = 'Leer el libro online';
  elements.publicExperienceHint.textContent = state.publicBookText
    ? 'El texto completo ya esta cargado para leerlo desde la web.'
    : 'Pulsa el boton para cargar el texto completo dentro de esta pagina.';
  elements.publicBookModeHint.textContent = 'Esta vista esta pensada para clientes que prefieren leer dentro de la web.';
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Error ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function showToast(message, kind = 'ok') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${kind}`;
  setTimeout(() => {
    elements.toast.className = 'toast hidden';
  }, 3200);
}

function preferredEngineKey() {
  const ready = state.engines.filter((engine) => engine.ready);
  return ready.find((engine) => engine.key === 'openvoice_wsl')?.key || ready[0]?.key || state.engines[0]?.key || '';
}

function engineLabel(engine) {
  return `${engine.name} [${engine.ready ? 'ready' : 'setup'}]`;
}

function stepCompleted(step) {
  if (step === 1) return hasStudioAccess();
  if (step === 2) return Boolean(getSelectedBook());
  if (step === 3) return Boolean(getSelectedVoice());
  if (step === 4) return Boolean(getSelectedBookNarrations().length);
  if (step === 5) return Boolean(getSelectedBook()?.published);
  return false;
}

function highestUnlockedStep() {
  if (!hasStudioAccess()) return 1;
  if (!getSelectedBook()) return 2;
  if (!getSelectedVoice()) return 3;
  if (!getSelectedBookNarrations().length) return 4;
  return 5;
}

function setWizardStep(step) {
  const clamped = Math.max(1, Math.min(5, Number(step) || 1));
  state.wizardStep = Math.min(clamped, highestUnlockedStep());
  renderWizard();
}

function setBookStepMode(mode) {
  state.bookStepMode = mode === 'upload' ? 'upload' : 'catalog';
  elements.bookModeCatalog.classList.toggle('hidden', state.bookStepMode !== 'catalog');
  elements.bookModeUpload.classList.toggle('hidden', state.bookStepMode !== 'upload');
  elements.bookModeTabs.querySelectorAll('.choice-switch-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.bookMode === state.bookStepMode);
  });
}

function setVoiceStepMode(mode) {
  state.voiceStepMode = mode === 'new' ? 'new' : 'saved';
  elements.voiceModeSaved.classList.toggle('hidden', state.voiceStepMode !== 'saved');
  elements.voiceModeNew.classList.toggle('hidden', state.voiceStepMode !== 'new');
  elements.voiceModeTabs.querySelectorAll('.choice-switch-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.voiceMode === state.voiceStepMode);
  });
}

function statusCardMarkup(title, text) {
  return `<strong>${escapeHtml(title)}</strong><p class="muted">${escapeHtml(text)}</p>`;
}
function renderAuthState() {
  const hintUsername = state.auth.hint_username || 'eugene';
  if (!elements.loginUsernameInput.value.trim()) {
    elements.loginUsernameInput.value = hintUsername;
  }
  elements.logoutBtn.classList.toggle('hidden', !hasStudioAccess() || state.route.name === 'public-book');

  if (hasStudioAccess()) {
    elements.studioStatusText.textContent = `Sesion iniciada como ${state.auth.username || hintUsername}. Vamos paso a paso hasta sacar la primera prueba con voz.`;
    elements.authStatusText.textContent = 'La sesion esta activa. Pulsa seguir para elegir el libro.';
    elements.loginForm.classList.add('hidden');
    elements.studioAuthReady.classList.remove('hidden');
    return;
  }

  elements.studioStatusText.textContent = 'La zona privada esta protegida. Entra y luego avanzamos paso a paso.';
  elements.authStatusText.textContent = `Usuario sugerido: ${hintUsername}. La zona privada solo aparece al iniciar sesion.`;
  elements.loginForm.classList.remove('hidden');
  elements.studioAuthReady.classList.add('hidden');
}

function renderMetrics() {
  if (hasStudioAccess()) {
    elements.booksMetric.textContent = String(state.books.length);
    elements.voicesMetric.textContent = String(state.voices.length);
  } else {
    elements.booksMetric.textContent = '--';
    elements.voicesMetric.textContent = '--';
  }
  elements.publishedMetric.textContent = String(state.publishedBooks.length);
}

function renderEngines() {
  const currentValue = elements.engineSelect.value;
  const preferred = preferredEngineKey();
  elements.engineSelect.innerHTML = '';
  state.engines.forEach((engine) => {
    const option = document.createElement('option');
    option.value = engine.key;
    option.textContent = engineLabel(engine);
    option.disabled = !engine.ready;
    elements.engineSelect.appendChild(option);
  });
  if (!state.engines.length) {
    return;
  }
  const nextValue = state.engines.some((engine) => engine.key === currentValue && engine.ready) ? currentValue : preferred;
  elements.engineSelect.value = nextValue;
  syncRenderScopeState();
}

function syncRenderScopeState() {
  const selectedBook = getSelectedBook();
  const fullRenderOption = Array.from(elements.renderScopeSelect.options).find((option) => option.value === 'full_book');
  const fullUnlocked = hasApprovedPreviewFor(selectedBook);

  if (fullRenderOption) {
    fullRenderOption.disabled = !fullUnlocked;
  }
  if (elements.renderScopeSelect.value === 'full_book' && !fullUnlocked) {
    elements.renderScopeSelect.value = 'demo_excerpt';
  }

  elements.renderScopeCards.querySelectorAll('.scope-card').forEach((button) => {
    const isFull = button.dataset.scope === 'full_book';
    button.classList.toggle('active', button.dataset.scope === elements.renderScopeSelect.value);
    button.disabled = isFull && !fullUnlocked;
    button.classList.toggle('locked', isFull && !fullUnlocked);
  });

  const scope = elements.renderScopeSelect.value || 'demo_excerpt';
  if (scope === 'full_book') {
    elements.renderScopeHint.textContent = 'Ya hay una muestra aprobada para esta voz. Ahora si merece la pena lanzar el libro completo.';
    return;
  }
  if (scope === 'chapter_1') {
    elements.renderScopeHint.textContent = 'Esto genera solo el capitulo 1. Es util cuando quieres validar un bloque mas largo antes del libro completo.';
    return;
  }
  elements.renderScopeHint.textContent = 'Empieza con demo corta. Cuando la apruebes, el libro completo se desbloquea para esa misma voz.';
}

function renderVoices() {
  elements.voiceProfileSelect.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'Selecciona una voz';
  elements.voiceProfileSelect.appendChild(emptyOption);

  elements.voicesList.innerHTML = '';
  if (!state.voices.length) {
    elements.voicesList.innerHTML = '<p class="muted">Todavia no hay voces guardadas. Sube una muestra para seguir.</p>';
    return;
  }

  state.voices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.voice_profile_id;
    option.textContent = voice.label;
    option.selected = voice.voice_profile_id === state.selectedVoiceProfileId;
    elements.voiceProfileSelect.appendChild(option);

    const card = document.createElement('article');
    card.className = `list-card choice-card ${voice.voice_profile_id === state.selectedVoiceProfileId ? 'active' : ''}`;
    card.innerHTML = `
      <div class="list-card-head">
        <strong>${escapeHtml(voice.label)}</strong>
        <span class="mini-badge ${voice.voice_profile_id === state.selectedVoiceProfileId ? 'success' : ''}">${voice.voice_profile_id === state.selectedVoiceProfileId ? 'voz activa' : 'voz guardada'}</span>
      </div>
      <p>${escapeHtml(voice.notes || 'Sin notas')}</p>
      <audio controls src="${voice.sample_url}"></audio>
      <div class="card-actions">
        <button class="ghost-button use-voice-btn" type="button" data-voice-id="${voice.voice_profile_id}">${voice.voice_profile_id === state.selectedVoiceProfileId ? 'Voz elegida' : 'Usar esta voz'}</button>
      </div>
    `;
    elements.voicesList.appendChild(card);
  });

  elements.voiceProfileSelect.value = state.selectedVoiceProfileId || '';
  syncRenderScopeState();
}

function renderBooks() {
  elements.booksList.innerHTML = '';
  if (!state.books.length) {
    elements.booksList.innerHTML = '<p class="muted">Todavia no hay libros en la zona privada.</p>';
    return;
  }

  state.books.forEach((book) => {
    const profile = publicProfileFor(book);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `book-item ${book.book_id === state.selectedBookId ? 'active' : ''}`;
    button.innerHTML = `
      <div class="list-card-head">
        <strong>${escapeHtml(book.title)}</strong>
        <span class="mini-badge ${book.published ? 'success' : 'draft'}">${bookStatusLabel(book)}</span>
      </div>
      <span>${book.word_count} palabras</span>
      <small>${escapeHtml(profile.price_label || 'Sin precio definido')}</small>
    `;
    button.addEventListener('click', () => {
      state.selectedBookId = book.book_id;
      state.bookStepMode = 'catalog';
      renderBooks();
      renderBookDetail();
      renderWizard();
    });
    elements.booksList.appendChild(button);
  });
  syncRenderScopeState();
}

function renderNarrations(book) {
  elements.narrationsList.innerHTML = '';
  if (!book.narrations.length) {
    elements.narrationsList.innerHTML = '<p class="muted">Todavia no hay audios para este libro.</p>';
    return;
  }
  book.narrations.forEach((narration) => {
    const chapters = Array.isArray(narration.chapters) ? narration.chapters : [];
    const metadata = narration.metadata || {};
    const approvedChapterCount = metadata.approved_chapter_count || 0;
    const chaptersHtml = chapters.length ? `
      <details class="chapter-review">
        <summary>Escuchar por partes (${chapters.length})</summary>
        <div class="chapter-review-list">
          ${chapters.map((chapter) => `
            <article class="chapter-card">
              <div class="list-card-head">
                <strong>${escapeHtml(chapter.title)}</strong>
                <span class="mini-badge ${chapter.approved ? 'success' : 'draft'}">${chapter.approved ? 'aprobado' : 'pendiente'}</span>
              </div>
              <p class="muted">${escapeHtml(chapter.excerpt || '')}</p>
              <audio controls src="${chapter.audio_url}"></audio>
              <div class="card-actions">
                <a class="button-link ghost-link" href="${chapter.audio_url}" target="_blank" rel="noreferrer">Abrir capitulo</a>
                <a class="button-link ghost-link" href="${chapter.download_url}" download>Descargar</a>
                ${narration.render_scope === 'full_book' && !chapter.approved ? `<button class="ghost-button approve-chapter-btn" type="button" data-narration-id="${narration.narration_id}" data-chapter-index="${chapter.chapter_index}">Aprobar capitulo</button>` : ''}
              </div>
            </article>`).join('')}
        </div>
      </details>` : '';

    let approvalStatus = narration.approved ? 'Aprobado' : 'Pendiente de aprobar';
    if (narration.render_scope === 'full_book') {
      approvalStatus = narration.approved
        ? 'Libro completo aprobado'
        : `${approvedChapterCount}/${chapters.length} capitulos aprobados`;
    }

    const approveButton = narration.approved
      ? '<span class="mini-badge success">aprobado</span>'
      : narration.render_scope === 'full_book'
        ? metadata.chapter_reviews_complete
          ? `<button class="accent-button approve-narration-btn" type="button" data-narration-id="${narration.narration_id}">Aprobar audio completo</button>`
          : '<span class="mini-badge draft">Aprueba todos los capitulos</span>'
        : `<button class="accent-button approve-narration-btn" type="button" data-narration-id="${narration.narration_id}">${narration.render_scope === 'chapter_1' ? 'Aprobar capitulo 1' : 'Aprobar demo'}</button>`;

    const card = document.createElement('article');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-head">
        <strong>${escapeHtml(narration.render_scope_label || narration.engine)}</strong>
        <span class="mini-badge">${escapeHtml(narration.engine)}</span>
      </div>
      <p>${escapeHtml(narration.voice_profile_id || 'Sin voz seleccionada')} | ${chapters.length || 1} partes para revisar | ${escapeHtml(approvalStatus)}</p>
      <audio controls src="${narration.audio_url}"></audio>
      <div class="hero-actions compact-actions">
        <a class="button-link ghost-link" href="${narration.audio_url}" target="_blank" rel="noreferrer">Abrir audio</a>
        <a class="button-link ghost-link" href="${narration.download_url}" download>Descargar audio</a>
        ${approveButton}
      </div>
      ${chaptersHtml}
    `;
    elements.narrationsList.appendChild(card);
  });
}

function latestNarrationOfScope(book, scope) {
  return book.narrations?.find((narration) => narration.render_scope === scope) || null;
}

function latestPendingPreviewNarration(book) {
  return book.narrations?.find((narration) => ['demo_excerpt', 'chapter_1'].includes(narration.render_scope) && !narration.approved) || null;
}

function firstPendingChapter(narration) {
  return narration?.chapters?.find((chapter) => !chapter.approved) || null;
}

function renderReviewFocus(book) {
  const workflow = book.workflow || {};
  const runningJob = getSelectedBookRunningJob();
  const pendingPreview = latestPendingPreviewNarration(book);
  const fullNarration = latestNarrationOfScope(book, 'full_book');
  const pendingChapter = firstPendingChapter(fullNarration);
  const showProfile = Boolean(workflow.can_publish || book.published || fullNarration?.approved);

  elements.publicProfileSection.classList.toggle('hidden', !showProfile);

  if (runningJob) {
    const pct = Math.round((runningJob.progress || 0) * 100);
    elements.reviewFocus.innerHTML = `
      <div class="focus-copy">
        <span class="mini-badge running">renderizando</span>
        <h3>El audio sigue en proceso</h3>
        <p class="muted">${escapeHtml(runningJob.message || 'La cola esta trabajando. Cuando termine, la siguiente accion aparecera aqui.')}</p>
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="card-actions">
        <button class="ghost-button focus-refresh-btn" type="button">Actualizar estado</button>
        <button class="ghost-button focus-go-step-btn" type="button" data-step="4">Volver al render</button>
      </div>
    `;
    return;
  }

  if (pendingPreview) {
    const buttonLabel = pendingPreview.render_scope === 'chapter_1' ? 'Aprobar capitulo 1' : 'Aprobar demo';
    elements.reviewFocus.innerHTML = `
      <div class="focus-copy">
        <span class="mini-badge draft">siguiente accion</span>
        <h3>Escucha esta muestra y apruebala si suena bien</h3>
        <p class="muted">Este paso desbloquea el libro completo para la misma voz. Asi evitamos renders largos antes de validar la calidad.</p>
      </div>
      <audio controls src="${pendingPreview.audio_url}"></audio>
      <div class="card-actions">
        <button class="accent-button approve-narration-btn" type="button" data-narration-id="${pendingPreview.narration_id}">${buttonLabel}</button>
        <a class="button-link ghost-link" href="${pendingPreview.download_url}" download>Descargar muestra</a>
        <button class="ghost-button focus-go-step-btn" type="button" data-step="4">Volver al audio</button>
      </div>
    `;
    return;
  }

  if (!fullNarration) {
    elements.reviewFocus.innerHTML = `
      <div class="focus-copy">
        <span class="mini-badge success">muestra aprobada</span>
        <h3>La demo ya esta aprobada</h3>
        <p class="muted">El siguiente paso natural es lanzar el libro completo desde el paso anterior. Aqui ya no hace falta decidir nada mas.</p>
      </div>
      <div class="card-actions">
        <button class="accent-button focus-go-step-btn" type="button" data-step="4">Generar libro completo</button>
      </div>
    `;
    return;
  }

  if (pendingChapter) {
    elements.reviewFocus.innerHTML = `
      <div class="focus-copy">
        <span class="mini-badge draft">revision por partes</span>
        <h3>Aprueba el siguiente capitulo pendiente</h3>
        <p class="muted">${escapeHtml(pendingChapter.title || 'Capitulo pendiente')} ${pendingChapter.excerpt ? `| ${escapeHtml(pendingChapter.excerpt)}` : ''}</p>
      </div>
      <audio controls src="${pendingChapter.audio_url}"></audio>
      <div class="card-actions">
        <button class="accent-button approve-chapter-btn" type="button" data-narration-id="${fullNarration.narration_id}" data-chapter-index="${pendingChapter.chapter_index}">Aprobar este capitulo</button>
        <a class="button-link ghost-link" href="${pendingChapter.download_url}" download>Descargar capitulo</a>
      </div>
    `;
    return;
  }

  if (!fullNarration.approved) {
    elements.reviewFocus.innerHTML = `
      <div class="focus-copy">
        <span class="mini-badge success">capitulos aprobados</span>
        <h3>Ya puedes aprobar el audio completo</h3>
        <p class="muted">Todo lo individual ya esta revisado. Solo falta confirmar el archivo final para habilitar la publicacion.</p>
      </div>
      <audio controls src="${fullNarration.audio_url}"></audio>
      <div class="card-actions">
        <button class="accent-button approve-narration-btn" type="button" data-narration-id="${fullNarration.narration_id}">Aprobar audio completo</button>
        <a class="button-link ghost-link" href="${fullNarration.download_url}" download>Descargar audio final</a>
      </div>
    `;
    return;
  }

  if (!book.published) {
    elements.reviewFocus.innerHTML = `
      <div class="focus-copy">
        <span class="mini-badge success">listo para publicar</span>
        <h3>Ahora solo falta la ficha publica y publicar</h3>
        <p class="muted">Rellena el bloque que aparece debajo y luego pulsa el boton de publicar. Ya no hace falta volver al render.</p>
      </div>
    `;
    return;
  }

  elements.reviewFocus.innerHTML = `
    <div class="focus-copy">
      <span class="mini-badge success">publicado</span>
      <h3>Este libro ya esta en la web</h3>
      <p class="muted">Puedes ajustar la ficha publica, compartir su enlace o volver a ocultarlo cuando quieras.</p>
    </div>
    <div class="card-actions">
      <a class="button-link accent-link" href="${book.public_path}">Ver pagina publica</a>
      <a class="button-link ghost-link" href="${publicUrlFor(book)}" target="_blank" rel="noreferrer">Abrir enlace completo</a>
    </div>
  `;
}

function renderPublicHero() {
  const featuredBook = state.publishedBooks.find((book) => publicProfileFor(book).featured) || state.publishedBooks[0] || null;
  if (!featuredBook) {
    elements.featuredTitle.textContent = 'Todavia no hay libros publicados';
    elements.featuredHook.textContent = 'Cuando publiques un libro aparecera aqui con su audio y su acceso principal.';
    elements.featuredSummary.textContent = 'La portada principal mostrara el titulo, un resumen claro y el audio cuando el libro este listo.';
    elements.featuredPrice.textContent = 'Borrador';
    elements.featuredFormat.textContent = 'Texto y audio';
    elements.featuredAudioWrap.classList.add('hidden');
    elements.featuredAudio.removeAttribute('src');
    setLinkState(elements.featuredCta, '/studio', 'Configurar acceso', { disabled: true });
    setLinkState(elements.featuredSource, '/studio', 'Ver pagina', { disabled: true });
    return;
  }
  const profile = publicProfileFor(featuredBook);
  const narration = publishedNarrationFor(featuredBook);
  const cta = resolvePublicCta(featuredBook);
  elements.featuredTitle.textContent = featuredBook.title;
  elements.featuredHook.textContent = profile.hook;
  elements.featuredSummary.textContent = profile.summary;
  elements.featuredPrice.textContent = profile.price_label || 'Disponible';
  elements.featuredFormat.textContent = narration ? 'Audio disponible' : 'Texto publicado';
  if (narration) {
    elements.featuredAudio.src = narration.audio_url;
    elements.featuredAudioWrap.classList.remove('hidden');
  } else {
    elements.featuredAudioWrap.classList.add('hidden');
    elements.featuredAudio.removeAttribute('src');
  }
  setLinkState(elements.featuredCta, cta.href, cta.label, { external: cta.external });
  setLinkState(elements.featuredSource, featuredBook.public_path, 'Ver pagina', { external: false });
}

function renderPublishedBooks() {
  elements.publishedBooksList.innerHTML = '';
  if (!state.publishedBooks.length) {
    elements.publishedBooksList.innerHTML = '<p class="muted">Todavia no hay libros publicados. Publica uno desde la zona privada para verlo aqui.</p>';
    return;
  }
  state.publishedBooks.forEach((book) => {
    const profile = publicProfileFor(book);
    const narration = publishedNarrationFor(book);
    const cta = resolvePublicCta(book);
    const card = document.createElement('article');
    card.className = 'public-card card-surface';
    card.innerHTML = `
      <div class="public-card-top">
        <span class="mini-badge ${profile.featured ? 'featured' : 'draft'}">${profile.featured ? 'destacado' : 'publicado'}</span>
        <span class="price-pill">${escapeHtml(profile.price_label || 'Disponible')}</span>
      </div>
      <h3>${escapeHtml(book.title)}</h3>
      <p class="featured-hook">${escapeHtml(profile.hook)}</p>
      <p class="muted">${escapeHtml(profile.summary)}</p>
      ${narration ? `<audio controls src="${narration.audio_url}"></audio>` : '<p class="muted">Este libro esta publicado en texto y puede recibir audio cuando quieras.</p>'}
      <div class="card-actions">
        <a class="button-link accent-link" href="${book.public_path}">Ver pagina</a>
        <a class="button-link ghost-link" href="${cta.href}" target="_blank" rel="noreferrer">${escapeHtml(cta.label)}</a>
      </div>
    `;
    elements.publishedBooksList.appendChild(card);
  });
}
function renderBookDetail() {
  if (!hasStudioAccess()) {
    elements.emptyState.classList.remove('hidden');
    elements.bookDetail.classList.add('hidden');
    elements.publicProfileSection.classList.add('hidden');
    return;
  }
  const book = getSelectedBook();
  if (!book || !book.narrations.length) {
    elements.emptyState.classList.remove('hidden');
    elements.bookDetail.classList.add('hidden');
    elements.publicProfileSection.classList.add('hidden');
    return;
  }
  const profile = publicProfileFor(book);
  const workflow = book.workflow || {};
  elements.emptyState.classList.add('hidden');
  elements.bookDetail.classList.remove('hidden');
  elements.bookTitle.textContent = book.title;
  elements.bookSourceLink.href = book.source_url;
  elements.bookWords.textContent = `${book.word_count} palabras`;
  elements.bookReadTime.textContent = `${book.estimated_read_minutes} min lectura`;
  elements.bookChars.textContent = `${book.char_count} chars`;
  elements.bookPublished.textContent = book.published ? `Publicado en ${book.public_path}` : 'Guardado solo en la zona privada';
  elements.publishBtn.disabled = !workflow.can_publish;
  elements.unpublishBtn.disabled = !book.published;
  elements.publishReadiness.innerHTML = workflow.can_publish
    ? '<strong>Listo para publicar</strong><p class="muted">Ya hay un audio completo aprobado y con todos los capitulos revisados.</p>'
    : `<strong>Publicacion bloqueada</strong><p class="muted">${escapeHtml(workflow.publish_block_reason || 'Hace falta aprobar el audio antes de publicarlo.')}</p>`;
  elements.bookExcerpt.textContent = book.excerpt;
  elements.bookTextPreview.textContent = "Pulsa 'Cargar texto' para leer el contenido completo.";
  elements.publicHookInput.value = profile.hook;
  elements.publicPriceInput.value = profile.price_label === 'Disponible' ? '' : profile.price_label;
  elements.publicSummaryInput.value = profile.summary;
  elements.publicCtaLabelInput.value = profile.cta_label;
  elements.publicCtaUrlInput.value = profile.cta_url;
  elements.publicFeaturedInput.checked = profile.featured;
  renderNarrations(book);
  renderReviewFocus(book);
}

function renderJobs() {
  elements.jobsList.innerHTML = '';
  if (!state.jobs.length) {
    elements.jobsList.innerHTML = '<p class="muted">Todavia no hay trabajos en cola.</p>';
    return;
  }
  const titlesByBookId = new Map(state.books.map((book) => [book.book_id, book.title]));
  state.jobs.forEach((job) => {
    const pct = Math.round((job.progress || 0) * 100);
    const card = document.createElement('article');
    card.className = 'job-card';
    card.innerHTML = `
      <div class="list-card-head">
        <strong>${escapeHtml(job.engine)}</strong>
        <span class="mini-badge ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
      </div>
      <p>${escapeHtml(titlesByBookId.get(job.book_id) || job.book_id)}</p>
      <p class="muted">${escapeHtml(job.message || '')}</p>
      <div class="progress"><span style="width:${pct}%"></span></div>
    `;
    elements.jobsList.appendChild(card);
  });
}

function renderSiteSections() {
  document.body.classList.toggle('public-neon-theme', state.route.name !== 'studio');
  document.body.classList.toggle('studio-theme', state.route.name === 'studio');

  if (state.route.name === 'public-book') {
    elements.homeSections.classList.add('hidden');
    elements.publicBookPage.classList.remove('hidden');
    return;
  }

  elements.publicBookPage.classList.add('hidden');
  elements.homeSections.classList.remove('hidden');
  elements.publicHomeSections.classList.toggle('hidden', state.route.name === 'studio');
  elements.studioSections.classList.toggle('hidden', state.route.name !== 'studio');
  document.title = state.route.name === 'studio' ? 'BookVoice Studio' : 'BookVoice';
}

function renderPublicBookPage() {
  renderSiteSections();
  if (state.route.name !== 'public-book') {
    return;
  }
  const book = state.routeBook;
  if (!book) {
    document.title = 'Libro no disponible | BookVoice';
    elements.publicBookMissing.classList.remove('hidden');
    elements.publicBookContent.classList.add('hidden');
    elements.publicBookTitle.textContent = 'Libro no disponible';
    elements.publicBookHook.textContent = '';
    elements.publicBookUrlHint.textContent = window.location.pathname;
    return;
  }
  const profile = publicProfileFor(book);
  const narration = publishedNarrationFor(book);
  const cta = resolvePublicCta(book);
  document.title = `${book.title} | BookVoice`;
  elements.publicBookMissing.classList.add('hidden');
  elements.publicBookContent.classList.remove('hidden');
  elements.publicBookTitle.textContent = book.title;
  elements.publicBookHook.textContent = profile.hook;
  elements.publicBookBadge.textContent = profile.featured ? 'destacado' : 'publicado';
  elements.publicBookBadge.className = `mini-badge ${profile.featured ? 'featured' : 'success'}`;
  elements.publicBookPrice.textContent = profile.price_label || 'Disponible';
  elements.publicBookSummary.textContent = profile.summary;
  elements.publicBookExcerpt.textContent = book.excerpt;
  elements.publicBookWords.textContent = `${book.word_count} palabras`;
  elements.publicBookReadTime.textContent = `${book.estimated_read_minutes} min lectura`;
  elements.publicBookPublishedAt.textContent = publishedDateLabel(book);
  elements.publicBookUrlHint.textContent = book.public_path;
  elements.publicBookText.textContent = state.publicBookText || 'Pulsa “Cargar texto completo” para leer el libro aqui.';
  elements.publicReadStatus.textContent = state.publicBookText ? 'Texto completo cargado' : 'Lectura online';
  elements.publicBookAudioMeta.textContent = narration ? `${narration.engine} | ${narration.segment_count} segmentos de audio disponibles` : 'Todavia no hay audio publicado, pero el texto puede leerse aqui.';
  elements.publicModeListenBtn.disabled = !narration;
  elements.publicModeReadBtn.disabled = false;
  setLinkState(elements.publicBookCta, cta.href, cta.label, { external: cta.external });
  setLinkState(elements.publicBookSource, book.source_url, 'Ver archivo original', { external: true });
  if (narration) {
    elements.publicBookAudio.src = narration.audio_url;
    elements.publicBookDownload.href = narration.download_url;
    elements.publicBookDownload.classList.remove('hidden');
  } else {
    elements.publicBookAudio.removeAttribute('src');
    elements.publicBookDownload.classList.add('hidden');
    elements.publicBookDownload.removeAttribute('href');
  }
  setPublicBookMode(narration ? state.publicBookMode : 'read');
}

function renderWizard() {
  const book = getSelectedBook();
  const voice = getSelectedVoice();
  const narrationCount = getSelectedBookNarrations().length;
  const runningJob = getSelectedBookRunningJob();
  const highestStep = highestUnlockedStep();
  const fullUnlocked = hasApprovedPreviewFor(book);
  if (state.wizardStep > highestStep || state.wizardStep < 1) {
    state.wizardStep = highestStep;
  }

  if (!state.books.length) {
    state.bookStepMode = 'upload';
  }
  if (!state.voices.length) {
    state.voiceStepMode = 'new';
  }

  elements.wizardIntroText.textContent = WIZARD_TITLES[state.wizardStep];
  elements.wizardStepCount.textContent = `Paso ${state.wizardStep} de 5`;
  elements.summaryAuth.textContent = hasStudioAccess() ? 'Sesion abierta' : 'Sesion pendiente';
  elements.summaryBook.textContent = book ? `Libro: ${book.title}` : 'Sin libro';
  elements.summaryVoice.textContent = voice ? `Voz: ${voice.label}` : 'Sin voz';
  elements.summaryAudio.textContent = narrationCount ? `${narrationCount} audio(s)` : runningJob ? 'Audio en cola' : 'Sin audio';
  elements.selectedBookStep2.innerHTML = book ? statusCardMarkup(book.title, `${book.word_count} palabras listas para la prueba.`) : statusCardMarkup('Todavia no hay libro elegido', 'Selecciona uno de la lista para seguir al siguiente paso.');
  elements.selectedVoiceSummary.innerHTML = voice ? statusCardMarkup(voice.label, voice.notes || 'Esta voz ya esta lista para usarla en la prueba.') : statusCardMarkup('Todavia no hay voz seleccionada', 'Guarda una muestra y luego pulsa en "Usar esta voz".');
  elements.selectedBookForAudio.innerHTML = book ? statusCardMarkup(book.title, `${book.word_count} palabras | ${book.estimated_read_minutes} min lectura aproximada.`) : statusCardMarkup('Libro pendiente', 'Todavia no has elegido libro.');
  elements.selectedVoiceForAudio.innerHTML = voice
    ? statusCardMarkup(voice.label, fullUnlocked ? 'Ya hay una muestra aprobada para esta voz. El libro completo esta desbloqueado.' : 'Esta sera la voz usada para generar la demo.')
    : statusCardMarkup('Voz pendiente', 'Todavia no has elegido voz.');
  elements.wizardStep1Next.disabled = !hasStudioAccess();
  elements.wizardStep2Next.disabled = !book;
  elements.wizardStep3Next.disabled = !voice;
  elements.wizardStep4Next.disabled = !narrationCount;
  elements.wizardStep4Next.textContent = narrationCount ? 'Ir a revisar' : runningJob ? 'Esperando narracion' : 'Ir a revisar';
  elements.wizardTrack.style.transform = `translateX(-${(state.wizardStep - 1) * 100}%)`;
  setBookStepMode(state.bookStepMode);
  setVoiceStepMode(state.voiceStepMode);
  document.querySelectorAll('.wizard-step').forEach((button) => {
    const step = Number(button.dataset.step);
    button.disabled = step > highestStep;
    button.classList.toggle('current', step === state.wizardStep);
    button.classList.toggle('done', stepCompleted(step));
    button.classList.toggle('locked', step > highestStep);
    button.setAttribute('aria-current', step === state.wizardStep ? 'step' : 'false');
  });
  document.querySelectorAll('.wizard-panel').forEach((panel) => {
    panel.classList.toggle('is-current', panel.id === `wizardStep${state.wizardStep}`);
    panel.setAttribute('aria-hidden', panel.id === `wizardStep${state.wizardStep}` ? 'false' : 'true');
  });
  elements.voiceProfileSelect.value = state.selectedVoiceProfileId || '';
  syncRenderScopeState();
}

async function loadTextForSelectedBook() {
  if (!state.selectedBookId || !hasStudioAccess()) {
    return;
  }
  try {
    const text = await api(`/api/books/${state.selectedBookId}/text`);
    elements.bookTextPreview.textContent = text;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadPublicBookText() {
  if (state.route.name !== 'public-book' || !state.routeBook) {
    return;
  }
  if (state.publicBookText && state.publicBookTextBookId === state.routeBook.book_id) {
    setPublicBookMode('read');
    return;
  }
  elements.loadPublicTextBtn.disabled = true;
  elements.publicReadStatus.textContent = 'Cargando texto...';
  try {
    const text = await api(`/api/public/books/${encodeURIComponent(state.routeBook.slug)}/text`);
    state.publicBookText = text;
    state.publicBookTextBookId = state.routeBook.book_id;
    elements.publicBookText.textContent = text;
    elements.publicReadStatus.textContent = 'Texto completo cargado';
    setPublicBookMode('read');
  } catch (error) {
    elements.publicReadStatus.textContent = 'No se pudo cargar';
    showToast(error.message, 'error');
  } finally {
    elements.loadPublicTextBtn.disabled = false;
  }
}

async function refreshAll() {
  const auth = await api('/api/auth/status').catch(() => ({ login_enabled: false, authenticated: false, username: null, hint_username: 'eugene' }));
  state.auth = auth;
  const routeBookPromise = state.route.name === 'public-book' ? api(`/api/public/books/${encodeURIComponent(state.route.slug)}`).catch(() => null) : Promise.resolve(null);
  const [publishedBooks, routeBook] = await Promise.all([api('/api/published-books'), routeBookPromise]);
  state.publishedBooks = publishedBooks;
  const previousRouteBookId = state.routeBook?.book_id || null;
  state.routeBook = routeBook;
  if ((routeBook?.book_id || null) !== previousRouteBookId) {
    state.publicBookText = '';
    state.publicBookTextBookId = null;
    state.publicBookMode = routeBook && publishedNarrationFor(routeBook) ? 'listen' : 'read';
  }
  if (hasStudioAccess() && state.route.name !== 'public-book') {
    try {
      const [books, voices, engines, jobs] = await Promise.all([api('/api/books'), api('/api/voice-profiles'), api('/api/engines'), api('/api/jobs')]);
      state.books = books;
      state.voices = voices;
      state.engines = engines;
      state.jobs = jobs;
    } catch (error) {
      state.books = [];
      state.voices = [];
      state.engines = [];
      state.jobs = [];
      state.auth.authenticated = false;
      showToast('La sesion privada ya no es valida. Inicia sesion otra vez.', 'error');
    }
  } else {
    state.books = [];
    state.voices = [];
    state.engines = [];
    state.jobs = [];
  }
  if (state.selectedBookId && !state.books.some((book) => book.book_id === state.selectedBookId)) state.selectedBookId = null;
  if (state.selectedVoiceProfileId && !state.voices.some((voice) => voice.voice_profile_id === state.selectedVoiceProfileId)) state.selectedVoiceProfileId = null;
  renderAuthState();
  renderMetrics();
  renderEngines();
  renderVoices();
  renderBooks();
  renderBookDetail();
  renderJobs();
  renderPublicHero();
  renderPublishedBooks();
  renderPublicBookPage();
  renderWizard();
}

async function publishSelectedBook() {
  if (!state.selectedBookId || !hasStudioAccess()) return;
  try {
    await api(`/api/books/${state.selectedBookId}/publish`, { method: 'POST' });
    showToast('Libro publicado en la web');
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function unpublishSelectedBook() {
  if (!state.selectedBookId || !hasStudioAccess()) return;
  try {
    await api(`/api/books/${state.selectedBookId}/unpublish`, { method: 'POST' });
    showToast('Libro ocultado de la web');
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function approveNarration(narrationId) {
  if (!state.selectedBookId || !hasStudioAccess()) return;
  try {
    await api(`/api/books/${state.selectedBookId}/narrations/${narrationId}/approve`, { method: 'POST' });
    showToast('Audio aprobado');
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function approveChapter(narrationId, chapterIndex) {
  if (!state.selectedBookId || !hasStudioAccess()) return;
  try {
    await api(`/api/books/${state.selectedBookId}/narrations/${narrationId}/chapters/${chapterIndex}/approve`, { method: 'POST' });
    showToast(`Capitulo ${chapterIndex} aprobado`);
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
}
document.querySelector('#uploadBookForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!hasStudioAccess()) {
    showToast('Inicia sesion para subir libros', 'error');
    return;
  }
  const fileInput = document.querySelector('#bookFile');
  if (!fileInput.files?.length) {
    showToast('Selecciona un archivo primero', 'error');
    return;
  }
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  try {
    const createdBook = await api('/api/books/upload', { method: 'POST', body: formData });
    state.selectedBookId = createdBook.book_id || state.selectedBookId;
    state.bookStepMode = 'catalog';
    fileInput.value = '';
    showToast('Libro anadido al catalogo');
    await refreshAll();
    setWizardStep(3);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.querySelector('#voiceForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!hasStudioAccess()) {
    showToast('Inicia sesion para guardar voces', 'error');
    return;
  }
  const sampleInput = document.querySelector('#voiceSample');
  if (!sampleInput.files?.length) {
    showToast('Sube una muestra de audio', 'error');
    return;
  }
  const formData = new FormData();
  formData.append('label', document.querySelector('#voiceLabel').value);
  formData.append('notes', document.querySelector('#voiceNotes').value);
  formData.append('sample', sampleInput.files[0]);
  try {
    const createdVoice = await api('/api/voice-profiles', { method: 'POST', body: formData });
    state.selectedVoiceProfileId = createdVoice.voice_profile_id || state.selectedVoiceProfileId;
    state.voiceStepMode = 'saved';
    event.target.reset();
    showToast('Voz guardada');
    await refreshAll();
    setWizardStep(4);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

elements.voicesList.addEventListener('click', (event) => {
  const button = event.target.closest('.use-voice-btn');
  if (!button) return;
  state.selectedVoiceProfileId = button.dataset.voiceId;
  state.voiceStepMode = 'saved';
  renderVoices();
  renderWizard();
  showToast('Voz seleccionada para la prueba');
});

elements.voiceProfileSelect.addEventListener('change', (event) => {
  state.selectedVoiceProfileId = event.target.value || null;
  renderVoices();
  renderWizard();
});

elements.renderScopeSelect.addEventListener('change', () => {
  syncRenderScopeState();
});

elements.bookModeTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-book-mode]');
  if (!button) return;
  setBookStepMode(button.dataset.bookMode);
});

elements.voiceModeTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-voice-mode]');
  if (!button) return;
  setVoiceStepMode(button.dataset.voiceMode);
});

elements.renderScopeCards.addEventListener('click', (event) => {
  const button = event.target.closest('.scope-card');
  if (!button || button.disabled) return;
  elements.renderScopeSelect.value = button.dataset.scope;
  syncRenderScopeState();
});

elements.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = { username: elements.loginUsernameInput.value.trim(), password: elements.loginPasswordInput.value };
  try {
    await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    elements.loginPasswordInput.value = '';
    showToast('Sesion iniciada');
    await refreshAll();
    setWizardStep(2);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

elements.logoutBtn.addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    state.selectedBookId = null;
    state.selectedVoiceProfileId = null;
    state.wizardStep = 1;
    showToast('Sesion cerrada');
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.querySelector('#publicProfileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedBookId || !hasStudioAccess()) {
    showToast('Inicia sesion para guardar los datos publicos', 'error');
    return;
  }
  const payload = {
    hook: elements.publicHookInput.value.trim(),
    summary: elements.publicSummaryInput.value.trim(),
    price_label: elements.publicPriceInput.value.trim(),
    cta_label: elements.publicCtaLabelInput.value.trim() || 'Abrir libro',
    cta_url: elements.publicCtaUrlInput.value.trim(),
    featured: elements.publicFeaturedInput.checked,
  };
  try {
    await api(`/api/books/${state.selectedBookId}/public-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showToast('Datos publicos guardados');
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.querySelector('#narrationForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedBookId || !hasStudioAccess()) {
    showToast('Inicia sesion para crear audios', 'error');
    return;
  }
  const payload = {
    render_scope: document.querySelector('#renderScopeSelect').value,
    engine: document.querySelector('#engineSelect').value,
    voice_profile_id: state.selectedVoiceProfileId || document.querySelector('#voiceProfileSelect').value || null,
    language: document.querySelector('#languageSelect').value,
    chunk_size: Number(document.querySelector('#chunkSizeInput').value),
    demo_chars: 1200,
    speed: Number(document.querySelector('#speedInput').value),
  };
  if (payload.engine === 'openvoice_wsl' && !payload.voice_profile_id) {
    showToast('Elige una voz antes de lanzar la prueba real', 'error');
    return;
  }
  try {
    await api(`/api/books/${state.selectedBookId}/narrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showToast('Narracion enviada a cola');
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.querySelector('#importLocalBtn').addEventListener('click', async () => {
  if (!hasStudioAccess()) {
    showToast('Inicia sesion para importar PDFs', 'error');
    return;
  }
  try {
    const result = await api('/api/books/import-local', { method: 'POST' });
    showToast(`Importados ${result.imported_count} libros`);
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

elements.copyPublicUrlBtn.addEventListener('click', async () => {
  if (!state.routeBook) {
    showToast('No hay un libro publico cargado', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(publicUrlFor(state.routeBook));
    showToast('Enlace copiado');
  } catch (error) {
    showToast('No pude copiar el enlace', 'error');
  }
});

elements.publicModeListenBtn.addEventListener('click', () => {
  setPublicBookMode('listen');
});

elements.publicModeReadBtn.addEventListener('click', () => {
  setPublicBookMode('read');
  if (!state.publicBookText) {
    loadPublicBookText().catch((error) => showToast(error.message, 'error'));
  }
});

elements.loadPublicTextBtn.addEventListener('click', () => {
  loadPublicBookText().catch((error) => showToast(error.message, 'error'));
});

elements.narrationsList.addEventListener('click', async (event) => {
  const approveNarrationButton = event.target.closest('.approve-narration-btn');
  if (approveNarrationButton) {
    await approveNarration(approveNarrationButton.dataset.narrationId);
    return;
  }
  const approveChapterButton = event.target.closest('.approve-chapter-btn');
  if (approveChapterButton) {
    await approveChapter(approveChapterButton.dataset.narrationId, Number(approveChapterButton.dataset.chapterIndex));
  }
});

elements.reviewFocus.addEventListener('click', async (event) => {
  const approveNarrationButton = event.target.closest('.approve-narration-btn');
  if (approveNarrationButton) {
    await approveNarration(approveNarrationButton.dataset.narrationId);
    return;
  }

  const approveChapterButton = event.target.closest('.approve-chapter-btn');
  if (approveChapterButton) {
    await approveChapter(approveChapterButton.dataset.narrationId, Number(approveChapterButton.dataset.chapterIndex));
    return;
  }

  const goStepButton = event.target.closest('.focus-go-step-btn');
  if (goStepButton) {
    setWizardStep(Number(goStepButton.dataset.step));
    return;
  }

  if (event.target.closest('.focus-refresh-btn')) {
    await refreshAll();
  }
});

document.querySelectorAll('.wizard-step').forEach((button) => {
  button.addEventListener('click', () => {
    const step = Number(button.dataset.step);
    if (step > highestUnlockedStep()) {
      showToast('Completa el paso actual para seguir.', 'error');
      return;
    }
    setWizardStep(step);
  });
});

document.querySelectorAll('.wizard-back').forEach((button) => {
  button.addEventListener('click', () => setWizardStep(Number(button.dataset.stepTarget)));
});

elements.wizardStep1Next.addEventListener('click', () => {
  if (!hasStudioAccess()) {
    showToast('Primero entra al studio.', 'error');
    return;
  }
  setWizardStep(2);
});

elements.wizardStep2Next.addEventListener('click', () => {
  if (!getSelectedBook()) {
    showToast('Elige un libro para continuar.', 'error');
    return;
  }
  setWizardStep(3);
});

elements.wizardStep3Next.addEventListener('click', () => {
  if (!getSelectedVoice()) {
    showToast('Selecciona una voz para continuar.', 'error');
    return;
  }
  setWizardStep(4);
});

elements.wizardStep4Next.addEventListener('click', () => {
  if (!getSelectedBookNarrations().length) {
    showToast('Primero necesitamos que termine la narracion.', 'error');
    return;
  }
  setWizardStep(5);
});

document.querySelector('#refreshJobsBtn').addEventListener('click', refreshAll);
document.querySelector('#loadTextBtn').addEventListener('click', loadTextForSelectedBook);
elements.publishBtn.addEventListener('click', publishSelectedBook);
elements.unpublishBtn.addEventListener('click', unpublishSelectedBook);

refreshAll().catch((error) => showToast(error.message, 'error'));
setInterval(refreshAll, 5000);
