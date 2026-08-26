import { WavStemMusicManager } from "../../src/wav-stem-manager.js";
import { pulsePack } from "../../src/music-packs/pulse.js";

const $ = (selector) => document.querySelector(selector);
const STEMS = ["drums", "bass", "chords", "melody", "sparkle"];

const engineState = $("#engineState");
const transportState = $("#transportState");
const syncState = $("#syncState");
const presetState = $("#presetState");
const elapsedValue = $("#elapsedValue");
const pendingState = $("#pendingState");
const bufferState = $("#bufferState");
const modeState = $("#modeState");
const bpmState = $("#bpmState");
const stingerCache = $("#stingerCache");
const stingerState = $("#stingerState");
const startButton = $("#startButton");
const stopButton = $("#stopButton");
const masterVolume = $("#masterVolume");
const masterVolumeValue = $("#masterVolumeValue");
const quantizeToggle = $("#quantizeToggle");
const resetMixButton = $("#resetMixButton");
const victoryButton = $("#victoryButton");
const gameoverButton = $("#gameoverButton");
const presetButtons = [...document.querySelectorAll("[data-preset]")];
const stemRows = [...document.querySelectorAll(".debug-stem")];

let currentPreset = "focus";
let pendingPreset = null;
let starting = false;

function labelPreset(name) {
  return String(name || "custom").toUpperCase();
}

function setPresetButtonState(name) {
  presetButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === name);
  });
}

function renderMix(mix) {
  stemRows.forEach((row) => {
    const name = row.dataset.stem;
    const input = row.querySelector("input");
    const output = row.querySelector("output");
    const value = Math.round((mix?.[name] ?? 0) * 100);
    if (document.activeElement !== input) input.value = String(value);
    output.textContent = String(value);
  });
}

const music = new WavStemMusicManager({
  pack: pulsePack,
  onModeChange(label, meta = {}) {
    engineState.textContent = meta.mode === "loading" ? "WAV / LOADING" : "WAV / READY";
    modeState.textContent = meta.mode || "normal";
    if (meta.mode === "ready") transportState.textContent = "STOPPED";
  },
  onLayerChange(info = {}) {
    if (info.preset) currentPreset = info.preset;
    pendingPreset = info.pendingPreset || null;
    presetState.textContent = labelPreset(currentPreset);
    pendingState.textContent = pendingPreset ? `NEXT BAR · ${labelPreset(pendingPreset)}` : "NEXT BAR —";
    renderMix(info.mix || music.getLayerMix());
    setPresetButtonState(currentPreset);
  },
  onSync(info = {}) {
    if (info.mode === "ready") {
      syncState.textContent = "BAR — / BEAT —";
      return;
    }
    syncState.textContent = `BAR ${info.bar} / BEAT ${info.beat}${info.subdivision ? ".5" : ""}`;
    transportState.textContent = "RUNNING";
  },
});

music.setMusicVolume(0.80);
music.setSfxVolume(0.70);
renderMix(pulsePack.layerPresets.focus);
setPresetButtonState("focus");

async function ensureRunning() {
  const state = music.getDebugState();
  if (state.running) return true;
  if (starting) return false;

  starting = true;
  startButton.disabled = true;
  startButton.textContent = "WAV読込中…";
  engineState.textContent = "WAV / LOADING";
  try {
    await music.play("normal");
    engineState.textContent = "WAV / READY";
    transportState.textContent = "RUNNING";
    return true;
  } catch (error) {
    console.error(error);
    engineState.textContent = "WAV / ERROR";
    transportState.textContent = "LOAD FAILED";
    return false;
  } finally {
    starting = false;
    startButton.disabled = false;
    startButton.textContent = "再生開始";
  }
}

startButton.addEventListener("click", ensureRunning);
stopButton.addEventListener("click", () => {
  music.stop();
  transportState.textContent = "STOPPED";
  stingerState.textContent = "READY";
});

masterVolume.addEventListener("input", () => {
  masterVolumeValue.textContent = masterVolume.value;
  music.setMusicVolume(Number(masterVolume.value) / 100);
});

presetButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (!(await ensureRunning())) return;
    const preset = button.dataset.preset;
    const quantize = quantizeToggle.checked ? "bar" : "immediate";
    await music.setLayerPreset(preset, { quantize, fadeBeats: 1, seconds: 0.12 });
  });
});

stemRows.forEach((row) => {
  const name = row.dataset.stem;
  const input = row.querySelector("input");
  const output = row.querySelector("output");
  const soloButton = row.querySelector("button");

  input.addEventListener("input", async () => {
    output.textContent = input.value;
    if (!(await ensureRunning())) return;
    currentPreset = "custom";
    setPresetButtonState(null);
    presetState.textContent = "CUSTOM";
    await music.setLayerMix({ [name]: Number(input.value) / 100 }, { seconds: 0.06, preset: "custom" });
  });

  soloButton.addEventListener("click", async () => {
    if (!(await ensureRunning())) return;
    const soloMix = Object.fromEntries(STEMS.map((stem) => [stem, stem === name ? 1 : 0]));
    currentPreset = "custom";
    setPresetButtonState(null);
    await music.setLayerMix(soloMix, { seconds: 0.08, preset: "custom" });
  });
});

resetMixButton.addEventListener("click", async () => {
  if (!(await ensureRunning())) return;
  await music.setLayerPreset("focus", { seconds: 0.12 });
});

async function testStinger(name) {
  if (!(await ensureRunning())) return;
  stingerState.textContent = `${name.toUpperCase()} · LOADING`;
  try {
    const info = await music.playStinger(name, { duck: 0.26, attack: 0.06, release: 0.30 });
    stingerState.textContent = `${name.toUpperCase()} · ${info.duration.toFixed(2)}s`;
    window.setTimeout(() => {
      if (!music.getDebugState().stingerPlaying) stingerState.textContent = "READY";
    }, Math.ceil(info.duration * 1000) + 500);
  } catch (error) {
    console.error(error);
    stingerState.textContent = `${name.toUpperCase()} · ERROR`;
  }
}

victoryButton.addEventListener("click", () => testStinger("victory"));
gameoverButton.addEventListener("click", () => testStinger("gameover"));

window.setInterval(() => {
  const state = music.getDebugState();
  elapsedValue.textContent = `${state.elapsed.toFixed(2)}s`;
  bufferState.textContent = state.stemBuffersReady ? "5 / 5 READY" : "not loaded";
  modeState.textContent = state.mode;
  bpmState.textContent = String(state.bpm);
  stingerCache.textContent = state.loadedStingers.length ? state.loadedStingers.join(", ") : "—";
  if (state.running) {
    engineState.textContent = "WAV / READY";
    transportState.textContent = state.stingerPlaying ? "RUNNING + STINGER" : "RUNNING";
  }
}, 100);
