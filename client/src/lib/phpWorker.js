import './phpShim.js';

let phpInstance = null;

const ready = (async () => {
  const { PhpWeb } = await import('php-wasm/PhpWeb.mjs');
  const php = new PhpWeb();
  await php.binary;
  phpInstance = php;
  return php;
})();

ready.then(
  () => self.postMessage({ type: 'ready' }),
  (err) => self.postMessage({ type: 'fatal', text: 'تعذّر تحميل PHP: ' + (err?.message || err) })
);

self.onmessage = async (e) => {
  const { id, code } = e.data;
  try {
    await ready;
  } catch {
    return;
  }
  const send = (type, text) => self.postMessage({ id, type, text });

  let hasError = false;

  const onOutput = (event) => {
    const texts = event.detail;
    const list = Array.isArray(texts) ? texts : [texts];
    for (const item of list) {
      if (item !== undefined && item !== null && item !== '') {
        const clean = String(item).replace(/\r?\n$/, '');
        for (const line of clean.split('\n')) {
          send('log', line);
        }
      }
    }
  };

  const onError = (event) => {
    hasError = true;
    const texts = event.detail;
    const list = Array.isArray(texts) ? texts : [texts];
    for (const item of list) {
      if (item !== undefined && item !== null && item !== '') {
        const clean = String(item).replace(/\r?\n$/, '');
        for (const line of clean.split('\n')) {
          send('error', line);
        }
      }
    }
  };

  phpInstance.addEventListener('output', onOutput);
  phpInstance.addEventListener('error', onError);

  try {
    let runCode = (code || '').trim();
    if (!runCode.startsWith('<?php') && !runCode.startsWith('<?')) {
      runCode = `<?php\n${runCode}`;
    }
    const exitCode = await phpInstance.run(runCode);
    if (exitCode !== 0 && exitCode !== undefined && exitCode !== null && !hasError) {
      send('error', `انتهى البرنامج برمز خروج ${exitCode}`);
    }
  } catch (err) {
    send('error', String(err.message || err));
  } finally {
    phpInstance.removeEventListener('output', onOutput);
    phpInstance.removeEventListener('error', onError);
    self.postMessage({ id, type: 'done' });
  }
};
