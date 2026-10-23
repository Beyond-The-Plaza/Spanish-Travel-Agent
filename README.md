# Beyond the Plaza — Spanish Travel Course

Digital product for young travellers learning Spanish quickly and efficiently. Fresh, modern design with a heavy focus on real conversation.

## Course access and paid modules

Modules 0 and 1 are free and fully static — every step ships with the site
and never touches Supabase. Paid modules (Module 2 onward) are `access: paid`
in `data/modules.js`. A multi-step paid module also carries a `preview` path:
its step 1 is a static partial (`modules/preview/`) that renders instantly
with no network call, while steps 2+ live only in the private Supabase
Storage bucket and load on demand once a signed-in, paying user reaches them.

Paid module source files are deliberately excluded from Netlify production
deployments by `.netlifyignore`; do not remove those entries. The live app
requests paid content only through a Netlify Function, after it checks a
signed-in user's entitlement.

Keep the Git repository private while premium source files remain in it.
`.netlifyignore` protects the deployed site, not a public source repository.

**Failure states are deliberately distinct.** If Supabase is unreachable or
paused, the Netlify Functions return a 503 and the app shows "Content
temporarily unavailable" — it never falls back to showing the paywall to a
user who has already paid. A paying member's most recently loaded lesson is
also cached per-user in IndexedDB (`js/course-access.js`), so it's still
available if the backend is briefly down, and is cleared on sign-out or if
their access is revoked.

The one-time Supabase/Stripe/Netlify setup steps (environment variables,
bucket creation, webhook config, bucket object names) are kept out of this
public-facing file — see `book1_content/IMPLEMENTATION-LOG.md` (gitignored).

### Authoring and release workflow

1. Write and test a lesson locally (see `book1_content/` for the Book 1
   authoring specs and drafts — that folder is gitignored).
2. Keep it out of the storage bucket while it is a draft.
3. Test it locally with `DEV_BYPASS` (see `js/app.js`), which skips the
   paywall only when the page is served from `localhost`/`127.x.x.x`; add
   `?paywall=on` to exercise the real paywall path locally instead.
4. Upload the finished HTML file to the private bucket to publish it to paid
   members. Removing that private object immediately unpublishes it.

This is access control, not DRM: a paid member can still copy what they can
read. It prevents anonymous visitors and guessed URLs from receiving premium
lesson content.

## File structure

```
Splash-draftv3-parrot.html   — course app shell: links CSS/JS, module switcher, React tweaks panel
app.html                     — PWA home screen (shown only on an installed launch)
index.html                   — marketing landing page
outline.html                 — full syllabus map (16 modules across 3 tracks)
manifest.webmanifest         — PWA manifest
sw.js                        — service worker: app-shell caching (skips /.netlify/ and /book1_content/)

styles/
  main.css                   — core layout + all module component styles
  voice-widget.css           — speaker-button / audio playback styles
  popups.css                 — module-completion popup styles
  course-access.css          — sign-in / paywall modal + "unavailable" notice styles

data/
  modules.js                 — modules[], drillWords[], stepLabels[], per-module step labels

js/
  app.js                     — render(), goStep(), paid-module loading & failure states, signup logic
  voice-widget.js            — Web Speech playback/recognition helpers (vwSpeak, vwListen…)
  popups.js                  — module-completion popup loader/controller
  course-access.js           — Supabase auth, entitlement checks, lesson fetch, per-user lesson cache
  course-config.js           — public Supabase URL + anon key (safe to publish)
  register-sw.js             — service worker registration

modules/
  m0-sound-like-spanish.html — M0 multi-step panel (free)
  m1-who-are-you.html        — M1 multi-step panel (free)
  m2/m4/m8/m12/m16-*.html    — local authoring copies of paid modules (excluded from deploy)
  preview/                   — static step-1 previews for multi-step paid modules
  popups/                    — module-completion popup partials

netlify/functions/           — entitlement checks, protected lesson delivery, Stripe checkout/webhook
supabase/course-access.sql   — entitlements table + RLS setup (run once)
tweaks-panel.jsx             — React tweaks panel (loaded via Babel CDN, dev-only)
```

## Local preview

`fetch()` requires HTTP — open via a local server, not `file://`:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/Splash-draftv3-parrot.html
```
