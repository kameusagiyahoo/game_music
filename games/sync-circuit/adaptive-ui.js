import { getAdaptiveDifficultySnapshot } from "./coop-mechanics.js";

const difficultyValue = document.querySelector("#difficultyValue");
const difficultyDescription = document.querySelector("#difficultyDescription");
const difficultyWindow = document.querySelector("#difficultyWindow");
const difficultyFlash = document.querySelector("#difficultyFlash");
const difficultyFlashValue = document.querySelector("#difficultyFlashValue");

const DESCRIPTIONS = Object.freeze({
  assist: "チームが苦戦中 · 受付時間を広げています",
  balanced: "標準タイミングでチームの状態を計測中",
  intense: "チームが安定 · 受付時間を絞っています",
});

let lastProfile = null;
let flashTimer = null;

function renderDifficulty(snapshot, { animate = true } = {}) {
  if (!snapshot || !difficultyValue) return;

  const changed = lastProfile !== null && lastProfile !== snapshot.profile;
  difficultyValue.textContent = snapshot.label;
  if (difficultyDescription) {
    difficultyDescription.textContent = DESCRIPTIONS[snapshot.profile] ?? DESCRIPTIONS.balanced;
  }
  if (difficultyWindow) {
    difficultyWindow.textContent = `WINDOW ×${snapshot.windowScale.toFixed(2)}`;
  }

  document.body.dataset.adaptiveDifficulty = snapshot.profile;

  if (changed && animate && difficultyFlash && difficultyFlashValue) {
    difficultyFlashValue.textContent = snapshot.label;
    difficultyFlash.hidden = false;
    difficultyFlash.classList.remove("is-visible");
    void difficultyFlash.offsetWidth;
    difficultyFlash.classList.add("is-visible");

    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      difficultyFlash.classList.remove("is-visible");
      window.setTimeout(() => {
        difficultyFlash.hidden = true;
      }, 180);
    }, 900);
  }

  lastProfile = snapshot.profile;
}

renderDifficulty(getAdaptiveDifficultySnapshot(), { animate: false });

window.setInterval(() => {
  renderDifficulty(getAdaptiveDifficultySnapshot());
}, 100);

export { renderDifficulty };
