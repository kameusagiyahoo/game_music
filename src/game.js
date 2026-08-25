import { MusicManager } from "./music-manager.js";

const ICONS = ["☀", "☾", "✦", "❖", "♜", "⚚"];
const GAME_TIME = 45;
const TENSION_TIME = 10;

const board = document.querySelector("#board");
const startButton = document.querySelector("#startButton");
const retryButton = document.querySelector("#retryButton");
const soundButton = document.querySelector("#soundButton");
const resultOverlay = document.querySelector("#resultOverlay");

const timeValue = document.querySelector("#timeValue");
const movesValue = document.querySelector("#movesValue");
const pairsValue = document.querySelector("#pairsValue");
const bestValue = document.querySelector("#bestValue");
const gameMessage = document.querySelector("#gameMessage");
const hintText = document.querySelector("#hintText");
const musicState = document.querySelector("#musicState");

const resultTitle = document.querySelector("#resultTitle");
const resultMessage = document.querySelector("#resultMessage");
const scoreValue = document.querySelector("#scoreValue");
const resultTime = document.querySelector("#resultTime");
const resultMoves = document.querySelector("#resultMoves");

let state = "ready";
let deck = [];
let firstCard = null;
let secondCard = null;
let lockBoard = false;
let moves = 0;
let pairs = 0;
let remaining = GAME_TIME;
let startedAt = 0;
let timerId = null;
let soundEnabled = true;

const music = new MusicManager({
  onModeChange(label) {
    if (musicState) musicState.textContent = label;
  },
});

const best = Number(localStorage.getItem("mystic-match-best") || 0);
bestValue.textContent = best ? best.toLocaleString("ja-JP") : "—";

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderBoard() {
  board.innerHTML = "";
  deck.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = "card";
    button.type = "button";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `カード ${index + 1}`);
    button.innerHTML = `
      <span class="card-inner">
        <span class="card-face card-back" aria-hidden="true"></span>
        <span class="card-face card-front" aria-hidden="true">${item.icon}</span>
      </span>
    `;
    button.addEventListener("click", () => flipCard(button));
    board.appendChild(button);
  });
}

function setMessage(title, body, kicker = "MEMORY GAME") {
  gameMessage.innerHTML = `
    <span class="message-kicker">${kicker}</span>
    <strong>${title}</strong>
    <span>${body}</span>
  `;
}

function updateStatus() {
  timeValue.textContent = remaining.toFixed(1);
  movesValue.textContent = String(moves);
  pairsValue.textContent = String(pairs);
}

function resetGame() {
  clearInterval(timerId);
  music.stop();
  state = "ready";
  document.body.classList.remove("is-tension");
  resultOverlay.hidden = true;
  firstCard = null;
  secondCard = null;
  lockBoard = false;
  moves = 0;
  pairs = 0;
  remaining = GAME_TIME;
  deck = shuffle(ICONS.flatMap((icon) => [{ icon, matched: false }, { icon, matched: false }]));
  renderBoard();
  updateStatus();
  setMessage("同じ紋章を見つけよう", "45秒以内に6組すべて揃えればクリア。");
  hintText.textContent = "カードの位置を覚えて、できるだけ少ない手数で揃えよう。";
  startButton.textContent = "ゲーム開始";
  startButton.disabled = false;
}

async function startGame() {
  resetGame();
  await music.play("normal");
  state = "playing";
  startedAt = performance.now();
  startButton.disabled = true;
  startButton.textContent = "プレイ中";
  setMessage("記憶を頼りに揃えよう", "2枚めくると判定されます。", "PLAYING");

  timerId = window.setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    remaining = Math.max(0, GAME_TIME - elapsed);

    if (remaining <= TENSION_TIME && state === "playing") {
      state = "tension";
      document.body.classList.add("is-tension");
      setMessage("残り10秒", "BGMも加速。ここからが勝負。", "TENSION");
      music.setMode("tension");
    }

    if (remaining <= 0) {
      remaining = 0;
      updateStatus();
      endGame(false);
      return;
    }

    updateStatus();
  }, 50);
}

function flipCard(card) {
  if (!["playing", "tension"].includes(state) || lockBoard) return;
  const index = Number(card.dataset.index);
  const item = deck[index];
  if (item.matched || card === firstCard || card.classList.contains("is-flipped")) return;

  card.classList.add("is-flipped");
  music.sfx("flip");

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  moves += 1;
  movesValue.textContent = String(moves);
  lockBoard = true;

  const firstIndex = Number(firstCard.dataset.index);
  const secondIndex = Number(secondCard.dataset.index);

  if (deck[firstIndex].icon === deck[secondIndex].icon) {
    deck[firstIndex].matched = true;
    deck[secondIndex].matched = true;
    firstCard.classList.add("is-matched");
    secondCard.classList.add("is-matched");
    firstCard.disabled = true;
    secondCard.disabled = true;
    pairs += 1;
    pairsValue.textContent = String(pairs);
    music.sfx("match");

    firstCard = null;
    secondCard = null;
    lockBoard = false;

    if (pairs === ICONS.length) endGame(true);
    return;
  }

  music.sfx("miss");
  window.setTimeout(() => {
    firstCard?.classList.remove("is-flipped");
    secondCard?.classList.remove("is-flipped");
    firstCard = null;
    secondCard = null;
    lockBoard = false;
  }, 650);
}

function calculateScore(clear) {
  if (!clear) return pairs * 100;
  const timeBonus = Math.round(remaining * 30);
  const moveBonus = Math.max(0, 900 - Math.max(0, moves - 6) * 55);
  return 1000 + timeBonus + moveBonus;
}

function endGame(clear) {
  if (state === "result") return;
  clearInterval(timerId);
  state = "result";
  document.body.classList.remove("is-tension");
  lockBoard = true;
  music.setMode("result");

  const score = calculateScore(clear);
  const elapsed = Math.min(GAME_TIME, (performance.now() - startedAt) / 1000);
  const previousBest = Number(localStorage.getItem("mystic-match-best") || 0);

  if (score > previousBest) {
    localStorage.setItem("mystic-match-best", String(score));
    bestValue.textContent = score.toLocaleString("ja-JP");
  }

  resultTitle.textContent = clear ? "CLEAR!" : "TIME UP";
  resultMessage.textContent = clear
    ? (score > previousBest ? "ベストスコア更新。記憶と判断の精度が上がっています。" : "6組すべて揃いました。さらに少ない手数を狙えます。")
    : `${pairs}組まで揃いました。位置を覚えて再挑戦しよう。`;
  scoreValue.textContent = score.toLocaleString("ja-JP");
  resultTime.textContent = `${elapsed.toFixed(1)}s`;
  resultMoves.textContent = String(moves);
  resultOverlay.hidden = false;
  startButton.disabled = false;
  startButton.textContent = "ゲーム開始";
  music.sfx(clear ? "win" : "lose");
}

soundButton.addEventListener("click", async () => {
  soundEnabled = !soundEnabled;
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
  soundButton.textContent = soundEnabled ? "♪" : "×";
  await music.setEnabled(soundEnabled);
  if (soundEnabled) music.sfx("toggle");
});

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);

resetGame();
