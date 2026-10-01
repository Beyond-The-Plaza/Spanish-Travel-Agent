/*
 * Module completion popups — loader & controller.
 *
 * Usage:
 *   <link rel="stylesheet" href="styles/popups.css">
 *   <script src="js/popups.js" defer></script>
 *   <div id="popup-host"></div>
 *
 * Trigger: showPopup('m0')
 *
 * nextFn / reviewFn on a route override URL navigation.
 * If no route is found, "next" falls back to the subscribe paywall.
 */

const POPUP_ROUTES = {
  m0: { reviewFn: () => hidePopup(), nextFn: () => { hidePopup(); window.render(1); } },
  m1: { reviewFn: () => hidePopup(), nextFn: () => { hidePopup(); window.openModule(2); } },
  m2: { reviewFn: () => hidePopup(), nextFn: () => { hidePopup(); window.openModule(3); } },   // modules[3] = M4
  m4: { reviewFn: () => hidePopup(), nextFn: () => { hidePopup(); window.openModule(4); } },   // modules[4] = M8
};

window.POPUP_ROUTES = POPUP_ROUTES;

const popupCache = {};
let currentModule = null;

async function showPopup(moduleId) {
  const host = document.getElementById('popup-host');
  if (!host) { console.warn('[popups] no #popup-host element found'); return; }

  if (!popupCache[moduleId]) {
    try {
      const res = await fetch(`modules/popups/${moduleId}-complete.html`);
      popupCache[moduleId] = await res.text();
    } catch (e) {
      console.error(`[popups] failed to load ${moduleId}`, e);
      return;
    }
  }

  host.innerHTML = `<div class="popup-scrim" data-action="dismiss">${popupCache[moduleId]}</div>`;
  const scrim = host.firstElementChild;
  void scrim.offsetWidth;
  scrim.classList.add('is-open');
  currentModule = moduleId;

  scrim.addEventListener('click', handlePopupClick);
  document.addEventListener('keydown', handleEsc);
}

function hidePopup() {
  const scrim = document.querySelector('.popup-scrim');
  if (!scrim) return;
  scrim.classList.remove('is-open');
  document.removeEventListener('keydown', handleEsc);
  setTimeout(() => { scrim.remove(); }, 280);
  currentModule = null;
}

function handlePopupClick(e) {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'dismiss' && e.target.closest('.popup')) return;

  const route = POPUP_ROUTES[currentModule] || {};
  switch (action) {
    case 'next':
      if (route.nextFn)    { route.nextFn(); break; }
      if (route.nextUrl)   { window.location.href = route.nextUrl; break; }
      hidePopup(); window.showSignup();
      break;
    case 'review':
      if (route.reviewFn)  { route.reviewFn(); break; }
      if (route.reviewUrl) { window.location.href = route.reviewUrl; break; }
      hidePopup();
      break;
    case 'dismiss': hidePopup(); break;
  }
}

function handleEsc(e) {
  if (e.key === 'Escape') hidePopup();
}

window.showPopup = showPopup;
window.hidePopup = hidePopup;
