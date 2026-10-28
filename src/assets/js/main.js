// Site-wide behaviour: language memory, menu, header, page transitions and motion.
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  // Remember the language the visitor picks.
  document.querySelectorAll('[data-lang-link]').forEach(function (link) {
    link.addEventListener('click', function () {
      try { localStorage.setItem('lang', link.dataset.langLink); } catch (e) {}
    });
  });

  // ---------------------------------------------------------------- menu
  var toggle = document.querySelector('[data-menu-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    var label = toggle.querySelector('[data-menu-label]');
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      label.textContent = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function () { setOpen(false); });
  }

  // ------------------------------------------- page transitions fallback
  // Browsers with cross-document View Transitions animate natively (see CSS).
  if (!('onpagereveal' in window) && !reduceMotion) {
    root.classList.add('page-fade');
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (a.target === '_blank' || a.hasAttribute('download') || a.origin !== location.origin) return;
      if (a.pathname === location.pathname && a.hash) return;
      e.preventDefault();
      root.classList.add('is-leaving');
      setTimeout(function () { location.href = a.href; }, 240);
    });
    window.addEventListener('pageshow', function () { root.classList.remove('is-leaving'); });
  }

  // ----------------------------------------- header, progress, mobile bar
  var header = document.querySelector('[data-header]');
  var bar = document.querySelector('[data-mobile-bar]');
  var progress = document.querySelector('[data-progress]');
  var process = document.querySelector('[data-process]');
  var lastY = window.scrollY;
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (header) {
      header.classList.toggle('is-scrolled', y > 24);
      header.classList.toggle('is-hidden', y > 400 && y > lastY && !document.body.classList.contains('menu-open'));
    }
    if (bar) bar.classList.toggle('is-visible', y > window.innerHeight * 0.5 && y < max - 200);
    if (progress) progress.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
    if (process) {
      var r = process.getBoundingClientRect();
      var p = (window.innerHeight * 0.75 - r.top) / r.height;
      process.style.setProperty('--line-progress', Math.max(0, Math.min(1, p)).toFixed(3));
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  // ------------------------------------------------------ split headings
  // Wraps each word so it can slide up from a mask; keeps inner <em>, <span>.
  document.querySelectorAll('[data-split]').forEach(function (el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var outer = document.createElement('span');
            var inner = document.createElement('span');
            outer.className = 'split-word';
            inner.textContent = part;
            inner.style.setProperty('--i', i++);
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    el.classList.add('is-split');
  });

  // ------------------------------------------------------ scroll reveal
  var items = document.querySelectorAll('.reveal, [data-split], [data-reveal]');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    items.forEach(function (el) {
      if (!el.classList.contains('reveal')) return;
      var siblings = el.parentElement.querySelectorAll(':scope > .reveal');
      var index = Array.prototype.indexOf.call(siblings, el);
      if (index > 0) el.style.setProperty('--delay', Math.min(index, 6) * 0.09 + 's');
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    items.forEach(function (el) { observer.observe(el); });
  }

  // ------------------------------------------- pause off-screen loops
  // Aurora, marquee and the seal keep animating forever; stop them while unseen.
  if ('IntersectionObserver' in window && !reduceMotion) {
    var loops = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
      });
    });
    document.querySelectorAll('.dark, .marquee').forEach(function (el) { loops.observe(el); });
  }

  // ------------------------------------------------------ booking form
  // Sends to Formspree in the background and shows the result in place.
  document.querySelectorAll('[data-form]').forEach(function (form) {
    var button = form.querySelector('button[type="submit"]');
    var ok = form.querySelector('[data-form-success]');
    var fail = form.querySelector('[data-form-error]');
    var buttonText = button.textContent;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ok.hidden = true;
      fail.hidden = true;
      button.disabled = true;
      button.textContent = form.dataset.msgSending;

      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error(res.status);
          form.reset();
          ok.hidden = false;
        })
        .catch(function () { fail.hidden = false; })
        .then(function () {
          button.disabled = false;
          button.textContent = buttonText;
        });
    });
  });

  if (!finePointer || reduceMotion) return;

  // ---------------------------------------------- pointer-driven touches
  // Spotlight that follows the cursor inside cards.
  document.querySelectorAll('.spotlight').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - r.left + 'px');
      el.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  });

  // Magnetic buttons pull slightly toward the cursor.
  document.querySelectorAll('[data-magnetic]').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width / 2) * 0.25;
      var y = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
    el.addEventListener('pointerleave', function () { el.style.transform = ''; });
  });

  // Gentle parallax on the hero portrait.
  var media = document.querySelector('[data-parallax]');
  if (media) {
    var pointer = null;
    window.addEventListener('pointermove', function (e) {
      if (!pointer) requestAnimationFrame(function () {
        var x = (pointer.clientX / window.innerWidth - 0.5) * 14;
        var y = (pointer.clientY / window.innerHeight - 0.5) * 14;
        media.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        pointer = null;
      });
      pointer = e;
    }, { passive: true });
  }
})();
