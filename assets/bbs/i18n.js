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
        multiDisk: 'Split archives are not supported.', xls: 'Old .xls files are not supported. Save the sheet as .xlsx or CSV.', xlsb: 'Excel binary (.xlsb) files are not supported. Save the sheet as .xlsx or CSV.', ods: 'OpenDocument (.ods) files are not supported. Save the sheet as .xlsx or CSV.', binary: 'This file is not a text file (CSV, TSV or TXT). Save the sheet as .xlsx or CSV, or check the file name.', other: 'The file could not be read.',
        duplicate: 'The file contains the same part twice. It was refused as unsafe.', mismatch: 'The file\'s internal headers do not agree. It was refused as damaged or tampered.',
        crc: 'A checksum inside the file does not match its contents. The file is damaged.', sizeMismatch: 'A part of the file is not the size it declares. It was refused as damaged or unsafe.',
        rels: 'The workbook points to a sheet outside the file or to an external address. It was refused for safety.', xml: 'A sheet inside the workbook is not valid XML (damaged or edited outside Excel).',
        unsupported: 'The workbook uses a ZIP feature this tool does not support. Save it as .xlsx again from Excel, or as CSV.'
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
      lenNotPositive: 'Length zero or negative', overStock: 'Cut length exceeds the 12 m stock bar limit.', unitLooksMm: 'Value too large for metres: check the unit',
      unitLooksM: 'Value too small for millimetres: check the unit',
      qtyMissing: 'Number of bars missing', qtyInvalid: 'Number of bars not valid', qtyFraction: 'Number of bars is not a whole number',
      qtyFactors: 'Members or bars per member missing or not whole numbers', qtyMismatch: 'Total bars ≠ members × bars per member'
    },
    warn: {
      dupMark: function (w) { return 'Review needed: bar mark ' + w.mark + (w.scoped ? ' in member ' + (w.member || '(blank)') : '') + ' appears on rows ' + w.rows.join(', ') + ' with identical data. All rows and quantities are kept and counted; delete the repeat in your schedule if it was entered twice.'; },
      dupMarkConflict: function (w) { return 'Review needed: bar mark ' + w.mark + (w.scoped ? ' in member ' + (w.member || '(blank)') : '') + ' appears on rows ' + w.rows.join(', ') + ' with DIFFERENT diameter, grade, shape or length. All rows and quantities are kept and counted until you correct the schedule.'; },
      dupNoMember: 'There is no member column, so repeated bar marks cannot be told apart: the same mark may be correct in different members. Repeats are listed for review, not removed.',
      gradeAssigned: function (w) { return 'You assigned ' + w.grade + ' to ' + w.count + ' rows that had no grade in the schedule.'; },
      multiGrade: function (w) { return 'More than one grade in this schedule: ' + w.grades.join(', ') + '. Grades are kept apart everywhere.'; },
      gradePartlyMissing: function (w) { return w.count + ' rows have no grade. They are shown as "no grade", not assigned one.'; },
      gradeAllMissing: 'No grade in this schedule. Weights do not depend on grade, but state it when you order.',
      gradeSpellings: function (w) { return 'The same grade is written in different ways: ' + w.spellings.join(' / ') + '. They were treated as one grade.'; },
      diaNonStandard: function (w) { return 'Non-standard diameter: ' + w.diameters.join(', ') + ' mm. Calculated, but check the drawing.'; },
      formula: function (w) { return w.count + ' rows take values from formulas. The value Excel saved was used; no formula was run. Recalculate and save in Excel if in doubt.'; },
      weightDiff: function (w) { return 'On ' + w.count + ' rows the weight in the sheet differs from the theoretical weight by more than 1%.'; },
      weightUnitUnknown: 'The weight column has no unit in its header, so it was not cross-checked.',
      totalLengthDiff: function (w) { return 'On ' + w.count + ' rows the total length in the sheet differs from length × bars.'; },
      qtyFromFactors: 'Total bars = no. of members × no. in each, as given in the sheet.'
    },
    assume: [
      'Theoretical weight = 0.006165 × d² kg/m × cut length × number of bars. These are nominal estimates, not weighed or certified quantities.',
      'Cut lengths are taken as given in the schedule. Bend deductions, laps and wastage are not added.',
      'Any cut length above 12,000 mm (one 12 m stock bar) is excluded from every total and from the cutting optimizer. 12,000 mm itself is included.',
      'Nothing was uploaded: the file was read in this browser and is gone when you close the page.'
    ],
    lenUnitFrom: function (u, how) { return 'Cut length read in ' + u + (how === 'header' ? ' (from the column header).' : ' (chosen by you).'); },
    figs: ['Bars', 'Theoretical weight', 'Total length', 'Rows used'], figU: ['pcs', 't', 'm', ''],
    rowsUsed: function (ok, bad, blank) { return ok + ' used · ' + bad + ' excluded · ' + blank + ' blank'; },
    th: { dia: 'Ø mm', grade: 'Grade', shape: 'Shape', bars: 'Bars', len: 'Length m', kgm: 'kg/m', kg: 'Weight kg', share: 'Share', row: 'Row', mark: 'Mark', member: 'Member', cut: 'Cut mm', problem: 'Reason', data: 'Cells', warn: 'Notes' },
    groups: {
      included: 'Included in the analysis', excluded: 'Excluded from the calculation', noOpt: 'Included, but not sent to the cutting optimizer',
      includedText: function (r, b, t) { return r + ' rows · ' + b + ' bars · ' + t + ' t. These rows make up every total on this page.'; },
      excludedText: function (r) { return r + ' rows could not be used. They are listed below with the reason, and none of their values is in any total.'; },
      overText: function (r, b, m, t, nq) { return 'Of these, ' + r + ' rows are longer than 12 m: ' + b + ' bars, ' + m + ' m, ' + t + ' t theoretical, shown here only and not counted' + (nq ? ' (' + nq + ' of them with no readable quantity)' : '') + '.'; },
      noOptText: function (r, b) { return r + ' rows (' + b + ' bars) have no grade. They are in the totals above as "no grade", but cannot be sent to the cutting optimizer until you assign a grade. Grade 60 or 80 is never assumed.'; },
      none: 'None.'
    },
    assign: { label: 'Grade for rows without one', apply: 'Assign grade', clear: 'Remove assigned grade', empty: 'Enter or pick a grade first.',
      help: 'Applies only to rows with no grade in the schedule, and is shown on each of them as assigned by you. For different grades per row, correct the schedule and load it again.',
      scope: function (n, b, rows) { return 'The grade you choose will be applied to ALL ' + n + ' rows without a grade (' + b + ' bars): rows ' + rows + '.'; },
      confirm: function (n, g) { return 'I confirm that ' + (g ? g : 'this grade') + ' is correct for all ' + n + ' of these rows.'; },
      needConfirm: 'Tick the confirmation first.' },
    th2: { cut: 'Cut length', qty: 'Bars' },
    noGrade: 'no grade', noShape: '—', showAll: function (n) { return 'Show all ' + n.toLocaleString('en-US') + ' rows'; },
    sendNote: function (n, r, gr, gb) { return n + ' lines (grouped by diameter, grade and cut length) will be sent' + (r ? '; ' + r + ' lengths rounded to the nearest mm' : '') + (gr ? '; ' + gr + ' rows (' + gb + ' bars) without a grade are held back' : '') + '. Rows over 12 m are never sent.'; },
    warnCodes: { diaNonStandard: 'non-standard Ø', formula: 'formula', gradeMissing: 'no grade: not sent to optimizer', gradeAssigned: 'grade assigned by you', weightDiff: 'weight ≠ sheet', totalLengthDiff: 'length ≠ sheet', dupMark: 'repeated mark: review', dupMarkConflict: 'mark conflict: review' },
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
      ['S1', '09', 'T25', 'Gr80', '00', 12500, 1, 4, 4, ''],
      ['S1', '10', 'T12', '', '00', 1200, 1, 20, 20, ''],
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
        multiDisk: 'الملفات المقسّمة غير مدعومة.', xls: 'ملفات ‎.xls القديمة غير مدعومة. احفظ الورقة بصيغة ‎.xlsx أو CSV.', xlsb: 'ملفات إكسل الثنائية ‎(.xlsb) غير مدعومة. احفظ الورقة بصيغة ‎.xlsx أو CSV.', ods: 'ملفات OpenDocument ‏(‎.ods) غير مدعومة. احفظ الورقة بصيغة ‎.xlsx أو CSV.', binary: 'هذا الملف ليس ملفاً نصياً (CSV أو TSV أو TXT). احفظ الورقة بصيغة ‎.xlsx أو CSV، أو تأكد من اسم الملف.', other: 'تعذّرت قراءة الملف.',
        duplicate: 'الملف يحتوي على نفس الجزء مرتين، فتم رفضه لأنه غير آمن.', mismatch: 'الترويسات الداخلية للملف غير متطابقة، فتم رفضه لأنه تالف أو معدّل.',
        crc: 'رمز التحقق داخل الملف لا يطابق محتواه. الملف تالف.', sizeMismatch: 'جزء من الملف حجمه لا يطابق الحجم المعلن، فتم رفضه لأنه تالف أو غير آمن.',
        rels: 'الملف يشير إلى ورقة خارجه أو إلى عنوان خارجي، فتم رفضه لأسباب أمنية.', xml: 'إحدى أوراق الملف ليست XML صالحاً (تالفة أو معدّلة خارج الإكسل).',
        unsupported: 'الملف يستخدم خاصية ZIP غير مدعومة. احفظه مرة أخرى من الإكسل بصيغة ‎.xlsx أو CSV.'
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
      lenNotPositive: 'الطول صفر أو سالب', overStock: 'طول القص يتجاوز حد السيخ القياسي 12 م.', unitLooksMm: 'القيمة كبيرة جداً على المتر: تحقق من الوحدة',
      unitLooksM: 'القيمة صغيرة جداً على المليمتر: تحقق من الوحدة',
      qtyMissing: 'عدد الأسياخ غير موجود', qtyInvalid: 'عدد الأسياخ غير صالح', qtyFraction: 'عدد الأسياخ ليس رقماً صحيحاً',
      qtyFactors: 'عدد العناصر أو العدد في كل عنصر غير موجود أو ليس رقماً صحيحاً', qtyMismatch: 'إجمالي الأسياخ لا يساوي عدد العناصر × العدد في كل عنصر'
    },
    warn: {
      dupMark: function (w) { return 'يحتاج مراجعة: رقم السيخ ' + w.mark + (w.scoped ? ' في العنصر ' + (w.member || '(فارغ)') : '') + ' موجود في الصفوف ' + w.rows.join('، ') + ' بنفس البيانات. كل الصفوف والكميات محفوظة ومحسوبة؛ احذف التكرار من جدولك إذا كان مُدخلاً مرتين.'; },
      dupMarkConflict: function (w) { return 'يحتاج مراجعة: رقم السيخ ' + w.mark + (w.scoped ? ' في العنصر ' + (w.member || '(فارغ)') : '') + ' موجود في الصفوف ' + w.rows.join('، ') + ' بقطر أو درجة أو شكل أو طول مختلف. كل الصفوف والكميات محفوظة ومحسوبة إلى أن تصحح الجدول.'; },
      dupNoMember: 'لا يوجد عمود للعنصر، لذلك لا يمكن التمييز بين أرقام الأسياخ المكررة: قد يكون نفس الرقم صحيحاً في عناصر مختلفة. التكرارات معروضة للمراجعة ولم تُحذف.',
      gradeAssigned: function (w) { return 'أنت حددت الدرجة ' + w.grade + ' لعدد ' + w.count + ' صفاً لم تكن لها درجة في الجدول.'; },
      multiGrade: function (w) { return 'في الجدول أكثر من درجة: ' + w.grades.join('، ') + '. الدرجات منفصلة في كل الحسابات.'; },
      gradePartlyMissing: function (w) { return w.count + ' صفاً بدون درجة. تظهر "بدون درجة" ولا تُنسب لها درجة.'; },
      gradeAllMissing: 'لا توجد درجة في هذا الجدول. الوزن لا يعتمد على الدرجة، لكن حددها عند الطلب.',
      gradeSpellings: function (w) { return 'نفس الدرجة مكتوبة بأشكال مختلفة: ' + w.spellings.join(' / ') + '. عوملت كدرجة واحدة.'; },
      diaNonStandard: function (w) { return 'قطر غير قياسي: ' + w.diameters.join('، ') + ' مم. تم حسابه، لكن راجع المخطط.'; },
      formula: function (w) { return w.count + ' صفاً قيمها من معادلات. استُخدمت القيمة المحفوظة في الملف ولم تُشغّل أي معادلة. أعد الحساب واحفظ في الإكسل إذا كان عندك شك.'; },
      weightDiff: function (w) { return 'في ' + w.count + ' صفاً الوزن المكتوب في الجدول يختلف عن الوزن النظري بأكثر من 1٪.'; },
      weightUnitUnknown: 'عمود الوزن لا يذكر الوحدة في عنوانه، لذلك لم تتم مطابقته.',
      totalLengthDiff: function (w) { return 'في ' + w.count + ' صفاً الطول الكلي المكتوب يختلف عن الطول × العدد.'; },
      qtyFromFactors: 'إجمالي الأسياخ = عدد العناصر × العدد في كل عنصر، كما في الجدول.'
    },
    assume: [
      'الوزن النظري = 0.006165 × ق² كجم/م × طول القص × عدد الأسياخ. هذه تقديرات اسمية، وليست أوزاناً موزونة أو معتمدة.',
      'أطوال القص مأخوذة كما هي في الجدول. لا تُضاف خصومات الثني ولا الوصلات ولا الهدر.',
      'أي طول قص أكبر من 12,000 مم (سيخ قياسي واحد 12 م) يُستبعد من كل الإجماليات ومن أداة تحسين القص. طول 12,000 مم نفسه محسوب.',
      'لم يتم رفع أي شيء: الملف قُرئ داخل هذا المتصفح ويختفي عند إغلاق الصفحة.'
    ],
    lenUnitFrom: function (u, how) { return 'طول القص مقروء بوحدة ' + u + (how === 'header' ? ' (من عنوان العمود).' : ' (حسب اختيارك).'); },
    figs: ['الأسياخ', 'الوزن النظري', 'الطول الكلي', 'الصفوف المستخدمة'], figU: ['سيخ', 'طن', 'م', ''],
    rowsUsed: function (ok, bad, blank) { return ok + ' مستخدم · ' + bad + ' مستبعد · ' + blank + ' فارغ'; },
    th: { dia: 'القطر مم', grade: 'الدرجة', shape: 'الشكل', bars: 'الأسياخ', len: 'الطول م', kgm: 'كجم/م', kg: 'الوزن كجم', share: 'النسبة', row: 'الصف', mark: 'الرقم', member: 'العنصر', cut: 'القص مم', problem: 'السبب', data: 'الخلايا', warn: 'ملاحظات' },
    groups: {
      included: 'داخل التحليل', excluded: 'مستبعد من الحساب', noOpt: 'داخل التحليل، لكن لا يُرسل لأداة تحسين القص',
      includedText: function (r, b, t) { return r + ' صفاً · ' + b + ' سيخ · ' + t + ' طن. هذه الصفوف هي كل ما في إجماليات الصفحة.'; },
      excludedText: function (r) { return r + ' صفاً لا يمكن استخدامها. معروضة بالأسفل مع السبب، ولا تدخل أي قيمة منها في أي إجمالي.'; },
      overText: function (r, b, m, t, nq) { return 'منها ' + r + ' صفاً أطول من 12 م: ' + b + ' سيخ، ' + m + ' م، ' + t + ' طن نظرياً، معروضة هنا فقط وغير محسوبة' + (nq ? ' (' + nq + ' منها بدون عدد مقروء)' : '') + '.'; },
      noOptText: function (r, b) { return r + ' صفاً (' + b + ' سيخ) بدون درجة. محسوبة في الإجماليات أعلاه تحت «بدون درجة»، لكن لا يمكن إرسالها لأداة تحسين القص إلا بعد أن تحدد الدرجة. لا تُفترض Grade 60 أو 80 أبداً.'; },
      none: 'لا يوجد.'
    },
    assign: { label: 'الدرجة للصفوف التي بدون درجة', apply: 'حدد الدرجة', clear: 'أزل الدرجة المحددة', empty: 'اكتب الدرجة أو اخترها أولاً.',
      help: 'تُطبَّق فقط على الصفوف التي ليس لها درجة في الجدول، وتظهر على كل صف منها أنها محددة منك. إذا كانت الدرجات تختلف من صف لآخر فصحّح الجدول وحمّله مرة أخرى.',
      scope: function (n, b, rows) { return 'الدرجة التي تختارها ستُطبَّق على كل الصفوف التي بدون درجة، وعددها ' + n + ' (' + b + ' سيخ): الصفوف ' + rows + '.'; },
      confirm: function (n, g) { return 'أؤكد أن ' + (g ? g : 'هذه الدرجة') + ' صحيحة لكل هذه الصفوف (' + n + ').'; },
      needConfirm: 'ضع علامة التأكيد أولاً.' },
    th2: { cut: 'طول القص', qty: 'الأسياخ' },
    noGrade: 'بدون درجة', noShape: '—', showAll: function (n) { return 'اعرض كل الصفوف (' + n.toLocaleString('en-US') + ')'; },
    sendNote: function (n, r, gr, gb) { return 'سيتم إرسال ' + n + ' بنداً (مجمّعة حسب القطر والدرجة وطول القص)' + (r ? '؛ تم تقريب ' + r + ' طولاً لأقرب مم' : '') + (gr ? '؛ ولن يُرسل ' + gr + ' صفاً (' + gb + ' سيخ) بدون درجة' : '') + '. الصفوف الأطول من 12 م لا تُرسل أبداً.'; },
    warnCodes: { diaNonStandard: 'قطر غير قياسي', formula: 'معادلة', gradeMissing: 'بدون درجة: لا يُرسل للقص', gradeAssigned: 'درجة محددة منك', weightDiff: 'الوزن ≠ الجدول', totalLengthDiff: 'الطول ≠ الجدول', dupMark: 'رقم مكرر: للمراجعة', dupMarkConflict: 'تعارض في الرقم: للمراجعة' },
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
      ['S1', '09', 'T25', 'Gr80', '00', 12500, 1, 4, 4, ''],
      ['S1', '10', 'T12', '', '00', 1200, 1, 20, 20, ''],
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
        multiDisk: '不支持分卷压缩文件。', xls: '不支持旧版 .xls 文件。请另存为 .xlsx 或 CSV。', xlsb: '不支持 Excel 二进制（.xlsb）文件。请另存为 .xlsx 或 CSV。', ods: '不支持 OpenDocument（.ods）文件。请另存为 .xlsx 或 CSV。', binary: '该文件不是文本文件（CSV、TSV 或 TXT）。请另存为 .xlsx 或 CSV，或检查文件名。', other: '无法读取该文件。',
        duplicate: '文件中同一部件出现两次，出于安全原因已拒绝。', mismatch: '文件内部头信息不一致，已作为损坏或被篡改的文件拒绝。',
        crc: '文件内部校验和与内容不符，文件已损坏。', sizeMismatch: '文件某部分的实际大小与声明不符，已作为损坏或不安全的文件拒绝。',
        rels: '工作簿指向文件外部的工作表或外部地址，出于安全原因已拒绝。', xml: '工作簿中的某个工作表不是有效的 XML（已损坏或在 Excel 外被修改）。',
        unsupported: '工作簿使用了本工具不支持的 ZIP 功能。请在 Excel 中重新另存为 .xlsx，或另存为 CSV。'
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
      lenNotPositive: '长度为零或负数', overStock: '下料长度超过 12 米定尺限制。', unitLooksMm: '数值对“米”来说过大：请检查单位',
      unitLooksM: '数值对“毫米”来说过小：请检查单位',
      qtyMissing: '缺少根数', qtyInvalid: '根数无效', qtyFraction: '根数不是整数',
      qtyFactors: '构件数或每件根数缺失或不是整数', qtyMismatch: '总根数 ≠ 构件数 × 每件根数'
    },
    warn: {
      dupMark: function (w) { return '需要核对：钢筋编号 ' + w.mark + (w.scoped ? '（构件 ' + (w.member || '空') + '）' : '') + ' 出现在第 ' + w.rows.join('、') + ' 行，数据相同。所有行和数量均保留并计入；如属重复录入，请在钢筋表中删除。'; },
      dupMarkConflict: function (w) { return '需要核对：钢筋编号 ' + w.mark + (w.scoped ? '（构件 ' + (w.member || '空') + '）' : '') + ' 出现在第 ' + w.rows.join('、') + ' 行，但直径、牌号、形状或长度不同。在您修改钢筋表之前，所有行和数量均保留并计入。'; },
      dupNoMember: '没有构件列，因此无法区分重复的钢筋编号：同一编号在不同构件中可能是正确的。重复项仅列出供核对，未被删除。',
      gradeAssigned: function (w) { return '您为钢筋表中 ' + w.count + ' 行无牌号的数据指定了牌号 ' + w.grade + '。'; },
      multiGrade: function (w) { return '本表包含多个牌号：' + w.grades.join('、') + '。各牌号始终分开计算。'; },
      gradePartlyMissing: function (w) { return w.count + ' 行没有牌号，显示为“无牌号”，不会被指定牌号。'; },
      gradeAllMissing: '本表没有牌号。重量与牌号无关，但订货时请注明。',
      gradeSpellings: function (w) { return '同一牌号有不同写法：' + w.spellings.join(' / ') + '，已视为同一牌号。'; },
      diaNonStandard: function (w) { return '非标准直径：' + w.diameters.join('、') + ' 毫米。已计算，请核对图纸。'; },
      formula: function (w) { return w.count + ' 行的数值来自公式。使用了文件中保存的结果，未运行任何公式。如有疑问，请在 Excel 中重新计算并保存。'; },
      weightDiff: function (w) { return '有 ' + w.count + ' 行表中重量与理论重量相差超过 1%。'; },
      weightUnitUnknown: '重量列的表头未注明单位，因此未作核对。',
      totalLengthDiff: function (w) { return '有 ' + w.count + ' 行表中总长度与 长度 × 根数 不一致。'; },
      qtyFromFactors: '总根数 = 构件数 × 每件根数（按表中数据）。'
    },
    assume: [
      '理论重量 = 0.006165 × d² 公斤/米 × 下料长度 × 根数。这是理论估算值，不是称重或认证数量。',
      '下料长度按钢筋表原值计算，未另加弯曲扣减、搭接或损耗。',
      '下料长度超过 12,000 毫米（一根 12 米定尺）的行不计入任何合计，也不发送到下料优化工具。12,000 毫米本身计入。',
      '没有上传任何内容：文件在本浏览器中读取，关闭页面即消失。'
    ],
    lenUnitFrom: function (u, how) { return '下料长度单位：' + u + (how === 'header' ? '（来自表头）。' : '（由您选择）。'); },
    figs: ['根数', '理论重量', '总长度', '使用的行'], figU: ['根', '吨', '米', ''],
    rowsUsed: function (ok, bad, blank) { return '使用 ' + ok + ' · 排除 ' + bad + ' · 空行 ' + blank; },
    th: { dia: '直径 mm', grade: '牌号', shape: '形状', bars: '根数', len: '长度 m', kgm: 'kg/m', kg: '重量 kg', share: '占比', row: '行', mark: '编号', member: '构件', cut: '下料 mm', problem: '原因', data: '单元格', warn: '备注' },
    groups: {
      included: '计入分析', excluded: '不计入计算', noOpt: '计入分析，但不发送到下料优化工具',
      includedText: function (r, b, t) { return r + ' 行 · ' + b + ' 根 · ' + t + ' 吨。本页所有合计均来自这些行。'; },
      excludedText: function (r) { return r + ' 行无法使用，已在下方列出原因，其数值不计入任何合计。'; },
      overText: function (r, b, m, t, nq) { return '其中 ' + r + ' 行超过 12 米：' + b + ' 根、' + m + ' 米、理论重量 ' + t + ' 吨，仅在此显示，不计入合计' + (nq ? '（其中 ' + nq + ' 行根数无法读取）' : '') + '。'; },
      noOptText: function (r, b) { return r + ' 行（' + b + ' 根）没有牌号。它们以“无牌号”计入上方合计，但在您指定牌号之前不能发送到下料优化工具。绝不默认为 Grade 60 或 80。'; },
      none: '无。'
    },
    assign: { label: '为无牌号的行指定牌号', apply: '指定牌号', clear: '取消指定的牌号', empty: '请先输入或选择牌号。',
      help: '只作用于钢筋表中没有牌号的行，并在每一行标注为由您指定。如各行牌号不同，请修改钢筋表后重新载入。',
      scope: function (n, b, rows) { return '您选择的牌号将应用于全部 ' + n + ' 行无牌号的数据（' + b + ' 根）：第 ' + rows + ' 行。'; },
      confirm: function (n, g) { return '我确认 ' + (g ? g : '该牌号') + ' 对这全部 ' + n + ' 行均正确。'; },
      needConfirm: '请先勾选确认。' },
    th2: { cut: '下料长度', qty: '根数' },
    noGrade: '无牌号', noShape: '—', showAll: function (n) { return '显示全部 ' + n.toLocaleString('en-US') + ' 行'; },
    sendNote: function (n, r, gr, gb) { return '将发送 ' + n + ' 行（按直径、牌号和下料长度合并）' + (r ? '；' + r + ' 个长度四舍五入到毫米' : '') + (gr ? '；' + gr + ' 行（' + gb + ' 根）无牌号，暂不发送' : '') + '。超过 12 米的行绝不发送。'; },
    warnCodes: { diaNonStandard: '非标直径', formula: '公式', gradeMissing: '无牌号：不发送', gradeAssigned: '牌号由您指定', weightDiff: '重量 ≠ 表中', totalLengthDiff: '长度 ≠ 表中', dupMark: '编号重复：需核对', dupMarkConflict: '编号冲突：需核对' },
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
      ['S1', '09', 'T25', 'Gr80', '00', 12500, 1, 4, 4, ''],
      ['S1', '10', 'T12', '', '00', 1200, 1, 20, 20, ''],
      ['', '合计', '', '', '', '', '', '', '', 2064.21]
    ]
  };

  return { en: en, ar: ar, zh: zh };
});
