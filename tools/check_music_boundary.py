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
    "music-manager.js",
    "wav-stem-manager.js",
    "createMusicRuntime(",
    ".manager",
    "music.play(",
    "music.transitionTo(",
    "music.setLayerPreset(",
    "music.playStinger(",
    "music.sfx(",
    "music.switchPack(",
    "music.setPack(",
    "music.getPackInfo(",
    "music.setMusicEnabled(",
    "music.setSfxEnabled(",
    "music.setMusicVolume(",
    "music.setSfxVolume(",
    "music.cancelPending",
)

REQUIRED = "createMusicFacade"

errors = []
for path in GAME_FILES:
    if not path.exists():
        errors.append(f"{path}: missing")
        continue

    text = path.read_text(encoding="utf-8")
    for token in FORBIDDEN:
        if token in text:
            errors.append(f"{path}: facade boundary violation: {token}")

    if REQUIRED not in text:
        errors.append(f"{path}: {REQUIRED}() is required")

if errors:
    print("Music facade boundary check FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Music facade boundary check PASSED")
for path in GAME_FILES:
    print(f"- {path}")
