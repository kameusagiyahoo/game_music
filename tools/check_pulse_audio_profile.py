#!/usr/bin/env python3
from __future__ import annotations

import array
import math
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_RATE = 44_100
CHANNELS = 2
SAMPLE_WIDTH = 2
EXPECTED_STEM_FRAMES = 378_000

STEMS = ["drums", "bass", "chords", "melody", "sparkle"]
STINGERS = ["victory", "gameover"]
TRANSITIONS = ["fill", "whoosh", "riser", "impact"]


def inspect_wav(path: Path) -> dict[str, float | int]:
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        sample_rate = wav.getframerate()
        frames = wav.getnframes()
        raw = wav.readframes(frames)

    if channels != CHANNELS:
        raise AssertionError(f"{path}: expected {CHANNELS} channels, got {channels}")
    if sample_width != SAMPLE_WIDTH:
        raise AssertionError(f"{path}: expected {SAMPLE_WIDTH * 8}-bit PCM, got {sample_width * 8}-bit")
    if sample_rate != SAMPLE_RATE:
        raise AssertionError(f"{path}: expected {SAMPLE_RATE} Hz, got {sample_rate} Hz")
    if frames <= 0:
        raise AssertionError(f"{path}: empty audio")

    pcm = array.array("h")
    pcm.frombytes(raw)
    if sys.byteorder != "little":
        pcm.byteswap()

    left = pcm[0::2]
    right = pcm[1::2]
    pair_count = min(len(left), len(right))
    if pair_count != frames:
        raise AssertionError(f"{path}: PCM frame count mismatch")

    differing = 0
    diff_energy = 0.0
    signal_energy = 0.0
    for l, r in zip(left, right):
        delta = l - r
        if delta:
            differing += 1
        diff_energy += float(delta * delta)
        signal_energy += float(l * l + r * r)

    differing_ratio = differing / max(1, pair_count)
    relative_diff = diff_energy / max(1.0, signal_energy)

    if differing_ratio < 0.001:
        raise AssertionError(
            f"{path}: stereo channels are effectively dual-mono "
            f"(different frames={differing_ratio:.5%})"
        )
    if relative_diff < 1e-6:
        raise AssertionError(
            f"{path}: stereo side energy too small "
            f"(relative_diff={relative_diff:.8f})"
        )

    return {
        "sample_rate": sample_rate,
        "channels": channels,
        "sample_width": sample_width,
        "frames": frames,
        "duration": frames / sample_rate,
        "different_ratio": differing_ratio,
        "relative_diff": relative_diff,
    }


def main() -> None:
    errors: list[str] = []
    reports: list[tuple[str, dict[str, float | int]]] = []

    groups = {
        "stem": [ROOT / "assets/stems/pulse" / f"{name}.wav" for name in STEMS],
        "stinger": [ROOT / "assets/stingers/pulse" / f"{name}.wav" for name in STINGERS],
        "transition": [ROOT / "assets/transitions/pulse" / f"{name}.wav" for name in TRANSITIONS],
    }

    for kind, paths in groups.items():
        for path in paths:
            try:
                report = inspect_wav(path)
                reports.append((str(path.relative_to(ROOT)), report))
                if kind == "stem" and report["frames"] != EXPECTED_STEM_FRAMES:
                    errors.append(
                        f"{path}: expected {EXPECTED_STEM_FRAMES} stem frames, got {report['frames']}"
                    )
            except Exception as exc:
                errors.append(str(exc))

    stem_frames = {
        int(report["frames"])
        for path, report in reports
        if path.startswith("assets/stems/pulse/")
    }
    if len(stem_frames) != 1:
        errors.append(f"Pulse stem frame lengths differ: {sorted(stem_frames)}")

    if errors:
        print("Pulse Audio Profile Check FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Pulse Audio Profile Check PASSED")
    print(
        f"- profile: {SAMPLE_RATE} Hz / {CHANNELS} ch / "
        f"{SAMPLE_WIDTH * 8}-bit PCM"
    )
    print(f"- synchronized stem frames: {EXPECTED_STEM_FRAMES}")
    print(f"- synchronized stem duration: {EXPECTED_STEM_FRAMES / SAMPLE_RATE:.6f}s")
    for path, report in reports:
        print(
            f"- {path}: frames={report['frames']} "
            f"stereo_diff={float(report['different_ratio']):.2%}"
        )


if __name__ == "__main__":
    main()
