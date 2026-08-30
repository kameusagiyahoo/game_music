import { createMusicFacade } from "../../src/music-facade.js";
import {
  createQaSession,
  addQaSample,
  finalizeQaSession,
  qaReportToCsv,
  qaReportFilename,
} from "../../src/music-qa-report.js";

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
const recordStatus = $("#recordStatus");
const recordTimer = $("#recordTimer");
const recordProgressBar = $("#recordProgressBar");
const recordButton = $("#recordButton");
const recordStopButton = $("#recordStopButton");
const exportJsonButton = $("#exportJsonButton");
const exportCsvButton = $("#exportCsvButton");
const reportVerdict = $("#reportVerdict");
const reportDuration = $("#reportDuration");
const reportSamples = $("#reportSamples");
const reportCoverage = $("#reportCoverage");
const reportPeak = $("#reportPeak");
const reportRms = $("#reportRms");
const reportReduction = $("#reportReduction");
const reportOver3 = $("#reportOver3");
const reportOver6 = $("#reportOver6");
const modeSummary = $("#modeSummary");
const canvas = $("#historyCanvas");
const ctx = canvas.getContext("2d");

let bar = 0;
let beat = 0;
let lastRenderAt = 0;
const peakHistory = [];
const reductionHistory = [];
const HISTORY_POINTS = 200;
const RECORD_DURATION_SECONDS = 60;
const RECORD_SAMPLE_INTERVAL_MS = 100;
let recordingSession = null;
let lastReport = null;
let lastRecordSampleAt = 0;

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

function formatTimeMs(value) {
  const total = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function renderReportSummary() {
  const summary = lastReport?.summary;
  const recording = Boolean(recordingSession);
  const now = Date.now();
  const elapsedMs = recording
    ? Math.max(0, now - recordingSession.startedAtMs)
    : Math.max(0, Number(summary?.durationSeconds || 0) * 1000);
  const targetMs = RECORD_DURATION_SECONDS * 1000;
  const progress = recording
    ? Math.min(100, elapsedMs / targetMs * 100)
    : lastReport ? 100 : 0;

  recordTimer.textContent = `${formatTimeMs(elapsedMs)} / ${formatTimeMs(targetMs)}`;
  recordProgressBar.style.width = `${progress}%`;
  recordButton.disabled = recording;
  recordButton.classList.toggle("is-recording", recording);
  recordButton.textContent = recording ? "RECORDING…" : "RECORD 60s";
  recordStopButton.disabled = !recording;
  exportJsonButton.disabled = !lastReport;
  exportCsvButton.disabled = !lastReport;

  if (recording) {
    recordStatus.textContent = `RECORDING · ${recordingSession.samples.length} SAMPLES`;
  } else if (lastReport) {
    recordStatus.textContent = `REPORT READY · ${lastReport.events.length} EVENTS`;
  } else {
    recordStatus.textContent = "READY · START AUDIO OR RECORD";
  }

  if (!summary) {
    reportVerdict.textContent = "—";
    reportVerdict.className = "";
    reportDuration.textContent = "—";
    reportSamples.textContent = "—";
    reportCoverage.textContent = "—";
    reportPeak.textContent = "—";
    reportRms.textContent = "—";
    reportReduction.textContent = "—";
    reportOver3.textContent = "—";
    reportOver6.textContent = "—";
    modeSummary.innerHTML = "";
    return;
  }

  reportVerdict.textContent = String(summary.verdict || "—").toUpperCase();
  reportVerdict.className = String(summary.verdict || "");
  reportDuration.textContent = `${Number(summary.durationSeconds || 0).toFixed(1)} s`;
  reportSamples.textContent = String(summary.sampleCount || 0);
  reportCoverage.textContent = `${Number(summary.samplingCoveragePercent || 0).toFixed(0)}%`;
  reportPeak.textContent = formatDb(summary.maxOutputPeakDbfs);
  reportRms.textContent = formatDb(summary.averageOutputRmsDbfs);
  reportReduction.textContent = `${Number(summary.maxLimiterReductionMagnitudeDb || 0).toFixed(1)} dB`;
  reportOver3.textContent = `${Number(summary.limiterOver3Seconds || 0).toFixed(1)} s`;
  reportOver6.textContent = `${Number(summary.limiterOver6Seconds || 0).toFixed(1)} s`;

  modeSummary.innerHTML = Object.entries(summary.modes || {}).map(([mode, value]) => `
    <div class="mode-report-row">
      <strong>${mode}</strong>
      <span>${Number(value.durationSeconds || 0).toFixed(1)}s</span>
      <span>RMS ${Number(value.averageOutputRmsDbfs || -180).toFixed(1)}</span>
      <span>PK ${Number(value.maxOutputPeakDbfs || -180).toFixed(1)}</span>
      <span>GR ${Number(value.maxLimiterReductionMagnitudeDb || 0).toFixed(1)}</span>
    </div>
  `).join("");
}

function finishRecording(endedAtMs = Date.now()) {
  if (!recordingSession) return null;
  lastReport = finalizeQaSession(recordingSession, { endedAtMs });
  recordingSession = null;
  lastRecordSampleAt = 0;
  renderReportSummary();
  return lastReport;
}

async function startRecording() {
  if (recordingSession) return;

  if (!music.running) {
    qaBadge.textContent = "STARTING";
    await music.start("normal");
  }

  const info = refreshStaticInfo();
  const meter = music.meter();
  const now = Date.now();

  lastReport = null;
  recordingSession = createQaSession({
    startedAtMs: now,
    targetDurationSeconds: RECORD_DURATION_SECONDS,
    sampleIntervalMs: RECORD_SAMPLE_INTERVAL_MS,
    metadata: {
      packId: info.packId || info.id || "pulse",
      packName: info.packName || info.name || "Pulse",
      packVersion: info.version || null,
      engine: info.engine || null,
      audioFormat: info.audioFormat || null,
      masteringProfile: info.masteringProfile || info.mastering?.profile || null,
      facadeApi: info.facadeApi || null,
      initialSampleRate: meter?.sampleRate || null,
      userAgent: navigator.userAgent,
      platform: navigator.platform || null,
    },
  });

  addQaSample(recordingSession, meter, {
    capturedAtMs: now,
    bar,
    beat,
  });
  lastRecordSampleAt = now;
  renderReportSummary();
}

function captureRecorderSample(meter) {
  if (!recordingSession) return;

  const now = Date.now();
  if (now - lastRecordSampleAt < 80) return;

  addQaSample(recordingSession, meter, {
    capturedAtMs: now,
    bar,
    beat,
  });
  lastRecordSampleAt = now;

  const targetMs = recordingSession.targetDurationSeconds * 1000;
  if (now - recordingSession.startedAtMs >= targetMs) {
    finishRecording(now);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function exportReport(format) {
  if (!lastReport) return;

  const json = format === "json";
  const contents = json
    ? JSON.stringify(lastReport, null, 2)
    : qaReportToCsv(lastReport);
  const mime = json ? "application/json" : "text/csv";
  const filename = qaReportFilename(lastReport, format);
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });

  if (typeof File === "function" && typeof navigator.share === "function") {
    const file = new File([blob], filename, { type: mime });
    const shareData = {
      title: "Game Music QA Report",
      text: `${lastReport.metadata?.packName || "Music"} · ${lastReport.summary?.verdict || "qa"}`,
      files: [file],
    };

    try {
      if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("QA report share failed; using download fallback", error);
    }
  }

  downloadBlob(blob, filename);
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
  captureRecorderSample(meter);
  renderReportSummary();

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
  if (recordingSession) finishRecording();
  music.stop();
  refreshStaticInfo();
  render();
});

recordButton.addEventListener("click", () => {
  void startRecording().catch((error) => {
    console.error(error);
    recordStatus.textContent = `RECORD ERROR · ${error.message}`;
  });
});
recordStopButton.addEventListener("click", () => finishRecording());
exportJsonButton.addEventListener("click", () => void exportReport("json"));
exportCsvButton.addEventListener("click", () => void exportReport("csv"));

void music.preload({ stingers: true, transitions: true }).catch((error) => {
  console.warn("QA preload failed; START will retry", error);
});

renderReportSummary();
render();
requestAnimationFrame(animationFrame);
