#!/usr/bin/env python3
from __future__ import annotations

import array
import math
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TARGETS = {
    "assets/stems/pulse/drums.wav": (-20.0, -5.0),
    "assets/stems/pulse/bass.wav": (-21.0, -6.0),
    "assets/stems/pulse/chords.wav": (-22.0, -7.0),
    "assets/stems/pulse/melody.wav": (-21.0, -6.0),
    "assets/stems/pulse/sparkle.wav": (-24.0, -8.0),
    "assets/stingers/pulse/victory.wav": (-16.5, -2.5),
    "assets/stingers/pulse/gameover.wav": (-18.0, -3.0),
    "assets/transitions/pulse/fill.wav": (-18.5, -4.0),
    "assets/transitions/pulse/whoosh.wav": (-20.0, -5.0),
    "assets/transitions/pulse/riser.wav": (-19.0, -4.5),
    "assets/transitions/pulse/impact.wav": (-16.5, -2.5),
}

PRESETS = {
    "focus": {"drums": 0.22, "bass": 0.42, "chords": 0.68, "melody": 0.48, "sparkle": 0.0},
    "build": {"drums": 0.56, "bass": 0.74, "chords": 0.82, "melody": 0.78, "sparkle": 0.28},
    "overdrive": {"drums": 1.0, "bass": 1.0, "chords": 0.92, "melody": 1.0, "sparkle": 0.78},
    "result": {"drums": 0.12, "bass": 0.32, "chords": 0.62, "melody": 0.54, "sparkle": 0.08},
}

HEADROOM_DB = -3.0
RMS_UPPER_TOLERANCE_DB = 0.20
RMS_LOWER_TOLERANCE_DB = 4.0
PEAK_TOLERANCE_DB = 0.12


def db(value: float) -> float:
    return 20.0 * math.log10(max(value, 1e-12))


def gain(db_value: float) -> float:
    return 10.0 ** (db_value / 20.0)


def read_stereo(path: Path) -> tuple[list[float], list[float]]:
    with wave.open(str(path), "rb") as wav:
        if wav.getnchannels() != 2:
            raise AssertionError(f"{path}: expected stereo")
        if wav.getsampwidth() != 2:
            raise AssertionError(f"{path}: expected 16-bit PCM")
        raw = wav.readframes(wav.getnframes())

    pcm = array.array("h")
    pcm.frombytes(raw)
    if sys.byteorder != "little":
        pcm.byteswap()

    scale = 1.0 / 32768.0
    left = [value * scale for value in pcm[0::2]]
    right = [value * scale for value in pcm[1::2]]
    return left, right


def measure(left: list[float], right: list[float]) -> tuple[float, float]:
    count = min(len(left), len(right))
    if count <= 0:
        return -120.0, -120.0

    energy = 0.0
    peak = 0.0
    for l, r in zip(left, right):
        energy += (l * l + r * r) * 0.5
        peak = max(peak, abs(l), abs(r))

    rms = math.sqrt(max(energy / count, 1e-12))
    return db(rms), db(peak)


def check_assets() -> tuple[list[str], dict[str, tuple[list[float], list[float]]]]:
    errors: list[str] = []
    stems: dict[str, tuple[list[float], list[float]]] = {}

    for relative, (target_rms, peak_ceiling) in TARGETS.items():
        path = ROOT / relative
        left, right = read_stereo(path)
        rms_db, peak_db = measure(left, right)

        if rms_db > target_rms + RMS_UPPER_TOLERANCE_DB:
            errors.append(
                f"{relative}: RMS {rms_db:.2f} dBFS exceeds target {target_rms:.2f}"
            )
        if rms_db < target_rms - RMS_LOWER_TOLERANCE_DB:
            errors.append(
                f"{relative}: RMS {rms_db:.2f} dBFS is too far below target {target_rms:.2f}"
            )
        if peak_db > peak_ceiling + PEAK_TOLERANCE_DB:
            errors.append(
                f"{relative}: peak {peak_db:.2f} dBFS exceeds ceiling {peak_ceiling:.2f}"
            )

        if "/stems/" in relative:
            stems[Path(relative).stem] = (left, right)

        print(
            f"- {relative}: rms={rms_db:.2f} dBFS "
            f"peak={peak_db:.2f} dBFS "
            f"target={target_rms:.2f}/{peak_ceiling:.2f}"
        )

    return errors, stems


def check_mix_headroom(
    stems: dict[str, tuple[list[float], list[float]]],
) -> list[str]:
    errors: list[str] = []
    if not stems:
        return ["no stems available for mix headroom check"]

    frame_count = min(len(left) for left, _ in stems.values())
    trim = gain(HEADROOM_DB)

    for preset, weights in PRESETS.items():
        mix_left = [0.0] * frame_count
        mix_right = [0.0] * frame_count

        for name, weight in weights.items():
            left, right = stems[name]
            for i in range(frame_count):
                mix_left[i] += left[i] * weight * trim
                mix_right[i] += right[i] * weight * trim

        rms_db, peak_db = measure(mix_left, mix_right)

        # Web Audio uses floating-point internal mixing; a transient may exceed
        # 0 dBFS before the limiter. Keep the pre-limiter drive bounded so the
        # limiter is protection rather than permanent heavy compression.
        if peak_db > 3.0:
            errors.append(
                f"{preset}: pre-limiter peak {peak_db:.2f} dBFS exceeds +3 dBFS guard"
            )
        if rms_db > -13.0:
            errors.append(
                f"{preset}: pre-limiter RMS {rms_db:.2f} dBFS is too hot"
            )

        print(
            f"- mix {preset}: after {HEADROOM_DB:.1f} dB trim "
            f"rms={rms_db:.2f} dBFS peak={peak_db:.2f} dBFS"
        )

    return errors


def main() -> None:
    print("Pulse Mastering Asset Check")
    errors, stems = check_assets()
    errors.extend(check_mix_headroom(stems))

    if errors:
        print("Pulse Mastering Asset Check FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Pulse Mastering Asset Check PASSED")


if __name__ == "__main__":
    main()
