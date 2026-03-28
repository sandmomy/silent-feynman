const common = window.BookVoiceCommon;

const state = {
  session: null,
  books: [],
  voices: [],
  engines: [],
  jobs: [],
  selectedBookId: null,
  selectedVoiceId: null,
  compareBusy: false,
};

const elements = {
  machineLoginGate: document.querySelector('#machineLoginGate'),
  machineApp: document.querySelector('#machineApp'),
  machineLoginForm: document.querySelector('#machineLoginForm'),
  machineLoginMessage: document.querySelector('#machineLoginMessage'),
  machineLogoutBtn: document.querySelector('#machineLogoutBtn'),
  machineImportBtn: document.querySelector('#machineImportBtn'),
  machineRefreshBtn: document.querySelector('#machineRefreshBtn'),
  machineUploadBookForm: document.querySelector('#machineUploadBookForm'),
  machineBookList: document.querySelector('#machineBookList'),
  machineBookTitle: document.querySelector('#machineBookTitle'),
  machineBookMeta: document.querySelector('#machineBookMeta'),
  machineBookStatus: document.querySelector('#machineBookStatus'),
  machineBookNarrations: document.querySelector('#machineBookNarrations'),
  machineBookWorkflow: document.querySelector('#machineBookWorkflow'),
  machineMessage: document.querySelector('#machineMessage'),
  machineVoiceForm: document.querySelector('#machineVoiceForm'),
  machineVoiceList: document.querySelector('#machineVoiceList'),
  machineVoiceSummary: document.querySelector('#machineVoiceSummary'),
  machineVoiceComparison: document.querySelector('#machineVoiceComparison'),
  machineCompareVoiceBtn: document.querySelector('#machineCompareVoiceBtn'),
  machineEngineSelect: document.querySelector('#machineEngineSelect'),
  machineScopeSelect: document.querySelector('#machineScopeSelect'),
  machineLanguageSelect: document.querySelector('#machineLanguageSelect'),
  machineRenderForm: document.querySelector('#machineRenderForm'),
  machineRenderHint: document.querySelector('#machineRenderHint'),
  machineJobList: document.querySelector('#machineJobList'),
  machineNarrationList: document.querySelector('#machineNarrationList'),
};

async function api(path, options) {
  return common.request(path, options);
}

function selectedBook() {
  return state.books.find((book) => book.book_id === state.selectedBookId) || null;
}

function selectedVoice() {
  return state.voices.find((voice) => voice.voice_profile_id === state.selectedVoiceId) || null;
}

function formatSeconds(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 sec';
  }
  if (seconds >= 60) {
    return `${(seconds / 60).toFixed(1)} min`;
  }
  return `${seconds.toFixed(1)} sec`;
}

function qualityTone(grade) {
  if (grade === 'strong') {
    return 'ok';
  }
  if (grade === 'good') {
    return 'warn';
  }
  return 'locked';
}

function sampleModeLabel(voice) {
  return voice?.preferred_preset ? voice.preferred_preset.replaceAll('_', ' ') : (voice?.default_sample_mode_label || 'Automatic');
}

function uniqueWarnings(voice) {
  const warnings = [
    ...(voice?.warnings || []),
    ...((voice?.samples || []).flatMap((sample) => sample.warnings || [])),
  ].filter(Boolean);
  return [...new Set(warnings)];
}

async function refreshSession() {
  state.session = await api('/api/session/status');
}

async function refreshData() {
  const [books, voices, engines, jobs] = await Promise.all([
    api('/api/books'),
    api('/api/voice-profiles'),
    api('/api/engines'),
    api('/api/jobs'),
  ]);
  state.books = books;
  state.voices = voices;
  state.engines = engines;
  state.jobs = jobs;

  if (!selectedBook() && books.length) {
    state.selectedBookId = books[0].book_id;
  }
  if (!selectedVoice() && voices.length) {
    state.selectedVoiceId = voices[0].voice_profile_id;
  }
}

function setGate() {
  const isAdmin = state.session?.authenticated && state.session?.role === 'admin';
  elements.machineLoginGate.classList.toggle('hidden', isAdmin);
  elements.machineApp.classList.toggle('hidden', !isAdmin);
  elements.machineLogoutBtn.classList.toggle('hidden', !isAdmin);
}

function renderBookList() {
  if (!state.books.length) {
    elements.machineBookList.innerHTML = '<div class="empty-card"><h3>No books yet</h3><p>Import PDFs or upload a new file.</p></div>';
    return;
  }
  elements.machineBookList.innerHTML = state.books.map((book) => {
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

function renderSelectedBook() {
  const book = selectedBook();
  if (!book) {
    elements.machineBookTitle.textContent = 'Select a book';
    elements.machineBookMeta.textContent = 'The key render information will appear here.';
    elements.machineBookWorkflow.textContent = '';
    return;
  }
  const status = common.bookStatus(book);
  elements.machineBookTitle.textContent = book.title;
  elements.machineBookMeta.textContent = `${book.word_count || 0} words - ${book.estimated_read_minutes || 0} min read - ${common.formatDate(book.created_at)}`;
  elements.machineBookStatus.className = `badge ${status.tone}`;
  elements.machineBookStatus.textContent = status.label;
  elements.machineBookNarrations.textContent = `${book.narrations?.length || 0} narrations`;
  elements.machineBookWorkflow.textContent = book.workflow?.publish_block_reason || 'Ready for the next step.';
}

function renderVoiceList() {
  if (!state.voices.length) {
    elements.machineVoiceList.innerHTML = '<div class="empty-card"><h3>No voice packs yet</h3><p>Upload one or more samples to build the first pack.</p></div>';
    elements.machineVoiceSummary.innerHTML = '<p>Select the voice pack you want to use for this render.</p>';
    elements.machineVoiceComparison.innerHTML = '<div class="empty-card"><h3>No comparison yet</h3><p>Run the A/B/C comparison after saving a pack.</p></div>';
    if (elements.machineCompareVoiceBtn) {
      elements.machineCompareVoiceBtn.disabled = true;
    }
    return;
  }

  elements.machineVoiceList.innerHTML = state.voices.map((voice) => `
    <button type="button" class="${voice.voice_profile_id === state.selectedVoiceId ? 'active' : ''}" data-voice-id="${common.escapeHtml(voice.voice_profile_id)}">
      <div class="stack-tight">
        <strong>${common.escapeHtml(voice.label)}</strong>
        <span class="small-text">${voice.sample_count || 0} samples - ${formatSeconds(voice.total_duration_seconds)} - ${common.escapeHtml((voice.language || 'en').toUpperCase())}</span>
        <div class="pill-row">
          <span class="badge ${qualityTone(voice.quality_grade)}">${common.escapeHtml(voice.quality_grade || 'usable')}</span>
          ${voice.preferred_preset ? `<span class="pill">Preferred: ${common.escapeHtml(voice.preferred_preset.replaceAll('_', ' '))}</span>` : ''}
        </div>
      </div>
    </button>
  `).join('');

  renderSelectedVoice();
}

function renderSelectedVoice() {
  const voice = selectedVoice();
  if (!voice) {
    elements.machineVoiceSummary.innerHTML = '<p>Select the voice pack you want to use for this render.</p>';
    elements.machineVoiceComparison.innerHTML = '<div class="empty-card"><h3>No comparison yet</h3><p>Run the A/B/C comparison after saving a pack.</p></div>';
    if (elements.machineCompareVoiceBtn) {
      elements.machineCompareVoiceBtn.disabled = true;
      elements.machineCompareVoiceBtn.textContent = 'Run A/B/C comparison';
    }
    return;
  }

  const warnings = uniqueWarnings(voice).slice(0, 4);
  const preferredText = voice.preferred_preset
    ? `Preferred preset: ${common.escapeHtml(voice.preferred_preset.replaceAll('_', ' '))}`
    : `Default preset: ${common.escapeHtml(voice.default_sample_mode_label || 'Automatic')}`;

  elements.machineVoiceSummary.innerHTML = `
    <div class="stack-tight">
      <strong>${common.escapeHtml(voice.label)}</strong>
      <span class="small-text">${voice.sample_count || 0} samples - ${formatSeconds(voice.total_duration_seconds)} total - ${(voice.language || 'en').toUpperCase()}</span>
      <div class="pill-row">
        <span class="badge ${qualityTone(voice.quality_grade)}">${common.escapeHtml(voice.quality_grade || 'usable')}</span>
        <span class="pill">${preferredText}</span>
        <span class="pill">${voice.comparison_runs?.length || 0} comparison runs</span>
      </div>
      ${voice.notes ? `<p>${common.escapeHtml(voice.notes)}</p>` : ''}
      ${warnings.length ? `<div class="stack-tight"><strong>Warnings</strong>${warnings.map((warning) => `<span class="small-text">${common.escapeHtml(warning)}</span>`).join('')}</div>` : ''}
    </div>
  `;

  renderLatestComparison(voice);
  if (elements.machineCompareVoiceBtn) {
    elements.machineCompareVoiceBtn.disabled = state.compareBusy;
    elements.machineCompareVoiceBtn.textContent = state.compareBusy ? 'Comparing...' : 'Run A/B/C comparison';
  }
}

function renderLatestComparison(voice) {
  const latestRun = voice?.comparison_runs?.[0];
  if (!latestRun) {
    elements.machineVoiceComparison.innerHTML = '<div class="empty-card"><h3>No comparison yet</h3><p>Generate the fixed English passage to compare raw, clean single, and clean multi.</p></div>';
    return;
  }

  elements.machineVoiceComparison.innerHTML = latestRun.variants.map((variant) => {
    const preferred = voice.preferred_preset === variant.preset;
    const resolvedLine = variant.resolved_preset && variant.resolved_preset !== variant.preset
      ? `<span class="small-text">Rendered with fallback: ${common.escapeHtml(variant.resolved_preset_label || variant.resolved_preset)}</span>`
      : '';
    return `
      <article class="list-card">
        <div class="stack-tight">
          <div class="title-row">
            <div class="stack-tight">
              <h4>${common.escapeHtml(variant.preset_label || variant.preset)}</h4>
              <p>${variant.sample_count_used || 0} samples used - ${formatSeconds(variant.duration_seconds)}</p>
              ${resolvedLine}
            </div>
            <span class="badge ${preferred ? 'ok' : 'warn'}">${preferred ? 'Preferred' : 'Available'}</span>
          </div>
          <audio controls preload="none" src="${common.escapeHtml(variant.audio_url)}"></audio>
          <div class="actions">
            <a class="button-link ghost" href="${common.escapeHtml(variant.audio_url)}" target="_blank" rel="noreferrer">Open audio</a>
            ${preferred ? '' : `<button class="secondary" type="button" data-action="set-preferred-preset" data-preset="${common.escapeHtml(variant.preset)}">Use as base preset</button>`}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderEngines() {
  elements.machineEngineSelect.innerHTML = state.engines.map((engine) => `
    <option value="${common.escapeHtml(engine.key)}">${common.escapeHtml(engine.name)}</option>
  `).join('');
  updateRenderHint();
}

function updateRenderHint() {
  const engine = state.engines.find((item) => item.key === elements.machineEngineSelect.value) || state.engines[0];
  const voice = selectedVoice();
  if (!engine) {
    common.renderNotice(elements.machineRenderHint, 'No engines are available.', 'warn');
    return;
  }
  const presetLine = voice
    ? `Current voice preset: ${voice.preferred_preset ? voice.preferred_preset.replaceAll('_', ' ') : voice.default_sample_mode_label}.`
    : 'Select a voice pack first.';
  common.renderNotice(
    elements.machineRenderHint,
    engine.requires_voice_profile
      ? `${engine.name}: start with a short demo, compare presets, approve the result, then move to the full book. ${presetLine}`
      : `${engine.name}: this engine is useful for validating the flow and storage without voice cloning.`,
    'info'
  );
}

function renderJobs() {
  if (!state.jobs.length) {
    elements.machineJobList.innerHTML = '<div class="empty-card"><h3>No jobs yet</h3><p>Your render queue will appear here.</p></div>';
    return;
  }

  elements.machineJobList.innerHTML = state.jobs.slice(0, 8).map((job) => `
    <article class="list-card">
      <div class="title-row">
        <div class="stack-tight">
          <h4>${common.escapeHtml(job.book_title || job.book_id || 'Job')}</h4>
          <p>${common.escapeHtml(job.engine || 'engine')}</p>
        </div>
        <span class="badge ${job.status === 'completed' ? 'ok' : job.status === 'failed' ? 'locked' : 'warn'}">${common.escapeHtml(job.status)}</span>
      </div>
      <div class="meta-inline">
        <span>${common.formatDateTime(job.created_at)}</span>
        <span>${common.escapeHtml(job.job_id)}</span>
      </div>
      ${job.message ? `<p>${common.escapeHtml(job.message)}</p>` : ''}
    </article>
  `).join('');
}

function narrationCard(book, narration) {
  const scope = narration.render_scope_label || narration.render_scope || 'Narration';
  const chapters = narration.chapters || [];
  const sampleMode = narration.metadata?.sample_mode_label || narration.metadata?.sample_mode;
  const approveButton = !narration.approved
    ? `<button class="secondary" type="button" data-action="approve-narration" data-narration-id="${common.escapeHtml(narration.narration_id)}">Approve audio</button>`
    : '<span class="badge ok">Audio approved</span>';

  const chapterRows = chapters.length
    ? `<div class="stack-tight">${chapters.map((chapter) => `
        <div class="list-card">
          <div class="title-row">
            <div class="stack-tight">
              <strong>Chapter ${chapter.chapter_index}</strong>
              <span class="small-text">${common.escapeHtml(chapter.title || 'Untitled')}</span>
            </div>
            <span class="badge ${chapter.approved ? 'ok' : 'warn'}">${chapter.approved ? 'Approved' : 'Pending'}</span>
          </div>
          <div class="actions">
            ${chapter.audio_url ? `<a class="button-link ghost" href="${common.escapeHtml(chapter.audio_url)}" target="_blank" rel="noreferrer">Listen</a>` : ''}
            ${chapter.approved ? '' : `<button class="secondary" type="button" data-action="approve-chapter" data-narration-id="${common.escapeHtml(narration.narration_id)}" data-chapter-index="${chapter.chapter_index}">Approve chapter</button>`}
          </div>
        </div>
      `).join('')}</div>`
    : '';

  return `
    <article class="list-card">
      <div class="title-row">
        <div class="stack-tight">
          <h4>${common.escapeHtml(scope)}</h4>
          <p>${common.escapeHtml(narration.engine)} - ${common.formatDateTime(narration.created_at)}</p>
          ${sampleMode ? `<span class="small-text">Voice preset: ${common.escapeHtml(sampleMode)}</span>` : ''}
        </div>
        <span class="badge ${narration.approved ? 'ok' : 'warn'}">${narration.approved ? 'Approved' : 'Pending'}</span>
      </div>
      <div class="actions">
        ${narration.audio_url ? `<a class="button-link primary" href="${common.escapeHtml(narration.audio_url)}" target="_blank" rel="noreferrer">Listen to audio</a>` : ''}
        ${approveButton}
      </div>
      ${chapterRows}
    </article>
  `;
}

function renderNarrations() {
  const book = selectedBook();
  if (!book) {
    elements.machineNarrationList.innerHTML = '<div class="empty-card"><h3>No selection yet</h3><p>Select a book first.</p></div>';
    return;
  }
  if (!book.narrations?.length) {
    elements.machineNarrationList.innerHTML = '<div class="empty-card"><h3>No narrations yet</h3><p>Create a short demo to begin.</p></div>';
    return;
  }
  elements.machineNarrationList.innerHTML = book.narrations.map((narration) => narrationCard(book, narration)).join('');
}

async function hydrateDashboard() {
  await refreshData();
  renderBookList();
  renderSelectedBook();
  renderVoiceList();
  renderEngines();
  renderJobs();
  renderNarrations();
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
    common.renderNotice(elements.machineLoginMessage, '', 'info');
    await refreshSession();
    setGate();
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.machineLoginMessage, error.message, 'error');
  }
}

async function handleLogout() {
  await api('/api/session/logout', { method: 'POST' });
  await refreshSession();
  setGate();
}

async function importLocalBooks() {
  try {
    const result = await api('/api/books/import-local', { method: 'POST' });
    common.renderNotice(elements.machineMessage, `Imported ${result.imported_count} books.`, 'info');
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.machineMessage, error.message, 'error');
  }
}

async function uploadBook(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    await api('/api/books/upload', { method: 'POST', body: formData });
    event.currentTarget.reset();
    common.renderNotice(elements.machineMessage, 'Book uploaded.', 'info');
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.machineMessage, error.message, 'error');
  }
}

async function uploadVoice(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const voice = await api('/api/voice-profiles', { method: 'POST', body: formData });
    state.selectedVoiceId = voice.voice_profile_id;
    event.currentTarget.reset();
    common.renderNotice(elements.machineMessage, `Voice pack saved with ${voice.sample_count || 0} samples.`, 'info');
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.machineMessage, error.message, 'error');
  }
}

async function runVoiceComparison() {
  const voice = selectedVoice();
  if (!voice) {
    common.renderNotice(elements.machineMessage, 'Select a voice pack before running the comparison.', 'warn');
    return;
  }
  state.compareBusy = true;
  renderSelectedVoice();
  try {
    await api(`/api/voice-profiles/${encodeURIComponent(voice.voice_profile_id)}/compare`, {
      method: 'POST',
      body: JSON.stringify({
        book_id: selectedBook()?.book_id || null,
        language: 'en',
      }),
    });
    common.renderNotice(elements.machineMessage, 'Voice comparison finished. Listen to A/B/C and choose the best base preset.', 'info');
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.machineMessage, error.message, 'error');
  } finally {
    state.compareBusy = false;
    renderSelectedVoice();
  }
}

async function setPreferredPreset(preset) {
  const voice = selectedVoice();
  if (!voice) {
    return;
  }
  try {
    await api(`/api/voice-profiles/${encodeURIComponent(voice.voice_profile_id)}/preferred-preset`, {
      method: 'POST',
      body: JSON.stringify({ preset }),
    });
    common.renderNotice(elements.machineMessage, `Preferred preset updated to ${preset.replaceAll('_', ' ')}.`, 'info');
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.machineMessage, error.message, 'error');
  }
}

async function createNarration(event) {
  event.preventDefault();
  const book = selectedBook();
  if (!book) {
    common.renderNotice(elements.machineMessage, 'Select a book before rendering.', 'warn');
    return;
  }

  const engine = state.engines.find((item) => item.key === elements.machineEngineSelect.value);
  const voice = selectedVoice();
  if (engine?.requires_voice_profile && !voice) {
    common.renderNotice(elements.machineMessage, 'This engine needs a saved voice pack.', 'warn');
    return;
  }

  try {
    await api(`/api/books/${encodeURIComponent(book.book_id)}/narrations`, {
      method: 'POST',
      body: JSON.stringify({
        engine: elements.machineEngineSelect.value,
        voice_profile_id: voice?.voice_profile_id || null,
        sample_mode: voice?.preferred_preset || voice?.default_sample_mode || null,
        render_scope: elements.machineScopeSelect.value,
        language: elements.machineLanguageSelect.value,
      }),
    });
    common.renderNotice(elements.machineMessage, 'Narration added to the queue.', 'info');
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.machineMessage, error.message, 'error');
  }
}

async function approveNarration(narrationId) {
  const book = selectedBook();
  if (!book) {
    return;
  }
  try {
    await api(`/api/books/${encodeURIComponent(book.book_id)}/narrations/${encodeURIComponent(narrationId)}/approve`, {
      method: 'POST',
    });
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.machineMessage, error.message, 'error');
  }
}

async function approveChapter(narrationId, chapterIndex) {
  const book = selectedBook();
  if (!book) {
    return;
  }
  try {
    await api(`/api/books/${encodeURIComponent(book.book_id)}/narrations/${encodeURIComponent(narrationId)}/chapters/${chapterIndex}/approve`, {
      method: 'POST',
    });
    await hydrateDashboard();
  } catch (error) {
    common.renderNotice(elements.machineMessage, error.message, 'error');
  }
}

function bindEvents() {
  elements.machineLoginForm?.addEventListener('submit', handleLogin);
  elements.machineLogoutBtn?.addEventListener('click', handleLogout);
  elements.machineImportBtn?.addEventListener('click', importLocalBooks);
  elements.machineRefreshBtn?.addEventListener('click', hydrateDashboard);
  elements.machineUploadBookForm?.addEventListener('submit', uploadBook);
  elements.machineVoiceForm?.addEventListener('submit', uploadVoice);
  elements.machineRenderForm?.addEventListener('submit', createNarration);
  elements.machineEngineSelect?.addEventListener('change', updateRenderHint);
  elements.machineCompareVoiceBtn?.addEventListener('click', runVoiceComparison);

  elements.machineBookList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-book-id]');
    if (!button) {
      return;
    }
    state.selectedBookId = button.getAttribute('data-book-id');
    renderBookList();
    renderSelectedBook();
    renderNarrations();
  });

  elements.machineVoiceList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-voice-id]');
    if (!button) {
      return;
    }
    state.selectedVoiceId = button.getAttribute('data-voice-id');
    renderVoiceList();
    updateRenderHint();
  });

  elements.machineVoiceComparison?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="set-preferred-preset"]');
    if (!button) {
      return;
    }
    await setPreferredPreset(button.getAttribute('data-preset'));
  });

  elements.machineNarrationList?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) {
      return;
    }
    const action = button.getAttribute('data-action');
    const narrationId = button.getAttribute('data-narration-id');
    if (action === 'approve-narration') {
      await approveNarration(narrationId);
    }
    if (action === 'approve-chapter') {
      await approveChapter(narrationId, button.getAttribute('data-chapter-index'));
    }
  });
}

async function init() {
  bindEvents();
  await refreshSession();
  setGate();
  if (state.session?.authenticated && state.session?.role === 'admin') {
    await hydrateDashboard();
    window.setInterval(() => {
      hydrateDashboard().catch(() => {});
    }, 12000);
  }
}

init().catch((error) => {
  common.renderNotice(elements.machineLoginMessage, error.message, 'error');
});

