#!/usr/bin/env python3
"""Render Sunbeam's lullaby, cat, and bird sounds.

Everything here is original synthesis (no third-party recordings).
The site plays the mp3 files in audio/ and does not run this script.
"""

import math
import os
import subprocess
import wave
import zlib
import struct

import numpy as np

SR = 32000
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "audio")
ART = os.environ.get("SUNBEAM_ART", "/opt/cursor/artifacts")
RNG = np.random.default_rng(7)


def lowpass(x, cutoff, sr=SR, poles=1):
    if cutoff >= sr * 0.48:
        return x
    y = np.asarray(x, dtype=np.float64)
    a = math.exp(-2 * math.pi * cutoff / sr)
    gain = 1 - a
    for _ in range(poles):
        out = np.empty_like(y)
        acc = 0.0
        for i, sample in enumerate(y):
            acc = a * acc + gain * sample
            out[i] = acc
        y = out
    return y


def highpass(x, cutoff, sr=SR, poles=1):
    return x - lowpass(x, cutoff, sr, poles)


def fade_ends(x, attack=0.02, release=0.04, sr=SR):
    n = len(x)
    a = max(1, int(attack * sr))
    r = max(1, int(release * sr))
    y = x.copy()
    y[:a] *= np.linspace(0, 1, a) ** 2
    y[-r:] *= np.linspace(1, 0, r) ** 2
    return y


def write_wav(path, audio):
    pcm = np.clip(audio, -1, 1)
    pcm = (pcm * 32767).astype(np.int16)
    with wave.open(path, "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm.tobytes())


def to_mp3(wav_path, mp3_path, quality=6):
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", wav_path,
            "-codec:a", "libmp3lame",
            "-q:a", str(quality),
            "-ac", "1",
            mp3_path,
        ]
    )
    os.remove(wav_path)


def save(name, audio, quality=6):
    audio = np.asarray(audio, dtype=np.float64)
    audio = fade_ends(audio, 0.012, 0.03)
    peak = np.max(np.abs(audio)) or 1
    if peak > 0.98:
        audio *= 0.98 / peak
    wav = os.path.join(OUT, name + ".wav")
    mp3 = os.path.join(OUT, name + ".mp3")
    write_wav(wav, audio)
    to_mp3(wav, mp3, quality)
    return mp3


def felt_note(freq, dur, vel, sr=SR):
    n = max(8, int(dur * sr))
    t = np.arange(n) / sr
    y = np.zeros(n)
    for k in range(1, 7):
        partial = freq * k * math.sqrt(1 + 0.00005 * k * k)
        if partial > sr * 0.45:
            break
        amp = vel * (0.5 ** (k - 1))
        decay = np.exp(-t * (0.42 + 0.7 * k))
        y += amp * decay * np.sin(2 * math.pi * partial * t)
    attack_t = 0.12
    attack = np.clip(t / attack_t, 0, 1)
    attack = attack * attack * (3 - 2 * attack)
    y *= attack
    y = lowpass(y, 1300, sr)
    hammer = RNG.standard_normal(n) * np.exp(-t * 22) * vel * 0.012
    y += lowpass(hammer, 800, sr)
    return y


def pad_tone(freq, dur, vel, sr=SR):
    n = max(8, int(dur * sr))
    t = np.arange(n) / sr
    y = np.zeros(n)
    for detune in (-0.0035, 0.0, 0.0035):
        phase = RNG.uniform(0, 2 * math.pi)
        y += np.sin(2 * math.pi * freq * (1 + detune) * t + phase)
    y *= vel / 3
    attack = np.clip(t / 1.8, 0, 1) ** 2
    release = np.clip((dur - t) / 2.0, 0, 1) ** 2
    y *= attack * release
    return lowpass(y, 620, sr)


def airy_note(freq, dur, vel, sr=SR):
    n = max(8, int(dur * sr))
    t = np.arange(n) / sr
    y = np.sin(2 * math.pi * freq * t)
    y += 0.25 * np.sin(2 * math.pi * freq * 2.01 * t + 0.4)
    attack = np.clip(t / 0.45, 0, 1) ** 2
    release = np.clip((dur - t) / 0.8, 0, 1) ** 2
    y *= vel * attack * release * np.exp(-t * 0.35)
    return lowpass(y, 2800, sr)


def mix_at(buffer, sound, start):
    start = int(start)
    end = min(len(buffer), start + len(sound))
    if start >= len(buffer) or end <= start:
        return
    buffer[start:end] += sound[: end - start]


def loop_join(audio, fade_seconds=2.4):
    fade = int(fade_seconds * SR)
    if fade * 2 >= len(audio):
        return audio
    tail = audio[-fade:].copy()
    body = audio[:-fade].copy()
    f = np.linspace(0, 1, fade)
    f = f * f * (3 - 2 * f)
    body[:fade] = tail * (1 - f) + body[:fade] * f
    return body


def render_music(outside=False):
    bpm = 48
    beat = 60 / bpm
    bars = 16
    beats = bars * 4
    total = beats * beat + 0.2
    n = int(total * SR)
    music = np.zeros(n)

    # Sparse lullaby in F. Long notes, lots of rests. Times are in beats.
    melody = [
        (0, 65, 3.0, 0.34),
        (4.2, 69, 2.0, 0.28),
        (7.0, 67, 2.2, 0.26),
        (10.5, 65, 4.0, 0.32),
        (18, 72, 2.6, 0.27),
        (21.4, 69, 2.0, 0.25),
        (25.2, 67, 2.0, 0.24),
        (28.4, 65, 4.2, 0.3),
        (34.5, 57, 3.0, 0.26),
        (38.2, 60, 2.2, 0.24),
        (41.2, 62, 2.0, 0.23),
        (44.0, 60, 2.4, 0.22),
        (50.0, 67, 2.2, 0.26),
        (53.0, 65, 2.0, 0.25),
        (55.6, 69, 1.8, 0.22),
        (58.0, 65, 4.6, 0.28),
    ]
    for beat_at, midi, length, vel in melody:
        freq = 440 * 2 ** ((midi - 69) / 12)
        note = felt_note(freq, length * beat + 1.4, vel)
        mix_at(music, note, beat_at * beat * SR)
        if length >= 2.4:
            box = felt_note(freq * 2, length * beat + 0.8, vel * 0.07)
            mix_at(music, box, (beat_at * beat + 0.05) * SR)
        if outside and length >= 2.2:
            air = airy_note(freq * 2, length * beat + 0.6, vel * 0.07)
            mix_at(music, air, (beat_at * beat + 0.08) * SR)

    chords = [
        (0, 16, [43, 48, 53, 57]),     # F
        (16, 16, [48, 52, 55]),         # C
        (32, 16, [45, 52, 57]),         # Am
        (48, 16, [43, 48, 53, 57]),     # F again, so the loop can breathe home
    ]
    for beat_at, length, notes in chords:
        dur = length * beat + 2.2
        for midi in notes:
            freq = 440 * 2 ** ((midi - 69) / 12)
            mix_at(music, pad_tone(freq, dur, 0.045), beat_at * beat * SR)
    if outside:
        shimmer = np.zeros(n)
        t = np.arange(n) / SR
        trem = 0.65 + 0.35 * np.sin(2 * math.pi * 0.07 * t)
        shimmer += 0.003 * trem * np.sin(2 * math.pi * 1046.5 * t)
        shimmer += 0.002 * trem * np.sin(2 * math.pi * 1318.5 * t + 0.6)
        air = highpass(RNG.standard_normal(n), 2800, poles=2)
        air = lowpass(air, 5200, poles=2) * 0.0012
        music += shimmer + air

    music = lowpass(music, 4200)
    music = np.tanh(music * 1.15) / 1.15
    music = loop_join(music, 2.6)
    peak = np.max(np.abs(music)) or 1
    music *= 0.42 / peak
    return music


def glottal(f0, n, open_phase=0.42, jitter=0.003):
    y = np.zeros(n)
    phase = 0.0
    for i in range(n):
        freq = max(40, f0[i])
        phase += freq / SR
        frac = phase - math.floor(phase)
        if frac < open_phase:
            t = frac / open_phase
            y[i] = t * t * (3 - 2 * t)
        phase += (RNG.random() - 0.5) * jitter
    return lowpass(y, 1800)


def resonator(source, freq, bandwidth):
    y = np.zeros_like(source)
    y1 = 0.0
    y2 = 0.0
    for i, sample in enumerate(source):
        r = math.exp(-math.pi * bandwidth[i] / SR)
        theta = 2 * math.pi * min(freq[i], SR * 0.45) / SR
        a1 = 2 * r * math.cos(theta)
        a2 = -(r * r)
        gain = (1 - r) * 1.35
        v = gain * sample + a1 * y1 + a2 * y2
        y2 = y1
        y1 = v
        y[i] = v
    return y


def contour(duration, points):
    n = int(duration * SR)
    t = np.linspace(0, 1, n)
    xs = np.array([p[0] for p in points], dtype=float)
    ys = np.array([p[1] for p in points], dtype=float)
    return np.interp(t, xs, ys), n


def meow(kind, variant=0):
    shift = 1 + (variant - 1) * 0.045
    if kind == "greet":
        dur = 0.5 + variant * 0.03
        f0, n = contour(dur, [(0, 480), (0.28, 700), (0.62, 520), (1, 360)])
        f1, _ = contour(dur, [(0, 420), (0.2, 980), (0.7, 640), (1, 480)])
        f2, _ = contour(dur, [(0, 1500), (0.25, 2100), (1, 1400)])
        noise_mix = 0.05
    elif kind == "curious":
        dur = 0.32 + variant * 0.02
        f0, n = contour(dur, [(0, 540), (0.45, 620), (1, 860)])
        f1, _ = contour(dur, [(0, 500), (0.4, 900), (1, 1100)])
        f2, _ = contour(dur, [(0, 1600), (1, 2400)])
        noise_mix = 0.04
    elif kind == "hungry":
        dur = 0.78 + variant * 0.05
        f0, n = contour(dur, [(0, 500), (0.2, 760), (0.45, 640), (0.7, 820), (1, 480)])
        wobble = 1 + 0.035 * np.sin(np.linspace(0, dur * 5.5 * 2 * math.pi, n))
        f0 = f0 * wobble
        f1, _ = contour(dur, [(0, 450), (0.3, 1050), (0.6, 900), (1, 560)])
        f2, _ = contour(dur, [(0, 1700), (0.4, 2500), (1, 1600)])
        noise_mix = 0.08
    else:
        dur = 0.24 + variant * 0.015
        f0, n = contour(dur, [(0, 820), (0.35, 1100), (1, 760)])
        f1, _ = contour(dur, [(0, 700), (0.4, 1300), (1, 900)])
        f2, _ = contour(dur, [(0, 2100), (1, 2800)])
        noise_mix = 0.04
    f0 = f0 * shift
    source = glottal(f0, n, open_phase=0.4 if kind != "kitten" else 0.48)
    breath = RNG.standard_normal(n) * noise_mix
    source = source + lowpass(breath, 3000)
    voiced = 0.72 * resonator(source, f1, np.full(n, 110))
    voiced += 0.38 * resonator(source, f2, np.full(n, 160))
    env, _ = contour(dur, [(0, 0), (0.08, 1), (0.72, 0.85), (1, 0)])
    voiced *= env
    return fade_ends(voiced, 0.02, 0.05)


def hiss():
    dur = 0.48
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = RNG.standard_normal(n)
    noise = highpass(noise, 1800)
    noise = lowpass(noise, 7500)
    env = np.clip(t / 0.03, 0, 1) * np.exp(-t * 4.2)
    body = lowpass(RNG.standard_normal(n), 240) * np.exp(-t * 6) * 0.18
    y = noise * env * 0.85 + body
    return fade_ends(y, 0.01, 0.04)


def growl():
    dur = 0.62
    f0, n = contour(dur, [(0, 180), (0.4, 140), (1, 110)])
    pulse = 0.62 + 0.38 * np.sin(np.linspace(0, dur * 11 * 2 * math.pi, n))
    source = glottal(f0, n, open_phase=0.55, jitter=0.01)
    noise = lowpass(RNG.standard_normal(n), 900) * 0.45
    f1 = np.full(n, 480)
    f2 = np.linspace(1100, 800, n)
    y = resonator(source * 0.7 + noise, f1, np.full(n, 90))
    y += 0.4 * resonator(source, f2, np.full(n, 140))
    env, _ = contour(dur, [(0, 0), (0.06, 1), (0.8, 0.7), (1, 0)])
    return fade_ends(y * pulse * env, 0.02, 0.06)


def yowl():
    dur = 0.84
    f0, n = contour(dur, [(0, 420), (0.18, 760), (0.45, 640), (0.75, 390), (1, 260)])
    source = glottal(f0, n, open_phase=0.46, jitter=0.008)
    noise = highpass(RNG.standard_normal(n), 1200) * 0.12
    f1, _ = contour(dur, [(0, 520), (0.2, 1100), (1, 600)])
    f2, _ = contour(dur, [(0, 1600), (0.3, 2400), (1, 1400)])
    y = 0.7 * resonator(source + noise, f1, np.full(n, 120))
    y += 0.4 * resonator(source, f2, np.full(n, 170))
    env, _ = contour(dur, [(0, 0), (0.07, 1), (0.65, 0.9), (1, 0)])
    return fade_ends(y * env, 0.02, 0.07)


def chirrup(rising=True):
    dur = 0.18
    if rising:
        f0, n = contour(dur, [(0, 520), (1, 980)])
    else:
        f0, n = contour(dur, [(0, 760), (1, 540)])
    source = glottal(f0, n, open_phase=0.5)
    f1 = np.linspace(700, 1200, n)
    y = resonator(source, f1, np.full(n, 140))
    env = np.sin(np.linspace(0, math.pi, n)) ** 1.2
    return fade_ends(y * env * 0.8, 0.01, 0.02)


def chatter():
    pulses = []
    for i in range(5):
        base = 560 + i * 70
        burst = chirrup(True)
        # shorten by retuning a fresh short pulse
        dur = 0.055
        f0, n = contour(dur, [(0, base), (1, base + 180)])
        source = glottal(f0, n, open_phase=0.5)
        y = resonator(source, np.linspace(800, 1400, n), np.full(n, 180))
        y *= np.sin(np.linspace(0, math.pi, n))
        pulses.append(y)
    gap = np.zeros(int(0.048 * SR))
    out = pulses[0]
    for pulse in pulses[1:]:
        out = np.concatenate([out, gap, pulse])
    return fade_ends(out * 0.9, 0.008, 0.02)


def bird_chirp(f_start, f_end, dur, brightness=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sweep = np.linspace(f_start, f_end, n)
    phase = np.cumsum(sweep) / SR * 2 * math.pi
    mod = np.sin(2 * math.pi * 42 * t)
    y = np.sin(phase + brightness * mod)
    y += 0.18 * np.sin(phase * 2)
    env = np.sin(np.linspace(0, math.pi, n)) ** 1.4
    return lowpass(y * env, 8000)


def tweet_bank():
    return [
        bird_chirp(3200, 4600, 0.09, 0.2),
        bird_chirp(2800, 3600, 0.11, 0.15),
        np.concatenate([
            bird_chirp(3400, 3900, 0.08),
            np.zeros(int(0.04 * SR)),
            bird_chirp(2500, 2700, 0.16, 0.1),
        ]),
        bird_chirp(1800, 3400, 0.32, 0.25),
        np.concatenate([
            bird_chirp(4200, 4800, 0.06),
            np.zeros(int(0.03 * SR)),
            bird_chirp(4000, 4500, 0.06),
            np.zeros(int(0.03 * SR)),
            bird_chirp(3600, 4300, 0.08),
        ]),
        bird_chirp(2200, 2600, 0.2, 0.12),
    ]


def birdsong_bed():
    dur = 24
    n = int(dur * SR)
    bed = np.zeros(n)
    chirps = tweet_bank()
    for _ in range(16):
        chip = chirps[int(RNG.integers(0, len(chirps)))] * RNG.uniform(0.08, 0.2)
        chip = lowpass(chip, 2800)
        at = int(RNG.uniform(0.2, dur - 1.2) * SR)
        mix_at(bed, chip, at)
    bed = loop_join(bed, 0.6)
    peak = np.max(np.abs(bed)) or 1
    return bed * 0.35 / peak


def wing():
    bursts = []
    for _ in range(5):
        n = int(0.02 * SR)
        burst = highpass(RNG.standard_normal(n), 500, poles=2)
        burst = lowpass(burst, 2200, poles=3)
        burst *= np.sin(np.linspace(0, math.pi, n))
        bursts.append(burst * 0.7)
        bursts.append(np.zeros(int(0.028 * SR)))
    return fade_ends(np.concatenate(bursts), 0.005, 0.02)


def purr():
    dur = 4.0
    n = int(dur * SR)
    t = np.arange(n) / SR
    # 25 Hz fits this buffer an integer number of times.
    mod = 0.55 + 0.45 * np.sin(2 * math.pi * 25 * t)
    noise = lowpass(RNG.standard_normal(n), 140, poles=4)
    tone = 0.35 * np.sin(2 * math.pi * 50 * t) + 0.08 * np.sin(2 * math.pi * 100 * t)
    y = (noise * 0.65 + tone) * mod
    y = loop_join(y, 0.05)
    peak = np.max(np.abs(y)) or 1
    return y * 0.62 / peak


def normalize_sfx(audio, peak=0.86):
    m = np.max(np.abs(audio)) or 1
    return audio * (peak / m)


def spectrogram(x, nfft=1024, hop=256):
    if len(x) < nfft:
        x = np.pad(x, (0, nfft - len(x)))
    window = np.hanning(nfft)
    frames = []
    for i in range(0, len(x) - nfft, hop):
        spec = np.abs(np.fft.rfft(x[i:i + nfft] * window))
        frames.append(np.log10(spec + 1e-7))
    grid = np.array(frames).T
    grid = grid[: nfft // 2]
    return grid


def colorize(grid):
    g = grid - np.percentile(grid, 5)
    g = g / (np.percentile(g, 98) + 1e-6)
    g = np.clip(g, 0, 1)
    # Warm, dark-to-cream map so a beep shows as a thin bright line.
    r = (0.16 + 0.84 * g) * 255
    b = (0.10 + 0.35 * g) * 255
    gg = (0.10 + 0.72 * g) * 255
    rgb = np.stack([r, gg, b], axis=-1).astype(np.uint8)
    return rgb


def png_bytes(rgb):
    height, width, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[y].tobytes() for y in range(height))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def metrics(name, audio):
    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(audio ** 2)))
    spec = np.abs(np.fft.rfft(audio * np.hanning(len(audio))))
    freqs = np.fft.rfftfreq(len(audio), 1 / SR)
    centroid = float(np.sum(freqs * spec) / (np.sum(spec) + 1e-9))
    # Attack: time to half of the peak absolute value.
    env = np.abs(audio)
    half = np.max(env) * 0.5
    attack_ms = float(np.argmax(env >= half) / SR * 1000) if np.any(env >= half) else 0
    return {"name": name, "sec": round(len(audio) / SR, 2), "peak": round(peak, 3), "rms": round(rms, 4), "centroid_hz": round(centroid, 1), "attack_ms": round(attack_ms, 1)}


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(ART, exist_ok=True)
    report = []

    inside = render_music(False)
    outside = render_music(True)
    report.append(metrics("music-inside", inside))
    report.append(metrics("music-outside", outside))
    save("music-inside", inside, 5)
    save("music-outside", outside, 5)

    purr_audio = purr()
    report.append(metrics("purr", purr_audio))
    save("purr", purr_audio, 6)

    library = {
        "hiss": normalize_sfx(hiss()),
        "growl": normalize_sfx(growl()),
        "yowl": normalize_sfx(yowl()),
        "chirrup-1": normalize_sfx(chirrup(True)),
        "chirrup-2": normalize_sfx(chirrup(False)),
        "chatter-1": normalize_sfx(chatter()),
        "chatter-2": normalize_sfx(chatter()),
        "wing": normalize_sfx(wing(), 0.7),
        "birdsong": birdsong_bed(),
    }
    for kind, count in (("greet", 3), ("curious", 2), ("hungry", 2), ("kitten", 2)):
        for i in range(count):
            library[f"meow-{kind}-{i + 1}"] = normalize_sfx(meow(kind, i))
    for i, tweet in enumerate(tweet_bank(), start=1):
        library[f"tweet-{i}"] = normalize_sfx(tweet, 0.75)
    song = np.concatenate([
        library["tweet-4"] * 0.8,
        np.zeros(int(0.08 * SR)),
        library["tweet-3"] * 0.7,
        np.zeros(int(0.06 * SR)),
        library["tweet-6"] * 0.65,
    ])
    library["song-1"] = normalize_sfx(song, 0.75)
    library["song-2"] = normalize_sfx(np.concatenate([
        library["tweet-5"],
        np.zeros(int(0.05 * SR)),
        library["tweet-2"] * 0.8,
    ]), 0.75)

    for name, audio in library.items():
        report.append(metrics(name, audio))
        save(name, audio, 7)

    panels = [
        ("Inside lullaby", inside[: int(12 * SR)]),
        ("Purr", purr_audio),
        ("Greeting meow", library["meow-greet-1"]),
        ("Hiss", library["hiss"]),
        ("Bird song", library["song-1"]),
        ("Wing flutter", library["wing"]),
    ]
    tiles = []
    for _, audio in panels:
        spec = colorize(spectrogram(audio))
        # Keep images readable.
        if spec.shape[1] > 360:
            idx = np.linspace(0, spec.shape[1] - 1, 360).astype(int)
            spec = spec[:, idx]
        if spec.shape[0] > 180:
            spec = spec[:180][::-1]
        else:
            spec = spec[::-1]
        tiles.append(spec)
    height = max(tile.shape[0] for tile in tiles)
    width = max(tile.shape[1] for tile in tiles)
    canvas = np.zeros((height * 2 + 8, width * 3 + 16, 3), dtype=np.uint8)
    canvas[:, :] = (28, 18, 14)
    for i, tile in enumerate(tiles):
        row, col = divmod(i, 3)
        y = 4 + row * (height + 4)
        x = 4 + col * (width + 4)
        canvas[y:y + tile.shape[0], x:x + tile.shape[1]] = tile
    png = os.path.join(ART, "sunbeam-spectrogram.png")
    with open(png, "wb") as handle:
        handle.write(png_bytes(canvas))

    preview = []
    gap = np.zeros(int(0.45 * SR))
    sequence = [
        inside[: int(10 * SR)] * 0.9,
        outside[: int(8 * SR)] * 0.9,
        purr_audio[: int(3 * SR)],
        library["meow-greet-1"],
        library["meow-curious-1"],
        library["meow-hungry-1"],
        library["meow-kitten-1"],
        library["hiss"],
        library["growl"],
        library["yowl"],
        library["chatter-1"],
        library["tweet-1"],
        library["song-1"],
        library["wing"],
    ]
    for clip in sequence:
        preview.append(clip)
        preview.append(gap)
    preview_audio = np.concatenate(preview)
    preview_wav = os.path.join(ART, "sunbeam-audio-preview.wav")
    write_wav(preview_wav, preview_audio)
    preview_mp3 = os.path.join(ART, "sunbeam-audio-preview.mp3")
    subprocess.check_call([
        "ffmpeg", "-y", "-loglevel", "error", "-i", preview_wav,
        "-codec:a", "libmp3lame", "-q:a", "4", "-ac", "1", preview_mp3,
    ])

    print("METRICS")
    for row in report:
        print(row)
    total = 0
    for name in os.listdir(OUT):
        if name.endswith(".mp3"):
            total += os.path.getsize(os.path.join(OUT, name))
    print("TOTAL_MP3_BYTES", total)
    # Loop seam: the join should be quieter than a hard cut.
    seam = np.max(np.abs(np.diff(inside[:20])))
    print("INSIDE_EDGE_DIFF", float(seam))


if __name__ == "__main__":
    main()
