document.addEventListener('DOMContentLoaded', () => {
  // Fade-up
  const obs = new IntersectionObserver(entries =>
    entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')),
    { threshold: 0.07 }
  );
  const fadeEls = document.querySelectorAll('.fade-up');
  fadeEls.forEach(el => obs.observe(el));
  // Safety net: if observer never fires (e.g. GT iframe issues), show all after 1.5s
  setTimeout(() => fadeEls.forEach(el => el.classList.add('visible')), 1500);

  // Theme toggle
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next   = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('nk-theme', next); } catch(e) {}
      // Re-tint nav scroll border for dark mode
      syncNavBorder();
    });
  }

  // Nav border on scroll
  const navEl = document.querySelector('nav');
  function syncNavBorder() {
    if (!navEl) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    navEl.style.borderBottomColor = scrollY > 10
      ? (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')
      : (dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)');
  }
  if (navEl) window.addEventListener('scroll', syncNavBorder, { passive: true });

  // Hamburger
  const toggle = document.getElementById('navToggle');
  const drawer = document.getElementById('navDrawer');
  if (toggle && drawer) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      drawer.classList.toggle('open');
    });
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      toggle.classList.remove('open');
      drawer.classList.remove('open');
    }));
  }

  // How I Work tabs
  const tabs = document.querySelectorAll('.how-tab');
  const panels = document.querySelectorAll('.how-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.panel);
      if (target) target.classList.add('active');
    });
  });

  // Case study horizontal subnav — highlight on scroll
  const subLinks = document.querySelectorAll('.case-subnav a');
  if (subLinks.length) {
    // Use two observers: standard middle-of-viewport for most sections,
    // and a generous one for the last section so outcome always activates
    const secs = Array.from(subLinks).map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

    function activateLink(id) {
      subLinks.forEach(l => l.classList.remove('active'));
      const lnk = document.querySelector(`.case-subnav a[href="#${id}"]`);
      if (lnk) {
        lnk.classList.add('active');
        lnk.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      }
    }

    const mainObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) activateLink(e.target.id); });
    }, { rootMargin: '-12% 0px -72% 0px' });

    const lastObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) activateLink(e.target.id); });
    }, { rootMargin: '0px 0px -20% 0px' });

    secs.forEach((sec, i) => {
      if (i === secs.length - 1) lastObs.observe(sec);
      else mainObs.observe(sec);
    });
    if (subLinks[0]) subLinks[0].classList.add('active');
  }
});

// ── Whole-page dot grid spotlight ──
// Runs on homepage and about page (any page with .dot-target elements)
// Skipped on case study pages automatically
(function () {
  const targets = document.querySelectorAll('.dot-target');
  if (!targets.length) return;

  // Don't run on touch-only devices
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  document.addEventListener('mousemove', e => {
    targetX = e.clientX;
    targetY = e.clientY;
  }, { passive: true });

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick() {
    currentX = lerp(currentX, targetX, 0.08);
    currentY = lerp(currentY, targetY, 0.08);

    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      // Local Y: cursor position relative to this element's top edge
      const localY = currentY - rect.top;
      el.style.setProperty('--mx', currentX + 'px');
      el.style.setProperty('--my', localY + 'px');
    });

    requestAnimationFrame(tick);
  }
  tick();
})();
(function () {
  // Build overlay once
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  const img = document.createElement('img');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'lightbox-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Close');
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  document.body.appendChild(closeBtn);

  function open(src, alt) {
    img.src = src;
    img.alt = alt || '';
    overlay.classList.add('active');
    closeBtn.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function close() {
    overlay.classList.remove('active');
    closeBtn.style.display = 'none';
    document.body.style.overflow = '';
    setTimeout(() => { img.src = ''; }, 300);
  }

  closeBtn.style.display = 'none';
  overlay.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // Attach to all .zoomable images (including dynamically added)
  document.addEventListener('click', e => {
    const target = e.target.closest('img.zoomable');
    if (target) open(target.src, target.alt);
  });
})();
