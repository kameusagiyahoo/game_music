#!/usr/bin/env python3
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_RATE = 44_100
CHANNELS = 2
SAMPLE_WIDTH = 2
STEM_FRAMES = 392_000

ASSETS = {
    "stems": {
        "drums": (-23.0, -7.0),
        "bass": (-23.0, -8.0),
        "chords": (-24.0, -9.0),
        "melody": (-22.5, -7.0),
        "sparkle": (-27.0, -10.0),
    },
    "stingers": {
        "victory": (-18.0, -4.0),
        "gameover": (-20.0, -5.0),
    },
    "transitions": {
        "fill": (-21.0, -6.0),
        "whoosh": (-23.0, -7.0),
        "riser": (-21.5, -6.0),
        "impact": (-19.0, -4.0),
    },
}


def read_stats(path: Path) -> dict[str, float | int]:
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        width = wav.getsampwidth()
        sample_rate = wav.getframerate()
        frames = wav.getnframes()
        raw = wav.readframes(frames)

    if channels != CHANNELS:
        raise AssertionError(f"{path}: channels={channels}, expected {CHANNELS}")
    if width != SAMPLE_WIDTH:
        raise AssertionError(f"{path}: sample width={width}, expected {SAMPLE_WIDTH}")
    if sample_rate != SAMPLE_RATE:
        raise AssertionError(f"{path}: sample rate={sample_rate}, expected {SAMPLE_RATE}")

    count = frames * channels
    samples = struct.unpack("<" + "h" * count, raw)

    peak = 0.0
    energy = 0.0
    stereo_delta = 0.0
    for frame in range(frames):
        left = samples[frame * 2] / 32768.0
        right = samples[frame * 2 + 1] / 32768.0
        peak = max(peak, abs(left), abs(right))
        energy += (left * left + right * right) * 0.5
        stereo_delta += abs(left - right)

    rms = math.sqrt(max(energy / max(1, frames), 1e-12))
    return {
        "frames": frames,
        "peak_dbfs": 20 * math.log10(max(peak, 1e-12)),
        "rms_dbfs": 20 * math.log10(max(rms, 1e-12)),
        "stereo_delta": stereo_delta / max(1, frames),
    }


def main() -> None:
    errors: list[str] = []

    for group, entries in ASSETS.items():
        directory = ROOT / "assets" / group / "fantasy"
        for name, (target_rms, peak_ceiling) in entries.items():
            path = directory / f"{name}.wav"
            if not path.exists():
                errors.append(f"missing {path.relative_to(ROOT)}")
                continue

            try:
                stats = read_stats(path)
            except Exception as exc:
                errors.append(str(exc))
                continue

            if group == "stems" and stats["frames"] != STEM_FRAMES:
                errors.append(
                    f"{group}/{name}: frames={stats['frames']} expected={STEM_FRAMES}"
                )

            if stats["stereo_delta"] <= 1e-6:
                errors.append(f"{group}/{name}: appears dual-mono")

            if stats["peak_dbfs"] > peak_ceiling + 0.20:
                errors.append(
                    f"{group}/{name}: peak={stats['peak_dbfs']:.2f}dBFS "
                    f"exceeds ceiling={peak_ceiling:.2f}dBFS"
                )

            if stats["rms_dbfs"] > target_rms + 0.25:
                errors.append(
                    f"{group}/{name}: rms={stats['rms_dbfs']:.2f}dBFS "
                    f"above target={target_rms:.2f}dBFS"
                )

            if stats["rms_dbfs"] < target_rms - 9.0:
                errors.append(
                    f"{group}/{name}: rms={stats['rms_dbfs']:.2f}dBFS "
                    f"unexpectedly quiet vs target={target_rms:.2f}dBFS"
                )

            print(
                f"- {group}/{name}.wav "
                f"frames={stats['frames']} "
                f"rms={stats['rms_dbfs']:.2f}dBFS "
                f"peak={stats['peak_dbfs']:.2f}dBFS "
                f"stereoDelta={stats['stereo_delta']:.6f}"
            )

    if errors:
        print("Fantasy Audio Profile Check FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Fantasy Audio Profile Check PASSED")
    print(f"- stems: 5 × {STEM_FRAMES} frames")
    print("- 44.1 kHz / stereo / 16-bit PCM: OK")
    print("- mastering ceilings: OK")
    print("- non-dual-mono stereo: OK")


if __name__ == "__main__":
    main()
