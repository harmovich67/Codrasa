import { toast } from '../store/toast.js';

/*
 * Two sandboxes for lesson JavaScript:
 *  - Web Worker: plain logic. No DOM, and infinite loops are killed by a timeout.
 *  - Sandboxed iframe: code that touches browser APIs (alert, prompt, document, ...). Dialogs are
 *    real and also echoed to the output so recorded runs replay them for students.
 * runJavaScript() picks the right one automatically.
 */

const WORKER_SOURCE = `
const fmt = (v) => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.name + ': ' + v.message;
  try { const s = JSON.stringify(v, null, 2); return s === undefined ? String(v) : s; } catch { return String(v); }
};
const send = (type, args) => postMessage({ type, text: args.map(fmt).join(' ') });
console.log = (...a) => send('log', a);
console.info = (...a) => send('log', a);
console.debug = (...a) => send('log', a);
console.warn = (...a) => send('warn', a);
console.error = (...a) => send('error', a);
console.table = (d) => send('log', [d]);
self.addEventListener('unhandledrejection', (e) => send('error', ['Uncaught (in promise) ' + fmt(e.reason)]));
self.onerror = (msg) => { send('error', [String(msg)]); return true; };
self.onmessage = async (e) => {
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(e.data)();
  } catch (err) {
    postMessage({ type: 'error', text: (err && err.name ? err.name + ': ' + err.message : String(err)) });
  }
  postMessage({ type: 'done' });
};
`;

let workerUrl = null;

function runInWorker(code, { timeout = 4000, grace = 400 } = {}) {
  workerUrl ||= URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
  return new Promise((resolve) => {
    const worker = new Worker(workerUrl);
    const lines = [];
    const started = performance.now();
    let finished = false;
    let graceTimer;

    const finish = (timedOut = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(hardTimer);
      clearTimeout(graceTimer);
      worker.terminate();
      if (timedOut) lines.push({ type: 'error', text: `⏱ توقف التنفيذ بعد ${timeout / 1000} ثوانٍ (حلقة لا نهائية؟)` });
      resolve({ lines, error: lines.some((l) => l.type === 'error'), ms: Math.round(performance.now() - started) });
    };

    const hardTimer = setTimeout(() => finish(true), timeout);
    worker.onmessage = ({ data }) => {
      if (data.type === 'done') {
        // Give pending setTimeout/promise callbacks a moment to print.
        graceTimer = setTimeout(() => finish(false), grace);
        return;
      }
      if (lines.length < 500) lines.push(data);
    };
    worker.onerror = (e) => {
      e.preventDefault();
      lines.push({ type: 'error', text: e.message || 'SyntaxError' });
      finish(false);
    };
    worker.postMessage(code);
  });
}

const frameDoc = (id) => `<!doctype html><html><body><script>
const ID = ${JSON.stringify(id)};
const fmt = (v) => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.name + ': ' + v.message;
  try { const s = JSON.stringify(v, null, 2); return s === undefined ? String(v) : s; } catch { return String(v); }
};
const send = (type, text) => parent.postMessage({ id: ID, type, text }, '*');
const out = (type) => (...a) => send(type, a.map(fmt).join(' '));
console.log = console.info = console.debug = out('log');
console.warn = out('warn');
console.error = out('error');
console.table = (d) => send('log', fmt(d));

// Native dialogs stay (so prompt() can really return input); each is also echoed to the output.
const nativeAlert = window.alert.bind(window);
const nativePrompt = window.prompt.bind(window);
const nativeConfirm = window.confirm.bind(window);
window.alert = (m) => { send('dialog', '🔔 alert: ' + fmt(m)); nativeAlert(m === undefined ? '' : String(m)); };
window.confirm = (m) => { send('dialog', ''); const r = nativeConfirm(m === undefined ? '' : String(m)); send('log', '❓ confirm: ' + fmt(m) + ' → ' + r); return r; };
window.prompt = (m, d) => { send('dialog', ''); const r = nativePrompt(m === undefined ? '' : String(m), d === undefined ? '' : String(d)); send('log', '⌨️ prompt: ' + fmt(m) + ' → ' + JSON.stringify(r)); return r; };

// document.write after load would wipe this page (and our listeners), so append instead.
document.write = document.writeln = (...h) => document.body.insertAdjacentHTML('beforeend', h.join(''));

window.addEventListener('error', (e) => { send('error', (e.error && e.error.name ? e.error.name + ': ' + e.error.message : e.message)); e.preventDefault(); });
window.addEventListener('unhandledrejection', (e) => send('error', 'Uncaught (in promise) ' + fmt(e.reason)));
window.addEventListener('message', async (e) => {
  if (e.source !== parent || !e.data || e.data.kind !== 'run') return;
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(e.data.code)();
  } catch (err) {
    send('error', err && err.name ? err.name + ': ' + err.message : String(err));
  }
  parent.postMessage({ id: ID, type: 'done', body: (document.body.innerText || '').trim() }, '*');
});
</script></body></html>`;

function runInFrame(code, { timeout = 4000, grace = 400 } = {}) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const frame = document.createElement('iframe');
    // No allow-same-origin: the code can't touch the app, its cookies or its token.
    frame.setAttribute('sandbox', 'allow-scripts allow-modals');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
    const lines = [];
    const started = performance.now();
    let finished = false;
    let hardTimer;
    let graceTimer;

    const finish = (timedOut = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(hardTimer);
      clearTimeout(graceTimer);
      window.removeEventListener('message', onMessage);
      frame.remove();
      if (timedOut) lines.push({ type: 'error', text: `⏱ توقف التنفيذ بعد ${timeout / 1000} ثوانٍ` });
      resolve({ lines, error: lines.some((l) => l.type === 'error'), ms: Math.round(performance.now() - started) });
    };

    function onMessage(e) {
      if (e.source !== frame.contentWindow || e.data?.id !== id) return;
      const { type, text, body } = e.data;
      if (type === 'dialog') {
        // The user may sit on a dialog for a while — stop the clock.
        clearTimeout(hardTimer);
        hardTimer = setTimeout(() => finish(true), 10 * 60 * 1000);
        if (text && lines.length < 500) lines.push({ type: 'log', text });
      } else if (type === 'done') {
        if (body) lines.push({ type: 'log', text: `📄 document: ${body}` });
        graceTimer = setTimeout(() => finish(false), grace);
      } else if (lines.length < 500) {
        lines.push({ type, text });
      }
    }

    window.addEventListener('message', onMessage);
    hardTimer = setTimeout(() => finish(true), timeout);
    frame.onload = () => frame.contentWindow.postMessage({ kind: 'run', code }, '*');
    frame.srcdoc = frameDoc(id);
    document.body.appendChild(frame);
  });
}

const BROWSER_API = /\b(alert|prompt|confirm|document|window|localStorage|sessionStorage|history|addEventListener|requestAnimationFrame)\b/;
const BROWSER_REF_ERROR = /ReferenceError: (alert|prompt|confirm|document|window|localStorage|sessionStorage|history|requestAnimationFrame) is not defined/;
const COMMENTS_AND_STRINGS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g;

export const needsBrowser = (code) => BROWSER_API.test(code.replace(COMMENTS_AND_STRINGS, ''));

export async function runJavaScript(code, options) {
  if (needsBrowser(code)) return runInFrame(code, options);
  const res = await runInWorker(code, options);
  // Safety net for usage the scan above can't see (e.g. inside template literals).
  if (res.error && res.lines.some((l) => BROWSER_REF_ERROR.test(l.text))) return runInFrame(code, options);
  return res;
}

// Console lines → the plain text a challenge is graded on (the teacher's expected output is captured the same way).
export const outputText = (lines = []) => lines.map((line) => line.text).join('\n');

/*
 * Python runs in the browser through Pyodide (CPython compiled to WebAssembly), inside a Worker that is
 * kept alive between runs because the first load downloads ~10MB. A runaway program is killed after
 * `timeout` and the worker is rebuilt on the next run.
 */
const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

const PY_WORKER_SOURCE = `
let pyodide = null;
const ready = (async () => {
  importScripts('${PYODIDE_BASE}pyodide.js');
  pyodide = await loadPyodide({ indexURL: '${PYODIDE_BASE}' });
})();
ready.then(() => postMessage({ type: 'ready' }), (err) => postMessage({ type: 'fatal', text: 'تعذّر تحميل Python: ' + err }));
self.onmessage = async (e) => {
  const { id, code } = e.data;
  try { await ready; } catch { return; }
  const send = (type, text) => postMessage({ id, type, text });
  pyodide.setStdout({ batched: (s) => send('log', s) });
  pyodide.setStderr({ batched: (s) => send('warn', s) });
  pyodide.setStdin({ stdin: () => null });
  const globals = pyodide.globals.get('dict')();
  try {
    await pyodide.runPythonAsync(code, { globals });
  } catch (err) {
    // Keep the traceback from the user's own frame down; Pyodide's internal frames are noise.
    const all = String(err.message || err).trim().split('\\n');
    const at = all.findIndex((l) => l.includes('File "<exec>"'));
    const lines = (at > 0 ? [all[0], ...all.slice(at)] : all).map((l) => l.replace('"<exec>"', '"main.py"'));
    send('error', lines.join('\\n'));
  } finally {
    globals.destroy();
  }
  postMessage({ id, type: 'done' });
};
`;

let pyWorker = null;
let pyReady = null;
let pyRun = 0;

function pythonWorker() {
  if (pyWorker) return pyWorker;
  toast.info('بنحمّل Python لأول مرة… حوالي 10 ثواني ومرة واحدة بس');
  const url = URL.createObjectURL(new Blob([PY_WORKER_SOURCE], { type: 'text/javascript' }));
  pyWorker = new Worker(url);
  pyReady = new Promise((resolve, reject) => {
    const onMsg = ({ data }) => {
      if (data.type === 'ready') resolve();
      else if (data.type === 'fatal') reject(new Error(data.text));
      else return;
      pyWorker?.removeEventListener('message', onMsg);
    };
    pyWorker.addEventListener('message', onMsg);
  });
  pyReady.catch(() => {
    pyWorker?.terminate();
    pyWorker = null;
  });
  return pyWorker;
}

export async function runPython(code, { timeout = 5000, loadTimeout = 90000 } = {}) {
  const started = performance.now();
  const lines = [];
  const worker = pythonWorker();
  const loadTimer = new Promise((resolve) => setTimeout(() => resolve('timeout'), loadTimeout));
  try {
    if ((await Promise.race([pyReady, loadTimer])) === 'timeout') throw new Error('تحميل Python أخد وقت طويل — اتأكد من النت وجرّب تاني');
  } catch (err) {
    return { lines: [{ type: 'error', text: String(err.message || err) }], error: true, ms: Math.round(performance.now() - started) };
  }
  const id = ++pyRun;
  const runStarted = performance.now();
  return new Promise((resolve) => {
    let finished = false;
    const finish = (timedOut = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.removeEventListener('message', onMsg);
      if (timedOut) {
        worker.terminate();
        if (pyWorker === worker) pyWorker = null;
        lines.push({ type: 'error', text: `⏱ توقف التنفيذ بعد ${timeout / 1000} ثوانٍ (حلقة لا نهائية؟)` });
      }
      resolve({ lines, error: lines.some((l) => l.type === 'error'), ms: Math.round(performance.now() - runStarted) });
    };
    const timer = setTimeout(() => finish(true), timeout);
    function onMsg({ data }) {
      if (data.id !== id) return;
      if (data.type === 'done') finish();
      else if (lines.length < 500) lines.push({ type: data.type, text: data.text });
    }
    worker.addEventListener('message', onMsg);
    worker.postMessage({ id, code });
  });
}

// One entry point for every language the browser can run.
export const runCode = (language, code, options) => (language === 'python' ? runPython(code, options) : runJavaScript(code, options));
