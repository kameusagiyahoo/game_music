const MODES = {
  normal: {
    label: "NORMAL · Fantasy Table",
    bpm: 120,
    melody: [72, 76, 79, 76, 74, 72, 67, 69, 72, 76, 79, 81, 79, 76, 74, 72],
    bass: [48, 43, 45, 41],
    chords: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [53, 57, 60]],
  },
  tension: {
    label: "TENSION · Final Rush",
    bpm: 144,
    melody: [72, 76, 79, 81, 79, 76, 74, 76, 72, 76, 79, 83, 81, 79, 76, 74],
    bass: [48, 45, 41, 43],
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
  },
  result: {
    label: "RESULT · Afterglow",
    bpm: 92,
    melody: [72, null, 76, null, 79, null, 76, null, 69, null, 72, null, 67, null, 64, null],
    bass: [48, 45, 41, 43],
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
  },
};

const midiToHz = (note) => 440 * (2 ** ((note - 69) / 12));

export class MusicManager {
  constructor({ onModeChange } = {}) {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.enabled = true;
    this.running = false;
    this.mode = "normal";
    this.step = 0;
    this.timer = null;
    this.onModeChange = onModeChange || (() => {});
  }

  async init() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();

      this.master = this.context.createGain();
      this.musicBus = this.context.createGain();
      this.sfxBus = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();

      this.master.gain.value = this.enabled ? 0.9 : 0.0001;
      this.musicBus.gain.value = 0.9;
      this.sfxBus.gain.value = 0.72;

      compressor.threshold.value = -18;
      compressor.knee.value = 16;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.18;

      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
    }

    if (this.context.state !== "running") {
      await this.context.resume();
    }
  }

  async play(mode = "normal") {
    await this.init();
    this.mode = MODES[mode] ? mode : "normal";
    this.step = 0;
    this.running = true;
    this.#fadeMaster(this.enabled ? 0.9 : 0.0001, 0.04);
    this.#announce();
    this.#restartClock(true);
  }

  setMode(mode) {
    if (!MODES[mode] || mode === this.mode) return;
    this.mode = mode;
    this.step = 0;
    this.#announce();
    if (this.running) this.#restartClock(true);
  }

  stop() {
    this.running = false;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.step = 0;
    if (this.context) this.#fadeMaster(0.0001, 0.08);
    this.onModeChange("READY · music stopped");
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
    if (!this.context && enabled) await this.init();
    if (!this.context) return;
    if (enabled && this.context.state !== "running") await this.context.resume();
    this.#fadeMaster(enabled ? 0.9 : 0.0001, 0.04);
  }

  sfx(name) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime + 0.005;

    if (name === "flip") this.#voice(520, now, 0.05, 0.045, "sine", this.sfxBus);
    if (name === "miss") this.#voice(210, now, 0.13, 0.045, "triangle", this.sfxBus);
    if (name === "match") {
      this.#voice(660, now, 0.11, 0.055, "sine", this.sfxBus);
      this.#voice(880, now + 0.07, 0.14, 0.05, "sine", this.sfxBus);
    }
    if (name === "win") {
      [523.25, 659.25, 783.99].forEach((hz, index) => {
        this.#voice(hz, now + index * 0.12, index === 2 ? 0.32 : 0.18, 0.06, "triangle", this.sfxBus);
      });
    }
    if (name === "lose") {
      this.#voice(330, now, 0.18, 0.05, "triangle", this.sfxBus);
      this.#voice(247, now + 0.14, 0.3, 0.045, "triangle", this.sfxBus);
    }
    if (name === "toggle") this.#voice(660, now, 0.07, 0.04, "sine", this.sfxBus);
  }

  #announce() {
    this.onModeChange(MODES[this.mode].label);
  }

  #fadeMaster(value, seconds) {
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
    this.master.gain.exponentialRampToValueAtTime(Math.max(value, 0.0001), now + seconds);
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
    const bpm = MODES[this.mode].bpm;
    const stepMs = (60_000 / bpm) / 2;
    this.timer = window.setTimeout(() => this.#tick(), stepMs);
  }

  #tick() {
    if (!this.running || !this.context) return;

    if (this.context.state === "suspended") {
      this.context.resume().catch(() => {});
    }

    const time = this.context.currentTime + 0.012;
    this.#scheduleStep(this.step, time);
    this.step = (this.step + 1) % 16;
    this.#queueNext();
  }

  #scheduleStep(step, time) {
    const pack = MODES[this.mode];
    const melodyNote = pack.melody[step];

    if (melodyNote !== null) {
      const accent = step % 4 === 0 ? 0.075 : 0.055;
      this.#voice(midiToHz(melodyNote), time, 0.19, accent, "triangle", this.musicBus);
      this.#voice(midiToHz(melodyNote + 12), time, 0.10, accent * 0.22, "sine", this.musicBus);
    }

    if (step % 4 === 0) {
      const index = (step / 4) % 4;
      const bassNote = pack.bass[index];
      this.#voice(midiToHz(bassNote), time, 0.45, this.mode === "tension" ? 0.06 : 0.05, "triangle", this.musicBus);

      const chord = pack.chords[index];
      chord.forEach((note) => {
        this.#voice(midiToHz(note + 12), time, 0.65, 0.018, "sine", this.musicBus);
      });
    }

    const pulseEvery = this.mode === "tension" ? 2 : 4;
    if (step % pulseEvery === 0) {
      const pulseHz = this.mode === "tension" ? 1200 : 920;
      this.#voice(pulseHz, time, 0.025, this.mode === "tension" ? 0.024 : 0.014, "square", this.musicBus);
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
