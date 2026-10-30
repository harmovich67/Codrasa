/* Voice capture for the recording studio: one MediaRecorder that can be paused and resumed with the lesson clock. */

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export class VoiceTrack {
  constructor(stream) {
    this.stream = stream;
    const mime = pickMime();
    this.mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
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
