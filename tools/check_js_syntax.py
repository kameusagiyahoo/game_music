from pathlib import Path
import subprocess
import sys

SEARCH_ROOTS = (
    Path("src"),
    Path("games"),
    Path("debug"),
    Path("settings"),
    Path("tools"),
)

ROOT_FILES = (
    Path("music-sw.js"),
)

EXTENSIONS = {".js", ".mjs"}


def discover_javascript_files():
    files = []

    for path in ROOT_FILES:
        if path.is_file() and path.suffix in EXTENSIONS:
            files.append(path)

    for root in SEARCH_ROOTS:
        if not root.is_dir():
            continue
        files.extend(
            path
            for path in root.rglob("*")
            if path.is_file() and path.suffix in EXTENSIONS
        )

    return sorted(set(files), key=lambda path: path.as_posix())


files = discover_javascript_files()
if not files:
    print("JavaScript syntax check FAILED")
    print("- no JavaScript files discovered")
    sys.exit(1)

errors = []
for path in files:
    result = subprocess.run(
        ["node", "--check", str(path)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        errors.append((path, detail))

if errors:
    print("JavaScript syntax check FAILED")
    for path, detail in errors:
        print(f"- {path}")
        if detail:
            print(detail)
    sys.exit(1)

print("JavaScript syntax check PASSED")
print(f"Discovered {len(files)} JavaScript module(s)")
for path in files:
    print(f"- {path}")
