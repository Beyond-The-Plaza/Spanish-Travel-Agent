/*
 * Verb conjugation quiz — Module 6's gamified "Master table".
 * Loaded as a regular defer script (not a module), same pattern as
 * voice-widget.js / popups.js.
 *
 * Design (agreed with the user): a one-at-a-time typed quiz runs FIRST,
 * framed in the tutor's own voice for each tense rung (mom's-voice command,
 * continuous-action framing, etc.) — not just the bare tense name. Once
 * every item has been answered, the full 6x6 reference table is revealed
 * underneath, plainly, as an answer sheet to keep.
 *
 * The protected M6 partial only provides the markup (two empty containers
 * plus the already-filled-in reference table, hidden via the `hidden`
 * attribute) — no inline <script>, per the project's separation-of-concerns
 * rule. This file finds that markup itself via a MutationObserver, since the
 * partial is injected into the DOM later by js/app.js's generic paid-module
 * loader, which has no M6-specific knowledge.
 *
 * Checking is case-insensitive and accent-insensitive (typing accents on a
 * phone is its own skill, not what this drill tests), but the verb form
 * itself — and any punctuation-free letters — must match exactly.
 */
(function () {
  const VERBS = [
    { es: 'caminar', en: 'walk' },
    { es: 'cantar',  en: 'sing' },
    { es: 'correr',  en: 'run' },
    { es: 'comer',   en: 'eat' },
    { es: 'escribir', en: 'write' },
    { es: 'vivir',   en: 'live' },
  ];

  /* One row per tense rung. `answer(v)` takes a VERBS entry and returns the
     expected Spanish (the exact text from the spec's Master table); `framing`
     is the tutor's-voice prompt, with {en}/{es} filled in per verb. */
  const TENSES = [
    {
      label: 'Imperativo',
      framing: (v) => `👩 Mom's voice, right now: tell someone to <strong>${v.en}</strong> — no arguing.`,
      answer: (v) => ({ caminar: '¡Camina!', cantar: '¡Canta!', correr: '¡Corre!', comer: '¡Come!', escribir: '¡Escribe!', vivir: '¡Vive!' })[v.es],
    },
    {
      label: 'Presente progresivo',
      framing: (v) => `🎬 Mid-action, already moving — the near-past is still echoing into the near-future: tú estás ___ (${v.en}).`,
      answer: (v) => ({ caminar: 'estás caminando', cantar: 'estás cantando', correr: 'estás corriendo', comer: 'estás comiendo', escribir: 'estás escribiendo', vivir: 'estás viviendo' })[v.es],
    },
    {
      label: 'Presente',
      framing: (v) => `📅 Just a fact about you, true any day: tú ___ (${v.en}).`,
      answer: (v) => ({ caminar: 'caminas', cantar: 'cantas', correr: 'corres', comer: 'comes', escribir: 'escribes', vivir: 'vives' })[v.es],
    },
    {
      label: 'Poder + infinitivo',
      framing: (v) => `💪 You're able to ${v.en} — say so: tú ___.`,
      answer: (v) => ({ caminar: 'puedes caminar', cantar: 'puedes cantar', correr: 'puedes correr', comer: 'puedes comer', escribir: 'puedes escribir', vivir: 'puedes vivir' })[v.es],
    },
    {
      label: 'Ir a + infinitivo',
      framing: (v) => `🧭 The plan — not a promise yet, just where you're headed: tú ___ (${v.en}).`,
      answer: (v) => ({ caminar: 'vas a caminar', cantar: 'vas a cantar', correr: 'vas a correr', comer: 'vas a comer', escribir: 'vas a escribir', vivir: 'vas a vivir' })[v.es],
    },
    {
      label: 'Futuro',
      framing: (v) => `🔮 A promise for tomorrow, whole infinitive plus the ending: tú ___ mañana (${v.en}).`,
      answer: (v) => ({ caminar: 'caminarás', cantar: 'cantarás', correr: 'correrás', comer: 'comerás', escribir: 'escribirás', vivir: 'vivirás' })[v.es],
    },
  ];

  function buildDeck() {
    const deck = [];
    TENSES.forEach((t) => VERBS.forEach((v) => deck.push({ tense: t.label, framing: t.framing(v), verbEs: v.es, verbEn: v.en, answer: t.answer(v) })));
    return deck;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* Accent/case/punctuation-insensitive compare — the verb FORM must still be right. */
  function normalize(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  }
  function isCorrect(typed, expected) { return normalize(typed) === normalize(expected); }

  function initQuiz(root) {
    const table = document.getElementById('verb-quiz-table');
    let deck = shuffle(buildDeck());
    let i = 0;
    let correctCount = 0;
    const missed = [];

    function renderItem() {
      const item = deck[i];
      root.innerHTML = `
        <div class="vq-card">
          <div class="vq-progress">${i + 1} / ${deck.length} · ${item.tense}</div>
          <div class="vq-prompt">${item.framing}</div>
          <form class="vq-input-row">
            <input class="vq-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Escribe aquí…">
            <button class="vq-submit" type="submit">Check</button>
          </form>
          <div class="vq-feedback" aria-live="polite"></div>
        </div>`;
      const form = root.querySelector('.vq-input-row');
      const input = root.querySelector('.vq-input');
      const feedback = root.querySelector('.vq-feedback');
      input.focus();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (form.classList.contains('vq-answered')) { i++; i < deck.length ? renderItem() : finish(); return; }
        const correct = isCorrect(input.value, item.answer);
        if (correct) correctCount++; else missed.push(item);
        feedback.className = 'vq-feedback ' + (correct ? 'vq-correct' : 'vq-incorrect');
        feedback.innerHTML = correct
          ? `¡Correcto! <strong>${item.answer}</strong>`
          : `Not quite — it's <strong>${item.answer}</strong>`;
        input.disabled = true;
        form.classList.add('vq-answered');
        root.querySelector('.vq-submit').textContent = (i + 1 < deck.length) ? 'Next →' : 'See results →';
      });
    }

    function finish() {
      const pct = Math.round((correctCount / deck.length) * 100);
      root.innerHTML = `
        <div class="vq-card vq-summary">
          <div class="vq-score">${correctCount} / ${deck.length} <span>(${pct}%)</span></div>
          <div class="vq-prompt">${missed.length ? `Missed ${missed.length} — redo just those, or move on.` : 'Every rung, every verb. Nicely done.'}</div>
          ${missed.length ? '<button class="vq-redo-btn" type="button">Redo the missed ones →</button>' : ''}
        </div>`;
      const redo = root.querySelector('.vq-redo-btn');
      if (redo) redo.addEventListener('click', () => { deck = shuffle(missed.splice(0)); i = 0; renderItem(); });
      if (table) table.hidden = false;
    }

    renderItem();
  }

  /* The quiz container is injected later (M6's protected steps load on
     demand), so watch for it rather than requiring an inline <script>. */
  const observer = new MutationObserver(() => {
    const root = document.getElementById('verb-quiz-root');
    if (root && !root.dataset.vqInit) {
      root.dataset.vqInit = '1';
      initQuiz(root);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Test-only seam: inert unless window.__VQ_TEST__ is set before this script
  // loads (e.g. via Puppeteer's evaluateOnNewDocument). Lets tests exercise
  // the actual grading logic directly instead of only through the UI.
  if (window.__VQ_TEST__) window.__vqInternal = { normalize, isCorrect, buildDeck, shuffle, VERBS, TENSES };
})();
