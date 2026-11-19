/* Smart RFQ Generator: all text used by the script, the preview and the
   exported RFQ, in English, Arabic and Simplified Chinese. The exported text
   is always in the language of the page. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RfqText = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    en: {
      title: 'Request for Quotation: Reinforcing Steel',
      type: { standard: 'Straight deformed reinforcing steel', epoxy: 'Epoxy-coated reinforcing steel', cold8: '8 mm cold-rolled reinforcing steel' },
      typeShort: { standard: 'Deformed rebar', epoxy: 'Epoxy-coated rebar', cold8: 'Cold-rolled 8 mm' },
      grade: { '60': 'Grade 60', '80': 'Grade 80', '40': 'Grade 40' },
      length: { standard: '12 m', epoxy: 'Length to be confirmed', cold8: '6 m' },
      schedule: { single: 'Single delivery', multiple: 'Multiple deliveries', tbd: 'To be discussed' },
      payment: { cash: 'Cash in advance', lc: 'Bank LC', tbc: 'To be confirmed with sales' },
      choose: 'Select…', unit: 't', mm: 'mm',
      f: {
        company: 'Company name', contact: 'Contact person', email: 'Email', phone: 'Phone number', country: 'Country', city: 'City',
        project: 'Project name', location: 'Project location', site: 'Delivery site address', date: 'Required delivery date',
        schedule: 'Delivery schedule', notes: 'Additional project notes', payment: 'Payment terms',
        type: 'Product type', dia: 'Diameter', gradeF: 'Grade', qty: 'Quantity (metric tons)', lineDate: 'Delivery date', lineNotes: 'Notes', line: 'Line'
      },
      err: {
        required: 'This field is required.', email: 'Enter a valid email address, for example name@company.com.',
        phone: 'Enter a phone number with 7 to 15 digits; spaces, + - ( ) are allowed.',
        qtyMissing: 'Enter the quantity in metric tons.', qtyFormat: 'Use digits with a dot for decimals, for example 12.5. A comma is not accepted.',
        qtyPositive: 'The quantity must be more than 0.', qtyDecimals: 'Use at most 3 decimals (1 kg).', qtyMax: 'The quantity is above 100,000 t. Check the value.',
        type: 'Select the product type.', dia: 'Select the diameter.', gradeE: 'Select the grade.', notOffered: 'This diameter or grade is not offered for this product type.',
        date: 'Enter a valid date.', past: 'The date is in the past.', tooLong: 'This text is too long.',
        noLines: 'Add at least one product line.', maxLines: 'At most 50 product lines.', schedule: 'Select a delivery schedule.', payment: 'Select the payment terms.'
      },
      warn: {
        duplicate: function (a, b) { return 'Lines ' + a + ' and ' + b + ' request the same product, diameter, grade and delivery date. Combine them, or add a note that explains the difference.'; },
        epoxy: 'Epoxy-coated: availability of this diameter and grade must be confirmed by the sales team.',
        below30: 'The total is below 30 t: full truckload requirements and additional transport costs may apply. You can still send the request.'
      },
      fix: function (n) { return n === 1 ? '1 item needs attention before the preview.' : n + ' items need attention before the preview.'; },
      sum: {
        lines: 'Product lines', complete: 'complete', total: 'Total requested quantity (all products)', breakdown: 'Breakdown by product, diameter and grade',
        none: 'No complete product lines yet.', incomplete: function (n) { return n + (n === 1 ? ' line is' : ' lines are') + ' not complete and not counted.'; }
      },
      pv: {
        ref: 'RFQ reference', refNote: 'Generated in your browser for identification only. It is not an Al Rajhi Steel quotation number.',
        date: 'Prepared on', customer: 'Customer', project: 'Project', products: 'Requested products', delivery: 'Delivery requirements', payment: 'Payment preference',
        notes: 'Notes', commercial: 'Commercial notes', no: 'No.', length: 'Length', qty: 'Quantity (t)', lineNotes: 'Line notes', notGiven: 'Not given',
        total: 'Total requested quantity', confirm: 'availability to be confirmed', to: 'To', from: 'From'
      },
      paymentNote: 'Final payment terms and product availability are subject to confirmation by the Al Rajhi Steel sales team.',
      transportNote: 'Full truckload requirements and additional transportation costs for quantities below 30 metric tons may apply. Please confirm with the sales team.',
      disclaimer: 'This document is a request for quotation only. It is not a price offer, purchase order, sales contract, or confirmation of product availability. Final prices, specifications, payment terms, and delivery schedules are subject to confirmation by Al Rajhi Steel.',
      subject: function (ref, project) { return 'RFQ ' + ref + ': reinforcing steel for ' + project; },
      mailLong: 'The RFQ is too long for an email link. It has been copied: paste it into the message.',
      waLong: 'The RFQ is too long for a WhatsApp link. Use “Copy RFQ text” and paste it into WhatsApp.',
      copied: 'RFQ text copied.', copyFail: 'Could not copy. Select the text below and copy it manually.',
      reviewFirst: 'Tick the box to confirm you have reviewed the RFQ.', stale: 'The form has changed since the preview. Update the preview before sharing.',
      lineRemoved: function (n) { return 'Line ' + n + ' removed.'; }, lineAdded: function (n) { return 'Line ' + n + ' added.'; },
      typeChanged: 'Diameter and grade were cleared because they do not apply to the new product type. Select them again.'
    },
    ar: {
      title: 'طلب عرض سعر: حديد التسليح',
      type: { standard: 'حديد تسليح محزز مستقيم', epoxy: 'حديد تسليح مطلي بالإيبوكسي', cold8: 'حديد تسليح 8 مم مدرفل على البارد' },
      typeShort: { standard: 'حديد محزز', epoxy: 'حديد إيبوكسي', cold8: '8 مم مدرفل على البارد' },
      grade: { '60': 'Grade 60', '80': 'Grade 80', '40': 'Grade 40' },
      length: { standard: '12 م', epoxy: 'الطول يُؤكَّد لاحقاً', cold8: '6 م' },
      schedule: { single: 'توريد دفعة واحدة', multiple: 'توريد على عدة دفعات', tbd: 'يُناقش لاحقاً' },
      payment: { cash: 'دفع نقدي مقدماً', lc: 'اعتماد مستندي (LC)', tbc: 'يُؤكَّد مع المبيعات' },
      choose: 'اختر…', unit: 'طن', mm: 'مم',
      f: {
        company: 'اسم الشركة', contact: 'الشخص المسؤول', email: 'البريد الإلكتروني', phone: 'رقم الهاتف', country: 'الدولة', city: 'المدينة',
        project: 'اسم المشروع', location: 'موقع المشروع', site: 'عنوان موقع التسليم', date: 'تاريخ التسليم المطلوب',
        schedule: 'جدول التسليم', notes: 'ملاحظات إضافية عن المشروع', payment: 'شروط الدفع',
        type: 'نوع المنتج', dia: 'القطر', gradeF: 'الدرجة', qty: 'الكمية (طن متري)', lineDate: 'تاريخ التسليم', lineNotes: 'ملاحظات', line: 'البند'
      },
      err: {
        required: 'هذا الحقل مطلوب.', email: 'أدخل بريداً إلكترونياً صحيحاً، مثل name@company.com.',
        phone: 'أدخل رقم هاتف من 7 إلى 15 رقماً؛ يُسمح بالمسافات و+ و- والأقواس.',
        qtyMissing: 'أدخل الكمية بالطن المتري.', qtyFormat: 'استخدم أرقاماً مع نقطة للكسور، مثل 12.5. الفاصلة غير مقبولة.',
        qtyPositive: 'يجب أن تكون الكمية أكبر من 0.', qtyDecimals: 'استخدم 3 خانات عشرية على الأكثر (1 كجم).', qtyMax: 'الكمية أكبر من 100,000 طن. تحقق من القيمة.',
        type: 'اختر نوع المنتج.', dia: 'اختر القطر.', gradeE: 'اختر الدرجة.', notOffered: 'هذا القطر أو هذه الدرجة غير متاحة لهذا النوع من المنتجات.',
        date: 'أدخل تاريخاً صحيحاً.', past: 'التاريخ في الماضي.', tooLong: 'النص أطول من المسموح.',
        noLines: 'أضف بنداً واحداً على الأقل.', maxLines: '50 بنداً كحد أقصى.', schedule: 'اختر جدول التسليم.', payment: 'اختر شروط الدفع.'
      },
      warn: {
        duplicate: function (a, b) { return 'البندان ' + a + ' و' + b + ' يطلبان نفس المنتج والقطر والدرجة وتاريخ التسليم. ادمجهما، أو أضف ملاحظة توضح الفرق.'; },
        epoxy: 'حديد الإيبوكسي: توفر هذا القطر وهذه الدرجة يحتاج إلى تأكيد من فريق المبيعات.',
        below30: 'الإجمالي أقل من 30 طناً: قد تنطبق متطلبات الحمولة الكاملة للشاحنة وتكاليف نقل إضافية. ويمكنك إرسال الطلب مع ذلك.'
      },
      fix: function (n) { return n === 1 ? 'بند واحد يحتاج إلى تصحيح قبل المعاينة.' : n + ' بنود تحتاج إلى تصحيح قبل المعاينة.'; },
      sum: {
        lines: 'بنود المنتجات', complete: 'مكتملة', total: 'إجمالي الكمية المطلوبة (كل المنتجات)', breakdown: 'التفصيل حسب المنتج والقطر والدرجة',
        none: 'لا توجد بنود مكتملة بعد.', incomplete: function (n) { return n === 1 ? 'بند واحد غير مكتمل ولا يُحتسب.' : n + ' بنود غير مكتملة ولا تُحتسب.'; }
      },
      pv: {
        ref: 'رقم مرجع الطلب', refNote: 'يُنشأ في متصفحك للتعريف فقط، وليس رقم عرض سعر من الراجحي للحديد.',
        date: 'تاريخ الإعداد', customer: 'العميل', project: 'المشروع', products: 'المنتجات المطلوبة', delivery: 'متطلبات التسليم', payment: 'شروط الدفع المفضلة',
        notes: 'ملاحظات', commercial: 'ملاحظات تجارية', no: 'م', length: 'الطول', qty: 'الكمية (طن)', lineNotes: 'ملاحظات البنود', notGiven: 'غير محدد',
        total: 'إجمالي الكمية المطلوبة', confirm: 'التوفر يحتاج إلى تأكيد', to: 'إلى', from: 'من'
      },
      paymentNote: 'شروط الدفع النهائية وتوفر المنتجات تخضع لتأكيد فريق مبيعات الراجحي للحديد.',
      transportNote: 'قد تنطبق متطلبات الحمولة الكاملة للشاحنة وتكاليف نقل إضافية على الكميات الأقل من 30 طناً مترياً. يُرجى التأكيد مع فريق المبيعات.',
      disclaimer: 'هذا المستند طلب عرض سعر فقط، وليس عرض سعر ولا أمر شراء ولا عقد بيع ولا تأكيداً لتوفر المنتجات. الأسعار النهائية والمواصفات وشروط الدفع وجداول التسليم تخضع لتأكيد الراجحي للحديد.',
      subject: function (ref, project) { return 'طلب عرض سعر ' + ref + ': حديد تسليح لمشروع ' + project; },
      mailLong: 'الطلب أطول من أن يُرسل في رابط بريد. تم نسخه: الصقه في الرسالة.',
      waLong: 'الطلب أطول من أن يُرسل في رابط واتساب. استخدم «نسخ نص الطلب» والصقه في واتساب.',
      copied: 'تم نسخ نص الطلب.', copyFail: 'تعذّر النسخ. حدد النص بالأسفل وانسخه يدوياً.',
      reviewFirst: 'ضع علامة في المربع لتأكيد أنك راجعت الطلب.', stale: 'تغيّر النموذج بعد المعاينة. حدّث المعاينة قبل المشاركة.',
      lineRemoved: function (n) { return 'تم حذف البند ' + n + '.'; }, lineAdded: function (n) { return 'تمت إضافة البند ' + n + '.'; },
      typeChanged: 'تم مسح القطر والدرجة لأنهما لا ينطبقان على نوع المنتج الجديد. اخترهما من جديد.'
    },
    zh: {
      title: '询价单：钢筋',
      type: { standard: '直条带肋钢筋', epoxy: '环氧涂层钢筋', cold8: '8 毫米冷轧钢筋' },
      typeShort: { standard: '带肋钢筋', epoxy: '环氧涂层钢筋', cold8: '8 毫米冷轧' },
      grade: { '60': 'Grade 60', '80': 'Grade 80', '40': 'Grade 40' },
      length: { standard: '12 米', epoxy: '长度待确认', cold8: '6 米' },
      schedule: { single: '一次交货', multiple: '分批交货', tbd: '待商议' },
      payment: { cash: '预付现金', lc: '银行信用证（LC）', tbc: '与销售确认' },
      choose: '请选择…', unit: '吨', mm: '毫米',
      f: {
        company: '公司名称', contact: '联系人', email: '电子邮箱', phone: '电话号码', country: '国家', city: '城市',
        project: '项目名称', location: '项目所在地', site: '交货地址', date: '要求交货日期',
        schedule: '交货安排', notes: '项目补充说明', payment: '付款条件',
        type: '产品类型', dia: '直径', gradeF: '牌号', qty: '数量（公吨）', lineDate: '交货日期', lineNotes: '备注', line: '行'
      },
      err: {
        required: '此项为必填项。', email: '请输入有效的电子邮箱，例如 name@company.com。',
        phone: '请输入 7 至 15 位数字的电话号码，可包含空格、+、-、括号。',
        qtyMissing: '请输入数量（公吨）。', qtyFormat: '请用数字并以小数点表示小数，例如 12.5。不接受逗号。',
        qtyPositive: '数量必须大于 0。', qtyDecimals: '最多 3 位小数（1 公斤）。', qtyMax: '数量超过 100,000 吨，请检查。',
        type: '请选择产品类型。', dia: '请选择直径。', gradeE: '请选择牌号。', notOffered: '该产品类型不提供此直径或牌号。',
        date: '请输入有效日期。', past: '日期已过。', tooLong: '文字过长。',
        noLines: '请至少添加一行产品。', maxLines: '最多 50 行产品。', schedule: '请选择交货安排。', payment: '请选择付款条件。'
      },
      warn: {
        duplicate: function (a, b) { return '第 ' + a + ' 行和第 ' + b + ' 行的产品、直径、牌号和交货日期相同。请合并，或添加备注说明区别。'; },
        epoxy: '环氧涂层钢筋：该直径和牌号的供货情况须经销售团队确认。',
        below30: '总量低于 30 吨：可能适用整车运输要求并产生额外运输费用。您仍可发送询价。'
      },
      fix: function (n) { return '预览前有 ' + n + ' 项需要修改。'; },
      sum: {
        lines: '产品行', complete: '已完成', total: '要求数量合计（全部产品）', breakdown: '按产品、直径和牌号分列',
        none: '尚无已完成的产品行。', incomplete: function (n) { return '有 ' + n + ' 行未完成，未计入。'; }
      },
      pv: {
        ref: '询价参考号', refNote: '在您的浏览器中生成，仅用于识别，不是 Al Rajhi Steel 的报价编号。',
        date: '编制日期', customer: '客户', project: '项目', products: '所需产品', delivery: '交货要求', payment: '付款方式偏好',
        notes: '备注', commercial: '商务说明', no: '序号', length: '长度', qty: '数量（吨）', lineNotes: '行备注', notGiven: '未提供',
        total: '要求数量合计', confirm: '供货情况待确认', to: '致', from: '发件方'
      },
      paymentNote: '最终付款条件和产品供货情况须经 Al Rajhi Steel 销售团队确认。',
      transportNote: '数量低于 30 公吨时，可能适用整车运输要求并产生额外运输费用。请与销售团队确认。',
      disclaimer: '本文件仅为询价请求，不构成报价、采购订单、销售合同或产品供货确认。最终价格、规格、付款条件和交货计划须经 Al Rajhi Steel 确认。',
      subject: function (ref, project) { return '询价 ' + ref + '：' + project + ' 项目钢筋'; },
      mailLong: '询价内容过长，无法放入邮件链接，已复制到剪贴板，请粘贴到邮件中。',
      waLong: '询价内容过长，无法放入 WhatsApp 链接。请使用“复制询价文本”后粘贴到 WhatsApp。',
      copied: '询价文本已复制。', copyFail: '无法复制，请选中下方文本手动复制。',
      reviewFirst: '请勾选确认您已检查询价内容。', stale: '预览后表单已更改，请先更新预览再分享。',
      lineRemoved: function (n) { return '已删除第 ' + n + ' 行。'; }, lineAdded: function (n) { return '已添加第 ' + n + ' 行。'; },
      typeChanged: '直径和牌号已清除，因为它们不适用于新的产品类型。请重新选择。'
    }
  };
}));
