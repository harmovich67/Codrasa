export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', runnable: true },
  { id: 'html', label: 'HTML', preview: true },
  { id: 'css', label: 'CSS' },
  { id: 'python', label: 'Python', runnable: true },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'php', label: 'PHP', runnable: true },
  { id: 'sql', label: 'SQL' },
  { id: 'json', label: 'JSON' },
  { id: 'markdown', label: 'Markdown' },
];

export const langInfo = (id) => LANGUAGES.find((l) => l.id === id) || { id, label: id };

export const STARTERS = {
  javascript: "// اكتب الكود هنا واضغط Ctrl+Enter للتشغيل\nconsole.log('أهلًا من Codrasa!');\n",
  python: "# اكتب الكود هنا واضغط Ctrl+Enter للتشغيل\nprint('أهلًا من Codrasa!')\n",
  php: "<?php\n// اكتب الكود هنا واضغط Ctrl+Enter للتشغيل\necho \"أهلًا من Codrasa!\\n\";\n",
  // HTML starts empty on purpose: typing \"!\" or \"html5\" builds the whole skeleton (see editorSetup.js).
  html: '',
};

export const HINTS = {
  html: 'اكتب ! أو html5 واضغط Tab لبناء هيكل الصفحة فورًا. جرّب كمان Emmet: ul>li*3 أو div.box>h1+p ثم Tab. وسم الإغلاق بيتكتب لوحده.',
  css: 'اكتب flexc أو grid أو media واضغط Tab. Emmet شغال: df، w100، m10.',
  javascript: 'اكتب log أو fn أو for أو fetch واضغط Tab لتوليد الكود. الاقتراحات بتظهر وانت بتكتب.',
  typescript: 'اكتب log أو fn أو class واضغط Tab لتوليد الكود.',
  python: 'اكتب def أو forr أو main أو print واضغط Tab لتوليد الكود.',
  java: 'اكتب main أو sout أو for واضغط Tab لتوليد الكود.',
  cpp: 'اكتب main أو cout أو for واضغط Tab لتوليد الكود.',
  csharp: 'اكتب main أو cw أو for واضغط Tab لتوليد الكود.',
  php: 'اكتب php أو echo أو foreach واضغط Tab لتوليد الكود.',
  sql: 'اكتب select أو insert أو join واضغط Tab لتوليد الاستعلام.',
};
