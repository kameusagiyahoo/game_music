import { createMusicFacade } from "../../src/music-facade.js";
import { bindGameAudioControls } from "../../src/game-audio-controls.js";
import {
  GAME_IDS,
  getMusicSettings,
} from "../../src/music-registry.js";

const GAME_TIME = 36;
const TENSION_TIME = 8;
const BPM = 112;
const BEAT_MS = 60_000 / BPM;
const PREVIEW_WINDOW_MS = 220;
const LIVE_WINDOW_MS = 390;
const DECOY_WINDOW_MS = 460;
const BLIND_LIVE_POINTS = 28;
const BLIND_DECOY_PENALTY = 12;
const STREAK_BONUSES = Object.freeze([0, 0, 4, 8, 12]);

const $ = (selector) => document.querySelector(selector);
const playerPads = [...document.querySelectorAll(".claim-pad")];

const startButton = $("#startButton");
const retryButton = $("#retryButton");
const soundButton = $("#soundButton");
const resultOverlay = $("#resultOverlay");
const resultTitle = $("#resultTitle");
const resultMessage = $("#resultMessage");
const resultScores = $("#resultScores");
const timeValue = $("#timeValue");
const playerCount = $("#playerCount");
const playerCountValue = $("#playerCountValue");
const roundValue = $("#roundValue");
const signalValue = $("#signalValue");
const gameMessage = $("#gameMessage");
const beatCore = $("#beatCore");
const coreLabel = $("#coreLabel");
const reactionValue = $("#reactionValue");
const musicState = $("#musicState");
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");

let state = "ready";
let players = 2;
let scores = [0, 0, 0, 0];
let streaks = [0, 0, 0, 0];
let rounds = 0;
let beatIndex = 0;
let signal = "idle";
let signalStartedAt = 0;
let signalClaimed = false;
let hiddenSignal = "live";
let previewClaimed = false;
let startedAt = 0;
let timerId = null;
let beatTimerId = null;
let signalTimerId = null;

const sharedSettings = getMusicSettings();
const music = createMusicFacade({
  gameId: GAME_IDS.BEAT_CLAIM,
  callbacks: {
    onModeChange(label) { musicState.textContent = label; },
  },
  settings: sharedSettings,
});

bindGameAudioControls({
  getMusic: () => music,
  soundButton,
  bgmToggle,
  sfxToggle,
  bgmVolume,
  sfxVolume,
  bgmVolumeValue,
  sfxVolumeValue,
  settings: sharedSettings,
});

void music.preload({ stingers: true, transitions: true }).catch((error) => {
  console.warn("Beat Claim preload failed; START will retry", error);
});

function setMessage(title, body, kicker = "LOCAL MULTIPLAYER") {
  gameMessage.innerHTML = `<span class="message-kicker">${kicker}</span><strong>${title}</strong><span>${body}</span>`;
}

function clearCoreClasses() {
  beatCore.classList.remove("is-beat", "is-preview", "is-live", "is-decoy", "is-claimed");
}

function getLeaderScore() {
  return Math.max(...scores.slice(0, players));
}

function getComebackBonus(index) {
  const gap = getLeaderScore() - scores[index];
  if (gap >= 30) return 10;
  if (gap >= 15) return 5;
  return 0;
}

function getStreakBonus(streak) {
  return STREAK_BONUSES[Math.min(streak, STREAK_BONUSES.length - 1)] || 0;
}

function renderPlayers() {
  playerCountValue.textContent = String(players);
  const leaderScore = getLeaderScore();

  playerPads.forEach((pad, index) => {
    pad.hidden = index >= players;
    const score = pad.querySelector("small");
    if (score) score.textContent = String(scores[index]);

    const gap = leaderScore - scores[index];
    const chase = index < players && gap >= 15;
    pad.classList.toggle("is-chasing", chase);

    const parts = [];
    if (streaks[index] >= 2) parts.push(`STREAK ×${streaks[index]}`);
    if (chase) parts.push(`CHASE +${gap >= 30 ? 10 : 5}`);
    pad.dataset.bonus = parts.join(" · ");
  });
}

function renderStatus() {
  playerCountValue.textContent = String(players);
  roundValue.textContent = String(rounds);
  signalValue.textContent = signal.toUpperCase();
}

function animatePad(index, className) {
  const pad = playerPads[index];
  pad.classList.add(className);
  window.setTimeout(() => pad.classList.remove(className), 180);
}

function resetOtherStreaks(winnerIndex) {
  streaks = streaks.map((streak, index) => index === winnerIndex ? streak : 0);
}

function awardSuccess(index, basePoints, label) {
  const comebackBonus = getComebackBonus(index);
  resetOtherStreaks(index);
  streaks[index] += 1;
  const streakBonus = getStreakBonus(streaks[index]);
  const total = basePoints + comebackBonus + streakBonus;
  scores[index] += total;

  const extras = [];
  if (streakBonus) extras.push(`STREAK +${streakBonus}`);
  if (comebackBonus) extras.push(`CHASE +${comebackBonus}`);
  const suffix = extras.length ? ` · ${extras.join(" · ")}` : "";

  animatePad(index, "is-winner");
  reactionValue.textContent = `P${index + 1} · ${label} +${total}${suffix}`;
  music.cue("hit");
  renderPlayers();
  return total;
}

function penalize(index, amount, label) {
  streaks[index] = 0;
  scores[index] = Math.max(0, scores[index] - amount);
  animatePad(index, "is-penalty");
  reactionValue.textContent = `P${index + 1} · ${label} -${amount}`;
  music.cue("miss");
  renderPlayers();
}

function closeSignal(label = "WAIT") {
  clearTimeout(signalTimerId);
  signalTimerId = null;
  signal = "idle";
  signalClaimed = false;
  clearCoreClasses();
  coreLabel.textContent = label;
  reactionValue.textContent = "—";
  renderStatus();
}

function revealSignal() {
  if (!["playing", "tension"].includes(state) || signal !== "preview") return;

  signal = hiddenSignal;
  signalStartedAt = performance.now();
  clearCoreClasses();
  beatCore.classList.add(signal === "live" ? "is-live" : "is-decoy");
  coreLabel.textContent = signal === "live" ? "LIVE" : "DECOY";
  reactionValue.textContent = signal === "live" ? "CLAIM!" : "DON'T TAP";
  renderStatus();

  signalTimerId = window.setTimeout(
    () => closeSignal(signal === "live" ? "MISS" : "SAFE"),
    signal === "live" ? LIVE_WINDOW_MS : DECOY_WINDOW_MS,
  );
}

function openSignal() {
  if (!["playing", "tension"].includes(state) || signal !== "idle") return;

  rounds += 1;
  signalClaimed = false;
  previewClaimed = false;
  hiddenSignal = Math.random() < 0.72 ? "live" : "decoy";
  signal = "preview";
  clearCoreClasses();
  beatCore.classList.add("is-preview");
  coreLabel.textContent = "GAMBLE?";
  reactionValue.textContent = "BLIND +28 / TRAP -12";
  renderStatus();

  signalTimerId = window.setTimeout(revealSignal, PREVIEW_WINDOW_MS);
}

function tickBeat() {
  if (!["playing", "tension"].includes(state)) return;
  beatIndex += 1;
  beatCore.classList.add("is-beat");
  window.setTimeout(() => beatCore.classList.remove("is-beat"), 90);

  // A signal every two beats keeps the game readable on one shared screen.
  if (beatIndex % 2 === 0 && signal === "idle") openSignal();
}

function claim(index) {
  if (!["playing", "tension"].includes(state) || index >= players) return;

  if (signal === "preview" && !previewClaimed) {
    previewClaimed = true;
    clearTimeout(signalTimerId);

    if (hiddenSignal === "live") {
      signal = "claimed";
      signalClaimed = true;
      awardSuccess(index, BLIND_LIVE_POINTS, "BLIND");
      clearCoreClasses();
      beatCore.classList.add("is-live", "is-claimed");
      coreLabel.textContent = "BLIND HIT";
      renderStatus();
      signalTimerId = window.setTimeout(() => closeSignal("WAIT"), 300);
      return;
    }

    penalize(index, BLIND_DECOY_PENALTY, "TRAP");
    signal = "decoy";
    signalStartedAt = performance.now();
    clearCoreClasses();
    beatCore.classList.add("is-decoy");
    coreLabel.textContent = "TRAP";
    renderStatus();
    signalTimerId = window.setTimeout(() => closeSignal("SAFE"), DECOY_WINDOW_MS);
    return;
  }

  if (signal === "live" && !signalClaimed) {
    signalClaimed = true;
    const reaction = Math.max(0, performance.now() - signalStartedAt);
    const bonus = Math.max(0, Math.round((LIVE_WINDOW_MS - reaction) / 40));
    const points = 10 + Math.min(10, bonus);
    awardSuccess(index, points, `${Math.round(reaction)}ms`);
    beatCore.classList.add("is-claimed");
    clearTimeout(signalTimerId);
    signalTimerId = window.setTimeout(() => closeSignal("WAIT"), 260);
    return;
  }

  if (signal === "decoy") {
    penalize(index, 5, "DECOY");
    return;
  }

  if (signal === "idle") {
    penalize(index, 2, "EARLY");
  }
}

function resetGame() {
  clearInterval(timerId);
  clearInterval(beatTimerId);
  clearTimeout(signalTimerId);
  music.stop();

  state = "ready";
  players = Number(playerCount.value);
  scores = [0, 0, 0, 0];
  streaks = [0, 0, 0, 0];
  rounds = 0;
  beatIndex = 0;
  signal = "idle";
  signalClaimed = false;
  previewClaimed = false;
  hiddenSignal = "live";
  document.body.classList.remove("is-tension");
  resultOverlay.hidden = true;
  playerCount.disabled = false;
  timeValue.textContent = GAME_TIME.toFixed(1);
  clearCoreClasses();
  coreLabel.textContent = "READY";
  reactionValue.textContent = "—";
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
  renderPlayers();
  renderStatus();
  setMessage("見るか、賭けるか。", `${players}人対戦。GAMBLE?で先読みするか、安全にLIVEを待とう。`);
}

async function startGame() {
  resetGame();
  await music.start("normal");

  state = "playing";
  startedAt = performance.now();
  playerCount.disabled = true;
  startButton.disabled = true;
  startButton.textContent = "プレイ中";
  setMessage("先読みか、安全策か", "2拍ごとにGAMBLE? → LIVE / DECOY。先押しはハイリスクです。", "PLAYING");

  beatTimerId = window.setInterval(tickBeat, BEAT_MS);
  tickBeat();

  timerId = window.setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    const remaining = Math.max(0, GAME_TIME - elapsed);
    timeValue.textContent = remaining.toFixed(1);

    if (remaining <= TENSION_TIME && state === "playing") {
      state = "tension";
      document.body.classList.add("is-tension");
      setMessage("FINAL RUSH", "残り8秒。迷ったら負け。DECOYには注意。", "TENSION");
      void music.state("tension", { quantize: "bar", fadeBeats: 1 });
    }

    if (remaining <= 0) endGame();
  }, 50);
}

function endGame() {
  if (state === "result") return;

  clearInterval(timerId);
  clearInterval(beatTimerId);
  clearTimeout(signalTimerId);
  state = "result";
  signal = "result";
  document.body.classList.remove("is-tension");
  clearCoreClasses();
  coreLabel.textContent = "FINISH";
  reactionValue.textContent = "—";
  renderStatus();

  void music.state("result", { quantize: "bar", fadeBeats: 1 });

  const activeScores = scores.slice(0, players);
  const topScore = Math.max(...activeScores);
  const winners = activeScores
    .map((score, index) => ({ score, index }))
    .filter((item) => item.score === topScore);

  resultTitle.textContent = winners.length === 1
    ? `P${winners[0].index + 1} WINS!`
    : "DRAW!";
  resultMessage.textContent = `${rounds}ラウンド。最高得点は${topScore}点でした。`;
  resultScores.innerHTML = activeScores
    .map((score, index) => `<div class="claim-result-row"><span>P${index + 1}</span><strong>${score}</strong></div>`)
    .join("");

  resultOverlay.hidden = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
  playerCount.disabled = false;
  void music.outcome(topScore >= 60, { quantize: "bar" });
}

playerCount.addEventListener("change", () => {
  if (state !== "ready") return;
  players = Number(playerCount.value);
  scores = [0, 0, 0, 0];
  streaks = [0, 0, 0, 0];
  renderPlayers();
  renderStatus();
  setMessage("見るか、賭けるか。", `${players}人対戦。GAMBLE?で先読みするか、安全にLIVEを待とう。`);
});

playerPads.forEach((pad, index) => {
  pad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    claim(index);
  });
});

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
resetGame();
