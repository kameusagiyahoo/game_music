import fs from "node:fs";
import { bindGameAudioControls } from "../src/game-audio-controls.js";

class FakeControl {
  constructor() {
    this.checked = false;
    this.value = "0";
    this.textContent = "";
    this.attributes = {};
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  async emit(type) {
    for (const handler of this.listeners.get(type) || []) {
      await handler({ target: this });
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const soundButton = new FakeControl();
const bgmToggle = new FakeControl();
const sfxToggle = new FakeControl();
const bgmVolume = new FakeControl();
const sfxVolume = new FakeControl();
const bgmVolumeValue = new FakeControl();
const sfxVolumeValue = new FakeControl();

const audioCalls = [];
const cues = [];
const saved = [];
const music = {
  async audio(patch) {
    audioCalls.push({ ...patch });
    return patch;
  },
  cue(name) {
    cues.push(name);
  },
};

const controller = bindGameAudioControls({
  getMusic: () => music,
  soundButton,
  bgmToggle,
  sfxToggle,
  bgmVolume,
  sfxVolume,
  bgmVolumeValue,
  sfxVolumeValue,
  settings: {
    bgmEnabled: true,
    sfxEnabled: true,
    bgmVolume: 0.8,
    sfxVolume: 0.74,
  },
  saveSettings(patch) {
    saved.push({ ...patch });
  },
});

assert(bgmToggle.checked === true, "BGM toggle should initialize from shared settings");
assert(sfxToggle.checked === true, "SFX toggle should initialize from shared settings");
assert(bgmVolume.value === "80", "BGM slider should initialize from shared settings");
assert(sfxVolume.value === "74", "SFX slider should initialize from shared settings");
assert(soundButton.attributes["aria-pressed"] === "true", "Master sound should initialize enabled");

bgmToggle.checked = false;
await bgmToggle.emit("change");
assert(saved.at(-1)?.bgmEnabled === false, "BGM toggle changes must persist");
assert(audioCalls.at(-1)?.musicEnabled === false, "BGM toggle changes must reach MusicFacade");

await soundButton.emit("click");
assert(controller.isMasterSoundEnabled() === false, "Master sound button should mute both channels");
assert(audioCalls.at(-1)?.musicEnabled === false, "Master mute should disable music");
assert(audioCalls.at(-1)?.sfxEnabled === false, "Master mute should disable SFX");
assert(soundButton.textContent === "×", "Master mute label should update");

bgmToggle.checked = true;
await soundButton.emit("click");
assert(controller.isMasterSoundEnabled() === true, "Master sound button should restore audio");
assert(cues.at(-1) === "toggle", "Restoring master sound should play the toggle cue when SFX is enabled");

bgmVolume.value = "0";
await bgmVolume.emit("input");
assert(saved.at(-1)?.bgmVolume === 0, "BGM volume zero must persist as zero");
assert(audioCalls.at(-1)?.musicVolume === 0, "BGM volume zero must reach MusicFacade");

sfxVolume.value = "125";
await sfxVolume.emit("input");
assert(saved.at(-1)?.sfxVolume === 1, "SFX volume should clamp values above 100%");
assert(audioCalls.at(-1)?.sfxVolume === 1, "Clamped SFX volume must reach MusicFacade");

const gameFiles = [
  "src/game.js",
  "games/orbit-rush/game.js",
  "games/pulse-forge/game.js",
  "games/rune-relay/game.js",
  "games/aether-shift/game.js",
];

for (const path of gameFiles) {
  const source = fs.readFileSync(path, "utf8");
  assert(source.includes("bindGameAudioControls"), `${path} must use shared game audio controls`);
  assert(!source.includes("async function applyAudioState()"), `${path} must not keep a local applyAudioState duplicate`);
  assert(!source.includes("saveMusicSettings({ bgmEnabled:"), `${path} must not persist BGM settings directly`);
  assert(!source.includes("saveMusicSettings({ sfxEnabled:"), `${path} must not persist SFX settings directly`);
  assert(!source.includes("saveMusicSettings({ bgmVolume:"), `${path} must not persist BGM volume directly`);
  assert(!source.includes("saveMusicSettings({ sfxVolume:"), `${path} must not persist SFX volume directly`);
}

console.log("Shared game audio controls check PASSED");
