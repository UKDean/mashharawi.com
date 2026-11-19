/* mashharawi.com, Steel Weight Verification: interface text in English,
   Arabic and Simplified Chinese. Same terms as the cutting optimizer and the
   BBS Analyzer. The tests check that the three languages have the same keys. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SwvText = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var en = {
    err: {
      diaMissing: 'Enter the diameter.', diaInvalid: 'Diameter must be a number.', diaRange: 'Diameter must be between 4 and 60 mm.',
      unit: 'Choose the length unit (mm or m).', lenMissing: 'Enter the sample length.', lenComma: 'Use a dot for decimals in the length (2.5, not 2,5).',
      lenInvalid: 'Length must be a number.', lenNotPositive: 'Length must be more than zero.', lenOverStock: 'A sample cannot be longer than a 12 m stock bar.',
      unitLooksMm: 'That value is too large for metres. Check the unit.', unitLooksM: 'That value is too small for millimetres. Check the unit.',
      barsMissing: 'Enter the number of bars weighed.', barsInvalid: 'Number of bars must be a number.', barsFraction: 'Number of bars must be a whole number.',
      barsRange: 'Number of bars must be from 1 to 1,000.', kgMissing: 'Enter the measured weight.', kgComma: 'Use a dot for decimals in the weight (4.73, not 4,73).',
      kgInvalid: 'Measured weight must be a number.', kgNotPositive: 'Measured weight must be more than zero.', kgRange: 'Measured weight is above 100,000 kg.',
      tolLowerInvalid: 'Lower limit must be a number.', tolUpperInvalid: 'Upper limit must be a number.', tolLowerSign: 'Lower limit is zero or negative, e.g. -5.',
      tolUpperSign: 'Upper limit is zero or positive, e.g. 5.', tolRange: 'Limits must be within ±100%.'
    },
    warn: {
      nonStandard: 'Not one of the Al Rajhi Steel sizes (10, 12, 14, 16, 18, 20, 25, 32 mm). Calculated with the same formula.',
      largeDeviation: 'The difference is over 25%. Please re-check the unit, the number of bars and the diameter before drawing any conclusion.'
    },
    figs: { theo: 'Theoretical weight', actual: 'Measured weight', diff: 'Difference', dev: 'Deviation', uw: 'Nominal kg/m', perBar: 'Theoretical per bar', actualM: 'Measured kg/m' },
    above: 'above theoretical', below: 'below theoretical', equal: 'equal to theoretical',
    inside: 'Inside the range you entered', outside: 'Outside the range you entered', noRange: 'No range entered',
    rangeNote: function (lo, up) { return 'Compared only with your range (' + (lo == null ? '—' : lo + '%') + ' to ' + (up == null ? '—' : '+' + up + '%') + '). This is not a compliance decision or a certification.'; },
    bars: 'bars', kg: 'kg', m: 'm', mm: 'mm', pct: '%',
    th: { ref: 'Reference', dia: 'Ø mm', grade: 'Grade', len: 'Length', bars: 'Bars', theo: 'Theoretical kg', actual: 'Measured kg', diff: 'Diff. kg', dev: 'Deviation %', range: 'Entered range', samples: 'Samples', lenM: 'Length m', comb: 'Combined %', low: 'Lowest %', high: 'Highest %' },
    totals: function (n, t, a, d) { return n + ' samples · theoretical ' + t + ' kg · measured ' + a + ' kg · difference ' + d + ' kg'; },
    noCombined: 'The samples have different diameters, so no single deviation is given for all of them. See each diameter above.',
    removed: 'Sample removed.', added: function (n) { return 'Sample added. ' + n + ' in this session.'; }, cleared: 'Session cleared.',
    copied: 'Summary copied. Paste it into WhatsApp or an email.', copyFail: 'Copy failed: select the text below and copy it.',
    confirmWa: 'This copies the summary and opens WhatsApp with Omar Mashharawi (Al Rajhi Steel sales). Nothing is sent until you paste and send it yourself. Continue?',
    empty: 'No samples yet. Enter one above and press Add sample.',
    sumHead: 'Rebar weight check (theoretical comparison)',
    sumLine: function (s, d) { return (s.ref ? s.ref + ': ' : '') + 'Ø' + s.diameter + ' mm' + (s.grade ? ' ' + s.grade : '') + ', ' + d.len + ' × ' + s.bars + ' bars. Theoretical ' + d.theo + ' kg, measured ' + d.actual + ' kg, ' + d.dev + '%' + (d.cmp ? ' (' + d.cmp + ')' : ''); },
    sumFoot: 'Nominal 0.006165 × d² kg/m. Theoretical comparison only, not an MTC, a laboratory test or a certification.',
    rangeLine: function (lo, up) { return 'Entered range: ' + (lo == null ? '—' : lo + '%') + ' to ' + (up == null ? '—' : '+' + up + '%'); },
    gradeNote: 'Informational. Grade 60 and Grade 80 have the same nominal weight per metre.'
  };

  var ar = {
    err: {
      diaMissing: 'أدخل القطر.', diaInvalid: 'القطر يجب أن يكون رقماً.', diaRange: 'القطر يجب أن يكون بين 4 و60 مم.',
      unit: 'اختر وحدة الطول (مم أو م).', lenMissing: 'أدخل طول العينة.', lenComma: 'استخدم النقطة للكسور في الطول (2.5 وليس 2,5).',
      lenInvalid: 'الطول يجب أن يكون رقماً.', lenNotPositive: 'الطول يجب أن يكون أكبر من صفر.', lenOverStock: 'لا يمكن أن تكون العينة أطول من سيخ قياسي 12 م.',
      unitLooksMm: 'القيمة كبيرة جداً على المتر. تحقق من الوحدة.', unitLooksM: 'القيمة صغيرة جداً على المليمتر. تحقق من الوحدة.',
      barsMissing: 'أدخل عدد الأسياخ الموزونة.', barsInvalid: 'عدد الأسياخ يجب أن يكون رقماً.', barsFraction: 'عدد الأسياخ يجب أن يكون رقماً صحيحاً.',
      barsRange: 'عدد الأسياخ من 1 إلى 1,000.', kgMissing: 'أدخل الوزن المقاس.', kgComma: 'استخدم النقطة للكسور في الوزن (4.73 وليس 4,73).',
      kgInvalid: 'الوزن المقاس يجب أن يكون رقماً.', kgNotPositive: 'الوزن المقاس يجب أن يكون أكبر من صفر.', kgRange: 'الوزن المقاس أكبر من 100,000 كجم.',
      tolLowerInvalid: 'الحد الأدنى يجب أن يكون رقماً.', tolUpperInvalid: 'الحد الأعلى يجب أن يكون رقماً.', tolLowerSign: 'الحد الأدنى صفر أو سالب، مثل ‎-5.',
      tolUpperSign: 'الحد الأعلى صفر أو موجب، مثل 5.', tolRange: 'الحدود يجب أن تكون ضمن ±100٪.'
    },
    warn: {
      nonStandard: 'ليس من مقاسات الراجحي للحديد (10، 12، 14، 16، 18، 20، 25، 32 مم). تم حسابه بنفس المعادلة.',
      largeDeviation: 'الفرق أكبر من 25٪. راجع الوحدة وعدد الأسياخ والقطر قبل أي استنتاج.'
    },
    figs: { theo: 'الوزن النظري', actual: 'الوزن المقاس', diff: 'الفرق', dev: 'الانحراف', uw: 'كجم/م الاسمي', perBar: 'النظري لكل سيخ', actualM: 'كجم/م المقاس' },
    above: 'أعلى من النظري', below: 'أقل من النظري', equal: 'مساوٍ للنظري',
    inside: 'داخل النطاق الذي أدخلته', outside: 'خارج النطاق الذي أدخلته', noRange: 'لم يُدخل نطاق',
    rangeNote: function (lo, up) { return 'المقارنة فقط مع النطاق الذي أدخلته (من ' + (lo == null ? '—' : lo + '٪') + ' إلى ' + (up == null ? '—' : '+' + up + '٪') + '). هذا ليس حكماً بالمطابقة ولا شهادة.'; },
    bars: 'سيخ', kg: 'كجم', m: 'م', mm: 'مم', pct: '٪',
    th: { ref: 'المرجع', dia: 'القطر مم', grade: 'الدرجة', len: 'الطول', bars: 'الأسياخ', theo: 'النظري كجم', actual: 'المقاس كجم', diff: 'الفرق كجم', dev: 'الانحراف ٪', range: 'النطاق المُدخل', samples: 'العينات', lenM: 'الطول م', comb: 'المجمّع ٪', low: 'الأدنى ٪', high: 'الأعلى ٪' },
    totals: function (n, t, a, d) { return n + ' عينات · النظري ' + t + ' كجم · المقاس ' + a + ' كجم · الفرق ' + d + ' كجم'; },
    noCombined: 'العينات بأقطار مختلفة، لذلك لا يُعطى انحراف واحد لها كلها. راجع كل قطر بالأعلى.',
    removed: 'تم حذف العينة.', added: function (n) { return 'تمت إضافة العينة. عدد العينات في هذه الجلسة: ' + n + '.'; }, cleared: 'تم مسح الجلسة.',
    copied: 'تم نسخ الملخص. الصقه في واتساب أو في بريد.', copyFail: 'تعذّر النسخ: حدد النص بالأسفل وانسخه.',
    confirmWa: 'سيتم نسخ الملخص وفتح محادثة واتساب مع عمر مشهراوي (مبيعات حديد الراجحي). لن يُرسل شيء إلا إذا لصقته وأرسلته بنفسك. هل تريد المتابعة؟',
    empty: 'لا توجد عينات بعد. أدخل عينة بالأعلى واضغط «أضف العينة».',
    sumHead: 'فحص وزن حديد التسليح (مقارنة نظرية)',
    sumLine: function (s, d) { return (s.ref ? s.ref + ': ' : '') + 'قطر ' + s.diameter + ' مم' + (s.grade ? ' ' + s.grade : '') + '، ' + d.len + ' × ' + s.bars + ' سيخ. النظري ' + d.theo + ' كجم، المقاس ' + d.actual + ' كجم، ' + d.dev + '٪' + (d.cmp ? ' (' + d.cmp + ')' : ''); },
    sumFoot: 'الوزن الاسمي 0.006165 × ق² كجم/م. مقارنة نظرية فقط، وليست شهادة مطحنة ولا فحص مختبر ولا شهادة جودة.',
    rangeLine: function (lo, up) { return 'النطاق المُدخل: من ' + (lo == null ? '—' : lo + '٪') + ' إلى ' + (up == null ? '—' : '+' + up + '٪'); },
    gradeNote: 'للمعلومة فقط. Grade 60 وGrade 80 لهما نفس الوزن الاسمي للمتر.'
  };

  var zh = {
    err: {
      diaMissing: '请输入直径。', diaInvalid: '直径必须是数字。', diaRange: '直径须在 4 到 60 毫米之间。',
      unit: '请选择长度单位（毫米或米）。', lenMissing: '请输入试样长度。', lenComma: '长度请用小数点（2.5，而不是 2,5）。',
      lenInvalid: '长度必须是数字。', lenNotPositive: '长度必须大于零。', lenOverStock: '试样长度不能超过 12 米定尺。',
      unitLooksMm: '该数值对“米”来说过大，请检查单位。', unitLooksM: '该数值对“毫米”来说过小，请检查单位。',
      barsMissing: '请输入称重的根数。', barsInvalid: '根数必须是数字。', barsFraction: '根数必须是整数。',
      barsRange: '根数须为 1 到 1,000。', kgMissing: '请输入实测重量。', kgComma: '重量请用小数点（4.73，而不是 4,73）。',
      kgInvalid: '实测重量必须是数字。', kgNotPositive: '实测重量必须大于零。', kgRange: '实测重量超过 100,000 公斤。',
      tolLowerInvalid: '下限必须是数字。', tolUpperInvalid: '上限必须是数字。', tolLowerSign: '下限为零或负数，例如 -5。',
      tolUpperSign: '上限为零或正数，例如 5。', tolRange: '限值须在 ±100% 以内。'
    },
    warn: {
      nonStandard: '不是 Al Rajhi Steel 的规格（10、12、14、16、18、20、25、32 毫米）。已按同一公式计算。',
      largeDeviation: '差异超过 25%。在得出任何结论之前，请重新检查单位、根数和直径。'
    },
    figs: { theo: '理论重量', actual: '实测重量', diff: '差值', dev: '偏差', uw: '理论 kg/m', perBar: '每根理论重量', actualM: '实测 kg/m' },
    above: '高于理论值', below: '低于理论值', equal: '等于理论值',
    inside: '在您输入的范围内', outside: '超出您输入的范围', noRange: '未输入范围',
    rangeNote: function (lo, up) { return '仅与您输入的范围比较（' + (lo == null ? '—' : lo + '%') + ' 至 ' + (up == null ? '—' : '+' + up + '%') + '）。这不是合格判定，也不是证书。'; },
    bars: '根', kg: '公斤', m: '米', mm: '毫米', pct: '%',
    th: { ref: '编号', dia: '直径 mm', grade: '牌号', len: '长度', bars: '根数', theo: '理论 kg', actual: '实测 kg', diff: '差值 kg', dev: '偏差 %', range: '输入范围', samples: '试样数', lenM: '长度 m', comb: '合并 %', low: '最低 %', high: '最高 %' },
    totals: function (n, t, a, d) { return n + ' 个试样 · 理论 ' + t + ' 公斤 · 实测 ' + a + ' 公斤 · 差值 ' + d + ' 公斤'; },
    noCombined: '试样直径不同，因此不给出所有试样的单一偏差。请查看上方各直径。',
    removed: '已删除试样。', added: function (n) { return '已添加试样。本次共 ' + n + ' 个。'; }, cleared: '已清空。',
    copied: '摘要已复制，可粘贴到 WhatsApp 或邮件中。', copyFail: '复制失败：请选中下方文字后复制。',
    confirmWa: '将复制摘要并打开与 Omar Mashharawi（Al Rajhi 钢铁销售）的 WhatsApp 对话。只有您自己粘贴并发送后才会发出。是否继续？',
    empty: '还没有试样。请在上方输入并点击“添加试样”。',
    sumHead: '钢筋重量核对（理论比较）',
    sumLine: function (s, d) { return (s.ref ? s.ref + '：' : '') + '直径 ' + s.diameter + ' 毫米' + (s.grade ? ' ' + s.grade : '') + '，' + d.len + ' × ' + s.bars + ' 根。理论 ' + d.theo + ' 公斤，实测 ' + d.actual + ' 公斤，' + d.dev + '%' + (d.cmp ? '（' + d.cmp + '）' : ''); },
    sumFoot: '理论 0.006165 × d² 公斤/米。仅为理论比较，不是质保书（MTC）、实验室试验或质量证书。',
    rangeLine: function (lo, up) { return '输入范围：' + (lo == null ? '—' : lo + '%') + ' 至 ' + (up == null ? '—' : '+' + up + '%'); },
    gradeNote: '仅供参考。Grade 60 与 Grade 80 的每米理论重量相同。'
  };

  return { en: en, ar: ar, zh: zh };
});
