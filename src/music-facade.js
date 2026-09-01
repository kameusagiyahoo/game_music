import {
  createMusicRuntime,
  applyMusicState,
  playMusicOutcome,
  stopMusicRuntime,
  getRuntimeDescriptor,
  prepareMusicPackForRuntime,
} from "./music-asset-resolver.js";
import { getMusicPackEntry, getMusicSettings } from "./music-registry.js";
import { ensureMusicServiceWorker } from "./music-service-worker.js";

const normalizeOutcome = (value) => {
  if (typeof value === "boolean") return value;
  return ["win", "victory", "success", "clear", "cleared", "true"].includes(String(value).toLowerCase());
};

export class MusicFacade {
  constructor(runtime) {
    if (!runtime?.manager) throw new Error("MusicFacade requires a valid runtime");
    this.runtime = runtime;
  }

  get entry() { return this.runtime.entry; }
  get engine() { return this.runtime.engine; }
  get capabilities() { return { ...(this.runtime.capabilities || {}) }; }
  get running() { return Boolean(this.runtime.manager?.running); }

  async start(state = "normal", options = {}) {
    const manager = this.runtime.manager;
    const startMode = this.runtime.entry?.pack?.modes?.normal ? "normal" : state;
    await manager.play(startMode);
    if (state !== startMode) await this.state(state, { ...options, quantize: "immediate" });
    return this.info();
  }

  async state(name, options = {}) { return applyMusicState(this.runtime, name, options); }
  cue(name) { this.runtime.manager?.sfx?.(name); }
  async outcome(value, options = {}) { return playMusicOutcome(this.runtime, normalizeOutcome(value), options); }

  async transitionCue(name, options = {}) {
    const manager = this.runtime.manager;
    if (!this.runtime.capabilities?.transitionCues || typeof manager.playTransitionCue !== "function") return null;
    return manager.playTransitionCue(name, options);
  }

  async preload(options = {}) {
    const manager = this.runtime.manager;
    const serviceWorker = await ensureMusicServiceWorker();

    if (typeof manager.preload !== "function") {
      return {
        state: "not-needed",
        engine: this.runtime.engine,
        serviceWorker,
      };
    }

    const result = await manager.preload(options);
    return {
      ...result,
      serviceWorker,
    };
  }

  stop() { stopMusicRuntime(this.runtime); }

  async audio({ musicEnabled, sfxEnabled, musicVolume, sfxVolume } = {}) {
    const manager = this.runtime.manager;
    const tasks = [];
    if (musicEnabled !== undefined && typeof manager.setMusicEnabled === "function") tasks.push(manager.setMusicEnabled(Boolean(musicEnabled)));
    if (sfxEnabled !== undefined && typeof manager.setSfxEnabled === "function") tasks.push(manager.setSfxEnabled(Boolean(sfxEnabled)));
    if (musicVolume !== undefined && typeof manager.setMusicVolume === "function") manager.setMusicVolume(Number(musicVolume));
    if (sfxVolume !== undefined && typeof manager.setSfxVolume === "function") manager.setSfxVolume(Number(sfxVolume));
    if (tasks.length) await Promise.all(tasks);
    return this.info();
  }

  async layer(preset, options = {}) {
    const manager = this.runtime.manager;
    if (!this.runtime.capabilities?.layerMix || typeof manager.setLayerPreset !== "function") return null;
    if (!this.runtime.entry?.pack?.layerPresets?.[preset]) throw new Error(`Unknown layer preset: ${preset}`);
    await manager.setLayerPreset(preset, options);
    return { preset };
  }

  async pack(packId, options = {}) {
    const manager = this.runtime.manager;
    const entry = getMusicPackEntry(packId);
    if (!entry) throw new Error(`Unknown Music Pack: ${packId}`);
    if (entry.engine !== this.runtime.engine) throw new Error(`Cross-engine pack switch requires a new facade: ${this.runtime.engine} -> ${entry.engine}`);

    const prepared = prepareMusicPackForRuntime(
      entry,
      this.runtime.formatOptions || {},
    );

    if (options.immediate && typeof manager.setPack === "function") {
      manager.setPack(prepared.pack);
      this.runtime.entry = entry;
      this.runtime.audioFormat = prepared.selection?.format || this.runtime.audioFormat;
      this.runtime.audioFormatSelection = prepared.selection || null;
      this.runtime.audioFormatCandidates = [...prepared.candidates];
      return this.info();
    }
    if (typeof manager.switchPack !== "function") {
      throw new Error(`Pack switching is not supported by engine: ${this.runtime.engine}`);
    }

    await manager.switchPack(prepared.pack, options);
    if (!manager.running) {
      this.runtime.entry = entry;
      this.runtime.audioFormat = prepared.selection?.format || this.runtime.audioFormat;
      this.runtime.audioFormatSelection = prepared.selection || null;
      this.runtime.audioFormatCandidates = [...prepared.candidates];
    }
    return this.info();
  }

  cancel(kind = "all") {
    const manager = this.runtime.manager;
    if ((kind === "all" || kind === "pack") && typeof manager.cancelPendingPackSwitch === "function") manager.cancelPendingPackSwitch();
    if ((kind === "all" || kind === "state") && typeof manager.cancelPendingTransition === "function") manager.cancelPendingTransition();
    if ((kind === "all" || kind === "layer") && typeof manager.cancelPendingLayerMix === "function") manager.cancelPendingLayerMix();
    if ((kind === "all" || kind === "stinger") && typeof manager.cancelPendingStinger === "function") manager.cancelPendingStinger();
    if ((kind === "all" || kind === "transitionCue") && typeof manager.cancelPendingTransitionCue === "function") manager.cancelPendingTransitionCue();
  }

  meter() {
    return this.runtime.manager?.getMeterSnapshot?.() || {
      supported: false,
      contextState: "unavailable",
      preLimiter: { peakDbfs: -180, rmsDbfs: -180, peak: 0, rms: 0 },
      output: { peakDbfs: -180, rmsDbfs: -180, peak: 0, rms: 0 },
      limiterReductionDb: 0,
      stems: {},
      stinger: null,
      transitionCue: null,
    };
  }

  info() {
    const base = getRuntimeDescriptor(this.runtime) || {};
    const packInfo = this.runtime.manager?.getPackInfo?.() || {};
    return {
      ...base,
      id: packInfo.id || this.runtime.entry?.id || null,
      name: packInfo.name || this.runtime.entry?.name || null,
      pendingId: packInfo.pendingId || null,
      pendingName: packInfo.pendingName || null,
      running: this.running,
    };
  }
}

export function createMusicFacade({
  gameId,
  packId,
  engine,
  callbacks = {},
  settings = getMusicSettings(),
  formatOptions = {},
} = {}) {
  const runtime = createMusicRuntime({ gameId, packId, engine, callbacks, settings, formatOptions });
  return new MusicFacade(runtime);
}

export async function preloadMusicAssets({
  gameId,
  packId,
  engine,
  settings = getMusicSettings(),
  formatOptions = {},
  preloadOptions = {},
} = {}) {
  const facade = createMusicFacade({ gameId, packId, engine, settings, formatOptions });
  return facade.preload(preloadOptions);
}
