#!/usr/bin/env python3
from __future__ import annotations

from check_pulse_format_parity import ROOT, compare_variant

errors: list[str] = []


def expect(reference, candidate, should_pass: bool, label: str) -> None:
    result = compare_variant(reference, candidate)
    if bool(result["passed"]) != should_pass:
        errors.append(
            f"{label}: expected {'PASS' if should_pass else 'FAIL'}, "
            f"got {'PASS' if result['passed'] else 'FAIL'} "
            f"failures={result['failures']}"
        )


def main() -> None:
    stems = ROOT / "assets/stems/fantasy"
    stingers = ROOT / "assets/stingers/fantasy"

    expect(stems / "chords.wav", stems / "chords.m4a", True, "correct chords AAC")
    expect(stingers / "victory.wav", stingers / "victory.ogg", True, "correct victory OGG")
    expect(stems / "chords.wav", stems / "drums.m4a", False, "chords WAV vs drums AAC")
    expect(stingers / "victory.wav", stingers / "gameover.ogg", False, "victory WAV vs gameover OGG")

    if errors:
        print("Fantasy Format Parity Semantics Check FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("Fantasy Format Parity Semantics Check PASSED")
    print("- correct variants accepted")
    print("- wrong stem/stinger substitutions rejected")


if __name__ == "__main__":
    main()
