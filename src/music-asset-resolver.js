import { MusicManager } from "./music-manager.js";
import { WavStemMusicManager } from "./wav-stem-manager.js";
import { resolvePackAudioFormat } from "./music-format-resolver.js";
import {
  GAME_DEFAULT_PACKS,
  MUSIC_ENGINES,
  configureMusicManager,
  getMusicPackEntry,
  getMusicSettings,
  resolveMusicPack,
} from "./music-registry.js";

export const MUSIC_CAPABILITIES = Object.freeze({
  [MUSIC_ENGINES.PROCEDURAL]: Object.freeze({
    quantizedModeTransition: true,
    quantizedPackSwitch: true,
    layerMix: true,
    wavStems: false,
    stingers: false,
    formatResolver: false,
    runtimeDecodeFallback: false,
  }),
  [MUSIC_ENGINES.WAV_STEM]: Object.freeze({
    quantizedModeTransition: false,
    quantizedPackSwitch: false,
    layerMix: true,
    wavStems: true,
    stingers: true,
    formatResolver: true,
    runtimeDecodeFallback: true,
  }),
});

export function resolveMusicAsset({ gameId, packId, engine } = {}) {
  if (packId) {
    const explicit = getMusicPackEntry(packId);
    if (!explicit) throw new Error(`Unknown Music Pack: ${packId}`);
    if (engine && explicit.engine !== engine) {
      throw new Error(`Music Pack ${packId} requires engine ${explicit.engine}, not ${engine}`);
    }
    return explicit;
  }

  if (!gameId) throw new Error("gameId or packId is required");

  let targetEngine = engine;
  if (!targetEngine) {
    const defaultPackId = GAME_DEFAULT_PACKS[gameId];
    targetEngine = getMusicPackEntry(defaultPackId)?.engine || MUSIC_ENGINES.PROCEDURAL;
  }

  const entry = resolveMusicPack(gameId, targetEngine);
  if (!entry) throw new Error(`No compatible Music Pack for ${gameId}`);
  return entry;
}

export function createMusicRuntime({
  gameId,
  packId,
  engine,
  callbacks = {},
  settings = getMusicSettings(),
  formatOptions = {},
} = {}) {
  const entry = resolveMusicAsset({ gameId, packId, engine });
  const formatResolution = entry.engine === MUSIC_ENGINES.WAV_STEM
    ? resolvePackAudioFormat(entry.pack, formatOptions)
    : { pack: entry.pack, selection: null, candidates: [] };

  const options = {
    pack: formatResolution.pack,
    onModeChange: callbacks.onModeChange,
    onSync: callbacks.onSync,
    onLayerChange: callbacks.onLayerChange,
    onPackChange: callbacks.onPackChange,
    onFormatChange: callbacks.onFormatChange,
  };

  let manager;
  if (entry.engine === MUSIC_ENGINES.PROCEDURAL) {
    manager = new MusicManager(options);
  } else if (entry.engine === MUSIC_ENGINES.WAV_STEM) {
    manager = new WavStemMusicManager(options);
  } else {
    throw new Error(`Unsupported music engine: ${entry.engine}`);
  }

  configureMusicManager(manager, settings);

  return {
    entry,
    engine: entry.engine,
    manager,
    settings,
    audioFormat: formatResolution.selection?.format || null,
    audioFormatSelection: formatResolution.selection || null,
    audioFormatCandidates: [...(formatResolution.candidates || [])],
    capabilities: { ...(MUSIC_CAPABILITIES[entry.engine] || {}) },
  };
}

const STATE_MAP = Object.freeze({
  normal: Object.freeze({
    [MUSIC_ENGINES.PROCEDURAL]: { mode: "normal", preset: null },
    [MUSIC_ENGINES.WAV_STEM]: { mode: "normal", preset: "focus" },
  }),
  tension: Object.freeze({
    [MUSIC_ENGINES.PROCEDURAL]: { mode: "tension", preset: null },
    [MUSIC_ENGINES.WAV_STEM]: { mode: "overdrive", preset: "overdrive" },
  }),
  result: Object.freeze({
    [MUSIC_ENGINES.PROCEDURAL]: { mode: "result", preset: null },
    [MUSIC_ENGINES.WAV_STEM]: { mode: "result", preset: "result" },
  }),
});

export async function applyMusicState(runtime, state, options = {}) {
  if (!runtime?.manager) return null;
  const mapping = STATE_MAP[state]?.[runtime.engine];
  if (!mapping) throw new Error(`Unsupported music state: ${state}`);

  const manager = runtime.manager;
  const quantize = options.quantize || "bar";

  if (
    mapping.preset &&
    runtime.entry?.pack?.layerPresets?.[mapping.preset] &&
    typeof manager.setLayerPreset === "function"
  ) {
    await manager.setLayerPreset(mapping.preset, {
      quantize,
      fadeBeats: Number(options.fadeBeats ?? 1),
      seconds: options.seconds,
    });
  }

  if (
    mapping.mode &&
    runtime.entry?.pack?.modes?.[mapping.mode] &&
    typeof manager.transitionTo === "function"
  ) {
    if (runtime.engine === MUSIC_ENGINES.PROCEDURAL) {
      await manager.transitionTo(mapping.mode, {
        quantize,
        crossfadeBeats: Number(options.crossfadeBeats ?? 1.5),
        seconds: options.seconds,
      });
    } else {
      await manager.transitionTo(mapping.mode);
    }
  }

  return { state, ...mapping };
}

export async function playMusicOutcome(runtime, success, options = {}) {
  if (!runtime?.manager) return null;
  const manager = runtime.manager;

  if (runtime.capabilities?.stingers && typeof manager.playStinger === "function") {
    const name = success ? "victory" : "gameover";
    const result = await manager.playStinger(name, {
      duck: Number(options.duck ?? 0.28),
      attack: Number(options.attack ?? 0.06),
      release: Number(options.release ?? 0.32),
    });
    return { type: "stinger", name, format: result?.format || null };
  }

  if (typeof manager.sfx === "function") {
    const name = success ? "win" : "lose";
    manager.sfx(name);
    return { type: "sfx", name };
  }

  return null;
}

export function stopMusicRuntime(runtime) {
  try { runtime?.manager?.stop?.(); } catch (_) {}
}

export function getRuntimeDescriptor(runtime) {
  if (!runtime) return null;
  const formatInfo = runtime.manager?.getAudioFormatInfo?.() || null;
  const activeFormat = formatInfo?.format || runtime.audioFormat || null;

  return {
    packId: runtime.entry?.id || null,
    packName: runtime.entry?.name || null,
    version: runtime.entry?.version || null,
    schemaVersion: runtime.entry?.schemaVersion || null,
    facadeApi: runtime.entry?.facadeApi || null,
    engine: runtime.engine || null,
    formats: [...(runtime.entry?.formats || [])],
    audioFormat: activeFormat,
    stingerAudioFormat: formatInfo?.stingerFormat || activeFormat,
    audioFormatCandidates: [
      ...(formatInfo?.candidates || runtime.audioFormatCandidates || []),
    ],
    audioFormatAttempts: (formatInfo?.attempts || []).map((attempt) => ({ ...attempt })),
    audioFormatSelection: runtime.audioFormatSelection ? { ...runtime.audioFormatSelection } : null,
    states: [...(runtime.entry?.states || [])],
    stems: [...(runtime.entry?.stems || [])],
    stingers: [...(runtime.entry?.stingers || [])],
    capabilities: { ...(runtime.capabilities || {}) },
  };
}
