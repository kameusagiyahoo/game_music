export const MUSIC_PACK_SCHEMA_VERSION = "1.1.0";
export const MUSIC_FACADE_API_VERSION = "1.1.0";

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function defineMusicPackManifest(input = {}) {
  const manifest = {
    schemaVersion: MUSIC_PACK_SCHEMA_VERSION,
    version: "1.0.0",
    shortName: input.name || input.id || "Music Pack",
    description: "",
    states: [],
    stems: [],
    stingers: [],
    formats: [],
    facadeApi: MUSIC_FACADE_API_VERSION,
    ...input,
  };

  validateMusicPackManifest(manifest);
  return Object.freeze({
    ...manifest,
    states: Object.freeze([...(manifest.states || [])]),
    stems: Object.freeze([...(manifest.stems || [])]),
    stingers: Object.freeze([...(manifest.stingers || [])]),
    formats: Object.freeze([...(manifest.formats || [])]),
    tags: Object.freeze([...(manifest.tags || [])]),
  });
}

export function validateMusicPackManifest(manifest, pack = null) {
  const errors = [];
  const requiredStrings = ["id", "name", "shortName", "description", "engine", "version", "schemaVersion"];

  requiredStrings.forEach((key) => {
    if (!manifest?.[key] || typeof manifest[key] !== "string") {
      errors.push(`${key} must be a non-empty string`);
    }
  });

  if (manifest?.version && !SEMVER_RE.test(manifest.version)) {
    errors.push(`version must be SemVer: ${manifest.version}`);
  }
  if (manifest?.schemaVersion && !SEMVER_RE.test(manifest.schemaVersion)) {
    errors.push(`schemaVersion must be SemVer: ${manifest.schemaVersion}`);
  }
  if (!Array.isArray(manifest?.states) || manifest.states.length === 0) {
    errors.push("states must contain at least one state");
  }
  if (!Array.isArray(manifest?.formats)) {
    errors.push("formats must be an array");
  }

  if (pack) {
    if (pack.id !== manifest.id) {
      errors.push(`manifest id ${manifest.id} does not match pack id ${pack.id}`);
    }
    if (pack.name !== manifest.name) {
      errors.push(`manifest name ${manifest.name} does not match pack name ${pack.name}`);
    }

    const packStates = new Set(Object.keys(pack.modes || {}));
    for (const state of manifest.states || []) {
      if (!packStates.has(state)) errors.push(`declared state not found in pack.modes: ${state}`);
    }

    const fallbackStemNames = Object.keys(pack.audioStems?.files || {});
    const formatStemMaps = Object.values(pack.audioStems?.formats || {}).map((item) => item?.files || {});
    const stemNames = fallbackStemNames.length
      ? fallbackStemNames
      : Object.keys(formatStemMaps[0] || {});
    for (const stem of manifest.stems || []) {
      if (!stemNames.includes(stem)) errors.push(`declared stem not found in pack audio files: ${stem}`);
    }
    for (const stem of stemNames) {
      if (!(manifest.stems || []).includes(stem)) errors.push(`pack stem missing from manifest: ${stem}`);
    }

    const fallbackStingerNames = Object.keys(pack.stingers?.files || {});
    const formatStingerMaps = Object.values(pack.stingers?.formats || {}).map((item) => item?.files || {});
    const stingerNames = fallbackStingerNames.length
      ? fallbackStingerNames
      : Object.keys(formatStingerMaps[0] || {});
    for (const stinger of manifest.stingers || []) {
      if (!stingerNames.includes(stinger)) errors.push(`declared stinger not found in pack audio files: ${stinger}`);
    }
    for (const stinger of stingerNames) {
      if (!(manifest.stingers || []).includes(stinger)) errors.push(`pack stinger missing from manifest: ${stinger}`);
    }

    const availableFormats = new Set([
      ...Object.keys(pack.audioStems?.formats || {}),
      ...Object.keys(pack.stingers?.formats || {}),
    ]);
    for (const format of manifest.formats || []) {
      if (!availableFormats.has(format)) errors.push(`declared format not found in pack: ${format}`);
    }
  }

  if (errors.length) {
    throw new Error(`Invalid Music Pack Manifest${manifest?.id ? ` (${manifest.id})` : ""}: ${errors.join("; ")}`);
  }
  return true;
}

export function createRegistryEntry(manifest, pack) {
  validateMusicPackManifest(manifest, pack);
  return Object.freeze({
    id: manifest.id,
    version: manifest.version,
    schemaVersion: manifest.schemaVersion,
    name: manifest.name,
    shortName: manifest.shortName,
    description: manifest.description,
    engine: manifest.engine,
    states: manifest.states,
    stems: manifest.stems,
    stingers: manifest.stingers,
    formats: manifest.formats,
    tags: manifest.tags,
    facadeApi: manifest.facadeApi,
    manifest,
    pack,
  });
}

export function compareSemver(a, b) {
  const parse = (value) => String(value).split(/[+-]/)[0].split(".").map((part) => Number(part) || 0);
  const aa = parse(a);
  const bb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if (aa[i] > bb[i]) return 1;
    if (aa[i] < bb[i]) return -1;
  }
  return 0;
}
