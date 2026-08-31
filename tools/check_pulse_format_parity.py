#!/usr/bin/env python3
from __future__ import annotations

import array
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_RATE = 44_100
CHANNELS = 2
WINDOW_FRAMES = 2048
MAX_ENVELOPE_LAG_WINDOWS = 4

DURATION_TOLERANCE_SECONDS = 0.080
RMS_TOLERANCE_DB = 0.80
PEAK_TOLERANCE_DB = 2.00
ENVELOPE_CORRELATION_MIN = 0.94
ENVELOPE_MAE_DB_MAX = 1.80

GROUPS = {
    "stem": (
        ROOT / "assets/stems/pulse",
        ["drums", "bass", "chords", "melody", "sparkle"],
    ),
    "stinger": (
        ROOT / "assets/stingers/pulse",
        ["victory", "gameover"],
    ),
    "transition": (
        ROOT / "assets/transitions/pulse",
        ["fill", "whoosh", "riser", "impact"],
    ),
}


def require_tools() -> None:
    missing = [name for name in ("ffmpeg", "ffprobe") if not shutil.which(name)]
    if missing:
        raise RuntimeError("Missing required tools: " + ", ".join(missing))


def run(command: list[str]) -> bytes:
    completed = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        stderr = completed.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(
            "Command failed (" + str(completed.returncode) + "): "
            + " ".join(command) + "\n" + stderr
        )
    return completed.stdout


def probe_audio(path: Path) -> dict[str, int]:
    raw = run([
        "ffprobe",
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=sample_rate,channels",
        "-of", "json",
        str(path),
    ])
    payload = json.loads(raw.decode("utf-8"))
    streams = payload.get("streams") or []
    if not streams:
        raise RuntimeError(f"No audio stream: {path}")
    stream = streams[0]
    return {
        "sample_rate": int(stream.get("sample_rate") or 0),
        "channels": int(stream.get("channels") or 0),
    }


def decode_audio(path: Path) -> array.array:
    raw = run([
        "ffmpeg",
        "-v", "error",
        "-i", str(path),
        "-map", "0:a:0",
        "-ar", str(SAMPLE_RATE),
        "-ac", str(CHANNELS),
        "-f", "f32le",
        "pipe:1",
    ])
    samples = array.array("f")
    samples.frombytes(raw)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def db(value: float) -> float:
    return 20.0 * math.log10(max(float(value), 1e-12))


def measure(samples: array.array) -> dict[str, float | int | list[float]]:
    frame_count = len(samples) // CHANNELS
    if frame_count <= 0:
        raise RuntimeError("Decoded audio is empty")

    peak = 0.0
    energy = 0.0
    envelope: list[float] = []

    window_energy = 0.0
    window_frames = 0

    for frame in range(frame_count):
        index = frame * CHANNELS
        left = float(samples[index])
        right = float(samples[index + 1])
        frame_energy = (left * left + right * right) * 0.5
        energy += frame_energy
        peak = max(peak, abs(left), abs(right))

        window_energy += frame_energy
        window_frames += 1
        if window_frames >= WINDOW_FRAMES:
            envelope.append(
                db(math.sqrt(window_energy / max(1, window_frames)))
            )
            window_energy = 0.0
            window_frames = 0

    if window_frames:
        envelope.append(
            db(math.sqrt(window_energy / max(1, window_frames)))
        )

    rms = math.sqrt(energy / frame_count)
    return {
        "frame_count": frame_count,
        "duration": frame_count / SAMPLE_RATE,
        "peak_dbfs": db(peak),
        "rms_dbfs": db(rms),
        "envelope_db": envelope,
    }


def pearson(a: list[float], b: list[float]) -> float:
    count = min(len(a), len(b))
    if count < 3:
        return 1.0 if a[:count] == b[:count] else 0.0

    x = a[:count]
    y = b[:count]
    mean_x = sum(x) / count
    mean_y = sum(y) / count
    dx = [value - mean_x for value in x]
    dy = [value - mean_y for value in y]
    var_x = sum(value * value for value in dx)
    var_y = sum(value * value for value in dy)

    if var_x < 1e-9 or var_y < 1e-9:
        mae = sum(abs(vx - vy) for vx, vy in zip(x, y)) / count
        return max(0.0, 1.0 - mae / 12.0)

    covariance = sum(vx * vy for vx, vy in zip(dx, dy))
    return max(-1.0, min(1.0, covariance / math.sqrt(var_x * var_y)))


def align_envelopes(
    reference: list[float],
    candidate: list[float],
) -> dict[str, float | int]:
    best: dict[str, float | int] | None = None

    for lag in range(-MAX_ENVELOPE_LAG_WINDOWS, MAX_ENVELOPE_LAG_WINDOWS + 1):
        if lag >= 0:
            ref_start = 0
            cand_start = lag
        else:
            ref_start = -lag
            cand_start = 0

        count = min(
            len(reference) - ref_start,
            len(candidate) - cand_start,
        )
        if count < 3:
            continue

        ref_slice = reference[ref_start:ref_start + count]
        cand_slice = candidate[cand_start:cand_start + count]
        correlation = pearson(ref_slice, cand_slice)
        mae_db = sum(
            abs(ref_value - cand_value)
            for ref_value, cand_value in zip(ref_slice, cand_slice)
        ) / count

        score = correlation - mae_db * 0.01
        if best is None or score > float(best["score"]):
            best = {
                "lag_windows": lag,
                "lag_seconds": lag * WINDOW_FRAMES / SAMPLE_RATE,
                "correlation": correlation,
                "mae_db": mae_db,
                "score": score,
                "compared_windows": count,
            }

    if best is None:
        raise RuntimeError("Unable to align decoded envelopes")
    return best


def compare_variant(
    reference_path: Path,
    candidate_path: Path,
) -> dict[str, object]:
    reference_probe = probe_audio(reference_path)
    candidate_probe = probe_audio(candidate_path)

    for label, probe in (
        ("reference", reference_probe),
        ("candidate", candidate_probe),
    ):
        if probe["sample_rate"] != SAMPLE_RATE:
            raise AssertionError(
                f"{label} sample rate {probe['sample_rate']} != {SAMPLE_RATE}"
            )
        if probe["channels"] != CHANNELS:
            raise AssertionError(
                f"{label} channels {probe['channels']} != {CHANNELS}"
            )

    reference = measure(decode_audio(reference_path))
    candidate = measure(decode_audio(candidate_path))
    alignment = align_envelopes(
        list(reference["envelope_db"]),
        list(candidate["envelope_db"]),
    )

    duration_delta = abs(
        float(candidate["duration"]) - float(reference["duration"])
    )
    rms_delta = float(candidate["rms_dbfs"]) - float(reference["rms_dbfs"])
    peak_delta = float(candidate["peak_dbfs"]) - float(reference["peak_dbfs"])

    failures: list[str] = []
    if duration_delta > DURATION_TOLERANCE_SECONDS:
        failures.append(
            f"duration delta {duration_delta:.4f}s > "
            f"{DURATION_TOLERANCE_SECONDS:.4f}s"
        )
    if abs(rms_delta) > RMS_TOLERANCE_DB:
        failures.append(
            f"RMS delta {rms_delta:+.3f}dB > ±{RMS_TOLERANCE_DB:.2f}dB"
        )
    if abs(peak_delta) > PEAK_TOLERANCE_DB:
        failures.append(
            f"peak delta {peak_delta:+.3f}dB > ±{PEAK_TOLERANCE_DB:.2f}dB"
        )
    if float(alignment["correlation"]) < ENVELOPE_CORRELATION_MIN:
        failures.append(
            f"envelope correlation {alignment['correlation']:.5f} < "
            f"{ENVELOPE_CORRELATION_MIN:.3f}"
        )
    if float(alignment["mae_db"]) > ENVELOPE_MAE_DB_MAX:
        failures.append(
            f"envelope MAE {alignment['mae_db']:.3f}dB > "
            f"{ENVELOPE_MAE_DB_MAX:.2f}dB"
        )

    return {
        "reference": str(reference_path.relative_to(ROOT)),
        "candidate": str(candidate_path.relative_to(ROOT)),
        "reference_duration": round(float(reference["duration"]), 6),
        "candidate_duration": round(float(candidate["duration"]), 6),
        "duration_delta_seconds": round(duration_delta, 6),
        "rms_delta_db": round(rms_delta, 4),
        "peak_delta_db": round(peak_delta, 4),
        "envelope_correlation": round(float(alignment["correlation"]), 6),
        "envelope_mae_db": round(float(alignment["mae_db"]), 4),
        "lag_windows": int(alignment["lag_windows"]),
        "lag_seconds": round(float(alignment["lag_seconds"]), 6),
        "passed": not failures,
        "failures": failures,
    }


def main() -> None:
    require_tools()
    results: list[dict[str, object]] = []
    errors: list[str] = []

    for group, (directory, names) in GROUPS.items():
        for name in names:
            reference = directory / f"{name}.wav"
            if not reference.exists():
                errors.append(f"missing WAV reference: {reference}")
                continue

            for extension in ("m4a", "ogg"):
                candidate = directory / f"{name}.{extension}"
                if not candidate.exists():
                    errors.append(f"missing {extension.upper()} variant: {candidate}")
                    continue

                try:
                    result = compare_variant(reference, candidate)
                    result["group"] = group
                    result["name"] = name
                    result["format"] = extension
                    results.append(result)

                    print(
                        f"- {group}/{name}.{extension}: "
                        f"duration Δ={result['duration_delta_seconds']:.4f}s "
                        f"RMS Δ={result['rms_delta_db']:+.3f}dB "
                        f"peak Δ={result['peak_delta_db']:+.3f}dB "
                        f"env r={result['envelope_correlation']:.5f} "
                        f"MAE={result['envelope_mae_db']:.3f}dB "
                        f"lag={result['lag_seconds']:+.4f}s "
                        f"{'PASS' if result['passed'] else 'FAIL'}"
                    )
                    if not result["passed"]:
                        errors.extend(
                            f"{group}/{name}.{extension}: {message}"
                            for message in result["failures"]
                        )
                except Exception as exc:
                    errors.append(f"{group}/{name}.{extension}: {exc}")

    expected = sum(len(names) for _, names in GROUPS.values()) * 2
    if len(results) != expected:
        errors.append(
            f"expected {expected} format comparisons, completed {len(results)}"
        )

    report = {
        "schemaVersion": "1.0.0",
        "type": "pulse-cross-format-parity",
        "referenceFormat": "wav",
        "candidateFormats": ["m4a", "ogg"],
        "sampleRate": SAMPLE_RATE,
        "channels": CHANNELS,
        "thresholds": {
            "durationToleranceSeconds": DURATION_TOLERANCE_SECONDS,
            "rmsToleranceDb": RMS_TOLERANCE_DB,
            "peakToleranceDb": PEAK_TOLERANCE_DB,
            "envelopeCorrelationMin": ENVELOPE_CORRELATION_MIN,
            "envelopeMaeDbMax": ENVELOPE_MAE_DB_MAX,
            "maxEnvelopeLagWindows": MAX_ENVELOPE_LAG_WINDOWS,
        },
        "passed": not errors,
        "comparisons": results,
        "failures": errors,
    }

    report_path = ROOT / "qa/out/pulse-format-parity.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    if errors:
        print("Pulse Cross-Format Audio Parity Check FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Pulse Cross-Format Audio Parity Check PASSED")
    print(f"- comparisons: {len(results)}/{expected}")
    print("- WAV ↔ M4A/OGG duration, RMS, peak and envelope parity: OK")
    print(f"- report: {report_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
