const MODES = {
  normal: {
    label: "NORMAL · Fantasy Table",
    bpm: 120,
    melody: [72, null, 76, null, 79, 76, 74, null, 72, null, 67, 69, 72, null, 74, null],
    bass: [48, 43, 45, 41],
    chords: [[60, 64, 67, 71], [59, 62, 67], [57, 60, 64, 67], [53, 57, 60, 64]],
    pulse: 4,
  },
  tension: {
    label: "TENSION · Final Rush",
    bpm: 144,
    melody: [72, 76, 79, 81, 79, 76, 74, 76, 72, 76, 79, 83, 81, 79, 76, 74],
    bass: [48, 45, 41, 43],
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    pulse: 2,
  },
  result: {
    label: "RESULT · Afterglow",
    bpm: 92,
    melody: [72, null, 76, null, 79, null, 76, null, 69, null, 72, null, 67, null, 64, null],
    bass: [48, 45, 41, 43],
    chords: [[60, 64, 67, 71], [57, 60, 64], [53, 57, 60, 64], [55, 59, 62]],
    pulse: 8,
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
    this.nextStepTime = 0;
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

      this.master.gain.value = this.enabled ? 0.7 : 0.0001;
      this.musicBus.gain.value = 0.55;
      this.sfxBus.gain.value = 0.8;

      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async play(mode = "normal") {
    await this.init();
    this.mode = MODES[mode] ? mode : "normal";
    this.step = 0;
    this.nextStepTime = this.context.currentTime + 0.05;

    if (!this.running) {
      this.running = true;
      this.timer = window.setInterval(() => this.#scheduler(), 25);
    }

    this.#fadeMaster(this.enabled ? 0.7 : 0.0001, 0.08);
    this.#announce();
  }

  setMode(mode) {
    if (!MODES[mode] || mode === this.mode) return;
    this.mode = mode;
    this.step = 0;
    this.#announce();
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    this.step = 0;
    if (this.context) this.#fadeMaster(0.0001, 0.12);
    this.onModeChange("READY · music stopped");
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
    if (!this.context && enabled) await this.init();
    if (!this.context) return;
    this.#fadeMaster(enabled ? 0.7 : 0.0001, 0.06);
  }

  sfx(name) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;

    if (name === "flip") this.#voice(420, now, 0.05, 0.035, "sine", this.sfxBus);
    if (name === "miss") this.#voice(210, now, 0.13, 0.04, "triangle", this.sfxBus);
    if (name === "match") {
      this.#voice(660, now, 0.11, 0.05, "sine", this.sfxBus);
      this.#voice(880, now + 0.07, 0.14, 0.045, "sine", this.sfxBus);
    }
    if (name === "win") {
      [523.25, 659.25, 783.99].forEach((hz, index) => {
        this.#voice(hz, now + index * 0.12, index === 2 ? 0.32 : 0.18, 0.055, "triangle", this.sfxBus);
      });
    }
    if (name === "lose") {
      this.#voice(330, now, 0.18, 0.045, "triangle", this.sfxBus);
      this.#voice(247, now + 0.14, 0.3, 0.04, "triangle", this.sfxBus);
    }
    if (name === "toggle") this.#voice(660, now, 0.07, 0.035, "sine", this.sfxBus);
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

  #scheduler() {
    if (!this.running || !this.context) return;
    while (this.nextStepTime < this.context.currentTime + 0.14) {
      this.#scheduleStep(this.step, this.nextStepTime);
      const bpm = MODES[this.mode].bpm;
      this.nextStepTime += (60 / bpm) / 2;
      this.step = (this.step + 1) % 16;
    }
  }

  #scheduleStep(step, time) {
    const pack = MODES[this.mode];
    const melodyNote = pack.melody[step];

    if (melodyNote !== null) {
      const accent = step % 4 === 0 ? 0.036 : 0.026;
      this.#voice(midiToHz(melodyNote), time, 0.18, accent, "sine", this.musicBus);
      this.#voice(midiToHz(melodyNote + 12), time, 0.08, accent * 0.18, "triangle", this.musicBus);
    }

    if (step % 4 === 0) {
      const bassNote = pack.bass[(step / 4) % pack.bass.length];
      this.#voice(midiToHz(bassNote), time, 0.42, this.mode === "tension" ? 0.035 : 0.028, "triangle", this.musicBus);
    }

    if (step % 4 === 0) {
      const chord = pack.chords[(step / 4) % pack.chords.length];
      chord.forEach((note, index) => {
        this.#voice(midiToHz(note), time, 0.72, 0.009 / (index + 0.5), "sine", this.musicBus);
      });
    }

    if (step % pack.pulse === 0) {
      const high = this.mode === "tension" ? 1040 : 780;
      this.#voice(high, time, 0.025, this.mode === "tension" ? 0.016 : 0.009, "square", this.musicBus);
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
