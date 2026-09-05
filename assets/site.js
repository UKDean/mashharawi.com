/* mashharawi.com — shared behaviour.
   Extracted verbatim from the original inline <script> in index.html so the
   English and Arabic pages share one implementation. No behavioural change. */
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // mobile menu
  var btn = document.getElementById('menuBtn'), nav = document.getElementById('nav');
  if(btn && nav){
    btn.addEventListener('click', function(){
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function(e){
      if(e.target.tagName === 'A'){ nav.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }
    });
  }

  // scroll reveal
  var items = document.querySelectorAll('.rise');
  if(reduce || !('IntersectionObserver' in window)){
    items.forEach(function(el){ el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, {rootMargin:'0px 0px -8% 0px', threshold:0.08});
    items.forEach(function(el){ io.observe(el); });
    // hero shows immediately on load
    document.querySelectorAll('.hero .rise').forEach(function(el){ el.classList.add('in'); });
  }

  // active nav link
  var links = {}, sections = [];
  document.querySelectorAll('nav a[href^="#"]').forEach(function(a){
    var id = a.getAttribute('href').slice(1), s = document.getElementById(id);
    if(s){ links[id] = a; sections.push(s); }
  });
  if('IntersectionObserver' in window){
    var spy = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          Object.keys(links).forEach(function(k){ links[k].removeAttribute('aria-current'); });
          if(links[en.target.id]) links[en.target.id].setAttribute('aria-current','true');
        }
      });
    }, {rootMargin:'-45% 0px -50% 0px'});
    sections.forEach(function(s){ spy.observe(s); });
  }

  var yr = document.getElementById('yr');
  if(yr) yr.textContent = new Date().getFullYear();
})();
