import { createMusicRuntime } from "../../src/music-asset-resolver.js";
import {
  GAME_IDS,
  MUSIC_ENGINES,
  getMusicSettings,
  saveMusicSettings,
  listMusicPacks,
  applyMusicSettingsToControls,
} from "../../src/music-registry.js";

const GAME_TIME = 45;
const TENSION_AT = 10;
const $ = (selector) => document.querySelector(selector);
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const proceduralEntries = listMusicPacks({ engine: MUSIC_ENGINES.PROCEDURAL });
const PACKS = Object.fromEntries(proceduralEntries.map((entry) => [entry.id, entry.pack]));

const startButton = $("#startButton");
const retryButton = $("#retryButton");
const soundButton = $("#soundButton");
const timeValue = $("#timeValue");
const roundValue = $("#roundValue");
const scoreValue = $("#scoreValue");
const streakValue = $("#streakValue");
const sequenceLength = $("#sequenceLength");
const sequenceDots = $("#sequenceDots");
const gameMessage = $("#gameMessage");
const musicState = $("#musicState");
const syncState = $("#syncState");
const currentPack = $("#currentPack");
const pendingPack = $("#pendingPack");
const packButtonsContainer = $("#packButtons");
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");
const resultOverlay = $("#resultOverlay");
const resultTitle = $("#resultTitle");
const resultMessage = $("#resultMessage");
const finalScore = $("#finalScore");
const finalRound = $("#finalRound");
const finalPack = $("#finalPack");
const pads = [...document.querySelectorAll(".rune-pad")];

let state = "ready";
let remaining = GAME_TIME;
let startedAt = 0;
let timerId = null;
let round = 1;
let score = 0;
let streak = 0;
let sequence = [];
let inputIndex = 0;
let acceptingInput = false;
let playbackToken = 0;
let tensionRequested = false;
let masterSoundEnabled = true;

function renderPackRegistry() {
  packButtonsContainer.innerHTML = proceduralEntries.map((entry) => `
    <button type="button" class="pack-button" data-pack="${entry.id}">
      <strong>${entry.shortName}</strong><span>${entry.description}</span>
    </button>
  `).join("");
}

function renderPackButtons(info = {}) {
  const activeInfo = info.id ? info : music.getPackInfo();
  currentPack.textContent = activeInfo.name || music.getPackInfo().name;
  pendingPack.textContent = activeInfo.pendingName || "—";
  document.querySelectorAll(".pack-button").forEach((button) => {
    const id = button.dataset.pack;
    button.classList.toggle("is-active", id === (activeInfo.id || music.getPackInfo().id));
    button.classList.toggle("is-pending", id === activeInfo.pendingId);
  });
}

renderPackRegistry();
const sharedSettings = getMusicSettings();
let music;
const runtime = createMusicRuntime({
  gameId: GAME_IDS.RUNE_RELAY,
  engine: MUSIC_ENGINES.PROCEDURAL,
  callbacks: {
    onModeChange(label) {
      musicState.textContent = label;
    },
    onPackChange(info) {
      if (music) renderPackButtons(info);
    },
    onSync(info) {
      syncState.textContent = info.mode === "ready" ? "BAR — / BEAT —" : `BAR ${info.bar} / BEAT ${info.beat}`;
      pendingPack.textContent = info.pendingPackName || "—";
    },
  },
  settings: sharedSettings,
});
music = runtime.manager;
applyMusicSettingsToControls({ bgmToggle, sfxToggle, bgmVolume, sfxVolume, bgmVolumeValue, sfxVolumeValue }, sharedSettings);

function setMessage(title, body, kicker = "MEMORY / PACK SWITCH") {
  gameMessage.innerHTML = `<span class="message-kicker">${kicker}</span><strong>${title}</strong><span>${body}</span>`;
}

function randomPad() {
  return Math.floor(Math.random() * pads.length);
}

function clearPadEffects() {
  pads.forEach((pad) => pad.classList.remove("is-demo", "is-hit", "is-miss"));
}

function renderSequenceProgress(progress = 0) {
  sequenceLength.textContent = String(sequence.length);
  sequenceDots.innerHTML = "";
  const visible = Math.min(sequence.length, 14);
  for (let i = 0; i < visible; i += 1) {
    const dot = document.createElement("i");
    if (i < progress) dot.classList.add("is-current");
    sequenceDots.appendChild(dot);
  }
}

function updateStatus() {
  timeValue.textContent = remaining.toFixed(1);
  roundValue.textContent = String(round);
  scoreValue.textContent = score.toLocaleString("ja-JP");
  streakValue.textContent = String(streak);
  renderSequenceProgress(inputIndex);
}

function makeInitialSequence() {
  sequence = [randomPad(), randomPad()];
  if (sequence[1] === sequence[0]) sequence[1] = (sequence[1] + 1 + randomPad()) % pads.length;
}

async function playSequence() {
  const token = ++playbackToken;
  acceptingInput = false;
  inputIndex = 0;
  clearPadEffects();
  renderSequenceProgress(0);
  setMessage(`ROUND ${round} · WATCH`, `${sequence.length}個のルーンを順番に覚えてください。`, "SEQUENCE PLAYBACK");
  await wait(420);

  for (let i = 0; i < sequence.length; i += 1) {
    if (token !== playbackToken || state !== "playing") return;
    const pad = pads[sequence[i]];
    pad.classList.add("is-demo");
    renderSequenceProgress(i + 1);
    await wait(Math.max(170, 300 - round * 8));
    pad.classList.remove("is-demo");
    await wait(Math.max(80, 145 - round * 4));
  }

  if (token !== playbackToken || state !== "playing") return;
  inputIndex = 0;
  renderSequenceProgress(0);
  acceptingInput = true;
  setMessage("REPEAT", "今見た順番でルーンを入力してください。", "YOUR TURN");
}

function flashPad(pad, className) {
  pad.classList.add(className);
  window.setTimeout(() => pad.classList.remove(className), className === "is-miss" ? 300 : 150);
}

function handleCorrectInput(pad) {
  music.sfx("hit");
  flashPad(pad, "is-hit");
  inputIndex += 1;
  renderSequenceProgress(inputIndex);

  if (inputIndex < sequence.length) return;

  acceptingInput = false;
  streak += 1;
  score += sequence.length * 90 + Math.min(300, streak * 30);
  round += 1;
  sequence.push(randomPad());
  updateStatus();
  setMessage("SEQUENCE CLEAR", `次は${sequence.length}個。列が1つ長くなります。`, "RELAY CONTINUES");
  window.setTimeout(() => {
    if (state === "playing") void playSequence();
  }, 520);
}

function handleMiss(pad) {
  acceptingInput = false;
  streak = 0;
  score = Math.max(0, score - 120);
  music.sfx("miss");
  flashPad(pad, "is-miss");
  updateStatus();
  setMessage("WRONG RUNE", "同じ列をもう一度表示します。", "SEQUENCE RESET");
  window.setTimeout(() => {
    if (state === "playing") void playSequence();
  }, 650);
}

function tapPad(index, pad) {
  if (state !== "playing" || !acceptingInput) return;
  if (index === sequence[inputIndex]) handleCorrectInput(pad);
  else handleMiss(pad);
}

function requestTension() {
  if (tensionRequested) return;
  tensionRequested = true;
  const packInfo = music.getPackInfo();
  if (packInfo.pendingId && PACKS[packInfo.pendingId]) {
    void music.switchPack(PACKS[packInfo.pendingId], {
      quantize: "bar",
      crossfadeBeats: 1.5,
      mode: "tension",
    });
  } else {
    void music.transitionTo("tension", { quantize: "bar", crossfadeBeats: 1.5 });
  }
  setMessage("FINAL RUN", "残り10秒。次の小節からTENSIONへ移行します。", "TENSION QUEUED");
}

function resetGame() {
  playbackToken += 1;
  acceptingInput = false;
  clearInterval(timerId);
  timerId = null;
  music.stop();
  state = "ready";
  remaining = GAME_TIME;
  round = 1;
  score = 0;
  streak = 0;
  inputIndex = 0;
  tensionRequested = false;
  makeInitialSequence();
  clearPadEffects();
  resultOverlay.hidden = true;
  syncState.textContent = "BAR — / BEAT —";
  setMessage("光った順番を覚える", "同じ順番で4つのルーンをタップしてください。");
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
  updateStatus();
  renderPackButtons(music.getPackInfo());
}

async function startGame() {
  resetGame();
  startButton.disabled = true;
  startButton.textContent = "起動中…";
  await music.play("normal");
  state = "playing";
  startedAt = performance.now();
  startButton.textContent = "RELAY中";
  void playSequence();

  timerId = window.setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    remaining = Math.max(0, GAME_TIME - elapsed);
    if (remaining <= TENSION_AT) requestTension();
    updateStatus();
    if (remaining <= 0) endGame();
  }, 50);
}

function endGame() {
  if (state === "result") return;
  state = "result";
  acceptingInput = false;
  playbackToken += 1;
  clearInterval(timerId);
  timerId = null;
  remaining = 0;
  clearPadEffects();
  music.cancelPendingPackSwitch();
  music.cancelPendingTransition();
  void music.transitionTo("result", 0.6);
  music.sfx(round >= 7 ? "win" : "lose");
  updateStatus();

  const previousBest = Number(localStorage.getItem("rune-relay-best") || 0);
  if (score > previousBest) localStorage.setItem("rune-relay-best", String(score));
  const info = music.getPackInfo();
  resultTitle.textContent = score > previousBest ? "NEW RELAY!" : "RELAY COMPLETE";
  resultMessage.textContent = `${sequence.length}個の列まで到達。現在のSTREAKは${streak}。`;
  finalScore.textContent = score.toLocaleString("ja-JP");
  finalRound.textContent = String(round);
  finalPack.textContent = info.name;
  resultOverlay.hidden = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
}

async function choosePack(id) {
  const pack = PACKS[id];
  if (!pack) return;
  saveMusicSettings({ proceduralPackId: id });
  const info = music.getPackInfo();

  if (state === "playing") {
    if (id === info.id) {
      if (info.pendingId) music.cancelPendingPackSwitch();
      return;
    }
    const mode = remaining <= TENSION_AT ? "tension" : "normal";
    await music.switchPack(pack, { quantize: "bar", crossfadeBeats: 2, mode });
    setMessage(`${pack.name} を予約`, "現在の小節が終わるとMusic Packを切り替えます。", "PACK SWITCH QUEUED");
  } else {
    music.setPack(pack);
    renderPackButtons(music.getPackInfo());
  }
}

async function applyAudioState() {
  await music.setMusicEnabled(masterSoundEnabled && bgmToggle.checked);
  await music.setSfxEnabled(masterSoundEnabled && sfxToggle.checked);
  soundButton.setAttribute("aria-pressed", String(masterSoundEnabled));
  soundButton.textContent = masterSoundEnabled ? "♪" : "×";
}

pads.forEach((pad, index) => pad.addEventListener("click", () => tapPad(index, pad)));
packButtonsContainer.addEventListener("click", (event) => {
  const button = event.target.closest(".pack-button");
  if (button) void choosePack(button.dataset.pack);
});

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

makeInitialSequence();
updateStatus();
renderPackButtons(music.getPackInfo());
