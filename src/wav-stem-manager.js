const STEMS = ["drums", "bass", "chords", "melody", "sparkle"];
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value)));

export class WavStemMusicManager {
  constructor({ pack, onModeChange, onSync, onLayerChange } = {}) {
    this.pack = pack;
    this.onModeChange = onModeChange || (() => {});
    this.onSync = onSync || (() => {});
    this.onLayerChange = onLayerChange || (() => {});

    this.context = null;
    this.master = null;
    this.musicRoot = null;
    this.stingerBus = null;
    this.sfxBus = null;
    this.layerBuses = {};

    this.buffers = {};
    this.stingerBuffers = {};
    this.sources = {};
    this.stingerSource = null;

    this.running = false;
    this.mode = "normal";
    this.timer = null;
    this.transportStart = 0;
    this.lastStep = -1;

    this.pendingLayerMix = null;
    this.pendingLayerPreset = null;
    this.layerPreset = pack?.defaultLayerPreset || null;
    this.layerMix = this.#initialMix();

    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.musicVolume = 0.80;
    this.sfxVolume = 0.76;
    this.duckAmount = 1;
  }

  async init() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.musicRoot = this.context.createGain();
      this.stingerBus = this.context.createGain();
      this.sfxBus = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();

      this.master.gain.value = 1;
      this.musicRoot.gain.value = this.musicEnabled ? this.musicVolume : 0.0001;
      this.stingerBus.gain.value = this.musicEnabled ? this.musicVolume : 0.0001;
      this.sfxBus.gain.value = this.sfxEnabled ? this.sfxVolume : 0.0001;

      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.18;

      this.musicRoot.connect(this.master);
      this.stingerBus.connect(this.master);
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
    this.onModeChange("LOADING · WAV STEMS", { mode: "loading", pendingMode: null, engine: "wav" });
    await this.#loadBuffers();
    this.stop({ keepStatus: true });

    this.running = true;
    this.mode = mode;
    this.lastStep = -1;
    this.pendingLayerMix = null;
    this.pendingLayerPreset = null;
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

  async transitionTo(mode) {
    if (!this.pack?.modes?.[mode]) return;
    this.mode = mode;
    this.#announce();
    this.#sync(this.lastStep < 0 ? 0 : this.lastStep);
  }

  setMode(mode) {
    return this.transitionTo(mode);
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

    if (config.quantize === "bar" && this.running) {
      this.pendingLayerMix = target;
      this.pendingLayerPreset = config.preset || null;
      this.#announceLayers();
      this.#sync(this.lastStep < 0 ? 0 : this.lastStep);
      return;
    }

    const seconds = Number(config.seconds ?? this.#beatsToSeconds(config.fadeBeats ?? 1));
    this.#applyLayerMix(target, seconds, config.preset || null);
  }

  cancelPendingLayerMix() {
    this.pendingLayerMix = null;
    this.pendingLayerPreset = null;
    this.#announceLayers();
    if (this.lastStep >= 0) this.#sync(this.lastStep);
  }

  getLayerMix() {
    return { ...this.layerMix };
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
      stingerPlaying: Boolean(this.stingerSource),
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

    this.lastStep = -1;
    this.pendingLayerMix = null;
    this.pendingLayerPreset = null;
    this.duckAmount = 1;
    if (this.context) this.#applyMusicRootGain(0.04);

    if (!options.keepStatus) {
      this.onModeChange("READY · music stopped", { mode: "ready", pendingMode: null, engine: "wav" });
      this.onSync({
        bar: 0,
        beat: 0,
        subdivision: 0,
        mode: "ready",
        pendingLayerPreset: null,
        layerMix: { ...this.layerMix },
        engine: "wav",
      });
    }
  }

  async setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (!this.context && enabled) await this.init();
    if (!this.context) return;
    this.#applyMusicRootGain(0.06);
    this.#ramp(this.stingerBus.gain, enabled ? this.musicVolume : 0.0001, 0.06);
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
  }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0.01, Math.min(1, Number(value)));
    if (this.context && this.sfxEnabled) this.#ramp(this.sfxBus.gain, this.sfxVolume, 0.04);
  }

  async playStinger(name, options = {}) {
    await this.init();
    const file = this.pack?.stingers?.files?.[name];
    if (!file) throw new Error(`Unknown stinger: ${name}`);

    const buffer = await this.#loadStingerBuffer(name, file);
    this.stopStinger({ restoreMusic: true });

    const duck = Math.max(0.08, Math.min(1, Number(options.duck ?? 0.30)));
    const attack = Math.max(0.01, Number(options.attack ?? 0.07));
    const release = Math.max(0.02, Number(options.release ?? 0.28));
    this.duckAmount = duck;
    this.#applyMusicRootGain(attack);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.stingerBus);
    this.stingerSource = source;

    source.onended = () => {
      if (this.stingerSource !== source) return;
      this.stingerSource = null;
      this.duckAmount = 1;
      this.#applyMusicRootGain(release);
    };

    source.start(this.context.currentTime + 0.015);
    return { name, duration: buffer.duration };
  }

  stopStinger(options = {}) {
    const source = this.stingerSource;
    this.stingerSource = null;
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
    const files = this.pack?.audioStems?.files;
    if (!files) throw new Error("audioStems.files is missing");

    const missing = STEMS.filter((name) => !this.buffers[name]);
    await Promise.all(missing.map(async (name) => {
      const response = await fetch(files[name], { cache: "force-cache" });
      if (!response.ok) throw new Error(`Failed to load ${name}.wav: ${response.status}`);
      const data = await response.arrayBuffer();
      this.buffers[name] = await this.context.decodeAudioData(data);
    }));
  }

  async #loadStingerBuffer(name, file) {
    if (this.stingerBuffers[name]) return this.stingerBuffers[name];
    const response = await fetch(file, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Failed to load stinger ${name}: ${response.status}`);
    const data = await response.arrayBuffer();
    const buffer = await this.context.decodeAudioData(data);
    this.stingerBuffers[name] = buffer;
    return buffer;
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

    if (step % 8 === 0 && this.pendingLayerMix) {
      const target = this.pendingLayerMix;
      const preset = this.pendingLayerPreset;
      this.pendingLayerMix = null;
      this.pendingLayerPreset = null;
      this.#applyLayerMix(target, this.#beatsToSeconds(1), preset);
    }

    this.#sync(step);
  }

  #sync(step) {
    const barStep = ((step % 8) + 8) % 8;
    this.onSync({
      bar: Math.floor(Math.max(0, step) / 8) + 1,
      beat: Math.floor(barStep / 2) + 1,
      subdivision: barStep % 2,
      mode: this.mode,
      pendingLayerPreset: this.pendingLayerPreset,
      layerPreset: this.layerPreset,
      layerMix: { ...this.layerMix },
      engine: "wav",
    });
  }

  #announce() {
    const label = this.pack?.modes?.[this.mode]?.label || this.mode;
    this.onModeChange(`${label} · WAV STEMS`, { mode: this.mode, pendingMode: null, engine: "wav" });
  }

  #announceLayers() {
    this.onLayerChange({
      mix: { ...this.layerMix },
      preset: this.layerPreset,
      pendingMix: this.pendingLayerMix ? { ...this.pendingLayerMix } : null,
      pendingPreset: this.pendingLayerPreset,
      engine: "wav",
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
