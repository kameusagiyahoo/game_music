import {
  listMusicPacks,
  getMusicSettings,
  saveMusicSettings,
  applyMusicSettingsToControls,
} from "../../src/music-registry.js";
import {
  createMusicRuntime,
  getRuntimeDescriptor,
} from "../../src/music-asset-resolver.js";

const $ = (selector) => document.querySelector(selector);
const packGrid = $("#packGrid");
const packCount = $("#packCount");
const runtimePack = $("#runtimePack");
const runtimeEngine = $("#runtimeEngine");
const runtimeMode = $("#runtimeMode");
const runtimeSync = $("#runtimeSync");
const capabilityEngine = $("#capabilityEngine");
const capabilityGrid = $("#capabilityGrid");
const statusText = $("#statusText");
const playButton = $("#playButton");
const stopButton = $("#stopButton");
const modeButtons = $("#modeButtons");
const specialButtons = $("#specialButtons");
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");

const entries = listMusicPacks();
let selectedId = entries[0]?.id || null;
let runtime = null;
let playing = false;

const controls = { bgmToggle, sfxToggle, bgmVolume, sfxVolume, bgmVolumeValue, sfxVolumeValue };
applyMusicSettingsToControls(controls, getMusicSettings());

function engineLabel(engine) {
  return engine === "wav-stem" ? "WAV STEM" : "PROCEDURAL";
}

function renderPacks() {
  packCount.textContent = String(entries.length);
  packGrid.innerHTML = entries.map((entry) => `
    <button class="resolver-pack ${entry.id === selectedId ? "is-selected" : ""}" data-pack="${entry.id}" type="button">
      <span class="engine-pill ${entry.engine}">${engineLabel(entry.engine)}</span>
      <strong>${entry.name}</strong>
      <small>${entry.description}</small>
    </button>
  `).join("");

  packGrid.querySelectorAll(".resolver-pack").forEach((button) => {
    button.addEventListener("click", () => selectPack(button.dataset.pack));
  });
}

function renderCapabilities() {
  const descriptor = getRuntimeDescriptor(runtime);
  const capabilities = descriptor?.capabilities || {};
  capabilityEngine.textContent = descriptor ? engineLabel(descriptor.engine) : "—";
  capabilityGrid.innerHTML = Object.entries(capabilities).map(([name, enabled]) => `
    <div class="capability ${enabled ? "is-on" : "is-off"}">
      <span>${enabled ? "YES" : "NO"}</span>
      <strong>${name}</strong>
    </div>
  `).join("");
}

function renderRuntime() {
  const descriptor = getRuntimeDescriptor(runtime);
  runtimePack.textContent = descriptor?.packName || "—";
  runtimeEngine.textContent = descriptor ? engineLabel(descriptor.engine) : "—";
  renderCapabilities();
  renderModeButtons();
  renderSpecialButtons();
}

function stopRuntime() {
  if (runtime?.manager) {
    try { runtime.manager.stop(); } catch (error) { console.warn(error); }
  }
  playing = false;
  runtimeMode.textContent = "STOPPED";
  runtimeSync.textContent = "BAR — / BEAT —";
}

function buildRuntime(packId) {
  stopRuntime();
  const settings = getMusicSettings();
  runtime = createMusicRuntime({
    packId,
    settings,
    callbacks: {
      onModeChange(label, info = {}) {
        runtimeMode.textContent = label || String(info.mode || "—").toUpperCase();
      },
      onSync(info = {}) {
        if (!playing || info.mode === "ready") {
          runtimeSync.textContent = "BAR — / BEAT —";
          return;
        }
        runtimeSync.textContent = `BAR ${info.bar || 1} / BEAT ${info.beat || 1}`;
      },
      onLayerChange() {},
      onPackChange() {},
    },
  });
  renderRuntime();
  statusText.textContent = `${runtime.entry.name} READY`;
}

function selectPack(id) {
  selectedId = id;
  renderPacks();
  buildRuntime(id);
}

function renderModeButtons() {
  if (!runtime) {
    modeButtons.innerHTML = "";
    return;
  }
  const modes = Object.keys(runtime.entry.pack?.modes || {});
  modeButtons.innerHTML = modes.map((mode) => `
    <button class="mode-button" data-mode="${mode}" type="button">${mode.toUpperCase()}</button>
  `).join("");
  modeButtons.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!playing) return;
      const mode = button.dataset.mode;
      await runtime.manager.transitionTo(mode, { quantize: "bar", crossfadeBeats: 1.5 });
      statusText.textContent = `${mode.toUpperCase()} REQUESTED`;
    });
  });
}

function renderSpecialButtons() {
  specialButtons.innerHTML = "";
  if (!runtime) return;

  const items = [];
  const presets = runtime.entry.pack?.layerPresets || {};
  Object.keys(presets).forEach((preset) => {
    items.push(`<button class="special-button" data-preset="${preset}" type="button">MIX ${preset.toUpperCase()}</button>`);
  });
  if (runtime.capabilities.stingers) {
    items.push('<button class="special-button" data-stinger="victory" type="button">VICTORY STINGER</button>');
    items.push('<button class="special-button" data-stinger="gameover" type="button">GAME OVER STINGER</button>');
  }
  specialButtons.innerHTML = items.join("");

  specialButtons.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!playing || typeof runtime.manager.setLayerPreset !== "function") return;
      await runtime.manager.setLayerPreset(button.dataset.preset, { quantize: "bar", fadeBeats: 1 });
      statusText.textContent = `${button.dataset.preset.toUpperCase()} MIX REQUESTED`;
    });
  });

  specialButtons.querySelectorAll("[data-stinger]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!playing || typeof runtime.manager.playStinger !== "function") return;
      statusText.textContent = `${button.dataset.stinger.toUpperCase()} STINGER`;
      await runtime.manager.playStinger(button.dataset.stinger);
    });
  });
}

async function playSelected() {
  if (!runtime || runtime.entry.id !== selectedId) buildRuntime(selectedId);
  playButton.disabled = true;
  statusText.textContent = runtime.engine === "wav-stem" ? "LOADING WAV STEMS…" : "STARTING…";
  try {
    await runtime.manager.play("normal");
    playing = true;
    statusText.textContent = `${runtime.entry.name} PLAYING`;
  } catch (error) {
    console.error(error);
    statusText.textContent = `ERROR · ${error.message}`;
  } finally {
    playButton.disabled = false;
  }
}

function saveAudio() {
  const settings = saveMusicSettings({
    bgmEnabled: bgmToggle.checked,
    sfxEnabled: sfxToggle.checked,
    bgmVolume: Number(bgmVolume.value) / 100,
    sfxVolume: Number(sfxVolume.value) / 100,
  });
  bgmVolumeValue.textContent = String(Math.round(settings.bgmVolume * 100));
  sfxVolumeValue.textContent = String(Math.round(settings.sfxVolume * 100));
  if (runtime?.manager) {
    runtime.manager.setMusicVolume(settings.bgmVolume);
    runtime.manager.setSfxVolume(settings.sfxVolume);
    void runtime.manager.setMusicEnabled(settings.bgmEnabled);
    void runtime.manager.setSfxEnabled(settings.sfxEnabled);
  }
}

playButton.addEventListener("click", () => void playSelected());
stopButton.addEventListener("click", () => {
  stopRuntime();
  statusText.textContent = `${runtime?.entry?.name || "RUNTIME"} STOPPED`;
});
bgmToggle.addEventListener("change", saveAudio);
sfxToggle.addEventListener("change", saveAudio);
bgmVolume.addEventListener("input", saveAudio);
sfxVolume.addEventListener("input", saveAudio);

renderPacks();
if (selectedId) buildRuntime(selectedId);
