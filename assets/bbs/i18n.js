/* mashharawi.com, BBS Analyzer: interface text in English, Arabic and
   Simplified Chinese. Kept apart from app.js so the tests can check that the
   three languages have the same keys. Terminology follows the cutting
   optimizer pages. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BbsText = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var en = {
    fields: { mark: 'Bar mark', member: 'Member', diameter: 'Diameter', grade: 'Grade', shape: 'Shape code', length: 'Cut length',
      qty: 'Total bars', nMembers: 'No. of members', nEach: 'No. in each', totalLength: 'Total length (check)', weight: 'Weight (check)' },
    required: 'required', optional: 'optional', none: '— not in this sheet —', column: 'Column',
    unitChoose: '— choose —', mm: 'mm', m: 'm', kg: 'kg', t: 't',
    msg: {
      reading: 'Reading the file in your browser…',
      loaded: function (n, name) { return n.toLocaleString('en-US') + ' rows read from ' + name + '. Check the columns below, then analyse.'; },
      detected: function (r) { return 'Header found on row ' + r + '. Columns were matched by name: check them.'; },
      noHeader: 'No header row recognised. Set the header row and pick each column yourself.',
      empty: 'Nothing to read: the file or the pasted range is empty.',
      pasted: 'pasted range', manual: 'manual entry', sample: 'sample schedule',
      sheetTruncated: 'The sheet has more than 100,000 rows; only the first 100,000 were read.',
      xlsx: {
        notZip: 'This is not an .xlsx file. Save it from Excel as .xlsx or CSV.', notXlsx: 'This file is not an Excel workbook (.xlsx).',
        zip64: 'This workbook uses a format variant (ZIP64) this tool cannot read. Save it as CSV and try again.',
        encrypted: 'The workbook is password-protected. Remove the password or save it as CSV.',
        tooLarge: 'The file is larger than 25 MB. Save only the schedule sheet as CSV and try again.',
        partTooLarge: 'The workbook is too large to read safely in the browser. Save the schedule sheet as CSV.',
        dtd: 'The workbook contains XML features this tool refuses for safety.', noSheets: 'No worksheet found in this workbook.',
        corrupt: 'The file is damaged or not a valid .xlsx file.', method: 'The workbook uses an unsupported compression method. Save it as CSV.',
        noInflate: 'This browser cannot open .xlsx files. Use a current Chrome, Edge, Safari or Firefox, or save the sheet as CSV.',
        multiDisk: 'Split archives are not supported.', xls: 'Old .xls files are not supported. Save the sheet as .xlsx or CSV.', other: 'The file could not be read.'
      },
      cfg: {
        missingColumns: function (f) { return 'Required column not set: ' + f.join(', ') + '. Pick it in the mapping above.'; },
        lengthUnit: 'Choose the unit of the cut length column (mm or m). The header does not say, and the tool will not guess.',
        sameColumn: function (a, b) { return 'One column is mapped twice (' + a + ' and ' + b + '). Each field needs its own column.'; },
        tooManyRows: 'More than 100,000 data rows. Split the schedule and analyse it in parts.'
      },
      sent: 'The optimizer opened in a new tab with these lines. Review them there before you run it.',
      nothingToSend: 'No valid lines to send.',
      popup: 'The browser blocked the new tab. Allow pop-ups for this site, or use this link:',
      tooBig: 'Too many different cut lengths to send at once (limit 2,000). Filter the schedule first.'
    },
    issue: {
      unreadable: 'Not a bar line (no diameter and no length)', cellError: 'Spreadsheet error value in a used cell',
      diaMissing: 'Diameter missing', diaInvalid: 'Diameter not readable or outside 4–60 mm', diaImperial: 'US bar number (#), not millimetres',
      lenMissing: 'Length missing', lenInvalid: 'Length not a number', lenComma: 'Length has a comma: ambiguous decimal or thousands separator',
      lenNotPositive: 'Length zero or negative', lenTooLong: 'Length over 100 m', unitLooksMm: 'Value too large for metres: check the unit',
      unitLooksM: 'Value too small for millimetres: check the unit',
      qtyMissing: 'Number of bars missing', qtyInvalid: 'Number of bars not valid', qtyFraction: 'Number of bars is not a whole number',
      qtyFactors: 'Members or bars per member missing or not whole numbers', qtyMismatch: 'Total bars ≠ members × bars per member'
    },
    warn: {
      dupMark: function (w) { return 'Bar mark ' + w.mark + (w.member ? ' (' + w.member + ')' : '') + ' repeats on rows ' + w.rows.join(', ') + ' with the same data. All rows are counted: check it is not entered twice.'; },
      dupMarkConflict: function (w) { return 'Bar mark ' + w.mark + (w.member ? ' (' + w.member + ')' : '') + ' repeats on rows ' + w.rows.join(', ') + ' with DIFFERENT diameter, grade, shape or length. All rows are counted: check the schedule.'; },
      multiGrade: function (w) { return 'More than one grade in this schedule: ' + w.grades.join(', ') + '. Grades are kept apart everywhere.'; },
      gradePartlyMissing: function (w) { return w.count + ' rows have no grade. They are shown as "no grade", not assigned one.'; },
      gradeAllMissing: 'No grade in this schedule. Weights do not depend on grade, but state it when you order.',
      gradeSpellings: function (w) { return 'The same grade is written in different ways: ' + w.spellings.join(' / ') + '. They were treated as one grade.'; },
      diaNonStandard: function (w) { return 'Non-standard diameter: ' + w.diameters.join(', ') + ' mm. Calculated, but check the drawing.'; },
      overStock: function (w) { return w.count + ' rows are longer than a 12 m bar. They need laps or a special length and are not sent to the cutting optimizer.'; },
      formula: function (w) { return w.count + ' rows take values from formulas. The value Excel saved was used; no formula was run. Recalculate and save in Excel if in doubt.'; },
      weightDiff: function (w) { return 'On ' + w.count + ' rows the weight in the sheet differs from the theoretical weight by more than 1%.'; },
      weightUnitUnknown: 'The weight column has no unit in its header, so it was not cross-checked.',
      totalLengthDiff: function (w) { return 'On ' + w.count + ' rows the total length in the sheet differs from length × bars.'; },
      qtyFromFactors: 'Total bars = no. of members × no. in each, as given in the sheet.'
    },
    assume: [
      'Theoretical weight = 0.006165 × d² kg/m × cut length × number of bars. These are nominal estimates, not weighed or certified quantities.',
      'Cut lengths are taken as given in the schedule. Bend deductions, laps and wastage are not added.',
      'Nothing was uploaded: the file was read in this browser and is gone when you close the page.'
    ],
    lenUnitFrom: function (u, how) { return 'Cut length read in ' + u + (how === 'header' ? ' (from the column header).' : ' (chosen by you).'); },
    figs: ['Bars', 'Theoretical weight', 'Total length', 'Rows used'], figU: ['pcs', 't', 'm', ''],
    rowsUsed: function (ok, bad, blank) { return ok + ' used · ' + bad + ' excluded · ' + blank + ' blank'; },
    th: { dia: 'Ø mm', grade: 'Grade', shape: 'Shape', bars: 'Bars', len: 'Length m', kgm: 'kg/m', kg: 'Weight kg', share: 'Share', row: 'Row', mark: 'Mark', member: 'Member', cut: 'Cut mm', problem: 'Problem', data: 'Cells', warn: 'Notes' },
    noGrade: 'no grade', noShape: '—', showAll: function (n) { return 'Show all ' + n.toLocaleString('en-US') + ' rows'; },
    sendNote: function (n, r, l) { return n + ' lines (grouped by diameter, grade and cut length) will be sent' + (r ? '; ' + r + ' lengths rounded to the nearest mm' : '') + (l ? '; ' + l + ' rows over 12 m left out' : '') + '.'; },
    warnCodes: { diaNonStandard: 'non-standard Ø', formula: 'formula', gradeMissing: 'no grade', overStock: '> 12 m', weightDiff: 'weight ≠ sheet', totalLengthDiff: 'length ≠ sheet', dupMark: 'repeated mark', dupMarkConflict: 'mark conflict' },
    sample: [
      ['Project: Villa B-12 · Footings and columns (sample data)'],
      [],
      ['Member', 'Bar mark', 'Dia (mm)', 'Grade', 'Shape code', 'Cut length (mm)', 'No. of members', 'No. in each', 'Total No.', 'Weight (kg)'],
      ['F1', '01', 'T16', 'Gr60', '21', 2350, 12, 8, 96, 356.03],
      ['F1', '02', 'T16', 'Gr60', '21', 1850, 12, 6, 72, 210.21],
      ['C1', '03', 'T20', 'Gr60', '00', 3150, 8, 6, 48, 372.88],
      ['C1', '04', 'T10', 'Gr60', '51', 1480, 8, 40, 320, 292.12],
      ['B1', '05', 'T16', 'Grade 60', '00', 6450, 4, 4, 16, 162.84],
      ['B1', '06', 'T12', 'Gr60', '51', 1950, 4, 30, 120, 210.4],
      ['B1', '06', 'T12', 'Gr60', '51', 1950, 4, 30, 120, 210.4],
      ['S1', '07', 'T12', 'Gr80', '00', 5850, 1, 48, 48, 249.33],
      ['S1', '08', 'T12', 'Gr80', '00', '2,875', 1, 60, 60, ''],
      ['', 'Total', '', '', '', '', '', '', '', 2064.21]
    ]
  };

  var ar = {
    fields: { mark: 'رقم السيخ', member: 'العنصر', diameter: 'القطر', grade: 'الدرجة', shape: 'كود الشكل', length: 'طول القص',
      qty: 'إجمالي الأسياخ', nMembers: 'عدد العناصر', nEach: 'العدد في كل عنصر', totalLength: 'الطول الكلي (للمطابقة)', weight: 'الوزن (للمطابقة)' },
    required: 'مطلوب', optional: 'اختياري', none: '— غير موجود في الجدول —', column: 'العمود',
    unitChoose: '— اختر —', mm: 'مم', m: 'م', kg: 'كجم', t: 'طن',
    msg: {
      reading: 'جاري قراءة الملف داخل متصفحك…',
      loaded: function (n, name) { return 'تمت قراءة ' + n.toLocaleString('en-US') + ' صف من ' + name + '. راجع الأعمدة بالأسفل ثم اضغط تحليل.'; },
      detected: function (r) { return 'تم العثور على صف العناوين في الصف ' + r + '، وتمت مطابقة الأعمدة بالاسم: راجعها.'; },
      noHeader: 'لم يتم التعرف على صف العناوين. حدّد رقم صف العناوين واختر كل عمود بنفسك.',
      empty: 'لا يوجد ما يُقرأ: الملف أو النص الملصوق فارغ.',
      pasted: 'النص الملصوق', manual: 'الإدخال اليدوي', sample: 'جدول المثال',
      sheetTruncated: 'الورقة فيها أكثر من 100,000 صف، وتمت قراءة أول 100,000 فقط.',
      xlsx: {
        notZip: 'هذا ليس ملف ‎.xlsx. احفظه من الإكسل بصيغة ‎.xlsx أو CSV.', notXlsx: 'هذا الملف ليس ملف إكسل ‎(.xlsx).',
        zip64: 'هذا الملف بصيغة (ZIP64) لا تقرؤها الأداة. احفظه CSV وحاول مرة أخرى.',
        encrypted: 'الملف محمي بكلمة مرور. أزل كلمة المرور أو احفظه CSV.',
        tooLarge: 'حجم الملف أكبر من 25 ميجابايت. احفظ ورقة الجدول فقط بصيغة CSV وحاول مرة أخرى.',
        partTooLarge: 'الملف كبير جداً لقراءته بأمان في المتصفح. احفظ ورقة الجدول بصيغة CSV.',
        dtd: 'الملف يحتوي على مكونات XML ترفضها الأداة لأسباب أمنية.', noSheets: 'لا توجد ورقة عمل في هذا الملف.',
        corrupt: 'الملف تالف أو ليس ملف ‎.xlsx صالحاً.', method: 'الملف مضغوط بطريقة غير مدعومة. احفظه CSV.',
        noInflate: 'هذا المتصفح لا يفتح ملفات ‎.xlsx. استخدم نسخة حديثة من كروم أو إيدج أو سفاري أو فايرفوكس، أو احفظ الورقة CSV.',
        multiDisk: 'الملفات المقسّمة غير مدعومة.', xls: 'ملفات ‎.xls القديمة غير مدعومة. احفظ الورقة بصيغة ‎.xlsx أو CSV.', other: 'تعذّرت قراءة الملف.'
      },
      cfg: {
        missingColumns: function (f) { return 'عمود مطلوب غير محدد: ' + f.join('، ') + '. اختره في جدول المطابقة بالأعلى.'; },
        lengthUnit: 'اختر وحدة عمود طول القص (مم أو م). العنوان لا يذكر الوحدة، والأداة لا تخمّنها.',
        sameColumn: function (a, b) { return 'نفس العمود محدد مرتين (' + a + ' و' + b + '). كل حقل يحتاج عموده الخاص.'; },
        tooManyRows: 'أكثر من 100,000 صف بيانات. قسّم الجدول وحلله على أجزاء.'
      },
      sent: 'تم فتح أداة تحسين القص في تبويب جديد بهذه البنود. راجعها هناك قبل الحساب.',
      nothingToSend: 'لا توجد بنود صالحة للإرسال.',
      popup: 'المتصفح منع فتح التبويب الجديد. اسمح بالنوافذ المنبثقة لهذا الموقع، أو استخدم هذا الرابط:',
      tooBig: 'عدد أطوال القص المختلفة أكبر من أن يُرسل مرة واحدة (الحد 2,000). صفِّ الجدول أولاً.'
    },
    issue: {
      unreadable: 'ليس بند حديد (لا قطر ولا طول)', cellError: 'قيمة خطأ من الإكسل في خلية مستخدمة',
      diaMissing: 'القطر غير موجود', diaInvalid: 'القطر غير مقروء أو خارج 4–60 مم', diaImperial: 'رقم مقاس أمريكي (#) وليس بالمليمتر',
      lenMissing: 'الطول غير موجود', lenInvalid: 'الطول ليس رقماً', lenComma: 'الطول فيه فاصلة: لا يُعرف هل هي فاصلة عشرية أم فاصل آلاف',
      lenNotPositive: 'الطول صفر أو سالب', lenTooLong: 'الطول أكثر من 100 م', unitLooksMm: 'القيمة كبيرة جداً على المتر: تحقق من الوحدة',
      unitLooksM: 'القيمة صغيرة جداً على المليمتر: تحقق من الوحدة',
      qtyMissing: 'عدد الأسياخ غير موجود', qtyInvalid: 'عدد الأسياخ غير صالح', qtyFraction: 'عدد الأسياخ ليس رقماً صحيحاً',
      qtyFactors: 'عدد العناصر أو العدد في كل عنصر غير موجود أو ليس رقماً صحيحاً', qtyMismatch: 'إجمالي الأسياخ لا يساوي عدد العناصر × العدد في كل عنصر'
    },
    warn: {
      dupMark: function (w) { return 'رقم السيخ ' + w.mark + (w.member ? ' (' + w.member + ')' : '') + ' مكرر في الصفوف ' + w.rows.join('، ') + ' بنفس البيانات. كل الصفوف محسوبة: تأكد أنه غير مُدخل مرتين.'; },
      dupMarkConflict: function (w) { return 'رقم السيخ ' + w.mark + (w.member ? ' (' + w.member + ')' : '') + ' مكرر في الصفوف ' + w.rows.join('، ') + ' بقطر أو درجة أو شكل أو طول مختلف. كل الصفوف محسوبة: راجع الجدول.'; },
      multiGrade: function (w) { return 'في الجدول أكثر من درجة: ' + w.grades.join('، ') + '. الدرجات منفصلة في كل الحسابات.'; },
      gradePartlyMissing: function (w) { return w.count + ' صفاً بدون درجة. تظهر "بدون درجة" ولا تُنسب لها درجة.'; },
      gradeAllMissing: 'لا توجد درجة في هذا الجدول. الوزن لا يعتمد على الدرجة، لكن حددها عند الطلب.',
      gradeSpellings: function (w) { return 'نفس الدرجة مكتوبة بأشكال مختلفة: ' + w.spellings.join(' / ') + '. عوملت كدرجة واحدة.'; },
      diaNonStandard: function (w) { return 'قطر غير قياسي: ' + w.diameters.join('، ') + ' مم. تم حسابه، لكن راجع المخطط.'; },
      overStock: function (w) { return w.count + ' صفاً أطول من سيخ 12 م. تحتاج وصلات أو طولاً خاصاً، ولا تُرسل لأداة تحسين القص.'; },
      formula: function (w) { return w.count + ' صفاً قيمها من معادلات. استُخدمت القيمة المحفوظة في الملف ولم تُشغّل أي معادلة. أعد الحساب واحفظ في الإكسل إذا كان عندك شك.'; },
      weightDiff: function (w) { return 'في ' + w.count + ' صفاً الوزن المكتوب في الجدول يختلف عن الوزن النظري بأكثر من 1٪.'; },
      weightUnitUnknown: 'عمود الوزن لا يذكر الوحدة في عنوانه، لذلك لم تتم مطابقته.',
      totalLengthDiff: function (w) { return 'في ' + w.count + ' صفاً الطول الكلي المكتوب يختلف عن الطول × العدد.'; },
      qtyFromFactors: 'إجمالي الأسياخ = عدد العناصر × العدد في كل عنصر، كما في الجدول.'
    },
    assume: [
      'الوزن النظري = 0.006165 × ق² كجم/م × طول القص × عدد الأسياخ. هذه تقديرات اسمية، وليست أوزاناً موزونة أو معتمدة.',
      'أطوال القص مأخوذة كما هي في الجدول. لا تُضاف خصومات الثني ولا الوصلات ولا الهدر.',
      'لم يتم رفع أي شيء: الملف قُرئ داخل هذا المتصفح ويختفي عند إغلاق الصفحة.'
    ],
    lenUnitFrom: function (u, how) { return 'طول القص مقروء بوحدة ' + u + (how === 'header' ? ' (من عنوان العمود).' : ' (حسب اختيارك).'); },
    figs: ['الأسياخ', 'الوزن النظري', 'الطول الكلي', 'الصفوف المستخدمة'], figU: ['سيخ', 'طن', 'م', ''],
    rowsUsed: function (ok, bad, blank) { return ok + ' مستخدم · ' + bad + ' مستبعد · ' + blank + ' فارغ'; },
    th: { dia: 'القطر مم', grade: 'الدرجة', shape: 'الشكل', bars: 'الأسياخ', len: 'الطول م', kgm: 'كجم/م', kg: 'الوزن كجم', share: 'النسبة', row: 'الصف', mark: 'الرقم', member: 'العنصر', cut: 'القص مم', problem: 'المشكلة', data: 'الخلايا', warn: 'ملاحظات' },
    noGrade: 'بدون درجة', noShape: '—', showAll: function (n) { return 'اعرض كل الصفوف (' + n.toLocaleString('en-US') + ')'; },
    sendNote: function (n, r, l) { return 'سيتم إرسال ' + n + ' بنداً (مجمّعة حسب القطر والدرجة وطول القص)' + (r ? '؛ تم تقريب ' + r + ' طولاً لأقرب مم' : '') + (l ? '؛ واستُبعد ' + l + ' صفاً أطول من 12 م' : '') + '.'; },
    warnCodes: { diaNonStandard: 'قطر غير قياسي', formula: 'معادلة', gradeMissing: 'بدون درجة', overStock: '> 12 م', weightDiff: 'الوزن ≠ الجدول', totalLengthDiff: 'الطول ≠ الجدول', dupMark: 'رقم مكرر', dupMarkConflict: 'تعارض في الرقم' },
    sample: [
      ['المشروع: فيلا B-12 · القواعد والأعمدة (بيانات مثال)'],
      [],
      ['العنصر', 'رقم السيخ', 'القطر (مم)', 'الدرجة', 'كود الشكل', 'طول القص (مم)', 'عدد العناصر', 'العدد في كل عنصر', 'العدد الكلي', 'الوزن (كجم)'],
      ['F1', '01', 'T16', 'Gr60', '21', 2350, 12, 8, 96, 356.03],
      ['F1', '02', 'T16', 'Gr60', '21', 1850, 12, 6, 72, 210.21],
      ['C1', '03', 'T20', 'Gr60', '00', 3150, 8, 6, 48, 372.88],
      ['C1', '04', 'T10', 'Gr60', '51', 1480, 8, 40, 320, 292.12],
      ['B1', '05', 'T16', 'Grade 60', '00', 6450, 4, 4, 16, 162.84],
      ['B1', '06', 'T12', 'Gr60', '51', 1950, 4, 30, 120, 210.4],
      ['B1', '06', 'T12', 'Gr60', '51', 1950, 4, 30, 120, 210.4],
      ['S1', '07', 'T12', 'Gr80', '00', 5850, 1, 48, 48, 249.33],
      ['S1', '08', 'T12', 'Gr80', '00', '2,875', 1, 60, 60, ''],
      ['', 'الإجمالي', '', '', '', '', '', '', '', 2064.21]
    ]
  };

  var zh = {
    fields: { mark: '钢筋编号', member: '构件', diameter: '直径', grade: '牌号', shape: '形状代码', length: '下料长度',
      qty: '总根数', nMembers: '构件数', nEach: '每件根数', totalLength: '总长度（核对）', weight: '重量（核对）' },
    required: '必填', optional: '可选', none: '— 表中没有此列 —', column: '列',
    unitChoose: '— 请选择 —', mm: '毫米', m: '米', kg: '公斤', t: '吨',
    msg: {
      reading: '正在浏览器内读取文件…',
      loaded: function (n, name) { return '已从 ' + name + ' 读取 ' + n.toLocaleString('en-US') + ' 行。请核对下方的列，然后分析。'; },
      detected: function (r) { return '在第 ' + r + ' 行找到表头，已按名称匹配各列，请核对。'; },
      noHeader: '未识别到表头。请设置表头所在行，并逐一选择各列。',
      empty: '没有可读取的内容：文件或粘贴区域为空。',
      pasted: '粘贴内容', manual: '手动输入', sample: '示例钢筋表',
      sheetTruncated: '工作表超过 100,000 行，只读取了前 100,000 行。',
      xlsx: {
        notZip: '这不是 .xlsx 文件。请在 Excel 中另存为 .xlsx 或 CSV。', notXlsx: '该文件不是 Excel 工作簿（.xlsx）。',
        zip64: '该工作簿使用本工具无法读取的格式（ZIP64）。请另存为 CSV 后重试。',
        encrypted: '工作簿有密码保护。请取消密码或另存为 CSV。',
        tooLarge: '文件超过 25 MB。请只将钢筋表工作表另存为 CSV 后重试。',
        partTooLarge: '工作簿过大，无法在浏览器中安全读取。请将钢筋表另存为 CSV。',
        dtd: '工作簿包含出于安全原因被拒绝的 XML 内容。', noSheets: '该工作簿中没有工作表。',
        corrupt: '文件已损坏或不是有效的 .xlsx 文件。', method: '工作簿使用了不支持的压缩方式。请另存为 CSV。',
        noInflate: '此浏览器无法打开 .xlsx 文件。请使用新版 Chrome、Edge、Safari 或 Firefox，或另存为 CSV。',
        multiDisk: '不支持分卷压缩文件。', xls: '不支持旧版 .xls 文件。请另存为 .xlsx 或 CSV。', other: '无法读取该文件。'
      },
      cfg: {
        missingColumns: function (f) { return '未设置必填列：' + f.join('、') + '。请在上方的列匹配中选择。'; },
        lengthUnit: '请选择下料长度列的单位（毫米或米）。表头未注明，本工具不会猜测。',
        sameColumn: function (a, b) { return '同一列被匹配了两次（' + a + ' 和 ' + b + '）。每个字段需要各自的列。'; },
        tooManyRows: '数据超过 100,000 行。请拆分钢筋表后分批分析。'
      },
      sent: '已在新标签页打开下料优化工具并填入这些行。计算前请先在那里核对。',
      nothingToSend: '没有可发送的有效行。',
      popup: '浏览器阻止了新标签页。请允许本网站弹出窗口，或使用此链接：',
      tooBig: '不同下料长度过多，无法一次发送（上限 2,000）。请先筛选钢筋表。'
    },
    issue: {
      unreadable: '不是钢筋行（没有直径和长度）', cellError: '所用单元格含有表格错误值',
      diaMissing: '缺少直径', diaInvalid: '直径无法读取或超出 4–60 毫米', diaImperial: '美制钢筋号（#），不是毫米',
      lenMissing: '缺少长度', lenInvalid: '长度不是数字', lenComma: '长度含逗号：无法判断是小数点还是千位分隔符',
      lenNotPositive: '长度为零或负数', lenTooLong: '长度超过 100 米', unitLooksMm: '数值对“米”来说过大：请检查单位',
      unitLooksM: '数值对“毫米”来说过小：请检查单位',
      qtyMissing: '缺少根数', qtyInvalid: '根数无效', qtyFraction: '根数不是整数',
      qtyFactors: '构件数或每件根数缺失或不是整数', qtyMismatch: '总根数 ≠ 构件数 × 每件根数'
    },
    warn: {
      dupMark: function (w) { return '钢筋编号 ' + w.mark + (w.member ? '（' + w.member + '）' : '') + ' 在第 ' + w.rows.join('、') + ' 行重复，数据相同。所有行均已计入：请确认没有重复录入。'; },
      dupMarkConflict: function (w) { return '钢筋编号 ' + w.mark + (w.member ? '（' + w.member + '）' : '') + ' 在第 ' + w.rows.join('、') + ' 行重复，但直径、牌号、形状或长度不同。所有行均已计入：请核对钢筋表。'; },
      multiGrade: function (w) { return '本表包含多个牌号：' + w.grades.join('、') + '。各牌号始终分开计算。'; },
      gradePartlyMissing: function (w) { return w.count + ' 行没有牌号，显示为“无牌号”，不会被指定牌号。'; },
      gradeAllMissing: '本表没有牌号。重量与牌号无关，但订货时请注明。',
      gradeSpellings: function (w) { return '同一牌号有不同写法：' + w.spellings.join(' / ') + '，已视为同一牌号。'; },
      diaNonStandard: function (w) { return '非标准直径：' + w.diameters.join('、') + ' 毫米。已计算，请核对图纸。'; },
      overStock: function (w) { return w.count + ' 行长度超过 12 米定尺，需要搭接或特殊长度，不会发送到下料优化工具。'; },
      formula: function (w) { return w.count + ' 行的数值来自公式。使用了文件中保存的结果，未运行任何公式。如有疑问，请在 Excel 中重新计算并保存。'; },
      weightDiff: function (w) { return '有 ' + w.count + ' 行表中重量与理论重量相差超过 1%。'; },
      weightUnitUnknown: '重量列的表头未注明单位，因此未作核对。',
      totalLengthDiff: function (w) { return '有 ' + w.count + ' 行表中总长度与 长度 × 根数 不一致。'; },
      qtyFromFactors: '总根数 = 构件数 × 每件根数（按表中数据）。'
    },
    assume: [
      '理论重量 = 0.006165 × d² 公斤/米 × 下料长度 × 根数。这是理论估算值，不是称重或认证数量。',
      '下料长度按钢筋表原值计算，未另加弯曲扣减、搭接或损耗。',
      '没有上传任何内容：文件在本浏览器中读取，关闭页面即消失。'
    ],
    lenUnitFrom: function (u, how) { return '下料长度单位：' + u + (how === 'header' ? '（来自表头）。' : '（由您选择）。'); },
    figs: ['根数', '理论重量', '总长度', '使用的行'], figU: ['根', '吨', '米', ''],
    rowsUsed: function (ok, bad, blank) { return '使用 ' + ok + ' · 排除 ' + bad + ' · 空行 ' + blank; },
    th: { dia: '直径 mm', grade: '牌号', shape: '形状', bars: '根数', len: '长度 m', kgm: 'kg/m', kg: '重量 kg', share: '占比', row: '行', mark: '编号', member: '构件', cut: '下料 mm', problem: '问题', data: '单元格', warn: '备注' },
    noGrade: '无牌号', noShape: '—', showAll: function (n) { return '显示全部 ' + n.toLocaleString('en-US') + ' 行'; },
    sendNote: function (n, r, l) { return '将发送 ' + n + ' 行（按直径、牌号和下料长度合并）' + (r ? '；' + r + ' 个长度四舍五入到毫米' : '') + (l ? '；' + l + ' 行超过 12 米未发送' : '') + '。'; },
    warnCodes: { diaNonStandard: '非标直径', formula: '公式', gradeMissing: '无牌号', overStock: '> 12 米', weightDiff: '重量 ≠ 表中', totalLengthDiff: '长度 ≠ 表中', dupMark: '编号重复', dupMarkConflict: '编号冲突' },
    sample: [
      ['项目：B-12 别墅 · 基础与柱（示例数据）'],
      [],
      ['构件', '钢筋编号', '直径(毫米)', '牌号', '形状代码', '下料长度(毫米)', '构件数', '每件根数', '总根数', '重量(kg)'],
      ['F1', '01', 'T16', 'Gr60', '21', 2350, 12, 8, 96, 356.03],
      ['F1', '02', 'T16', 'Gr60', '21', 1850, 12, 6, 72, 210.21],
      ['C1', '03', 'T20', 'Gr60', '00', 3150, 8, 6, 48, 372.88],
      ['C1', '04', 'T10', 'Gr60', '51', 1480, 8, 40, 320, 292.12],
      ['B1', '05', 'T16', 'Grade 60', '00', 6450, 4, 4, 16, 162.84],
      ['B1', '06', 'T12', 'Gr60', '51', 1950, 4, 30, 120, 210.4],
      ['B1', '06', 'T12', 'Gr60', '51', 1950, 4, 30, 120, 210.4],
      ['S1', '07', 'T12', 'Gr80', '00', 5850, 1, 48, 48, 249.33],
      ['S1', '08', 'T12', 'Gr80', '00', '2,875', 1, 60, 60, ''],
      ['', '合计', '', '', '', '', '', '', '', 2064.21]
    ]
  };

  return { en: en, ar: ar, zh: zh };
});
