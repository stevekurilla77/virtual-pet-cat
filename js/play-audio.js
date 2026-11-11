const MUSIC = new Set([
  "music-inside", "music-outside", "music-living", "music-porch",
  "music-yard", "music-neighbor", "music-sting", "music-fanfare", "music-hurt",
]);

const CLIPS = {
  greet: ["11_kitten_mew_1", "12_kitten_mew_2", "11_kitten_mew_1", "12_kitten_mew_2", "01_meow_greeting_short", "02_meow_greeting_soft", "03_meow_greeting_clear"],
  curious: ["04_meow_curious_short", "06_meow_siamese"],
  hungry: ["07_meow_food", "09_meow_hungry_pleading", "10_meow_whiney_pleading", "08_meow_with_purr"],
  kitten: ["11_kitten_mew_1", "12_kitten_mew_2"],
  hiss: ["15_hiss", "16_hiss_short", "17_hiss_close", "18_hiss_spit"],
  growl: ["19_growl_short"],
  yowl: ["20_yowl_short", "21_yowl_attack"],
  tweet: ["23_bird_chirps_short", "24_bird_tweets"],
  purr: ["13_purr_loop_12s"],
  purrTake: ["14_purr_long_whiskers"],
  bed: ["25_birdsong_ambient"],
};

const ALL = [...MUSIC, ...new Set(Object.values(CLIPS).flat())];

const urlFor = (name) => new URL(
  MUSIC.has(name) ? `../audio/${name}.mp3` : `../audio/real/${name}.mp3`,
  import.meta.url,
);

export class PlayAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicVol = 0.6;
    this.musicOn = true;
    this.sfxVol = 0.8;
    this.sfxOn = true;
    this.buffers = {};
    this.failed = new Set();
    this.ready = false;
    this.loading = null;
    this.hidden = false;
    this.current = "";
    this.slot = "a";
    this.tension = 0;
    this.catAt = 0;
    this.last = {};
    this.purr = null;
    this.noise = null;
  }

  snapshot() {
    return { music: this.musicVol, musicOn: this.musicOn, effects: this.sfxVol, effectsOn: this.sfxOn };
  }

  setMix(sound = {}) {
    if (sound.music != null) this.musicVol = clamp(sound.music);
    if (sound.effects != null) this.sfxVol = clamp(sound.effects);
    if (sound.musicOn != null) this.musicOn = Boolean(sound.musicOn);
    if (sound.effectsOn != null) this.sfxOn = Boolean(sound.effectsOn);
    this.applyMusic(0.1);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.applyMusic(0.1);
    if (this.muted) this.stopPurr();
  }

  setTension(value) {
    this.tension = Math.max(0, Math.min(1, value));
    this.applyMusic(0.25);
  }

  unlock() {
    this.gesture();
  }

  gesture() {
    this.prime();
    this.keepAlive();
    if (this.html && this.html.paused) {
      const pending = this.html.play();
      if (pending && pending.catch) pending.catch(() => {});
    }
    this.kick();
    if (!this.loading) this.loading = this.loadAll();
    else if (this.ready && this.current && !this.loops[this.slot]) this.playMusic(this.current, true);
  }

  kick() {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended" || this.ctx.state === "interrupted") {
      const pending = this.ctx.resume();
      if (pending && pending.catch) pending.catch(() => {});
    }
  }

  keepAlive() {
    if (this.html) return;
    const audio = document.createElement("audio");
    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");
    audio.loop = true;
    audio.preload = "auto";
    audio.src = tinyWav();
    audio.volume = 0.01;
    document.body.appendChild(audio);
    this.html = audio;
  }

  status() {
    const gain = this.slot === "a" ? this.gainA : this.gainB;
    const src = this.loops ? this.loops[this.slot] : null;
    return {
      state: this.ctx ? this.ctx.state : "closed",
      gain: gain ? gain.gain.value : 0,
      looping: Boolean(src),
      name: src && src.__name ? src.__name : this.current || "",
      musicVol: this.musicVol,
      html: Boolean(this.html && !this.html.paused),
    };
  }

  prime() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || this.ctx) return;
    const session = navigator.audioSession;
    if (session) {
      try { session.type = "playback"; } catch (error) { /* older Safari */ }
    }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.gainA = this.ctx.createGain();
    this.gainB = this.ctx.createGain();
    this.gainA.gain.value = 0.0001;
    this.gainB.gain.value = 0.0001;
    this.gainA.connect(this.master);
    this.gainB.connect(this.master);
    this.loops = { a: null, b: null };
    const silent = this.ctx.createBuffer(1, 8, this.ctx.sampleRate);
    const blip = this.ctx.createBufferSource();
    blip.buffer = silent;
    blip.connect(this.master);
    blip.start();
    this.noise = this.makeNoise();
  }

  async loadAll() {
    await Promise.all(ALL.map(async (name) => {
      try {
        const response = await fetch(urlFor(name));
        if (!response.ok) throw new Error(String(response.status));
        const raw = await response.arrayBuffer();
        let buffer = await this.ctx.decodeAudioData(raw.slice(0));
        if (name === "13_purr_loop_12s") {
          const seamed = seam(this.ctx, buffer);
          buffer = seamed.buffer;
          this.purrSeam = seamed.edge;
        }
        this.buffers[name] = buffer;
      } catch (error) {
        this.failed.add(name);
      }
    }));
    this.ready = true;
    if (this.current) this.playMusic(this.current, true);
  }

  musicLevel() {
    if (this.muted || !this.musicOn || this.hidden) return 0.0001;
    return Math.max(0.0001, this.musicVol * 0.42 * (1 + this.tension * 0.18));
  }

  sfxLevel() {
    if (this.muted || !this.sfxOn) return 0;
    return this.sfxVol;
  }

  playMusic(name, force = false) {
    this.current = name;
    if (!this.ctx || !this.ready || this.hidden) return;
    if (!force && this.loops[this.slot] && this.loops[this.slot].__name === name) {
      this.applyMusic(0.2);
      return;
    }
    const next = this.slot === "a" ? "b" : "a";
    this.startLoop(next, name);
    this.ramp(this[next === "a" ? "gainA" : "gainB"].gain, this.musicLevel(), 1.15);
    this.ramp(this[this.slot === "a" ? "gainA" : "gainB"].gain, 0.0001, 1.15);
    this.slot = next;
  }

  applyMusic(seconds) {
    if (!this.ctx || !this.ready) return;
    const gain = this.slot === "a" ? this.gainA : this.gainB;
    this.ramp(gain.gain, this.musicLevel(), seconds);
  }

  startLoop(slot, name) {
    this.stopSlot(slot);
    const buffer = this.buffers[name];
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.__name = name;
    src.connect(slot === "a" ? this.gainA : this.gainB);
    src.start();
    this.loops[slot] = src;
  }

  stopSlot(slot) {
    const src = this.loops[slot];
    if (!src) return;
    try { src.stop(); } catch (error) { /* already stopped */ }
    this.loops[slot] = null;
  }

  sting(name) {
    this.play(name, { gain: 0.9, music: true, rate: 1 });
  }

  ramp(param, value, seconds) {
    const now = this.ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(0.0001, param.value), now);
    param.linearRampToValueAtTime(Math.max(0.0001, value), now + Math.max(0.05, seconds));
  }

  play(name, { rate = 1, gain = 0.7, music = false } = {}) {
    if (!this.ctx) return;
    const buffer = this.buffers[name];
    if (!buffer) {
      if (!music && this.failed.has(name)) this.fallback();
      return;
    }
    const level = music ? this.musicLevel() * gain : this.sfxLevel() * gain * (0.86 + Math.random() * 0.22);
    if (level <= 0.0001) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const amp = this.ctx.createGain();
    amp.gain.value = level;
    src.connect(amp);
    amp.connect(music ? this.master : this.sfxBus);
    src.start();
  }

  pick(group) {
    const list = CLIPS[group] || CLIPS.kitten;
    let index = Math.floor(Math.random() * list.length);
    if (list.length > 1 && index === this.last[group]) index = (index + 1) % list.length;
    this.last[group] = index;
    return list[index];
  }

  vary() {
    return 0.94 + Math.random() * 0.12;
  }

  voice(group, gain = 0.62) {
    const now = performance.now();
    if (now - this.catAt < 280) return;
    this.catAt = now;
    this.play(this.pick(group), { rate: this.vary(), gain });
  }

  meow(kind = "kitten") {
    const group = CLIPS[kind] ? kind : "kitten";
    this.voice(group === "greet" ? "greet" : group, group === "hungry" ? 0.7 : 0.62);
  }

  hiss() { this.voice("hiss", 0.72); }
  growl() { this.voice("growl", 0.75); }
  yowl() { this.voice("yowl", 0.74); }
  tweet() { this.play(this.pick("tweet"), { rate: this.vary(), gain: 0.34 }); }

  hum(on, secondsLeft = 10) {
    if (!this.ctx) return;
    if (!on || this.sfxLevel() <= 0) {
      if (this.vacuum) {
        try { this.vacuum.osc.stop(); } catch (error) { /* already stopped */ }
        this.vacuum = null;
      }
      return;
    }
    if (!this.vacuum) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 52;
      filter.type = "lowpass";
      filter.frequency.value = 160;
      gain.gain.value = Math.max(0.0001, 0.028 * this.sfxLevel());
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxBus);
      osc.start();
      this.vacuum = { osc, gain };
    }
    const urgent = secondsLeft < 2;
    this.vacuum.osc.frequency.setTargetAtTime(urgent ? 74 : 52, this.ctx.currentTime, 0.15);
  }

  chime() {
    if (!this.ctx || this.sfxLevel() <= 0) return;
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const t = this.ctx.currentTime + i * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      const level = Math.max(0.0001, 0.045 * this.sfxLevel());
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(level, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  squeak() { this.blip(920, 0.07, 0.1); }
  chatter() { this.blip(460, 0.08, 0.09); }
  splash() { this.blip(220, 0.11, 0.09); }
  cluck() { this.blip(340, 0.09, 0.1); }
  crow() { this.blip(480, 0.2, 0.14); }

  blip(freq, dur, peak) {
    if (!this.ctx || this.sfxLevel() <= 0) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.72), t + dur);
    const level = Math.max(0.0001, peak * this.sfxLevel());
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  setPurr(on) {
    if (!this.ctx || !this.buffers["13_purr_loop_12s"]) return;
    if (on && this.sfxLevel() > 0) {
      if (this.purr) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers["13_purr_loop_12s"];
      src.loop = true;
      src.playbackRate.value = this.vary();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(this.sfxLevel() * 0.42, now + 0.6);
      src.connect(gain);
      gain.connect(this.sfxBus);
      src.start();
      this.purr = { src, gain };
      return;
    }
    this.stopPurr();
  }

  stopPurr() {
    if (!this.purr || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.purr.gain.gain.cancelScheduledValues(now);
    this.purr.gain.gain.setValueAtTime(Math.max(0.0001, this.purr.gain.gain.value), now);
    this.purr.gain.gain.linearRampToValueAtTime(0.0001, now + 0.45);
    this.purr.src.stop(now + 0.5);
    this.purr = null;
  }

  ding(golden = false) {
    if (!this.ctx || this.sfxLevel() <= 0) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(golden ? 988 : 740, t);
    osc.frequency.exponentialRampToValueAtTime(golden ? 1976 : 1480, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09 * this.sfxLevel(), t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.24);
    const over = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    over.type = "triangle";
    over.frequency.setValueAtTime(1480, t);
    over.frequency.exponentialRampToValueAtTime(1980, t + 0.1);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.03 * this.sfxLevel(), t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    over.connect(og);
    og.connect(this.sfxBus);
    over.start(t);
    over.stop(t + 0.18);
  }

  scratch() {
    if (!this.ctx || !this.noise || this.sfxLevel() <= 0) return;
    this.burst(0.07, 2100, 0.06);
    this.burst(0.05, 1400, 0.035);
  }

  burst(duration, freq, peak) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    const level = Math.max(0.0001, peak * this.sfxLevel());
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start(t);
    src.stop(t + duration);
  }

  fallback() {
    if (!this.ctx || this.sfxLevel() <= 0) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(360, t + 0.18);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.04 * this.sfxLevel(), t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  makeNoise() {
    const length = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = last * 0.82 + (Math.random() * 2 - 1) * 0.18;
      data[i] = last;
    }
    return buffer;
  }

  pause() {
    this.hidden = true;
    this.applyMusic(0.05);
    this.stopPurr();
  }

  resume() {
    this.hidden = false;
    this.kick();
    if (this.html && this.html.paused) {
      const pending = this.html.play();
      if (pending && pending.catch) pending.catch(() => {});
    }
    this.applyMusic(0.3);
    if (this.ready && this.current && !this.loops[this.slot]) this.playMusic(this.current, true);
  }
}

function tinyWav() {
  const rate = 8000;
  const samples = 1600;
  const buf = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buf);
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (const bite of bytes) binary += String.fromCharCode(bite);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function seam(ctx, buffer) {
  const rate = buffer.sampleRate;
  const fade = Math.min(Math.floor(0.08 * rate), Math.floor(buffer.length / 8));
  const src = buffer.getChannelData(0);
  const outLen = src.length - fade;
  const out = ctx.createBuffer(1, outLen, rate);
  const dst = out.getChannelData(0);
  dst.set(src.subarray(0, outLen));
  for (let i = 0; i < fade; i++) {
    const t = i / Math.max(1, fade - 1);
    dst[i] = src[src.length - fade + i] * Math.cos(t * Math.PI / 2) + src[i] * Math.sin(t * Math.PI / 2);
  }
  return { buffer: out, edge: Math.abs(dst[0] - dst[outLen - 1]) };
}

function clamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
