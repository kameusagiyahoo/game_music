#!/usr/bin/env python3
from __future__ import annotations

import math
import random
from pathlib import Path

from generate_pulse_stems import add_tone, midi, write_wav

SAMPLE_RATE = 44_100
BPM = 108
BARS = 4
BEATS_PER_BAR = 4
BEAT = 60.0 / BPM
BAR = BEAT * BEATS_PER_BAR
STEP = BEAT / 2.0
DURATION = BARS * BAR
SAMPLES = round(DURATION * SAMPLE_RATE)

STEM_OUT = Path("assets/stems/fantasy")
STINGER_OUT = Path("assets/stingers/fantasy")
TRANSITION_OUT = Path("assets/transitions/fantasy")

BASS_ROOTS = [38, 34, 41, 36]  # D2 / Bb1 / F2 / C2
CHORDS = [
    [62, 65, 69],  # Dm
    [58, 62, 65],  # Bb
    [65, 69, 72],  # F
    [60, 64, 67],  # C
]
MELODY = [
    74, 77, 81, 79, 77, 74, 72, 69,
    70, 74, 77, 74, 72, 69, 67, 69,
]


def add_pluck(
    buf: list[float],
    start: float,
    duration: float,
    note: int,
    amp: float,
) -> None:
    start_i = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(buf) - start_i)
    if count <= 0:
        return

    freq = midi(note)
    for i in range(count):
        t = i / SAMPLE_RATE
        attack = min(1.0, t / 0.006)
        envelope = attack * math.exp(-5.8 * t / max(duration, 0.01))
        fundamental = math.sin(2 * math.pi * freq * t)
        harmonic = math.sin(2 * math.pi * freq * 2.01 * t) * 0.34
        shimmer = math.sin(2 * math.pi * freq * 3.99 * t) * 0.12
        buf[start_i + i] += (fundamental + harmonic + shimmer) * amp * envelope


def add_flute(
    buf: list[float],
    start: float,
    duration: float,
    note: int,
    amp: float,
) -> None:
    start_i = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(buf) - start_i)
    if count <= 0:
        return

    freq = midi(note)
    for i in range(count):
        t = i / SAMPLE_RATE
        attack = min(1.0, t / 0.035)
        release = min(1.0, max(0.0, duration - t) / 0.08)
        envelope = attack * release
        vibrato = 1.0 + 0.0045 * math.sin(2 * math.pi * 5.2 * t)
        sample = (
            math.sin(2 * math.pi * freq * vibrato * t)
            + 0.18 * math.sin(2 * math.pi * freq * 2.0 * t)
            + 0.06 * math.sin(2 * math.pi * freq * 3.0 * t)
        )
        buf[start_i + i] += sample * amp * envelope


def make_drums() -> list[float]:
    """Soft frame drum + shaker, avoiding electronic kick character."""
    rng = random.Random(127)
    buf = [0.0] * SAMPLES
    total_beats = BARS * BEATS_PER_BAR

    for beat_index in range(total_beats):
        start = beat_index * BEAT
        start_i = round(start * SAMPLE_RATE)

        if beat_index % 4 in (0, 2):
            hit_n = min(round(0.20 * SAMPLE_RATE), SAMPLES - start_i)
            for i in range(max(0, hit_n)):
                t = i / SAMPLE_RATE
                freq = 82.0 - 22.0 * min(1.0, t / 0.12)
                body = math.sin(2 * math.pi * freq * t)
                overtone = math.sin(2 * math.pi * freq * 1.63 * t) * 0.22
                buf[start_i + i] += (body + overtone) * math.exp(-17 * t) * 0.16

        for half in (0.0, 0.5):
            shaker_i = round((start + half * BEAT) * SAMPLE_RATE)
            shaker_n = min(round(0.055 * SAMPLE_RATE), SAMPLES - shaker_i)
            previous = 0.0
            for i in range(max(0, shaker_n)):
                white = rng.uniform(-1.0, 1.0)
                high = white - previous
                previous = white
                buf[shaker_i + i] += high * math.exp(-56 * i / SAMPLE_RATE) * 0.018

        if beat_index % 4 == 3:
            tap_i = round((start + 0.72 * BEAT) * SAMPLE_RATE)
            tap_n = min(round(0.07 * SAMPLE_RATE), SAMPLES - tap_i)
            for i in range(max(0, tap_n)):
                t = i / SAMPLE_RATE
                buf[tap_i + i] += math.sin(2 * math.pi * 176 * t) * math.exp(-42 * t) * 0.032

    return buf


def make_bass() -> list[float]:
    """Warm drone with root/fifth movement."""
    buf = [0.0] * SAMPLES
    for bar_index, root in enumerate(BASS_ROOTS):
        start = bar_index * BAR
        add_tone(buf, start, BAR * 0.98, midi(root), 0.065, "triangle")
        add_tone(buf, start, BAR * 0.96, midi(root + 7), 0.022, "sine")
        add_tone(buf, start + BEAT * 2, BEAT * 1.85, midi(root + 12), 0.018, "sine")
    return buf


def make_chords() -> list[float]:
    """Harp-like broken chords."""
    buf = [0.0] * SAMPLES
    for bar_index, chord in enumerate(CHORDS):
        base = bar_index * BAR
        pattern = [0, 1, 2, 1, 0, 2, 1, 2]
        for step_index, chord_index in enumerate(pattern):
            note = chord[chord_index]
            add_pluck(
                buf,
                base + step_index * STEP,
                0.52,
                note + 12,
                0.042 if step_index % 2 == 0 else 0.033,
            )
    return buf


def make_melody() -> list[float]:
    """Airy flute-like lead with deliberate rests."""
    buf = [0.0] * SAMPLES
    total_steps = round(DURATION / STEP)
    for step_index in range(total_steps):
        note = MELODY[step_index % len(MELODY)]
        if step_index % 4 in (1, 3):
            continue
        duration = STEP * (1.55 if step_index % 8 == 0 else 0.88)
        add_flute(buf, step_index * STEP, duration, note, 0.052)
    return buf


def make_sparkle() -> list[float]:
    """Bell/chime accents, sparse enough for adaptive layering."""
    buf = [0.0] * SAMPLES
    bell_notes = [86, 89, 93, 89]
    for bar_index in range(BARS):
        base = bar_index * BAR
        for index, note in enumerate(bell_notes):
            start = base + (index * 2 + 1) * STEP
            add_pluck(buf, start, 0.68, note, 0.022)
            add_tone(buf, start, 0.42, midi(note + 12), 0.008, "sine")
    return buf


def make_victory_stinger() -> list[float]:
    duration = 2.55
    buf = [0.0] * round(duration * SAMPLE_RATE)
    phrase = [74, 77, 81, 86]
    for index, note in enumerate(phrase):
        start = index * 0.22
        add_flute(buf, start, 0.44 if index < 3 else 1.0, note, 0.060)
        add_pluck(buf, start, 0.72, note + 12, 0.028)
    for note in (62, 65, 69, 74):
        add_tone(buf, 0.82, 1.30, midi(note), 0.026, "sine")
    for offset, note in enumerate((86, 89, 93, 98)):
        add_pluck(buf, 1.15 + offset * 0.16, 0.55, note, 0.018)
    return buf


def make_gameover_stinger() -> list[float]:
    duration = 2.45
    buf = [0.0] * round(duration * SAMPLE_RATE)
    phrase = [74, 72, 69, 65]
    for index, note in enumerate(phrase):
        start = index * 0.31
        add_flute(buf, start, 0.48 if index < 3 else 1.05, note, 0.046)
        add_pluck(buf, start, 0.56, note + 12, 0.017)
    for note in (50, 57, 62):
        add_tone(buf, 0.96, 1.18, midi(note), 0.022, "sine")
    return buf


def make_fill_transition() -> list[float]:
    """Frame-drum roll for the final beat before tension."""
    duration = 0.92
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(211)
    hits = [0.00, 0.22, 0.41, 0.57, 0.69, 0.78, 0.85]
    for index, start in enumerate(hits):
        start_i = round(start * SAMPLE_RATE)
        hit_n = min(round(0.12 * SAMPLE_RATE), count - start_i)
        for i in range(max(0, hit_n)):
            t = i / SAMPLE_RATE
            freq = 118.0 + index * 10.0
            body = math.sin(2 * math.pi * freq * t) * math.exp(-30 * t)
            noise = rng.uniform(-1.0, 1.0) * math.exp(-52 * t) * 0.12
            buf[start_i + i] += (body + noise) * (0.038 + index * 0.006)
    return buf


def make_whoosh_transition() -> list[float]:
    """Wind-like noise sweep."""
    duration = 0.82
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(223)
    smooth = 0.0
    for i in range(count):
        progress = i / max(1, count - 1)
        white = rng.uniform(-1.0, 1.0)
        smooth = smooth * (0.91 - progress * 0.10) + white * (0.09 + progress * 0.10)
        envelope = math.sin(math.pi * progress) ** 1.3
        buf[i] += smooth * envelope * (0.025 + 0.075 * progress)
    return buf


def make_riser_transition() -> list[float]:
    """Harp glissando + breath, ending at the target boundary."""
    duration = 1.28
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(227)

    gliss = [62, 65, 69, 72, 74, 77, 81, 86, 89]
    for index, note in enumerate(gliss):
        start = 0.08 + index * 0.115
        add_pluck(buf, start, 0.46, note, 0.020 + index * 0.0015)

    smooth = 0.0
    for i in range(count):
        progress = i / max(1, count - 1)
        white = rng.uniform(-1.0, 1.0)
        smooth = smooth * 0.92 + white * 0.08
        tail = max(0.0, 1.0 - max(0.0, progress - 0.94) / 0.06)
        buf[i] += smooth * progress * tail * 0.038

    return buf


def make_impact_transition() -> list[float]:
    """Low frame-drum impact with a soft suspended chord."""
    duration = 1.10
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(229)

    for i in range(count):
        t = i / SAMPLE_RATE
        low = math.sin(2 * math.pi * (72.0 - 22.0 * min(1.0, t / 0.18)) * t)
        buf[i] += low * math.exp(-6.0 * t) * 0.11
        if t < 0.16:
            buf[i] += rng.uniform(-1.0, 1.0) * math.exp(-30 * t) * 0.028

    for note in (50, 57, 62, 65):
        add_tone(buf, 0.03, 0.92, midi(note), 0.020, "sine")
    add_pluck(buf, 0.02, 0.68, 86, 0.018)
    return buf


def main() -> None:
    stems = {
        "drums": make_drums(),
        "bass": make_bass(),
        "chords": make_chords(),
        "melody": make_melody(),
        "sparkle": make_sparkle(),
    }
    stem_mastering = {
        "drums": (0.28, 3.0, -23.0, -7.0),
        "bass": (0.18, 1.8, -23.0, -8.0),
        "chords": (0.54, 6.0, -24.0, -9.0),
        "melody": (0.44, 4.8, -22.5, -7.0),
        "sparkle": (0.66, 7.2, -27.0, -10.0),
    }
    for name, samples in stems.items():
        width, delay_ms, target_rms, peak_ceiling = stem_mastering[name]
        stats = write_wav(
            STEM_OUT / f"{name}.wav",
            samples,
            width=width,
            delay_ms=delay_ms,
            circular=True,
            target_rms_dbfs=target_rms,
            peak_ceiling_dbfs=peak_ceiling,
        )
        print(
            f"generated fantasy stem: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    stingers = {
        "victory": make_victory_stinger(),
        "gameover": make_gameover_stinger(),
    }
    stinger_mastering = {
        "victory": (0.52, 5.4, -18.0, -4.0),
        "gameover": (0.42, 4.4, -20.0, -5.0),
    }
    for name, samples in stingers.items():
        width, delay_ms, target_rms, peak_ceiling = stinger_mastering[name]
        stats = write_wav(
            STINGER_OUT / f"{name}.wav",
            samples,
            width=width,
            delay_ms=delay_ms,
            target_rms_dbfs=target_rms,
            peak_ceiling_dbfs=peak_ceiling,
        )
        print(
            f"generated fantasy stinger: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    transitions = {
        "fill": make_fill_transition(),
        "whoosh": make_whoosh_transition(),
        "riser": make_riser_transition(),
        "impact": make_impact_transition(),
    }
    transition_mastering = {
        "fill": (0.40, 4.0, -21.0, -6.0),
        "whoosh": (0.68, 7.4, -23.0, -7.0),
        "riser": (0.62, 6.8, -21.5, -6.0),
        "impact": (0.34, 3.4, -19.0, -4.0),
    }
    for name, samples in transitions.items():
        width, delay_ms, target_rms, peak_ceiling = transition_mastering[name]
        stats = write_wav(
            TRANSITION_OUT / f"{name}.wav",
            samples,
            width=width,
            delay_ms=delay_ms,
            target_rms_dbfs=target_rms,
            peak_ceiling_dbfs=peak_ceiling,
        )
        print(
            f"generated fantasy transition: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    print(f"fantasy audio profile: {SAMPLE_RATE} Hz / stereo / 16-bit PCM")
    print(
        f"fantasy stems: {BARS} bars / {BPM} BPM / "
        f"{SAMPLES} frames / {DURATION:.6f}s"
    )


if __name__ == "__main__":
    main()
