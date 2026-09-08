import { createMusicFacade } from "../../src/music-facade.js";
import { bindGameAudioControls } from "../../src/game-audio-controls.js";
import { GAME_IDS, getMusicSettings } from "../../src/music-registry.js";
import { getVectorRoundRule, resolveVectorRound } from "./vector-engine.js";

const TOTAL_ROUNDS = 8;
const ROUND_REVEAL_MS = 1150;
const $ = (selector) => document.querySelector(selector);

const playerCount = $("#playerCount");
const playerCountValue = $("#playerCountValue");
const roundValue = $("#roundValue");
const ruleValue = $("#ruleValue");
const lockedValue = $("#lockedValue");
const ruleTitle = $("#ruleTitle");
const ruleDescription = $("#ruleDescription");
const playerGrid = $("#playerGrid");
const gameMessage = $("#gameMessage");
const startButton = $("#startButton");
const retryButton = $("#retryButton");
const resultOverlay = $("#resultOverlay");
const resultTitle = $("#resultTitle");
const resultMessage = $("#resultMessage");
const resultScores = $("#resultScores");
const soundButton = $("#soundButton");
const musicState = $("#musicState");
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");

let state = "ready";
let players = 2;
let round = 0;
let scores = [0, 0, 0, 0];
let choices = [];
let revealTimer = null;

const settings = getMusicSettings();
const music = createMusicFacade({
  gameId: GAME_IDS.VECTOR_PACT,
  callbacks: { onModeChange(label) { musicState.textContent = label; } },
  settings,
});

bindGameAudioControls({ getMusic: () => music, soundButton, bgmToggle, sfxToggle, bgmVolume, sfxVolume, bgmVolumeValue, sfxVolumeValue, settings });
void music.preload({ stingers: true, transitions: true }).catch((error) => console.warn("Vector Pact preload failed", error));

function setMessage(title, body, kicker = "VECTOR PACT") {
  gameMessage.innerHTML = `<span class="message-kicker">${kicker}</span><strong>${title}</strong><span>${body}</span>`;
}

function directionLabel(direction) {
  if (direction === "left") return "← LEFT";
  if (direction === "center") return "● CENTER";
  return "RIGHT →";
}

function renderPlayers() {
  playerGrid.innerHTML = "";
  for (let index = 0; index < 4; index += 1) {
    const section = document.createElement("section");
    section.className = "vector-player";
    section.dataset.player = String(index);
    section.hidden = index >= players;
    section.innerHTML = `<header><strong>P${index + 1}</strong><span id="scoreP${index + 1}">${scores[index]}</span></header><div class="vector-buttons"><button type="button" data-choice="left" aria-label="P${index + 1} LEFT">←</button><button type="button" data-choice="center" aria-label="P${index + 1} CENTER">●</button><button type="button" data-choice="right" aria-label="P${index + 1} RIGHT">→</button></div><small>${state === "playing" ? "CHOOSE" : "READY"}</small>`;
    playerGrid.appendChild(section);
  }
}

function renderHeader() {
  playerCountValue.textContent = String(players);
  roundValue.textContent = `${round} / ${TOTAL_ROUNDS}`;
  lockedValue.textContent = `${choices.filter(Boolean).length} / ${players}`;
  scores.forEach((score, index) => {
    const node = $(`#scoreP${index + 1}`);
    if (node) node.textContent = String(score);
  });
}

function setRoundRule() {
  const rule = getVectorRoundRule(round);
  ruleValue.textContent = rule.label;
  ruleTitle.textContent = rule.label;
  ruleDescription.textContent = rule.description;
  document.body.dataset.vectorRule = rule.id;
  void music.state(rule.musicState, { quantize: "beat", fadeBeats: 1 });
  void music.transitionCue(rule.transitionCue, { quantize: "beat" });
  setMessage(rule.label, rule.description, `ROUND ${round} / ${TOTAL_ROUNDS}`);
  return rule;
}

function clearRoundVisuals() {
  [...playerGrid.querySelectorAll(".vector-player")].forEach((card) => {
    card.classList.remove("is-locked", "is-revealed", "is-scored");
    card.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
      button.classList.remove("is-selected");
    });
    const status = card.querySelector("small");
    if (status) status.textContent = "CHOOSE";
  });
}

function startRound() {
  if (round >= TOTAL_ROUNDS) {
    finishGame();
    return;
  }
  round += 1;
  choices = Array(players).fill(null);
  clearRoundVisuals();
  setRoundRule();
  renderHeader();
}

function revealRound() {
  if (state !== "playing" || choices.some((choice) => !choice)) return;
  const rule = getVectorRoundRule(round);
  const outcome = resolveVectorRound({ choices, rule });
  state = "revealing";
  outcome.awards.forEach((points, index) => { scores[index] += points; });

  [...playerGrid.querySelectorAll(".vector-player")].slice(0, players).forEach((card, index) => {
    card.classList.add("is-revealed");
    if (outcome.awards[index] > 0) card.classList.add("is-scored");
    card.querySelector(`[data-choice="${choices[index]}"]`)?.classList.add("is-selected");
    const status = card.querySelector("small");
    if (status) status.textContent = `${directionLabel(choices[index])} · +${outcome.awards[index]}`;
  });

  renderHeader();
  const earned = outcome.awards.reduce((sum, value) => sum + value, 0);
  setMessage(earned ? "PACT REVEALED" : "NO SCORE", rule.id === "match" ? "同じ方向を選んだプレイヤーが得点。" : "単独方向を選んだプレイヤーが得点。", rule.label);
  music.cue(earned ? "hit" : "miss");

  clearTimeout(revealTimer);
  revealTimer = window.setTimeout(() => {
    state = "playing";
    startRound();
  }, ROUND_REVEAL_MS);
}

function choose(playerIndex, direction) {
  if (state !== "playing" || playerIndex >= players || choices[playerIndex]) return;
  choices[playerIndex] = direction;
  const card = playerGrid.querySelector(`[data-player="${playerIndex}"]`);
  card?.classList.add("is-locked");
  card?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  const status = card?.querySelector("small");
  if (status) status.textContent = "LOCKED";
  lockedValue.textContent = `${choices.filter(Boolean).length} / ${players}`;
  if (choices.every(Boolean)) revealRound();
}

function resetGame() {
  clearTimeout(revealTimer);
  revealTimer = null;
  music.stop();
  state = "ready";
  players = Number(playerCount.value);
  round = 0;
  scores = [0, 0, 0, 0];
  choices = [];
  resultOverlay.hidden = true;
  playerCount.disabled = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
  ruleValue.textContent = "READY";
  ruleTitle.textContent = "MATCH / SPLIT";
  ruleDescription.textContent = "全員が方向を選ぶまで内容は伏せられます。";
  delete document.body.dataset.vectorRule;
  renderPlayers();
  renderHeader();
  setMessage("合わせるか、外すか。", "LEFT / CENTER / RIGHTを読み合う同時選択ゲーム。", "READ THE TABLE");
}

async function startGame() {
  resetGame();
  await music.start("normal");
  state = "playing";
  playerCount.disabled = true;
  startButton.disabled = true;
  startButton.textContent = "プレイ中";
  renderPlayers();
  startRound();
}

function finishGame() {
  state = "result";
  choices = [];
  clearTimeout(revealTimer);
  void music.state("result", { quantize: "bar", fadeBeats: 1 });
  const activeScores = scores.slice(0, players);
  const best = Math.max(...activeScores);
  const winners = activeScores.map((score, index) => score === best ? index : -1).filter((index) => index >= 0);
  void music.outcome(winners.length === 1, { quantize: "bar" });
  resultTitle.textContent = winners.length === 1 ? `P${winners[0] + 1} WINS!` : "PACT DRAW";
  resultMessage.textContent = winners.length === 1 ? `8ラウンド合計 ${best}点` : `同点 ${best}点 · ${winners.map((index) => `P${index + 1}`).join(" / ")}`;
  resultScores.innerHTML = activeScores.map((score, index) => `<div class="vector-result-row"><strong>P${index + 1}</strong><span>${score} pts</span></div>`).join("");
  resultOverlay.hidden = false;
  playerCount.disabled = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
}

playerGrid.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("button[data-choice]");
  const card = event.target.closest(".vector-player");
  if (!button || !card) return;
  event.preventDefault();
  choose(Number(card.dataset.player), button.dataset.choice);
});

playerCount.addEventListener("change", () => {
  if (state !== "ready") return;
  players = Number(playerCount.value);
  renderPlayers();
  renderHeader();
});
startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
resetGame();
