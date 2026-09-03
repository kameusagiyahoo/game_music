import { createMusicFacade } from "../../src/music-facade.js";
import { bindGameAudioControls } from "../../src/game-audio-controls.js";
import { GAME_IDS, getMusicSettings } from "../../src/music-registry.js";
import {
  STABILITY_START,
  applyWrongTap,
  createPulsePlan,
  resolvePulseOutcome,
} from "./sync-engine.js";

const GAME_TIME = 42;
const OVERLOAD_TIME = 10;
const NEXT_PULSE_MS = 330;

const $ = (selector) => document.querySelector(selector);
const pads = [...document.querySelectorAll(".sync-pad")];

const startButton = $("#startButton");
const retryButton = $("#retryButton");
const soundButton = $("#soundButton");
const playerCount = $("#playerCount");
const playerCountValue = $("#playerCountValue");
const timeValue = $("#timeValue");
const syncValue = $("#syncValue");
const comboValue = $("#comboValue");
const stabilityValue = $("#stabilityValue");
const stabilityBar = $("#stabilityBar");
const modeText = $("#modeText");
const gameMessage = $("#gameMessage");
const pulseCore = $("#pulseCore");
const pulseLabel = $("#pulseLabel");
const pulseDetail = $("#pulseDetail");
const resultOverlay = $("#resultOverlay");
const resultTitle = $("#resultTitle");
const resultMessage = $("#resultMessage");
const resultStability = $("#resultStability");
const resultSyncs = $("#resultSyncs");
const resultChords = $("#resultChords");
const resultCombo = $("#resultCombo");
const resultMisses = $("#resultMisses");
const resultWrong = $("#resultWrong");
const musicState = $("#musicState");
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");

let state = "ready";
let players = 2;
let stability = STABILITY_START;
let combo = 0;
let maxCombo = 0;
let syncs = 0;
let chords = 0;
let misses = 0;
let wrongTaps = 0;
let eventIndex = 0;
let startedAt = 0;
let currentPulse = null;
let timerId = null;
let pulseTimeoutId = null;
let nextPulseId = null;

const settings = getMusicSettings();
const music = createMusicFacade({
  gameId: GAME_IDS.SYNC_CIRCUIT,
  callbacks: {
    onModeChange(label) { musicState.textContent = label; },
  },
  settings,
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
  settings,
});

void music.preload({ stingers: true, transitions: true }).catch((error) => {
  console.warn("Sync Circuit preload failed; START will retry", error);
});

function setMessage(title, body, kicker = "COOPERATIVE CIRCUIT") {
  gameMessage.innerHTML =
    `<span class="message-kicker">${kicker}</span><strong>${title}</strong><span>${body}</span>`;
}

function renderPlayers() {
  playerCountValue.textContent = String(players);
  pads.forEach((pad, index) => {
    pad.hidden = index >= players;
    const status = pad.querySelector("small");
    if (status && !pad.classList.contains("is-target")) status.textContent = "READY";
  });
}

function renderTeam() {
  stabilityValue.textContent = String(stability);
  stabilityBar.style.width = `${stability}%`;
  syncValue.textContent = String(syncs);
  comboValue.textContent = `×${combo}`;
  document.body.classList.toggle("is-critical", stability <= 30);
}

function clearPulseVisuals() {
  pulseCore.classList.remove("is-pulse", "is-chord", "is-fail");
  pads.forEach((pad) => {
    pad.classList.remove("is-target", "is-hit", "is-wrong");
    const status = pad.querySelector("small");
    if (status) status.textContent = "READY";
  });
}

function clearTimers() {
  clearInterval(timerId);
  clearTimeout(pulseTimeoutId);
  clearTimeout(nextPulseId);
  timerId = null;
  pulseTimeoutId = null;
  nextPulseId = null;
}

function getRemaining() {
  if (!startedAt) return GAME_TIME;
  return Math.max(0, GAME_TIME - (performance.now() - startedAt) / 1000);
}

function scheduleNextPulse(delay = NEXT_PULSE_MS) {
  clearTimeout(nextPulseId);
  nextPulseId = window.setTimeout(openPulse, delay);
}

function resolveCurrentPulse() {
  if (!currentPulse || state === "result") return;

  clearTimeout(pulseTimeoutId);
  pulseTimeoutId = null;

  const outcome = resolvePulseOutcome({
    stability,
    targetCount: currentPulse.targets.size,
    hitCount: currentPulse.hits.size,
    chord: currentPulse.chord,
    combo,
  });

  stability = outcome.stability;
  combo = outcome.nextCombo;
  maxCombo = Math.max(maxCombo, combo);

  if (outcome.complete) {
    syncs += 1;
    if (currentPulse.chord) chords += 1;
    pulseLabel.textContent = currentPulse.chord ? "CHORD SYNC" : "SYNC";
    pulseDetail.textContent = `STABILITY +${outcome.delta}`;
    music.cue("hit");
  } else {
    misses += outcome.missing;
    pulseCore.classList.add("is-fail");
    pulseLabel.textContent = "MISS";
    pulseDetail.textContent = `STABILITY ${outcome.delta}`;
    music.cue("miss");
  }

  currentPulse = null;
  renderTeam();

  if (stability <= 0) {
    endGame(false, "STABILITY LOST");
    return;
  }

  window.setTimeout(clearPulseVisuals, 150);
  scheduleNextPulse();
}

function openPulse() {
  if (!["playing", "overload"].includes(state) || currentPulse) return;

  eventIndex += 1;
  const overload = getRemaining() <= OVERLOAD_TIME;
  const plan = createPulsePlan({
    players,
    eventIndex,
    randomValue: Math.random(),
    overload,
  });

  currentPulse = {
    chord: plan.chord,
    targets: new Set(plan.targets),
    hits: new Set(),
    openedAt: performance.now(),
  };

  clearPulseVisuals();
  pulseCore.classList.add("is-pulse");
  if (plan.chord) pulseCore.classList.add("is-chord");
  pulseLabel.textContent = plan.chord ? "CHORD" : "PULSE";
  pulseDetail.textContent = plan.targets.map((index) => `P${index + 1}`).join(" + ");

  plan.targets.forEach((index) => {
    const pad = pads[index];
    pad.classList.add("is-target");
    const status = pad.querySelector("small");
    if (status) status.textContent = "NOW";
  });

  pulseTimeoutId = window.setTimeout(resolveCurrentPulse, plan.windowMs);
}

function tapPad(index) {
  if (!["playing", "overload"].includes(state) || index >= players) return;

  if (!currentPulse || !currentPulse.targets.has(index)) {
    stability = applyWrongTap(stability);
    wrongTaps += 1;
    combo = 0;
    pads[index].classList.add("is-wrong");
    window.setTimeout(() => pads[index].classList.remove("is-wrong"), 150);
    pulseDetail.textContent = `P${index + 1} WRONG · -6`;
    music.cue("miss");
    renderTeam();
    if (stability <= 0) endGame(false, "STABILITY LOST");
    return;
  }

  if (currentPulse.hits.has(index)) return;

  currentPulse.hits.add(index);
  const pad = pads[index];
  pad.classList.remove("is-target");
  pad.classList.add("is-hit");
  const status = pad.querySelector("small");
  if (status) status.textContent = "LOCKED";

  if (currentPulse.hits.size === currentPulse.targets.size) {
    resolveCurrentPulse();
  }
}

function resetGame() {
  clearTimers();
  music.stop();

  state = "ready";
  players = Number(playerCount.value);
  stability = STABILITY_START;
  combo = 0;
  maxCombo = 0;
  syncs = 0;
  chords = 0;
  misses = 0;
  wrongTaps = 0;
  eventIndex = 0;
  startedAt = 0;
  currentPulse = null;

  document.body.classList.remove("is-overload", "is-critical");
  resultOverlay.hidden = true;
  playerCount.disabled = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
  timeValue.textContent = GAME_TIME.toFixed(1);
  modeText.textContent = "COOPERATIVE · 42秒間、回路を維持する";
  clearPulseVisuals();
  pulseLabel.textContent = "READY";
  pulseDetail.textContent = "WAITING FOR TEAM";
  renderPlayers();
  renderTeam();
  setMessage("全員で回路を守る", `${players}人協力。光った担当者が時間内にSYNC。`);
}

async function startGame() {
  resetGame();
  await music.start("normal");

  state = "playing";
  startedAt = performance.now();
  playerCount.disabled = true;
  startButton.disabled = true;
  startButton.textContent = "プレイ中";
  setMessage("担当を見逃すな", "成功でSTABILITY回復。CHORDは2人の協力が必要。", "CIRCUIT ONLINE");

  scheduleNextPulse(450);

  timerId = window.setInterval(() => {
    const remaining = getRemaining();
    timeValue.textContent = remaining.toFixed(1);

    if (remaining <= OVERLOAD_TIME && state === "playing") {
      state = "overload";
      document.body.classList.add("is-overload");
      modeText.textContent = "OVERLOAD · CHORD頻度上昇 / 受付360ms";
      setMessage("OVERLOAD", "残り10秒。CHORDが増える。声を掛け合え。", "FINAL SECTOR");
      void music.state("tension", { quantize: "bar", fadeBeats: 1 });
    }

    if (remaining <= 0) {
      endGame(stability > 0, stability > 0 ? "CIRCUIT STABLE" : "STABILITY LOST");
    }
  }, 50);
}

function endGame(success, reason) {
  if (state === "result") return;

  clearTimers();
  state = "result";
  currentPulse = null;
  clearPulseVisuals();
  document.body.classList.remove("is-overload");

  void music.state("result", { quantize: "bar", fadeBeats: 1 });
  void music.outcome(success, { quantize: "bar" });

  resultTitle.textContent = success ? "CIRCUIT STABLE!" : "CIRCUIT LOST";
  resultMessage.textContent = success
    ? `TEAM SUCCESS · 最終STABILITY ${stability}`
    : `${reason} · 次は役割を声に出して合わせよう。`;

  resultStability.textContent = String(stability);
  resultSyncs.textContent = String(syncs);
  resultChords.textContent = String(chords);
  resultCombo.textContent = `×${maxCombo}`;
  resultMisses.textContent = String(misses);
  resultWrong.textContent = String(wrongTaps);
  resultOverlay.hidden = false;
  playerCount.disabled = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
  pulseLabel.textContent = success ? "STABLE" : "OFFLINE";
  pulseDetail.textContent = "TEAM RESULT";
}

playerCount.addEventListener("change", () => {
  if (state !== "ready") return;
  players = Number(playerCount.value);
  renderPlayers();
  setMessage("全員で回路を守る", `${players}人協力。光った担当者が時間内にSYNC。`);
});

pads.forEach((pad, index) => {
  pad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    tapPad(index);
  });
});

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
resetGame();
