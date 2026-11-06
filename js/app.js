/* SOURCE: Splash-draftv3-parrot.html */
import { modules, drillWords, stepLabels, m1StepLabels } from '../data/modules.js';

/* DEV_BYPASS: skips the Supabase paywall/entitlement check so paid modules render
   from local files. It can only be on when the page is served from this machine
   (localhost, 127.x.x.x, ::1), so it can never be active on a deployed site.
   Add ?paywall=on to the URL to switch it off locally and exercise the real
   paywall path (e.g. with `netlify dev`). */
const LOCAL_HOST = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/.test(window.location.hostname);
const DEV_BYPASS = LOCAL_HOST && new URLSearchParams(window.location.search).get('paywall') !== 'on';

let currentStep = 0;
let currentIndex = 0;   // module on screen right now; the switcher's prev/next arrows step from here
const standardContentTemplate = document.getElementById('std-content').innerHTML;

// Per-module background photo, keyed by module number (m.n).
// Any module not listed here (e.g. M0) falls back to DEFAULT_BG.
const MODULE_BG = {
  1:  'assets/m1-hero.jpg',
  2:  'assets/m2-hero.jpg',
  3:  'assets/m3-hero.jpg',
  4:  'assets/m4-hero.jpg',
  5:  'assets/m5-hero.jpg',
  6:  'assets/m6-hero.jpg',
  7:  'assets/m7-hero.jpg',
  8:  'assets/m8-hero.jpg',
  12: 'assets/m12-hero.jpg',
  16: 'assets/m16-hero.jpg',
};
const DEFAULT_BG = 'https://i.imgur.com/jXbBlFF.jpg';
// Which multi-step module is on screen — drives goStep() so M0 and M1
// (and any future multi-step module) share one navigator without ID clashes.
let activeMulti = { prefix: 'm0', panel: null, labels: stepLabels };

function goStep(n) {
  // Paid modules: only step 1 is static. Anything beyond it needs the protected steps first.
  if (activeMulti.gated && !activeMulti.unlocked && n > 0) { requestPaidSteps(n); return; }
  const panel = activeMulti.panel || document.getElementById('panel-' + activeMulti.prefix);
  if (!panel) return;
  const cur = panel.querySelector('.step-panel.active');
  if (cur) cur.classList.remove('active');
  const dots = document.querySelectorAll('#' + activeMulti.prefix + '-dots .step-dot');
  dots.forEach(d => d.classList.remove('active'));
  currentStep = n;
  const panels = panel.querySelectorAll('.step-panel');
  if (panels[n]) panels[n].classList.add('active');
  if (dots[n]) dots[n].classList.add('active');
  const lbl = document.getElementById(activeMulti.prefix + '-step-label');
  if (lbl) lbl.textContent = activeMulti.labels[n];
}

window.goStep = goStep;

/* ── Paid multi-step modules (M2+) ──────────────────────────────────────
   Step 1 is static (m.preview, fetched at startup, precached by the service
   worker) and never touches Supabase. Steps 2+ are fetched on demand from the
   protected lesson function and stitched onto the panel. Three outcomes:
     locked       → not signed in / not purchased  → paywall with the buy CTA
     unavailable  → backend down or paused         → notice, NEVER a buy button
     ok           → served from the per-user cache when there is one            */
const panelPaid = document.getElementById('panel-paid');
const paidDots  = document.getElementById('paid-dots');
const paidLabel = document.getElementById('paid-step-label');
const previewHtml = {};   // m.n → static step 1 partial
const paidSteps   = {};   // m.n → protected steps 2+ (memory only, this page load)
const devStepsSource = (m) => `book1_content/course-modules/${m.slug}.html`;

function setupPaidModule(m) {
  const ctx = { prefix: 'paid', panel: panelPaid, labels: m.stepLabels, module: m, gated: true, unlocked: false, loading: false };
  activeMulti = ctx;
  panelPaid.innerHTML = previewHtml[m.n] ||
    '<div class="hook-block"><div class="hook-label">Preview</div><div class="hook-text">This preview couldn’t be loaded. Check your connection and reopen the module.</div></div>';
  paidDots.innerHTML = m.stepLabels.map((_, i) => `<div class="step-dot${i ? ' is-locked' : ''}" data-step="${i}"></div>`).join('');
  paidDots.onclick = (e) => { const dot = e.target.closest('.step-dot'); if (dot) goStep(Number(dot.dataset.step)); };
  if (paidSteps[m.n]) mountPaidSteps(ctx, paidSteps[m.n]);
  goStep(0);
}

function mountPaidSteps(ctx, html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const steps = template.content.querySelectorAll('.step-panel');
  if (!steps.length) return false;
  steps.forEach((step) => { step.classList.remove('active'); ctx.panel.appendChild(step); });
  ctx.unlocked = true;
  paidDots.querySelectorAll('.is-locked').forEach((dot) => dot.classList.remove('is-locked'));
  return true;
}

function showPaidNotice(ctx, title, text) {
  clearPaidNotice(ctx);
  const notice = document.createElement('div');
  notice.className = 'paid-notice';
  notice.setAttribute('role', 'status');
  const heading = document.createElement('span');
  heading.className = 'paid-notice__title';
  heading.textContent = title;
  notice.append(heading, text);
  const active = ctx.panel.querySelector('.step-panel.active');
  if (active) active.insertBefore(notice, active.querySelector('.step-nav'));
}

function clearPaidNotice(ctx) {
  ctx.panel.querySelectorAll('.paid-notice').forEach((notice) => notice.remove());
}

async function loadPaidSteps(m) {
  if (DEV_BYPASS) {
    try {
      const res = await fetch(devStepsSource(m));
      if (!res.ok) throw new Error(res.status);
      return { status: 'ok', html: await res.text() };
    } catch (error) {
      return { status: 'unavailable', detail: `Dev bypass couldn’t load ${devStepsSource(m)}.` };
    }
  }
  const access = window.courseAccess;
  if (!access) return { status: 'unavailable' };

  // Purchased and cached: serve locally, then re-check in the background.
  const cached = await access.getCachedLesson(m.slug);
  if (cached) { revalidatePaidLesson(m); return { status: 'ok', html: cached }; }

  const entitlement = await access.refreshEntitlement();
  if (entitlement.unavailable || entitlement.configurationRequired) return { status: 'unavailable' };
  if (!entitlement.paid) return { status: 'locked' };
  try {
    const html = await access.fetchLesson(m.slug);
    access.cacheLesson(m.slug, html);
    return { status: 'ok', html };
  } catch (error) {
    if (error.status === 401 || error.status === 403) return { status: 'locked' };
    if (error.status === 404) return { status: 'unpublished' };
    return { status: 'unavailable' };
  }
}

/* After serving a cached lesson: drop it if access was revoked, refresh it otherwise.
   If Supabase can't be reached we can't tell, so the cached copy stays. */
async function revalidatePaidLesson(m) {
  const access = window.courseAccess;
  const entitlement = await access.refreshEntitlement();
  if (entitlement.unavailable || entitlement.configurationRequired) return;
  if (!entitlement.paid) {
    await access.clearLessonCache();
    delete paidSteps[m.n];
    if (activeMulti.module === m) setupPaidModule(m);
    return;
  }
  try { access.cacheLesson(m.slug, await access.fetchLesson(m.slug)); } catch (error) { /* keep what we have */ }
}

async function requestPaidSteps(n) {
  const ctx = activeMulti;
  if (ctx.loading) return;
  ctx.loading = true;
  showPaidNotice(ctx, 'Course member', 'Loading your lesson…');
  const result = await loadPaidSteps(ctx.module);
  ctx.loading = false;
  if (activeMulti !== ctx) return;   // user switched module while we waited
  clearPaidNotice(ctx);

  if (result.status === 'ok') {
    if (mountPaidSteps(ctx, result.html)) { paidSteps[ctx.module.n] = result.html; return goStep(n); }
    result.status = 'unpublished';   // object exists but holds no step panels yet
  }
  if (result.status === 'locked') return window.courseAccess.showPaywall();
  if (result.status === 'unpublished') return showPaidNotice(ctx, 'Coming soon', 'The rest of this lesson has not been published yet.');
  showPaidNotice(ctx, 'Temporarily unavailable', result.detail || 'Content temporarily unavailable, try again shortly.');
}

const switcher = document.getElementById('switcher');

function render(i) {
  const m = modules[i];
  const isM0 = !!m.isM0;
  const isM1 = !!m.isM1;
  const isMulti = isM0 || isM1;
  const isPaidMulti = !!m.preview;
  document.getElementById('bg-num').textContent    = m.n;
  document.getElementById('panel-bg-img').src      = MODULE_BG[m.n] || DEFAULT_BG;
  document.getElementById('track').textContent     = m.track;
  document.getElementById('mod-num').textContent   = String(m.n).padStart(2,'0');
  document.getElementById('mod-title').textContent = m.title;
  document.getElementById('level').textContent     = m.level;
  document.getElementById('students').textContent  = m.students;

  document.getElementById('panel-standard').style.display = (isMulti || isPaidMulti) ? 'none' : 'flex';
  document.getElementById('panel-m0').style.display       = isM0 ? 'flex' : 'none';
  document.getElementById('panel-m1').style.display       = isM1 ? 'flex' : 'none';
  panelPaid.hidden = !isPaidMulti;
  paidDots.hidden  = !isPaidMulti;
  paidLabel.hidden = !isPaidMulti;

  if (!isMulti && !isPaidMulti) {
    document.getElementById('std-content').innerHTML = standardContentTemplate;
    document.getElementById('std-content').style.display = '';
    document.getElementById('std-signup').style.display  = 'none';
  }
  document.getElementById('m0-dots').style.display        = isM0 ? 'flex' : 'none';
  document.getElementById('m0-step-label').style.display  = isM0 ? 'block' : 'none';
  document.getElementById('m1-dots').style.display        = isM1 ? 'flex' : 'none';
  document.getElementById('m1-step-label').style.display  = isM1 ? 'block' : 'none';

  if (isMulti) {
    activeMulti = isM0
      ? { prefix: 'm0', panel: document.getElementById('panel-m0'), labels: stepLabels }
      : { prefix: 'm1', panel: document.getElementById('panel-m1'), labels: m1StepLabels };
    goStep(0);
    if (isM0) {
      const speakerSvg = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5v4h2l3 2.5V2.5L4 5z" fill="currentColor"/><path d="M9 4.5a3.5 3.5 0 010 5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
      document.getElementById('drill-pills').innerHTML =
        drillWords.map(w =>
          `<span class="vocab-pill vw-audio-pill"><button class="vw-speak-btn" aria-label="Play ${w}" onclick="vwSpeak('${w}', 0.85)">${speakerSvg}</button>${w}</span>`
        ).join('');
    }
  } else if (isPaidMulti) {
    setupPaidModule(m);
  } else if (m.access === 'paid') {
    document.getElementById('std-content').innerHTML = '<div class="hook-block"><div class="hook-label">Course member</div><div class="hook-text">Loading your lesson…</div></div>';
  } else {
    document.getElementById('hook').textContent     = '“' + m.hook + '”';
    document.getElementById('sent-es').textContent  = m.es;
    document.getElementById('sent-en').textContent  = m.en;
    document.getElementById('drill').textContent    = m.drill;
    document.getElementById('culture').textContent  = m.culture;
    document.getElementById('concepts').innerHTML   = [m.c1,m.c2,m.c3].map(c =>
      `<div class="concept-item"><div class="concept-dot"></div><span>${c}</span></div>`).join('');
    document.getElementById('vocab').innerHTML      = m.v.map(v =>
      `<span class="vocab-pill">${v}</span>`).join('');
  }

  updateSwitcher(i);   // keep the switcher bar in step with the module on screen
  const pl = document.querySelector('.panel-left');
  pl.style.animation = 'none'; pl.offsetHeight; pl.style.animation = '';
}

async function openModule(i) {
  const m = modules[i];
  if (m.access !== 'paid') return render(i);
  // Multi-step paid modules render their static step 1 immediately; steps 2+ load on demand.
  if (m.preview) return render(i);

  // DEV_BYPASS: skip the paywall and load the lesson straight from the local
  // file (instead of the protected Netlify function) so the banner image and
  // content show without Supabase configured.
  if (DEV_BYPASS) {
    render(i);
    try {
      const html = await fetch(`modules/${m.slug}.html`).then(r => r.text());
      const template = document.createElement('template');
      template.innerHTML = html;
      const view = template.content.querySelector('.std-view');
      document.getElementById('std-content').innerHTML = view ? view.innerHTML : html;
    } catch (error) {
      document.getElementById('std-content').innerHTML = `<div class="hook-block"><div class="hook-label">Dev preview</div><div class="hook-text">Couldn’t load modules/${m.slug}.html locally.</div></div>`;
    }
    return;
  }

  const access = await window.courseAccess.refreshEntitlement();
  if (!access.paid) return window.courseAccess.showPaywall();
  render(i);
  try {
    const protectedHtml = await window.courseAccess.fetchLesson(m.slug);
    const template = document.createElement('template');
    template.innerHTML = protectedHtml;
    const protectedView = template.content.querySelector('.std-view');
    document.getElementById('std-content').innerHTML = protectedView ? protectedView.innerHTML : protectedHtml;
  } catch (error) {
    document.getElementById('std-content').innerHTML = `<div class="hook-block"><div class="hook-label">Coming soon</div><div class="hook-text">${error.message}</div></div>`;
  }
}

/* Completion-popup "next module" routes (js/popups.js) address a module by its
   number (m.n), not its array index — the array shifts whenever an earlier
   module is inserted (e.g. M3 landing between M2 and M4), which previously
   broke M2's and M4's "next" buttons silently. */
function openModuleByNumber(n) {
  const i = modules.findIndex(m => m.n === n);
  if (i !== -1) openModule(i);
  else console.warn(`[app] openModuleByNumber: no module numbered ${n}`);
}

/* ── Module switcher:  [ ‹ ]  [ M1 — Who Are You?  ▾ ]  [ › ] ──────────────
   One compact bar instead of a pill per module, so it stays a single row no matter
   how many modules there are. Tapping the middle button opens a list of every module,
   grouped into "trips" (Beginner Trip, Intermediate Trip, Advanced Trip). The arrows
   step to the previous or next module.

   The list is built from the `modules` array in data/modules.js and grouped by each
   module's `track` field, so a new module appears here automatically. */

/* Display names for the groups. The keys are the `track` values in data/modules.js.
   A track that isn't listed falls back to "<track> Trip". */
const TRIP_NAMES = {
  Beginner: 'Beginner Trip',
  Intermediate: 'Intermediate Trip',
  Advanced: 'Advanced Trip',
};
const tripName = (track) => TRIP_NAMES[track] || (track + ' Trip');
/* The track as a lowercase word ("beginner"), used as data-track so the CSS can colour each
   trip the same way the course map (outline.html) does. */
const trackKey = (track) => String(track || '').toLowerCase();

/* Escape text before putting it inside an HTML string, so a title can never inject markup. */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildSwitcher() {
  // Build the list: a heading each time the track changes, then one row per module.
  // data-i is the module's position in `modules`, which is what openModule() expects.
  let lastTrack = null;
  const items = modules.map((m, i) => {
    let head = '';
    if (m.track && m.track !== lastTrack) { head = `<div class="sw-group" data-track="${esc(trackKey(m.track))}">${esc(tripName(m.track))}</div>`; lastTrack = m.track; }
    return head +
      `<button type="button" class="sw-item${m.access === 'paid' ? ' is-locked' : ''}" data-i="${i}" data-track="${esc(trackKey(m.track))}">` +
        `<span class="sw-item__num">M${esc(m.n)}</span>` +
        `<span class="sw-item__title">${esc(m.title)}</span>` +
        `<span class="sw-item__level">${esc(m.level || '')}</span>` +   // paid modules get a padlock after this (styles/course-access.css)
      `</button>`;
  }).join('');

  // The bar itself: previous arrow, the button that shows the current module, next arrow.
  switcher.innerHTML =
    `<div class="sw-bar">` +
      `<button type="button" class="sw-arrow" id="sw-prev" aria-label="Previous module">‹</button>` +
      `<div class="sw-menu">` +
        `<button type="button" class="sw-trigger" id="sw-trigger" aria-expanded="false" aria-controls="sw-list" aria-label="Choose a module">` +
          `<span class="sw-trigger__label"></span><span class="sw-trigger__caret" aria-hidden="true">▾</span>` +
        `</button>` +
        `<div class="sw-list" id="sw-list" hidden>${items}</div>` +
      `</div>` +
      `<button type="button" class="sw-arrow" id="sw-next" aria-label="Next module">›</button>` +
    `</div>`;

  const trigger = document.getElementById('sw-trigger');
  const list = document.getElementById('sw-list');

  // Open or close the list (and keep aria-expanded in sync for screen readers).
  function setOpen(open) {
    list.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      // Scroll so the current module sits in the middle of the visible list.
      const cur = list.querySelector('.sw-item.active');
      if (cur) list.scrollTop = cur.offsetTop - (list.clientHeight - cur.offsetHeight) / 2;
    }
  }

  trigger.addEventListener('click', () => setOpen(list.hidden));

  // One listener for every row: close the list, then open the chosen module.
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.sw-item');
    if (!item) return;
    setOpen(false);
    openModule(Number(item.dataset.i));
  });

  // Tapping anywhere outside the menu closes it.
  document.addEventListener('click', (e) => {
    if (!list.hidden && !e.target.closest('.sw-menu')) setOpen(false);
  });

  // Keyboard, only while the list is open: Escape closes it; Up/Down move through the rows.
  document.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'Escape') { setOpen(false); trigger.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const els = [...list.querySelectorAll('.sw-item')];
      const at = els.indexOf(document.activeElement);
      els[Math.max(0, Math.min(els.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
    }
  });

  // Previous / next arrows: one module either way, never past the first or last.
  const step = (d) => { const n = currentIndex + d; if (n >= 0 && n < modules.length) openModule(n); };
  document.getElementById('sw-prev').addEventListener('click', () => step(-1));
  document.getElementById('sw-next').addEventListener('click', () => step(1));

  updateSwitcher(currentIndex);
}

/* Called from render() every time the module on screen changes. */
function updateSwitcher(i) {
  currentIndex = i;
  const m = modules[i];
  // Button text: module number, then title.
  document.querySelector('.sw-trigger__label').innerHTML =
    `<span class="sw-trigger__dot" data-track="${esc(trackKey(m.track))}"></span>` +   // small dot in the trip's colour
    `<span class="sw-trigger__num">M${esc(m.n)}</span><span class="sw-trigger__title">${esc(m.title)}</span>`;
  // Highlight the current row in the list.
  document.querySelectorAll('.sw-item').forEach((el, j) => {
    el.classList.toggle('active', j === i);
    if (j === i) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
  });
  // Grey out an arrow when there is nowhere further to go.
  document.getElementById('sw-prev').disabled = i === 0;
  document.getElementById('sw-next').disabled = i === modules.length - 1;
}

buildSwitcher();

function showSignup() {
  document.getElementById('std-content').style.display = 'none';
  document.getElementById('std-signup').style.display  = 'flex';
}

window.showSignup = showSignup;
window.render = render;
window.openModule = openModule;
window.openModuleByNumber = openModuleByNumber;
window.vwDrillWords = drillWords;

const m0html = await fetch('modules/m0-sound-like-spanish.html').then(r => r.text());
document.getElementById('panel-m0').innerHTML = m0html;
if (window.vwDrillInit) window.vwDrillInit();

const m1html = await fetch('modules/m1-who-are-you.html').then(r => r.text());
document.getElementById('panel-m1').innerHTML = m1html;

for (const m of modules) {
  if (!m.preview) continue;
  try {
    const res = await fetch(m.preview);
    if (!res.ok) throw new Error(res.status);
    previewHtml[m.n] = await res.text();
  } catch (error) {
    console.warn(`[app] couldn’t load preview for M${m.n}`, error);
  }
}

render(0);