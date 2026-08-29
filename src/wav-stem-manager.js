import { rememberAudioFormat } from "./music-format-resolver.js";
import { getAudioBytes, preloadAudioUrls, getAudioAssetCacheInfo, getPersistentAudioCacheInfo } from "./audio-asset-cache.js";

const STEMS = ["drums", "bass", "chords", "melody", "sparkle"];
const STEPS_PER_BEAT = 2;
const BEATS_PER_BAR = 4;
const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value)));

export class WavStemMusicManager {
  constructor({ pack, onModeChange, onSync, onLayerChange, onFormatChange } = {}) {
    this.pack = pack;
    this.onModeChange = onModeChange || (() => {});
    this.onSync = onSync || (() => {});
    this.onLayerChange = onLayerChange || (() => {});
    this.onFormatChange = onFormatChange || (() => {});

    this.context = null;
    this.master = null;
    this.musicRoot = null;
    this.stingerBus = null;
    this.transitionBus = null;
    this.sfxBus = null;
    this.layerBuses = {};

    this.buffers = {};
    this.stingerBuffers = {};
    this.transitionCueBuffers = {};
    this.sources = {};
    this.stingerSource = null;
    this.transitionCueSource = null;
    this.transitionCueGain = null;

    this.running = false;
    this.mode = "normal";
    this.timer = null;
    this.transportStart = 0;
    this.lastStep = -1;

    this.pendingLayerMix = null;
    this.pendingLayerPreset = null;
    this.pendingLayerQuantize = null;
    this.pendingModeTransition = null;
    this.pendingStinger = null;
    this.pendingTransitionCue = null;
    this.pendingLayerScheduledAt = null;
    this.layerPreset = pack?.defaultLayerPreset || null;
    this.layerMix = this.#initialMix();

    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.musicVolume = 0.80;
    this.sfxVolume = 0.76;
    this.duckAmount = 1;

    this.selectedAudioFormat = pack?.selectedAudioFormat || pack?.audioStems?.selectedFormat || "wav";
    this.stingerAudioFormat = pack?.stingers?.selectedFormat || this.selectedAudioFormat;
    this.transitionCueAudioFormat = pack?.transitionCues?.selectedFormat || this.selectedAudioFormat;
    this.audioFormatCandidates = [...new Set(
      (pack?.audioFormatCandidates?.length ? pack.audioFormatCandidates : [this.selectedAudioFormat]).filter(Boolean)
    )];
    this.audioFormatAttempts = [];
    this.preloadPromise = null;
    this.preloadState = {
      state: "idle",
      format: this.selectedAudioFormat,
      requested: 0,
      loaded: 0,
      error: null,
      persistent: null,
    };
  }

  async init() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.musicRoot = this.context.createGain();
      this.stingerBus = this.context.createGain();
      this.transitionBus = this.context.createGain();
      this.sfxBus = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();

      this.master.gain.value = 1;
      this.musicRoot.gain.value = this.musicEnabled ? this.musicVolume : 0.0001;
      this.stingerBus.gain.value = this.musicEnabled ? this.musicVolume : 0.0001;
      this.transitionBus.gain.value = this.musicEnabled ? this.musicVolume : 0.0001;
      this.sfxBus.gain.value = this.sfxEnabled ? this.sfxVolume : 0.0001;

      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.18;

      this.musicRoot.connect(this.master);
      this.stingerBus.connect(this.master);
      this.transitionBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(compressor);
      compressor.connect(this.context.destination);

      STEMS.forEach((name) => {
        const bus = this.context.createGain();
        bus.gain.value = Math.max(0.0001, this.layerMix[name] ?? 1);
        bus.connect(this.musicRoot);
        this.layerBuses[name] = bus;
      });
    }

    if (this.context.state !== "running") await this.context.resume();
  }

  async play(mode = "normal") {
    await this.init();
    this.audioFormatAttempts = [];
    this.onModeChange("LOADING · WAV STEMS", {
      mode: "loading",
      pendingMode: null,
      engine: "wav",
      format: this.selectedAudioFormat,
    });
    await this.#loadBuffers();
    this.stop({ keepStatus: true });

    this.running = true;
    this.mode = mode;
    this.lastStep = -1;
    this.pendingLayerMix = null;
    this.pendingLayerPreset = null;
    this.pendingLayerQuantize = null;
    this.pendingModeTransition = null;
    this.pendingStinger = null;
    this.pendingTransitionCue = null;
    this.pendingLayerScheduledAt = null;
    this.layerPreset = this.pack?.defaultLayerPreset || null;
    this.layerMix = this.#initialMix();
    this.duckAmount = 1;
    this.#applyMusicRootGain(0.01);
    this.#applyLayerMix(this.layerMix, 0.01, this.layerPreset);

    const startAt = this.context.currentTime + 0.10;
    this.transportStart = startAt;

    STEMS.forEach((name) => {
      const buffer = this.buffers[name];
      if (!buffer) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;
      source.connect(this.layerBuses[name]);
      source.start(startAt);
      this.sources[name] = source;
    });

    this.#announce();
    this.#announceLayers();
    this.timer = window.setInterval(() => this.#clock(), 20);
  }

  async transitionTo(mode, options = {}) {
    if (!this.pack?.modes?.[mode]) return null;
    await this.init();

    const config = { quantize: "immediate", ...options };
    if (
      this.running &&
      (config.quantize === "beat" || config.quantize === "bar")
    ) {
      this.pendingModeTransition = {
        mode,
        quantize: config.quantize,
        scheduledAt: Number(config.scheduledAt || 0) || null,
      };
      this.#announce();
      this.#sync(this.lastStep < 0 ? 0 : this.lastStep);
      return {
        mode,
        pending: true,
        quantize: config.quantize,
      };
    }

    this.pendingModeTransition = null;
    this.mode = mode;
    this.#announce();
    this.#sync(this.lastStep < 0 ? 0 : this.lastStep);
    return {
      mode,
      pending: false,
      quantize: "immediate",
    };
  }

  setMode(mode) {
    return this.transitionTo(mode);
  }

  cancelPendingTransition() {
    this.pendingModeTransition = null;
    this.#announce();
    if (this.lastStep >= 0) this.#sync(this.lastStep);
  }

  async setLayerPreset(name, options = {}) {
    const preset = this.pack?.layerPresets?.[name];
    if (!preset) throw new Error(`Unknown layer preset: ${name}`);
    return this.setLayerMix(preset, { ...options, preset: name });
  }

  async setLayerMix(mix, options = {}) {
    await this.init();
    const config = { quantize: "immediate", fadeBeats: 1, ...options };
    const target = this.#normalizeMix({ ...this.layerMix, ...mix });

    if (
      this.running &&
      (config.quantize === "beat" || config.quantize === "bar")
    ) {
      this.pendingLayerMix = target;
      this.pendingLayerPreset = config.preset || null;
      this.pendingLayerQuantize = config.quantize;
      this.pendingLayerScheduledAt = Number(config.scheduledAt || 0) || null;
      this.#announceLayers();
      this.#sync(this.lastStep < 0 ? 0 : this.lastStep);
      return {
        pending: true,
        quantize: config.quantize,
        preset: config.preset || null,
      };
    }

    const seconds = Number(config.seconds ?? this.#beatsToSeconds(config.fadeBeats ?? 1));
    this.#applyLayerMix(target, seconds, config.preset || null);
  }

  cancelPendingLayerMix() {
    this.pendingLayerMix = null;
    this.pendingLayerPreset = null;
    this.pendingLayerQuantize = null;
    this.pendingLayerScheduledAt = null;
    this.#announceLayers();
    if (this.lastStep >= 0) this.#sync(this.lastStep);
  }

  getLayerMix() {
    return { ...this.layerMix };
  }

  getQuantizedTime(quantize = "immediate", fromTime = null) {
    if (!this.context) return 0;

    const now = this.context.currentTime;
    const minimumLead = 0.02;
    if (
      !this.running ||
      (quantize !== "beat" && quantize !== "bar") ||
      !Number.isFinite(this.transportStart)
    ) {
      return Math.max(now + 0.015, Number(fromTime ?? now));
    }

    const bpm = Number(this.pack?.audioStems?.bpm || 112);
    const beatSeconds = 60 / bpm;
    const quantum = quantize === "bar" ? beatSeconds * BEATS_PER_BAR : beatSeconds;
    const reference = Math.max(Number(fromTime ?? now), now + minimumLead);
    const elapsed = Math.max(0, reference - this.transportStart);
    const index = Math.ceil(elapsed / quantum);
    return this.transportStart + index * quantum;
  }

  getStingerInfo() {
    const scheduledAt = Number(this.pendingStinger?.scheduledAt || 0);
    const now = Number(this.context?.currentTime || 0);
    return {
      name: this.pendingStinger?.name || null,
      quantize: this.pendingStinger?.quantize || null,
      scheduledAt: scheduledAt || null,
      pending: Boolean(this.stingerSource && scheduledAt > now),
      playing: Boolean(this.stingerSource && (!scheduledAt || scheduledAt <= now)),
    };
  }

  getTransitionCueForMode(mode) {
    const value = this.pack?.transitionCues?.modeMap?.[mode];
    if (!value) return null;
    if (typeof value === "string") return { cue: value, position: "at" };
    return {
      cue: value.cue,
      position: value.position === "before" ? "before" : "at",
    };
  }

  getTransitionCueInfo() {
    const scheduledAt = Number(this.pendingTransitionCue?.scheduledAt || 0);
    const transitionAt = Number(this.pendingTransitionCue?.transitionAt || 0);
    const now = Number(this.context?.currentTime || 0);
    return {
      name: this.pendingTransitionCue?.name || null,
      position: this.pendingTransitionCue?.position || null,
      quantize: this.pendingTransitionCue?.quantize || null,
      scheduledAt: scheduledAt || null,
      transitionAt: transitionAt || null,
      pending: Boolean(this.transitionCueSource && scheduledAt > now),
      playing: Boolean(
        this.transitionCueSource &&
        scheduledAt <= now &&
        (!this.pendingTransitionCue?.endsAt || this.pendingTransitionCue.endsAt > now)
      ),
    };
  }

  getAudioFormatInfo() {
    return {
      format: this.selectedAudioFormat,
      stingerFormat: this.stingerAudioFormat,
      candidates: [...this.audioFormatCandidates],
      attempts: this.audioFormatAttempts.map((attempt) => ({ ...attempt })),
    };
  }

  async preload({ stingers = true, transitions = true, concurrency = 4 } = {}) {
    if (this.preloadPromise) return this.preloadPromise;

    const format = this.selectedAudioFormat || this.audioFormatCandidates[0] || "wav";
    const stemFiles = this.#filesForFormat("audioStems", format) || {};
    const stingerFiles = stingers ? (this.#filesForFormat("stingers", format) || {}) : {};
    const transitionFiles = transitions ? (this.#filesForFormat("transitionCues", format) || {}) : {};
    const urls = [
      ...STEMS.map((name) => stemFiles[name]).filter(Boolean),
      ...Object.values(stingerFiles).filter(Boolean),
      ...Object.values(transitionFiles).filter(Boolean),
    ];

    if (!urls.length) {
      this.preloadState = {
        state: "not-needed",
        format,
        requested: 0,
        loaded: 0,
        error: null,
        persistent: await getPersistentAudioCacheInfo(),
      };
      return this.getPreloadInfo();
    }

    this.preloadState = {
      state: "loading",
      format,
      requested: urls.length,
      loaded: 0,
      error: null,
    };

    this.preloadPromise = preloadAudioUrls(urls, { concurrency })
      .then(async (result) => {
        this.preloadState = {
          state: "ready",
          format,
          requested: result.requested,
          loaded: result.loaded,
          error: null,
          persistent: await getPersistentAudioCacheInfo(),
        };
        return this.getPreloadInfo();
      })
      .catch(async (error) => {
        this.preloadState = {
          state: "error",
          format,
          requested: urls.length,
          loaded: 0,
          error: error?.message || String(error),
          persistent: await getPersistentAudioCacheInfo(),
        };
        throw error;
      })
      .finally(() => {
        this.preloadPromise = null;
      });

    return this.preloadPromise;
  }

  getPreloadInfo() {
    return {
      ...this.preloadState,
      cache: getAudioAssetCacheInfo(),
    };
  }

  getDebugState() {
    const step = Math.max(0, this.lastStep);
    const barStep = step % 8;
    const elapsed = this.context && this.transportStart
      ? Math.max(0, this.context.currentTime - this.transportStart)
      : 0;

    return {
      engine: "wav",
      running: this.running,
      mode: this.mode,
      bpm: Number(this.pack?.audioStems?.bpm || 112),
      bars: Number(this.pack?.audioStems?.bars || 4),
      elapsed,
      bar: Math.floor(step / 8) + 1,
      beat: Math.floor(barStep / 2) + 1,
      subdivision: barStep % 2,
      layerPreset: this.layerPreset,
      pendingLayerPreset: this.pendingLayerPreset,
      layerMix: { ...this.layerMix },
      stemBuffersReady: STEMS.every((name) => Boolean(this.buffers[name])),
      loadedStingers: Object.keys(this.stingerBuffers),
      loadedTransitionCues: Object.keys(this.transitionCueBuffers),
      transitionCue: this.getTransitionCueInfo(),
      stingerPlaying: this.getStingerInfo().playing,
      stingerPending: this.getStingerInfo().pending,
      pendingStinger: this.getStingerInfo(),
      pendingMode: this.pendingModeTransition?.mode || null,
      pendingModeQuantize: this.pendingModeTransition?.quantize || null,
      pendingLayerQuantize: this.pendingLayerQuantize,
      audioFormat: this.selectedAudioFormat,
      stingerAudioFormat: this.stingerAudioFormat,
      transitionCueAudioFormat: this.transitionCueAudioFormat,
      audioFormatCandidates: [...this.audioFormatCandidates],
      audioFormatAttempts: this.audioFormatAttempts.map((attempt) => ({ ...attempt })),
    };
  }

  stop(options = {}) {
    this.running = false;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;

    Object.values(this.sources).forEach((source) => {
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    });
    this.sources = {};
    this.stopStinger({ restoreMusic: false });
    this.stopTransitionCue();

    this.lastStep = -1;
    this.pendingLayerMix = null;
    this.pendingLayerPreset = null;
    this.pendingLayerQuantize = null;
    this.pendingModeTransition = null;
    this.pendingStinger = null;
    this.pendingTransitionCue = null;
    this.pendingLayerScheduledAt = null;
    this.duckAmount = 1;
    if (this.context) this.#applyMusicRootGain(0.04);

    if (!options.keepStatus) {
      this.onModeChange("READY · music stopped", {
        mode: "ready",
        pendingMode: null,
        engine: "wav",
        format: this.selectedAudioFormat,
      });
      this.onSync({
        bar: 0,
        beat: 0,
        subdivision: 0,
        mode: "ready",
        pendingLayerPreset: null,
        layerMix: { ...this.layerMix },
        engine: "wav",
        format: this.selectedAudioFormat,
      });
    }
  }

  async setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (!this.context && enabled) await this.init();
    if (!this.context) return;
    this.#applyMusicRootGain(0.06);
    this.#ramp(this.stingerBus.gain, enabled ? this.musicVolume : 0.0001, 0.06);
    this.#ramp(this.transitionBus.gain, enabled ? this.musicVolume : 0.0001, 0.06);
  }

  async setSfxEnabled(enabled) {
    this.sfxEnabled = enabled;
    if (!this.context && enabled) await this.init();
    if (!this.context) return;
    this.#ramp(this.sfxBus.gain, enabled ? this.sfxVolume : 0.0001, 0.06);
  }

  async setEnabled(enabled) {
    await Promise.all([this.setMusicEnabled(enabled), this.setSfxEnabled(enabled)]);
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0.01, Math.min(1, Number(value)));
    if (!this.context || !this.musicEnabled) return;
    this.#applyMusicRootGain(0.04);
    this.#ramp(this.stingerBus.gain, this.musicVolume, 0.04);
    this.#ramp(this.transitionBus.gain, this.musicVolume, 0.04);
  }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0.01, Math.min(1, Number(value)));
    if (this.context && this.sfxEnabled) this.#ramp(this.sfxBus.gain, this.sfxVolume, 0.04);
  }

  async playStinger(name, options = {}) {
    await this.init();
    const file = this.pack?.stingers?.files?.[name];
    if (!file && !this.pack?.stingers?.formats) throw new Error(`Unknown stinger: ${name}`);

    const buffer = await this.#loadStingerBuffer(name, file);
    this.stopStinger({ restoreMusic: true });

    const duck = Math.max(0.08, Math.min(1, Number(options.duck ?? 0.30)));
    const attack = Math.max(0.01, Number(options.attack ?? 0.07));
    const release = Math.max(0.02, Number(options.release ?? 0.28));
    const quantize = options.quantize === "beat" || options.quantize === "bar"
      ? options.quantize
      : "immediate";
    const requestedAt = Number(options.scheduledAt || 0);
    const scheduledAt = requestedAt > this.context.currentTime
      ? requestedAt
      : this.getQuantizedTime(quantize);

    this.duckAmount = duck;
    this.#scheduleMusicDuck(scheduledAt, attack);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.stingerBus);
    this.stingerSource = source;
    this.pendingStinger = {
      name,
      quantize,
      scheduledAt,
    };

    source.onended = () => {
      if (this.stingerSource !== source) return;
      this.stingerSource = null;
      this.pendingStinger = null;
      this.duckAmount = 1;
      this.#applyMusicRootGain(release);
    };

    source.start(scheduledAt);
    return {
      name,
      duration: buffer.duration,
      format: this.stingerAudioFormat,
      quantize,
      scheduledAt,
      delaySeconds: Math.max(0, scheduledAt - this.context.currentTime),
    };
  }

  stopStinger(options = {}) {
    const source = this.stingerSource;
    this.stingerSource = null;
    this.pendingStinger = null;
    if (source) {
      try { source.onended = null; } catch (_) {}
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    }
    if (options.restoreMusic !== false) {
      this.duckAmount = 1;
      if (this.context) this.#applyMusicRootGain(0.12);
    }
  }

  cancelPendingStinger() {
    const info = this.getStingerInfo();
    if (!info.pending) return false;
    this.stopStinger({ restoreMusic: true });
    return true;
  }

  async playTransitionCue(name, options = {}) {
    await this.init();
    const file = this.pack?.transitionCues?.files?.[name];
    if (!file && !this.pack?.transitionCues?.formats) {
      throw new Error(`Unknown transition cue: ${name}`);
    }

    const buffer = await this.#loadTransitionCueBuffer(name, file);
    this.stopTransitionCue();

    const quantize = options.quantize === "beat" || options.quantize === "bar"
      ? options.quantize
      : "immediate";
    const requestedPosition = options.position === "before" ? "before" : "at";
    const position = quantize === "immediate" ? "at" : requestedPosition;
    const requestedAt = Number(options.scheduledAt || 0);
    let transitionAt;
    let scheduledAt;

    if (requestedAt > this.context.currentTime) {
      transitionAt = requestedAt;
      scheduledAt = position === "before"
        ? Math.max(this.context.currentTime + 0.015, transitionAt - buffer.duration)
        : transitionAt;
    } else if (position === "before") {
      transitionAt = this.getQuantizedTime(
        quantize,
        this.context.currentTime + buffer.duration + 0.025,
      );
      scheduledAt = Math.max(this.context.currentTime + 0.015, transitionAt - buffer.duration);
    } else {
      transitionAt = this.getQuantizedTime(quantize);
      scheduledAt = transitionAt;
    }

    const gainNode = this.context.createGain();
    gainNode.gain.value = Math.max(0.0001, clamp01(options.gain ?? 0.72));

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(this.transitionBus);

    this.transitionCueSource = source;
    this.transitionCueGain = gainNode;
    this.pendingTransitionCue = {
      name,
      position,
      quantize,
      scheduledAt,
      transitionAt,
      endsAt: scheduledAt + buffer.duration,
    };

    source.onended = () => {
      if (this.transitionCueSource !== source) return;
      this.transitionCueSource = null;
      this.transitionCueGain = null;
      this.pendingTransitionCue = null;
      try { gainNode.disconnect(); } catch (_) {}
    };

    source.start(scheduledAt);

    return {
      name,
      duration: buffer.duration,
      format: this.transitionCueAudioFormat,
      position,
      quantize,
      scheduledAt,
      transitionAt,
      delaySeconds: Math.max(0, scheduledAt - this.context.currentTime),
    };
  }

  stopTransitionCue() {
    const source = this.transitionCueSource;
    const gainNode = this.transitionCueGain;
    this.transitionCueSource = null;
    this.transitionCueGain = null;
    this.pendingTransitionCue = null;

    if (source) {
      try { source.onended = null; } catch (_) {}
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    }
    if (gainNode) {
      try { gainNode.disconnect(); } catch (_) {}
    }
  }

  cancelPendingTransitionCue() {
    const info = this.getTransitionCueInfo();
    if (!info.pending) return false;
    this.stopTransitionCue();
    return true;
  }

  sfx(name) {
    if (!this.sfxEnabled || !this.context) return;
    const now = this.context.currentTime + 0.005;
    if (name === "perfect") {
      this.#voice(660, now, 0.09, 0.05, "sine");
      this.#voice(990, now + 0.055, 0.12, 0.04, "sine");
    } else if (name === "good") {
      this.#voice(560, now, 0.08, 0.04, "triangle");
    } else if (name === "miss") {
      this.#voice(210, now, 0.13, 0.045, "triangle");
    } else if (name === "win") {
      [523.25, 659.25, 783.99].forEach((hz, index) => this.#voice(hz, now + index * 0.12, index === 2 ? 0.30 : 0.17, 0.055, "triangle"));
    } else if (name === "lose") {
      this.#voice(330, now, 0.18, 0.045, "triangle");
      this.#voice(247, now + 0.14, 0.28, 0.04, "triangle");
    } else if (name === "toggle") {
      this.#voice(660, now, 0.07, 0.035, "sine");
    }
  }

  async #loadBuffers() {
    if (STEMS.every((name) => Boolean(this.buffers[name]))) return;

    const candidates = this.#orderedFormatCandidates();
    let lastError = null;

    for (const format of candidates) {
      try {
        const files = this.#filesForFormat("audioStems", format);
        if (!files) throw new Error(`No stem file set for ${format}`);

        this.onModeChange(`LOADING · ${format.toUpperCase()} STEMS`, {
          mode: "loading",
          pendingMode: null,
          engine: "wav",
          format,
        });

        const decoded = await Promise.all(STEMS.map(async (name) => {
          const url = files[name];
          if (!url) throw new Error(`${format} missing stem ${name}`);
          const data = await getAudioBytes(url);
          const buffer = await this.context.decodeAudioData(data);
          return [name, buffer];
        }));

        // Commit only when every stem in the format decoded successfully.
        this.buffers = Object.fromEntries(decoded);
        this.#commitStemFormat(format);
        return;
      } catch (error) {
        lastError = error;
        this.audioFormatAttempts.push({
          stage: "stems",
          format,
          message: error?.message || String(error),
        });
        console.warn(`[Music] ${format} stem decode failed; trying fallback`, error);
      }
    }

    throw new Error(
      `Failed to load audio stems after ${candidates.join(" → ")}: ${lastError?.message || "unknown error"}`
    );
  }

  async #loadStingerBuffer(name, fallbackFile) {
    if (this.stingerBuffers[name]) return this.stingerBuffers[name];

    const candidates = [...new Set([
      this.stingerAudioFormat,
      ...this.#orderedFormatCandidates(),
    ].filter(Boolean))];
    let lastError = null;

    for (const format of candidates) {
      try {
        const files = this.#filesForFormat("stingers", format);
        const file = files?.[name] || (format === this.selectedAudioFormat ? fallbackFile : null);
        if (!file) throw new Error(`${format} missing stinger ${name}`);

        const data = await getAudioBytes(file);
        const buffer = await this.context.decodeAudioData(data);

        this.stingerBuffers[name] = buffer;
        this.stingerAudioFormat = format;
        this.onFormatChange({
          ...this.getAudioFormatInfo(),
          stage: "stinger",
          name,
        });
        return buffer;
      } catch (error) {
        lastError = error;
        this.audioFormatAttempts.push({
          stage: "stinger",
          format,
          name,
          message: error?.message || String(error),
        });
        console.warn(`[Music] ${format} stinger decode failed; trying fallback`, error);
      }
    }

    throw new Error(
      `Failed to load stinger ${name} after ${candidates.join(" → ")}: ${lastError?.message || "unknown error"}`
    );
  }

  async #loadTransitionCueBuffer(name, fallbackFile) {
    if (this.transitionCueBuffers[name]) return this.transitionCueBuffers[name];

    const candidates = [...new Set([
      this.transitionCueAudioFormat,
      ...this.#orderedFormatCandidates(),
    ].filter(Boolean))];
    let lastError = null;

    for (const format of candidates) {
      try {
        const files = this.#filesForFormat("transitionCues", format);
        const file = files?.[name] || (format === this.selectedAudioFormat ? fallbackFile : null);
        if (!file) throw new Error(`${format} missing transition cue ${name}`);

        const data = await getAudioBytes(file);
        const buffer = await this.context.decodeAudioData(data);

        this.transitionCueBuffers[name] = buffer;
        this.transitionCueAudioFormat = format;
        this.onFormatChange({
          ...this.getAudioFormatInfo(),
          stage: "transition-cue",
          name,
        });
        return buffer;
      } catch (error) {
        lastError = error;
        this.audioFormatAttempts.push({
          stage: "transition-cue",
          format,
          name,
          message: error?.message || String(error),
        });
        console.warn(`[Music] ${format} transition cue decode failed; trying fallback`, error);
      }
    }

    throw new Error(
      `Failed to load transition cue ${name} after ${candidates.join(" → ")}: ${lastError?.message || "unknown error"}`
    );
  }

  #orderedFormatCandidates() {
    return [...new Set([
      this.selectedAudioFormat,
      ...this.audioFormatCandidates,
      "wav",
    ].filter(Boolean))];
  }

  #filesForFormat(section, format) {
    const data = this.pack?.[section];
    if (!data) return null;
    const formatted = data.formats?.[format]?.files;
    if (formatted) return formatted;
    if (!data.formats || format === data.selectedFormat || format === this.selectedAudioFormat) return data.files || null;
    return null;
  }

  #commitStemFormat(format) {
    this.selectedAudioFormat = format;
    this.stingerAudioFormat = format;
    const audioStems = this.pack?.audioStems;
    const stingers = this.pack?.stingers;
    const transitionCues = this.pack?.transitionCues;
    const stemFormat = audioStems?.formats?.[format];
    const stingerFormat = stingers?.formats?.[format];
    const transitionFormat = transitionCues?.formats?.[format];
    this.transitionCueAudioFormat = format;

    this.pack = {
      ...this.pack,
      selectedAudioFormat: format,
      audioStems: audioStems ? {
        ...audioStems,
        files: stemFormat?.files || audioStems.files,
        selectedFormat: format,
        selectedMime: stemFormat?.mime || audioStems.selectedMime || null,
      } : audioStems,
      stingers: stingers ? {
        ...stingers,
        files: stingerFormat?.files || stingers.files,
        selectedFormat: format,
        selectedMime: stingerFormat?.mime || stingers.selectedMime || null,
      } : stingers,
      transitionCues: transitionCues ? {
        ...transitionCues,
        files: transitionFormat?.files || transitionCues.files,
        selectedFormat: format,
        selectedMime: transitionFormat?.mime || transitionCues.selectedMime || null,
      } : transitionCues,
    };

    rememberAudioFormat(this.pack, format);
    this.onFormatChange({
      ...this.getAudioFormatInfo(),
      stage: "stems",
    });
  }

  #clock() {
    if (!this.running || !this.context) return;
    const bpm = Number(this.pack?.audioStems?.bpm || 112);
    const stepDuration = (60 / bpm) / 2;
    const elapsed = this.context.currentTime - this.transportStart;
    if (elapsed < 0) return;

    const step = Math.floor(elapsed / stepDuration);
    if (step === this.lastStep) return;
    if (this.lastStep >= 0 && step > this.lastStep + 1) this.lastStep = step - 1;
    this.lastStep = step;

    const barStep = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
    const atBeat = barStep % STEPS_PER_BEAT === 0;
    const atBar = barStep === 0;

    if (this.pendingModeTransition) {
      const quantize = this.pendingModeTransition.quantize || "bar";
      const scheduledAt = Number(this.pendingModeTransition.scheduledAt || 0);
      const matchesTime = scheduledAt
        ? this.context.currentTime >= scheduledAt - 0.022
        : ((quantize === "beat" && atBeat) || (quantize === "bar" && atBar));
      if (matchesTime) {
        this.mode = this.pendingModeTransition.mode;
        this.pendingModeTransition = null;
        this.#announce();
      }
    }

    if (this.pendingLayerMix) {
      const quantize = this.pendingLayerQuantize || "bar";
      const scheduledAt = Number(this.pendingLayerScheduledAt || 0);
      const matchesTime = scheduledAt
        ? this.context.currentTime >= scheduledAt - 0.022
        : ((quantize === "beat" && atBeat) || (quantize === "bar" && atBar));
      if (matchesTime) {
        const target = this.pendingLayerMix;
        const preset = this.pendingLayerPreset;
        this.pendingLayerMix = null;
        this.pendingLayerPreset = null;
        this.pendingLayerQuantize = null;
        this.pendingLayerScheduledAt = null;
        this.#applyLayerMix(target, this.#beatsToSeconds(1), preset);
      }
    }

    this.#sync(step);
  }

  #sync(step) {
    const barStep = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
    this.onSync({
      bar: Math.floor(Math.max(0, step) / 8) + 1,
      beat: Math.floor(barStep / STEPS_PER_BEAT) + 1,
      subdivision: barStep % STEPS_PER_BEAT,
      mode: this.mode,
      pendingMode: this.pendingModeTransition?.mode || null,
      pendingModeQuantize: this.pendingModeTransition?.quantize || null,
      pendingLayerPreset: this.pendingLayerPreset,
      pendingLayerQuantize: this.pendingLayerQuantize,
      pendingLayerScheduledAt: this.pendingLayerScheduledAt,
      pendingStinger: this.getStingerInfo(),
      transitionCue: this.getTransitionCueInfo(),
      layerPreset: this.layerPreset,
      layerMix: { ...this.layerMix },
      engine: "wav",
      format: this.selectedAudioFormat,
    });
  }

  #announce() {
    const label = this.pack?.modes?.[this.mode]?.label || this.mode;
    this.onModeChange(`${label} · WAV STEMS · ${this.selectedAudioFormat.toUpperCase()}`, {
      mode: this.mode,
      pendingMode: this.pendingModeTransition?.mode || null,
      pendingModeQuantize: this.pendingModeTransition?.quantize || null,
      engine: "wav",
      format: this.selectedAudioFormat,
    });
  }

  #announceLayers() {
    this.onLayerChange({
      mix: { ...this.layerMix },
      preset: this.layerPreset,
      pendingMix: this.pendingLayerMix ? { ...this.pendingLayerMix } : null,
      pendingPreset: this.pendingLayerPreset,
      pendingQuantize: this.pendingLayerQuantize,
      engine: "wav",
      format: this.selectedAudioFormat,
    });
  }

  #initialMix() {
    const preset = this.pack?.defaultLayerPreset;
    return this.#normalizeMix(this.pack?.layerPresets?.[preset] || {});
  }

  #normalizeMix(mix = {}) {
    return Object.fromEntries(STEMS.map((name) => [name, clamp01(mix[name] ?? 1)]));
  }

  #applyLayerMix(target, seconds, preset = null) {
    this.layerMix = this.#normalizeMix(target);
    if (preset) this.layerPreset = preset;

    STEMS.forEach((name) => {
      const bus = this.layerBuses[name];
      if (bus) this.#ramp(bus.gain, Math.max(0.0001, this.layerMix[name]), seconds);
    });

    this.#announceLayers();
    if (this.lastStep >= 0) this.#sync(this.lastStep);
  }

  #beatsToSeconds(beats) {
    const bpm = Number(this.pack?.audioStems?.bpm || 112);
    return Math.max(0.05, Number(beats) * 60 / bpm);
  }

  #applyMusicRootGain(seconds) {
    if (!this.context || !this.musicRoot) return;
    const target = this.musicEnabled ? this.musicVolume * this.duckAmount : 0.0001;
    this.#ramp(this.musicRoot.gain, Math.max(0.0001, target), seconds);
  }

  #scheduleMusicDuck(scheduledAt, attack) {
    if (!this.context || !this.musicRoot) return;

    const param = this.musicRoot.gain;
    const now = this.context.currentTime;
    const target = this.musicEnabled
      ? Math.max(0.0001, this.musicVolume * this.duckAmount)
      : 0.0001;
    const duckStart = Math.max(now, scheduledAt - attack);
    const current = Math.max(param.value, 0.0001);

    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
    if (duckStart > now) param.setValueAtTime(current, duckStart);
    param.exponentialRampToValueAtTime(
      target,
      Math.max(duckStart + 0.01, scheduledAt),
    );
  }

  #ramp(param, value, seconds) {
    const now = this.context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(param.value, 0.0001), now);
    param.exponentialRampToValueAtTime(Math.max(value, 0.0001), now + Math.max(0.01, seconds));
  }

  #voice(frequency, start, duration, gain, type) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(this.sfxBus);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
