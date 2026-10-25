// Mirrors client/src/lib/recording.js — just enough to rebuild code server-side for AI context.

export function applyChanges(code, changes) {
  const sorted = [...changes].sort((a, b) => b[0] - a[0]);
  for (const [offset, length, text] of sorted) {
    code = code.slice(0, offset) + text + code.slice(offset + length);
  }
  return code;
}

export function codeAt(recording, t = Infinity) {
  if (!recording) return '';
  let code = recording.initialCode || '';
  for (const ev of recording.events || []) {
    if (ev.t > t) break;
    if (ev.k === 'e') code = applyChanges(code, ev.c);
  }
  return code;
}
