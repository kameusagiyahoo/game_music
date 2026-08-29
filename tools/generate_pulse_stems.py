#!/usr/bin/env python3
from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44100
CHANNELS = 2
BIT_DEPTH = 16
BPM = 112
BARS = 4
BEATS_PER_BAR = 4
BEAT = 60.0 / BPM
BAR = BEAT * BEATS_PER_BAR
STEP = BEAT / 2.0
DURATION = BARS * BAR
SAMPLES = round(DURATION * SAMPLE_RATE)
STEM_OUT = Path("assets/stems/pulse")
STINGER_OUT = Path("assets/stingers/pulse")
TRANSITION_OUT = Path("assets/transitions/pulse")

MELODY = [69, None, 72, None, 76, None, 72, None, 67, None, 71, None, 74, None, 71, None]
BASS = [45, 41, 43, 40]
CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]


def midi(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def add_tone(buf: list[float], start: float, duration: float, freq: float, amp: float, kind: str) -> None:
    start_i = round(start * SAMPLE_RATE)
    count = min(round(duration * SAMPLE_RATE), len(buf) - start_i)
    if count <= 0:
        return
    attack = max(1, round(0.01 * SAMPLE_RATE))
    release = max(1, round(0.05 * SAMPLE_RATE))
    for i in range(count):
        t = i / SAMPLE_RATE
        phase = (freq * t) % 1.0
        if kind == "saw":
            sample = 2.0 * phase - 1.0
        elif kind == "triangle":
            sample = 2.0 * abs(2.0 * phase - 1.0) - 1.0
        elif kind == "square":
            sample = 1.0 if phase < 0.5 else -1.0
        else:
            sample = math.sin(2.0 * math.pi * freq * t)
        envelope = 1.0
        if i < attack:
            envelope *= i / attack
        if i >= count - release:
            envelope *= max(0.0, (count - i - 1) / release)
        buf[start_i + i] += sample * amp * envelope


def db_to_gain(db: float) -> float:
    return 10.0 ** (db / 20.0)


def stereo_rms_dbfs(left: list[float], right: list[float]) -> float:
    count = min(len(left), len(right))
    if count <= 0:
        return -120.0
    energy = sum((l * l + r * r) * 0.5 for l, r in zip(left, right))
    rms = math.sqrt(max(energy / count, 1e-12))
    return 20.0 * math.log10(max(rms, 1e-12))


def stereo_peak_dbfs(left: list[float], right: list[float]) -> float:
    peak = max(
        max((abs(v) for v in left), default=0.0),
        max((abs(v) for v in right), default=0.0),
        1e-12,
    )
    return 20.0 * math.log10(peak)


def master_stereo(
    left: list[float],
    right: list[float],
    *,
    target_rms_dbfs: float,
    peak_ceiling_dbfs: float,
) -> tuple[list[float], list[float], dict[str, float]]:
    current_rms = stereo_rms_dbfs(left, right)
    current_peak = stereo_peak_dbfs(left, right)

    rms_gain = db_to_gain(target_rms_dbfs - current_rms)
    peak_gain = db_to_gain(peak_ceiling_dbfs - current_peak)
    gain = min(rms_gain, peak_gain)

    mastered_left = [value * gain for value in left]
    mastered_right = [value * gain for value in right]

    return mastered_left, mastered_right, {
        "gain_db": 20.0 * math.log10(max(gain, 1e-12)),
        "rms_dbfs": stereo_rms_dbfs(mastered_left, mastered_right),
        "peak_dbfs": stereo_peak_dbfs(mastered_left, mastered_right),
    }


def stereoize(
    samples: list[float],
    width: float,
    delay_ms: float,
    *,
    circular: bool,
) -> tuple[list[float], list[float]]:
    """Create deterministic stereo without changing the sample count.

    Looping stems use circular micro-delays so the stereo image remains
    periodic across the loop boundary. One-shot assets use zero-padded
    delays to avoid wrapping their tail into the attack.
    """
    count = len(samples)
    if count == 0:
        return [], []

    width = max(0.0, min(0.72, width))
    delay = max(1, round(delay_ms * SAMPLE_RATE / 1000.0))
    dry = 1.0 - width * 0.42
    side = width * 0.58

    left = [0.0] * count
    right = [0.0] * count

    for i, value in enumerate(samples):
        if circular:
            left_source = samples[(i - delay) % count]
            right_source = samples[(i + delay) % count]
        else:
            left_source = samples[i - delay] if i >= delay else 0.0
            right_source = samples[i + delay] if i + delay < count else 0.0

        # A slow, deterministic pan drift prevents pure dual-mono while
        # remaining periodic for loop assets.
        phase = 2.0 * math.pi * i / max(1, count)
        pan = math.sin(phase * 2.0) * width * 0.12
        left[i] = value * (dry - pan) + left_source * side
        right[i] = value * (dry + pan) + right_source * side

    return left, right


def write_wav(
    path: Path,
    samples: list[float],
    *,
    width: float = 0.24,
    delay_ms: float = 3.0,
    circular: bool = False,
    target_rms_dbfs: float = -20.0,
    peak_ceiling_dbfs: float = -3.0,
) -> dict[str, float]:
    left, right = stereoize(samples, width, delay_ms, circular=circular)
    left, right, stats = master_stereo(
        left,
        right,
        target_rms_dbfs=target_rms_dbfs,
        peak_ceiling_dbfs=peak_ceiling_dbfs,
    )
    pcm = bytearray()

    for left_value, right_value in zip(left, right):
        left_sample = max(-1.0, min(1.0, left_value))
        right_sample = max(-1.0, min(1.0, right_value))
        pcm.extend(struct.pack(
            "<hh",
            round(left_sample * 32767),
            round(right_sample * 32767),
        ))

    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(BIT_DEPTH // 8)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(bytes(pcm))

    return stats


def make_drums() -> list[float]:
    rng = random.Random(7)
    buf = [0.0] * SAMPLES
    total_beats = BARS * BEATS_PER_BAR
    for beat_index in range(total_beats):
        start = beat_index * BEAT
        start_i = round(start * SAMPLE_RATE)
        kick_n = round(0.13 * SAMPLE_RATE)
        for i in range(min(kick_n, SAMPLES - start_i)):
            t = i / SAMPLE_RATE
            freq = 44.0 + 76.0 * math.exp(-18.0 * t)
            amp = 0.30 if beat_index % 4 in (0, 2) else 0.18
            buf[start_i + i] += math.sin(2 * math.pi * freq * t) * math.exp(-26 * t) * amp
        for half in (0.0, 0.5):
            hat_i = round((start + half * BEAT) * SAMPLE_RATE)
            hat_n = round(0.045 * SAMPLE_RATE)
            previous = 0.0
            for i in range(min(hat_n, SAMPLES - hat_i)):
                white = rng.uniform(-1.0, 1.0)
                high = white - previous
                previous = white
                buf[hat_i + i] += high * math.exp(-70 * i / SAMPLE_RATE) * 0.035
        if beat_index % 4 in (1, 3):
            clap_n = round(0.08 * SAMPLE_RATE)
            for i in range(min(clap_n, SAMPLES - start_i)):
                buf[start_i + i] += rng.uniform(-1.0, 1.0) * math.exp(-34 * i / SAMPLE_RATE) * 0.05
    return buf


def make_bass() -> list[float]:
    buf = [0.0] * SAMPLES
    for bar_index in range(BARS):
        for beat_index, note in enumerate(BASS):
            add_tone(buf, bar_index * BAR + beat_index * BEAT, 0.44, midi(note), 0.12, "saw")
    return buf


def make_chords() -> list[float]:
    buf = [0.0] * SAMPLES
    for bar_index in range(BARS):
        for beat_index, chord in enumerate(CHORDS):
            start = bar_index * BAR + beat_index * BEAT
            for note in chord:
                add_tone(buf, start, 0.48, midi(note + 12), 0.043, "sine")
    return buf


def make_melody() -> list[float]:
    buf = [0.0] * SAMPLES
    total_steps = round(DURATION / STEP)
    for step_index in range(total_steps):
        note = MELODY[step_index % len(MELODY)]
        if note is not None:
            add_tone(buf, step_index * STEP, 0.17, midi(note), 0.09, "triangle")
    return buf


def make_sparkle() -> list[float]:
    buf = [0.0] * SAMPLES
    total_steps = round(DURATION / STEP)
    for step_index in range(total_steps):
        note = MELODY[step_index % len(MELODY)]
        if note is not None and step_index % 2 == 1:
            add_tone(buf, step_index * STEP, 0.10, midi(note + 12), 0.045, "sine")
    for bar_index in range(BARS):
        for offset, note in enumerate((81, 84, 88)):
            add_tone(buf, bar_index * BAR + offset * 0.08, 0.13, midi(note), 0.024, "sine")
    return buf


def make_victory_stinger() -> list[float]:
    duration = 2.25
    buf = [0.0] * round(duration * SAMPLE_RATE)
    phrase = [69, 73, 76, 81]
    for index, note in enumerate(phrase):
        start = index * 0.18
        add_tone(buf, start, 0.34 if index < 3 else 0.72, midi(note), 0.11, "triangle")
        add_tone(buf, start, 0.20, midi(note + 12), 0.035, "sine")
    for note in (57, 61, 64, 69):
        add_tone(buf, 0.72, 1.05, midi(note), 0.050, "sine")
    for offset, note in enumerate((88, 93, 88, 93)):
        add_tone(buf, 1.05 + offset * 0.16, 0.16, midi(note), 0.027, "sine")
    return buf


def make_gameover_stinger() -> list[float]:
    duration = 2.10
    buf = [0.0] * round(duration * SAMPLE_RATE)
    phrase = [69, 64, 60, 57]
    for index, note in enumerate(phrase):
        start = index * 0.27
        add_tone(buf, start, 0.42 if index < 3 else 0.86, midi(note), 0.085, "triangle")
    for note in (45, 52, 57):
        add_tone(buf, 0.86, 0.95, midi(note), 0.040, "sine")
    add_tone(buf, 0.86, 0.72, midi(33), 0.045, "sine")
    return buf


def make_fill_transition() -> list[float]:
    duration = 0.82
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(17)

    hits = [0.0, 0.20, 0.38, 0.53, 0.65, 0.73]
    for index, start in enumerate(hits):
        start_i = round(start * SAMPLE_RATE)
        hit_n = min(round(0.12 * SAMPLE_RATE), count - start_i)
        for i in range(max(0, hit_n)):
            t = i / SAMPLE_RATE
            freq = 68.0 + 95.0 * math.exp(-20.0 * t)
            amp = 0.11 + index * 0.018
            buf[start_i + i] += math.sin(2 * math.pi * freq * t) * math.exp(-24 * t) * amp

        noise_n = min(round(0.055 * SAMPLE_RATE), count - start_i)
        for i in range(max(0, noise_n)):
            buf[start_i + i] += rng.uniform(-1.0, 1.0) * math.exp(-58 * i / SAMPLE_RATE) * (0.018 + index * 0.003)

    add_tone(buf, 0.58, 0.22, midi(81), 0.032, "triangle")
    add_tone(buf, 0.68, 0.14, midi(88), 0.030, "sine")
    return buf


def make_whoosh_transition() -> list[float]:
    duration = 0.72
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(23)
    previous = 0.0

    for i in range(count):
        t = i / SAMPLE_RATE
        progress = i / max(1, count - 1)
        white = rng.uniform(-1.0, 1.0)
        high = white - previous
        previous = white
        envelope = math.sin(math.pi * progress) ** 1.4
        buf[i] += high * envelope * (0.018 + 0.085 * progress)

        freq = 260.0 + 1700.0 * (progress ** 2)
        buf[i] += math.sin(2 * math.pi * freq * t) * envelope * 0.018

    return buf


def make_riser_transition() -> list[float]:
    duration = 1.12
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(31)
    previous = 0.0

    for i in range(count):
        t = i / SAMPLE_RATE
        progress = i / max(1, count - 1)
        envelope = min(1.0, progress * 1.3) * max(0.0, 1.0 - max(0.0, progress - 0.92) / 0.08)

        freq = 110.0 * (2.0 ** (progress * 3.0))
        buf[i] += math.sin(2 * math.pi * freq * t) * 0.030 * envelope
        buf[i] += math.sin(2 * math.pi * freq * 2.01 * t) * 0.013 * envelope

        white = rng.uniform(-1.0, 1.0)
        high = white - previous
        previous = white
        buf[i] += high * (0.010 + 0.050 * progress) * envelope

    add_tone(buf, 0.82, 0.30, midi(81), 0.028, "triangle")
    add_tone(buf, 0.95, 0.17, midi(88), 0.030, "sine")
    return buf


def make_impact_transition() -> list[float]:
    duration = 0.95
    count = round(duration * SAMPLE_RATE)
    buf = [0.0] * count
    rng = random.Random(47)

    for i in range(count):
        t = i / SAMPLE_RATE
        low_freq = 48.0 + 72.0 * math.exp(-16.0 * t)
        buf[i] += math.sin(2 * math.pi * low_freq * t) * math.exp(-5.2 * t) * 0.22

        if t < 0.14:
            buf[i] += rng.uniform(-1.0, 1.0) * math.exp(-28 * t) * 0.07

    for note in (45, 52, 57):
        add_tone(buf, 0.03, 0.72, midi(note), 0.032, "sine")

    add_tone(buf, 0.00, 0.20, midi(81), 0.028, "triangle")
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
        "drums": (0.22, 2.4, -20.0, -5.0),
        "bass": (0.08, 1.2, -21.0, -6.0),
        "chords": (0.46, 5.2, -22.0, -7.0),
        "melody": (0.34, 3.8, -21.0, -6.0),
        "sparkle": (0.58, 6.8, -24.0, -8.0),
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
            f"generated mastered stem: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    stingers = {
        "victory": make_victory_stinger(),
        "gameover": make_gameover_stinger(),
    }
    stinger_mastering = {
        "victory": (0.42, 4.8, -16.5, -2.5),
        "gameover": (0.30, 3.6, -18.0, -3.0),
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
            f"generated mastered stinger: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    transitions = {
        "fill": make_fill_transition(),
        "whoosh": make_whoosh_transition(),
        "riser": make_riser_transition(),
        "impact": make_impact_transition(),
    }
    transition_mastering = {
        "fill": (0.38, 3.6, -18.5, -4.0),
        "whoosh": (0.62, 7.0, -20.0, -5.0),
        "riser": (0.56, 6.2, -19.0, -4.5),
        "impact": (0.26, 2.8, -16.5, -2.5),
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
            f"generated mastered transition: {name}.wav "
            f"rms={stats['rms_dbfs']:.2f}dBFS peak={stats['peak_dbfs']:.2f}dBFS"
        )

    print(
        f"audio profile: {SAMPLE_RATE} Hz / {CHANNELS} ch / {BIT_DEPTH}-bit PCM"
    )
    print(
        f"stems: {BARS} bars / {BPM} BPM / {SAMPLES} frames / {DURATION:.6f}s"
    )


if __name__ == "__main__":
    main()
