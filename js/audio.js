const fileUrl = (name) => new URL(`../audio/${name}.mp3`, import.meta.url);

const GROUPS = {
  greet: ["meow-greet-1", "meow-greet-2", "meow-greet-3"],
  curious: ["meow-curious-1", "meow-curious-2"],
  hungry: ["meow-hungry-1", "meow-hungry-2"],
  kitten: ["meow-kitten-1", "meow-kitten-2"],
  chatter: ["chatter-1", "chatter-2"],
  chirrup: ["chirrup-1", "chirrup-2"],
  tweet: ["tweet-1", "tweet-2", "tweet-3", "tweet-4", "tweet-5", "tweet-6"],
  song: ["song-1", "song-2"],
  hiss: ["hiss"],
  growl: ["growl"],
  yowl: ["yowl"],
  wing: ["wing"],
};

const NAMES = [
  "music-inside",
  "music-outside",
  "purr",
  "birdsong",
  ...Object.values(GROUPS).flat(),
];

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicVol = 0.32;
    this.musicOn = true;
    this.sfxVol = 0.8;
    this.sfxOn = true;
    this.place = "room";
    this.hidden = false;
    this.ready = false;
    this.loading = null;
    this.buffers = {};
    this.loops = {};
    this.loopStarted = {};
    this.offsets = {};
    this.lastPick = {};
    this.catAt = 0;
    this.purr = null;
    this.purrTarget = 0;
    this.noiseBuffer = null;
  }

  snapshot() {
    return {
      music: this.musicVol,
      musicOn: this.musicOn,
      effects: this.sfxVol,
      effectsOn: this.sfxOn,
    };
  }

  setMix(sound = {}) {
    if (sound.music != null) this.musicVol = clamp01(sound.music);
    if (sound.effects != null) this.sfxVol = clamp01(sound.effects);
    if (sound.musicOn != null) this.musicOn = Boolean(sound.musicOn);
    if (sound.effectsOn != null) this.sfxOn = Boolean(sound.effectsOn);
    this.applyMusic(0.12);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.applyMusic(0.12);
    if (this.muted) this.setPurr(false);
  }

  setPlace(place) {
    this.place = place === "out" ? "out" : "room";
    this.applyMusic(1.8);
  }

  unlock() {
    this.prime();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (!this.loading) this.loading = this.loadAll();
    if (this.ready) this.applyMusic(0.4);
  }

  pauseForHide() {
    this.hidden = true;
    if (!this.ctx) return;
    for (const key of ["room", "out", "bed"]) this.stopLoop(key, true);
    this.setPurr(false);
  }

  resumeFromHide() {
    this.hidden = false;
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.applyMusic(0.6);
  }

  prime() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || this.ctx) return;
    const session = navigator.audioSession;
    if (session) {
      try {
        session.type = "ambient";
      } catch (error) {
        // Older Safari has no audio session. Media playback still follows the silent switch when it can.
      }
    }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.roomGain = this.ctx.createGain();
    this.outGain = this.ctx.createGain();
    this.bedGain = this.ctx.createGain();
    this.roomGain.gain.value = 0;
    this.outGain.gain.value = 0;
    this.bedGain.gain.value = 0;
    this.roomGain.connect(this.master);
    this.outGain.connect(this.master);
    this.bedGain.connect(this.master);
    const silent = this.ctx.createBuffer(1, 8, this.ctx.sampleRate);
    const blip = this.ctx.createBufferSource();
    blip.buffer = silent;
    blip.connect(this.master);
    blip.start();
    this.noiseBuffer = this.makeNoise();
  }

  async loadAll() {
    const entries = await Promise.all(NAMES.map(async (name) => {
      const response = await fetch(fileUrl(name));
      const data = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data.slice(0));
      return [name, buffer];
    }));
    this.buffers = Object.fromEntries(entries);
    this.ready = true;
    this.applyMusic(0.8);
  }

  musicLevel() {
    if (this.muted || !this.musicOn || this.hidden) return 0;
    return this.musicVol * 0.48;
  }

  sfxLevel() {
    if (this.muted || !this.sfxOn) return 0;
    return this.sfxVol;
  }

  applyMusic(seconds) {
    if (!this.ctx || !this.ready || this.hidden) return;
    const level = this.musicLevel();
    const outside = this.place === "out";
    this.ramp(this.roomGain.gain, outside ? 0 : level, seconds);
    this.ramp(this.outGain.gain, outside ? level : 0, seconds);
    this.ramp(this.bedGain.gain, outside ? level * 0.42 : 0, seconds);
    this.ensureLoop("room", "music-inside", this.roomGain);
    this.ensureLoop("out", "music-outside", this.outGain);
    this.ensureLoop("bed", "birdsong", this.bedGain);
  }

  ramp(param, value, seconds) {
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(0.0001, param.value), now);
    param.linearRampToValueAtTime(Math.max(0.0001, value), now + Math.max(0.05, seconds));
  }

  ensureLoop(key, name, gain) {
    if (this.loops[key] || !this.buffers[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.loop = true;
    src.connect(gain);
    const offset = (this.offsets[key] || 0) % src.buffer.duration;
    src.start(this.ctx.currentTime, offset);
    this.loopStarted[key] = this.ctx.currentTime;
    this.loops[key] = src;
  }

  stopLoop(key, remember) {
    const src = this.loops[key];
    if (!src) return;
    if (remember && this.ctx) {
      const elapsed = this.ctx.currentTime - (this.loopStarted[key] || this.ctx.currentTime);
      this.offsets[key] = ((this.offsets[key] || 0) + elapsed) % src.buffer.duration;
    }
    try {
      src.stop();
    } catch (error) {
      // Already stopped.
    }
    this.loops[key] = null;
  }

  play(name, { rate = 1, gain = 1 } = {}) {
    if (!this.ctx || !this.buffers[name] || this.sfxLevel() <= 0) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.playbackRate.value = rate;
    const amp = this.ctx.createGain();
    amp.gain.value = Math.max(0.0001, gain * this.sfxLevel());
    src.connect(amp);
    amp.connect(this.sfxBus);
    src.start();
  }

  pick(group) {
    const list = GROUPS[group] || GROUPS.greet;
    let index = Math.floor(Math.random() * list.length);
    if (list.length > 1 && index === this.lastPick[group]) index = (index + 1) % list.length;
    this.lastPick[group] = index;
    return list[index];
  }

  vary(center = 1) {
    return center * (0.96 + Math.random() * 0.08);
  }

  catVoice(group, gain = 0.9, rate) {
    const now = performance.now();
    if (now - this.catAt < 240) return;
    this.catAt = now;
    this.play(this.pick(group), { rate: rate || this.vary(), gain });
  }

  meow(kind = "greet") {
    const group = GROUPS[kind] ? kind : "greet";
    this.catVoice(group, group === "kitten" ? 0.7 : 0.9);
  }

  mrrp() {
    this.catVoice("chirrup", 0.65, this.vary(1.04));
  }

  chirp() {
    this.catVoice("chatter", 0.72);
  }

  tweet(pitch = 1) {
    this.play(this.pick("tweet"), { rate: this.vary(0.9 + pitch * 0.18), gain: 0.62 });
  }

  song() {
    this.play(this.pick("song"), { rate: this.vary(0.98), gain: 0.55 });
  }

  wing() {
    this.play("wing", { rate: this.vary(1), gain: 0.45 });
  }

  hiss() {
    this.catVoice("hiss", 0.8, this.vary(1));
  }

  growl() {
    this.catVoice("growl", 0.85);
  }

  yowl() {
    this.catVoice("yowl", 0.8);
  }

  annoyed() {
    const now = performance.now();
    if (now - (this.annoyAt || 0) < 1400) return;
    this.annoyAt = now;
    const roll = Math.random();
    if (roll < 0.45) this.hiss();
    else if (roll < 0.8) this.growl();
    else this.yowl();
  }

  setPurr(on, amount = 1) {
    if (!this.ctx || !this.buffers.purr) return;
    const target = on && this.sfxLevel() > 0 ? this.sfxLevel() * 0.5 * amount : 0;
    if (this.purr && Math.abs(target - this.purrTarget) < 0.025) return;
    this.purrTarget = target;
    if (!this.purr && target > 0.001) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.purr;
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(gain);
      gain.connect(this.sfxBus);
      src.start();
      this.purr = { src, gain };
    }
    if (!this.purr) return;
    const now = this.ctx.currentTime;
    const param = this.purr.gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(0.0001, param.value), now);
    param.linearRampToValueAtTime(Math.max(0.0001, target), now + (target > 0.001 ? 0.7 : 0.45));
    if (target <= 0.001) {
      const old = this.purr;
      this.purr = null;
      old.src.stop(now + 0.5);
    }
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
    gain.connect(this.sfxBus);
    const level = Math.max(0.0001, peak * (this.sfxLevel() || 0.0001));
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    return { gain, t };
  }

  noiseBurst(duration, freq, peak) {
    if (!this.ctx || !this.noiseBuffer || this.sfxLevel() <= 0) return;
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

  scratch() {
    if (!this.ctx) return;
    this.noiseBurst(0.07, 2100, 0.055);
    this.noiseBurst(0.05, 1400, 0.03);
  }

  pop() {
    if (!this.ctx || this.sfxLevel() <= 0) return;
    this.tone({ type: "sine", f0: 220, f1: 90, duration: 0.09, peak: 0.08 });
    this.noiseBurst(0.08, 900, 0.05);
  }

  rustle() {
    if (!this.ctx) return;
    this.noiseBurst(0.18, 500, 0.06);
  }

  tone({ type, f0, f1, f2, duration, peak, delay = 0 }) {
    if (!this.ctx || this.sfxLevel() <= 0) return;
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
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
