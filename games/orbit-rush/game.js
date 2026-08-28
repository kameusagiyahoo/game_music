import { createMusicFacade } from "../../src/music-facade.js";
import {
  GAME_IDS,
  getMusicSettings,
  saveMusicSettings,
  applyMusicSettingsToControls,
} from "../../src/music-registry.js";

const GAME_TIME = 30;
const TENSION_TIME = 8;
const PAD_COUNT = 9;
const $ = (selector) => document.querySelector(selector);

const grid = $("#orbitGrid");
const startButton = $("#startButton");
const retryButton = $("#retryButton");
const soundButton = $("#soundButton");
const resultOverlay = $("#resultOverlay");
const timeValue = $("#timeValue");
const scoreValue = $("#scoreValue");
const comboValue = $("#comboValue");
const bestValue = $("#bestValue");
const gameMessage = $("#gameMessage");
const musicState = $("#musicState");
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");
const resultTitle = $("#resultTitle");
const resultMessage = $("#resultMessage");
const finalScore = $("#finalScore");
const maxComboValue = $("#maxComboValue");
const hitsValue = $("#hitsValue");

let state = "ready";
let activePad = -1;
let previousPad = -1;
let score = 0;
let combo = 0;
let maxCombo = 0;
let hits = 0;
let remaining = GAME_TIME;
let startedAt = 0;
let timerId = null;
let masterSoundEnabled = true;

const sharedSettings = getMusicSettings();
const music = createMusicFacade({
  gameId: GAME_IDS.ORBIT_RUSH,
  callbacks: {
    onModeChange(label) { musicState.textContent = label; },
  },
  settings: sharedSettings,
});
const packEntry = music.entry;
applyMusicSettingsToControls({ bgmToggle, sfxToggle, bgmVolume, sfxVolume, bgmVolumeValue, sfxVolumeValue }, sharedSettings);

const best = Number(localStorage.getItem("orbit-rush-best") || 0);
bestValue.textContent = best ? best.toLocaleString("ja-JP") : "—";

function renderPads() {
  grid.innerHTML = "";
  for (let i = 0; i < PAD_COUNT; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "orbit-pad";
    button.dataset.index = String(i);
    button.setAttribute("aria-label", `軌道 ${i + 1}`);
    button.innerHTML = `<span class="orbit-core">${i + 1}</span>`;
    button.addEventListener("click", () => tapPad(i, button));
    grid.appendChild(button);
  }
}

function setMessage(title, body, kicker = "REACTION GAME") {
  gameMessage.innerHTML = `<span class="message-kicker">${kicker}</span><strong>${title}</strong><span>${body}</span>`;
}

function updateStatus() {
  timeValue.textContent = remaining.toFixed(1);
  scoreValue.textContent = score.toLocaleString("ja-JP");
  comboValue.textContent = String(combo);
}

function chooseTarget() {
  let next = Math.floor(Math.random() * PAD_COUNT);
  if (PAD_COUNT > 1) {
    while (next === previousPad) next = Math.floor(Math.random() * PAD_COUNT);
  }
  document.querySelectorAll(".orbit-pad").forEach((pad) => pad.classList.remove("is-active"));
  activePad = next;
  previousPad = next;
  const target = document.querySelector(`.orbit-pad[data-index="${next}"]`);
  target?.classList.add("is-active");
}

function resetGame() {
  clearInterval(timerId);
  music.stop();
  state = "ready";
  activePad = -1;
  previousPad = -1;
  score = 0;
  combo = 0;
  maxCombo = 0;
  hits = 0;
  remaining = GAME_TIME;
  document.body.classList.remove("is-tension");
  resultOverlay.hidden = true;
  renderPads();
  updateStatus();
  setMessage("光った軌道をタップ", `30秒間、ターゲットを追い続けよう。Music Pack: ${packEntry.name}`);
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
}

async function startGame() {
  resetGame();
  await music.start("normal");
  state = "playing";
  startedAt = performance.now();
  startButton.disabled = true;
  startButton.textContent = "プレイ中";
  setMessage("ターゲットを追え", "正解を重ねるほどコンボボーナスが増えます。", "PLAYING");
  chooseTarget();

  timerId = window.setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    remaining = Math.max(0, GAME_TIME - elapsed);

    if (remaining <= TENSION_TIME && state === "playing") {
      state = "tension";
      document.body.classList.add("is-tension");
      setMessage("OVERDRIVE", "残り8秒。BGMも高速モードへ。", "TENSION");
      void music.state("tension", { quantize: "immediate", seconds: 0.5 });
    }

    if (remaining <= 0) {
      remaining = 0;
      updateStatus();
      endGame();
      return;
    }
    updateStatus();
  }, 50);
}

function tapPad(index, button) {
  if (!["playing", "tension"].includes(state)) return;

  if (index === activePad) {
    combo += 1;
    hits += 1;
    maxCombo = Math.max(maxCombo, combo);
    score += 10 + Math.min(40, combo * 2);
    button.classList.add("is-hit");
    window.setTimeout(() => button.classList.remove("is-hit"), 120);
    music.cue("hit");
    chooseTarget();
  } else {
    combo = 0;
    score = Math.max(0, score - 5);
    button.classList.add("is-miss");
    window.setTimeout(() => button.classList.remove("is-miss"), 150);
    music.cue("miss");
  }
  updateStatus();
}

function endGame() {
  if (state === "result") return;
  clearInterval(timerId);
  state = "result";
  activePad = -1;
  document.body.classList.remove("is-tension");
  document.querySelectorAll(".orbit-pad").forEach((pad) => pad.classList.remove("is-active"));
  void music.state("result", { quantize: "immediate", seconds: 0.7 });

  const previousBest = Number(localStorage.getItem("orbit-rush-best") || 0);
  if (score > previousBest) {
    localStorage.setItem("orbit-rush-best", String(score));
    bestValue.textContent = score.toLocaleString("ja-JP");
  }

  resultTitle.textContent = score > previousBest ? "NEW BEST!" : "FINISH!";
  resultMessage.textContent = `30秒で${hits}回ヒット。最大${maxCombo}コンボでした。`;
  finalScore.textContent = score.toLocaleString("ja-JP");
  maxComboValue.textContent = String(maxCombo);
  hitsValue.textContent = String(hits);
  resultOverlay.hidden = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
  music.cue(score >= 250 ? "win" : "lose");
}

async function applyAudioState() {
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
  if (masterSoundEnabled && sfxToggle.checked) music.cue("toggle");
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
  void music.audio({ musicVolume: Number(bgmVolume.value) / 100 });
  saveMusicSettings({ bgmVolume: Number(bgmVolume.value) / 100 });
});
sfxVolume.addEventListener("input", () => {
  sfxVolumeValue.textContent = sfxVolume.value;
  void music.audio({ sfxVolume: Number(sfxVolume.value) / 100 });
  saveMusicSettings({ sfxVolume: Number(sfxVolume.value) / 100 });
});

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
resetGame();
