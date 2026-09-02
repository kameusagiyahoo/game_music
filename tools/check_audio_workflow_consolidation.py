from pathlib import Path
import sys

OLD_WORKFLOWS = (
    ".github/workflows/generate-clockwork-stems.yml",
    ".github/workflows/generate-fantasy-stems.yml",
    ".github/workflows/generate-neon-stems.yml",
    ".github/workflows/generate-pulse-stems.yml",
    ".github/workflows/clockwork-format-parity.yml",
    ".github/workflows/fantasy-format-parity.yml",
    ".github/workflows/neon-format-parity.yml",
    ".github/workflows/pulse-format-parity.yml",
)

GENERATION = Path(".github/workflows/generate-audio.yml")
PARITY = Path(".github/workflows/audio-format-parity.yml")

errors = []

for path in OLD_WORKFLOWS:
    if Path(path).exists():
        errors.append(f"legacy duplicated workflow still exists: {path}")

for path in (GENERATION, PARITY):
    if not path.is_file():
        errors.append(f"missing consolidated workflow: {path}")

if GENERATION.is_file():
    text = GENERATION.read_text(encoding="utf-8")
    for token in (
        "matrix:",
        "fromJSON(needs.detect.outputs.packs)",
        "max-parallel: 1",
        'python "tools/generate_${PACK}_stems.py"',
        'bash "tools/encode_${PACK}_audio.sh"',
        "contents: write",
    ):
        if token not in text:
            errors.append(f"{GENERATION}: missing {token}")

if PARITY.is_file():
    text = PARITY.read_text(encoding="utf-8")
    for token in (
        "matrix:",
        "fromJSON(needs.detect.outputs.packs)",
        'python "tools/check_${PACK}_format_parity.py"',
        'python "tools/check_${PACK}_format_parity_semantics.py"',
        "matrix.pack }}-format-parity-report",
    ):
        if token not in text:
            errors.append(f"{PARITY}: missing {token}")

if errors:
    print("Audio workflow consolidation check FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Audio workflow consolidation check PASSED")
print("- generation workflows: 4 -> 1")
print("- parity workflows: 4 -> 1")
print("- changed packs are selected dynamically")
