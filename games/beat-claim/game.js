import { createMusicFacade } from "../../src/music-facade.js";
import { bindGameAudioControls } from "../../src/game-audio-controls.js";
import {
  GAME_IDS,
  getMusicSettings,
} from "../../src/music-registry.js";
import {
  calculatePenalty,
  calculateSharedSuccessAwards,
  getScoreGap,
} from "./scoring.js";
import {
  CLAIM_ARBITRATION_MS,
  resolveClaimBatch,
} from "./claim-arbiter.js";
import {
  applyPenaltyModifier,
  applySuccessModifier,
  getRoundModifier,
  rollHiddenSignal,
} from "./round-modifiers.js";
import {
  createMatchStats,
  getPlayerMatchSummary,
  recordSuccessfulAwards,
} from "./match-stats.js";

const GAME_TIME = 36;
const TENSION_TIME = 8;
const BPM = 112;
const BEAT_MS = 60_000 / BPM;
const PREVIEW_WINDOW_MS = 220;
const LIVE_WINDOW_MS = 390;
const DECOY_WINDOW_MS = 460;
const BLIND_LIVE_POINTS = 28;
const BLIND_DECOY_PENALTY = 12;

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
const modifierValue = $("#modifierValue");
const modifierDescription = $("#modifierDescription");
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
let matchStats = createMatchStats(4);
let rounds = 0;
let currentModifier = getRoundModifier(1);
let beatIndex = 0;
let signal = "idle";
let signalStartedAt = 0;
let signalClaimed = false;
let hiddenSignal = "live";
let startedAt = 0;
let timerId = null;
let beatTimerId = null;
let signalTimerId = null;
let claimArbitrationTimerId = null;
let claimQueue = [];
let claimContext = null;

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
  beatCore.classList.remove("is-beat", "is-preview", "is-live", "is-decoy", "is-claimed", "is-photo");
}

function renderPlayers() {
  playerCountValue.textContent = String(players);
  playerPads.forEach((pad, index) => {
    pad.hidden = index >= players;
    const score = pad.querySelector("small");
    if (score) score.textContent = String(scores[index]);

    const gap = index < players ? getScoreGap(scores, index, players) : 0;
    const chase = index < players && gap >= 15;
    pad.classList.toggle("is-chasing", chase);

    const parts = [];
    if (streaks[index] >= 2) parts.push(`STREAK ×${streaks[index]}`);
    if (chase) parts.push(`CHASE +${gap >= 30 ? 10 : 5}`);
    pad.dataset.bonus = parts.join(" · ");
  });
}

function renderModifier() {
  modifierValue.textContent = currentModifier.label;
  modifierDescription.textContent = currentModifier.description;
  document.body.dataset.roundModifier = currentModifier.id;
}

function renderStatus() {
  playerCountValue.textContent = String(players);
  roundValue.textContent = String(rounds);
  signalValue.textContent = signal.toUpperCase();
  renderModifier();
}

function syncRoundMusic() {
  const targetState = state === "tension" ? "tension" : currentModifier.musicState;
  void music.state(targetState, { quantize: "bar", fadeBeats: 1 });
}

function animatePad(index, className) {
  const pad = playerPads[index];
  pad.classList.add(className);
  window.setTimeout(() => pad.classList.remove(className), 180);
}

function formatAwardExtras(award) {
  const extras = [];
  if (award.streakBonus) extras.push(`STREAK +${award.streakBonus}`);
  if (award.comebackBonus) extras.push(`CHASE +${award.comebackBonus}`);
  return extras.length ? ` · ${extras.join(" · ")}` : "";
}

function awardWinners(
  winnerClaims,
  basePointsForClaim,
  label,
  {
    photoFinish = false,
    modifier = currentModifier,
    blind = false,
  } = {},
) {
  const result = calculateSharedSuccessAwards({
    scores,
    streaks,
    players,
    winners: winnerClaims.map((claim) => ({
      index: claim.index,
      basePoints: basePointsForClaim(claim),
    })),
  });

  scores = result.nextScores;
  streaks = result.nextStreaks;
  matchStats = recordSuccessfulAwards(matchStats, {
    awards: result.awards,
    modifierId: modifier.id,
    blind,
    photoFinish,
    streaks,
  });

  result.awards.forEach((award) => animatePad(award.index, "is-winner"));

  if (result.awards.length === 1) {
    const award = result.awards[0];
    reactionValue.textContent =
      `P${award.index + 1} · ${label} +${award.total}${formatAwardExtras(award)}`;
  } else {
    reactionValue.textContent = `PHOTO · ${result.awards
      .map((award) => `P${award.index + 1} +${award.total}`)
      .join(" / ")}`;
  }

  if (photoFinish) beatCore.classList.add("is-photo");
  music.cue("hit");
  renderPlayers();
  return result;
}

function penalizeMany(indexes, amount, label) {
  const uniqueIndexes = [...new Set(indexes)];
  uniqueIndexes.forEach((index) => {
    const penalty = calculatePenalty({ scores, streaks, index, amount });
    scores = penalty.nextScores;
    streaks = penalty.nextStreaks;
    animatePad(index, "is-penalty");
  });

  reactionValue.textContent =
    `${uniqueIndexes.map((index) => `P${index + 1}`).join("/")} · ${label} -${amount}`;
  music.cue("miss");
  renderPlayers();
}

function penalize(index, amount, label) {
  penalizeMany([index], amount, label);
}

function clearClaimArbitration() {
  clearTimeout(claimArbitrationTimerId);
  claimArbitrationTimerId = null;
  claimQueue = [];
  claimContext = null;
}

function resolveQueuedClaims() {
  const context = claimContext;
  const batch = resolveClaimBatch(claimQueue);
  claimArbitrationTimerId = null;
  claimQueue = [];
  claimContext = null;

  if (!context || batch.claims.length === 0) return;

  if (context.signal === "preview") {
    if (context.hiddenSignal === "live") {
      signal = "claimed";
      signalClaimed = true;
      clearCoreClasses();
      beatCore.classList.add("is-live", "is-claimed");
      if (batch.photoFinish) beatCore.classList.add("is-photo");
      coreLabel.textContent = batch.photoFinish ? "PHOTO FINISH" : "BLIND HIT";
      awardWinners(
        batch.winnerClaims,
        () => applySuccessModifier(BLIND_LIVE_POINTS, context.modifier),
        context.modifier.scoreMultiplier > 1 ? "BLIND ×2" : "BLIND",
        {
          photoFinish: batch.photoFinish,
          modifier: context.modifier,
          blind: true,
        },
      );
      renderStatus();
      signalTimerId = window.setTimeout(() => closeSignal("WAIT"), 320);
      return;
    }

    signal = "decoy";
    signalStartedAt = performance.now();
    clearCoreClasses();
    beatCore.classList.add("is-decoy");
    coreLabel.textContent = batch.claims.length > 1 ? "MULTI TRAP" : "TRAP";
    penalizeMany(
      batch.claims.map((claim) => claim.index),
      applyPenaltyModifier(BLIND_DECOY_PENALTY, context.modifier),
      "TRAP",
    );
    renderStatus();
    signalTimerId = window.setTimeout(() => closeSignal("SAFE"), DECOY_WINDOW_MS);
    return;
  }

  if (context.signal === "live") {
    signalClaimed = true;
    clearCoreClasses();
    beatCore.classList.add("is-live", "is-claimed");
    if (batch.photoFinish) beatCore.classList.add("is-photo");

    const firstReaction = Math.max(0, batch.earliestAt - context.signalStartedAt);
    coreLabel.textContent = batch.photoFinish ? "PHOTO FINISH" : "CLAIMED";
    awardWinners(
      batch.winnerClaims,
      (claim) => {
        const reaction = Math.max(0, claim.at - context.signalStartedAt);
        const liveWindowMs = context.modifier.liveWindowMs || LIVE_WINDOW_MS;
        const bonus = Math.max(0, Math.round((liveWindowMs - reaction) / 40));
        const basePoints = 10 + Math.min(10, bonus);
        return applySuccessModifier(basePoints, context.modifier);
      },
      `${Math.round(firstReaction)}ms`,
      {
        photoFinish: batch.photoFinish,
        modifier: context.modifier,
        blind: false,
      },
    );
    signalTimerId = window.setTimeout(() => closeSignal("WAIT"), 280);
  }
}

function queueClaim(index, event) {
  if (!["playing", "tension"].includes(state) || index >= players) return;

  if (signal === "preview" || (signal === "live" && !signalClaimed)) {
    if (!claimContext) {
      claimContext = {
        signal,
        hiddenSignal,
        signalStartedAt,
        modifier: currentModifier,
      };
      clearTimeout(signalTimerId);
      signalTimerId = null;
      claimQueue = [];
      claimArbitrationTimerId = window.setTimeout(
        resolveQueuedClaims,
        CLAIM_ARBITRATION_MS,
      );
    }

    claimQueue.push({
      index,
      at: Number.isFinite(event?.timeStamp) ? event.timeStamp : performance.now(),
    });

    const uniquePlayers = new Set(claimQueue.map((claim) => claim.index)).size;
    reactionValue.textContent = `JUDGING · ${uniquePlayers} CLAIM${uniquePlayers === 1 ? "" : "S"}`;
    return;
  }

  if (signal === "decoy") {
    penalize(index, applyPenaltyModifier(5, currentModifier), "DECOY");
    return;
  }

  if (signal === "idle") {
    penalize(index, applyPenaltyModifier(2, currentModifier), "EARLY");
  }
}

function closeSignal(label = "WAIT") {
  clearTimeout(signalTimerId);
  signalTimerId = null;
  clearClaimArbitration();
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
    signal === "live" ? currentModifier.liveWindowMs : DECOY_WINDOW_MS,
  );
}

function openSignal() {
  if (!["playing", "tension"].includes(state) || signal !== "idle") return;

  rounds += 1;
  currentModifier = getRoundModifier(rounds);
  clearClaimArbitration();
  signalClaimed = false;
  hiddenSignal = rollHiddenSignal(Math.random(), currentModifier);
  renderStatus();
  syncRoundMusic();

  if (!currentModifier.allowGamble) {
    signal = "preview";
    revealSignal();
    return;
  }

  signal = "preview";
  clearCoreClasses();
  beatCore.classList.add("is-preview");
  coreLabel.textContent = "GAMBLE?";
  const blindPoints = applySuccessModifier(BLIND_LIVE_POINTS, currentModifier);
  const trapPenalty = applyPenaltyModifier(BLIND_DECOY_PENALTY, currentModifier);
  reactionValue.textContent = `BLIND +${blindPoints} / TRAP -${trapPenalty}`;
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

function resetGame() {
  clearInterval(timerId);
  clearInterval(beatTimerId);
  clearTimeout(signalTimerId);
  clearClaimArbitration();
  music.stop();

  state = "ready";
  players = Number(playerCount.value);
  scores = [0, 0, 0, 0];
  streaks = [0, 0, 0, 0];
  matchStats = createMatchStats(4);
  rounds = 0;
  currentModifier = getRoundModifier(1);
  beatIndex = 0;
  signal = "idle";
  signalClaimed = false;
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
  setMessage("ルールが変わる6ラウンド周期", `${players}人対戦。DOUBLE / NO GAMBLE / DECOY RUSH / SUDDEN DEATHを読み切ろう。`);
}

async function startGame() {
  resetGame();
  await music.start("normal");

  state = "playing";
  startedAt = performance.now();
  playerCount.disabled = true;
  startButton.disabled = true;
  startButton.textContent = "プレイ中";
  setMessage("ROUND RULEを読め", "各ラウンドで得点倍率・GAMBLE・DECOY確率が変化します。", "PLAYING");

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
  clearClaimArbitration();
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
    .map((score, index) => {
      const summary = getPlayerMatchSummary(matchStats, index, score);
      const rulePoints = [
        ["NORMAL", summary.modifierPoints.normal || 0],
        ["DOUBLE", summary.modifierPoints.double || 0],
        ["NO GAMBLE", summary.modifierPoints["no-gamble"] || 0],
        ["DECOY", summary.modifierPoints["decoy-rush"] || 0],
        ["SUDDEN", summary.modifierPoints["sudden-death"] || 0],
      ]
        .filter(([, points]) => points > 0)
        .map(([label, points]) => `<span>${label} +${points}</span>`)
        .join("");

      return `
        <article class="claim-result-card" data-player="${index + 1}">
          <div class="claim-result-head">
            <span>P${index + 1}</span>
            <strong>${score}</strong>
          </div>
          <div class="claim-result-metrics">
            <span><b>${summary.blindHits}</b> BLIND</span>
            <span><b>${summary.photoFinishes}</b> PHOTO</span>
            <span><b>×${summary.maxStreak}</b> MAX STREAK</span>
            <span><b>${summary.successfulClaims}</b> CLAIMS</span>
          </div>
          <div class="claim-result-rules">
            ${rulePoints || "<span>NO RULE SCORE</span>"}
          </div>
        </article>
      `;
    })
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
  matchStats = createMatchStats(4);
  renderPlayers();
  renderStatus();
  setMessage("ルールが変わる6ラウンド周期", `${players}人対戦。DOUBLE / NO GAMBLE / DECOY RUSH / SUDDEN DEATHを読み切ろう。`);
});

playerPads.forEach((pad, index) => {
  pad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    queueClaim(index, event);
  });
});

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
resetGame();
