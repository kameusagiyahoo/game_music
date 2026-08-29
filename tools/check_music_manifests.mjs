import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GAME_DEFAULT_PACKS,
  getMusicPackEntry,
  getMusicRegistrySnapshot,
  listMusicPacks,
} from "../src/music-registry.js";
import {
  MUSIC_PACK_SCHEMA_VERSION,
  MUSIC_FACADE_API_VERSION,
  compareSemver,
  validateMusicPackManifest,
} from "../src/music-pack-manifest.js";

const errors = [];
const packs = listMusicPacks();
const snapshot = getMusicRegistrySnapshot();

const packDir = fileURLToPath(new URL("../src/music-packs/", import.meta.url));
const packFiles = readdirSync(packDir).filter((name) => name.endsWith(".js"));

if (packFiles.length !== packs.length) {
  errors.push(`music-packs file count (${packFiles.length}) != registry pack count (${packs.length})`);
}

const seen = new Set();
for (const entry of packs) {
  try {
    validateMusicPackManifest(entry.manifest, entry.pack);
  } catch (error) {
    errors.push(error.message);
  }

  if (seen.has(entry.id)) errors.push(`duplicate pack id: ${entry.id}`);
  seen.add(entry.id);

  if (entry.schemaVersion !== MUSIC_PACK_SCHEMA_VERSION) {
    errors.push(`${entry.id}: unsupported schema ${entry.schemaVersion}; expected ${MUSIC_PACK_SCHEMA_VERSION}`);
  }

  if (compareSemver(entry.facadeApi, MUSIC_FACADE_API_VERSION) > 0) {
    errors.push(`${entry.id}: requires facade API ${entry.facadeApi}; current is ${MUSIC_FACADE_API_VERSION}`);
  }

  for (const format of entry.formats || []) {
    const stemFiles = entry.pack.audioStems?.formats?.[format]?.files || {};
    const stingerFiles = entry.pack.stingers?.formats?.[format]?.files || {};
    const transitionCueFiles = entry.pack.transitionCues?.formats?.[format]?.files || {};

    for (const stem of entry.stems || []) {
      if (!stemFiles[stem]) errors.push(`${entry.id}@${entry.version}: ${format} missing stem ${stem}`);
    }
    for (const stinger of entry.stingers || []) {
      if (!stingerFiles[stinger]) errors.push(`${entry.id}@${entry.version}: ${format} missing stinger ${stinger}`);
    }
    for (const cue of entry.transitionCues || []) {
      if (!transitionCueFiles[cue]) errors.push(`${entry.id}@${entry.version}: ${format} missing transition cue ${cue}`);
    }
  }
}

for (const [gameId, packId] of Object.entries(GAME_DEFAULT_PACKS)) {
  if (!getMusicPackEntry(packId)) errors.push(`${gameId}: default pack not registered: ${packId}`);
}

if (snapshot.packCount !== packs.length) {
  errors.push(`snapshot pack count ${snapshot.packCount} != actual ${packs.length}`);
}

if (errors.length) {
  console.error("Music Pack Manifest Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music Pack Manifest Check PASSED");
console.log(`Schema: v${snapshot.schemaVersion}`);
console.log(`Facade API: v${snapshot.facadeApi}`);
for (const entry of packs) {
  console.log(
    `- ${entry.id}@${entry.version} [${entry.engine}] states=${entry.states.join(",")} stems=${entry.stems.length} stingers=${entry.stingers.length} transitionCues=${entry.transitionCues.length} formats=${entry.formats.join(",") || "n/a"}`
  );
}
