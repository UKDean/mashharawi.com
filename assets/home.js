/* mashharawi.com, home page motion ("Curtain", 2026-10-23).
   Loaded only on / and /ar/. Scroll-linked effects write CSS custom
   properties once per frame; home.css does the drawing. With reduced
   motion everything is shown at rest and nothing here runs but reveals. */
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rtl = document.documentElement.dir === 'rtl';
  var $ = function(s){ return document.querySelector(s); };
  var $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var clamp = function(v){ return v < 0 ? 0 : v > 1 ? 1 : v; };
  var ease = function(v){ return 1 - Math.pow(1 - v, 3); };

  // reveals and count-ups
  function count(el){
    var to = +el.getAttribute('data-count'), suf = el.getAttribute('data-suffix') || '', t0 = null;
    if(reduce){ el.textContent = to + suf; return; }
    function tick(t){
      if(t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / 1800);
      el.textContent = Math.round(to * ease(k)) + suf;
      if(k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  var reveal = $$('[data-fx-in]');
  if(!('IntersectionObserver' in window)){
    reveal.forEach(function(el){ el.classList.add('in'); });
    $$('[data-count]').forEach(count);
  } else {
    var ro = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(!e.isIntersecting) return;
        e.target.classList.add('in');
        ro.unobserve(e.target);
        Array.prototype.forEach.call(e.target.querySelectorAll('[data-count]'), count);
      });
    }, {threshold:.18});
    reveal.forEach(function(el){ ro.observe(el); });
  }

  // Brand film: plays once when it comes into view, then rests on the logo.
  var bf = $('.fx-brand__film video'), bfr = $('.fx-brand__replay');
  if(bf){
    bf.addEventListener('ended', function(){ bfr.hidden = false; });
    bfr.addEventListener('click', function(){ bfr.hidden = true; bf.currentTime = 0; bf.play(); });
    if(reduce || !('IntersectionObserver' in window)){ bfr.hidden = false; }
    else {
      var bo = new IntersectionObserver(function(es){
        if(!es[0].isIntersecting) return;
        bo.disconnect();
        var p = bf.play(); if(p && p.catch) p.catch(function(){ bfr.hidden = false; });
      }, {threshold:.5});
      bo.observe(bf);
    }
  }

  var header = $('.c-header');
  if(reduce){
    window.addEventListener('scroll', function(){ header.classList.toggle('is-solid', scrollY > 40); }, {passive:true});
    return;
  }

  var wipe = $('.fx-wipe__fig'), wipeImg = wipe && wipe.querySelector('img');
  var film = $('.fx-film'), rows = $$('.fx-film__row');
  var hz = $('.fx-hz'), track = $('.fx-hz__track'), bar = $('.fx-hz__bar i'), hzc = $('.fx-hz__count');
  var cols = $$('.fx-mosaic__col');
  var zoom = $('.fx-zoom');
  var cards = $$('.fx-sc');
  var app = $('.fx-app'), shot = $('.fx-app__shot');
  var wide = window.matchMedia('(min-width: 761px)');
  var queued = false;

  function frame(){
    queued = false;
    var vh = innerHeight, r, p;
    header.classList.toggle('is-solid', scrollY > 40);

    if(wipeImg){ r = wipe.getBoundingClientRect(); wipeImg.style.setProperty('--py', ((r.top + r.height / 2 - vh / 2) * -.12) + 'px'); }

    if(film){
      r = film.getBoundingClientRect();
      if(r.bottom > 0 && r.top < vh){
        p = (vh - r.top) / (vh + r.height) - .5;
        rows.forEach(function(row, i){ row.style.setProperty('--fx', (p * (i ? 1 : -1) * innerWidth * .35) + 'px'); });
      }
    }

    if(hz && wide.matches){
      r = hz.getBoundingClientRect();
      p = clamp(-r.top / (r.height - vh));
      // scrollWidth leaves out the trailing padding of a flex row, so add it back
      var max = track.scrollWidth - track.clientWidth + parseFloat(getComputedStyle(track).paddingLeft);
      track.style.setProperty('--x', (p * max * (rtl ? 1 : -1)) + 'px');
      bar.style.setProperty('--p', p);
      var n = track.children.length;
      hzc.textContent = '0' + Math.min(n, 1 + Math.floor(p * (n - .001))) + ' / 0' + n;
    } else if(track){ track.style.removeProperty('--x'); }

    cols.forEach(function(c){
      var b = c.parentNode.getBoundingClientRect();
      if(b.bottom > 0 && b.top < vh) c.style.setProperty('--d', ((b.top + b.height / 2 - vh / 2) * +c.getAttribute('data-speed')) + 'px');
    });

    if(zoom){
      r = zoom.getBoundingClientRect();
      p = clamp(-r.top / (r.height - vh));
      zoom.style.setProperty('--z', ease(clamp(p / .6)));
      zoom.style.setProperty('--q', clamp((p - .45) / .3));
    }

    cards.forEach(function(c, i){
      var next = cards[i + 1];
      if(!next) return;
      var k = clamp(1 - (next.getBoundingClientRect().top - c.getBoundingClientRect().top) / (vh * .78));
      c.style.transform = 'scale(' + (1 - k * .06) + ')';
      c.style.filter = 'brightness(' + (1 - k * .5) + ')';
    });

    if(shot){ r = shot.getBoundingClientRect(); app.style.setProperty('--t', ease(clamp((vh - r.top) / (vh * .85)))); }
  }
  function queue(){ if(!queued){ queued = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', queue, {passive:true});
  window.addEventListener('resize', queue);
  frame();

  // cursor ring over photos and links (mouse only)
  var cur = $('.fx-cur');
  if(cur && window.matchMedia('(pointer: fine)').matches){
    var x = -99, y = -99, cx = x, cy = y, label = cur.firstChild;
    window.addEventListener('pointermove', function(e){
      x = e.clientX; y = e.clientY; cur.classList.add('on');
      var hit = e.target.closest && e.target.closest('[data-cur]');
      cur.classList.toggle('big', !!hit);
      label.textContent = hit ? hit.getAttribute('data-cur') : '';
      cur.classList.toggle('link', !hit && !!e.target.closest('a,button,input,select'));
    }, {passive:true});
    document.addEventListener('pointerleave', function(){ cur.classList.remove('on'); });
    (function loop(){
      cx += (x - cx) * .18; cy += (y - cy) * .18;
      cur.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      requestAnimationFrame(loop);
    })();
  }
})();
