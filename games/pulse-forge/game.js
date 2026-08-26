import { createMusicRuntime } from "../../src/music-asset-resolver.js";
import {
  GAME_IDS,
  getMusicSettings,
  saveMusicSettings,
  applyMusicSettingsToControls,
} from "../../src/music-registry.js";

const GAME_TIME = 40;
const PERFECT_MS = 170;
const GOOD_MS = 340;
const PAD_COUNT = 4;
const $ = (selector) => document.querySelector(selector);

const startButton = $("#startButton");
const retryButton = $("#retryButton");
const soundButton = $("#soundButton");
const resultOverlay = $("#resultOverlay");
const timeValue = $("#timeValue");
const scoreValue = $("#scoreValue");
const comboValue = $("#comboValue");
const energyValue = $("#energyValue");
const coreEnergy = $("#coreEnergy");
const judgement = $("#judgement");
const gameMessage = $("#gameMessage");
const musicState = $("#musicState");
const syncState = $("#syncState");
const pendingState = $("#pendingState");
const beatRing = $("#beatRing");
const stemPreset = $("#stemPreset");
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");
const resultTitle = $("#resultTitle");
const resultMessage = $("#resultMessage");
const finalScore = $("#finalScore");
const perfectValue = $("#perfectValue");
const maxComboValue = $("#maxComboValue");
const pads = [...document.querySelectorAll(".forge-pad")];

const stemUi = {
  drums: { bar: $("#stemDrums"), value: $("#stemDrumsValue") },
  bass: { bar: $("#stemBass"), value: $("#stemBassValue") },
  chords: { bar: $("#stemChords"), value: $("#stemChordsValue") },
  melody: { bar: $("#stemMelody"), value: $("#stemMelodyValue") },
  sparkle: { bar: $("#stemSparkle"), value: $("#stemSparkleValue") },
};

const PRESET_NAMES = {
  focus: "FOCUS",
  build: "BUILD",
  overdrive: "OVERDRIVE",
  result: "RESULT",
};

let state = "ready";
let remaining = GAME_TIME;
let startedAt = 0;
let timerId = null;
let score = 0;
let combo = 0;
let maxCombo = 0;
let energy = 20;
let perfects = 0;
let activePad = -1;
let previousPad = -1;
let beatStartedAt = 0;
let beatResolved = true;
let lastBeatKey = "";
let currentLayerPreset = "focus";
let pendingLayerPreset = null;
let masterSoundEnabled = true;

function renderStemMix(mix, preset = currentLayerPreset) {
  Object.entries(stemUi).forEach(([name, ui]) => {
    const percent = Math.round((mix?.[name] ?? 0) * 100);
    ui.bar.style.width = `${percent}%`;
    ui.value.textContent = String(percent);
  });
  stemPreset.textContent = PRESET_NAMES[preset] || String(preset || "CUSTOM").toUpperCase();
}

const sharedSettings = getMusicSettings();
let pulsePack = null;
const runtime = createMusicRuntime({
  gameId: GAME_IDS.PULSE_FORGE,
  callbacks: {
    onModeChange(label) {
      musicState.textContent = label;
    },
    onLayerChange(info = {}) {
      if (info.preset) currentLayerPreset = info.preset;
      pendingLayerPreset = info.pendingPreset || null;
      renderStemMix(info.mix || pulsePack?.layerPresets?.focus, currentLayerPreset);
      pendingState.textContent = pendingLayerPreset
        ? `${PRESET_NAMES[pendingLayerPreset] || pendingLayerPreset} MIX 予約中`
        : "—";
    },
    onSync(info) {
      syncState.textContent = info.mode === "ready" ? "BAR — / BEAT —" : `BAR ${info.bar} / BEAT ${info.beat}`;
      pendingLayerPreset = info.pendingLayerPreset || pendingLayerPreset;
      pendingState.textContent = pendingLayerPreset
        ? `${PRESET_NAMES[pendingLayerPreset] || pendingLayerPreset} MIX 予約中`
        : "—";

      if (state !== "playing" || info.subdivision !== 0) return;
      const key = `${info.bar}-${info.beat}`;
      if (key === lastBeatKey) return;
      lastBeatKey = key;
      beginBeat();
    },
  },
  settings: sharedSettings,
});
const packEntry = runtime.entry;
pulsePack = runtime.entry.pack;
const music = runtime.manager;
applyMusicSettingsToControls({ bgmToggle, sfxToggle, bgmVolume, sfxVolume, bgmVolumeValue, sfxVolumeValue }, sharedSettings);

function setMessage(title, body, kicker = "RHYTHM / WAV STEM MIXER") {
  gameMessage.innerHTML = `<span class="message-kicker">${kicker}</span><strong>${title}</strong><span>${body}</span>`;
}

function updateStatus() {
  timeValue.textContent = remaining.toFixed(1);
  scoreValue.textContent = score.toLocaleString("ja-JP");
  comboValue.textContent = String(combo);
  energyValue.textContent = String(Math.round(energy));
  coreEnergy.textContent = String(Math.round(energy));
  document.documentElement.style.setProperty("--forge-energy", `${energy}%`);
}

function clearPads() {
  pads.forEach((pad) => pad.classList.remove("is-active", "is-perfect", "is-good", "is-miss"));
}

function choosePad() {
  let next = Math.floor(Math.random() * PAD_COUNT);
  while (next === previousPad) next = Math.floor(Math.random() * PAD_COUNT);
  previousPad = next;
  return next;
}

function beginBeat() {
  if (!beatResolved && activePad >= 0) applyMiss(false);
  clearPads();
  activePad = choosePad();
  beatResolved = false;
  beatStartedAt = performance.now();
  pads[activePad]?.classList.add("is-active");
  beatRing.classList.remove("is-pulse");
  void beatRing.offsetWidth;
  beatRing.classList.add("is-pulse");
}

function desiredPreset() {
  if (energy >= 75) return "overdrive";
  if (energy >= 40) return "build";
  return "focus";
}

function updateAdaptiveMix() {
  const desired = desiredPreset();
  if (desired === currentLayerPreset) {
    if (pendingLayerPreset && pendingLayerPreset !== desired) music.cancelPendingLayerMix();
    return;
  }
  if (pendingLayerPreset !== desired) {
    music.setLayerPreset(desired, { quantize: "bar", fadeBeats: 1 });
  }
}

function showJudgement(text, className) {
  judgement.textContent = text;
  judgement.className = className;
}

function applyHit(kind, pad) {
  beatResolved = true;
  pad.classList.remove("is-active");

  if (kind === "perfect") {
    combo += 1;
    perfects += 1;
    maxCombo = Math.max(maxCombo, combo);
    score += 100 + Math.min(100, combo * 5);
    energy = Math.min(100, energy + 12);
    pad.classList.add("is-perfect");
    showJudgement("PERFECT", "is-perfect-text");
    music.sfx("perfect");
  } else {
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    score += 55 + Math.min(50, combo * 3);
    energy = Math.min(100, energy + 7);
    pad.classList.add("is-good");
    showJudgement("GOOD", "is-good-text");
    music.sfx("good");
  }

  activePad = -1;
  updateStatus();
  updateAdaptiveMix();
}

function applyMiss(playSound = true, pad = null) {
  beatResolved = true;
  combo = 0;
  energy = Math.max(0, energy - 10);
  score = Math.max(0, score - 20);
  if (pad) pad.classList.add("is-miss");
  showJudgement("MISS", "is-miss-text");
  if (playSound) music.sfx("miss");
  activePad = -1;
  updateStatus();
  updateAdaptiveMix();
}

function tapPad(index, pad) {
  if (state !== "playing" || beatResolved) return;
  if (index !== activePad) {
    pads[activePad]?.classList.remove("is-active");
    applyMiss(true, pad);
    return;
  }
  const delta = performance.now() - beatStartedAt;
  if (delta <= PERFECT_MS) applyHit("perfect", pad);
  else if (delta <= GOOD_MS) applyHit("good", pad);
  else applyMiss(true, pad);
}

function resetGame() {
  clearInterval(timerId);
  music.stop();
  state = "ready";
  remaining = GAME_TIME;
  score = 0;
  combo = 0;
  maxCombo = 0;
  energy = 20;
  perfects = 0;
  activePad = -1;
  previousPad = -1;
  beatResolved = true;
  lastBeatKey = "";
  currentLayerPreset = "focus";
  pendingLayerPreset = null;
  resultOverlay.hidden = true;
  clearPads();
  updateStatus();
  renderStemMix(pulsePack.layerPresets.focus, "focus");
  judgement.textContent = "READY";
  judgement.className = "";
  syncState.textContent = "BAR — / BEAT —";
  pendingState.textContent = "—";
  setMessage("光った炉心をビートに合わせて叩く", `5本のWAVステムが同じ再生位置を共有します。Pack: ${packEntry.name}`);
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
}

async function startGame() {
  resetGame();
  startButton.disabled = true;
  startButton.textContent = "WAV読込中…";
  try {
    await music.play("normal");
  } catch (error) {
    console.error(error);
    startButton.disabled = false;
    startButton.textContent = "ゲーム開始";
    setMessage("WAVの読み込みに失敗", "GitHub Pagesの反映後に再読み込みしてください。", "AUDIO LOAD ERROR");
    return;
  }
  state = "playing";
  startedAt = performance.now();
  startButton.textContent = "鍛造中";
  setMessage("ビートに同期せよ", "Energyを上げると、次の小節から実WAVステムのMixが変化します。", "PLAYING / WAV STEM SYNC");

  timerId = window.setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    remaining = Math.max(0, GAME_TIME - elapsed);
    updateStatus();
    if (remaining <= 0) endGame();
  }, 50);
}

function endGame() {
  if (state === "result") return;
  clearInterval(timerId);
  remaining = 0;
  state = "result";
  beatResolved = true;
  activePad = -1;
  clearPads();
  music.cancelPendingLayerMix();

  const cleared = energy >= 60;
  void (async () => {
    try {
      await music.setLayerPreset("result", { seconds: 0.30 });
      await music.transitionTo("result");
      await music.playStinger(cleared ? "victory" : "gameover", { duck: 0.26, attack: 0.06, release: 0.32 });
    } catch (error) {
      console.error("stinger playback failed", error);
      music.sfx(cleared ? "win" : "lose");
    }
  })();
  updateStatus();

  const previousBest = Number(localStorage.getItem("pulse-forge-best") || 0);
  if (score > previousBest) localStorage.setItem("pulse-forge-best", String(score));
  resultTitle.textContent = score > previousBest ? "NEW FORGE!" : "FORGED!";
  resultMessage.textContent = `最終エネルギー${Math.round(energy)}%。PERFECT ${perfects}回、最大${maxCombo}コンボ。`;
  finalScore.textContent = score.toLocaleString("ja-JP");
  perfectValue.textContent = String(perfects);
  maxComboValue.textContent = String(maxCombo);
  resultOverlay.hidden = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
}

async function applyAudioState() {
  await music.setMusicEnabled(masterSoundEnabled && bgmToggle.checked);
  await music.setSfxEnabled(masterSoundEnabled && sfxToggle.checked);
  soundButton.setAttribute("aria-pressed", String(masterSoundEnabled));
  soundButton.textContent = masterSoundEnabled ? "♪" : "×";
}

pads.forEach((pad, index) => pad.addEventListener("click", () => tapPad(index, pad)));
soundButton.addEventListener("click", async () => {
  masterSoundEnabled = !masterSoundEnabled;
  await applyAudioState();
  if (masterSoundEnabled && sfxToggle.checked) music.sfx("toggle");
});
bgmToggle.addEventListener("change", async () => {
  saveMusicSettings({ bgmEnabled: bgmToggle.checked });
  await applyAudioState();
});
sfxToggle.addEventListener("change", async () => {
  saveMusicSettings({ sfxEnabled: sfxToggle.checked });
  await applyAudioState();
});
bgmVolume.addEventListener("input", () => {
  bgmVolumeValue.textContent = bgmVolume.value;
  music.setMusicVolume(Number(bgmVolume.value) / 100);
  saveMusicSettings({ bgmVolume: Number(bgmVolume.value) / 100 });
});
sfxVolume.addEventListener("input", () => {
  sfxVolumeValue.textContent = sfxVolume.value;
  music.setSfxVolume(Number(sfxVolume.value) / 100);
  saveMusicSettings({ sfxVolume: Number(sfxVolume.value) / 100 });
});
startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);

resetGame();
