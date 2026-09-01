#!/usr/bin/env python3
from __future__ import annotations

import math
import random
from pathlib import Path

from generate_pulse_stems import add_tone, midi, write_wav

DESIGN_VERSION = "neon-drive-v1"
SAMPLE_RATE = 44_100
BPM = 132
BARS = 4
BEATS_PER_BAR = 4
BEAT = 60.0 / BPM
BAR = BEAT * BEATS_PER_BAR
STEP = BEAT / 2.0
SIXTEENTH = BEAT / 4.0
DURATION = BARS * BAR
SAMPLES = round(DURATION * SAMPLE_RATE)

STEM_OUT = Path("assets/stems/neon")
STINGER_OUT = Path("assets/stingers/neon")
TRANSITION_OUT = Path("assets/transitions/neon")

BASS_ROOTS = [40, 43, 45, 38]  # E2 / G2 / A2 / D2
CHORDS = [
    [52, 55, 59],  # Em-ish
    [55, 59, 62],  # G
    [57, 60, 64],  # Am
    [50, 54, 57],  # D
]
MELODY = [
    76, 79, 83, 81, 79, 76, 74, 76,
    79, 83, 86, 83, 81, 79, 76, 74,
]


def add_neon_pluck(
    buf: list[float],
    start: float,
    duration: float,
    note: int,
    amp: float,
    detune: float = 0.0,
) -> None:
    start_i = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(buf) - start_i)
    if count <= 0:
        return

    freq = midi(note) * (2.0 ** (detune / 1200.0))
    for i in range(count):
        t = i / SAMPLE_RATE
        attack = min(1.0, t / 0.004)
        decay = math.exp(-8.5 * t / max(duration, 0.01))
        phase = (freq * t) % 1.0
        square = 1.0 if phase < 0.5 else -1.0
        saw = 2.0 * phase - 1.0
        sine = math.sin(2 * math.pi * freq * t)
        sample = 0.48 * square + 0.32 * saw + 0.20 * sine
        buf[start_i + i] += sample * amp * attack * decay


def add_sub_saw(
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
        attack = min(1.0, t / 0.008)
        release = min(1.0, max(0.0, duration - t) / 0.055)
        phase = (freq * t) % 1.0
        saw = 2.0 * phase - 1.0
        sub = math.sin(2 * math.pi * freq * 0.5 * t)
        octave = math.sin(2 * math.pi * freq * 2.0 * t)
        pulse = 0.92 + 0.08 * math.sin(2 * math.pi * 2.2 * t)
        buf[start_i + i] += (
            0.48 * saw + 0.44 * sub + 0.08 * octave
        ) * amp * attack * release * pulse


def add_noise_hit(
    buf: list[float],
    start: float,
    duration: float,
    amp: float,
    seed: int,
    decay: float,
) -> None:
    start_i = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(buf) - start_i)
    if count <= 0:
        return

    rng = random.Random(seed)
    previous = 0.0
    for i in range(count):
        t = i / SAMPLE_RATE
        white = rng.uniform(-1.0, 1.0)
        high = white - previous * 0.72
        previous = white
        buf[start_i + i] += high * math.exp(-decay * t) * amp


def make_drums() -> list[float]:
    """Tight electronic kick/snare/hat pattern with a clear 132 BPM grid."""
    buf = [0.0] * SAMPLES
    total_beats = BARS * BEATS_PER_BAR

    for beat_index in range(total_beats):
        beat_start = beat_index * BEAT

        # Kick on each beat, accented on 1 and 3.
        start_i = round(beat_start * SAMPLE_RATE)
        hit_n = min(round(0.16 * SAMPLE_RATE), SAMPLES - start_i)
        kick_amp = 0.18 if beat_index % 4 in (0, 2) else 0.12
        for i in range(max(0, hit_n)):
            t = i / SAMPLE_RATE
            freq = 112.0 - 58.0 * min(1.0, t / 0.09)
            click = math.sin(2 * math.pi * 920 * t) * math.exp(-85 * t) * 0.16
            body = math.sin(2 * math.pi * freq * t)
            buf[start_i + i] += (body + click) * math.exp(-22 * t) * kick_amp

        # Snare/clap on beats 2 and 4.
        if beat_index % 4 in (1, 3):
            add_noise_hit(
                buf,
                beat_start,
                0.13,
                0.070,
                1000 + beat_index,
                25.0,
            )
            add_tone(buf, beat_start, 0.11, 196.0, 0.028, "triangle")

        # Closed hats on eighths, extra sixteenth before beat 4.
        for half in (0.0, 0.5):
            add_noise_hit(
                buf,
                beat_start + half * BEAT,
                0.045,
                0.024 if half else 0.018,
                2000 + beat_index * 10 + int(half * 10),
                70.0,
            )

        if beat_index % 4 == 3:
            add_noise_hit(
                buf,
                beat_start + 0.75 * BEAT,
                0.035,
                0.018,
                3000 + beat_index,
                82.0,
            )

    return buf


def make_bass() -> list[float]:
    """Short saw/sub pulses that leave room for the kick."""
    buf = [0.0] * SAMPLES
    pattern = [0, 0, 7, 0, 12, 7, 0, 7]
    for bar_index, root in enumerate(BASS_ROOTS):
        base = bar_index * BAR
        for step_index, interval in enumerate(pattern):
            if step_index in (3, 7):
                continue
            note = root + interval
            add_sub_saw(
                buf,
                base + step_index * STEP,
                STEP * 0.72,
                note,
                0.058 if step_index % 2 == 0 else 0.046,
            )
    return buf


def make_chords() -> list[float]:
    """Wide syncopated synth stabs."""
    buf = [0.0] * SAMPLES
    for bar_index, chord in enumerate(CHORDS):
        base = bar_index * BAR
        for hit in (0.0, 1.5, 2.5):
            start = base + hit * BEAT
            for note_index, note in enumerate(chord):
                add_neon_pluck(
                    buf,
                    start,
                    BEAT * 0.78,
                    note + 12,
                    0.025,
                    detune=(-5.0 if note_index == 0 else 5.0 if note_index == 2 else 0.0),
                )
    return buf


def make_melody() -> list[float]:
    """Short square/pluck lead echoing the original procedural Neon motif."""
    buf = [0.0] * SAMPLES
    total_steps = BARS * 8
    for step_index in range(total_steps):
        note = MELODY[step_index % len(MELODY)]
        if step_index % 8 in (1, 5):
            continue
        start = step_index * STEP
        add_neon_pluck(buf, start, STEP * 0.62, note, 0.042)
        if step_index % 4 == 0:
            add_neon_pluck(buf, start + 0.018, STEP * 0.48, note + 12, 0.010, detune=7.0)
    return buf


def make_sparkle() -> list[float]:
    """Sixteenth-note arpeggio and restrained digital air."""
    buf = [0.0] * SAMPLES
    rng = random.Random(404)

    for bar_index, chord in enumerate(CHORDS):
        base = bar_index * BAR
        arp = [0, 1, 2, 1] * 4
        for step_index, chord_index in enumerate(arp):
            note = chord[chord_index] + 24
            add_neon_pluck(
                buf,
                base + step_index * SIXTEENTH,
                SIXTEENTH * 0.66,
                note,
                0.012 if step_index % 4 else 0.016,
            )

    # Very low-level deterministic digital texture.
    smooth = 0.0
    for i in range(SAMPLES):
        white = rng.uniform(-1.0, 1.0)
        smooth = smooth * 0.965 + white * 0.035
        gate = 0.5 + 0.5 * math.sin(2 * math.pi * 1.1 * i / SAMPLE_RATE)
        buf[i] += smooth * gate * 0.0035

    return buf


def make_victory_stinger() -> list[float]:
    duration = 2.25
    buf = [0.0] * round(duration * SAMPLE_RATE)
    phrase = [76, 79, 83, 88]
    for index, note in enumerate(phrase):
        start = index * 0.16
        add_neon_pluck(buf, start, 0.42 if index < 3 else 0.92, note, 0.060)
        add_neon_pluck(buf, start + 0.018, 0.32, note + 12, 0.018, detune=6.0)
    for note in (52, 59, 64):
        add_tone(buf, 0.62, 1.12, midi(note), 0.030, "saw")
    add_noise_hit(buf, 0.63, 0.20, 0.035, 5100, 26.0)
    return buf


def make_gameover_stinger() -> list[float]:
    duration = 2.15
    buf = [0.0] * round(duration * SAMPLE_RATE)
    phrase = [83, 79, 76, 71]
    for index, note in enumerate(phrase):
        start = index * 0.24
        add_neon_pluck(buf, start, 0.40 if index < 3 else 0.82, note, 0.045)
    for note in (40, 47, 52):
        add_tone(buf, 0.78, 1.10, midi(note), 0.027, "triangle")
    add_noise_hit(buf, 0.78, 0.34, 0.025, 5200, 15.0)
    return buf


def make_fill_transition() -> list[float]:
    duration = 0.78
    buf = [0.0] * round(duration * SAMPLE_RATE)
    hits = [0.00, 0.18, 0.33, 0.45, 0.56, 0.65, 0.72]
    for index, start in enumerate(hits):
        add_noise_hit(buf, start, 0.085, 0.030 + index * 0.005, 6000 + index, 45.0)
        add_tone(buf, start, 0.085, 150 + index * 28, 0.022 + index * 0.003, "triangle")
    return buf


def make_whoosh_transition() -> list[float]:
    duration = 0.70
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(6100)
    smooth = 0.0
    for i in range(count):
        progress = i / max(1, count - 1)
        white = rng.uniform(-1.0, 1.0)
        smooth = smooth * (0.94 - progress * 0.10) + white * (0.06 + progress * 0.10)
        tremolo = 0.80 + 0.20 * math.sin(2 * math.pi * (5 + 18 * progress) * i / SAMPLE_RATE)
        envelope = math.sin(math.pi * progress) ** 0.8
        buf[i] += smooth * envelope * tremolo * (0.035 + 0.090 * progress)
    return buf


def make_riser_transition() -> list[float]:
    duration = 1.05
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(6200)

    for index, note in enumerate((64, 67, 71, 76, 79, 83, 88, 91)):
        add_neon_pluck(buf, 0.04 + index * 0.105, 0.34, note, 0.018 + index * 0.002)

    phase = 0.0
    for i in range(count):
        progress = i / max(1, count - 1)
        freq = 180.0 * (2.0 ** (progress * 2.7))
        phase += freq / SAMPLE_RATE
        saw = 2.0 * (phase % 1.0) - 1.0
        noise = rng.uniform(-1.0, 1.0) * 0.12
        tail = min(1.0, max(0.0, (1.0 - progress) / 0.06))
        buf[i] += (saw * 0.020 + noise * 0.012) * progress * tail

    return buf


def make_impact_transition() -> list[float]:
    duration = 0.92
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(6300)

    for i in range(count):
        t = i / SAMPLE_RATE
        freq = 96.0 - 48.0 * min(1.0, t / 0.20)
        low = math.sin(2 * math.pi * freq * t)
        click = math.sin(2 * math.pi * 1600 * t) * math.exp(-70 * t)
        noise = rng.uniform(-1.0, 1.0) * math.exp(-32 * t)
        buf[i] += (
            low * math.exp(-7.0 * t) * 0.16
            + click * 0.035
            + noise * 0.035
        )

    for note in (40, 47, 52, 59):
        add_tone(buf, 0.025, 0.72, midi(note), 0.022, "saw")
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
        "drums": (0.24, 2.4, -20.0, -4.5),
        "bass": (0.12, 1.4, -20.5, -6.0),
        "chords": (0.58, 5.6, -22.0, -7.0),
        "melody": (0.42, 4.0, -20.0, -5.0),
        "sparkle": (0.72, 7.2, -24.0, -7.0),
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
            f"generated neon stem: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    stingers = {
        "victory": make_victory_stinger(),
        "gameover": make_gameover_stinger(),
    }
    stinger_mastering = {
        "victory": (0.50, 5.0, -16.0, -2.5),
        "gameover": (0.38, 3.8, -18.0, -3.0),
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
            f"generated neon stinger: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    transitions = {
        "fill": make_fill_transition(),
        "whoosh": make_whoosh_transition(),
        "riser": make_riser_transition(),
        "impact": make_impact_transition(),
    }
    transition_mastering = {
        "fill": (0.42, 4.0, -18.0, -3.5),
        "whoosh": (0.72, 7.4, -20.0, -4.5),
        "riser": (0.64, 6.4, -18.5, -3.5),
        "impact": (0.34, 3.2, -15.5, -2.0),
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
            f"generated neon transition: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    print(f"neon design: {DESIGN_VERSION}")
    print(f"neon audio profile: {SAMPLE_RATE} Hz / stereo / 16-bit PCM")
    print(
        f"neon stems: {BARS} bars / {BPM} BPM / "
        f"{SAMPLES} frames / {DURATION:.6f}s"
    )


if __name__ == "__main__":
    main()
