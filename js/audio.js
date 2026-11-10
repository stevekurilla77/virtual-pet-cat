export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.purr = null;
    this.muted = false;
    this.noiseBuffer = null;
  }

  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.9;
  }

  makeNoise() {
    const length = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.82 + white * 0.18;
      data[i] = last;
    }
    return buffer;
  }

  envGain(duration, peak) {
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.connect(this.master);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    return { gain, t };
  }

  tone({ type, f0, f1, f2, duration, peak, delay = 0 }) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const { gain, t } = this.envGain(duration, peak);
    const start = t + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1) osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), start + duration * 0.55);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(40, f2), start + duration);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  meow() {
    if (!this.ctx) return;
    const wobble = 0.92 + Math.random() * 0.16;
    this.tone({
      type: "triangle",
      f0: 620 * wobble,
      f1: 280 * wobble,
      f2: 460 * wobble,
      duration: 0.34,
      peak: 0.13,
    });
    this.tone({
      type: "sine",
      f0: 880 * wobble,
      f1: 420 * wobble,
      f2: 640 * wobble,
      duration: 0.3,
      peak: 0.04,
    });
  }

  mrrp() {
    if (!this.ctx) return;
    this.tone({ type: "sine", f0: 520, f1: 360, f2: 540, duration: 0.18, peak: 0.07 });
  }

  chirp() {
    if (!this.ctx) return;
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      this.tone({
        type: "square",
        f0: 780 + i * 55,
        f1: 1100 + i * 40,
        duration: 0.045,
        peak: 0.035,
        delay: i * 0.07,
      });
    }
  }

  tweet(pitch = 1) {
    if (!this.ctx) return;
    const base = (1700 + Math.random() * 700) * pitch;
    this.tone({
      type: "sine",
      f0: base,
      f1: base * 1.35,
      f2: base * 0.85,
      duration: 0.16,
      peak: 0.05,
    });
    this.tone({
      type: "triangle",
      f0: base * 1.5,
      f1: base * 1.2,
      duration: 0.1,
      peak: 0.02,
      delay: 0.04,
    });
  }

  pop() {
    if (!this.ctx) return;
    this.tone({ type: "sine", f0: 220, f1: 90, duration: 0.09, peak: 0.08 });
    this.noiseBurst(0.08, 900, 0.05);
  }

  rustle() {
    if (!this.ctx) return;
    this.noiseBurst(0.18, 500, 0.06);
  }

  noiseBurst(duration, freq, peak) {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const { gain, t } = this.envGain(duration, peak);
    src.connect(filter);
    filter.connect(gain);
    src.start(t);
    src.stop(t + duration);
  }

  setPurr(on) {
    if (!this.ctx) return;
    if (on) {
      if (this.purr) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 240;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 26;
      const depth = this.ctx.createGain();
      depth.gain.value = 0.045;
      lfo.connect(depth);
      depth.connect(gain.gain);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
      lfo.start();
      const t = this.ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.12);
      this.purr = { src, lfo, gain };
      return;
    }
    if (!this.purr) return;
    const { src, lfo, gain } = this.purr;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.stop(t + 0.2);
    lfo.stop(t + 0.2);
    this.purr = null;
  }
}
