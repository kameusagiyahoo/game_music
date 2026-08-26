import {
  MUSIC_ENGINES,
  getMusicSettings,
  listMusicPacks,
  saveMusicSettings,
  resetMusicSettings,
  applyMusicSettingsToControls,
} from "../../src/music-registry.js";

const $ = (selector) => document.querySelector(selector);
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");
const proceduralPacks = $("#proceduralPacks");
const wavPacks = $("#wavPacks");
const proceduralSummary = $("#proceduralSummary");
const saveState = $("#saveState");
const resetButton = $("#resetButton");
const packCount = $("#packCount");
const proceduralCount = $("#proceduralCount");
const wavCount = $("#wavCount");

const controls = {
  bgmToggle,
  sfxToggle,
  bgmVolume,
  sfxVolume,
  bgmVolumeValue,
  sfxVolumeValue,
};

function flashSaved() {
  saveState.textContent = "SAVED";
  saveState.classList.add("is-saved");
  window.setTimeout(() => saveState.classList.remove("is-saved"), 500);
}

function packButton(entry, selected, disabled = false) {
  const label = document.createElement("label");
  label.className = `registry-pack${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`;
  label.innerHTML = `
    <input type="radio" name="${entry.engine}" value="${entry.id}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""} />
    <span class="registry-pack-main">
      <strong>${entry.shortName}</strong>
      <small>${entry.description}</small>
    </span>
    <span class="registry-engine">${entry.engine === MUSIC_ENGINES.WAV_STEM ? "WAV" : "PROC"}</span>
  `;
  return label;
}

function render() {
  const settings = getMusicSettings();
  applyMusicSettingsToControls(controls, settings);

  const procedural = listMusicPacks({ engine: MUSIC_ENGINES.PROCEDURAL });
  const wav = listMusicPacks({ engine: MUSIC_ENGINES.WAV_STEM });

  proceduralPacks.innerHTML = "";
  const auto = document.createElement("label");
  auto.className = `registry-pack registry-auto${settings.proceduralPackId === "auto" ? " is-selected" : ""}`;
  auto.innerHTML = `
    <input type="radio" name="${MUSIC_ENGINES.PROCEDURAL}" value="auto" ${settings.proceduralPackId === "auto" ? "checked" : ""} />
    <span class="registry-pack-main"><strong>ゲーム推奨</strong><small>01 Fantasy / 02 Neon / 04 Fantasy</small></span>
    <span class="registry-engine">AUTO</span>
  `;
  proceduralPacks.appendChild(auto);
  procedural.forEach((entry) => proceduralPacks.appendChild(packButton(entry, settings.proceduralPackId === entry.id)));

  wavPacks.innerHTML = "";
  wav.forEach((entry) => wavPacks.appendChild(packButton(entry, settings.wavStemPackId === entry.id, wav.length === 1)));

  const selected = procedural.find((entry) => entry.id === settings.proceduralPackId);
  proceduralSummary.textContent = settings.proceduralPackId === "auto" ? "GAME DEFAULT" : selected?.name || "AUTO";
  packCount.textContent = String(procedural.length + wav.length);
  proceduralCount.textContent = String(procedural.length);
  wavCount.textContent = String(wav.length);
}

function saveAudioSettings() {
  saveMusicSettings({
    bgmEnabled: bgmToggle.checked,
    sfxEnabled: sfxToggle.checked,
    bgmVolume: Number(bgmVolume.value) / 100,
    sfxVolume: Number(sfxVolume.value) / 100,
  });
  bgmVolumeValue.textContent = bgmVolume.value;
  sfxVolumeValue.textContent = sfxVolume.value;
  flashSaved();
}

bgmToggle.addEventListener("change", saveAudioSettings);
sfxToggle.addEventListener("change", saveAudioSettings);
bgmVolume.addEventListener("input", saveAudioSettings);
sfxVolume.addEventListener("input", saveAudioSettings);

proceduralPacks.addEventListener("change", (event) => {
  const input = event.target.closest('input[type="radio"]');
  if (!input) return;
  saveMusicSettings({ proceduralPackId: input.value });
  render();
  flashSaved();
});

wavPacks.addEventListener("change", (event) => {
  const input = event.target.closest('input[type="radio"]');
  if (!input || input.disabled) return;
  saveMusicSettings({ wavStemPackId: input.value });
  render();
  flashSaved();
});

resetButton.addEventListener("click", () => {
  resetMusicSettings();
  render();
  saveState.textContent = "RESET";
  flashSaved();
});

window.addEventListener("game-music-settings-change", render);
render();
