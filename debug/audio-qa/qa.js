import { createMusicFacade } from "../../src/music-facade.js";

const $ = (selector) => document.querySelector(selector);
const qaBadge = $("#qaBadge");
const transport = $("#transport");
const formatLine = $("#formatLine");
const prePeakValue = $("#prePeakValue");
const preRmsValue = $("#preRmsValue");
const outPeakValue = $("#outPeakValue");
const outRmsValue = $("#outRmsValue");
const prePeakBar = $("#prePeakBar");
const outPeakBar = $("#outPeakBar");
const reductionValue = $("#reductionValue");
const reductionBar = $("#reductionBar");
const thresholdValue = $("#thresholdValue");
const masterProfile = $("#masterProfile");
const headroomValue = $("#headroomValue");
const sampleRateValue = $("#sampleRateValue");
const contextValue = $("#contextValue");
const stemList = $("#stemList");
const presetValue = $("#presetValue");
const stingerValue = $("#stingerValue");
const transitionValue = $("#transitionValue");
const modeValue = $("#modeValue");
const meterSupportValue = $("#meterSupportValue");
const canvas = $("#historyCanvas");
const ctx = canvas.getContext("2d");

let bar = 0;
let beat = 0;
let lastRenderAt = 0;
const peakHistory = [];
const reductionHistory = [];
const HISTORY_POINTS = 200;

const music = createMusicFacade({
  packId: "pulse",
  callbacks: {
    onSync(info = {}) {
      bar = Number(info.bar || 0);
      beat = Number(info.beat || 0);
    },
  },
});

let staticInfo = music.info();

function refreshStaticInfo() {
  staticInfo = music.info();
  return staticInfo;
}

function formatDb(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > -150 ? `${number.toFixed(1)} dBFS` : "— dBFS";
}

function dbWidth(value, min = -60, max = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, ((number - min) / (max - min)) * 100));
}

function eventLabel(event) {
  if (!event?.name) return "NONE";
  if (event.pending) return `${event.name.toUpperCase()} · PENDING`;
  if (event.playing) return `${event.name.toUpperCase()} · PLAYING`;
  return event.name.toUpperCase();
}

function qaState(meter) {
  if (!meter?.supported) return ["NO METER", "idle"];
  if (!music.running) return ["IDLE", "idle"];

  const reduction = Math.min(0, Number(meter.limiterReductionDb || 0));
  const prePeak = Number(meter.preLimiter?.peakDbfs ?? -180);
  const outPeak = Number(meter.output?.peakDbfs ?? -180);

  if (outPeak > -0.15) return ["CLIP RISK", "hot"];
  if (reduction <= -6) return ["LIMITER HEAVY", "hot"];
  if (prePeak > 3 || reduction <= -3) return ["WATCH", "watch"];
  return ["SAFE", "safe"];
}

function renderStems(stems = {}) {
  stemList.innerHTML = Object.entries(stems).map(([name, state]) => {
    const gain = Number(state?.gain || 0);
    return `
      <div class="stem-row ${state?.active ? "active" : ""}">
        <strong>${name}</strong>
        <div class="stem-track"><div class="stem-fill" style="width:${Math.round(gain * 100)}%"></div></div>
        <span>${Math.round(gain * 100)}%</span>
      </div>
    `;
  }).join("");
}

function pushHistory(peak, reduction) {
  peakHistory.push(Number.isFinite(peak) ? peak : -60);
  reductionHistory.push(Number.isFinite(reduction) ? reduction : 0);
  if (peakHistory.length > HISTORY_POINTS) peakHistory.shift();
  if (reductionHistory.length > HISTORY_POINTS) reductionHistory.shift();
}

function drawHistory() {
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(160,170,185,.18)";
  ctx.lineWidth = 1;
  [-48, -36, -24, -12, 0].forEach((db) => {
    const y = height - ((db + 60) / 60) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });

  const drawLine = (values, mapY, alpha, widthPx) => {
    if (values.length < 2) return;
    ctx.strokeStyle = `rgba(224,229,237,${alpha})`;
    ctx.lineWidth = widthPx;
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = (index / Math.max(1, HISTORY_POINTS - 1)) * width;
      const y = mapY(value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  drawLine(
    peakHistory,
    (value) => height - (Math.max(-60, Math.min(0, value)) + 60) / 60 * height,
    .95,
    2.2,
  );
  drawLine(
    reductionHistory,
    (value) => height - Math.max(0, Math.min(12, -value)) / 12 * height,
    .45,
    1.5,
  );
}

function render() {
  const info = staticInfo;
  const meter = music.meter();
  const mastering = info.mastering;

  transport.textContent = music.running ? `BAR ${bar || 1} · BEAT ${beat || 1}` : "BAR — · BEAT —";
  formatLine.textContent = `${info.name || "Pulse"} · ${String(info.audioFormat || "audio").toUpperCase()}`;

  const [label, className] = qaState(meter);
  qaBadge.textContent = label;
  qaBadge.className = `qa-badge ${className}`;

  prePeakValue.textContent = formatDb(meter?.preLimiter?.peakDbfs);
  preRmsValue.textContent = formatDb(meter?.preLimiter?.rmsDbfs);
  outPeakValue.textContent = formatDb(meter?.output?.peakDbfs);
  outRmsValue.textContent = formatDb(meter?.output?.rmsDbfs);
  prePeakBar.style.width = `${dbWidth(meter?.preLimiter?.peakDbfs, -60, 6)}%`;
  outPeakBar.style.width = `${dbWidth(meter?.output?.peakDbfs)}%`;

  const reduction = Math.min(0, Number(meter?.limiterReductionDb || 0));
  reductionValue.textContent = `${reduction.toFixed(1)} dB`;
  reductionBar.style.width = `${Math.min(100, Math.abs(reduction) / 12 * 100)}%`;
  thresholdValue.textContent = `${Number(mastering?.limiter?.thresholdDb ?? -1.5).toFixed(1)} dB`;

  masterProfile.textContent = String(mastering?.profile || "—");
  headroomValue.textContent = `${Number(mastering?.headroomDb ?? 0).toFixed(1)} dB`;
  sampleRateValue.textContent = meter?.sampleRate ? `${(meter.sampleRate / 1000).toFixed(1)} kHz` : "—";
  contextValue.textContent = String(meter?.contextState || "—").toUpperCase();

  presetValue.textContent = String(meter?.layerPreset || "—").toUpperCase();
  modeValue.textContent = String(meter?.mode || "—").toUpperCase();
  stingerValue.textContent = eventLabel(meter?.stinger);
  transitionValue.textContent = eventLabel(meter?.transitionCue);
  meterSupportValue.textContent = meter?.supported ? "ACTIVE · 10 FPS UI" : "UNAVAILABLE";
  renderStems(meter?.stems || {});

  pushHistory(Number(meter?.output?.peakDbfs ?? -60), reduction);
  drawHistory();
}

function animationFrame(time) {
  if (time - lastRenderAt >= 100) {
    lastRenderAt = time;
    render();
  }
  requestAnimationFrame(animationFrame);
}

$("#startButton").addEventListener("click", async () => {
  qaBadge.textContent = "STARTING";
  await music.start("normal");
  refreshStaticInfo();
  render();
});

$("#normalButton").addEventListener("click", async () => {
  if (!music.running) return;
  await music.state("normal", { quantize: "bar" });
});

$("#overdriveButton").addEventListener("click", async () => {
  if (!music.running) return;
  await music.state("tension", { quantize: "bar" });
});

$("#stressButton").addEventListener("click", async () => {
  if (!music.running) return;
  await music.state("result", { quantize: "bar" });
  await music.outcome(true, { quantize: "bar" });
});

$("#stopButton").addEventListener("click", () => {
  music.stop();
  refreshStaticInfo();
  render();
});

void music.preload({ stingers: true, transitions: true }).catch((error) => {
  console.warn("QA preload failed; START will retry", error);
});

render();
requestAnimationFrame(animationFrame);
