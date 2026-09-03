from pathlib import Path
import sys

README = Path("README.md")
DOCS = (
    Path("docs/architecture.md"),
    Path("docs/music-pack-spec.md"),
    Path("docs/qa.md"),
    Path("docs/history/music-engine-v1-v38.md"),
)

errors = []

if not README.is_file():
    errors.append("README.md is missing")
else:
    text = README.read_text(encoding="utf-8")
    if len(text) > 20000:
        errors.append(f"README is too large for an entry document: {len(text)} chars")
    for link in (
        "docs/architecture.md",
        "docs/music-pack-spec.md",
        "docs/qa.md",
        "docs/history/music-engine-v1-v38.md",
    ):
        if link not in text:
            errors.append(f"README missing documentation link: {link}")
    if "### v38" in text or "### v30" in text:
        errors.append("README still contains detailed version history")
    if "src/music-manager.js" in text:
        errors.append("README references removed production procedural manager")
    if "generate-pulse-stems.yml" in text or "pulse-format-parity.yml" in text:
        errors.append("README references removed duplicated audio workflows")

for path in DOCS:
    if not path.is_file():
        errors.append(f"missing documentation file: {path}")
        continue
    if path.stat().st_size < 200:
        errors.append(f"documentation file is unexpectedly small: {path}")

history = DOCS[-1]
if history.is_file():
    text = history.read_text(encoding="utf-8")
    for marker in ("## Music Engine history", "### v1", "### v38"):
        if marker not in text:
            errors.append(f"history missing marker: {marker}")
    if len(text) < 60000:
        errors.append(f"history appears truncated: {len(text)} chars")

if errors:
    print("Documentation structure check FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Documentation structure check PASSED")
print(f"- README chars: {len(README.read_text(encoding='utf-8'))}")
print(f"- history chars: {len(history.read_text(encoding='utf-8'))}")
print("- detailed history preserved outside README")
