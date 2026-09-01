#!/usr/bin/env python3
from __future__ import annotations

import math
import random
from pathlib import Path

from generate_pulse_stems import add_tone, midi, write_wav

DESIGN_VERSION = "clockwork-grove-v1"
SAMPLE_RATE = 44_100
BPM = 108
BARS = 4
BEATS_PER_BAR = 4
BEAT = 60.0 / BPM
BAR = BEAT * BEATS_PER_BAR
STEP = BEAT / 2.0
SIXTEENTH = BEAT / 4.0
DURATION = BARS * BAR
SAMPLES = round(DURATION * SAMPLE_RATE)

STEM_OUT = Path("assets/stems/clockwork")
STINGER_OUT = Path("assets/stingers/clockwork")
TRANSITION_OUT = Path("assets/transitions/clockwork")

BASS_ROOTS = [43, 40, 45, 38]  # G2 / E2 / A2 / D2
CHORDS = [
    [55, 59, 62],  # G
    [52, 55, 59],  # Em
    [57, 60, 64],  # Am
    [50, 54, 57],  # D
]
MELODY = [
    67, 71, 74, 72, 71, 67, 64, 67,
    71, 74, 79, 74, 72, 71, 67, 64,
]


def add_wood_pluck(
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
        attack = min(1.0, t / 0.004)
        decay = math.exp(-7.2 * t / max(duration, 0.01))
        fundamental = math.sin(2 * math.pi * freq * t)
        second = math.sin(2 * math.pi * freq * 2.03 * t) * 0.30
        fourth = math.sin(2 * math.pi * freq * 4.11 * t) * 0.09
        body = math.sin(2 * math.pi * 230 * t) * math.exp(-32 * t) * 0.10
        buf[start_i + i] += (
            fundamental + second + fourth + body
        ) * amp * attack * decay


def add_music_box(
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
        attack = min(1.0, t / 0.003)
        decay = math.exp(-5.4 * t / max(duration, 0.01))
        partials = (
            math.sin(2 * math.pi * freq * t)
            + 0.42 * math.sin(2 * math.pi * freq * 2.01 * t)
            + 0.18 * math.sin(2 * math.pi * freq * 3.97 * t)
            + 0.07 * math.sin(2 * math.pi * freq * 6.02 * t)
        )
        shimmer = 0.88 + 0.12 * math.sin(2 * math.pi * 6.0 * t)
        buf[start_i + i] += partials * amp * attack * decay * shimmer


def add_metal_click(
    buf: list[float],
    start: float,
    amp: float,
    pitch: float,
    seed: int,
) -> None:
    start_i = round(start * SAMPLE_RATE)
    count = min(round(0.065 * SAMPLE_RATE), len(buf) - start_i)
    if count <= 0:
        return

    rng = random.Random(seed)
    for i in range(count):
        t = i / SAMPLE_RATE
        ping = math.sin(2 * math.pi * pitch * t)
        ring = math.sin(2 * math.pi * pitch * 1.72 * t) * 0.42
        noise = rng.uniform(-1.0, 1.0) * 0.18
        buf[start_i + i] += (ping + ring + noise) * math.exp(-62 * t) * amp


def make_drums() -> list[float]:
    """Wooden thump, metal click and ratchet accents."""
    buf = [0.0] * SAMPLES
    total_beats = BARS * BEATS_PER_BAR

    for beat_index in range(total_beats):
        start = beat_index * BEAT
        start_i = round(start * SAMPLE_RATE)

        # Wooden low thump on quarter notes.
        hit_n = min(round(0.16 * SAMPLE_RATE), SAMPLES - start_i)
        amp = 0.13 if beat_index % 4 in (0, 2) else 0.09
        for i in range(max(0, hit_n)):
            t = i / SAMPLE_RATE
            freq = 92.0 - 28.0 * min(1.0, t / 0.10)
            body = math.sin(2 * math.pi * freq * t)
            knock = math.sin(2 * math.pi * 310 * t) * math.exp(-42 * t) * 0.22
            buf[start_i + i] += (body + knock) * math.exp(-18 * t) * amp

        # Gear tooth ticks on eighths.
        add_metal_click(buf, start, 0.018, 1280 + (beat_index % 4) * 90, 7000 + beat_index)
        add_metal_click(
            buf,
            start + 0.5 * BEAT,
            0.014,
            1540 + (beat_index % 3) * 110,
            7100 + beat_index,
        )

        # Small ratchet at the end of each bar.
        if beat_index % 4 == 3:
            for index, fraction in enumerate((0.66, 0.76, 0.84, 0.91)):
                add_metal_click(
                    buf,
                    start + fraction * BEAT,
                    0.010 + index * 0.002,
                    1750 + index * 140,
                    7200 + beat_index * 10 + index,
                )

    return buf


def make_bass() -> list[float]:
    """Warm triangle/sub drone with gentle clockwork pulses."""
    buf = [0.0] * SAMPLES
    for bar_index, root in enumerate(BASS_ROOTS):
        base = bar_index * BAR
        add_tone(buf, base, BAR * 0.97, midi(root), 0.050, "triangle")
        add_tone(buf, base, BAR * 0.95, midi(root - 12), 0.020, "sine")
        for beat_index in range(4):
            note = root + (7 if beat_index == 2 else 0)
            add_tone(
                buf,
                base + beat_index * BEAT,
                BEAT * 0.48,
                midi(note),
                0.018,
                "triangle",
            )
    return buf


def make_chords() -> list[float]:
    """Kalimba-like mechanical broken chords."""
    buf = [0.0] * SAMPLES
    pattern = [0, 2, 1, 2, 0, 1, 2, 1]
    for bar_index, chord in enumerate(CHORDS):
        base = bar_index * BAR
        for step_index, chord_index in enumerate(pattern):
            note = chord[chord_index] + 12
            add_wood_pluck(
                buf,
                base + step_index * STEP,
                0.46,
                note,
                0.034 if step_index % 4 == 0 else 0.026,
            )
    return buf


def make_melody() -> list[float]:
    """Music-box melody that keeps the original Clockwork motif."""
    buf = [0.0] * SAMPLES
    total_steps = BARS * 8
    for step_index in range(total_steps):
        if step_index % 8 in (1, 5):
            continue
        note = MELODY[step_index % len(MELODY)] + 12
        duration = STEP * (1.05 if step_index % 4 == 0 else 0.72)
        add_music_box(buf, step_index * STEP, duration, note, 0.034)
    return buf


def make_sparkle() -> list[float]:
    """Ticking gear bed with sparse tiny bells."""
    buf = [0.0] * SAMPLES

    total_sixteenths = BARS * BEATS_PER_BAR * 4
    for index in range(total_sixteenths):
        start = index * SIXTEENTH
        amp = 0.0065 if index % 4 else 0.010
        pitch = 1800 + (index % 5) * 120
        add_metal_click(buf, start, amp, pitch, 8000 + index)

    bell_notes = [83, 86, 91, 86]
    for bar_index, note in enumerate(bell_notes):
        add_music_box(
            buf,
            bar_index * BAR + 2.75 * BEAT,
            0.62,
            note,
            0.016,
        )

    return buf


def make_victory_stinger() -> list[float]:
    duration = 2.45
    buf = [0.0] * round(duration * SAMPLE_RATE)

    for index, note in enumerate((67, 71, 74, 79, 83)):
        start = index * 0.16
        add_music_box(buf, start, 0.56 if index < 4 else 1.0, note + 12, 0.045)
        add_wood_pluck(buf, start, 0.48, note, 0.026)

    for note in (55, 59, 62, 67):
        add_tone(buf, 0.74, 1.20, midi(note), 0.024, "triangle")

    for index in range(5):
        add_metal_click(buf, 0.78 + index * 0.11, 0.012, 1500 + index * 180, 9000 + index)

    return buf


def make_gameover_stinger() -> list[float]:
    duration = 2.35
    buf = [0.0] * round(duration * SAMPLE_RATE)

    for index, note in enumerate((74, 71, 67, 62, 59)):
        start = index * 0.24
        add_music_box(buf, start, 0.48 if index < 4 else 0.92, note + 12, 0.032)
        add_wood_pluck(buf, start, 0.44, note, 0.018)

    for note in (43, 50, 55):
        add_tone(buf, 0.92, 1.10, midi(note), 0.020, "sine")

    add_metal_click(buf, 1.02, 0.018, 920, 9100)
    return buf


def make_fill_transition() -> list[float]:
    """Accelerating ratchet roll before a state change."""
    duration = 0.88
    buf = [0.0] * round(duration * SAMPLE_RATE)
    starts = [0.00, 0.23, 0.41, 0.56, 0.67, 0.75, 0.81, 0.85]
    for index, start in enumerate(starts):
        add_metal_click(
            buf,
            start,
            0.020 + index * 0.004,
            980 + index * 120,
            10000 + index,
        )
        add_tone(buf, start, 0.09, 122 + index * 14, 0.012 + index * 0.002, "triangle")
    return buf


def make_whoosh_transition() -> list[float]:
    """Wind-up sweep: filtered-like noise plus rising metallic tone."""
    duration = 0.84
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(10100)
    smooth = 0.0

    for i in range(count):
        progress = i / max(1, count - 1)
        white = rng.uniform(-1.0, 1.0)
        smooth = smooth * (0.95 - progress * 0.12) + white * (0.05 + progress * 0.12)
        envelope = math.sin(math.pi * progress) ** 1.1
        tone = math.sin(2 * math.pi * (420 + 980 * progress) * i / SAMPLE_RATE)
        buf[i] += (
            smooth * (0.025 + 0.055 * progress)
            + tone * 0.010
        ) * envelope

    return buf


def make_riser_transition() -> list[float]:
    """Accelerating ticks + music-box ascent ending at the boundary."""
    duration = 1.22
    buf = [0.0] * round(duration * SAMPLE_RATE)

    tick_times = [0.00, 0.24, 0.43, 0.59, 0.72, 0.83, 0.92, 1.00, 1.07, 1.13, 1.18]
    for index, start in enumerate(tick_times):
        add_metal_click(
            buf,
            start,
            0.010 + index * 0.002,
            1250 + index * 100,
            10200 + index,
        )

    for index, note in enumerate((62, 67, 71, 74, 79, 83, 86)):
        add_music_box(buf, 0.10 + index * 0.15, 0.42, note, 0.014 + index * 0.0015)

    return buf


def make_impact_transition() -> list[float]:
    """Gear slam with low wooden body and short bell tail."""
    duration = 1.02
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(10300)

    for i in range(count):
        t = i / SAMPLE_RATE
        low_freq = 88.0 - 34.0 * min(1.0, t / 0.17)
        low = math.sin(2 * math.pi * low_freq * t)
        metal = math.sin(2 * math.pi * 1120 * t) * math.exp(-38 * t)
        noise = rng.uniform(-1.0, 1.0) * math.exp(-28 * t)
        buf[i] += (
            low * math.exp(-6.5 * t) * 0.13
            + metal * 0.035
            + noise * 0.025
        )

    for note in (43, 50, 55, 59):
        add_tone(buf, 0.03, 0.78, midi(note), 0.018, "triangle")

    add_music_box(buf, 0.025, 0.64, 83, 0.016)
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
        "drums": (0.30, 3.0, -21.5, -5.5),
        "bass": (0.16, 1.8, -22.0, -7.0),
        "chords": (0.56, 5.8, -23.0, -8.0),
        "melody": (0.48, 4.8, -21.5, -6.0),
        "sparkle": (0.72, 7.0, -25.5, -8.5),
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
            f"generated clockwork stem: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    stingers = {
        "victory": make_victory_stinger(),
        "gameover": make_gameover_stinger(),
    }
    stinger_mastering = {
        "victory": (0.48, 5.0, -17.0, -3.5),
        "gameover": (0.38, 4.0, -19.0, -4.5),
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
            f"generated clockwork stinger: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    transitions = {
        "fill": make_fill_transition(),
        "whoosh": make_whoosh_transition(),
        "riser": make_riser_transition(),
        "impact": make_impact_transition(),
    }
    transition_mastering = {
        "fill": (0.44, 4.4, -19.5, -4.5),
        "whoosh": (0.66, 6.8, -21.0, -5.5),
        "riser": (0.60, 6.0, -19.5, -4.5),
        "impact": (0.34, 3.4, -17.0, -3.0),
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
            f"generated clockwork transition: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    print(f"clockwork design: {DESIGN_VERSION}")
    print(f"clockwork audio profile: {SAMPLE_RATE} Hz / stereo / 16-bit PCM")
    print(
        f"clockwork stems: {BARS} bars / {BPM} BPM / "
        f"{SAMPLES} frames / {DURATION:.6f}s"
    )


if __name__ == "__main__":
    main()
