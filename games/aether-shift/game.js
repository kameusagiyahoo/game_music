import { createMusicFacade } from "../../src/music-facade.js";
import { resolveMusicAsset } from "../../src/music-asset-resolver.js";
import {
  GAME_IDS,
  listMusicPacks,
  getMusicPackEntry,
  getMusicSettings,
  saveMusicSettings,
  applyMusicSettingsToControls,
} from "../../src/music-registry.js";

const WAVE_SECONDS = 8;
const TOTAL_WAVES = 4;
const GRID_SIZE = 9;
const TENSION_SECONDS = 2.4;
const STORAGE_KEY = "aether-shift-pack";

const $ = (selector) => document.querySelector(selector);
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const startButton = $("#startButton");
const retryButton = $("#retryButton");
const soundButton = $("#soundButton");
const timeValue = $("#timeValue");
const waveValue = $("#waveValue");
const scoreValue = $("#scoreValue");
const flowValue = $("#flowValue");
const flowBar = $("#flowBar");
const hitState = $("#hitState");
const currentPack = $("#currentPack");
const pendingPack = $("#pendingPack");
const engineState = $("#engineState");
const musicState = $("#musicState");
const syncState = $("#syncState");
const packButtons = $("#packButtons");
const grid = $("#shiftGrid");
const gameMessage = $("#gameMessage");
const resultOverlay = $("#resultOverlay");
const resultTitle = $("#resultTitle");
const resultMessage = $("#resultMessage");
const finalScore = $("#finalScore");
const finalHits = $("#finalHits");
const finalEngine = $("#finalEngine");
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");

const packs = listMusicPacks();
const fallbackEntry = resolveMusicAsset({ gameId: GAME_IDS.AETHER_SHIFT });
const storedPack = localStorage.getItem(STORAGE_KEY);
let selectedPackId = getMusicPackEntry(storedPack)?.id || fallbackEntry.id;

let music = null;
let pendingPackId = null;
let state = "ready";
let wave = 1;
let score = 0;
let combo = 0;
let flow = 20;
let hits = 0;
let misses = 0;
let activeNode = -1;
let previousNode = -1;
let waveStartedAt = 0;
let targetDeadline = 0;
let timerId = null;
let tensionTriggered = false;
let masterSoundEnabled = true;

function setMessage(title, body, kicker = "REACTION / ENGINE HOT-SWAP") {
  gameMessage.innerHTML = `<span class="message-kicker">${kicker}</span><strong>${title}</strong><span>${body}</span>`;
}

function renderGrid() {
  grid.innerHTML = "";
  for (let i = 0; i < GRID_SIZE; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shift-node";
    button.dataset.index = String(i);
    button.setAttribute("aria-label", `Aether node ${i + 1}`);
    button.innerHTML = `<span>${["✦","◇","○","△","✧","□","◆","◎","✶"][i]}</span>`;
    button.addEventListener("click", () => tapNode(i, button));
    grid.appendChild(button);
  }
}

function runtimeCallbacks() {
  return {
    onModeChange(label) {
      musicState.textContent = label || "READY";
    },
    onSync(info = {}) {
      syncState.textContent = info.mode === "ready" || !info.bar
        ? "BAR — / BEAT —"
        : `BAR ${info.bar} / BEAT ${info.beat}`;
    },
    onLayerChange(info = {}) {
      if (music?.engine === "wav-stem" && info.pendingPreset) {
        musicState.textContent = `NEXT BAR · ${String(info.pendingPreset).toUpperCase()}`;
      }
    },
  };
}

function renderPackButtons() {
  packButtons.innerHTML = packs.map((entry) => `
    <button type="button" class="pack-button" data-pack="${entry.id}">
      <strong>${entry.shortName}</strong>
      <span>${entry.description}</span>
      <small>${entry.engine}</small>
    </button>
  `).join("");

  packButtons.querySelectorAll(".pack-button").forEach((button) => {
    button.addEventListener("click", () => queuePack(button.dataset.pack));
  });
  refreshPackButtons();
}

function refreshPackButtons() {
  const shownCurrent = music?.entry?.id || (state === "ready" || state === "result" ? selectedPackId : null);
  document.querySelectorAll(".pack-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.pack === shownCurrent);
    button.classList.toggle("is-pending", button.dataset.pack === pendingPackId);
  });
}

function previewPack(packId) {
  const entry = getMusicPackEntry(packId);
  if (!entry) return;
  currentPack.textContent = entry.name;
  engineState.textContent = entry.engine.toUpperCase();
  pendingPack.textContent = "—";
  musicState.textContent = "READY · resolver selected";
  syncState.textContent = "BAR — / BEAT —";
  refreshPackButtons();
}

async function activateRuntime(packId, play = true) {
  music?.stop();
  music = createMusicFacade({
    packId,
    callbacks: runtimeCallbacks(),
    settings: getMusicSettings(),
  });
  selectedPackId = music.entry.id;
  localStorage.setItem(STORAGE_KEY, selectedPackId);
  currentPack.textContent = music.entry.name;
  engineState.textContent = music.engine.toUpperCase();
  pendingPack.textContent = pendingPackId ? getMusicPackEntry(pendingPackId)?.name || pendingPackId : "—";
  refreshPackButtons();

  if (play) {
    musicState.textContent = music.engine === "wav-stem" ? "LOADING · WAV STEMS" : "STARTING · PROCEDURAL";
    await music.start("normal");
  }
  return music;
}

function queuePack(packId) {
  const entry = getMusicPackEntry(packId);
  if (!entry) return;

  selectedPackId = packId;
  localStorage.setItem(STORAGE_KEY, packId);

  if (state === "playing" || state === "intermission") {
    if (music?.entry?.id === packId) {
      pendingPackId = null;
      pendingPack.textContent = "—";
    } else {
      pendingPackId = packId;
      pendingPack.textContent = entry.name;
      setMessage("Music Packを予約", `${entry.name} / ${entry.engine} を次のウェーブで適用します。`, "RUNTIME SHIFT QUEUED");
    }
  } else {
    pendingPackId = null;
    previewPack(packId);
  }
  refreshPackButtons();
}

function updateStatus(seconds = WAVE_SECONDS) {
  timeValue.textContent = Math.max(0, seconds).toFixed(1);
  waveValue.textContent = String(wave);
  scoreValue.textContent = score.toLocaleString("ja-JP");
  flowValue.textContent = String(Math.round(flow));
  flowBar.style.width = `${flow}%`;
  hitState.textContent = `HITS ${hits} / MISS ${misses}`;
}

function clearNodes() {
  document.querySelectorAll(".shift-node").forEach((node) => node.classList.remove("is-active", "is-hit", "is-miss"));
  activeNode = -1;
}

function targetLifetime() {
  return Math.max(560, 980 - (wave - 1) * 115);
}

function chooseTarget() {
  let next = Math.floor(Math.random() * GRID_SIZE);
  while (next === previousNode) next = Math.floor(Math.random() * GRID_SIZE);
  previousNode = next;
  clearNodes();
  activeNode = next;
  const node = document.querySelector(`.shift-node[data-index="${next}"]`);
  node?.classList.add("is-active");
  targetDeadline = performance.now() + targetLifetime();
}

function missTarget(playSound = true) {
  if (activeNode < 0) return;
  const node = document.querySelector(`.shift-node[data-index="${activeNode}"]`);
  node?.classList.remove("is-active");
  node?.classList.add("is-miss");
  misses += 1;
  combo = 0;
  flow = Math.max(0, flow - 8);
  if (playSound) music?.cue("miss");
  updateStatus(Math.max(0, WAVE_SECONDS - (performance.now() - waveStartedAt) / 1000));
  window.setTimeout(() => node?.classList.remove("is-miss"), 140);
  chooseTarget();
}

function tapNode(index, node) {
  if (state !== "playing") return;

  if (index !== activeNode) {
    misses += 1;
    combo = 0;
    flow = Math.max(0, flow - 6);
    node.classList.add("is-miss");
    music?.cue("miss");
    window.setTimeout(() => node.classList.remove("is-miss"), 140);
    updateStatus(Math.max(0, WAVE_SECONDS - (performance.now() - waveStartedAt) / 1000));
    return;
  }

  hits += 1;
  combo += 1;
  flow = Math.min(100, flow + 5 + Math.min(4, combo * 0.25));
  score += 25 + Math.min(60, combo * 4) + wave * 5;
  node.classList.remove("is-active");
  node.classList.add("is-hit");
  music?.cue("hit");
  window.setTimeout(() => node.classList.remove("is-hit"), 110);
  updateStatus(Math.max(0, WAVE_SECONDS - (performance.now() - waveStartedAt) / 1000));
  chooseTarget();
}

async function startWave() {
  state = "intermission";
  tensionTriggered = false;
  clearNodes();

  if (pendingPackId && pendingPackId !== music?.entry?.id) {
    const nextEntry = getMusicPackEntry(pendingPackId);
    setMessage("Runtimeを交換中", `${nextEntry.name} → ${nextEntry.engine.toUpperCase()}`, "MUSIC ASSET RESOLVER");
    const nextId = pendingPackId;
    pendingPackId = null;
    pendingPack.textContent = "—";
    try {
      await activateRuntime(nextId, true);
    } catch (error) {
      console.error(error);
      setMessage("音源の切替に失敗", "別のMusic Packを選んで再試行してください。", "AUDIO ERROR");
      state = "ready";
      startButton.disabled = false;
      startButton.textContent = "ゲーム開始";
      return;
    }
  } else if (!music?.running) {
    await music.start("normal");
  }

  await music.state("normal", { quantize: "immediate", seconds: 0.20 });

  state = "playing";
  waveStartedAt = performance.now();
  chooseTarget();
  setMessage(
    `WAVE ${wave}`,
    `${music.entry.name} / ${music.engine.toUpperCase()}。光ったノードを追い続けよう。`,
    "AETHER STREAM ACTIVE"
  );

  timerId = window.setInterval(tick, 40);
}

function tick() {
  if (state !== "playing") return;
  const elapsed = (performance.now() - waveStartedAt) / 1000;
  const remaining = Math.max(0, WAVE_SECONDS - elapsed);

  if (performance.now() >= targetDeadline && activeNode >= 0) missTarget(true);

  if (remaining <= TENSION_SECONDS && !tensionTriggered) {
    tensionTriggered = true;
    void music.state("tension", { quantize: "bar", crossfadeBeats: 1, fadeBeats: 1 });
    setMessage("WAVE TENSION", "Resolverの共通State APIから終盤音楽へ移行します。", "ADAPTIVE STATE");
  }

  updateStatus(remaining);
  if (remaining <= 0) void finishWave();
}

async function finishWave() {
  if (state !== "playing") return;
  state = "intermission";
  window.clearInterval(timerId);
  timerId = null;
  clearNodes();

  if (wave >= TOTAL_WAVES) {
    await endGame();
    return;
  }

  const next = pendingPackId ? getMusicPackEntry(pendingPackId) : null;
  setMessage(
    `WAVE ${wave} COMPLETE`,
    next ? `次は ${next.name} / ${next.engine.toUpperCase()} へRuntimeを交換します。` : "同じRuntimeのまま次のウェーブへ進みます。",
    "SHIFT GATE"
  );
  await wait(1100);
  wave += 1;
  await startWave();
}

async function endGame() {
  state = "result";
  clearNodes();
  await music.state("result", { quantize: "immediate", seconds: 0.30 });
  const success = hits >= 20 || score >= 1200;
  try {
    await music.outcome(success);
  } catch (error) {
    console.error(error);
  }

  resultTitle.textContent = success ? "SHIFT MASTERED" : "SHIFT COMPLETE";
  resultMessage.textContent = `4ウェーブでHIT ${hits}、MISS ${misses}。最終Packは${music.entry.name}。`;
  finalScore.textContent = score.toLocaleString("ja-JP");
  finalHits.textContent = String(hits);
  finalEngine.textContent = music.engine.toUpperCase();
  resultOverlay.hidden = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
}

function resetGame() {
  window.clearInterval(timerId);
  timerId = null;
  music?.stop();
  music = null;
  pendingPackId = null;
  state = "ready";
  wave = 1;
  score = 0;
  combo = 0;
  flow = 20;
  hits = 0;
  misses = 0;
  activeNode = -1;
  previousNode = -1;
  resultOverlay.hidden = true;
  clearNodes();
  updateStatus(WAVE_SECONDS);
  previewPack(selectedPackId);
  setMessage("光ったノードを追いかける", "Pack変更は次のウェーブ境界で適用。再生EngineはResolverが自動選択します。");
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
}

async function startGame() {
  resetGame();
  startButton.disabled = true;
  startButton.textContent = "AUDIO準備中…";
  try {
    await activateRuntime(selectedPackId, true);
  } catch (error) {
    console.error(error);
    setMessage("音源の開始に失敗", "ページを再読み込みして再試行してください。", "AUDIO ERROR");
    startButton.disabled = false;
    startButton.textContent = "ゲーム開始";
    return;
  }
  startButton.textContent = "プレイ中";
  await startWave();
}

async function applyAudioState() {
  if (!music) return;
  await music.audio({
    musicEnabled: masterSoundEnabled && bgmToggle.checked,
    sfxEnabled: masterSoundEnabled && sfxToggle.checked,
  });
  soundButton.setAttribute("aria-pressed", String(masterSoundEnabled));
  soundButton.textContent = masterSoundEnabled ? "♪" : "×";
}

soundButton.addEventListener("click", async () => {
  masterSoundEnabled = !masterSoundEnabled;
  await applyAudioState();
  if (masterSoundEnabled && sfxToggle.checked) music?.cue("toggle");
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
  const value = Number(bgmVolume.value) / 100;
  bgmVolumeValue.textContent = bgmVolume.value;
  saveMusicSettings({ bgmVolume: value });
  void music?.audio({ musicVolume: value });
});
sfxVolume.addEventListener("input", () => {
  const value = Number(sfxVolume.value) / 100;
  sfxVolumeValue.textContent = sfxVolume.value;
  saveMusicSettings({ sfxVolume: value });
  void music?.audio({ sfxVolume: value });
});

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);

renderGrid();
renderPackButtons();
applyMusicSettingsToControls(
  { bgmToggle, sfxToggle, bgmVolume, sfxVolume, bgmVolumeValue, sfxVolumeValue },
  getMusicSettings()
);
resetGame();
