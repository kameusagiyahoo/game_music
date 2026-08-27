from pathlib import Path
import sys

GAME_FILES = [
    Path("src/game.js"),
    Path("games/orbit-rush/game.js"),
    Path("games/pulse-forge/game.js"),
    Path("games/rune-relay/game.js"),
    Path("games/aether-shift/game.js"),
]

FORBIDDEN = (
    'from "./music-manager.js"',
    'from "./wav-stem-manager.js"',
    'from "../../src/music-manager.js"',
    'from "../../src/wav-stem-manager.js"',
)
REQUIRED = "createMusicRuntime"

errors = []
for path in GAME_FILES:
    if not path.exists():
        errors.append(f"{path}: missing")
        continue
    text = path.read_text(encoding="utf-8")
    for token in FORBIDDEN:
        if token in text:
            errors.append(f"{path}: direct engine import is forbidden: {token}")
    if REQUIRED not in text:
        errors.append(f"{path}: {REQUIRED}() is required")

if errors:
    print("Music architecture boundary check FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Music architecture boundary check PASSED")
for path in GAME_FILES:
    print(f"- {path}")
