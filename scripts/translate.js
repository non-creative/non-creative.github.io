/**
 * translate.js — Language selector + Google Translate
 *
 * Architecture:
 *   PRIMARY:   Set googtrans cookie → reload → GT reads cookie and translates.
 *              This is the always-reliable path. Works on every page, every browser.
 *   FAST PATH: If GT is already initialised on the same page (user switches a 2nd
 *              time), drive the hidden combo directly — no reload needed.
 *   FALLBACK:  If the GT script itself fails to load (genuine offline), show a
 *              single dismissible banner. Never show it for any other reason.
 *
 * Body visibility is always guaranteed — GT cannot blank the page.
 */
(function () {
  'use strict';

  /* ─── Languages ─────────────────────────────────────── */
  var LANGS = [
    { code: 'en',    native: 'English',    short: 'EN' },
    { code: 'ar',    native: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', short: 'AR' },
    { code: 'zh-CN', native: '\u4e2d\u6587',        short: 'ZH' },
    { code: 'nl',    native: 'Nederlands', short: 'NL' },
    { code: 'fr',    native: 'Fran\u00e7ais',   short: 'FR' },
    { code: 'de',    native: 'Deutsch',    short: 'DE' },
    { code: 'hi',    native: '\u0939\u093f\u0928\u094d\u0926\u0940', short: 'HI' },
    { code: 'ja',    native: '\u65e5\u672c\u8a9e', short: 'JA' },
    { code: 'es',    native: 'Espa\u00f1ol',   short: 'ES' },
  ];

  /* ─── State ─────────────────────────────────────────── */
  var gtReady    = false;   // true once TranslateElement init'd OK
  var scriptFailed = false; // true ONLY if script.onerror fires (no network)

  /* ─── Visibility guard ──────────────────────────────── */
  // Prevents GT from blanking the page during its DOM manipulation phase.
  function keepVisible() {
    try {
      var b = document.body;
      if (!b) return;
      b.style.visibility = '';
      b.style.opacity    = '';
      // GT sets inline top on body — clear it (CSS also guards this)
      b.style.top        = '';
    } catch (e) {}
  }

  /* ─── Cookie helpers ────────────────────────────────── */
  function readCookie() {
    try {
      var m = document.cookie.match(/googtrans=\/en\/([^;,\s]+)/);
      return m ? m[1] : 'en';
    } catch (e) { return 'en'; }
  }

  function writeCookie(val) {
    try {
      var host = window.location.hostname;
      var exp  = val ? '' : ';expires=Thu,01 Jan 1970 00:00:00 GMT';
      var v    = val || '';
      document.cookie = 'googtrans=' + v + exp + ';path=/';
      document.cookie = 'googtrans=' + v + exp + ';path=/;domain=' + host;
      // Also set on root domain (needed when subdomain is involved)
      if (host.split('.').length > 1) {
        var root = host.replace(/^[^.]+/, '');
        document.cookie = 'googtrans=' + v + exp + ';path=/;domain=' + root;
      }
    } catch (e) {}
  }

  function getLang(code) {
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i].code === code) return LANGS[i];
    }
    return LANGS[0]; // default: English
  }

  /* ─── SVG icons ─────────────────────────────────────── */
  var ICON_GLOBE   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  var ICON_CHEVRON = '<svg class="lp-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  var ICON_CHECK   = '<svg class="lp-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  /* ─── Build desktop picker ──────────────────────────── */
  function makeDesktop(cur) {
    var opts = LANGS.map(function (l) {
      var active = l.code === cur.code;
      return '<button class="lp-option' + (active ? ' is-active' : '') +
        '" data-code="' + l.code + '" role="option" aria-selected="' + active + '">' +
        '<span class="lp-native">' + l.native + '</span>' + ICON_CHECK + '</button>';
    }).join('');

    var wrap = document.createElement('div');
    wrap.className = 'lp-wrap notranslate';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML =
      '<button class="lp-btn" aria-label="Select language" aria-expanded="false" aria-haspopup="listbox">' +
        ICON_GLOBE + '<span class="lp-code">' + cur.short + '</span>' + ICON_CHEVRON +
      '</button>' +
      '<div class="lp-dropdown" role="listbox" aria-label="Language">' + opts + '</div>';
    return wrap;
  }

  /* ─── Build mobile drawer picker ───────────────────── */
  function makeDrawer(cur) {
    var wrap = document.createElement('div');
    wrap.className = 'lp-drawer-wrap notranslate';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML =
      '<p class="lp-drawer-label">' + ICON_GLOBE + ' Language</p>' +
      '<div class="lp-drawer-grid">' +
      LANGS.map(function (l) {
        return '<button class="lp-drawer-opt' + (l.code === cur.code ? ' is-active' : '') +
          '" data-code="' + l.code + '">' + l.short + '</button>';
      }).join('') + '</div>';
    return wrap;
  }

  /* ─── Inject both pickers into nav ─────────────────── */
  function injectPickers(cur) {
    try {
      var navInner = document.querySelector('.nav-inner');
      var toggle   = document.querySelector('.nav-toggle');
      var drawer   = document.getElementById('navDrawer');

      if (navInner) {
        var desktop = makeDesktop(cur);
        navInner.insertBefore(desktop, toggle || null);
        wireDesktop(desktop);
      }
      if (drawer) {
        var mobile = makeDrawer(cur);
        drawer.appendChild(mobile);
        wireDrawer(mobile);
      }
    } catch (e) {}
  }

  /* ─── Wire desktop events ───────────────────────────── */
  function wireDesktop(picker) {
    try {
      var btn    = picker.querySelector('.lp-btn');
      var drop   = picker.querySelector('.lp-dropdown');
      var codeEl = picker.querySelector('.lp-code');
      var opts   = picker.querySelectorAll('.lp-option');

      if (!btn || !drop) return;

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = drop.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(open));
      });

      document.addEventListener('click', function () {
        drop.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          drop.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });

      opts.forEach(function (opt) {
        opt.addEventListener('click', function (e) {
          e.stopPropagation();
          var code = opt.dataset.code;

          // Update picker UI immediately so it feels responsive
          opts.forEach(function (o) {
            var a = o.dataset.code === code;
            o.classList.toggle('is-active', a);
            o.setAttribute('aria-selected', String(a));
          });
          if (codeEl) codeEl.textContent = getLang(code).short;
          drop.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');

          applyLang(code);
        });
      });
    } catch (e) {}
  }

  /* ─── Wire mobile drawer events ────────────────────── */
  function wireDrawer(wrap) {
    try {
      wrap.querySelectorAll('.lp-drawer-opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          applyLang(btn.dataset.code);
          // Close drawer
          var t = document.getElementById('navToggle');
          var d = document.getElementById('navDrawer');
          if (t) t.classList.remove('open');
          if (d) d.classList.remove('open');
        });
      });
    } catch (e) {}
  }

  /* ─── Apply language ────────────────────────────────── */
  function applyLang(code) {
    try {
      // Reset to English
      if (code === 'en') {
        writeCookie(null);
        window.location.reload();
        return;
      }

      // Only show offline banner if we *know* the script failed to load
      if (scriptFailed) {
        showBanner(code);
        return;
      }

      // FAST PATH: GT already initialised on this page — use combo directly
      if (gtReady) {
        var combo = document.querySelector('.goog-te-combo');
        if (combo) {
          writeCookie('/en/' + code);
          combo.value = code;
          try { combo.dispatchEvent(new Event('change')); } catch (e2) {}
          setTimeout(keepVisible, 600);
          return;
        }
      }

      // PRIMARY PATH: set cookie and reload.
      // GT reads the cookie on the next page load and translates automatically.
      writeCookie('/en/' + code);
      window.location.reload();

    } catch (e) {}
  }

  /* ─── Offline / script-failed banner ───────────────── */
  function showBanner(code) {
    try {
      var old = document.getElementById('lp-fallback');
      if (old) old.remove();

      var lang = getLang(code);
      var bar  = document.createElement('div');
      bar.id   = 'lp-fallback';
      bar.setAttribute('role', 'status');
      bar.setAttribute('aria-live', 'polite');
      bar.innerHTML =
        '<span>' + ICON_GLOBE +
        ' Translation to <strong>' + lang.native +
        '</strong> is unavailable offline.</span>' +
        '<button id="lp-fallback-close" aria-label="Dismiss">\u00d7</button>';
      document.body.appendChild(bar);

      var close = document.getElementById('lp-fallback-close');
      if (close) close.addEventListener('click', function () { bar.remove(); });
      setTimeout(function () { if (bar.parentNode) bar.remove(); }, 6000);
    } catch (e) {}
  }

  /* ─── Load Google Translate ─────────────────────────── */
  function loadGT() {
    try {
      // GT needs a real (non-clipped) element to attach to.
      // We hide it visually but keep it accessible in the DOM.
      if (!document.getElementById('google_translate_element')) {
        var el = document.createElement('div');
        el.id = 'google_translate_element';
        el.style.cssText =
          'position:absolute;top:0;left:0;' +
          'width:1px;height:1px;' +
          'overflow:hidden;opacity:0;pointer-events:none;';
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
      }

      // GT calls this once its script has loaded
      window.googleTranslateElementInit = function () {
        try {
          new google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages: 'ar,zh-CN,nl,fr,de,hi,ja,es',
              autoDisplay: false,
            },
            'google_translate_element'
          );
          gtReady = true;
        } catch (e) {
          // TranslateElement threw — GT script loaded but couldn't init.
          // This is NOT an offline error; cookie+reload still works fine.
          // We intentionally do NOT set scriptFailed here.
        }
        // Always restore body visibility after GT does its thing
        keepVisible();
        setTimeout(keepVisible, 500);
        setTimeout(keepVisible, 1500);
      };

      // Inject GT script — deferred so it never delays first paint
      var s    = document.createElement('script');
      s.src    = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      s.async  = true;
      s.defer  = true;

      s.onerror = function () {
        // Script failed = genuinely offline or GT blocked.
        // Only NOW is it right to flag failure.
        scriptFailed = true;
        keepVisible();
        // If user had already selected a non-English language, inform them
        var code = readCookie();
        if (code !== 'en') {
          showBanner(code);
          writeCookie(null); // reset cookie so next load is clean
        }
      };

      document.head.appendChild(s);

    } catch (e) {}
  }

  /* ─── Boot ──────────────────────────────────────────── */
  /* ─── Browser language detection ───────────────────────
     On first visit (no cookie), read navigator.language and
     auto-translate if the browser's language is supported.
     The user can always override via the picker.              */
  function detectBrowserLang() {
    try {
      // Already have a preference set — respect it, don't override
      if (readCookie() !== 'en') return;

      // Check if this is a first visit (no prior lang cookie at all)
      var hasVisited = false;
      try { hasVisited = !!localStorage.getItem('lp-visited'); } catch(e) {}
      if (hasVisited) return; // Returning visitor chose English — keep it

      // Mark as visited so we don't re-trigger on every page load
      try { localStorage.setItem('lp-visited', '1'); } catch(e) {}

      // navigator.language examples: 'nl', 'nl-NL', 'zh-CN', 'fr-FR', 'ar'
      var browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (!browserLang || browserLang.startsWith('en')) return; // English — nothing to do

      // Try exact match first (e.g. 'zh-CN'), then prefix match (e.g. 'nl' from 'nl-NL')
      var matched = null;
      for (var i = 0; i < LANGS.length; i++) {
        if (LANGS[i].code === 'en') continue;
        var langCode = LANGS[i].code.toLowerCase();
        if (langCode === browserLang || browserLang.startsWith(langCode.split('-')[0])) {
          matched = LANGS[i].code;
          break;
        }
      }

      if (matched) {
        writeCookie('/en/' + matched);
        window.location.reload();
      }
    } catch(e) {}
  }

  function boot() {
    try {
      keepVisible(); // Immediate guard
      detectBrowserLang(); // Auto-translate on first visit if browser lang is supported
      injectPickers(getLang(readCookie()));
      loadGT();
      // Belt-and-suspenders: restore visibility after GT has had time to run
      setTimeout(keepVisible, 1000);
      setTimeout(keepVisible, 2500);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}());
