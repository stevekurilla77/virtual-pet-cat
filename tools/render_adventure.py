#!/usr/bin/env python3
"""Original adventure cues for Sunbeam. The game does not run this script."""

import math
import os
import subprocess
import wave

import numpy as np

SR = 32000
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "audio")
RNG = np.random.default_rng(11)


def lowpass(x, cutoff, poles=1):
    y = np.asarray(x, dtype=np.float64)
    a = math.exp(-2 * math.pi * min(cutoff, SR * 0.45) / SR)
    gain = 1 - a
    for _ in range(poles):
        out = np.empty_like(y)
        acc = 0.0
        for i, sample in enumerate(y):
            acc = a * acc + gain * float(sample)
            out[i] = acc
        y = out
    return y


def env(n, attack, release):
    t = np.arange(n) / SR
    dur = n / SR
    a = np.clip(t / max(attack, 0.001), 0, 1)
    a = a * a * (3 - 2 * a)
    r = np.clip((dur - t) / max(release, 0.001), 0, 1)
    r = r * r * (3 - 2 * r)
    return a * r


def tone(freq, dur, vel, decay, partials, attack=0.03, vibrato=0):
    n = max(8, int(dur * SR))
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k, amp in partials:
        f = freq * k
        if f > SR * 0.45:
            break
        wave_t = 2 * math.pi * f * t
        if vibrato:
            wave_t += vibrato * np.sin(2 * math.pi * 5 * t)
        y += amp * np.sin(wave_t) * np.exp(-t * decay * (0.8 + 0.35 * k))
    y *= vel * env(n, attack, min(0.18, dur * 0.45))
    return y


def pizz(freq, dur, vel):
    return lowpass(tone(freq, dur, vel, 7.5, [(1, 1), (2, 0.28), (3, 0.08)], 0.012), 2400)


def marimba(freq, dur, vel):
    y = tone(freq, dur, vel, 9.5, [(1, 1), (4, 0.35), (9, 0.08)], 0.008)
    return lowpass(y, 3200)


def wind(freq, dur, vel):
    y = tone(freq, dur, vel, 2.2, [(1, 1), (2, 0.18), (3, 0.05)], 0.05, vibrato=0.012)
    return lowpass(y, 2600)


def brass(freq, dur, vel):
    y = tone(freq, dur, vel, 1.1, [(1, 0.7), (2, 0.35), (3, 0.16), (4, 0.06)], 0.18)
    return lowpass(y, 1800)


def bass(freq, dur, vel):
    return lowpass(tone(freq, dur, vel, 6.2, [(1, 1), (2, 0.2)], 0.01), 500)


def hat():
    n = int(0.045 * SR)
    y = RNG.standard_normal(n) * np.exp(-np.arange(n) / SR * 48)
    return lowpass(y, 5000, 1) * 0.08


def kick(vel=0.35):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 140 * np.exp(-t * 18) + 48
    y = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t * 16) * vel
    return y


def mix(buf, sound, at):
    if sound is None:
        return
    i = int(at * SR)
    j = min(len(buf), i + len(sound))
    if i >= len(buf) or j <= i:
        return
    buf[i:j] += sound[: j - i]


def loopify(audio, fade=0.28):
    n = int(fade * SR)
    if n * 2 >= len(audio):
        return audio
    body = audio[:-n].copy()
    tail = audio[-n:]
    f = np.linspace(0, 1, n)
    f = f * f * (3 - 2 * f)
    body[:n] = tail * (1 - f) + body[:n] * f
    return body


def midi(degree, root):
    scale = [0, 2, 4, 5, 7, 9, 11]
    octave = (degree - 1) // 7
    deg = (degree - 1) % 7
    return root + scale[deg] + 12 * octave


def write_mp3(name, audio, quality=6):
    peak = np.max(np.abs(audio)) or 1
    audio = np.tanh(audio / peak) * 0.55
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    wav = os.path.join(OUT, name + ".wav")
    mp3 = os.path.join(OUT, name + ".mp3")
    with wave.open(wav, "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm.tobytes())
    subprocess.check_call([
        "ffmpeg", "-y", "-loglevel", "error", "-i", wav,
        "-codec:a", "libmp3lame", "-q:a", str(quality), "-ac", "1", mp3,
    ])
    os.remove(wav)
    return os.path.getsize(mp3)


def layout(bpm, bars, root, melody, chords, bounce=1):
    beat = 60 / bpm
    total = bars * 4 * beat + 0.05
    buf = np.zeros(int(total * SR))
    for bar, step, degree, length in melody:
        when = (bar * 4 + step) * beat
        freq = 440 * 2 ** ((midi(degree, root) - 69) / 12)
        dur = max(0.12, length * beat)
        mix(buf, wind(freq, dur + 0.05, 0.22), when)
        if length >= 0.5:
            mix(buf, marimba(freq * 2, min(0.28, dur), 0.05), when)
    for bar, degs in chords:
        when = bar * 4 * beat
        for i, degree in enumerate(degs):
            freq = 440 * 2 ** ((midi(degree, root - 12) - 69) / 12)
            mix(buf, pizz(freq, beat * 1.6, 0.11 - i * 0.01), when)
            if i == 0:
                mix(buf, bass(freq / 2, beat * 1.5, 0.2), when)
            mix(buf, brass(freq, beat * 3.2, 0.035), when + beat * 2)
    for bar in range(bars):
        for step in (0, 2):
            mix(buf, kick(0.22 * bounce), (bar * 4 + step) * beat)
        for step in (1, 3):
            mix(buf, hat(), (bar * 4 + step) * beat)
        mix(buf, hat() * 0.6, (bar * 4 + 1.5) * beat)
        mix(buf, hat() * 0.6, (bar * 4 + 3.5) * beat)
    buf = lowpass(buf, 4200, 1)
    return loopify(buf, 0.32)


def sting(root=64):
    beat = 60 / 120
    buf = np.zeros(int(2.4 * SR))
    for i, degree in enumerate((1, 3, 5, 8)):
        freq = 440 * 2 ** ((midi(degree, root) - 69) / 12)
        mix(buf, marimba(freq, 0.35, 0.28), i * beat * 0.5)
        mix(buf, wind(freq, 0.5, 0.16), i * beat * 0.5)
    mix(buf, brass(440 * 2 ** ((midi(1, root) - 69) / 12), 1.2, 0.12), beat)
    return lowpass(buf, 4000)


def fanfare():
    beat = 60 / 112
    buf = np.zeros(int(4.2 * SR))
    root = 67
    phrase = [(0, 1), (0.5, 3), (1, 5), (1.5, 8), (2.5, 5), (3, 8), (3.5, 10)]
    for step, degree in phrase:
        freq = 440 * 2 ** ((midi(degree, root) - 69) / 12)
        mix(buf, wind(freq, 0.55, 0.26), step * beat)
        mix(buf, pizz(freq / 2, 0.4, 0.12), step * beat)
    mix(buf, brass(440 * 2 ** ((midi(1, root - 12) - 69) / 12), 1.6, 0.1), 2.2 * beat)
    return lowpass(buf, 3800)


def hurt():
    buf = np.zeros(int(1.7 * SR))
    for i, midi_n in enumerate((64, 60, 55)):
        freq = 440 * 2 ** ((midi_n - 69) / 12)
        mix(buf, wind(freq, 0.7, 0.16), i * 0.18)
        mix(buf, brass(freq / 2, 0.8, 0.05), i * 0.18)
    return lowpass(buf, 2200)


def main():
    os.makedirs(OUT, exist_ok=True)
    tracks = {
        "music-living": layout(108, 12, 67, living_melody(), living_chords(), 0.85),
        "music-porch": layout(116, 12, 62, porch_melody(), porch_chords(), 1),
        "music-yard": layout(120, 12, 69, yard_melody(), yard_chords(), 1.05),
        "music-neighbor": layout(112, 12, 60, neighbor_melody(), neighbor_chords(), 0.95),
        "music-sting": sting(),
        "music-fanfare": fanfare(),
        "music-hurt": hurt(),
    }
    total = 0
    for name, audio in tracks.items():
        total += write_mp3(name, audio, 6 if name.startswith("music-") and "sting" not in name and name not in ("music-fanfare", "music-hurt") else 7)
        print(name, round(len(audio) / SR, 2), "s")
    print("NEW_BYTES", total)


def living_melody():
    a = [(0, 0, 1, 2), (0, 2, 3, 1), (0, 3, 5, 1), (1, 0, 6, 1.5), (1, 2, 5, 1), (1, 3, 3, 1)]
    b = [(2, 0, 5, 1), (2, 1.5, 6, 1), (2, 3, 8, 1), (3, 0, 6, 2), (3, 2.5, 5, 1)]
    c = [(4, 0, 8, 1), (4, 1.5, 6, 1), (4, 3, 5, 1), (5, 0, 3, 1.5), (5, 2, 2, 1), (5, 3, 1, 1)]
    d = [(6, 0, 5, 1), (6, 2, 3, 1), (6, 3, 5, 1), (7, 0, 6, 1.5), (7, 2, 5, 2)]
    e = [(8, 0, 1, 1), (8, 1, 5, 1), (8, 2, 8, 2), (9, 0, 6, 1), (9, 2, 5, 1), (9, 3, 3, 1)]
    f = [(10, 0, 2, 1), (10, 2, 3, 1), (10, 3, 5, 1), (11, 0, 1, 3)]
    return a + b + c + d + e + f


def living_chords():
    return [(i, (1, 3, 5) if i % 4 in (0, 1) else (4, 6, 8) if i % 4 == 2 else (5, 7, 2)) for i in range(0, 12, 1)]


def porch_melody():
    a = [(0, 0, 5, 1), (0, 1.5, 6, 0.5), (0, 2, 8, 1.5), (1, 0, 6, 1), (1, 2, 5, 1), (1, 3, 3, 1)]
    b = [(2, 0, 8, 0.5), (2, 1, 9, 0.5), (2, 2, 8, 1), (2, 3, 6, 1), (3, 0, 5, 2), (3, 2.5, 3, 1)]
    c = [(4, 0, 10, 1), (4, 1.5, 8, 1), (4, 3, 6, 1), (5, 0, 5, 1.5), (5, 2, 8, 2)]
    d = [(6, 0, 6, 1), (6, 2, 5, 1), (6, 3, 3, 1), (7, 0, 5, 3)]
    e = [(8, 0, 8, 1), (8, 2, 10, 1), (8, 3, 9, 1), (9, 0, 8, 1), (9, 2, 6, 1), (9, 3, 5, 1)]
    f = [(10, 0, 3, 1), (10, 2, 5, 1), (10, 3, 6, 1), (11, 0, 5, 3)]
    return a + b + c + d + e + f


def porch_chords():
    return [(i, (1, 3, 5) if i % 2 == 0 else (5, 7, 9)) for i in range(12)]


def yard_melody():
    a = [(0, 0, 8, 0.75), (0, 1, 5, 0.5), (0, 2, 6, 0.5), (0, 3, 8, 1), (1, 0, 10, 1), (1, 2, 8, 1), (1, 3, 5, 1)]
    b = [(2, 0, 6, 0.5), (2, 1, 8, 0.5), (2, 2, 9, 1), (2, 3, 10, 1), (3, 0, 8, 2), (3, 2.5, 6, 1)]
    c = [(4, 0, 12, 1), (4, 2, 10, 1), (4, 3, 8, 1), (5, 0, 6, 1), (5, 2, 5, 1), (5, 3, 8, 1)]
    d = [(6, 0, 9, 1), (6, 2, 8, 1), (6, 3, 6, 1), (7, 0, 5, 1.5), (7, 2, 8, 2)]
    e = [(8, 0, 8, 0.5), (8, 1, 10, 0.5), (8, 2, 12, 1.5), (9, 0, 10, 1), (9, 2, 8, 2)]
    f = [(10, 0, 6, 1), (10, 2, 5, 1), (10, 3, 3, 1), (11, 0, 8, 3)]
    return a + b + c + d + e + f


def yard_chords():
    return [(i, (1, 3, 5) if i % 4 != 3 else (4, 6, 8)) for i in range(12)]


def neighbor_melody():
    a = [(0, 0, 5, 0.5), (0, 0.5, 6, 0.5), (0, 1, 5, 0.5), (0, 2, 3, 0.5), (0, 3, 5, 1), (1, 0, 6, 0.5), (1, 1, 8, 1), (1, 2.5, 6, 0.5), (1, 3, 5, 1)]
    b = [(2, 0, 8, 0.5), (2, 1, 6, 0.5), (2, 2, 5, 0.5), (2, 3, 4, 1), (3, 0, 3, 1), (3, 2, 2, 1), (3, 3, 1, 1)]
    c = [(4, 0, 8, 0.75), (4, 1, 9, 0.5), (4, 2, 10, 1), (4, 3, 8, 1), (5, 0, 6, 1), (5, 2, 5, 1), (5, 3, 3, 1)]
    d = [(6, 0, 5, 0.5), (6, 1, 6, 0.5), (6, 2, 8, 1), (6, 3, 5, 1), (7, 0, 4, 1), (7, 2, 3, 1), (7, 3, 1, 1)]
    e = [(8, 0, 10, 1), (8, 2, 8, 1), (8, 3, 6, 1), (9, 0, 5, 0.5), (9, 1, 6, 0.5), (9, 2, 8, 1), (9, 3, 5, 1)]
    f = [(10, 0, 4, 1), (10, 2, 5, 1), (10, 3, 6, 1), (11, 0, 1, 3)]
    return a + b + c + d + e + f


def neighbor_chords():
    return [(i, (1, 3, 5) if i % 2 == 0 else (6, 1, 3)) for i in range(12)]


if __name__ == "__main__":
    main()
