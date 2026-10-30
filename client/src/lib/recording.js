/*
 * A "living lesson" is not a video. It is the editor's own event stream:
 *   { v, language, initialCode, duration, events: [...] }
 * events (t = ms from start):
 *   { t, k: 'e', c: [[offset, length, text], ...] }   edit (Monaco content change)
 *   { t, k: 'c', p: [line, column] }                  cursor move
 *   { t, k: 'r', o: [{ type, text }], x: bool }       code run + its console output
 */

export function applyChanges(code, changes) {
  // Offsets in one Monaco change event refer to the pre-change text, so apply from the end.
  const sorted = [...changes].sort((a, b) => b[0] - a[0]);
  for (const [offset, length, text] of sorted) {
    code = code.slice(0, offset) + text + code.slice(offset + length);
  }
  return code;
}

export class LessonRecorder {
  // `base` = an existing recording to continue: new events are appended after its last moment.
  constructor(editor, language, base = null) {
    this.editor = editor;
    this.language = language;
    this.base = base;
    this.events = [];
    this.subs = [];
    this.t0 = 0;
    this.pausedAt = null;
  }

  now() {
    return Math.round((this.pausedAt ?? performance.now()) - this.t0);
  }

  start() {
    // Back-date the clock by the old duration so a continued recording picks up where it ended.
    this.t0 = performance.now() - (this.base?.duration || 0);
    // Change offsets are only meaningful against one fixed line ending, so pin it before capturing anything.
    this.editor.getModel()?.setEOL(0); // 0 = EndOfLineSequence.LF
    this.initialCode = this.base ? this.base.initialCode : this.editor.getValue();
    this.events = this.base ? [...this.base.events] : [];
    const pos = this.editor.getPosition();
    if (pos) this.events.push({ t: this.now(), k: 'c', p: [pos.lineNumber, pos.column] });

    this.subs.push(
      this.editor.onDidChangeModelContent((e) => {
        if (this.pausedAt !== null) return;
        this.events.push({ t: this.now(), k: 'e', c: e.changes.map((ch) => [ch.rangeOffset, ch.rangeLength, ch.text]) });
      }),
      this.editor.onDidChangeCursorPosition((e) => {
        if (this.pausedAt !== null) return;
        const last = this.events.at(-1);
        const p = [e.position.lineNumber, e.position.column];
        if (last?.k === 'c' && last.p[0] === p[0] && last.p[1] === p[1]) return;
        this.events.push({ t: this.now(), k: 'c', p });
      }),
    );
  }

  // Paused time is cut out of the lesson: the clock stops and nothing is captured until resume().
  pause() {
    if (this.pausedAt === null) this.pausedAt = performance.now();
  }

  resume() {
    if (this.pausedAt === null) return;
    this.t0 += performance.now() - this.pausedAt;
    this.pausedAt = null;
  }

  markRun(lines, isError) {
    if (this.pausedAt !== null) return;
    this.events.push({ t: this.now(), k: 'r', o: lines.slice(0, 200), x: !!isError });
  }

  stop() {
    this.subs.forEach((s) => s.dispose());
    this.subs = [];
    return { v: 1, language: this.language, initialCode: this.initialCode, duration: this.now(), events: this.events };
  }
}

function lastIndexAtOrBefore(arr, t) {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const KEYFRAME_EVERY = 50;

// Precomputes keyframes so seeking anywhere in a long lesson stays cheap.
export function createTimeline(rec) {
  const events = rec?.events || [];
  const edits = events.filter((e) => e.k === 'e');
  const cursors = events.filter((e) => e.k === 'c');
  const runs = events.filter((e) => e.k === 'r');

  const keyframes = [rec?.initialCode || ''];
  let code = keyframes[0];
  edits.forEach((e, i) => {
    code = applyChanges(code, e.c);
    if ((i + 1) % KEYFRAME_EVERY === 0) keyframes.push(code);
  });

  function codeAt(t) {
    const i = lastIndexAtOrBefore(edits, t);
    if (i < 0) return keyframes[0];
    const k = Math.floor((i + 1) / KEYFRAME_EVERY);
    let c = keyframes[k];
    for (let j = k * KEYFRAME_EVERY; j <= i; j++) c = applyChanges(c, edits[j].c);
    return c;
  }

  function cursorAt(t) {
    const i = lastIndexAtOrBefore(cursors, t);
    return i < 0 ? null : cursors[i].p;
  }

  function runAt(t) {
    const i = lastIndexAtOrBefore(runs, t);
    return i < 0 ? null : runs[i];
  }

  // Typing density per bucket, drawn under the scrubber as an "activity waveform".
  function activity(buckets = 120) {
    const duration = Math.max(1, rec?.duration || 1);
    const out = new Array(buckets).fill(0);
    for (const e of edits) out[Math.min(buckets - 1, Math.floor((e.t / duration) * buckets))] += 1;
    const max = Math.max(1, ...out);
    return out.map((n) => n / max);
  }

  return { duration: rec?.duration || 0, codeAt, cursorAt, runAt, runs, activity, finalCode: code };
}
