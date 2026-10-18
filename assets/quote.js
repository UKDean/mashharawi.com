/* mashharawi.com, rebar quotation shortcuts.
   1. A floating WhatsApp button on the pages that include this file.
   2. On the rebar weight calculator, a button that sends the order the
      visitor built to WhatsApp as a quotation request. Nothing is sent by the
      page itself: WhatsApp opens with the message, and the visitor decides
      whether to send it. */
(function () {
  'use strict';
  var AR = document.documentElement.getAttribute('dir') === 'rtl';
  var WA = '966500590063';
  function wa(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }
  function from() { return (AR ? 'الصفحة: ' : 'Page: ') + location.origin + location.pathname; }

  if (!document.querySelector('.q-fab')) {
    var a = document.createElement('a');
    a.className = 'q-fab';
    a.target = '_blank';
    a.rel = 'noopener';
    a.href = wa(AR
      ? 'السلام عليكم أستاذ عمر، أحتاج عرض سعر حديد تسليح.\n' + from()
      : 'Hello Omar, I need a rebar quotation.\n' + from());
    a.textContent = AR ? 'اطلب عرض سعر · واتساب' : 'Rebar quote · WhatsApp';
    document.body.appendChild(a);
  }

  var head = document.querySelector('#calc .calc-order-head');
  if (!head) return;
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'calc-btn ok';
  b.id = 'cQuote';
  b.textContent = AR ? 'أرسل الطلب لعرض سعر (واتساب)' : 'Send for a quote (WhatsApp)';
  head.appendChild(b);

  function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ''; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }

  b.addEventListener('click', function () {
    var lines = [AR ? 'السلام عليكم أستاذ عمر، أحتاج عرض سعر لهذا الطلب:' : 'Hello Omar, please quote this rebar order:'];
    var rows = document.querySelectorAll('#cRows tr');
    if (!rows.length) {
      var d = txt('cDiaVal'), l = val('cLen') || '12', q = val('cQty'), t = txt('oTot');
      lines.push(AR ? ('قطر ' + d + ' مم · طول ' + l + ' م · ' + q + ' سيخ · ' + t + ' طن')
                    : ('Ø' + d + ' mm · ' + l + ' m · ' + q + ' bars · ' + t + ' t'));
    } else {
      rows.forEach(function (r) {
        var c = [].map.call(r.querySelectorAll('td'), function (x) { return x.textContent.trim(); });
        lines.push(AR ? ('قطر ' + c[0] + ' مم · طول ' + c[1] + ' م · ' + c[2] + ' سيخ · ' + c[4] + ' طن')
                      : ('Ø' + c[0] + ' mm · ' + c[1] + ' m · ' + c[2] + ' bars · ' + c[4] + ' t'));
      });
      lines.push((AR ? 'الإجمالي: ' : 'Total: ') + txt('tT') + (AR ? ' طن' : ' t'));
    }
    lines.push(AR ? 'الدرجة (Grade 60 / 80): ' : 'Grade (60 / 80): ');
    lines.push(AR ? 'قص حسب الطلب أو إيبوكسي؟ ' : 'Cutting or epoxy coating? ');
    lines.push(AR ? 'مدينة المشروع: ' : 'Project city: ');
    lines.push(AR ? 'الشركة: ' : 'Company: ');
    lines.push(from());
    window.open(wa(lines.join('\n')), '_blank', 'noopener');
  });
})();
