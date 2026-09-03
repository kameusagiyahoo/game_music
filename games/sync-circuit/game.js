import { createMusicFacade } from "../../src/music-facade.js";
import { bindGameAudioControls } from "../../src/game-audio-controls.js";
import { GAME_IDS, getMusicSettings } from "../../src/music-registry.js";
import {
  STABILITY_START,
  applyWrongTap,
} from "./sync-engine.js";
import {
  RESCUE_WINDOW_MS,
  canPlayerRescue,
  createCooperationPlan,
  resolveCooperativeOutcome,
} from "./coop-mechanics.js";

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
const resultRescues = $("#resultRescues");
const resultAllSyncs = $("#resultAllSyncs");
const resultLinkRescues = $("#resultLinkRescues");
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
let allSyncs = 0;
let rescues = 0;
let linkRescues = 0;
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
  pulseCore.classList.remove("is-pulse", "is-chord", "is-fail", "is-rescue", "is-all-sync");
  pads.forEach((pad) => {
    pad.classList.remove("is-target", "is-hit", "is-wrong", "is-link", "is-rescue");
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

function enterRescuePhase() {
  if (!currentPulse || currentPulse.phase !== "pulse") return false;

  const missing = currentPulse.targets.size - currentPulse.hits.size;
  if (missing <= 0 || !currentPulse.rescueAllowed) return false;

  currentPulse.phase = "rescue";
  currentPulse.rescueSlots = missing;
  pulseCore.classList.remove("is-pulse", "is-chord");
  pulseCore.classList.add("is-rescue");
  pulseLabel.textContent = "RESCUE";
  pulseDetail.textContent = `NEED ${missing} · LINK P${currentPulse.linkIndex + 1}`;

  currentPulse.targets.forEach((targetIndex) => {
    if (currentPulse.hits.has(targetIndex)) return;
    const status = pads[targetIndex]?.querySelector("small");
    if (status) status.textContent = "MISSED";
  });

  const linkPad = pads[currentPulse.linkIndex];
  if (linkPad) {
    linkPad.classList.add("is-link");
    const status = linkPad.querySelector("small");
    if (status) status.textContent = "LINK";
  }

  pulseTimeoutId = window.setTimeout(resolveCurrentPulse, RESCUE_WINDOW_MS);
  return true;
}

function resolveCurrentPulse() {
  if (!currentPulse || state === "result") return;

  clearTimeout(pulseTimeoutId);
  pulseTimeoutId = null;

  const unresolved = currentPulse.targets.size - currentPulse.hits.size - currentPulse.rescuers.size;
  if (unresolved > 0 && currentPulse.phase === "pulse" && enterRescuePhase()) {
    return;
  }

  const outcome = resolveCooperativeOutcome({
    stability,
    targetCount: currentPulse.targets.size,
    directHitCount: currentPulse.hits.size,
    rescuedCount: currentPulse.rescuers.size,
    linkRescueCount: currentPulse.linkRescueCount,
    chord: currentPulse.chord,
    allSync: currentPulse.allSync,
    combo,
  });

  stability = outcome.stability;
  combo = outcome.nextCombo;
  maxCombo = Math.max(maxCombo, combo);
  rescues += outcome.rescuedCount;
  linkRescues += outcome.linkRescueCount;

  if (outcome.complete) {
    syncs += 1;
    if (currentPulse.allSync) allSyncs += 1;
    else if (currentPulse.chord) chords += 1;

    if (currentPulse.allSync) {
      pulseLabel.textContent = "ALL SYNC";
    } else if (outcome.rescuedCount > 0) {
      pulseLabel.textContent = outcome.linkRescueCount > 0 ? "LINK RESCUE" : "RESCUED";
    } else {
      pulseLabel.textContent = currentPulse.chord ? "CHORD SYNC" : "SYNC";
    }

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
  const plan = createCooperationPlan({
    players,
    eventIndex,
    randomValue: Math.random(),
    overload,
  });

  currentPulse = {
    chord: plan.chord,
    allSync: plan.allSync,
    rescueAllowed: plan.rescueAllowed,
    linkIndex: plan.linkIndex,
    targets: new Set(plan.targets),
    hits: new Set(),
    rescuers: new Set(),
    linkRescueCount: 0,
    rescueSlots: 0,
    phase: "pulse",
    openedAt: performance.now(),
  };

  clearPulseVisuals();
  pulseCore.classList.add("is-pulse");
  if (plan.chord) pulseCore.classList.add("is-chord");
  if (plan.allSync) pulseCore.classList.add("is-all-sync");

  pulseLabel.textContent = plan.allSync ? "ALL SYNC" : plan.chord ? "CHORD" : "PULSE";
  const targetsText = plan.targets.map((index) => `P${index + 1}`).join(" + ");
  const linkText = plan.linkIndex === null ? "" : ` · LINK P${plan.linkIndex + 1}`;
  pulseDetail.textContent = `${targetsText}${linkText}`;

  plan.targets.forEach((index) => {
    const pad = pads[index];
    pad.classList.add("is-target");
    const status = pad.querySelector("small");
    if (status) status.textContent = plan.allSync ? "ALL" : "NOW";
  });

  if (plan.linkIndex !== null && !plan.targets.includes(plan.linkIndex)) {
    pads[plan.linkIndex]?.classList.add("is-link");
    const status = pads[plan.linkIndex]?.querySelector("small");
    if (status) status.textContent = "LINK";
  }

  pulseTimeoutId = window.setTimeout(resolveCurrentPulse, plan.windowMs);
}

function tapPad(index) {
  if (!["playing", "overload"].includes(state) || index >= players) return;

  if (currentPulse?.phase === "rescue") {
    if (!canPlayerRescue({
      playerIndex: index,
      targets: currentPulse.targets,
      rescuers: currentPulse.rescuers,
      rescueSlots: currentPulse.rescueSlots,
    })) {
      return;
    }

    currentPulse.rescuers.add(index);
    if (index === currentPulse.linkIndex) currentPulse.linkRescueCount += 1;

    const pad = pads[index];
    pad.classList.remove("is-link");
    pad.classList.add("is-rescue", "is-hit");
    const status = pad.querySelector("small");
    if (status) status.textContent = index === currentPulse.linkIndex ? "LINK+" : "RESCUE";

    pulseDetail.textContent =
      `RESCUE ${currentPulse.rescuers.size}/${currentPulse.rescueSlots}` +
      (index === currentPulse.linkIndex ? " · LINK +3" : "");

    if (currentPulse.rescuers.size >= currentPulse.rescueSlots) {
      resolveCurrentPulse();
    }
    return;
  }

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
  pad.classList.remove("is-target", "is-link");
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
  allSyncs = 0;
  rescues = 0;
  linkRescues = 0;
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
  modeText.textContent = "COOPERATIVE · LINK役は4パルスごとに交代";
  clearPulseVisuals();
  pulseLabel.textContent = "READY";
  pulseDetail.textContent = "WAITING FOR TEAM";
  renderPlayers();
  renderTeam();
  setMessage("全員で回路を守る", `${players}人協力。見逃しは他プレイヤーがRESCUEできる。`);
}

async function startGame() {
  resetGame();
  await music.start("normal");

  state = "playing";
  startedAt = performance.now();
  playerCount.disabled = true;
  startButton.disabled = true;
  startButton.textContent = "プレイ中";
  setMessage("担当＋LINKを見ろ", "6パルスごとにALL SYNC。見逃し後260msはRESCUE可能。", "CIRCUIT ONLINE");

  scheduleNextPulse(450);

  timerId = window.setInterval(() => {
    const remaining = getRemaining();
    timeValue.textContent = remaining.toFixed(1);

    if (remaining <= OVERLOAD_TIME && state === "playing") {
      state = "overload";
      document.body.classList.add("is-overload");
      modeText.textContent = "OVERLOAD · CHORD増加 / ALL SYNC 480ms";
      setMessage("OVERLOAD", "残り10秒。CHORDとALL SYNCを全員でつなげ。", "FINAL SECTOR");
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
    : `${reason} · RESCUEとALL SYNCを声に出して合わせよう。`;

  resultStability.textContent = String(stability);
  resultSyncs.textContent = String(syncs);
  resultChords.textContent = String(chords);
  resultCombo.textContent = `×${maxCombo}`;
  resultMisses.textContent = String(misses);
  resultWrong.textContent = String(wrongTaps);
  if (resultRescues) resultRescues.textContent = String(rescues);
  if (resultAllSyncs) resultAllSyncs.textContent = String(allSyncs);
  if (resultLinkRescues) resultLinkRescues.textContent = String(linkRescues);
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
  setMessage("全員で回路を守る", `${players}人協力。見逃しは他プレイヤーがRESCUEできる。`);
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
