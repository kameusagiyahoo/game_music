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
import { ensureMusicServiceWorker } from "../../src/music-service-worker.js";

const $ = (selector) => document.querySelector(selector);
const packGrid = $("#packGrid");
const packCount = $("#packCount");
const runtimePack = $("#runtimePack");
const runtimeEngine = $("#runtimeEngine");
const runtimeFormat = $("#runtimeFormat");
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

void ensureMusicServiceWorker();

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
      <strong>${entry.name} · v${entry.version}</strong>
      <small>${entry.description}${entry.formats.length ? ` · ${entry.formats.map((value) => value.toUpperCase()).join(" / ")}` : ""}</small>
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
  runtimeFormat.textContent = descriptor?.audioFormat ? descriptor.audioFormat.toUpperCase() : "N/A";
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
      onFormatChange() {
        renderRuntime();
      },
    },
  });
  renderRuntime();
  const descriptor = getRuntimeDescriptor(runtime);
  const formatLabel = descriptor?.audioFormat ? ` · ${descriptor.audioFormat.toUpperCase()}` : "";
  statusText.textContent = `${runtime.entry.name}${formatLabel} READY`;

  const builtRuntime = runtime;
  if (typeof builtRuntime.manager?.preload === "function") {
    statusText.textContent = `${builtRuntime.entry.name}${formatLabel} · PRELOADING…`;
    void builtRuntime.manager.preload({ stingers: true }).then((info) => {
      if (runtime !== builtRuntime || playing) return;
      renderRuntime();
      const ready = getRuntimeDescriptor(builtRuntime);
      const readyFormat = ready?.audioFormat ? ` · ${ready.audioFormat.toUpperCase()}` : "";
      const persistentCount = info?.persistent?.entries ?? 0;
      statusText.textContent = `${builtRuntime.entry.name}${readyFormat} · PRELOADED ${info.loaded}/${info.requested} · PERSISTENT ${persistentCount}`;
    }).catch((error) => {
      if (runtime !== builtRuntime || playing) return;
      console.warn(error);
      statusText.textContent = `${builtRuntime.entry.name} · PRELOAD ERROR · START WILL RETRY`;
    });
  }
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
      const result = await runtime.manager.playStinger(button.dataset.stinger);
      renderRuntime();
      statusText.textContent = `${button.dataset.stinger.toUpperCase()} · ${result?.format?.toUpperCase() || "AUDIO"} STINGER`;
    });
  });
}

async function playSelected() {
  if (!runtime || runtime.entry.id !== selectedId) buildRuntime(selectedId);
  playButton.disabled = true;
  const descriptor = getRuntimeDescriptor(runtime);
  statusText.textContent = runtime.engine === "wav-stem"
    ? `LOADING ${descriptor?.audioFormat?.toUpperCase() || "AUDIO"} STEMS…`
    : "STARTING…";
  try {
    await runtime.manager.play("normal");
    playing = true;
    renderRuntime();
    const active = getRuntimeDescriptor(runtime);
    const fallbackCount = (active?.audioFormatAttempts || []).filter((attempt) => attempt.stage === "stems").length;
    statusText.textContent = `${runtime.entry.name}${active?.audioFormat ? ` · ${active.audioFormat.toUpperCase()}` : ""} PLAYING${fallbackCount ? ` · FALLBACK ${fallbackCount}` : ""}`;
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
