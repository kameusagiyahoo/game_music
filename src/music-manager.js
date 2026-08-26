const midiToHz = (note) => 440 * (2 ** ((note - 69) / 12));
const STEPS_PER_BEAT = 2;
const BEATS_PER_BAR = 4;
const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;

export class MusicManager {
  constructor({ pack, onModeChange, onSync } = {}) {
    this.pack = pack;
    this.onModeChange = onModeChange || (() => {});
    this.onSync = onSync || (() => {});
    this.context = null;
    this.master = null;
    this.musicRoot = null;
    this.sfxBus = null;
    this.activeMusicBus = null;
    this.running = false;
    this.mode = "normal";
    this.step = 0;
    this.timer = null;
    this.pendingTransition = null;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.musicVolume = 0.82;
    this.sfxVolume = 0.72;
  }

  setPack(pack) {
    this.pack = pack;
    if (!this.pack?.modes?.[this.mode]) this.mode = "normal";
  }

  async init() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.musicRoot = this.context.createGain();
      this.sfxBus = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();

      this.master.gain.value = 1;
      this.musicRoot.gain.value = this.musicEnabled ? this.musicVolume : 0.0001;
      this.sfxBus.gain.value = this.sfxEnabled ? this.sfxVolume : 0.0001;

      compressor.threshold.value = -18;
      compressor.knee.value = 16;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.18;

      this.musicRoot.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
    }

    if (this.context.state !== "running") await this.context.resume();
  }

  async play(mode = "normal") {
    await this.init();
    if (!this.pack?.modes?.[mode]) throw new Error(`Unknown music mode: ${mode}`);
    this.running = true;
    this.mode = mode;
    this.step = 0;
    this.pendingTransition = null;
    this.#replaceMusicBus(false);
    this.#announce();
    this.#restartClock(true);
  }

  async transitionTo(mode, options = 0.45) {
    if (!this.pack?.modes?.[mode] || mode === this.mode || this.pendingTransition?.mode === mode) return;
    await this.init();

    const config = typeof options === "number"
      ? { quantize: "immediate", seconds: options }
      : { quantize: "immediate", crossfadeBeats: 2, ...options };

    if (config.quantize === "bar" && this.running) {
      this.pendingTransition = {
        mode,
        crossfadeBeats: Math.max(0.25, Number(config.crossfadeBeats ?? 2)),
      };
      this.#sync();
      return;
    }

    const seconds = Number(config.seconds ?? this.#beatsToSeconds(config.crossfadeBeats ?? 2));
    this.#applyTransition(mode, seconds, true);
  }

  setMode(mode) {
    return this.transitionTo(mode, 0.35);
  }

  cancelPendingTransition() {
    this.pendingTransition = null;
    this.#sync();
  }

  stop() {
    this.running = false;
    this.pendingTransition = null;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.step = 0;
    if (this.activeMusicBus && this.context) this.#ramp(this.activeMusicBus.gain, 0.0001, 0.12);
    this.onModeChange("READY · music stopped", { mode: "ready", pendingMode: null });
    this.#sync();
  }

  async setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (!this.context && enabled) await this.init();
    if (!this.context) return;
    this.#ramp(this.musicRoot.gain, enabled ? this.musicVolume : 0.0001, 0.06);
  }

  async setSfxEnabled(enabled) {
    this.sfxEnabled = enabled;
    if (!this.context && enabled) await this.init();
    if (!this.context) return;
    this.#ramp(this.sfxBus.gain, enabled ? this.sfxVolume : 0.0001, 0.06);
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0.01, Math.min(1, Number(value)));
    if (this.context && this.musicEnabled) this.#ramp(this.musicRoot.gain, this.musicVolume, 0.04);
  }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0.01, Math.min(1, Number(value)));
    if (this.context && this.sfxEnabled) this.#ramp(this.sfxBus.gain, this.sfxVolume, 0.04);
  }

  async setEnabled(enabled) {
    await Promise.all([this.setMusicEnabled(enabled), this.setSfxEnabled(enabled)]);
  }

  sfx(name) {
    if (!this.sfxEnabled || !this.context) return;
    const now = this.context.currentTime + 0.005;
    if (name === "flip" || name === "tap") this.#voice(520, now, 0.05, 0.045, "sine", this.sfxBus);
    if (name === "miss") this.#voice(210, now, 0.13, 0.045, "triangle", this.sfxBus);
    if (name === "match" || name === "hit" || name === "perfect") {
      this.#voice(660, now, 0.10, 0.055, "sine", this.sfxBus);
      this.#voice(name === "perfect" ? 990 : 880, now + 0.06, 0.12, 0.045, "sine", this.sfxBus);
    }
    if (name === "good") this.#voice(560, now, 0.08, 0.04, "triangle", this.sfxBus);
    if (name === "win") {
      [523.25, 659.25, 783.99].forEach((hz, i) => this.#voice(hz, now + i * 0.12, i === 2 ? 0.32 : 0.18, 0.06, "triangle", this.sfxBus));
    }
    if (name === "lose") {
      this.#voice(330, now, 0.18, 0.05, "triangle", this.sfxBus);
      this.#voice(247, now + 0.14, 0.30, 0.045, "triangle", this.sfxBus);
    }
    if (name === "toggle") this.#voice(660, now, 0.07, 0.04, "sine", this.sfxBus);
  }

  #beatsToSeconds(beats) {
    const bpm = this.pack?.modes?.[this.mode]?.bpm || 120;
    return Math.max(0.05, Number(beats) * 60 / bpm);
  }

  #announce() {
    this.onModeChange(this.pack?.modes?.[this.mode]?.label || this.mode, {
      mode: this.mode,
      pendingMode: this.pendingTransition?.mode || null,
    });
  }

  #sync() {
    const bar = Math.floor(this.step / STEPS_PER_BAR) + 1;
    const barStep = this.step % STEPS_PER_BAR;
    const beat = Math.floor(barStep / STEPS_PER_BEAT) + 1;
    this.onSync({
      bar,
      beat,
      subdivision: barStep % STEPS_PER_BEAT,
      mode: this.mode,
      pendingMode: this.pendingTransition?.mode || null,
    });
  }

  #applyTransition(mode, seconds, resetClock) {
    const oldBus = this.activeMusicBus;
    this.mode = mode;
    this.pendingTransition = null;
    if (resetClock) this.step = 0;
    this.#replaceMusicBus(true, seconds);
    this.#announce();
    this.#sync();

    if (resetClock) this.#restartClock(true);

    if (oldBus) {
      window.setTimeout(() => {
        try { oldBus.disconnect(); } catch (_) {}
      }, Math.ceil(seconds * 1000) + 140);
    }
  }

  #applyPendingAtBar() {
    if (!this.pendingTransition) return;
    const { mode, crossfadeBeats } = this.pendingTransition;
    const seconds = this.#beatsToSeconds(crossfadeBeats);
    this.#applyTransition(mode, seconds, false);
  }

  #replaceMusicBus(crossfade, seconds = 0.45) {
    const previous = this.activeMusicBus;
    const next = this.context.createGain();
    next.gain.value = crossfade ? 0.0001 : 1;
    next.connect(this.musicRoot);
    this.activeMusicBus = next;

    if (crossfade) {
      this.#ramp(next.gain, 1, seconds);
      if (previous) this.#ramp(previous.gain, 0.0001, seconds);
    } else if (previous) {
      try { previous.disconnect(); } catch (_) {}
    }
  }

  #ramp(param, value, seconds) {
    const now = this.context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(param.value, 0.0001), now);
    param.exponentialRampToValueAtTime(Math.max(value, 0.0001), now + seconds);
  }

  #restartClock(playImmediately = false) {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    if (!this.running) return;
    if (playImmediately) this.#tick();
    else this.#queueNext();
  }

  #queueNext() {
    if (!this.running) return;
    const bpm = this.pack.modes[this.mode].bpm;
    this.timer = window.setTimeout(() => this.#tick(), (60_000 / bpm) / STEPS_PER_BEAT);
  }

  #tick() {
    if (!this.running || !this.context) return;
    if (this.context.state === "suspended") this.context.resume().catch(() => {});

    const barStep = this.step % STEPS_PER_BAR;
    if (barStep === 0 && this.pendingTransition) this.#applyPendingAtBar();

    const patternStep = this.step % 16;
    this.#scheduleStep(patternStep, this.context.currentTime + 0.012);
    this.#sync();
    this.step += 1;
    this.#queueNext();
  }

  #scheduleStep(step, time) {
    const mode = this.pack.modes[this.mode];
    const voices = this.pack.voices || {};
    const layers = mode.layers || {};
    const bus = this.activeMusicBus;
    if (!bus) return;

    const melody = mode.melody[step];
    if (layers.melody !== false && melody !== null) {
      const v = voices.melody || { type: "triangle", gain: 0.06, duration: 0.18 };
      this.#voice(midiToHz(melody), time, v.duration, v.gain * (step % 4 === 0 ? 1.15 : 1), v.type, bus);
      const sparkle = voices.sparkle;
      if (layers.sparkle !== false && sparkle) {
        this.#voice(midiToHz(melody + (sparkle.octave || 12)), time, sparkle.duration, sparkle.gain, sparkle.type, bus);
      }
    }

    if (step % 4 === 0) {
      const index = (step / 4) % 4;
      if (layers.bass !== false) {
        const bass = voices.bass || { type: "triangle", gain: 0.045, duration: 0.42 };
        this.#voice(midiToHz(mode.bass[index]), time, bass.duration, bass.gain, bass.type, bus);
      }

      if (layers.chords !== false) {
        const chordVoice = voices.chord || { type: "sine", gain: 0.015, duration: 0.60, octave: 12 };
        mode.chords[index].forEach((note) => {
          this.#voice(midiToHz(note + (chordVoice.octave || 0)), time, chordVoice.duration, chordVoice.gain, chordVoice.type, bus);
        });
      }
    }

    if (layers.pulse !== false && step % (mode.pulseEvery || 4) === 0) {
      const pulse = voices.pulse || { type: "square", gain: 0.012, duration: 0.025 };
      this.#voice(mode.pulseHz || 900, time, pulse.duration, pulse.gain, pulse.type, bus);
    }
  }

  #voice(frequency, start, duration, gain, type, destination) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }
}
