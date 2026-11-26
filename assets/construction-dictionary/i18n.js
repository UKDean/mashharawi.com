/* Construction Dictionary: interface text for the script (the static page
   text is in the HTML). One object per page language. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CDictText = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    en: {
      count: function (n, total) { return n === total ? n + (n === 1 ? ' term' : ' terms') : n + ' of ' + total + ' terms'; },
      empty: 'No terms match. Try a shorter word, the same word in another language, or All categories.',
      copied: function (what) { return 'Copied: ' + what; },
      copyFail: 'Could not copy. Select the text and copy it manually.',
      loadFail: 'Search could not be loaded. All terms are listed below.',
      all: 'All', langs: { en: 'English', ar: 'Arabic', zh: 'Chinese' }
    },
    ar: {
      count: function (n, total) { return n === total ? n + ' مصطلحاً' : n + ' من ' + total + ' مصطلحاً'; },
      empty: 'لا توجد مصطلحات مطابقة. جرّب كلمة أقصر، أو نفس الكلمة بلغة أخرى، أو «الكل» في التصنيفات.',
      copied: function (what) { return 'تم النسخ: ' + what; },
      copyFail: 'تعذّر النسخ. حدد النص وانسخه يدوياً.',
      loadFail: 'تعذّر تحميل البحث. جميع المصطلحات معروضة بالأسفل.',
      all: 'الكل', langs: { en: 'الإنجليزية', ar: 'العربية', zh: 'الصينية' }
    },
    zh: {
      count: function (n, total) { return n === total ? '共 ' + n + ' 个术语' : total + ' 个术语中的 ' + n + ' 个'; },
      empty: '没有匹配的术语。请尝试更短的词、用另一种语言输入同一个词，或选择“全部”分类。',
      copied: function (what) { return '已复制：' + what; },
      copyFail: '无法复制，请选中文本后手动复制。',
      loadFail: '搜索加载失败，下方列出全部术语。',
      all: '全部', langs: { en: '英文', ar: '阿拉伯文', zh: '中文' }
    }
  };
}));
