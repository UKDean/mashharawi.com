/* ==========================================================================
   mashharawi.com, 404: "the missing page in the steel factory"
   --------------------------------------------------------------------------
   A small cinematic scene drawn on one 2D canvas, no libraries:

     0.0 - 1.5 s  the hall fades in, the high-bay lamps strike one by one
     1.5 - 3.0 s  ribbed bars run out of the mill along the roller table
     3.0 - 5.0 s  three lifting magnets pick the bars up and set them into
                  a 404 built like a welded rebar cage; every joint is
                  welded with a burst of sparks
     5.0 - 6.0 s  the copy and the button come in (the page adds .is-ready)
     after 6 s    the mill keeps running quietly: rollers turn, a bar passes
                  now and then, dust drifts in the lamp light, a glint runs
                  over the 404

   Colours follow the site's noir system (site.css): warm black, bone white
   and neutral steel greys; the only hue is the light of hot steel.

   Why canvas and not WebGL/Three.js/GSAP: the site has no build step and no
   animation dependencies, and a 404 has to load instantly. Every static part
   (hall, girder, vignette, each bar's ribbed sprite) is drawn once per
   resize into an offscreen layer, so a frame is a handful of drawImage
   calls plus the moving parts.

   Progressive enhancement: the markup carries a static SVG 404 and visible
   copy. This script replaces the SVG with the canvas and holds the copy back
   until the bars are welded. No canvas: nothing changes. Reduced motion: the
   finished scene is drawn once, still, and the copy shows at once.
   ========================================================================== */
(function () {
  'use strict';

  var hero = document.querySelector('.nf');
  var stage = hero && hero.querySelector('.nf-stage');
  if (!stage) return;

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function ready() { hero.classList.add('is-ready'); }

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) { ready(); return; }
  canvas.className = 'nf-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);
  hero.classList.add('is-live');

  /* ---- palette ---------------------------------------------------------- */
  // the site's noir tokens: warm black, bone white, neutral greys; the only
  // colour is the light of hot steel (sparks and fresh welds)
  var CHAR = '#0B0B0A', STEEL = '#7A7975', SILVER = '#D0CEC8', BONE = '#EFEDE8';

  /* ---- timeline, seconds ------------------------------------------------ */
  var T = { fade: 1.3, travel0: 1.5, travel1: 3.0, lift0: 3.0, liftStep: 0.22, liftDur: 1.45, copy: 5.0, idle: 6.0 };

  /* ---- the glyphs, in digit-height units: bars [x1,y1,x2,y2], weld joints - */
  var GLYPH = {
    '4': { bars: [[0.46, -0.05, 0.46, 1.05], [0.50, -0.01, -0.03, 0.72], [-0.07, 0.68, 0.67, 0.68]],
           joints: [[0.46, 0.68], [0.476, 0.02], [0.0, 0.68]] },
    '0': { bars: [[-0.07, 0, 0.69, 0], [-0.07, 1, 0.69, 1], [0, -0.07, 0, 1.07], [0.62, -0.07, 0.62, 1.07]],
           joints: [[0, 0], [0.62, 0], [0, 1], [0.62, 1]] }
  };
  var LANE_F = [0.74, 0.5, 0.26];     // depth on the roller table, back to front
  var LANE_S = [0.92, 0.96, 1];       // matching scale

  var W = 0, H = 0, dpr = 1, mobile = false, Lo = {};
  var bg = null, fg = null, front = null, vig = null, hazard = null, rollGrad = null;
  var bars = [], digits = [], sparks = [], flashes = [], dust = [], passers = [], lamps = [];
  var t = 0, last = 0, acc = 0, running = false, onScreen = true, rollPhase = 0, nextPass = T.idle + 1.5;
  var copyShown = false, spriteCache = {};

  /* ---- helpers ---------------------------------------------------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { k = clamp(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function easeOut(k) { k = clamp(k, 0, 1); return 1 - Math.pow(1 - k, 3); }
  var seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function layer(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    var x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c: c, x: x, w: w, h: h };
  }

  /* ---- layout ----------------------------------------------------------- */
  function layout() {
    var r = stage.getBoundingClientRect();
    W = Math.max(280, r.width);
    H = Math.max(280, r.height);
    mobile = W < 720;
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    Lo.gantryY = mobile ? Math.max(H * 0.17, 72) : Math.max(H * 0.10, 84);
    Lo.gantryH = Math.max(12, H * (mobile ? 0.028 : 0.034));
    Lo.convY = H * (mobile ? 0.80 : 0.50);
    // the table is 0.18u deep and the 404 stands clear of it; leave room above
    // for the hoist, ropes and magnet under the girder
    var gb = Lo.gantryY + Lo.gantryH, lift = Lo.gantryH * 0.7 + 18;
    var room = (Lo.convY - H * 0.02 - gb - lift) / 1.36;
    Lo.u = Math.min(mobile ? Math.min(H * 0.46, W * 0.86 / 2.2) : Math.min(H * 0.29, W * 0.6 / 2.2), room);
    Lo.d = Math.max(6, Lo.u * 0.075);
    Lo.depth = Lo.d * 2.4;
    Lo.beamH = Lo.d * 2.1;
    Lo.baseY = Lo.convY - Lo.depth - Lo.d * 1.4 - H * 0.02;
    Lo.floorY = Lo.convY + Lo.beamH + H * (mobile ? 0.05 : 0.06);
    Lo.x0 = W / 2 - 1.1 * Lo.u;
    Lo.sp = Math.max(20, Lo.d * 2);
    Lo.magH = Math.max(7, Lo.u * 0.06);
    Lo.k = Lo.u / 236;                              // physics scale

    var lx = mobile ? [0.1, 0.9] : [0.08, 0.28, 0.72, 0.92];
    lamps = lx.map(function (f, j) {
      return { x: W * f, y: Lo.gantryY + Lo.gantryH + H * 0.03, on: 0.25 + j * 0.2 };
    });
  }

  /* ---- one ribbed bar, prerendered horizontally ------------------------- */
  function sprite(len, d) {
    var key = Math.round(len) + ':' + Math.round(d * 10);
    if (spriteCache[key]) return spriteCache[key];
    var pad = Math.ceil(d * 0.9), w = len + pad * 2, h = d + pad * 2, r = d / 2;
    var L = layer(w, h), x = L.x;
    x.translate(w / 2, h / 2);

    // soft contact shadow, baked in
    x.save();
    x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = d * 0.8; x.shadowOffsetY = d * 0.35;
    x.fillStyle = '#000'; x.fillRect(-len / 2, -r, len, d);
    x.restore();

    // round body
    var g = x.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#2a2a28'); g.addColorStop(0.16, STEEL); g.addColorStop(0.34, SILVER);
    g.addColorStop(0.46, '#a8a6a0'); g.addColorStop(0.7, '#5d5c58'); g.addColorStop(1, '#1a1a18');
    x.fillStyle = g; x.fillRect(-len / 2, -r, len, d);

    // longitudinal ribs
    x.fillStyle = 'rgba(239,237,232,.30)'; x.fillRect(-len / 2, -r * 0.62, len, Math.max(1, d * 0.07));
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-len / 2, r * 0.55, len, Math.max(1, d * 0.06));

    // transverse ribs: slanted crescents that break the silhouette
    var pitch = d * 0.72, lw = Math.max(1.2, d * 0.16), sl = d * 0.28, bow = d * 0.12;
    var gr = x.createLinearGradient(0, -r, 0, r);
    gr.addColorStop(0, 'rgba(72,71,68,1)'); gr.addColorStop(0.24, 'rgba(242,240,235,.95)');
    gr.addColorStop(0.5, 'rgba(172,170,164,.75)'); gr.addColorStop(1, 'rgba(28,28,26,.95)');
    x.lineCap = 'round';
    for (var px = -len / 2 + pitch * 0.6; px < len / 2 - pitch * 0.4; px += pitch) {
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = lw;
      x.beginPath(); x.moveTo(px + lw * 0.6, -r * 1.02);
      x.quadraticCurveTo(px + sl * 0.5 + lw * 0.6 + bow, 0, px + sl + lw * 0.6, r * 1.02); x.stroke();
      x.strokeStyle = gr;
      x.beginPath(); x.moveTo(px, -r * 1.08);
      x.quadraticCurveTo(px + sl * 0.5 + bow, 0, px + sl, r * 1.08); x.stroke();
    }

    // sheared ends
    [-1, 1].forEach(function (s) {
      var eg = x.createRadialGradient(s * len / 2 - d * 0.05, -r * 0.3, 0, s * len / 2, 0, r * 1.1);
      eg.addColorStop(0, '#a3a19b'); eg.addColorStop(1, '#373633');
      x.fillStyle = eg;
      x.beginPath(); x.ellipse(s * len / 2, 0, d * 0.16, r, 0, 0, Math.PI * 2); x.fill();
    });

    var out = { c: L.c, w: w, h: h };
    spriteCache[key] = out;
    return out;
  }

  /* ---- the 404 and its bars --------------------------------------------- */
  function build() {
    bars = []; digits = [];
    var u = Lo.u, dw = 0.62 * u, g = 0.17 * u, lane = 0;
    '404'.split('').forEach(function (ch, k) {
      var gl = GLYPH[ch], ox = Lo.x0 + k * (dw + g), oy = Lo.baseY - u;
      var dg = {
        k: k, cx: ox + dw / 2, w: dw * 1.02,
        t0: T.lift0 + k * T.liftStep, bars: [],
        joints: gl.joints.map(function (j) { return { x: ox + j[0] * u, y: oy + j[1] * u, heat: 0 }; })
      };
      dg.t1 = dg.t0 + T.liftDur;
      dg.welded = t >= dg.t1;
      gl.bars.forEach(function (b) {
        var x1 = ox + b[0] * u, y1 = oy + b[1] * u, x2 = ox + b[2] * u, y2 = oy + b[3] * u;
        var len = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
        if (a > Math.PI / 2) a -= Math.PI;
        if (a <= -Math.PI / 2) a += Math.PI;
        var ln = lane++ % 3, s = LANE_S[ln];
        var bar = {
          len: len, a1: a, x1: (x1 + x2) / 2, y1: (y1 + y2) / 2, lane: ln, ls: s, dg: dg,
          sp: sprite(len, Lo.d)
        };
        bar.px = clamp(bar.x1, len * s / 2 + 8, W - len * s / 2 - 8);
        bar.py = Lo.convY - Lo.depth * LANE_F[ln] - Lo.d * 0.42 * s;
        bar.sx = -len * s / 2 - 30 - bars.length * W * 0.045;
        bars.push(bar); dg.bars.push(bar);
      });
      digits.push(dg);
    });
    // where each magnet meets its bars on the table
    digits.forEach(function (dg) { dg.pickTop = topOf(dg, dg.t0 - 1e-4); });
  }

  function pose(b, tt) {
    var dg = b.dg;
    if (tt < dg.t0) {
      var k = easeOut((tt - T.travel0) / (T.travel1 - T.travel0));
      return { x: lerp(b.sx, b.px, k), y: b.py, a: 0, s: b.ls };
    }
    var e = ease((tt - dg.t0) / T.liftDur);
    return { x: lerp(b.px, b.x1, e), y: lerp(b.py, b.y1, e), a: lerp(0, b.a1, e), s: lerp(b.ls, 1, e) };
  }
  function topOf(dg, tt) {
    var m = Infinity;
    dg.bars.forEach(function (b) {
      var p = pose(b, tt);
      var y = p.y - (Math.abs(Math.sin(p.a)) * b.len / 2 + Lo.d * 0.55) * p.s;
      if (y < m) m = y;
    });
    return m;
  }

  /* ---- static layers ---------------------------------------------------- */
  function drawStatic() {
    var i, x;
    /* hall */
    bg = layer(W, H); x = bg.x;
    var g = x.createLinearGradient(0, 0, 0, Lo.floorY);
    g.addColorStop(0, '#080807'); g.addColorStop(0.55, CHAR); g.addColorStop(1, '#191917');
    x.fillStyle = g; x.fillRect(0, 0, W, Lo.floorY);

    x.fillStyle = 'rgba(255,255,255,.017)';                       // wall cladding
    for (i = 0; i < W; i += 12) x.fillRect(i, Lo.gantryY, 1, Lo.floorY - Lo.gantryY);

    var n = mobile ? 4 : 9, ww = W / (n * 1.6 + 0.6), wy = Lo.gantryY + H * 0.05, wh = H * (mobile ? 0.15 : 0.17);
    var wx0 = (W - (n * ww + (n - 1) * ww * 0.6)) / 2;
    for (i = 0; i < n; i++) {                                      // clerestory windows
      var wx = wx0 + i * ww * 1.6;
      var wg = x.createLinearGradient(0, wy, 0, wy + wh);
      wg.addColorStop(0, 'rgba(239,237,232,.075)'); wg.addColorStop(1, 'rgba(239,237,232,.015)');
      x.fillStyle = wg; x.fillRect(wx, wy, ww, wh);
      x.strokeStyle = 'rgba(8,8,7,.92)'; x.lineWidth = 2;
      x.strokeRect(wx, wy, ww, wh);
      x.beginPath();
      x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh);
      for (var m = 1; m < 4; m++) { x.moveTo(wx, wy + wh * m / 4); x.lineTo(wx + ww, wy + wh * m / 4); }
      x.stroke();
    }

    var cols = mobile ? 3 : 6, cw = Math.max(8, W * 0.013);       // far columns
    for (i = 0; i <= cols; i++) {
      var cx = (W / cols) * i - cw / 2;
      var cg = x.createLinearGradient(cx, 0, cx + cw, 0);
      cg.addColorStop(0, '#141413'); cg.addColorStop(0.45, '#2a2a28'); cg.addColorStop(1, '#111110');
      x.fillStyle = cg; x.fillRect(cx, Lo.gantryY, cw, Lo.floorY - Lo.gantryY);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(cx + cw * 0.3, Lo.gantryY, 1, Lo.floorY - Lo.gantryY);
    }

    if (!mobile) {                                                 // roof truss
      var ty0 = Lo.gantryY * 0.18, ty1 = Lo.gantryY - 10;
      x.strokeStyle = 'rgba(165,163,157,.12)'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(0, ty0); x.lineTo(W, ty0); x.moveTo(0, ty1); x.lineTo(W, ty1);
      for (i = 0, n = 0; i < W + 40; i += 40, n++) { x.moveTo(i, n % 2 ? ty0 : ty1); x.lineTo(i + 40, n % 2 ? ty1 : ty0); }
      x.stroke();
    }

    var fgr = x.createLinearGradient(0, Lo.floorY, 0, H);          // floor
    fgr.addColorStop(0, '#171716'); fgr.addColorStop(1, '#0B0B0A');
    x.fillStyle = fgr; x.fillRect(0, Lo.floorY, W, H - Lo.floorY);
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, Lo.floorY, W, 2);
    x.save();
    x.beginPath(); x.rect(0, Lo.floorY, W, H - Lo.floorY); x.clip();
    x.strokeStyle = 'rgba(255,255,255,.028)'; x.lineWidth = 1;
    var vx = W / 2, vy = Lo.floorY - H * 0.45;
    x.beginPath();
    for (i = -W; i <= W * 2; i += W / (mobile ? 6 : 12)) { x.moveTo(vx, vy); x.lineTo(i, H * 1.6); }
    for (i = 1; i < 6; i++) { var fy = Lo.floorY + (H - Lo.floorY) * Math.pow(i / 6, 1.6); x.moveTo(0, fy); x.lineTo(W, fy); }
    x.stroke();
    var sy = Lo.floorY + (H - Lo.floorY) * 0.3;                    // painted safety line
    x.strokeStyle = 'rgba(239,237,232,.14)'; x.lineWidth = Math.max(2, Lo.d * 0.18);
    x.setLineDash([W * 0.04, W * 0.022]);
    x.beginPath(); x.moveTo(0, sy); x.lineTo(W, sy); x.stroke();
    x.restore();

    /* gantry girder (drawn over the lamp light) */
    fg = layer(W, H); x = fg.x;
    var gy = Lo.gantryY, gh = Lo.gantryH;
    var sh = x.createLinearGradient(0, gy + gh, 0, gy + gh + 14);
    sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = sh; x.fillRect(0, gy + gh, W, 14);
    var gg = x.createLinearGradient(0, gy, 0, gy + gh);
    gg.addColorStop(0, '#4a4945'); gg.addColorStop(0.5, '#333230'); gg.addColorStop(1, '#1c1c1a');
    x.fillStyle = gg; x.fillRect(0, gy, W, gh);
    x.fillStyle = 'rgba(239,237,232,.28)'; x.fillRect(0, gy, W, 1);
    x.fillStyle = 'rgba(0,0,0,.22)';
    for (i = 18; i < W; i += 46) x.fillRect(i, gy + 2, 2, gh - 3);
    x.fillStyle = 'rgba(0,0,0,.45)';
    for (i = 9; i < W; i += 23) { x.beginPath(); x.arc(i, gy + gh * 0.18, 1.1, 0, 7); x.arc(i, gy + gh * 0.82, 1.1, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(239,237,232,.42)';
    x.font = '600 ' + Math.max(8, gh * 0.42) + 'px ui-monospace,Menlo,monospace';
    x.textBaseline = 'middle';
    x.fillText('SWL 25 t', W - (mobile ? 64 : 110), gy + gh / 2 + 0.5);

    /* mill housing the bars come out of (wide screens) */
    front = null;
    if (!mobile) {
      front = layer(W, H); x = front.x;
      var hw = Math.max(70, W * 0.06), hy = Lo.gantryY + gh + 18, hb = Lo.convY + Lo.beamH;
      var hg = x.createLinearGradient(0, 0, hw, 0);
      hg.addColorStop(0, '#0e0e0d'); hg.addColorStop(0.8, '#222220'); hg.addColorStop(1, '#2e2d2b');
      x.fillStyle = hg; x.fillRect(0, hy, hw, hb - hy);
      x.fillStyle = 'rgba(208,206,200,.18)'; x.fillRect(hw - 1, hy, 1, hb - hy);
      x.fillStyle = '#070706';
      x.fillRect(hw - 6, Lo.convY - Lo.depth - Lo.d * 1.2, 6, Lo.depth + Lo.d * 1.2);
      Lo.housingW = hw;
    }

    /* vignette and blend into the page */
    vig = layer(W, H); x = vig.x;
    var vg = x.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(6,6,5,0)'); vg.addColorStop(1, 'rgba(6,6,5,.78)');
    x.fillStyle = vg; x.fillRect(0, 0, W, H);
    var top = x.createLinearGradient(0, 0, 0, H * 0.16);
    top.addColorStop(0, 'rgba(11,11,10,.65)'); top.addColorStop(1, 'rgba(11,11,10,0)');
    x.fillStyle = top; x.fillRect(0, 0, W, H * 0.16);
    var bot = x.createLinearGradient(0, H * (mobile ? 0.9 : 0.66), 0, H);
    bot.addColorStop(0, 'rgba(11,11,10,0)'); bot.addColorStop(1, 'rgba(11,11,10,1)');
    x.fillStyle = bot; x.fillRect(0, H * (mobile ? 0.9 : 0.66), W, H);

    /* hazard stripe pattern and the roller gradient */
    var hp = layer(16, 16);
    hp.x.fillStyle = CHAR; hp.x.fillRect(0, 0, 16, 16);
    hp.x.fillStyle = '#4a4945';
    hp.x.beginPath(); hp.x.moveTo(0, 16); hp.x.lineTo(8, 0); hp.x.lineTo(16, 0); hp.x.lineTo(8, 16); hp.x.fill();
    hazard = ctx.createPattern(hp.c, 'repeat');
    var rw = Lo.sp * 0.5;
    rollGrad = ctx.createLinearGradient(-rw / 2, 0, rw / 2, 0);
    rollGrad.addColorStop(0, '#151514'); rollGrad.addColorStop(0.3, '#43423f');
    rollGrad.addColorStop(0.55, '#7d7b76'); rollGrad.addColorStop(0.8, '#444340'); rollGrad.addColorStop(1, '#151514');

    /* dust */
    dust = [];
    if (!mobile) {
      lamps.forEach(function (l, j) {
        for (var q = 0; q < 14; q++) dust.push({ j: j, x: l.x + (rnd() - 0.5) * H * 0.3, y: l.y + rnd() * (Lo.floorY - l.y), vx: (rnd() - 0.5) * 6, vy: -2 - rnd() * 4, r: 0.6 + rnd() * 1.1, ph: rnd() * 6 });
      });
    }
  }

  /* ---- dynamic drawing -------------------------------------------------- */
  function lampI(l) {
    if (t < l.on) return 0;
    var s = t - l.on;
    if (s < 0.42) return [1, 0.1, 0.8, 0.15, 1, 0.5, 1][Math.floor(s / 0.06)] || 1;
    return 0.96 + 0.04 * Math.sin(t * 1.7 + l.x);
  }

  function drawLight() {
    ctx.globalCompositeOperation = 'lighter';
    // furnace glow from the mill on the left
    var f = clamp((t - 0.6) / 1.2, 0, 1) * (0.82 + 0.18 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.3));
    if (f > 0) {
      var fr = ctx.createRadialGradient(0, Lo.convY - Lo.depth, 0, 0, Lo.convY - Lo.depth, H * (mobile ? 0.45 : 0.6));
      fr.addColorStop(0, 'rgba(200,120,60,' + 0.12 * f + ')'); fr.addColorStop(1, 'rgba(200,120,60,0)');
      ctx.fillStyle = fr; ctx.fillRect(0, 0, W, H);
    }
    lamps.forEach(function (l) {
      var I = lampI(l); l.I = I;
      if (!I) return;
      var bot = Lo.floorY + (H - Lo.floorY) * 0.55, spread = H * 0.26;
      var cg = ctx.createLinearGradient(0, l.y, 0, bot);
      cg.addColorStop(0, 'rgba(239,237,232,' + 0.12 * I + ')'); cg.addColorStop(1, 'rgba(239,237,232,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(l.x - 10, l.y); ctx.lineTo(l.x + 10, l.y);
      ctx.lineTo(l.x + spread, bot); ctx.lineTo(l.x - spread, bot); ctx.closePath(); ctx.fill();
      var py = Lo.floorY + (H - Lo.floorY) * 0.28;
      ctx.save(); ctx.translate(l.x, py); ctx.scale(1, 0.22);
      var pg = ctx.createRadialGradient(0, 0, 0, 0, 0, H * 0.24);
      pg.addColorStop(0, 'rgba(239,237,232,' + 0.09 * I + ')'); pg.addColorStop(1, 'rgba(239,237,232,0)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, H * 0.24, 0, 7); ctx.fill();
      ctx.restore();
    });
    dust.forEach(function (p) {
      var I = lamps[p.j].I || 0;
      if (!I) return;
      ctx.fillStyle = 'rgba(239,237,232,' + (0.18 + 0.12 * Math.sin(t * 2 + p.ph)) * I + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawLamps() {
    lamps.forEach(function (l) {
      var s = Math.max(10, H * 0.018), I = l.I || 0;
      ctx.strokeStyle = '#2a2a28'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(l.x, Lo.gantryY + Lo.gantryH); ctx.lineTo(l.x, l.y - s * 0.6); ctx.stroke();
      ctx.fillStyle = '#262624';
      ctx.beginPath();
      ctx.moveTo(l.x - s * 0.35, l.y - s * 0.7); ctx.lineTo(l.x + s * 0.35, l.y - s * 0.7);
      ctx.lineTo(l.x + s, l.y); ctx.lineTo(l.x - s, l.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(208,206,200,.25)'; ctx.fillRect(l.x - s, l.y - 1, s * 2, 1);
      if (I) {
        ctx.globalCompositeOperation = 'lighter';
        var bg2 = ctx.createRadialGradient(l.x, l.y + 1, 0, l.x, l.y + 1, s * 2.4);
        bg2.addColorStop(0, 'rgba(255,248,232,' + 0.95 * I + ')'); bg2.addColorStop(0.25, 'rgba(240,236,226,' + 0.35 * I + ')'); bg2.addColorStop(1, 'rgba(240,236,226,0)');
        ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(l.x, l.y + 1, s * 2.4, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    });
  }

  function drawConveyor() {
    var top = Lo.convY - Lo.depth, rw = Lo.sp * 0.5, i;
    ctx.fillStyle = '#0c0c0b'; ctx.fillRect(0, top, W, Lo.depth);
    var br = ctx.createLinearGradient(0, top - Lo.d * 0.6, 0, top);
    br.addColorStop(0, '#3a3936'); br.addColorStop(1, '#151514');
    ctx.fillStyle = br; ctx.fillRect(0, top - Lo.d * 0.6, W, Lo.d * 0.6);
    var ph = rollPhase % rw;
    for (var x = -Lo.sp; x < W + Lo.sp; x += Lo.sp) {
      ctx.save(); ctx.translate(x, top);
      ctx.fillStyle = rollGrad; ctx.fillRect(-rw / 2, 1, rw, Lo.depth - 2);
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(-rw / 2 + ph, 1, Math.max(1.5, rw * 0.14), Lo.depth - 2);
      ctx.restore();
    }
    // front beam
    var fb = ctx.createLinearGradient(0, Lo.convY, 0, Lo.convY + Lo.beamH);
    fb.addColorStop(0, '#3b3a37'); fb.addColorStop(0.5, '#222220'); fb.addColorStop(1, '#131312');
    ctx.fillStyle = fb; ctx.fillRect(0, Lo.convY, W, Lo.beamH);
    ctx.fillStyle = 'rgba(208,206,200,.35)'; ctx.fillRect(0, Lo.convY, W, 1);
    var hz = Math.max(4, Lo.beamH * 0.2);
    ctx.fillStyle = hazard; ctx.fillRect(0, Lo.convY + Lo.beamH - hz, W, hz);
    ctx.fillStyle = 'rgba(208,206,200,.28)';
    for (i = Lo.sp / 2; i < W; i += Lo.sp * 3) { ctx.beginPath(); ctx.arc(i, Lo.convY + Lo.beamH * 0.35, Math.max(1.2, Lo.d * 0.1), 0, 7); ctx.fill(); }
    // legs and contact shadow
    var lw = Math.max(5, Lo.beamH * 0.35);
    for (i = Lo.sp * 2; i < W; i += Lo.sp * 5) {
      ctx.fillStyle = '#151514'; ctx.fillRect(i, Lo.convY + Lo.beamH, lw, Lo.floorY - Lo.convY - Lo.beamH + 2);
      ctx.fillStyle = 'rgba(208,206,200,.08)'; ctx.fillRect(i, Lo.convY + Lo.beamH, 1, Lo.floorY - Lo.convY - Lo.beamH);
    }
    var cs = ctx.createLinearGradient(0, Lo.floorY, 0, Lo.floorY + H * 0.04);
    cs.addColorStop(0, 'rgba(0,0,0,.5)'); cs.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cs; ctx.fillRect(0, Lo.floorY, W, H * 0.04);
  }

  function drawBar(sp, len, p, glintX) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(p.s, p.s);
    ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
    if (glintX != null) {
      var ca = Math.cos(p.a), r = Lo.d / 2, bw = Lo.d * 3, gg, a;
      ctx.globalCompositeOperation = 'lighter';
      if (Math.abs(ca) > 0.25) {
        var lx = (glintX - p.x) / ca;
        if (Math.abs(lx) < len / 2 + bw) {
          gg = ctx.createLinearGradient(lx - bw, 0, lx + bw, 0);
          gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,250,240,.38)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gg; ctx.fillRect(-len / 2, -r * 0.9, len, r * 1.8);
        }
      } else {
        a = clamp(1 - Math.abs(glintX - p.x) / bw, 0, 1);
        if (a > 0) { ctx.fillStyle = 'rgba(255,250,240,' + 0.3 * a + ')'; ctx.fillRect(-len / 2, -r * 0.9, len, r * 1.8); }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function drawMagnets() {
    digits.forEach(function (dg) {
      var gb = Lo.gantryY + Lo.gantryH, mh = Lo.magH, w = dg.w, bottom;
      var d0 = 2.25 + dg.k * 0.12, park = gb + 26 + mh;
      if (t < d0) bottom = park;
      else if (t < dg.t0) bottom = lerp(park, dg.pickTop - 1, ease((t - d0) / (dg.t0 - d0)));
      else bottom = topOf(dg, t) - 1;
      var topY = bottom - mh, cx = dg.cx, hw = Math.max(10, w * 0.16), hh = Lo.gantryH * 0.7;
      // hoist under the girder
      ctx.fillStyle = '#242422'; ctx.fillRect(cx - hw, gb, hw * 2, hh);
      ctx.fillStyle = 'rgba(239,237,232,.5)'; ctx.fillRect(cx - hw, gb + hh - 1, hw * 2, 1);
      // ropes, slung to the beam ends
      ctx.strokeStyle = '#5a5955'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.5, gb + hh); ctx.lineTo(cx - w * 0.38, topY);
      ctx.moveTo(cx + hw * 0.5, gb + hh); ctx.lineTo(cx + w * 0.38, topY);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(208,206,200,.25)'; ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - hw * 0.5 + 0.8, gb + hh); ctx.lineTo(cx - w * 0.38 + 0.8, topY);
      ctx.moveTo(cx + hw * 0.5 + 0.8, gb + hh); ctx.lineTo(cx + w * 0.38 + 0.8, topY);
      ctx.stroke();
      // the magnet beam
      var mg = ctx.createLinearGradient(0, topY, 0, bottom);
      mg.addColorStop(0, '#2e2d2b'); mg.addColorStop(0.6, '#1a1a18'); mg.addColorStop(1, '#3d3c39');
      ctx.fillStyle = mg; ctx.fillRect(cx - w / 2, topY, w, mh);
      ctx.fillStyle = 'rgba(239,237,232,.7)'; ctx.fillRect(cx - w / 2, topY, w, Math.max(1, mh * 0.1));
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      for (var i = 1; i < 4; i++) ctx.fillRect(cx - w / 2 + w * i / 4, topY + mh * 0.25, 1, mh * 0.75);
      // energised lamp
      var on = t >= dg.t0 - 0.12, lx = cx + w / 2 - mh * 0.7, ly = topY + mh * 0.58;
      ctx.fillStyle = on ? '#F4F2EC' : '#33322f';
      ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.6, mh * 0.16), 0, 7); ctx.fill();
      if (on) {
        ctx.globalCompositeOperation = 'lighter';
        var lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, mh * 0.9);
        lg.addColorStop(0, 'rgba(255,255,250,.55)'); lg.addColorStop(1, 'rgba(255,255,250,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly, mh * 0.9, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    });
  }

  function drawWelds() {
    var rb = Lo.d * 0.62;
    digits.forEach(function (dg) {
      if (!dg.welded) return;
      dg.joints.forEach(function (j) {
        var g = ctx.createRadialGradient(j.x - rb * 0.3, j.y - rb * 0.35, 0, j.x, j.y, rb);
        g.addColorStop(0, '#b0aea8'); g.addColorStop(0.6, '#5f5e5a'); g.addColorStop(1, '#2d2d2a');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(j.x, j.y, rb, 0, 7); ctx.fill();
        if (j.heat > 0) {
          var h = j.heat;
          ctx.globalCompositeOperation = 'lighter';
          var hg = ctx.createRadialGradient(j.x, j.y, 0, j.x, j.y, rb * 2.6);
          hg.addColorStop(0, 'rgba(255,236,190,' + 0.95 * h + ')'); hg.addColorStop(0.3, 'rgba(255,160,60,' + 0.7 * h + ')'); hg.addColorStop(1, 'rgba(214,90,20,0)');
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(j.x, j.y, rb * 2.6, 0, 7); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
      });
    });
  }

  function drawSparks() {
    ctx.globalCompositeOperation = 'lighter';
    flashes.forEach(function (f) {
      var k = f.age / f.life, a = 1 - k;
      var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (0.6 + k));
      g.addColorStop(0, 'rgba(255,250,235,' + 0.9 * a + ')'); g.addColorStop(0.25, 'rgba(255,190,90,' + 0.45 * a + ')'); g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + k), 0, 7); ctx.fill();
    });
    ctx.lineCap = 'round';
    sparks.forEach(function (p) {
      var k = p.age / p.life;
      ctx.strokeStyle = k < 0.25 ? 'rgba(255,246,215,' + (1 - k) + ')' : 'rgba(255,' + Math.round(200 - 110 * k) + ',' + Math.round(80 - 60 * k) + ',' + (1 - k) + ')';
      ctx.lineWidth = 0.6 + 1.4 * (1 - k);
      ctx.beginPath(); ctx.moveTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018); ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg.c, 0, 0, W, H);
    drawLight();
    ctx.drawImage(fg.c, 0, 0, W, H);
    drawLamps();
    drawConveyor();

    passers.forEach(function (p) { drawBar(p.sp, p.len, { x: p.x, y: p.y, a: 0, s: LANE_S[1] }, null); });

    var glintX = null;
    if (!reduce && t > T.idle) {
      var s = ((t - T.idle) % 7) / 1.8;
      if (s <= 1) glintX = Lo.x0 - 0.3 * Lo.u + s * 2.8 * Lo.u;
    }
    var onTable = [], lifted = [];
    bars.forEach(function (b) { (t < b.dg.t0 ? onTable : lifted).push(b); });
    onTable.sort(function (a, b) { return a.lane - b.lane; });
    onTable.forEach(function (b) { drawBar(b.sp, b.len, pose(b, t), null); });
    lifted.forEach(function (b) { drawBar(b.sp, b.len, pose(b, t), b.dg.welded ? glintX : null); });

    drawMagnets();
    drawWelds();
    if (front) {
      ctx.drawImage(front.c, 0, 0, W, H);
      var f = clamp((t - 0.6) / 1.2, 0, 1) * (0.75 + 0.25 * Math.sin(t * 9.1) * Math.sin(t * 2.3));
      if (f > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,150,70,' + 0.35 * f + ')';
        ctx.fillRect(Lo.housingW - 5, Lo.convY - Lo.depth - Lo.d * 1.1, 4, Lo.depth + Lo.d);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    drawSparks();
    ctx.drawImage(vig.c, 0, 0, W, H);
    if (t < T.fade) {
      ctx.fillStyle = 'rgba(11,11,10,' + (1 - easeOut(t / T.fade)) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---- simulation ------------------------------------------------------- */
  function burst(x, y) {
    var n = mobile ? 16 : 34, v = 520 * Lo.k;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.25, sp = v * (0.3 + rnd() * 0.9);
      sparks.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.35 + rnd() * 0.6 });
    }
    flashes.push({ x: x, y: y, age: 0, life: 0.32, r: Lo.d * 6 });
  }

  function update(dt) {
    var i, p, floor = Lo.convY - Lo.depth * 0.3, g = 1100 * Lo.k;
    digits.forEach(function (dg) {
      if (!dg.welded && t >= dg.t1) {
        dg.welded = true;
        dg.joints.forEach(function (j, q) {
          j.heat = 1;
          setTimeout(function () { burst(j.x, j.y); }, q * 70);
        });
      }
      dg.joints.forEach(function (j) { if (j.heat > 0) j.heat = Math.max(0, j.heat - dt / 2.6); });
    });
    for (i = sparks.length - 1; i >= 0; i--) {
      p = sparks[i]; p.age += dt;
      if (p.age > p.life) { sparks.splice(i, 1); continue; }
      p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > floor && p.vy > 0) { p.y = floor; p.vy *= -0.32; p.vx *= 0.6; }
    }
    for (i = flashes.length - 1; i >= 0; i--) { flashes[i].age += dt; if (flashes[i].age > flashes[i].life) flashes.splice(i, 1); }
    dust.forEach(function (d) {
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y < lamps[d.j].y) { d.y = Lo.floorY; d.x = lamps[d.j].x + (rnd() - 0.5) * H * 0.3; }
    });

    var speed = W / 4.2;
    rollPhase += speed * dt * 0.35;
    if (t >= nextPass) {
      var len = Lo.u * (0.7 + rnd() * 0.6);
      passers.push({ len: len, sp: sprite(len, Lo.d), x: -len, y: Lo.convY - Lo.depth * LANE_F[1] - Lo.d * 0.42 * LANE_S[1] });
      nextPass = t + 6 + rnd() * 4;
    }
    for (i = passers.length - 1; i >= 0; i--) {
      passers[i].x += speed * dt;
      if (passers[i].x > W + passers[i].len) passers.splice(i, 1);
    }
  }

  /* ---- loop ------------------------------------------------------------- */
  function frame(now) {
    if (!running) return;
    var raw = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    acc += raw;
    // once the show is over, phones run the idle mill at ~30 fps
    if (mobile && t > T.idle + 1 && acc < 1 / 31) { requestAnimationFrame(frame); return; }
    var dt = Math.min(0.05, acc); acc = 0;
    t += dt;
    update(dt);
    render();
    if (!copyShown && t >= T.copy) { copyShown = true; ready(); }
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduce) return;
    running = true; last = 0; acc = 0;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  function setup() {
    layout();
    spriteCache = {};
    drawStatic();
    build();
    passers = []; sparks = []; flashes = [];
    if (reduce) render();
  }

  if (reduce) { t = 9; copyShown = true; ready(); }
  setup();
  if (!reduce) render();

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var r = stage.getBoundingClientRect();
      if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1) return;
      setup();
      if (!running) render();
    }, 140);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (onScreen) start();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      onScreen = en[0].isIntersecting;
      if (onScreen && !document.hidden) start(); else stop();
    }).observe(stage);
  } else {
    start();
  }
  // the copy must never stay hidden, even if frames are throttled
  setTimeout(function () { if (!copyShown) { copyShown = true; ready(); } }, 7000);
})();
