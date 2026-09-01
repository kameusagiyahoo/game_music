#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from check_pulse_format_parity import (
    ROOT,
    CHANNELS,
    SAMPLE_RATE,
    DURATION_TOLERANCE_SECONDS,
    RMS_TOLERANCE_DB,
    PEAK_TOLERANCE_DB,
    ENVELOPE_CORRELATION_MIN,
    ENVELOPE_MAE_DB_MAX,
    ENVELOPE_FLOOR_DB,
    ENVELOPE_ACTIVE_DB,
    MAX_ENVELOPE_LAG_WINDOWS,
    compare_variant,
    require_tools,
)

GROUPS = {
    "stem": (
        ROOT / "assets/stems/fantasy",
        ["drums", "bass", "chords", "melody", "sparkle"],
    ),
    "stinger": (
        ROOT / "assets/stingers/fantasy",
        ["victory", "gameover"],
    ),
    "transition": (
        ROOT / "assets/transitions/fantasy",
        ["fill", "whoosh", "riser", "impact"],
    ),
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
        "type": "fantasy-cross-format-parity",
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
            "envelopeFloorDb": ENVELOPE_FLOOR_DB,
            "envelopeActiveDb": ENVELOPE_ACTIVE_DB,
            "maxEnvelopeLagWindows": MAX_ENVELOPE_LAG_WINDOWS,
        },
        "passed": not errors,
        "comparisons": results,
        "failures": errors,
    }

    report_path = ROOT / "qa/out/fantasy-format-parity.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    if errors:
        print("Fantasy Cross-Format Audio Parity Check FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Fantasy Cross-Format Audio Parity Check PASSED")
    print(f"- comparisons: {len(results)}/{expected}")
    print(f"- report: {report_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
