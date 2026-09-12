/* SOURCE: Splash-draftv3-parrot.html */
import { modules, drillWords, stepLabels, m1StepLabels } from '../data/modules.js';

/* DEV_BYPASS: when true, skips the Supabase paywall/entitlement check so every
   module — including paid ones — renders locally with its banner image and its
   local lesson file. Set to false to restore the real paywall before deploying. */
const DEV_BYPASS = true;

let currentStep = 0;
const standardContentTemplate = document.getElementById('std-content').innerHTML;

// Per-module background photo, keyed by module number (m.n).
// Any module not listed here (e.g. M0) falls back to DEFAULT_BG.
const MODULE_BG = {
  1:  'assets/m1-hero.jpg',
  2:  'assets/m2-hero.jpg',
  4:  'assets/m4-hero.jpg',
  8:  'assets/m8-hero.jpg',
  12: 'assets/m12-hero.jpg',
  16: 'assets/m16-hero.jpg',
};
const DEFAULT_BG = 'https://i.imgur.com/jXbBlFF.jpg';
// Which multi-step module is on screen — drives goStep() so M0 and M1
// (and any future multi-step module) share one navigator without ID clashes.
let activeMulti = { prefix: 'm0', panel: null, labels: stepLabels };

function goStep(n) {
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

const switcher = document.getElementById('switcher');

function render(i) {
  const m = modules[i];
  const isM0 = !!m.isM0;
  const isM1 = !!m.isM1;
  const isMulti = isM0 || isM1;
  document.getElementById('bg-num').textContent    = m.n;
  document.getElementById('panel-bg-img').src      = MODULE_BG[m.n] || DEFAULT_BG;
  document.getElementById('track').textContent     = m.track;
  document.getElementById('mod-num').textContent   = String(m.n).padStart(2,'0');
  document.getElementById('mod-title').textContent = m.title;
  document.getElementById('level').textContent     = m.level;
  document.getElementById('students').textContent  = m.students;

  document.getElementById('panel-standard').style.display = isMulti ? 'none' : 'flex';
  document.getElementById('panel-m0').style.display       = isM0 ? 'flex' : 'none';
  document.getElementById('panel-m1').style.display       = isM1 ? 'flex' : 'none';

  if (!isMulti) {
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

  document.querySelectorAll('.sw-btn').forEach((b,j) => b.classList.toggle('active', j===i));
  const pl = document.querySelector('.panel-left');
  pl.style.animation = 'none'; pl.offsetHeight; pl.style.animation = '';
}

async function openModule(i) {
  const m = modules[i];
  if (m.access !== 'paid') return render(i);

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

modules.forEach((m,i) => {
  const b = document.createElement('button');
  b.className = 'sw-btn' + (i===0 ? ' active' : '');
  b.textContent = 'M' + m.n + ' — ' + m.title;
  if (m.access === 'paid') b.classList.add('is-locked');
  b.onclick = () => openModule(i);
  switcher.appendChild(b);
});

function showSignup() {
  document.getElementById('std-content').style.display = 'none';
  document.getElementById('std-signup').style.display  = 'flex';
}

window.showSignup = showSignup;
window.render = render;
window.openModule = openModule;
window.vwDrillWords = drillWords;

const m0html = await fetch('modules/m0-sound-like-spanish.html').then(r => r.text());
document.getElementById('panel-m0').innerHTML = m0html;
if (window.vwDrillInit) window.vwDrillInit();

const m1html = await fetch('modules/m1-who-are-you.html').then(r => r.text());
document.getElementById('panel-m1').innerHTML = m1html;

render(0);