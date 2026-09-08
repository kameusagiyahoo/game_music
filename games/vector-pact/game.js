import { createMusicFacade } from "../../src/music-facade.js";
import { bindGameAudioControls } from "../../src/game-audio-controls.js";
import { GAME_IDS, getMusicSettings } from "../../src/music-registry.js";
import { VECTOR_DIRECTIONS, getVectorRoundRule, resolveVectorRound } from "./vector-engine.js";

const MAX_ROUNDS = 8;
const $ = (selector) => document.querySelector(selector);
const playerGrid = $("#playerGrid");
const playerCount = $("#playerCount");
const playerCountValue = $("#playerCountValue");
const roundValue = $("#roundValue");
const ruleValue = $("#ruleValue");
const ruleTitle = $("#ruleTitle");
const ruleDescription = $("#ruleDescription");
const stateValue = $("#stateValue");
const gameMessage = $("#gameMessage");
const startButton = $("#startButton");
const retryButton = $("#retryButton");
const resultOverlay = $("#resultOverlay");
const resultTitle = $("#resultTitle");
const resultScores = $("#resultScores");
const soundButton = $("#soundButton");
const musicState = $("#musicState");
const bgmToggle = $("#bgmToggle");
const sfxToggle = $("#sfxToggle");
const bgmVolume = $("#bgmVolume");
const sfxVolume = $("#sfxVolume");
const bgmVolumeValue = $("#bgmVolumeValue");
const sfxVolumeValue = $("#sfxVolumeValue");

let players = 2;
let round = 1;
let state = "ready";
let choices = [];
let scores = [];

const settings = getMusicSettings();
const music = createMusicFacade({
  gameId: GAME_IDS.VECTOR_PACT,
  callbacks: { onModeChange(label) { musicState.textContent = label; } },
  settings,
});

bindGameAudioControls({ getMusic: () => music, soundButton, bgmToggle, sfxToggle, bgmVolume, sfxVolume, bgmVolumeValue, sfxVolumeValue, settings });
void music.preload({ stingers: true, transitions: true }).catch(() => {});

function setMessage(title, body, kicker = "VECTOR PACT") {
  gameMessage.innerHTML = `<span class="message-kicker">${kicker}</span><strong>${title}</strong><span>${body}</span>`;
}

function currentRule() { return getVectorRoundRule(round); }

function renderRule() {
  const rule = currentRule();
  roundValue.textContent = String(round);
  ruleValue.textContent = rule.label;
  ruleTitle.textContent = rule.label;
  ruleDescription.textContent = rule.description;
}

function renderPlayers({ reveal = false, winners = [] } = {}) {
  playerGrid.innerHTML = "";
  for (let index = 0; index < players; index += 1) {
    const card = document.createElement("section");
    card.className = "vector-player";
    if (choices[index]) card.classList.add("is-locked");
    if (winners.includes(index)) card.classList.add("is-winner");
    const revealed = reveal && choices[index] ? choices[index].toUpperCase() : choices[index] ? "LOCKED" : "THINKING";
    card.innerHTML = `<div class="vector-player-head"><strong>P${index + 1}</strong><span>${revealed}</span></div><div class="vector-options"></div>`;
    const options = card.querySelector(".vector-options");
    VECTOR_DIRECTIONS.forEach((direction) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vector-option";
      button.textContent = direction.toUpperCase();
      button.disabled = state !== "choosing" || Boolean(choices[index]);
      if (reveal && choices[index] === direction) button.classList.add("is-selected");
      button.addEventListener("click", () => choose(index, direction));
      options.appendChild(button);
    });
    playerGrid.appendChild(card);
  }
}

function choose(index, direction) {
  if (state !== "choosing" || choices[index]) return;
  choices[index] = direction;
  music.cue("hit");
  renderPlayers();
  if (choices.every(Boolean)) resolveRound();
}

function resolveRound() {
  state = "reveal";
  stateValue.textContent = "REVEAL";
  const rule = currentRule();
  const result = resolveVectorRound({ choices, rule });
  result.awards.forEach((points, index) => { scores[index] += points; });
  renderPlayers({ reveal: true, winners: result.winners });
  const winnersText = result.winners.length ? result.winners.map((i) => `P${i + 1}`).join(" + ") : "NO ONE";
  setMessage(`${winnersText} SCORE`, result.awards.map((points, i) => `P${i + 1} +${points}`).join(" · "), rule.label);
  music.cue(result.winners.length ? "hit" : "miss");
  if (round >= MAX_ROUNDS) {
    window.setTimeout(endGame, 900);
    return;
  }
  window.setTimeout(() => {
    round += 1;
    choices = Array(players).fill(null);
    state = "choosing";
    stateValue.textContent = "CHOOSE";
    renderRule();
    const nextRule = currentRule();
    void music.state(nextRule.musicState, { quantize: "bar", fadeBeats: 1 });
    void music.transitionCue(nextRule.transitionCue, { quantize: "beat" });
    setMessage(nextRule.label, nextRule.description, `ROUND ${round}`);
    renderPlayers();
  }, 1050);
}

function endGame() {
  state = "result";
  stateValue.textContent = "RESULT";
  const max = Math.max(...scores);
  const winners = scores.map((score, index) => score === max ? index : -1).filter((index) => index >= 0);
  resultTitle.textContent = winners.length === 1 ? `P${winners[0] + 1} WINS!` : "PACT DRAW";
  resultScores.innerHTML = scores.map((score, index) => `<div class="vector-result-row"><strong>P${index + 1}</strong><small>${winners.includes(index) ? "WINNER" : "FINAL"}</small><span>${score} pt</span></div>`).join("");
  resultOverlay.hidden = false;
  playerCount.disabled = false;
  startButton.disabled = false;
  void music.state("result", { quantize: "bar", fadeBeats: 1 });
  void music.outcome(winners.length === 1, { quantize: "bar" });
}

async function startGame() {
  players = Number(playerCount.value);
  round = 1;
  scores = Array(players).fill(0);
  choices = Array(players).fill(null);
  state = "choosing";
  resultOverlay.hidden = true;
  playerCount.disabled = true;
  startButton.disabled = true;
  playerCountValue.textContent = String(players);
  stateValue.textContent = "CHOOSE";
  renderRule();
  renderPlayers();
  const rule = currentRule();
  setMessage(rule.label, rule.description, "ROUND 1");
  await music.start(rule.musicState);
}

playerCount.addEventListener("change", () => {
  if (state !== "ready") return;
  players = Number(playerCount.value);
  playerCountValue.textContent = String(players);
  choices = Array(players).fill(null);
  scores = Array(players).fill(0);
  renderPlayers();
});
startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
players = Number(playerCount.value);
choices = Array(players).fill(null);
scores = Array(players).fill(0);
renderRule();
renderPlayers();
