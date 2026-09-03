import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rune = read("games/rune-relay/game.js");
const aether = read("games/aether-shift/game.js");
const settings = read("settings/music/index.html");

for (const [name, source, storageKey] of [
  ["Rune Relay", rune, "rune-relay-pack"],
  ["Aether Shift", aether, "aether-shift-pack"],
]) {
  assert(
    source.includes(`const STORAGE_KEY = "${storageKey}"`),
    `${name} must keep a game-specific pack storage key`,
  );
  assert(
    source.includes("resolveMusicAsset({ gameId:"),
    `${name} must resolve its fallback from the global/default music resolver`,
  );
  assert(
    !source.includes("saveMusicSettings({ wavStemPackId:"),
    `${name} must not overwrite the global WAV pack setting from in-game selection`,
  );
  assert(
    !source.includes("saveMusicSettings({ proceduralPackId:"),
    `${name} must not overwrite the global procedural pack setting from in-game selection`,
  );
}

assert(
  settings.includes("ここで選ぶPackは全ゲームの既定値です。"),
  "Music settings must explain that the selected pack is the global default",
);
assert(
  settings.includes("そのゲームだけの選択として保存されます。"),
  "Music settings must explain the game-specific override policy",
);

console.log("Game pack preference policy check PASSED");
