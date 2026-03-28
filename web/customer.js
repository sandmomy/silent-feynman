const common = window.BookVoiceCommon;

function requestedStageFromUrl() {
  const stage = new URLSearchParams(window.location.search).get('stage');
  return ['preview', 'login', 'library'].includes(stage) ? stage : 'preview';
}

const state = {
  session: null,
  catalog: [],
  library: [],
  detailBook: null,
  routeSlug: common.slugFromLocation(),
  homeStage: requestedStageFromUrl(),
  authMode: 'register',
  pdfLib: null,
  pdfDocument: null,
  pdfSourceUrl: null,
  pdfPageCount: 0,
  editorialText: null,
  detailPageStart: 1,
};

const elements = {
  customerHomeView: document.querySelector('#customerHomeView'),
  customerDetailView: document.querySelector('#customerDetailView'),
  customerTopState: document.querySelector('#customerTopState'),
  customerTopLogoutBtn: document.querySelector('#customerTopLogoutBtn'),
  customerMessage: document.querySelector('#customerMessage'),
  stagePreviewBtn: document.querySelector('#stagePreviewBtn'),
  stageLoginBtn: document.querySelector('#stageLoginBtn'),
  stageLibraryBtn: document.querySelector('#stageLibraryBtn'),
  stagePreview: document.querySelector('#stagePreview'),
  stageLogin: document.querySelector('#stageLogin'),
  stageLibrary: document.querySelector('#stageLibrary'),
  stageOfferGrid: document.querySelector('#stageOfferGrid'),
  stagePreviewSpotlight: document.querySelector('#stagePreviewSpotlight'),
  stageLoginSpotlight: document.querySelector('#stageLoginSpotlight'),
  stageLibrarySpotlight: document.querySelector('#stageLibrarySpotlight'),
  customerRegisterForm: document.querySelector('#customerRegisterForm'),
  customerSessionCard: document.querySelector('#customerSessionCard'),
  loginContinueWrap: document.querySelector('#loginContinueWrap'),
  googleAuthButton: document.querySelector('#googleAuthButton'),
  customerCatalogList: document.querySelector('#customerCatalogList'),
  libraryStageIntro: document.querySelector('#libraryStageIntro'),
  libraryLockedState: document.querySelector('#libraryLockedState'),
  libraryUnlockedState: document.querySelector('#libraryUnlockedState'),
  libraryShelfCopy: document.querySelector('#libraryShelfCopy'),
};

const stageOrder = ['preview', 'login', 'library'];

const mainOffer = {
  label: 'Introduction chapter',
  price: 'EUR 9.99',
  description: 'Start with the opening chapter, then add the rest of the Frequency Vibes collection one chapter at a time.',
};

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function coverPalette(book) {
  const palettes = [
    ['#5cd5c8', '#234662'],
    ['#efbb72', '#6e3850'],
    ['#74bdf9', '#324f9a'],
    ['#7ad7ab', '#1a5948'],
    ['#d7a1ff', '#3c2f75'],
    ['#ffa087', '#6c415a'],
  ];
  return palettes[hashString(book.slug || book.title || 'book') % palettes.length];
}

function truncate(text, maxLength = 180) {
  const value = String(text || '').trim();
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function profileFor(book) {
  return common.bookProfile(book);
}

function chapterNumber(book) {
  const fromSlug = String(book?.slug || '').match(/book_chapter_(\d+)/i);
  if (fromSlug) {
    return Number(fromSlug[1]);
  }
  const fromTitle = String(book?.title || '').match(/chapter\s+(\d+)/i);
  if (fromTitle) {
    return Number(fromTitle[1]);
  }
  return Number.POSITIVE_INFINITY;
}

function isChapterBook(book) {
  return Number.isFinite(chapterNumber(book));
}

function titleParts(book) {
  const raw = String(book?.title || '').trim();
  const match = raw.match(/^(.*)\s+by\s+(.+)$/i);
  if (match) {
    return {
      title: match[1].trim(),
      author: match[2].trim(),
    };
  }
  return {
    title: raw,
    author: '',
  };
}

function readerTitleMeta(book) {
  const raw = String(titleParts(book).title || book?.title || 'Untitled').trim();
  const chapterNum = chapterNumber(book);
  const chapterLabel = Number.isFinite(chapterNum) ? `Chapter ${chapterNum}` : 'Reading edition';
  const cleanedTitle =
    raw
      .replace(/^book\s+chapter\s+\d+\s*[-:]\s*/i, '')
      .replace(/^chapter\s+\d+\s*[-:]\s*/i, '')
      .trim() || raw;

  return {
    chapterLabel,
    mainTitle: cleanedTitle,
    collectionLabel: 'Frequency Vibes',
  };
}

function isDetailRoute() {
  return Boolean(state.routeSlug);
}

function currentBook() {
  return state.detailBook;
}

function isReaderSession() {
  return Boolean(state.session?.authenticated && state.session?.role === 'customer');
}

function coverMarkup(book, variant = 'standard') {
  const profile = profileFor(book);
  const parts = titleParts(book);
  const [a, b] = coverPalette(book);
  const label = common.hasPublishedAudio(book)
    ? 'Read and listen'
    : (isChapterBook(book) ? 'Chapter edition' : 'Reading edition');
  return `
    <div class="book-cover ${variant}" style="--cover-a:${a};--cover-b:${b};">
      <div class="cover-spine"></div>
      <div class="cover-inner">
        <div class="cover-topline">
          <span class="cover-tag">${common.escapeHtml(label)}</span>
          <span class="cover-edition">Private edition</span>
        </div>
        <div>
          <div class="cover-title">${common.escapeHtml(parts.title || book.title)}</div>
          ${parts.author ? `<div class="cover-author">${common.escapeHtml(parts.author)}</div>` : ''}
        </div>
        <div class="cover-bottom">
          <div class="cover-meta">${common.escapeHtml(profile.priceLabel || 'Private access')}</div>
          <div class="cover-rule"></div>
        </div>
      </div>
    </div>
  `;
}

function bookMeta(book) {
  const parts = [];
  if (book.word_count) {
    parts.push(`${book.word_count} words`);
  }
  if (book.estimated_read_minutes) {
    parts.push(`${book.estimated_read_minutes} min read`);
  }
  parts.push(common.hasPublishedAudio(book) ? 'Audio available' : 'Text only');
  return parts.join(' / ');
}

function offerConfig(book) {
  const profile = profileFor(book);
  const href = profile.ctaUrl || `/library/${encodeURIComponent(book.slug)}`;
  return {
    label: profile.hook || book.title || mainOffer.label,
    price: profile.priceLabel || mainOffer.price,
    description: profile.summary || shelfBlurb(book) || mainOffer.description,
    ctaLabel: profile.ctaLabel || 'Open the offer',
    href,
    external: Boolean(profile.ctaUrl),
  };
}

const shelfBlurbs = {
  book_chapter_1: 'The opening chapter frames frequency as the foundation of the whole project and gives the conceptual doorway into everything that follows.',
  book_chapter_2: 'Practical Frequency turns theory into trainable frequency memory so the body and mind can learn a new state on purpose.',
  book_chapter_3: 'Life Frequency shows how learned states move into work, choices, and everyday situations where frequency becomes lived practice.',
  book_chapter_4: 'Manifestation is reframed here as true frequency management: less wishful thinking, more state, alignment, and direction.',
  book_chapter_5: 'The formula F x A = M brings frequency and action together so manifestation becomes a disciplined method instead of a vague idea.',
  book_chapter_6: 'Frequency Planner translates the method into a daily structure you can repeat, measure, and turn into long-term training.',
  book_chapter_7: 'Life in Frequency expands perception outward, teaching you to read patterns in people, environments, systems, and the world around you.',
  book_chapter_8: 'This chapter pulls the whole project together and shows what Frequency Vibes can become as a movement, a method, and a way of living.',
};

function shelfBlurb(book) {
  const profile = profileFor(book);
  const custom = shelfBlurbs[book.slug];
  if (custom) {
    return custom;
  }
  const preferred = String(profile.summary || profile.hook || book.excerpt || '').replace(/\s+/g, ' ').trim();
  return truncate(preferred || 'A new title in the Frequency Vibes collection.', 170);
}

function sortedShelfBooks(books) {
  return [...books].sort((a, b) => {
    const chapterDelta = chapterNumber(a) - chapterNumber(b);
    if (chapterDelta !== 0) {
      return chapterDelta;
    }
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function pickFeaturedBook() {
  return state.catalog.find((book) => profileFor(book).featured) || state.catalog[0] || null;
}

function renderTopState() {
  let label = common.roleName(state.session?.role);
  if (state.session?.role === 'customer') {
    label = state.session.display_name || state.session.username || 'Reader';
  }
  if (state.session?.role === 'admin') {
    label = 'Admin';
  }
  elements.customerTopState.textContent = label;
  elements.customerTopLogoutBtn.classList.toggle('hidden', !state.session?.authenticated);
}

function setHomeStage(stage) {
  if (stage === 'library' && !state.session?.authenticated) {
    stage = 'login';
  }
  state.homeStage = stage;
  const currentIndex = stageOrder.indexOf(stage);
  elements.customerHomeView?.classList.remove('stage-preview-active', 'stage-login-active', 'stage-library-active');
  elements.customerHomeView?.classList.add(`stage-${stage}-active`);
  for (const key of stageOrder) {
    const index = stageOrder.indexOf(key);
    const isVisible = index === currentIndex;
    const isCurrent = index === currentIndex;
    const isComplete = index < currentIndex;
    elements[`stage${key.charAt(0).toUpperCase()}${key.slice(1)}`]?.classList.toggle('hidden', !isVisible);
    elements[`stage${key.charAt(0).toUpperCase()}${key.slice(1)}`]?.classList.toggle('current', isCurrent);
    elements[`stage${key.charAt(0).toUpperCase()}${key.slice(1)}Btn`]?.classList.toggle('active', isCurrent);
    elements[`stage${key.charAt(0).toUpperCase()}${key.slice(1)}Btn`]?.classList.toggle('complete', isComplete);
  }
}

function setAuthMode(mode) {
  state.authMode = mode === 'signin' ? 'signin' : 'register';
  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-auth-mode') === state.authMode);
  });
  elements.customerRegisterForm?.classList.toggle('hidden', state.authMode !== 'register');
  const loginForm = document.querySelector('#customerLoginForm');
  loginForm?.classList.toggle('hidden', state.authMode !== 'signin');
}

function featuredSpotlightMarkup(book) {
  if (!book) {
    return `
      <article class="empty-card">
        <h3>No featured title yet</h3>
        <p>Once the first book is published, the featured title will appear here.</p>
      </article>
    `;
  }

  const profile = profileFor(book);
    return `
      ${coverMarkup(book, 'preview')}
      <span class="eyebrow">Chapter-first release</span>
      <p>${common.escapeHtml(truncate('Frequency Vibes is being released chapter by chapter. Start with the introduction, then add practice, manifestation, planning, and life in frequency as separate entries.', 110))}</p>
      <div class="spotlight-meta-grid">
        <div class="spotlight-meta-item">
          <strong>Release</strong>
          <span>Single chapters first</span>
        </div>
        <div class="spotlight-meta-item">
          <strong>Path</strong>
          <span>Introduction to daily application</span>
        </div>
      </div>
    `;
}

function renderPreviewStage() {
  const featured = pickFeaturedBook();
  elements.stagePreviewSpotlight.innerHTML = featuredSpotlightMarkup(featured);

  if (!featured) {
    elements.stageOfferGrid.innerHTML = '';
    return;
  }

  const offer = offerConfig(featured);
  elements.stageOfferGrid.innerHTML = `
    <article class="stage-offer-card featured single-offer-card">
      <div class="stage-offer-top">
        <div class="stack-tight">
          <span class="eyebrow">Main offer</span>
          <h3>${common.escapeHtml(offer.label)}</h3>
        </div>
        <span class="stage-offer-price">${common.escapeHtml(offer.price)}</span>
      </div>
      <p>${common.escapeHtml(offer.description)}</p>
    </article>
  `;
}

function renderLoginStage() {
  const googleAvailable = Boolean(state.session?.google_enabled);
  if (elements.googleAuthButton) {
    elements.googleAuthButton.classList.toggle('hidden', !googleAvailable);
  }

  if (!state.session?.authenticated) {
    elements.customerSessionCard.classList.add('hidden');
    elements.customerSessionCard.innerHTML = '';
    elements.loginContinueWrap?.classList.add('hidden');
    setAuthMode(state.authMode);
    return;
  }

  elements.customerSessionCard.classList.remove('hidden');
  elements.customerSessionCard.innerHTML = `<p>${common.escapeHtml(
    isReaderSession()
      ? `Signed in as ${state.session.display_name || state.session.username}. Continue into the library to open your chapters.`
      : 'Signed in as admin. You are previewing the reader experience.'
  )}</p>`;
  elements.loginContinueWrap?.classList.remove('hidden');
  setAuthMode(state.authMode);
}

function renderLibraryCards(books) {
    return sortedShelfBooks(books).map((book) => {
        const offer = offerConfig(book);
        const hasAccess = Boolean(book.has_access);
        const isAuthenticated = Boolean(state.session?.authenticated);
        const formatLabel = common.hasPublishedAudio(book) ? 'Chapter PDF + audio' : 'Chapter PDF';
      const statusLabel = hasAccess ? 'In your library' : 'Available';
        const actionMarkup = hasAccess
          ? `<a class="button-link primary" href="/library/${encodeURIComponent(book.slug)}">Open chapter</a>`
          : isAuthenticated
            ? (offer.external
                ? `<a class="button-link warm" href="${common.escapeHtml(offer.href)}" target="_blank" rel="noreferrer">Buy now</a>`
                : `<button class="button-link warm" type="button" data-action="buy-book" data-book-slug="${common.escapeHtml(book.slug)}">Buy now</button>`)
            : `<button class="secondary" type="button" data-stage-jump="login">Sign in first</button>`;
        const secondaryMeta = hasAccess ? 'Owned' : offer.price;
      const actionTitle = hasAccess ? 'Continue reading' : (isAuthenticated ? 'Add to your library' : 'Sign in to continue');
        const actionText = hasAccess
          ? 'Open this chapter to continue where you left off.'
          : isAuthenticated
            ? 'Purchase this chapter to unlock it permanently in your library.'
            : 'Sign in first, then return here to get this chapter.';

    return `
    <article class="stage-library-card">
      <div class="stage-library-visual">
        ${coverMarkup(book, 'preview')}
      </div>
      <div class="stage-library-copy">
        <div class="stage-library-header">
          <div class="stack-tight">
            <span class="eyebrow">${common.escapeHtml(hasAccess ? 'Your chapter' : 'Single chapter')}</span>
            <h3>${common.escapeHtml(book.title)}</h3>
            <p>${common.escapeHtml(shelfBlurb(book))}</p>
          </div>
          <div class="stage-library-state">
            <span class="stage-library-price">${common.escapeHtml(secondaryMeta)}</span>
            <span class="pill">${common.escapeHtml(statusLabel)}</span>
          </div>
        </div>
        <div class="pill-row compact-pill-row">
          <span class="pill">${common.escapeHtml(formatLabel)}</span>
        </div>
        <div class="stage-library-footer">
          <div class="stage-library-meta">
            <span>${common.escapeHtml(bookMeta(book))}</span>
          </div>
        </div>
      </div>
      <div class="stage-library-action-panel">
        <span class="eyebrow">${common.escapeHtml(hasAccess ? 'Ready' : (isAuthenticated ? 'Get this chapter' : 'Sign in required'))}</span>
        <h4>${common.escapeHtml(actionTitle)}</h4>
        <p>${common.escapeHtml(actionText)}</p>
        <div class="actions stage-library-actions">
          ${actionMarkup}
        </div>
      </div>
    </article>
  `;
  }).join('');
}

function renderLibraryStage() {
  elements.stageLibrarySpotlight.innerHTML = '';
  elements.libraryLockedState.classList.add('hidden');
  elements.libraryLockedState.innerHTML = '';
  const baseIntro = 'Frequency Vibes is being released chapter by chapter. Start with the introduction, then add the next parts of the method: practical frequency, manifestation, planning, and daily application.';
  const baseShelfCopy = 'Each chapter is a paid entry into one part of the project. Buy one, read it, then come back here whenever you are ready for the next chapter.';

  if (!state.session?.authenticated) {
    elements.libraryStageIntro.textContent = baseIntro;
    elements.libraryShelfCopy.textContent = baseShelfCopy;
    elements.libraryUnlockedState.classList.remove('hidden');
    elements.customerCatalogList.innerHTML = state.catalog.length
      ? renderLibraryCards(state.catalog)
      : `
          <article class="empty-card stage-empty-state">
            <h3>No books on the shelf yet</h3>
            <p>Once new titles are published, they will appear here as editions on the shelf.</p>
          </article>
        `;
    return;
  }

    if (isReaderSession()) {
        const ownedCount = state.catalog.filter((book) => book.has_access).length;
        elements.libraryStageIntro.textContent = baseIntro;
        elements.libraryShelfCopy.textContent = ownedCount
          ? 'The chapters you already bought stay ready here. The rest of the collection remains available whenever you want to add the next one.'
          : 'Your shelf is ready. Start with the chapter you want first, then build the collection from there.';
      elements.libraryUnlockedState.classList.remove('hidden');
      elements.customerCatalogList.innerHTML = state.catalog.length
        ? renderLibraryCards(state.catalog)
        : `
          <article class="empty-card stage-empty-state">
            <h3>No books on the shelf yet</h3>
            <p>Once new titles are published, they will appear here inside your reader shelf.</p>
          </article>
        `;
    return;
  }

    elements.libraryShelfCopy.textContent = state.session.role === 'admin'
      ? 'This is the same chapter shelf your readers will use to buy chapters, keep them in their account, and reopen them later.'
      : 'Each chapter can be bought from here. Once it belongs to the reader, the same card becomes their way back into the chapter.';
    elements.libraryUnlockedState.classList.remove('hidden');
    elements.libraryStageIntro.textContent = state.session.role === 'admin'
      ? 'You are signed in as admin, so this is the same chapter collection your readers will use as the store and returning library for the Frequency Vibes project.'
      : baseIntro;
  const source = state.catalog;
  elements.customerCatalogList.innerHTML = source.length
    ? renderLibraryCards(source)
    : `
        <article class="empty-card stage-empty-state">
          <h3>No books here yet</h3>
          <p>Once access is granted or new titles are published, the shelf will fill here automatically.</p>
        </article>
      `;
}

async function handleBuyBook(slug) {
  const messageTarget = elements.customerMessage;
  common.renderNotice(messageTarget, '');
  try {
    await api(`/api/customer/books/${encodeURIComponent(slug)}/purchase`, { method: 'POST' });
    await refreshCatalog();
    await refreshLibrary();
    if (isDetailRoute()) {
      await refreshDetail();
      await renderDetail();
    } else {
      renderHome();
      setHomeStage('library');
    }
    common.renderNotice(messageTarget, 'The book is now in your library. You can open it from this same shelf.', 'success');
  } catch (error) {
    common.renderNotice(messageTarget, error.message || 'We could not complete the purchase right now.', 'error');
  }
}

function renderHome() {
  renderTopState();
  common.renderNotice(elements.customerMessage, '');
  elements.customerHomeView.classList.remove('hidden');
  elements.customerDetailView.classList.add('hidden');
  renderPreviewStage();
  renderLoginStage();
  renderLibraryStage();

  if ((isReaderSession() || state.session?.authenticated) && state.homeStage === 'preview') {
    setHomeStage('library');
  } else {
    setHomeStage(state.homeStage || 'preview');
  }
}

const bookElements = {
  purchaseView: document.querySelector('#bookPurchaseView'),
  purchaseCover: document.querySelector('#bookPurchaseCover'),
  purchaseInfo: document.querySelector('#bookPurchaseInfo'),
  readerView: document.querySelector('#bookReaderView'),
  readerTitle: document.querySelector('#bookReaderTitle'),
  readerNav: document.querySelector('#bookReaderNav'),
  readerStage: document.querySelector('#bookReaderStage'),
  textScroll: document.querySelector('#bookTextScroll'),
  viewToggle: document.querySelector('#bookViewToggle'),
  readerDock: document.querySelector('#bookReaderDock'),
};

let pageFlipInstance = null;

function isSinglePageMode() {
  // Always show two-page spread (book open)
  return false;
}

function totalSpreads() {
  if (isSinglePageMode()) return state.pdfPageCount;
  return Math.ceil(state.pdfPageCount / 2);
}

function spreadPages(spreadIndex) {
  if (isSinglePageMode()) {
    const p = spreadIndex + 1;
    return p <= state.pdfPageCount ? [p] : [];
  }
  const left = spreadIndex * 2 + 1;
  const right = left + 1;
  if (left > state.pdfPageCount) return [];
  if (right > state.pdfPageCount) return [left];
  return [left, right];
}

function renderMissingDetail(book) {
  const message = book?.message || 'We could not find this title.';
  bookElements.purchaseView.classList.add('hidden');
  bookElements.readerView.classList.add('hidden');
  bookElements.readerStage.innerHTML = `
    <div class="book-missing-state">
      <h2>Book unavailable</h2>
      <p>${common.escapeHtml(message)}</p>
      <a class="button-link ghost" href="/">Back to collection</a>
    </div>
  `;
  bookElements.readerView.classList.remove('hidden');
}

function resetDetailExperienceState() {
  destroyPageFlip();
  state.detailPageStart = 1;
  state.pdfPageCount = 0;
  state.pdfSourceUrl = null;
  if (state.pdfDocument?.destroy) {
    try {
      state.pdfDocument.destroy();
    } catch (_error) {}
  }
  state.pdfDocument = null;
  state.editorialText = null;
}

function bookPdfUrl(book) {
  if (book?.customer_pdf_url) return book.customer_pdf_url;
  if (book?.has_access && book?.source_extension === '.pdf') {
    return `/api/customer/books/${encodeURIComponent(book.slug)}/pdf`;
  }
  return null;
}

function bookUsesPdf(book) {
  return Boolean(bookPdfUrl(book));
}

function currentSpreadIndex() {
  if (isSinglePageMode()) return Math.max(0, (state.detailPageStart || 1) - 1);
  return Math.max(0, Math.floor(((state.detailPageStart || 1) - 1) / 2));
}

function setSpreadIndex(idx) {
  const clamped = Math.max(0, Math.min(idx, totalSpreads() - 1));
  if (isSinglePageMode()) {
    state.detailPageStart = clamped + 1;
  } else {
    state.detailPageStart = clamped * 2 + 1;
  }
}

async function ensurePdfLib() {
  if (state.pdfLib) return state.pdfLib;
  const pdfLib = await import('/pdf.legacy.min.mjs');
  pdfLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.legacy.min.mjs';
  state.pdfLib = pdfLib;
  return pdfLib;
}

async function ensurePdfDocument(book) {
  const pdfUrl = bookPdfUrl(book);
  if (!pdfUrl) return null;
  if (state.pdfDocument && state.pdfSourceUrl === pdfUrl) return state.pdfDocument;
  const pdfLib = await ensurePdfLib();
  const loadingTask = pdfLib.getDocument({ url: pdfUrl, withCredentials: true });
  const pdfDocument = await loadingTask.promise;
  state.pdfDocument = pdfDocument;
  state.pdfSourceUrl = pdfUrl;
  state.pdfPageCount = pdfDocument.numPages;
  return pdfDocument;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   EDITORIAL BOOK ENGINE â€” Parse text â†’ paginate â†’ render
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

async function fetchBookText(book) {
  const slug = book.slug || book.book_id;
  const resp = await fetch(`/api/customer/books/${encodeURIComponent(slug)}/text`, { credentials: 'include' });
  if (!resp.ok) return null;
  return await resp.text();
}

/**
 * Parse plain text into structured blocks:
 * { type: 'chapter-title' | 'section' | 'subsection' | 'emphasis' | 'bullet' | 'paragraph', text }
 *
 * Strategy: first join broken lines into logical paragraphs, then classify.
 */
function parseBookText(raw) {
  // Phase 1: Split into raw lines, join continuation lines, group by blank-line breaks
  const rawLines = raw.split('\n');
  const groups = [];   // each group = array of trimmed non-empty lines separated by blank lines
  let current = [];

  for (const rawLine of rawLines) {
    const t = rawLine.trim();
    if (!t) {
      if (current.length) { groups.push(current); current = []; }
    } else {
      current.push(t);
    }
  }
  if (current.length) groups.push(current);

  // Phase 2: For each group, join lines that are continuations (broken mid-sentence)
  const joined = [];
  for (const group of groups) {
    let merged = group[0];
    for (let j = 1; j < group.length; j++) {
      const prev = merged;
      const cur = group[j];
      // If current line starts with bullet, keep separate
      if (cur.startsWith('â€¢')) {
        joined.push(merged);
        merged = cur;
        continue;
      }
      // If previous ends with hyphen (word break), join without space
      if (prev.endsWith('-') && !prev.endsWith('â€”')) {
        merged = prev.slice(0, -1) + cur;
      } else {
        // Join as continuation
        merged += ' ' + cur;
      }
    }
    joined.push(merged);
  }

  // Phase 3: Classify each joined line into block types
  const blocks = [];

  for (let i = 0; i < joined.length; i++) {
    const line = joined[i];

    // Chapter heading: "Chapter N ..." followed by a subtitle on the next group
    const chMatch = line.match(/^(Chapter\s+\d+\.?)\s+(.*)/i);
    if (chMatch && chMatch[2].length < 120) {
      blocks.push({ type: 'chapter-title', text: chMatch[2], number: chMatch[1] });
      continue;
    }
    // Standalone "Chapter N" (title on next line)
    if (/^Chapter\s+\d+\.?\s*$/i.test(line)) {
      const nextTitle = (i + 1 < joined.length) ? joined[i + 1] : '';
      blocks.push({ type: 'chapter-title', text: nextTitle, number: line });
      if (nextTitle) i++; // skip the title line
      continue;
    }

    // Introduction / Conclusion headings
    if (/^(Introduction|Conclusion)$/i.test(line)) {
      blocks.push({ type: 'section', text: line });
      continue;
    }

    // Numbered section heading: "N. Title text" (short)
    if (/^\d+\.\s+/.test(line) && line.length < 120) {
      blocks.push({ type: 'section', text: line });
      continue;
    }

    // Bullet list (line contains multiple bullets joined)
    if (line.startsWith('â€¢')) {
      const items = line.split('â€¢').filter(s => s.trim()).map(s => s.trim());
      blocks.push({ type: 'bullet', items });
      continue;
    }

    // Subsection: short line ending with colon
    if (line.length < 100 && line.endsWith(':') && !line.startsWith('â€¢')) {
      blocks.push({ type: 'subsection', text: line });
      continue;
    }

    // Emphasis: short standalone declaration (italic-style), no period, often has â€” or strong voice
    if (line.length < 140 && blocks.length > 0 &&
        !line.endsWith('.') && !line.startsWith('â€¢') && !line.match(/^\d/) &&
        (line.includes('â€”') || line.includes('not ') || /^[A-Z][^.]*$/.test(line))) {
      blocks.push({ type: 'emphasis', text: line });
      continue;
    }

    // Regular paragraph
    blocks.push({ type: 'paragraph', text: line });
  }

  return blocks;
}

/**
 * Render a block to HTML string
 */
function blockToHTML(block, isFirstContent) {
  switch (block.type) {
    case 'section':
      return `<h3 class="ed-section-title">${common.escapeHtml(block.text)}</h3>`;
    case 'subsection':
      return `<p class="ed-subsection">${common.escapeHtml(block.text)}</p>`;
    case 'emphasis':
      return `<span class="ed-emphasis">${common.escapeHtml(block.text)}</span>`;
    case 'bullet':
      return `<ul class="ed-list">${block.items.map(b => `<li>${common.escapeHtml(b)}</li>`).join('')}</ul>`;
    case 'paragraph':
      const cls = isFirstContent ? 'drop-cap' : '';
      return `<p${cls ? ` class="${cls}"` : ''}>${common.escapeHtml(block.text)}</p>`;
    default:
      return `<p>${common.escapeHtml(block.text || '')}</p>`;
  }
}

/**
 * Create the cover page HTML
 */
function createCoverHTML(book) {
  const title = book.title || 'Untitled';
  const author = 'Eugene Mierak';
  return `<div class="editorial-cover">
    <span class="cover-subtitle">BookVoice Editions</span>
    <span class="cover-ornament"></span>
    <svg class="cover-sacred" viewBox="0 0 100 100" fill="none" stroke="rgba(100,80,55,0.4)" stroke-width="0.8">
      <circle cx="50" cy="50" r="38"/>
      <circle cx="50" cy="50" r="28" stroke-dasharray="3 3"/>
      <circle cx="50" cy="50" r="16"/>
      <circle cx="50" cy="50" r="3" fill="rgba(100,80,55,0.3)"/>
      <line x1="50" y1="10" x2="50" y2="90" opacity="0.3"/>
      <line x1="10" y1="50" x2="90" y2="50" opacity="0.3"/>
      <line x1="22" y1="22" x2="78" y2="78" opacity="0.2"/>
      <line x1="78" y1="22" x2="22" y2="78" opacity="0.2"/>
    </svg>
    <span class="cover-ornament"></span>
    <h1 class="cover-title">${common.escapeHtml(title)}</h1>
    <span class="cover-ornament"></span>
    <span class="cover-author">${common.escapeHtml(author)}</span>
  </div>`;
}

/**
 * Create the chapter title page HTML
 */
function createChapterHeadHTML(block) {
  return `<div class="editorial-chapter-head">
    <span class="ch-number">${common.escapeHtml(block.number || '')}</span>
    <h2 class="ch-title">${common.escapeHtml(block.text)}</h2>
    <span class="ch-ornament"><span>âœ¦</span></span>
  </div>`;
}

/**
 * Paginate blocks into pages that fit a given height.
 * Uses a hidden measurer div to calculate real text heights.
 */
function paginateBlocks(blocks, pageWidth, pageHeight, book) {
  const pages = [];

  // Page 1: Cover
  pages.push({ type: 'cover', html: createCoverHTML(book) });

  // Find chapter title block
  const chapterIdx = blocks.findIndex(b => b.type === 'chapter-title');
  let contentBlocks = blocks;
  if (chapterIdx >= 0) {
    // Page 2: Chapter title page
    pages.push({ type: 'chapter-head', html: createChapterHeadHTML(blocks[chapterIdx]) });
    contentBlocks = blocks.slice(chapterIdx + 1);
  }

  // Create measurer â€” match exact inner width (pageWidth minus 10% padding each side = 80%)
  const innerWidth = Math.floor(pageWidth * 0.80);
  const measurer = document.createElement('div');
  measurer.className = 'editorial-inner';
  measurer.style.cssText = `position:absolute;visibility:hidden;width:${innerWidth}px;height:auto;left:-9999px;top:0;font-size:${pageWidth < 350 ? '0.72rem' : '0.82rem'};`;
  document.body.appendChild(measurer);

  // Usable height = page height minus top padding (12%) minus bottom padding (10%) minus page number area
  const usableHeight = Math.floor(pageHeight * 0.74);
  let currentPageHTML = '';
  let currentHeight = 0;
  let isFirstContent = true;
  let pageNum = 0;

  for (const block of contentBlocks) {
    const html = blockToHTML(block, isFirstContent);
    if (block.type === 'paragraph' && isFirstContent) isFirstContent = false;

    // Measure this block
    measurer.innerHTML = html;
    const blockH = measurer.scrollHeight;

    // If a single block is taller than a page, force it onto its own page
    if (blockH > usableHeight) {
      if (currentPageHTML) {
        pageNum++;
        pages.push({ type: 'content', html: currentPageHTML, pageNum });
        currentPageHTML = '';
        currentHeight = 0;
      }
      pageNum++;
      pages.push({ type: 'content', html: html, pageNum });
      continue;
    }

    // Would overflow? Start new page
    if (currentHeight + blockH > usableHeight && currentPageHTML) {
      pageNum++;
      pages.push({ type: 'content', html: currentPageHTML, pageNum });
      currentPageHTML = '';
      currentHeight = 0;
    }

    currentPageHTML += html;
    currentHeight += blockH;
  }

  // Flush remaining content
  if (currentPageHTML) {
    pageNum++;
    pages.push({ type: 'content', html: currentPageHTML, pageNum });
  }

  document.body.removeChild(measurer);

  // If odd number of pages, add a blank end page
  if (pages.length % 2 !== 0) {
    pages.push({ type: 'blank', html: '' });
  }

  return pages;
}

/**
 * Build editorial page-flip book from text
 */
async function initEditorialPageFlip(book, rawText) {
  destroyPageFlip();
  const stageWrap = document.querySelector('.book-reader-stage-wrap');
  if (!stageWrap) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ratio = 1.414;
  const topMargin = vh <= 768 ? 32 : 40;
  const bottomMargin = vh <= 768 ? 42 : 56;
  const sideMargin = vw <= 860 ? 8 : 16;
  const usableH = vh - topMargin - bottomMargin;
  const usableW = vw - sideMargin * 2;
  const maxPageH = usableH - 16;
  const pageWFromH = Math.floor(maxPageH / ratio);
  const pageWFromW = Math.min(Math.floor((usableW - 8) / 2), 560);
  let pw = Math.min(pageWFromH, pageWFromW);
  if (pw < 140) pw = 140;
  const ph = Math.floor(pw * ratio);

  // Parse and paginate
  const blocks = parseBookText(rawText);
  const pages = paginateBlocks(blocks, pw, ph, book);
  state.pdfPageCount = pages.length;

  // Build page divs
  const flipContainer = document.createElement('div');
  flipContainer.id = 'pageFlipBook';
  flipContainer.className = 'page-flip-book';
  bookElements.readerStage.innerHTML = '';
  bookElements.readerStage.appendChild(flipContainer);

  pages.forEach((page, i) => {
    const div = document.createElement('div');
    div.className = 'pf-page editorial-page';
    if (i === 0 || i === pages.length - 1) div.dataset.density = 'hard';

    let innerHTML = '';
    if (page.type === 'cover' || page.type === 'chapter-head') {
      innerHTML = `<div class="editorial-inner">${page.html}</div>`;
    } else if (page.type === 'content') {
      innerHTML = `<div class="editorial-page-border"></div>
        <div class="editorial-inner">${page.html}</div>
        <span class="editorial-page-number">${page.pageNum}</span>`;
    } else {
      innerHTML = `<div class="editorial-page-border"></div><div class="editorial-inner"></div>`;
    }
    div.innerHTML = innerHTML;
    flipContainer.appendChild(div);
  });

  // Init PageFlip
  const PageFlip = window.St?.PageFlip;
  if (!PageFlip) return;

  pageFlipInstance = new PageFlip(flipContainer, {
    width: pw,
    height: ph,
    size: 'fixed',
    drawShadow: true,
    flippingTime: 700,
    usePortrait: false,
    startZIndex: 0,
    autoSize: true,
    maxShadowOpacity: 0.7,
    showCover: true,
    mobileScrollSupport: true,
    swipeDistance: 30,
    clickEventForward: true,
    useMouseEvents: true,
    startPage: 0,
  });

  pageFlipInstance.loadFromHTML(flipContainer.querySelectorAll('.pf-page'));

  pageFlipInstance.on('flip', (e) => {
    state.detailPageStart = e.data + 1;
    updateBookNav();
    updateProgress();
    triggerFlipEffects();
  });

  updateBookNav();
  initReaderUI();
}

async function renderPageToCanvas(pageNumber, canvas, maxWidth) {
  if (!state.pdfDocument || !pageNumber || !canvas) return;
  const page = await state.pdfDocument.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const targetWidth = maxWidth || Math.max(200, canvas.parentElement?.clientWidth || 400);
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f6efe3';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
}

function bookPageWidth() {
  const stageWrap = document.querySelector('.book-reader-stage-wrap');
  if (!stageWrap) return 360;
  const available = stageWrap.clientWidth - 48;
  return Math.min(Math.floor((available - 10) / 2), 480);
}

function bookPageHeight(pageWidth) {
  return Math.floor(pageWidth * 1.414);
}

/* â”€â”€ Page flip visual effects â”€â”€ */
function triggerFlipEffects() {
  // Append all effects to stage-wrap (NOT readerStage) to avoid interfering with PageFlip layout
  const wrap = document.querySelector('.book-reader-stage-wrap');
  if (!wrap) return;

  // 1. Light flash
  const flash = document.createElement('div');
  flash.className = 'flip-light-flash';
  wrap.appendChild(flash);
  setTimeout(() => flash.remove(), 700);

  // 2. Shimmer on the visible page area
  const stfParent = wrap.querySelector('.stf__parent');
  if (stfParent) {
    const shimmer = document.createElement('div');
    shimmer.className = 'flip-shimmer';
    stfParent.appendChild(shimmer);
    setTimeout(() => shimmer.remove(), 900);
  }

  // 3. Particles from the center spine
  const container = document.createElement('div');
  container.className = 'flip-particles-container';
  const count = 8;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'flip-particle';
    const dx = (Math.random() - 0.5) * 120;
    const dy = -20 + Math.random() * -60;
    const yPos = 20 + Math.random() * 60;
    const delay = (Math.random() * 0.25).toFixed(2);
    const size = 1.5 + Math.random() * 2.5;
    p.style.cssText = `top:${yPos}%;left:50%;width:${size}px;height:${size}px;animation-delay:${delay}s;--fp-dx:${dx}px;--fp-dy:${dy}px;`;
    container.appendChild(p);
  }
  wrap.appendChild(container);
  setTimeout(() => container.remove(), 1200);
}

/* â”€â”€ View toggle: slides PDF â†” original PDF â”€â”€ */
let currentReaderView = 'slides'; // 'slides' or 'original'
let slidesPdfUrl = null;
let originalPdfUrl = null;

async function toggleReaderView() {
  const book = currentBook();
  if (!book) return;
  const toggle = bookElements.viewToggle;

  if (currentReaderView === 'slides') {
    // Switch to original chapter PDF
    currentReaderView = 'original';
    if (toggle) { toggle.textContent = 'Visual slides'; toggle.classList.add('active'); }
    const origUrl = originalPdfUrl || bookPdfUrl(book);
    if (origUrl && state.pdfSourceUrl !== origUrl) {
      const pdfLib = await ensurePdfLib();
      const doc = await pdfLib.getDocument({ url: origUrl, withCredentials: true }).promise;
      state.pdfDocument = doc;
      state.pdfSourceUrl = origUrl;
      state.pdfPageCount = doc.numPages;
    }
    state.detailPageStart = 1;
    await initPageFlip();
  } else {
    // Switch back to slides PDF
    currentReaderView = 'slides';
    if (toggle) { toggle.textContent = 'Original PDF'; toggle.classList.remove('active'); }
    if (slidesPdfUrl && state.pdfSourceUrl !== slidesPdfUrl) {
      const pdfLib = await ensurePdfLib();
      const doc = await pdfLib.getDocument({ url: slidesPdfUrl, withCredentials: true }).promise;
      state.pdfDocument = doc;
      state.pdfSourceUrl = slidesPdfUrl;
      state.pdfPageCount = doc.numPages;
    }
    state.detailPageStart = 1;
    await initPageFlip();
  }
}

function renderAudioDock(book) {
  if (!bookElements.readerDock) return;
  bookElements.readerDock.classList.remove('hidden');
  const audioUrl = book?.customer_audio_url || null;
  if (audioUrl) {
    if (bookElements.readerDock.dataset.source === audioUrl && bookElements.readerDock.innerHTML.trim()) return;
    bookElements.readerDock.dataset.source = audioUrl;
    bookElements.readerDock.innerHTML = `
      <div class="book-reader-dock-inner audio-ready">
        <span class="book-reader-dock-status ready">Audio ready</span>
        <audio controls preload="metadata" src="${common.escapeHtml(audioUrl)}"></audio>
      </div>
    `;
  } else {
    bookElements.readerDock.dataset.source = '';
    bookElements.readerDock.innerHTML = `
      <div class="book-reader-dock-inner audio-soon">
        <span class="book-reader-dock-status soon">Audio coming</span>
        <span class="book-reader-dock-soon-note">A narrated version of this chapter is being prepared.</span>
      </div>
    `;
  }
}

function updateBookNav() {
  if (!pageFlipInstance) return;
  const book = currentBook();
  const meta = readerTitleMeta(book);
  const currentPage = pageFlipInstance.getCurrentPageIndex();
  const totalPages = state.pdfPageCount;
  const orientation = pageFlipInstance.getOrientation();
  let pageLabel;
  if (orientation === 'portrait') {
    pageLabel = `Page ${currentPage + 1} of ${totalPages}`;
  } else {
    const left = currentPage + 1;
    const right = Math.min(currentPage + 2, totalPages);
    pageLabel = left === right
      ? `Page ${left} of ${totalPages}`
      : `Pages ${left}\u2013${right} of ${totalPages}`;
  }

  bookElements.readerTitle.innerHTML = `
    <span class="book-title-kicker">${common.escapeHtml(`${meta.collectionLabel} - ${meta.chapterLabel}`)}</span>
    <span class="book-title-main">${common.escapeHtml(meta.mainTitle || 'Book')}</span>
    <span class="book-title-page">${common.escapeHtml(pageLabel)}</span>
  `;

  bookElements.readerNav.innerHTML = `
    <span class="reader-meta-pill">${common.escapeHtml(meta.chapterLabel)}</span>
    <span class="reader-meta-pill">${common.escapeHtml(currentReaderView === 'slides' ? 'Guided pages' : 'Original PDF')}</span>
    <span class="reader-meta-pill ${common.hasPublishedAudio(book) ? 'is-ready' : 'is-soon'}">${common.escapeHtml(common.hasPublishedAudio(book) ? 'Audio ready' : 'Audio soon')}</span>
  `;

  const isFirst = currentPage <= 0;
  const isLast = currentPage >= totalPages - 1;

  // Sync center tabs
  const tabPrev = document.querySelector('#bookTabPrev');
  const tabNext = document.querySelector('#bookTabNext');
  if (tabPrev) tabPrev.disabled = isFirst;
  if (tabNext) tabNext.disabled = isLast;
}

async function renderPageToDiv(pageNumber, container, targetWidth) {
  if (!state.pdfDocument || !pageNumber || !container) return;
  const page = await state.pdfDocument.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const tw = targetWidth || container.clientWidth || 400;
  const scale = tw / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const dpr = window.devicePixelRatio || 1;

  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.cssText = 'display:block;width:100%;height:100%;object-fit:fill;';
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f6efe3';
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
}

function destroyPageFlip() {
  cleanupReaderUI();
  if (pageFlipInstance) {
    try { pageFlipInstance.destroy(); } catch (_e) {}
    pageFlipInstance = null;
  }
}

async function initPageFlip() {
  destroyPageFlip();
  const stageWrap = document.querySelector('.book-reader-stage-wrap');
  if (!stageWrap) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Detect page ratio from the PDF's first page
  let ratio = 1.414; // default A4 portrait
  if (state.pdfDocument) {
    try {
      const firstPage = await state.pdfDocument.getPage(1);
      const vp = firstPage.getViewport({ scale: 1 });
      ratio = vp.height / vp.width;
      // If landscape (ratio < 1), treat as landscape slides
      if (ratio < 1) ratio = ratio; // keep landscape ratio
    } catch (_e) {}
  }
  const isLandscape = ratio < 1;

  // Book fills the viewport â€” leave only small margins
  const topMargin = vh <= 768 ? 32 : 40;
  const bottomMargin = vh <= 768 ? 42 : 56;
  const sideMargin = vw <= 860 ? 8 : 16;
  const usableH = vh - topMargin - bottomMargin;
  const usableW = vw - sideMargin * 2;

  // Always two-page spread: each page is half the available width
  let pw, ph;
  const maxPageH = usableH - 16;
  if (isLandscape) {
    // Landscape slides: two side by side — each page = half width
    const pageWFromW = Math.min(Math.floor((usableW - 10) / 2), 560);
    const pageWFromH = Math.floor(maxPageH / ratio);
    pw = Math.min(pageWFromW, pageWFromH);
    if (pw < 160) pw = 160;
    ph = Math.floor(pw * ratio);
  } else {
    // Portrait: height-first, two pages side by side
    const pageWFromH = Math.floor(maxPageH / ratio);
    const pageWFromW = Math.min(Math.floor((usableW - 8) / 2), 560);
    pw = Math.min(pageWFromH, pageWFromW);
    if (pw < 140) pw = 140;
    ph = Math.floor(pw * ratio);
  }

  const flipContainer = document.createElement('div');
  flipContainer.id = 'pageFlipBook';
  flipContainer.className = 'page-flip-book';
  bookElements.readerStage.innerHTML = '';
  bookElements.readerStage.appendChild(flipContainer);

  for (let i = 1; i <= state.pdfPageCount; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'pf-page';
    pageDiv.dataset.pageNumber = i;
    if (i === 1 || i === state.pdfPageCount) {
      pageDiv.dataset.density = 'hard';
    }
    flipContainer.appendChild(pageDiv);
  }

  const PageFlip = window.St?.PageFlip;
  if (!PageFlip) {
    console.error('StPageFlip not loaded');
    return;
  }

  pageFlipInstance = new PageFlip(flipContainer, {
    width: pw,
    height: ph,
    size: 'fixed',
    drawShadow: true,
    flippingTime: 700,
    usePortrait: false,
    startZIndex: 0,
    autoSize: true,
    maxShadowOpacity: 0.7,
    showCover: true,
    mobileScrollSupport: true,
    swipeDistance: 30,
    clickEventForward: true,
    useMouseEvents: true,
    startPage: 0,
  });

  pageFlipInstance.loadFromHTML(flipContainer.querySelectorAll('.pf-page'));
  // Store landscape state for reference
  state.pdfLandscape = isLandscape;

  const renderQueue = [];
  for (let i = 1; i <= state.pdfPageCount; i++) {
    renderQueue.push(i);
  }

  const firstVisible = [1, 2, 3].filter(p => p <= state.pdfPageCount);
  const renderBatch = async (pages) => {
    for (const p of pages) {
      const div = flipContainer.querySelector(`.pf-page[data-page-number="${p}"]`);
      if (div && !div.dataset.rendered) {
        div.dataset.rendered = '1';
        await renderPageToDiv(p, div, pw);
      }
    }
  };

  await renderBatch(firstVisible);

  pageFlipInstance.on('flip', async (e) => {
    const cp = e.data;
    state.detailPageStart = cp + 1;
    updateBookNav();
    updateProgress();
    triggerFlipEffects();
    const nearby = [cp - 1, cp, cp + 1, cp + 2, cp + 3].filter(p => p >= 0 && p < state.pdfPageCount);
    await renderBatch(nearby.map(p => p + 1));
  });

  pageFlipInstance.on('changeState', async (e) => {
    if (e.data === 'flipping') {
      const cp = pageFlipInstance.getCurrentPageIndex();
      const ahead = [cp + 2, cp + 3, cp + 4, cp + 5].filter(p => p >= 0 && p < state.pdfPageCount);
      await renderBatch(ahead.map(p => p + 1));
    }
  });

  const remainingPages = renderQueue.filter(p => !firstVisible.includes(p));
  (async () => {
    for (let i = 0; i < remainingPages.length; i += 3) {
      await new Promise(r => setTimeout(r, 60));
      const batch = remainingPages.slice(i, i + 3);
      await renderBatch(batch);
    }
  })();

  updateBookNav();
  initReaderUI();
}

async function flipPage(direction) {
  if (!pageFlipInstance) return;
  if (direction === 'next') {
    pageFlipInstance.flipNext('top');
  } else {
    pageFlipInstance.flipPrev('top');
  }
}

/* â”€â”€ Immersive UI: auto-hide, progress, hint, fullscreen â”€â”€ */

let uiHideTimer = null;
let readerHintShown = false;

function showReaderUI() {
  const wrap = document.querySelector('.book-reader-stage-wrap');
  if (!wrap) return;
  wrap.classList.remove('ui-hidden');
  clearTimeout(uiHideTimer);
  uiHideTimer = setTimeout(() => {
    if (pageFlipInstance) wrap.classList.add('ui-hidden');
  }, 3500);
}

function initReaderUI() {
  const wrap = document.querySelector('.book-reader-stage-wrap');
  if (!wrap) return;

  // Auto-hide on mouse inactivity
  wrap.addEventListener('mousemove', showReaderUI);
  wrap.addEventListener('click', showReaderUI);
  wrap.addEventListener('touchstart', showReaderUI);
  showReaderUI();

  // Progress bar
  const progressEl = document.createElement('div');
  progressEl.className = 'book-reader-progress';
  progressEl.innerHTML = '<div class="book-reader-progress-fill" style="width:0%"></div>';
  wrap.appendChild(progressEl);
  updateProgress();

  // Keyboard hint (once per session)
  if (!readerHintShown) {
    readerHintShown = true;
    const hint = document.createElement('div');
    hint.className = 'book-reader-hint';
    hint.textContent = common.hasPublishedAudio(currentBook())
      ? '\u2190 \u2192 to turn pages Â· use the dock below to listen'
      : '\u2190 \u2192 to turn pages';
    wrap.appendChild(hint);
    setTimeout(() => { if (hint.parentNode) hint.remove(); }, 5000);
  }

  // Double-click for fullscreen
  const stage = document.querySelector('#bookReaderStage');
  if (stage) {
    stage.addEventListener('dblclick', () => {
      const view = document.querySelector('#bookReaderView');
      if (!view) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        view.requestFullscreen().catch(() => {});
      }
    });
  }
}

function updateProgress() {
  const fill = document.querySelector('.book-reader-progress-fill');
  if (!fill || !pageFlipInstance || !state.pdfPageCount) return;
  const current = pageFlipInstance.getCurrentPageIndex() + 1;
  const pct = Math.round((current / state.pdfPageCount) * 100);
  fill.style.width = `${pct}%`;
}

function cleanupReaderUI() {
  clearTimeout(uiHideTimer);
  const wrap = document.querySelector('.book-reader-stage-wrap');
  if (wrap) wrap.classList.remove('ui-hidden');
}

function renderPurchaseView(book) {
  const profile = profileFor(book);
  const offer = offerConfig(book);
  const isAuth = Boolean(state.session?.authenticated);
  const isCustomer = state.session?.role === 'customer';

    bookElements.purchaseCover.innerHTML = coverMarkup(book, 'large');
    let infoHTML = `
      <span class="eyebrow">${common.escapeHtml(book.has_access ? 'In your library' : 'Single chapter')}</span>
      <h1>${common.escapeHtml(book.title)}</h1>
      <p class="book-purchase-desc">${common.escapeHtml(profile.hook || 'A private reading and listening chapter built from the original PDF pages.')}</p>
    `;

    if (book.has_access) {
      infoHTML += `
        <div class="actions">
          <button class="primary" type="button" data-action="enter-book">Open chapter</button>
        </div>
      `;
    } else if (isAuth && isCustomer) {
      infoHTML += `
        <div class="book-purchase-offer">
          <span class="eyebrow">Single chapter</span>
          <strong>${common.escapeHtml(offer.label)}</strong>
          <span class="offer-price">${common.escapeHtml(offer.price)}</span>
          <p class="book-purchase-desc">${common.escapeHtml(offer.description)}</p>
        ${offer.external
          ? `<a class="button-link warm" href="${common.escapeHtml(offer.href)}" target="_blank" rel="noreferrer">Buy now</a>`
          : `<button class="primary warm" type="button" data-action="buy-book" data-book-slug="${common.escapeHtml(book.slug)}">Buy now</button>`}
      </div>
    `;
    } else if (isAuth) {
      infoHTML += `<p class="book-purchase-desc">You are signed in as admin, previewing the chapter storefront.</p>`;
    } else {
      infoHTML += `
        <div class="book-purchase-offer">
          <span class="eyebrow">Sign in to continue</span>
          <p class="book-purchase-desc">Sign in or create an account to buy and open this chapter.</p>
          <form id="detailLoginForm" class="book-purchase-login-form">
          <label>Username or email<input name="username" autocomplete="username" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="primary" type="submit">Sign in</button>
        </form>
        <div id="detailInlineMessage" class="notice hidden"></div>
      </div>
    `;
  }

  bookElements.purchaseInfo.innerHTML = infoHTML;
  bookElements.purchaseView.classList.remove('hidden');
  bookElements.readerView.classList.add('hidden');
}

async function renderBookReader(book) {
  destroyPageFlip();
  bookElements.purchaseView.classList.add('hidden');
  bookElements.readerView.classList.remove('hidden');

  // â”€â”€ Cinematic intro overlay â”€â”€
  const stageWrap = bookElements.readerView.querySelector('.book-reader-stage-wrap');
  const oldIntro = stageWrap.querySelector('.book-intro-overlay');
  if (oldIntro) oldIntro.remove();

  const intro = document.createElement('div');
  intro.className = 'book-intro-overlay';

  // Generate particles with random positions and delays
  let particlesHTML = '<div class="intro-particles">';
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 100;
    const y = 40 + Math.random() * 50;
    const delay = (Math.random() * 1.5).toFixed(2);
    const size = 1.5 + Math.random() * 2;
    particlesHTML += `<span class="intro-particle" style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-delay:${delay}s"></span>`;
  }
  particlesHTML += '</div>';

  intro.innerHTML = `
    ${particlesHTML}
    <div class="intro-sacred">
      <span class="intro-sacred-ring"></span>
      <span class="intro-sacred-ring"></span>
      <span class="intro-sacred-ring"></span>
      <span class="intro-sacred-core"></span>
      <span class="intro-sacred-ray"></span>
      <span class="intro-sacred-ray"></span>
      <span class="intro-sacred-ray"></span>
      <span class="intro-sacred-ray"></span>
      <span class="intro-sacred-ray"></span>
      <span class="intro-sacred-ray"></span>
    </div>
    <span class="intro-title">${common.escapeHtml(book.title)}</span>
    <span class="intro-line"></span>
    <span class="intro-subtitle">BookVoice Reader</span>
  `;
  stageWrap.appendChild(intro);

  // Hide book stage + controls during intro
  bookElements.readerView.classList.add('intro-active');
  bookElements.readerStage.classList.add('intro-pending');
  bookElements.readerStage.innerHTML = `
    <div class="book-loading">
      <div class="book-loading-spinner"></div>
      <span>Opening the book...</span>
    </div>
  `;
  bookElements.readerTitle.innerHTML = `<span class="book-title-main">${common.escapeHtml(book.title)}</span>`;
  bookElements.readerNav.innerHTML = '';

  try {
    state.detailPageStart = 1;

    // Store original PDF URL
    originalPdfUrl = bookPdfUrl(book);

    // Try loading slides PDF first (NotebookLM visual slides)
    const slidesUrl = `/api/customer/books/${encodeURIComponent(book.slug)}/slides`;
    let hasSlides = false;
    try {
      const pdfLib = await ensurePdfLib();
      const doc = await pdfLib.getDocument({ url: slidesUrl, withCredentials: true }).promise;
      state.pdfDocument = doc;
      state.pdfSourceUrl = slidesUrl;
      state.pdfPageCount = doc.numPages;
      slidesPdfUrl = slidesUrl;
      hasSlides = true;
    } catch (slideErr) {
      // No slides available â€” fall back to original PDF
      console.warn('Slides PDF not available, using original:', slideErr.message || slideErr);
      slidesPdfUrl = null;
      await ensurePdfDocument(book);
    }

    currentReaderView = hasSlides ? 'slides' : 'original';
    await initPageFlip();

    renderAudioDock(book);
    if (bookElements.viewToggle) {
      if (hasSlides) {
        bookElements.viewToggle.textContent = 'Original PDF';
        bookElements.viewToggle.classList.remove('active');
        bookElements.viewToggle.style.display = '';
      } else {
        // No slides, no toggle needed
        bookElements.viewToggle.style.display = 'none';
      }
    }

    // Wait for intro to finish, then reveal book + controls
    await new Promise(r => setTimeout(r, 3200));
    bookElements.readerStage.classList.remove('intro-pending');
    bookElements.readerStage.classList.add('intro-reveal');
    bookElements.readerView.classList.remove('intro-active');
    setTimeout(() => {
      intro.remove();
      bookElements.readerStage.classList.remove('intro-reveal');
    }, 1500);
  } catch (error) {
    console.error('Failed to load book:', error);
    intro.remove();
    bookElements.readerStage.classList.remove('intro-pending');
    bookElements.readerStage.innerHTML = `
      <div class="book-missing-state">
        <h2>Could not open the book</h2>
        <p>${common.escapeHtml(error.message || 'The PDF could not be loaded.')}</p>
        <a class="button-link ghost" href="/">Back to collection</a>
      </div>
    `;
  }
}

async function renderDetail() {
  elements.customerHomeView.classList.add('hidden');
  elements.customerDetailView.classList.remove('hidden');
  renderTopState();

  const book = currentBook();
  if (!book || book.missing) {
    renderMissingDetail(book);
    return;
  }

  if (book.has_access && bookUsesPdf(book)) {
    await renderBookReader(book);
  } else {
    renderPurchaseView(book);
  }
}

async function api(path, options) {
  return common.request(path, options);
}

async function refreshSession() {
  state.session = await api('/api/session/status');
}

async function refreshCatalog() {
  state.catalog = await api('/api/customer/catalog');
}

async function refreshLibrary() {
  if (!isReaderSession()) {
    state.library = [];
    return;
  }
  state.library = await api('/api/customer/library');
}

async function refreshDetail() {
  if (!isDetailRoute()) {
    resetDetailExperienceState();
    state.detailBook = null;
    return;
  }
  const previousPdfUrl = state.detailBook?.customer_pdf_url || null;
  const previousSlug = state.detailBook?.slug || null;
  try {
    state.detailBook = await api(`/api/customer/books/${encodeURIComponent(state.routeSlug)}`);
  } catch (error) {
    state.detailBook = { missing: true, title: 'Book unavailable', message: error.message };
  }
  if (state.detailBook?.missing || previousSlug !== state.detailBook?.slug || previousPdfUrl !== (state.detailBook?.customer_pdf_url || null)) {
    resetDetailExperienceState();
  }
}

async function handleLogin(form, target = elements.customerMessage) {
  const formData = new FormData(form);
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '').trim();

  if (!username || !password) {
    common.renderNotice(target, 'Complete both username and password.', 'warn');
    return;
  }

  try {
    await api('/api/session/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    form.reset();
    common.renderNotice(target, 'Signed in.', 'info');
    state.homeStage = 'library';
    await hydrate();
  } catch (error) {
    common.renderNotice(target, error.message, 'error');
  }
}

async function handleRegister(form, target = elements.customerMessage) {
  const formData = new FormData(form);
  const displayName = String(formData.get('display_name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '').trim();

  if (!displayName || !email || !password) {
    common.renderNotice(target, 'Complete name, email, and password.', 'warn');
    return;
  }

  try {
    await api('/api/session/register', {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName, email, password }),
    });
    form.reset();
    common.renderNotice(target, 'Account created. You are now inside.', 'info');
    state.homeStage = 'library';
    await hydrate();
  } catch (error) {
    common.renderNotice(target, error.message, 'error');
  }
}

async function handleLogout() {
  try {
    await api('/api/session/logout', { method: 'POST' });
    resetDetailExperienceState();
    state.homeStage = 'preview';
    common.renderNotice(elements.customerMessage, 'Signed out.', 'info');
    await hydrate();
  } catch (error) {
    common.renderNotice(elements.customerMessage, error.message, 'error');
  }
}

async function hydrate() {
  await refreshSession();
  await refreshCatalog();
  await refreshLibrary();
  await refreshDetail();

  if (isDetailRoute()) {
    await renderDetail();
    return;
  }

  renderHome();
}

function bindEvents() {
  elements.customerTopLogoutBtn?.addEventListener('click', handleLogout);

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (form?.id === 'customerRegisterForm') {
      event.preventDefault();
      await handleRegister(form, elements.customerSessionCard);
    }
    if (form?.id === 'customerLoginForm') {
      event.preventDefault();
      await handleLogin(form, elements.customerSessionCard);
    }
    if (form?.id === 'detailLoginForm') {
      event.preventDefault();
      const target = document.querySelector('#detailInlineMessage');
      await handleLogin(form, target);
    }
  });

  document.addEventListener('click', async (event) => {
    const actionHost = event.target.closest('[data-action], [data-stage], [data-stage-jump], [data-auth-mode], [data-google-auth]');
    if (!actionHost) {
      return;
    }

    const stage = actionHost.getAttribute('data-stage') || actionHost.getAttribute('data-stage-jump');
    if (stage && !isDetailRoute()) {
      setHomeStage(stage);
      return;
    }

    const action = actionHost.getAttribute('data-action');
    const authMode = actionHost.getAttribute('data-auth-mode');
    if (authMode) {
      setAuthMode(authMode);
      common.renderNotice(elements.customerSessionCard, '');
      return;
    }
    if (actionHost.hasAttribute('data-google-auth')) {
      common.renderNotice(
        elements.customerSessionCard,
        'Google sign-in will be available soon. Use the form below to register or sign in.',
        'info'
      );
      return;
    }
    if (action === 'buy-book') {
      const slug = actionHost.getAttribute('data-book-slug');
      if (slug) await handleBuyBook(slug);
    }
    if (action === 'book-prev') {
      await flipPage('prev');
    }
    if (action === 'book-next') {
      await flipPage('next');
    }
    if (action === 'toggle-view') {
      toggleReaderView();
    }
    if (action === 'enter-book') {
      const book = currentBook();
      if (book?.has_access && bookUsesPdf(book)) {
        await renderBookReader(book);
      }
    }
    if (action === 'signout') {
      await handleLogout();
    }
  });

  document.addEventListener('keydown', async (event) => {
    if (!isDetailRoute() || !currentBook()?.has_access) return;
    if (event.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        window.location.hash = '';
        window.location.pathname = '/';
      }
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      await flipPage('next');
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      await flipPage('prev');
    }
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!isDetailRoute() || !currentBook()?.has_access) return;
    if (!state.pdfDocument && !state.editorialText) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.editorialText) {
        initEditorialPageFlip(currentBook(), state.editorialText);
      } else {
        initPageFlip();
      }
    }, 400);
  });
}

bindEvents();
hydrate().catch((error) => {
  common.renderNotice(elements.customerMessage, error.message, 'error');
});

