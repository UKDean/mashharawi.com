/* mashharawi.com, rebar quotation shortcuts.
   1. A floating WhatsApp button on the pages that include this file. It opens
      Omar's WhatsApp Business link; his number is not published.
   2. On the rebar weight calculator, a button that copies the order the
      visitor built and opens the same WhatsApp chat, so the visitor can paste
      it. The page sends nothing itself. */
(function () {
  'use strict';
  var AR = document.documentElement.getAttribute('dir') === 'rtl';
  var LINK = 'https://wa.me/message/D6ABM7QFWVSPB1';

  if (!document.querySelector('.q-fab')) {
    var a = document.createElement('a');
    a.className = 'q-fab';
    a.target = '_blank';
    a.rel = 'noopener';
    a.href = LINK;
    a.textContent = AR ? 'اطلب عرض سعر · واتساب' : 'Rebar quote · WhatsApp';
    document.body.appendChild(a);
  }

  var head = document.querySelector('#calc .calc-order-head');
  if (!head) return;
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'calc-btn ok';
  b.id = 'cQuote';
  var LABEL = AR ? 'انسخ الطلب وأرسله على واتساب' : 'Copy order & open WhatsApp';
  b.textContent = LABEL;
  head.appendChild(b);

  function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ''; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }

  function orderText() {
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
    return lines.join('\n');
  }

  b.addEventListener('click', function () {
    var text = orderText();
    var done = function (ok) {
      b.textContent = ok ? (AR ? 'تم نسخ الطلب، الصقه في المحادثة' : 'Order copied, paste it in the chat')
                         : (AR ? 'افتح واتساب واكتب الطلب' : 'Open WhatsApp and type the order');
      setTimeout(function () { b.textContent = LABEL; }, 6000);
    };
    try {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } catch (e) { done(false); }
    window.open(LINK, '_blank', 'noopener');
  });
})();
