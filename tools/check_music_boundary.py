from pathlib import Path
import sys

ROOT_GAME_FILE = Path("src/game.js")
GAME_DIRECTORY = Path("games")

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


def discover_game_files():
    files = []
    if ROOT_GAME_FILE.is_file():
        files.append(ROOT_GAME_FILE)

    if GAME_DIRECTORY.is_dir():
        files.extend(
            path
            for path in GAME_DIRECTORY.rglob("game.js")
            if path.is_file()
        )

    return sorted(set(files), key=lambda path: path.as_posix())


GAME_FILES = discover_game_files()

errors = []
if not GAME_FILES:
    errors.append("no game entry files discovered")

for path in GAME_FILES:
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
print(f"Discovered {len(GAME_FILES)} game entry file(s)")
for path in GAME_FILES:
    print(f"- {path}")
