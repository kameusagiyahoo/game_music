#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from check_pulse_format_parity import ROOT, compare_variant

errors: list[str] = []


def expect_pass(reference: Path, candidate: Path, label: str) -> None:
    result = compare_variant(reference, candidate)
    if not result["passed"]:
        errors.append(
            f"{label}: expected PASS, got failures={result['failures']}"
        )


def expect_fail(reference: Path, candidate: Path, label: str) -> None:
    result = compare_variant(reference, candidate)
    if result["passed"]:
        errors.append(
            f"{label}: wrong content unexpectedly passed "
            f"(env r={result['envelope_correlation']}, "
            f"MAE={result['envelope_mae_db']}dB)"
        )


def main() -> None:
    stems = ROOT / "assets/stems/pulse"
    stingers = ROOT / "assets/stingers/pulse"

    expect_pass(
        stems / "drums.wav",
        stems / "drums.m4a",
        "correct drums AAC",
    )
    expect_pass(
        stingers / "victory.wav",
        stingers / "victory.ogg",
        "correct victory OGG",
    )

    expect_fail(
        stems / "drums.wav",
        stems / "bass.m4a",
        "drums WAV vs bass AAC",
    )
    expect_fail(
        stingers / "victory.wav",
        stingers / "gameover.ogg",
        "victory WAV vs gameover OGG",
    )

    if errors:
        print("Pulse Format Parity Semantics Check FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Pulse Format Parity Semantics Check PASSED")
    print("- correct cross-format content: accepted")
    print("- wrong stem substitution: rejected")
    print("- wrong stinger substitution: rejected")


if __name__ == "__main__":
    main()
