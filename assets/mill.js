/* ==========================================================================
   mashharawi.com, the mill band
   --------------------------------------------------------------------------
   Upgrades the static .strip band in the hero into a live particle field.

   The idea is the site's own thesis, animated: on the left the particles sit
   on the rib pattern of a deformed reinforcing bar (two longitudinal ribs
   plus transverse ribs, the same geometry the CSS draws statically). On the
   right they sit on a regular lattice, data. A soft transition zone moves
   between the two, and inside that zone the particles run hot amber, the
   colour of steel leaving the rolling mill.

   Three things drive the transition:
     1. a very slow breathe, so the band is never still
     2. scroll position, so moving down the page pushes it toward data
     3. the pointer, which drags the transition locally, the cursor reheats
        the steel and melts it into the lattice

   Progressive enhancement: the markup keeps the original CSS-only .strip.
   This script adds a canvas inside it and sets .live, which hides the static
   pattern. With JavaScript off, or with prefers-reduced-motion, or on a
   browser without canvas, the page is exactly what it was before.
   ========================================================================== */
(function () {
  'use strict';

  var host = document.querySelector('.hero .strip');
  if (!host) return;

  var canvas = document.createElement('canvas');
  if (!canvas.getContext) return;
  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  canvas.className = 'mill-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.insertBefore(canvas, host.firstChild);
  host.classList.add('live');

  /* ---- axis labels, so the band explains itself ---- */
  function axis(cls, text) {
    var el = document.createElement('span');
    el.className = 'mill-axis ' + cls;
    el.setAttribute('aria-hidden', 'true');
    el.textContent = text;
    host.appendChild(el);
    return el;
  }
  var isRTL = document.documentElement.getAttribute('dir') === 'rtl';
  axis('mill-axis-a', isRTL ? 'حديد ساخن' : 'Hot rolled');
  axis('mill-axis-b', isRTL ? 'بيانات' : 'Data');

  /* ---- palette, read from the stylesheet so there is one source of truth -- */
  var css = getComputedStyle(document.documentElement);
  function token(name, fallback) {
    var v = css.getPropertyValue(name).trim();
    return v || fallback;
  }
  var C_SCALE = rgb(token('--scale', '#5A656D'));
  var C_HOT = rgb(token('--hot', '#D8600F'));
  var C_INK = rgb(token('--ink', '#101418'));

  function rgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  /* ---- geometry ---------------------------------------------------------- */
  var RIB_TILT = Math.tan(12 * Math.PI / 180); // matches the CSS 102deg ribs
  var RIB_GAP = 15;   // px between transverse ribs
  var FEATHER = 0.20; // width of the transition zone, as a fraction of width
  var POINTER_R = 118;

  var dpr = 1, W = 0, H = 0;
  var P = [];             // particles
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var visible = true, raf = 0, t0 = 0;
  var px = -1e4, py = -1e4, pOn = false;   // pointer, in css px
  var scrollProg = 0;
  var snap = false;  // true for the single static frame: no easing, no drift

  function smooth(e0, e1, x) {
    var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
  }

  function build() {
    var r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* --- steel targets: the rib pattern of a deformed bar --- */
    var steel = [];
    var ribs = Math.ceil((W + H * RIB_TILT) / RIB_GAP) + 2;
    var perRib = Math.max(3, Math.round(H / 13));
    for (var k = 0; k < ribs; k++) {
      var x0 = k * RIB_GAP - H * RIB_TILT * 0.5;
      for (var j = 0; j < perRib; j++) {
        var yy = (j + 0.5) / perRib * H;
        steel.push([x0 + (yy / H - 0.5) * H * RIB_TILT, yy]);
      }
    }
    // the two longitudinal ribs
    var along = Math.max(8, Math.round(W / 7));
    for (var s = 0; s < 2; s++) {
      var ly = H * (s ? 0.66 : 0.34);
      for (var i = 0; i < along; i++) steel.push([(i + 0.5) / along * W, ly]);
    }

    /* --- how many particles: enough to read as a field, few enough that a
           phone stays at 60fps --- */
    var n = Math.round(Math.min(1300, Math.max(420, (W * H) / 380)));
    n = Math.min(n, steel.length);

    /* --- lattice targets: regular, because regular reads as digital.
           Shaped to the band's aspect ratio so the spacing is square. --- */
    var cols = Math.max(2, Math.round(Math.sqrt(n * (W / H))));
    var rows = Math.max(2, Math.round(n / cols));
    var lattice = [];
    for (var c = 0; c < cols; c++) {
      for (var rw = 0; rw < rows; rw++) {
        lattice.push([(c + 0.5) / cols * W, (rw + 0.5) / rows * H]);
      }
    }
    n = Math.min(n, lattice.length);
    // sort the lattice by x so a particle's two homes stay near each other
    steel.sort(function (a, b) { return a[0] - b[0]; });
    lattice.sort(function (a, b) { return a[0] - b[0]; });
    var step = lattice.length / n;
    P.length = 0;
    for (var q = 0; q < n; q++) {
      var sp = steel[Math.floor(q * (steel.length / n))];
      var lp = lattice[Math.floor(q * step)];
      P.push({
        sx: sp[0], sy: sp[1],
        lx: lp[0], ly: lp[1],
        ax: sp[0] / W,                      // place on the transition axis
        ph: Math.random() * Math.PI * 2,     // per-particle drift phase
        cx: sp[0], cy: sp[1]                 // current, for pointer easing
      });
    }
  }

  function frame(now) {
    raf = 0;
    if (!t0) t0 = now;
    var t = now - t0;
    if (!snap) readScroll();

    /* where the transition sits, 0 = all steel, 1 = all data */
    var breathe = 0.5 + 0.5 * Math.sin(t * 0.000135);
    var sweep = Math.min(1.18, Math.max(-0.12, breathe * 0.78 + 0.06 + scrollProg * 0.55));

    ctx.clearRect(0, 0, W, H);

    /* the two hairlines of the static pattern, kept as a faint memory */
    ctx.fillStyle = 'rgba(90,101,109,.20)';
    ctx.fillRect(0, Math.round(H * 0.34), W, 1);
    ctx.fillRect(0, Math.round(H * 0.66), W, 1);

    for (var i = 0; i < P.length; i++) {
      var p = P[i];

      var m = smooth(sweep - FEATHER, sweep + FEATHER, p.ax);

      /* the pointer drags the transition forward locally */
      var heatBoost = 0;
      if (pOn) {
        var dx0 = p.cx - px, dy0 = p.cy - py;
        var d2 = dx0 * dx0 + dy0 * dy0;
        if (d2 < POINTER_R * POINTER_R) {
          var f = 1 - Math.sqrt(d2) / POINTER_R;
          f = f * f;
          m = Math.min(1, m + 0.55 * f);
          heatBoost = f;
        }
      }

      var e = m * m * (3 - 2 * m);
      var tx = p.sx + (p.lx - p.sx) * e;
      var ty = p.sy + (p.ly - p.sy) * e;

      /* mid-flight particles drift, settled ones do not, steel in motion */
      var air = Math.sin(Math.PI * m);
      if (air > 0.02 && !reduce) {
        tx += Math.sin(t * 0.0011 + p.ph) * 5.5 * air;
        ty += Math.cos(t * 0.0009 + p.ph * 1.7) * 4.2 * air;
      }

      if (snap) { p.cx = tx; p.cy = ty; }
      else { p.cx += (tx - p.cx) * 0.14; p.cy += (ty - p.cy) * 0.14; }

      /* colour: mill-scale grey at rest on the steel side, amber while
         it is being transformed, graphite once it has settled as data */
      var heat = Math.max(air, heatBoost * 0.9);
      var base = mix(C_SCALE, C_INK, e);
      var col = mix(base, C_HOT, Math.min(1, heat * 1.25));
      var alpha = 0.42 + 0.5 * heat + 0.1 * (1 - e);
      var size = 1.5 + 1.6 * heat + 0.7 * e;

      ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha.toFixed(3) + ')';
      ctx.fillRect(p.cx - size / 2, p.cy - size / 2, size, size);
    }

    /* the transition line itself */
    if (sweep > -0.05 && sweep < 1.05) {
      var lx = sweep * W;
      var g = ctx.createLinearGradient(lx - 26, 0, lx + 26, 0);
      g.addColorStop(0, 'rgba(216,96,15,0)');
      g.addColorStop(0.5, 'rgba(216,96,15,.42)');
      g.addColorStop(1, 'rgba(216,96,15,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - 26, 0, 52, H);
    }

    if (!reduce && visible) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && visible && !reduce) raf = requestAnimationFrame(frame);
  }

  /* ---- events ----------------------------------------------------------- */
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { build(); t0 = 0; if (reduce) drawStatic(); else kick(); }, 160);
  }, { passive: true });

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top; pOn = true;
      kick();
    }, { passive: true });
    host.addEventListener('pointerleave', function () { pOn = false; }, { passive: true });
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) kick();
    }, { threshold: 0.01 }).observe(host);
  }

  /* Scroll position is read inside the animation frame, not in a scroll
     listener. getBoundingClientRect() forces layout, and doing that on the
     scroll thread is what makes a page feel heavy; inside rAF it happens at
     most once per painted frame, and not at all while the band is offscreen. */
  function readScroll() {
    var r = host.getBoundingClientRect();
    // 0 while the band is in view, rising to 1 once it has left upward
    scrollProg = Math.min(1, Math.max(0, -r.top / Math.max(1, window.innerHeight * 0.8)));
  }

  function drawStatic() {
    /* One frame, the transition parked near the middle of the band so both
       states are visible, with easing and drift switched off. t = 951 ms is
       where the breathe curve puts sweep at roughly 0.5. */
    reduce = true; pOn = false; snap = true; t0 = 1;
    frame(952);
    snap = false;
  }

  build();
  if (reduce) drawStatic(); else kick();
})();
