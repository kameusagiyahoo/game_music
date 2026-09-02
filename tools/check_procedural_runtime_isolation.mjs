import fs from "node:fs";
import {
  GAME_IDS,
  MUSIC_ENGINES,
  getMusicSettings,
  listMusicPacks,
} from "../src/music-registry.js";
import {
  MUSIC_CAPABILITIES,
  createMusicRuntime,
  resolveMusicAsset,
} from "../src/music-asset-resolver.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const resolverSource = fs.readFileSync("src/music-asset-resolver.js", "utf8");
const registrySource = fs.readFileSync("src/music-registry.js", "utf8");
const settingsSource = fs.readFileSync("settings/music/settings.js", "utf8");
const settingsHtml = fs.readFileSync("settings/music/index.html", "utf8");

assert(!fs.existsSync("src/music-manager.js"), "legacy procedural manager must not remain in src runtime");
assert(
  fs.existsSync("tools/fixtures/legacy-procedural-music-manager.js"),
  "legacy procedural manager fixture must remain available for compatibility checks",
);
assert(!resolverSource.includes("MusicManager"), "runtime resolver must not import the legacy procedural manager");
assert(!resolverSource.includes("PROCEDURAL"), "runtime resolver must not contain procedural engine branches");
assert(!registrySource.includes('PROCEDURAL: "procedural"'), "current engine registry must not expose procedural");
assert(!settingsSource.includes("proceduralPackId"), "settings UI must not expose proceduralPackId");
assert(!settingsHtml.includes("PROCEDURAL ENGINE"), "settings page must not expose a procedural engine card");

assert(
  JSON.stringify(Object.keys(MUSIC_ENGINES)) === JSON.stringify(["WAV_STEM"]),
  `expected WAV_STEM to be the only production engine, got ${Object.keys(MUSIC_ENGINES).join(",")}`,
);
assert(
  Object.keys(MUSIC_CAPABILITIES).length === 1 && MUSIC_CAPABILITIES[MUSIC_ENGINES.WAV_STEM],
  "capability registry must contain only the WAV-stem production engine",
);

const packs = listMusicPacks();
assert(packs.length === 4, `expected four production packs, got ${packs.length}`);
assert(packs.every((entry) => entry.engine === MUSIC_ENGINES.WAV_STEM), "all production packs must use WAV-stem");

for (const gameId of Object.values(GAME_IDS)) {
  const entry = resolveMusicAsset({ gameId });
  assert(entry.engine === MUSIC_ENGINES.WAV_STEM, `${gameId} must resolve to WAV-stem`);
}

const settings = getMusicSettings();
assert(!("proceduralPackId" in settings), "normalized current settings must not expose proceduralPackId");

let unsupportedError = null;
try {
  createMusicRuntime({ packId: "fantasy", engine: "procedural" });
} catch (error) {
  unsupportedError = error;
}
assert(unsupportedError, "explicit procedural runtime requests must fail");

console.log("Procedural runtime isolation check PASSED");
console.log("- production runtime: WAV-stem only");
console.log("- legacy procedural manager: tools/fixtures only");
console.log("- legacy settings migration: retained in registry normalization");
