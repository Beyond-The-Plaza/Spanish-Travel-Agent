/*
 * Voice widget — speech synthesis and recognition for Module 0.
 * Loaded as a regular defer script (not a module) so its functions
 * are available as globals for inline onclick handlers in partials.
 *
 * Depends on:
 *   - window.vwDrillWords   set by app.js after importing drillWords
 *   - styles/voice-widget.css
 */
(function () {
  /* ── Feature detection ── */
  var hasSynth = 'speechSynthesis' in window;
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  /* ══════════════════════════════════════════════════════════════════════
   * VOICE SELECTION — this is the place to choose how the words sound.
   *
   * For each language, list preferred voice NAMES in order. The first one
   * that's actually installed on the listener's device wins; if none match
   * (or the lists are empty) the browser falls back to its default voice
   * for that language.
   *
   * Voice names differ per OS/browser. To see the exact names available on
   * YOUR machine, open the page, open the browser console, and run:
   *
   *     speechSynthesis.getVoices().map(v => v.name + '  —  ' + v.lang)
   *
   * If that returns an empty array, the list hasn't loaded yet — it loads
   * asynchronously. Use this version instead, which waits for it and prints
   * a clean table you can read the names from:
   *
   *     (function () {
   *       function show() {
   *         var vs = speechSynthesis.getVoices();
   *         if (!vs.length) return;
   *         console.table(vs.map(v => ({ name: v.name, lang: v.lang, default: v.default })));
   *         speechSynthesis.removeEventListener('voiceschanged', show);
   *       }
   *       speechSynthesis.addEventListener('voiceschanged', show);
   *       show();
   *     })();
   *
   * Copy the names you like into the lists below.
   * ════════════════════════════════════════════════════════════════════ */
  var VOICE_PREFS = {
    'es-ES': [
      // 'Google español',
      // 'Mónica',
      // 'Microsoft Elvira Online (Natural) - Spanish (Spain)'
    ],
    'en-US': [
      // 'Google US English',
      // 'Samantha',
      // 'Microsoft Aria Online (Natural) - English (United States)'
    ]
  };

  var _voiceCache = {};
  function pickVoice(lang) {
    if (!hasSynth) return null;
    if (_voiceCache[lang]) return _voiceCache[lang];
    var voices = speechSynthesis.getVoices();
    if (!voices.length) return null;            // list not loaded yet → browser default
    var prefs = VOICE_PREFS[lang] || [];
    var chosen = null;
    for (var i = 0; i < prefs.length && !chosen; i++) {
      chosen = voices.filter(function (v) { return v.name === prefs[i]; })[0] || null;
    }
    if (!chosen) {                              // fall back to any voice for this language
      var base = lang.split('-')[0];
      chosen = voices.filter(function (v) { return v.lang === lang || v.lang.indexOf(base) === 0; })[0] || null;
    }
    _voiceCache[lang] = chosen;
    return chosen;
  }
  /* Optional voice gender for dialogue (vwSpeak's 3rd argument: 'male' | 'female').
     The Web Speech API does not report gender, so we decide from voice names:
       1. VOICE_GENDER_EXACT: voices we know for certain (edit these after listening).
       2. VOICE_GENDER_NAMES: common Spanish voice names on Windows/macOS/Android/iOS.
       3. Otherwise the two speakers still get DIFFERENT Spanish voices when the device
          has 2+ of them (first one = male, last one = female).
     Only with a single Spanish voice do we fall back to a pitch shift, which many
     voices (including Google's) ignore, so there the speakers may sound alike. */
  var VOICE_GENDER_EXACT = {
    female: ['google español de estados unidos'],
    male:   ['google español']
  };
  var VOICE_GENDER_NAMES = {
    female: ['helena', 'laura', 'sabina', 'elvira', 'dalia', 'elena', 'paloma', 'lupe', 'mónica', 'monica', 'paulina', 'marisol', 'lucía', 'lucia', 'camila'],
    male:   ['pablo', 'raul', 'raúl', 'álvaro', 'alvaro', 'jorge', 'juan', 'diego', 'carlos', 'enrique', 'miguel', 'tomás', 'tomas', 'alberto', 'jaime']
  };
  var GENDER_PITCH = { male: 0.7, female: 1.25 };
  var _genderCache = {};

  function findByGender(pool, gender) {
    var exact = VOICE_GENDER_EXACT[gender] || [];
    var byExact = pool.filter(function (v) { return exact.indexOf(v.name.toLowerCase()) !== -1; })[0];
    if (byExact) return byExact;
    var names = VOICE_GENDER_NAMES[gender] || [];
    return pool.filter(function (v) {
      var n = v.name.toLowerCase();
      return names.some(function (name) { return n.indexOf(name) !== -1; });
    })[0] || null;
  }

  function pickGenderVoice(lang, gender) {
    var key = lang + '|' + gender;
    if (_genderCache[key]) return _genderCache[key];
    var voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    var base = lang.split('-')[0];
    var pool = voices.filter(function (v) { return v.lang === lang || v.lang.indexOf(base) === 0; });
    var found = findByGender(pool, gender);
    if (!found && pool.length > 1) {
      // No name match: still give the two speakers different voices.
      var other = findByGender(pool, gender === 'male' ? 'female' : 'male');
      var candidates = pool.filter(function (v) { return v !== other; });
      found = gender === 'male' ? candidates[0] : candidates[candidates.length - 1];
    }
    if (found) _genderCache[key] = found;
    return found || null;
  }

  // getVoices() populates asynchronously in some browsers; refresh when it does.
  if (hasSynth) speechSynthesis.addEventListener('voiceschanged', function () { _voiceCache = {}; _genderCache = {}; });

  /* ── Core synthesis helper ── */
  function speak(text, lang, rate, activeEl, gender) {
    if (!hasSynth) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    var voice = gender ? pickGenderVoice(lang, gender) : null;
    if (gender && !voice) u.pitch = GENDER_PITCH[gender] || 1;
    if (!voice) voice = pickVoice(lang);
    if (voice) u.voice = voice;
    if (activeEl) {
      activeEl.classList.add('vw-playing');
      u.onend = u.onerror = function () { activeEl.classList.remove('vw-playing'); };
    }
    speechSynthesis.speak(u);
  }

  /* ── Step 0: Vowel playback ── */
  /* Each vowel is played as the pure Spanish vowel (es-ES gives the exact
     sound: a=ah, e=eh, i=ee, o=oh, u=oo — English spellings like "ooh" get
     mis-read as "oh"), then the English "as in ___" anchor word. */
  var VOWEL_EG = { A: 'father', E: 'bed', I: 'see', O: 'go', U: 'moon' };
  window.vwSpeakVowel = function (letter, cardEl) {
    if (!hasSynth) return;
    speechSynthesis.cancel();
    if (cardEl) cardEl.classList.add('vw-playing');
    var seq = [
      { text: letter.toLowerCase(),              lang: 'es-ES', rate: 0.8 },
      { text: 'As in ' + VOWEL_EG[letter] + '.', lang: 'en-US', rate: 0.9 }
    ];
    (function playNext(i) {
      if (i >= seq.length) { if (cardEl) cardEl.classList.remove('vw-playing'); return; }
      var u = new SpeechSynthesisUtterance(seq[i].text);
      u.lang = seq[i].lang;
      u.rate = seq[i].rate;
      var voice = pickVoice(seq[i].lang);
      if (voice) u.voice = voice;
      u.onend  = function () { playNext(i + 1); };
      u.onerror = function () { if (cardEl) cardEl.classList.remove('vw-playing'); };
      speechSynthesis.speak(u);
    })(0);
  };

  /* ── Step 1: Consonant playback ── */
  /*
   * data-speech uses {{word}} markers for Spanish words embedded in English text.
   * e.g. "Sounds like C H in English cheese. For example: {{chévere}}, meaning cool."
   * Text outside {{}} → en-US. Text inside {{}} → es-ES. Parts are chained sequentially.
   */
  window.vwSpeakConsonant = function (rowEl) {
    if (!hasSynth) return;
    speechSynthesis.cancel();
    rowEl.classList.add('vw-playing');
    var raw = rowEl.dataset.speech || '';
    var parts = raw.split(/\{\{([^}]+)\}\}/);
    var utterances = [];
    for (var i = 0; i < parts.length; i++) {
      var txt = parts[i].trim();
      if (txt) utterances.push({ text: txt, lang: i % 2 === 0 ? 'en-US' : 'es-ES', rate: i % 2 === 0 ? 0.9 : 0.82 });
    }
    function playNext(idx) {
      if (idx >= utterances.length) { rowEl.classList.remove('vw-playing'); return; }
      var u = new SpeechSynthesisUtterance(utterances[idx].text);
      u.lang = utterances[idx].lang;
      u.rate = utterances[idx].rate;
      var voice = pickVoice(utterances[idx].lang);
      if (voice) u.voice = voice;
      u.onend  = function () { playNext(idx + 1); };
      u.onerror = function () { rowEl.classList.remove('vw-playing'); };
      speechSynthesis.speak(u);
    }
    utterances.length ? playNext(0) : rowEl.classList.remove('vw-playing');
  };

  /* ── Step 2: Stress word playback ── */
  /* Index matches block order: 0=Agudas, 1=Llanas, 2=Esdrújulas */
  var STRESS_WORDS = [
    ['café', 'canción', 'amor'],
    ['mesa', 'lápiz', 'cantan'],
    ['pájaro', 'música', 'sílaba']
  ];
  window.vwSpeakStress = function (idx) {
    if (!hasSynth) return;
    var words = STRESS_WORDS[idx];
    speechSynthesis.cancel();
    function playNext(i) {
      if (i >= words.length) return;
      var u = new SpeechSynthesisUtterance(words[i]);
      u.lang = 'es-ES';
      u.rate = 0.75;
      var voice = pickVoice('es-ES');
      if (voice) u.voice = voice;
      u.onend = function () { playNext(i + 1); };
      speechSynthesis.speak(u);
    }
    playNext(0);
  };

  /* ── Steps 3 & 4: Generic Spanish playback ── */
  window.vwSpeak = function (text, rate, gender) {
    speak(text, 'es-ES', rate || 0.85, null, gender);
  };

  /* ── Feedback helper ── */
  function showFb(container, msg, cls) {
    var el = container.querySelector('.vw-feedback');
    if (!el) { el = document.createElement('span'); el.className = 'vw-feedback'; container.appendChild(el); }
    el.className = 'vw-feedback vw-fb--' + cls;
    el.textContent = msg;
    clearTimeout(el._t);
    if (cls !== 'unsupported') {
      el._t = setTimeout(function () { el.textContent = ''; el.className = 'vw-feedback'; }, 3000);
    }
  }

  /* ── Listening bar (mic pop-up) ──
   * A shared, cancellable pop-up shown for every mic/"Try" interaction.
   * showListenBar → setListenState('listening'|'pass'|'fail'|'unsupported').
   * The × button and Esc call cancelListen(), which aborts recognition.
   */
  var activeRec = null;   // the in-flight SpeechRecognition, or null
  var activeBtn = null;   // the button that started it (re-enabled on finish/cancel)
  var barEl, barPromptEl, barStatusEl, barHideTimer;

  function ensureBar() {
    if (barEl) return;
    barEl = document.createElement('div');
    barEl.className = 'vw-listen-bar';
    barEl.setAttribute('hidden', '');
    barEl.innerHTML =
      '<div class="vw-listen-eq"><span></span><span></span><span></span><span></span><span></span></div>' +
      '<div class="vw-listen-body"><div class="vw-listen-prompt"></div><div class="vw-listen-status"></div></div>' +
      '<button class="vw-listen-close" type="button" aria-label="Cancel">&times;</button>';
    barEl.querySelector('.vw-listen-close').addEventListener('click', cancelListen);
    barPromptEl = barEl.querySelector('.vw-listen-prompt');
    barStatusEl = barEl.querySelector('.vw-listen-status');
    document.body.appendChild(barEl);
  }

  function showListenBar(prompt) {
    ensureBar();
    clearTimeout(barHideTimer);
    barPromptEl.textContent = prompt || '';
    barStatusEl.textContent = '';
    barEl.className = 'vw-listen-bar vw-listen--listening';
    barEl.removeAttribute('hidden');
    barEl.offsetHeight;               // force reflow so the transition runs
    barEl.classList.add('vw-listen--in');
  }

  function setListenState(cls, msg) {
    if (!barEl) return;
    barEl.className = 'vw-listen-bar vw-listen--in vw-listen--' + cls;
    barStatusEl.textContent = msg || '';
    if (cls === 'pass' || cls === 'fail') autoHideBar(2600);
    else if (cls === 'unsupported') autoHideBar(3400);
  }

  function autoHideBar(ms) {
    clearTimeout(barHideTimer);
    barHideTimer = setTimeout(hideListenBar, ms || 2500);
  }

  function hideListenBar() {
    if (!barEl) return;
    clearTimeout(barHideTimer);
    barEl.classList.remove('vw-listen--in');
    setTimeout(function () {
      if (barEl && !barEl.classList.contains('vw-listen--in')) barEl.setAttribute('hidden', '');
    }, 220);
  }

  /* Central recognition + bar driver. cb(transcript, err) — err is
   * 'aborted' | 'error' | 'unsupported'. Callers ignore 'aborted'. */
  function vwListen(lang, prompt, btnEl, cb) {
    if (activeRec) { try { activeRec.abort(); } catch (e) {} activeRec = null; }
    if (activeBtn && activeBtn !== btnEl) activeBtn.disabled = false;
    activeBtn = btnEl || null;
    if (activeBtn) activeBtn.disabled = true;

    showListenBar(prompt);

    if (!SpeechRec) {
      setListenState('unsupported', 'Voice recognition isn’t supported in this browser.');
      if (activeBtn) { activeBtn.disabled = false; activeBtn = null; }
      cb(null, 'unsupported');
      return;
    }

    // Calm "getting ready" state first — the recogniser needs a moment to
    // open the mic. We only switch to the live, animated "Listening…" state
    // once it actually starts capturing audio, so the user doesn't start
    // speaking into a mic that isn't recording yet.
    setListenState('getready', 'Getting ready…');
    var rec = new SpeechRec();
    activeRec = rec;
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    var goLive = function () { if (activeRec === rec) setListenState('listening', 'Listening…'); };
    rec.onaudiostart = goLive;   // mic is actually capturing now
    rec.onstart = goLive;        // fallback for browsers that skip onaudiostart
    rec.onresult = function (e) {
      activeRec = null;
      if (activeBtn) { activeBtn.disabled = false; activeBtn = null; }
      cb(e.results[0][0].transcript.toLowerCase().trim(), null);
    };
    rec.onerror = function (e) {
      activeRec = null;
      if (activeBtn) { activeBtn.disabled = false; activeBtn = null; }
      cb(null, (e && e.error === 'aborted') ? 'aborted' : 'error');
    };
    rec.onend = function () { if (activeRec === rec) activeRec = null; };
    try { rec.start(); } catch (e) { /* start() can throw if already started */ }
  }

  function cancelListen() {
    if (activeRec) { try { activeRec.abort(); } catch (e) {} activeRec = null; }
    if (activeBtn) { activeBtn.disabled = false; activeBtn = null; }
    hideListenBar();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && barEl && !barEl.hasAttribute('hidden')) cancelListen();
  });

  /* ── Step 0: Per-vowel mic check ── */
  /* target: 'a'|'e'|'i'|'o'|'u' — checks that the transcript starts with that vowel */
  window.vwListenVowel = function (target, btnEl) {
    var card = btnEl.closest('.vowel-card');
    var fbEl = card && card.querySelector('.vw-feedback');
    vwListen('es-ES', 'Say the vowel “' + String(target).toUpperCase() + '”', btnEl, function (t, err) {
      if (err === 'aborted') return;
      if (!t) {
        setListenState(err === 'unsupported' ? 'unsupported' : 'fail',
          err === 'unsupported' ? 'Not supported in this browser.' : 'Didn’t catch that — try again.');
        if (fbEl) { fbEl.className = 'vw-feedback vw-fb--' + (err === 'unsupported' ? 'unsupported' : 'fail'); fbEl.textContent = err === 'unsupported' ? 'Not supported.' : 'Try again.'; }
        return;
      }
      // A lone vowel is hard for the recogniser: "ah" often comes back as
      // "ha" / "aha" / "ajá" (the H is silent in Spanish so it gets tacked on),
      // "oh" as "ho", "you" for U, etc. So for EVERY vowel: drop accents, keep
      // only letters, strip a leading (silent) H, then accept if the first
      // vowel matches — or, for a short utterance, if the target vowel appears
      // anywhere in it.
      var core = t.normalize('NFD').replace(/[̀-ͯ]/g, '')
                  .toLowerCase().replace(/[^a-z]/g, '').replace(/^h+/, '');
      var firstVowel = (core.match(/[aeiou]/) || [''])[0];
      var pass = firstVowel === target || (core.length <= 4 && core.indexOf(target) !== -1);
      setListenState(pass ? 'pass' : 'fail', pass ? '✓ ¡Bien!' : 'Heard: ' + t);
      if (fbEl) {
        clearTimeout(fbEl._t);
        fbEl.className = 'vw-feedback vw-fb--' + (pass ? 'pass' : 'fail');
        fbEl.textContent = pass ? '✓ Bien!' : 'Heard: ' + t;
        fbEl._t = setTimeout(function () { fbEl.textContent = ''; fbEl.className = 'vw-feedback'; }, 3000);
      }
    });
  };

  /* ── Step 1: Consonant mic check ── */
  /* Accepts the consonant name (ch, ll, etc.) OR any of the sample words (chévere, lluvia…) */
  window.vwListenConsonant = function (btnEl) {
    var row = btnEl.closest('.vw-mic-row');
    vwListen('es-ES', 'Say a consonant sound or its example word', btnEl, function (t, err) {
      if (err === 'aborted') return;
      if (!t) {
        setListenState(err === 'unsupported' ? 'unsupported' : 'fail',
          err === 'unsupported' ? 'Not supported in this browser.' : 'Didn’t catch that — try again.');
        if (row) showFb(row, err === 'unsupported' ? 'Voice recognition not supported in this browser.' : 'Could not hear you — try again.', err === 'unsupported' ? 'unsupported' : 'fail');
        return;
      }
      var sampleWords = /chévere|chevere|lluvia|niño|nino|hola|jugo|gato|pingüino|pinguino/i;
      var consonantNames = /\b(ch|ll|eñe|hache|jota|[hnjg])\b/i;
      var pass = sampleWords.test(t) || consonantNames.test(t);
      setListenState(pass ? 'pass' : 'fail', pass ? '✓ ¡Bien!' : 'Heard: ' + t);
      if (row) showFb(row, pass ? '✓ Bien!' : 'Try again — we heard: ' + t, pass ? 'pass' : 'fail');
    });
  };

  /* ── Step 4: Diphthong quiz ── */
  var DIP_KEY = { toalla: 'Hiato', sandía: 'Hiato', ciudad: 'Diptongo', teatro: 'Hiato', grúa: 'Diptongo' };
  var dipDone = {};
  var dipCorrect = 0;

  window.vwAnswerDip = function (word, answer, btnEl) {
    if (dipDone[word]) return;
    var correct = DIP_KEY[word];
    var pass = answer === correct;
    dipDone[word] = true;
    if (pass) dipCorrect++;

    var card = btnEl.closest('.vw-dip-card');
    card.querySelectorAll('.vw-dip-btn').forEach(function (b) {
      b.disabled = true;
      if (b.dataset.ans === correct) b.classList.add('vw-dip-btn--pass');
      if (b.dataset.ans !== correct && b.dataset.ans === answer) b.classList.add('vw-dip-btn--fail');
    });
    var fb = card.querySelector('.vw-dip-fb');
    fb.className = 'vw-dip-fb vw-fb--' + (pass ? 'pass' : 'fail');
    fb.textContent = pass ? '✓ Correcto!' : 'Correcto: ' + correct;

    if (Object.keys(dipDone).length === 5) {
      var s = document.getElementById('vw-dip-score');
      if (s) {
        s.className = 'vw-dip-summary vw-fb--' + (dipCorrect === 5 ? 'pass' : dipCorrect >= 3 ? 'partial' : 'fail');
        s.textContent = dipCorrect + ' / 5 correct';
      }
    }
  };

  /* ── Step 5: Voice drill ── */
  var drillWords = [];
  var drillIdx   = 0;

  function norm(s) {
    return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function drillRender() {
    var wordEl   = document.getElementById('vw-drill-word');
    var doneEl   = document.getElementById('vw-drill-done');
    var hearBtn  = document.getElementById('vw-drill-hear');
    var micBtn   = document.getElementById('vw-drill-mic');
    var retryBtn = document.getElementById('vw-drill-retry');
    var fb       = document.getElementById('vw-drill-fb');
    if (!wordEl) return;

    var finished = drillIdx >= drillWords.length;
    wordEl.classList.toggle('vw-hidden', finished);
    if (hearBtn)  hearBtn.classList.toggle('vw-hidden', finished);
    if (micBtn)   micBtn.classList.toggle('vw-hidden', finished);
    if (retryBtn) retryBtn.classList.add('vw-hidden');
    if (fb)       { fb.textContent = ''; fb.className = 'vw-drill-feedback'; }
    if (doneEl)   doneEl.classList.toggle('vw-hidden', !finished);
    if (!finished) wordEl.textContent = drillWords[drillIdx];
  }

  window.vwDrillInit = function () {
    if (!drillWords.length) { drillWords = window.vwDrillWords || []; drillIdx = 0; }
    drillRender();
  };

  /* Play the current drill word aloud (hear it before speaking). */
  window.vwDrillHear = function () {
    if (!drillWords.length) { drillWords = window.vwDrillWords || []; }
    var target = drillWords[drillIdx];
    if (!target) { var el = document.getElementById('vw-drill-word'); target = el && el.textContent; }
    if (target) window.vwSpeak(target, 0.85);
  };

  window.vwDrillListen = function (btnEl) {
    if (!drillWords.length) { drillWords = window.vwDrillWords || []; }
    var target = drillWords[drillIdx];
    vwListen('es-ES', 'Say: “' + (target || '') + '”', btnEl, function (t, err) {
      if (err === 'aborted') return;
      var fb       = document.getElementById('vw-drill-fb');
      var retryBtn = document.getElementById('vw-drill-retry');
      if (!t) {
        setListenState(err === 'unsupported' ? 'unsupported' : 'fail',
          err === 'unsupported' ? 'Not supported in this browser.' : 'Didn’t catch that — try again.');
        if (fb) { fb.className = 'vw-drill-feedback vw-fb--' + (err === 'unsupported' ? 'unsupported' : 'fail'); fb.textContent = err === 'unsupported' ? 'Voice recognition not supported in this browser.' : 'Could not hear you — try again.'; }
        return;
      }
      var pass = norm(t) === norm(target) || norm(t).indexOf(norm(target)) !== -1;
      setListenState(pass ? 'pass' : 'fail', pass ? '✓ ¡Perfecto!' : 'Heard: ' + t);
      if (fb) { fb.className = 'vw-drill-feedback vw-fb--' + (pass ? 'pass' : 'fail'); fb.textContent = pass ? '✓ Perfecto!' : 'Try again — we heard: ' + t; }
      if (pass) {
        drillIdx++;
        setTimeout(drillRender, 1000);
      } else if (retryBtn) {
        retryBtn.classList.remove('vw-hidden');
      }
    });
  };

  window.vwDrillRetry = function () {
    var fb       = document.getElementById('vw-drill-fb');
    var retryBtn = document.getElementById('vw-drill-retry');
    var micBtn   = document.getElementById('vw-drill-mic');
    if (fb)       { fb.textContent = ''; fb.className = 'vw-drill-feedback'; }
    if (retryBtn) retryBtn.classList.add('vw-hidden');
    if (micBtn)   micBtn.disabled = false;
  };
}());
