const MUSIC = new Set(["music-inside", "music-outside"]);
const PURR_LOOP = "13_purr_loop_12s";
const PURR_TAKE = "14_purr_long_whiskers";
const BIRDSONG = "25_birdsong_ambient";

const fileUrl = (name) => new URL(
  MUSIC.has(name) ? `../../audio/${name}.mp3` : `../../audio/real/${name}.mp3`,
  import.meta.url,
);

const GROUPS = {
  greet: [
    "11_kitten_mew_1",
    "12_kitten_mew_2",
    "11_kitten_mew_1",
    "12_kitten_mew_2",
    "01_meow_greeting_short",
    "02_meow_greeting_soft",
    "03_meow_greeting_clear",
  ],
  curious: ["04_meow_curious_short", "06_meow_siamese", "02_meow_greeting_soft"],
  hungry: ["07_meow_food", "08_meow_with_purr", "09_meow_hungry_pleading", "10_meow_whiney_pleading"],
  kitten: ["11_kitten_mew_1", "12_kitten_mew_2"],
  chatter: ["11_kitten_mew_1", "12_kitten_mew_2", "04_meow_curious_short"],
  chirrup: ["11_kitten_mew_1", "12_kitten_mew_2", "01_meow_greeting_short"],
  tweet: ["23_bird_chirps_short", "24_bird_tweets"],
  song: ["24_bird_tweets", "23_bird_chirps_short"],
  hiss: ["15_hiss", "16_hiss_short", "17_hiss_close", "18_hiss_spit"],
  growl: ["19_growl_short"],
  yowl: ["20_yowl_short", "21_yowl_attack"],
  wing: ["23_bird_chirps_short"],
};

const NAMES = [
  "music-inside",
  "music-outside",
  PURR_LOOP,
  PURR_TAKE,
  BIRDSONG,
  ...new Set(Object.values(GROUPS).flat()),
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
    this.purrWanted = false;
    this.failed = new Set();
    this.purrSeam = null;
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
      try {
        const response = await fetch(fileUrl(name));
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.arrayBuffer();
        let buffer = await this.ctx.decodeAudioData(data.slice(0));
        if (name === PURR_LOOP) {
          const seamed = seamLoop(this.ctx, buffer);
          buffer = seamed.buffer;
          this.purrSeam = seamed.edge;
        }
        return [name, buffer];
      } catch (error) {
        this.failed.add(name);
        console.warn("Sunbeam could not load", name);
        return [name, null];
      }
    }));
    this.buffers = Object.fromEntries(entries.filter((entry) => entry[1]));
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
    this.ensureLoop("bed", BIRDSONG, this.bedGain);
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
    if (!this.ctx || this.sfxLevel() <= 0) return null;
    const buffer = this.buffers[name];
    if (!buffer) {
      if (this.failed.has(name)) this.fallbackVoice();
      return null;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const amp = this.ctx.createGain();
    const level = gain * this.sfxLevel() * (0.86 + Math.random() * 0.22);
    amp.gain.value = Math.max(0.0001, level);
    src.connect(amp);
    amp.connect(this.sfxBus);
    src.start();
    return src;
  }

  fallbackVoice() {
    this.tone({ type: "sine", f0: 520, f1: 360, f2: 440, duration: 0.22, peak: 0.04 });
  }

  pick(group) {
    const list = GROUPS[group] || GROUPS.greet;
    let index = Math.floor(Math.random() * list.length);
    if (list.length > 1 && index === this.lastPick[group]) index = (index + 1) % list.length;
    this.lastPick[group] = index;
    return list[index];
  }

  vary(center = 1) {
    return center * (0.94 + Math.random() * 0.12);
  }

  catVoice(group, gain = 0.9, rate) {
    const now = performance.now();
    if (now - this.catAt < 240) return;
    this.catAt = now;
    this.play(this.pick(group), { rate: rate || this.vary(), gain });
  }

  meow(kind = "kitten") {
    const group = kind === "greet" || !GROUPS[kind] ? "greet" : kind;
    this.catVoice(group, group === "kitten" || group === "greet" ? 0.62 : 0.7);
  }

  mrrp() {
    this.catVoice("chirrup", 0.65, this.vary(1.04));
  }

  chirp() {
    this.catVoice("chatter", 0.72);
  }

  tweet() {
    this.play(this.pick("tweet"), { rate: this.vary(), gain: 0.55 });
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
    this.purrWanted = Boolean(on);
    this.purrAmount = amount;
    if (!this.ctx || !this.buffers[PURR_LOOP]) {
      if (on && this.failed.has(PURR_LOOP)) this.fallbackVoice();
      return;
    }
    const target = on && this.sfxLevel() > 0 ? this.sfxLevel() * 0.46 * amount : 0;
    if (this.purr && Math.abs(target - this.purrTarget) < 0.025) return;
    this.purrTarget = target;
    if (!this.purr && target > 0.001) {
      if (Math.random() < 0.3 && this.buffers[PURR_TAKE]) this.startPurrTake(target);
      else this.startPurrLoop(target);
      return;
    }
    this.fadePurr(target);
  }

  startPurrLoop(target) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[PURR_LOOP];
    src.loop = true;
    src.playbackRate.value = this.vary();
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(gain);
    gain.connect(this.sfxBus);
    src.start();
    this.purr = { src, gain, loop: true };
    this.fadePurr(target);
  }

  startPurrTake(target) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[PURR_TAKE];
    src.playbackRate.value = this.vary();
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(gain);
    gain.connect(this.sfxBus);
    const voice = { src, gain, loop: false };
    src.onended = () => {
      if (this.purr !== voice) return;
      this.purr = null;
      if (this.purrWanted) this.startPurrLoop(this.purrTarget || target);
    };
    src.start();
    this.purr = voice;
    this.fadePurr(target);
  }

  fadePurr(target) {
    if (!this.purr) return;
    const now = this.ctx.currentTime;
    const param = this.purr.gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(0.0001, param.value), now);
    param.linearRampToValueAtTime(Math.max(0.0001, target), now + (target > 0.001 ? 0.7 : 0.45));
    if (target <= 0.001) {
      const old = this.purr;
      this.purr = null;
      this.purrWanted = false;
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

function seamLoop(ctx, buffer) {
  const rate = buffer.sampleRate;
  const fade = Math.min(Math.floor(0.08 * rate), Math.floor(buffer.length / 8));
  const src = buffer.getChannelData(0);
  const outLen = src.length - fade;
  const out = ctx.createBuffer(1, outLen, rate);
  const dst = out.getChannelData(0);
  dst.set(src.subarray(0, outLen));
  for (let i = 0; i < fade; i++) {
    const t = i / Math.max(1, fade - 1);
    const keepTail = Math.cos(t * Math.PI / 2);
    const bringHead = Math.sin(t * Math.PI / 2);
    dst[i] = src[src.length - fade + i] * keepTail + src[i] * bringHead;
  }
  const edge = Math.abs(dst[0] - dst[outLen - 1]);
  return { buffer: out, edge };
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
