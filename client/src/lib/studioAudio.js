/* Voice capture for the recording studio: one MediaRecorder that can be paused and resumed with the lesson clock. */

import { api } from './api.js';

// Speech needs far less than the browser's default (~128 kbps): 32 kbps keeps a 20-minute lesson near 5 MB.
const VOICE_BITRATE = 32000;

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export class VoiceTrack {
  constructor(stream) {
    this.stream = stream;
    const mime = pickMime();
    this.mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: VOICE_BITRATE });
    this.chunks = [];
    this.mr.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
  }

  static async open() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    return new VoiceTrack(stream);
  }

  // Resolves when capture really begins, so the caller can start the lesson clock at the same instant.
  start() {
    return new Promise((resolve) => {
      this.mr.onstart = resolve;
      this.mr.start(1000);
    });
  }

  // Paused time is left out of the audio, exactly like it is left out of the lesson clock.
  pause() {
    if (this.mr.state === 'recording') this.mr.pause();
  }

  resume() {
    if (this.mr.state === 'paused') this.mr.resume();
  }

  stop() {
    return new Promise((resolve) => {
      this.mr.onstop = () => {
        this.release();
        resolve(new Blob(this.chunks, { type: this.mr.mimeType || 'audio/webm' }));
      };
      if (this.mr.state === 'inactive') this.mr.onstop();
      else this.mr.stop();
    });
  }

  release() {
    this.stream.getTracks().forEach((t) => t.stop());
  }
}

// A serverless request body is capped at 4.5 MB, so the voice goes up in 3 MB pieces.
const CHUNK = 3 * 1024 * 1024;

async function withRetry(fn, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries || (err.status && err.status < 500 && err.status !== 429)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500 * i));
    }
  }
}

/* Uploads a recorded voice blob as a lesson's voice (replace) or as one more sitting's voice (append: true). */
export async function uploadVoice(lessonId, blob, { append = false, start = 0, dur = 0, onProgress } = {}) {
  const { file } = await withRetry(() => api.post(`/lessons/${lessonId}/audio/begin`));
  const total = Math.max(1, Math.ceil(blob.size / CHUNK));
  for (let i = 0; i < total; i++) {
    const piece = blob.slice(i * CHUNK, (i + 1) * CHUNK);
    await withRetry(() => api.putBlob(`/lessons/${lessonId}/audio/chunk?file=${encodeURIComponent(file)}&i=${i}`, piece));
    onProgress?.((i + 1) / total);
  }
  return withRetry(() => api.post(`/lessons/${lessonId}/audio/complete`, { file, total, append, start, dur }));
}
