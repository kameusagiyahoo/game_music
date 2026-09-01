import { createMusicFacade, preloadMusicAssets } from "../../src/music-facade.js";
import {
  createQaSession,
  addQaSample,
  finalizeQaSession,
  qaReportToCsv,
  qaReportFilename,
} from "../../src/music-qa-report.js";
import {
  validateQaReport,
  compareQaReports,
  qaComparisonToCsv,
  qaComparisonFilename,
} from "../../src/music-qa-compare.js";
import {
  getQaBaselineEligibility,
  getQaBaselineCompatibility,
  saveQaPackBaseline,
  loadQaPackBaseline,
  deleteQaPackBaseline,
} from "../../src/music-qa-baseline-registry.js";
import {
  STANDARD_QA_SCENARIO as BASE_QA_SCENARIO,
  createQaScenarioRun,
  advanceQaScenarioRun,
  cancelQaScenarioRun,
  getQaScenarioProgress,
  executeQaScenarioStep,
  qaScenarioExecutionSummary,
} from "../../src/music-qa-scenario.js";
import {
  HOT_SWAP_ROUTE_MATRIX_PACKS,
  createHotSwapRouteMatrixScenario,
  hotSwapRouteMatrixExecutionSummary,
  evaluateHotSwapRouteMatrixReport,
} from "../../src/music-qa-route-matrix.js";
import {
  getQaRouteMatrixBaselineEligibility,
  getQaRouteMatrixBaselineCompatibility,
  saveQaRouteMatrixBaseline,
  listQaRouteMatrixBaselines,
  loadQaRouteMatrixBaseline,
  loadLatestQaRouteMatrixBaseline,
  clearQaRouteMatrixBaselines,
} from "../../src/music-qa-route-baseline-registry.js";
import { getMusicPackEntry } from "../../src/music-registry.js";

const $ = (selector) => document.querySelector(selector);
const qaBadge = $("#qaBadge");
const qaPackSelect = $("#qaPackSelect");
const qaPackDescription = $("#qaPackDescription");
const hotSwapTargetSelect = $("#hotSwapTargetSelect");
const hotSwapCurveSelect = $("#hotSwapCurveSelect");
const scheduleHotSwapButton = $("#scheduleHotSwapButton");
const cancelHotSwapButton = $("#cancelHotSwapButton");
const hotSwapStatus = $("#hotSwapStatus");
const hotSwapRoute = $("#hotSwapRoute");
const hotSwapProgressValue = $("#hotSwapProgressValue");
const hotSwapProgressBar = $("#hotSwapProgressBar");
const hotSwapCurveValue = $("#hotSwapCurveValue");
const hotSwapOutgoingValue = $("#hotSwapOutgoingValue");
const hotSwapIncomingValue = $("#hotSwapIncomingValue");
const hotSwapPowerValue = $("#hotSwapPowerValue");
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
const reportHotSwapCount = $("#reportHotSwapCount");
const reportHotSwapTime = $("#reportHotSwapTime");
const reportHotSwapPeak = $("#reportHotSwapPeak");
const reportHotSwapRms = $("#reportHotSwapRms");
const reportHotSwapReduction = $("#reportHotSwapReduction");
const reportHotSwapPower = $("#reportHotSwapPower");
const modeSummary = $("#modeSummary");
const scenarioStageSummary = $("#scenarioStageSummary");
const hotSwapSummary = $("#hotSwapSummary");
const scenarioStatus = $("#scenarioStatus");
const scenarioTimer = $("#scenarioTimer");
const scenarioProgressBar = $("#scenarioProgressBar");
const runScenarioButton = $("#runScenarioButton");
const cancelScenarioButton = $("#cancelScenarioButton");
const scenarioTimeline = $("#scenarioTimeline");
const scenarioIdValue = $("#scenarioIdValue");
const scenarioDriftValue = $("#scenarioDriftValue");
const scenarioRunStatus = $("#scenarioRunStatus");
const routeMatrixStatus = $("#routeMatrixStatus");
const routeMatrixStatusText = $("#routeMatrixStatusText");
const routeMatrixProgressBar = $("#routeMatrixProgressBar");
const routeMatrixTimer = $("#routeMatrixTimer");
const routeMatrixCompleted = $("#routeMatrixCompleted");
const routeMatrixStartPack = $("#routeMatrixStartPack");
const routeMatrixDrift = $("#routeMatrixDrift");
const routeMatrixCurrentRoute = $("#routeMatrixCurrentRoute");
const routeMatrixGrid = $("#routeMatrixGrid");
const runRouteMatrixButton = $("#runRouteMatrixButton");
const cancelRouteMatrixButton = $("#cancelRouteMatrixButton");
const routeMatrixBaselineStatus = $("#routeMatrixBaselineStatus");
const routeMatrixBaselineHistory = $("#routeMatrixBaselineHistory");
const saveRouteMatrixBaselineButton = $("#saveRouteMatrixBaselineButton");
const shareRouteMatrixBaselineButton = $("#shareRouteMatrixBaselineButton");
const clearRouteMatrixBaselineButton = $("#clearRouteMatrixBaselineButton");
const baselineFile = $("#baselineFile");
const baselineStatus = $("#baselineStatus");
const baselineRegistryStatus = $("#baselineRegistryStatus");
const compareVerdict = $("#compareVerdict");
const useCurrentBaselineButton = $("#useCurrentBaselineButton");
const savePackBaselineButton = $("#savePackBaselineButton");
const deletePackBaselineButton = $("#deletePackBaselineButton");
const sharePackBaselineButton = $("#sharePackBaselineButton");
const exportCompareJsonButton = $("#exportCompareJsonButton");
const exportCompareCsvButton = $("#exportCompareCsvButton");
const comparePeak = $("#comparePeak");
const compareRms = $("#compareRms");
const compareReduction = $("#compareReduction");
const compareOver3 = $("#compareOver3");
const compareOver6 = $("#compareOver6");
const compareClip = $("#compareClip");
const compareBaseCoverage = $("#compareBaseCoverage");
const compareCurrentCoverage = $("#compareCurrentCoverage");
const compareDirections = $("#compareDirections");
const compareWarnings = $("#compareWarnings");
const compareModes = $("#compareModes");
const compareStages = $("#compareStages");
const compareHotSwaps = $("#compareHotSwaps");
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
let baselineReport = null;
let baselineOrigin = null;
let savedBaselineEntry = null;
let savedRouteMatrixEntry = null;
let baselineCompatibility = null;
let routeMatrixBaselineCompatibility = null;
let comparisonReport = null;
let scenarioRun = null;
let lastScenarioSummary = null;
let scenarioAdvancing = false;
let routeMatrixRun = null;
let lastRouteMatrixSummary = null;
let routeMatrixAdvancing = false;
let routeMatrixPreparing = false;
let routeMatrixToken = 0;
let lastRecordSampleAt = 0;

let selectedQaPackId = qaPackSelect?.value || "pulse";

function routeMatrixIsRunning() {
  return routeMatrixRun?.status === "running";
}

function activeQaStage() {
  return routeMatrixRun?.currentStage || scenarioRun?.currentStage || null;
}

function routeMatrixBusy() {
  return routeMatrixPreparing || routeMatrixIsRunning();
}

function createPackScenario(packId) {
  const label = packId === "fantasy"
    ? "Fantasy"
    : packId === "neon"
      ? "Neon"
      : packId === "clockwork"
        ? "Clockwork"
        : "Pulse";
  return Object.freeze({
    ...BASE_QA_SCENARIO,
    id: `${packId}-standard-v1`,
    name: `${label} Standard 60s`,
  });
}

function createQaMusic(packId) {
  return createMusicFacade({
    packId,
    callbacks: {
      onSync(info = {}) {
        bar = Number(info.bar || 0);
        beat = Number(info.beat || 0);
      },
    },
  });
}

let qaScenario = createPackScenario(selectedQaPackId);
let music = createQaMusic(selectedQaPackId);
let staticInfo = music.info();

function refreshStaticInfo() {
  staticInfo = music.info();
  return staticInfo;
}

function updateQaPackLabel() {
  const info = refreshStaticInfo();
  qaPackDescription.textContent =
    `${info.name || selectedQaPackId} · ${info.mastering?.profile || info.masteringProfile || "no mastering"}`;
}

function preloadCurrentQaPack() {
  return music.preload({ stingers: true, transitions: true }).catch((error) => {
    console.warn("QA preload failed; START will retry", error);
  });
}

async function preloadRouteMatrixPacks() {
  return Promise.all(
    HOT_SWAP_ROUTE_MATRIX_PACKS.map(async (packId) => {
      const preload = await preloadMusicAssets({
        packId,
        preloadOptions: { stingers: true, transitions: true },
      });
      const entry = getMusicPackEntry(packId);
      return {
        id: packId,
        version: entry?.version || null,
        masteringProfile: entry?.masteringProfile || null,
        facadeApi: entry?.facadeApi || null,
        audioFormat: preload?.format || null,
      };
    })
  );
}

function baselineOriginLabel() {
  if (baselineOrigin === "route-saved") return "ROUTE DEVICE";
  if (baselineOrigin === "saved") return "SAVED DEVICE";
  if (baselineOrigin === "file") return "FILE";
  if (baselineOrigin === "current") return "CURRENT SESSION";
  return "BASELINE";
}

function renderBaselineRegistry() {
  const saved = savedBaselineEntry;

  if (routeMatrixBusy()) {
    savePackBaselineButton.disabled = true;
    deletePackBaselineButton.disabled = true;
    sharePackBaselineButton.disabled = true;
    baselineRegistryStatus.textContent = "MATRIX MODE · PACK BASELINE DISABLED";
    baselineRegistryStatus.className = "record-status";
    return;
  }
  const eligibility = baselineReport
    ? getQaBaselineEligibility(baselineReport, { packId: selectedQaPackId })
    : { eligible: false, failures: ["No baseline report selected"] };

  savePackBaselineButton.disabled = !eligibility.eligible;
  savePackBaselineButton.title = eligibility.eligible
    ? "Save this approved Standard 60s report for the selected Pack"
    : eligibility.failures.join(" · ");

  deletePackBaselineButton.disabled = !saved;
  sharePackBaselineButton.disabled = !saved;

  if (!saved) {
    baselineRegistryStatus.textContent =
      `NONE · ${String(selectedQaPackId).toUpperCase()} · RUN STANDARD 60s`;
    baselineRegistryStatus.className = "record-status";
    return;
  }

  const approved = saved.approvedAt
    ? new Date(saved.approvedAt).toLocaleString()
    : "unknown time";
  const rate = saved.sampleRate
    ? `${(Number(saved.sampleRate) / 1000).toFixed(1)} kHz`
    : "unknown rate";
  const format = String(
    saved.audioFormat || saved.report?.metadata?.audioFormat || "unknown"
  ).toUpperCase();
  const compatibility = lastReport
    ? getQaBaselineCompatibility(saved, lastReport)
    : null;
  const compatibilityLabel = compatibility
    ? ` · ${String(compatibility.status).toUpperCase()}`
    : "";

  baselineRegistryStatus.textContent =
    `SAVED · ${String(saved.packId).toUpperCase()} v${saved.packVersion || "?"} · ${format} · ${rate}${compatibilityLabel} · ${Number(saved.coveragePercent || 0).toFixed(0)}% · ${approved}`;
  baselineRegistryStatus.className = compatibility?.status === "incompatible"
    ? "record-status"
    : "record-status is-saved";
}

function restoreSavedPackBaseline(packId = selectedQaPackId) {
  savedBaselineEntry = loadQaPackBaseline(packId);

  if (savedBaselineEntry?.report) {
    setBaseline(savedBaselineEntry.report, { origin: "saved" });
  } else {
    baselineReport = null;
    baselineOrigin = null;
    baselineCompatibility = null;
    comparisonReport = null;
    renderComparison();
    renderBaselineRegistry();
  }
}

function saveSelectedPackBaseline() {
  if (!baselineReport) return;

  const eligibility = getQaBaselineEligibility(baselineReport, {
    packId: selectedQaPackId,
  });
  if (!eligibility.eligible) {
    baselineRegistryStatus.textContent =
      "NOT SAVED · " + eligibility.failures.join(" · ");
    baselineRegistryStatus.className = "record-status";
    renderBaselineRegistry();
    return;
  }

  try {
    savedBaselineEntry = saveQaPackBaseline(baselineReport);
    baselineOrigin = "saved";
    runComparison();
    renderBaselineRegistry();
  } catch (error) {
    console.error("Pack QA baseline save failed", error);
    baselineRegistryStatus.textContent = `SAVE ERROR · ${error.message}`;
    baselineRegistryStatus.className = "record-status";
  }
}

function deleteSelectedPackBaseline() {
  if (!deleteQaPackBaseline(selectedQaPackId)) return;
  savedBaselineEntry = null;

  if (baselineOrigin === "saved") {
    baselineReport = null;
    baselineOrigin = null;
    baselineCompatibility = null;
    comparisonReport = null;
  }

  renderComparison();
  renderBaselineRegistry();
}

async function shareSavedPackBaseline() {
  if (!savedBaselineEntry?.report) return;

  const report = savedBaselineEntry.report;
  const filename =
    `game-music-device-baseline-${savedBaselineEntry.packId}-${String(savedBaselineEntry.approvedAt || "baseline").replaceAll(":", "-")}.json`;

  await shareOrDownload(JSON.stringify(report, null, 2), {
    mime: "application/json",
    filename,
    title: "Game Music Device QA Baseline",
    text: `${savedBaselineEntry.packId} · ${savedBaselineEntry.scenarioId}`,
  });
}


function syncHotSwapTargetOptions(activePackId = music.info().id || selectedQaPackId) {
  const options = [...hotSwapTargetSelect.options];
  options.forEach((option) => {
    option.disabled = option.value === activePackId;
  });

  const selected = hotSwapTargetSelect.selectedOptions?.[0];
  if (!selected || selected.disabled) {
    const next = options.find((option) => !option.disabled);
    if (next) hotSwapTargetSelect.value = next.value;
  }
}

function renderHotSwap(meter = music.meter()) {
  const hot = meter?.hotSwap || null;
  const scenarioRunning = scenarioRun?.status === "running";
  const matrixBusy = routeMatrixBusy();
  const activePackId = meter?.packId || music.info().id || selectedQaPackId;
  syncHotSwapTargetOptions(activePackId);

  const targetIsActive = hotSwapTargetSelect.value === activePackId;
  scheduleHotSwapButton.disabled =
    scenarioRunning ||
    matrixBusy ||
    !music.running ||
    Boolean(hot) ||
    targetIsActive;
  cancelHotSwapButton.disabled = hot?.phase !== "scheduled";
  hotSwapTargetSelect.disabled = scenarioRunning || matrixBusy || Boolean(hot);
  hotSwapCurveSelect.disabled = scenarioRunning || matrixBusy || Boolean(hot);

  if (!hot) {
    hotSwapStatus.textContent = music.running ? "READY" : "IDLE";
    hotSwapStatus.className = "hot-swap-status idle";
    hotSwapRoute.textContent = `${String(activePackId || "—").toUpperCase()} → —`;
    hotSwapProgressValue.textContent = "0%";
    hotSwapProgressBar.style.width = "0%";
    hotSwapCurveValue.textContent = "—";
    hotSwapOutgoingValue.textContent = "—";
    hotSwapIncomingValue.textContent = "—";
    hotSwapPowerValue.textContent = "—";
    return;
  }

  const progress = Math.max(0, Math.min(1, Number(hot.progress || 0)));
  const phase = String(hot.phase || "unknown").toUpperCase();
  hotSwapStatus.textContent = phase;
  hotSwapStatus.className =
    `hot-swap-status ${hot.phase === "crossfading" ? "active" : "scheduled"}`;
  hotSwapRoute.textContent =
    `${String(hot.fromId || "—").toUpperCase()} → ${String(hot.toId || "—").toUpperCase()}`;
  hotSwapProgressValue.textContent = `${Math.round(progress * 100)}%`;
  hotSwapProgressBar.style.width = `${Math.round(progress * 100)}%`;
  hotSwapCurveValue.textContent = String(hot.curve || "—").toUpperCase();
  hotSwapOutgoingValue.textContent = Number(hot.outgoingGain || 0).toFixed(3);
  hotSwapIncomingValue.textContent = Number(hot.incomingGain || 0).toFixed(3);
  hotSwapPowerValue.textContent = Number(hot.powerCoefficientSum || 0).toFixed(4);
}

async function scheduleHotSwap() {
  if (scenarioRun?.status === "running") return;

  const targetId = hotSwapTargetSelect.value;
  const activeId = music.info().id || selectedQaPackId;
  if (!targetId || targetId === activeId) return;

  if (!music.running) {
    qaBadge.textContent = "STARTING";
    await music.start("normal");
    refreshStaticInfo();
  }

  hotSwapStatus.textContent = "PREPARING";
  hotSwapStatus.className = "hot-swap-status scheduled";

  try {
    await music.pack(targetId, {
      quantize: "bar",
      crossfadeBeats: 2,
      crossfadeCurve:
        hotSwapCurveSelect.value === "exponential"
          ? "exponential"
          : "equal-power",
      mode: music.meter()?.mode || "normal",
    });
    renderHotSwap();
  } catch (error) {
    console.error("Hot Swap QA failed", error);
    hotSwapStatus.textContent = "ERROR";
    hotSwapStatus.className = "hot-swap-status hot";
  }
}

async function switchQaPack(packId) {
  if (!["pulse", "fantasy", "neon", "clockwork"].includes(packId)) return;
  if (recordingSession || scenarioRun?.status === "running" || routeMatrixBusy()) {
    qaPackSelect.value = selectedQaPackId;
    return;
  }

  music.stop();
  selectedQaPackId = packId;
  qaScenario = createPackScenario(packId);
  music = createQaMusic(packId);
  staticInfo = music.info();
  bar = 0;
  beat = 0;

  peakHistory.length = 0;
  reductionHistory.length = 0;
  lastReport = null;
  baselineReport = null;
  baselineOrigin = null;
  savedBaselineEntry = null;
  baselineCompatibility = null;
  comparisonReport = null;
  lastScenarioSummary = null;
  lastRouteMatrixSummary = null;
  routeMatrixGrid.dataset.signature = "";

  updateQaPackLabel();
  restoreSavedPackBaseline(packId);
  renderReportSummary();
  renderScenario();
  renderRouteMatrix();
  syncHotSwapTargetOptions(packId);
  render();
  await preloadCurrentQaPack();
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

function availableHotSwapTargets(currentId) {
  return [...hotSwapTargetSelect.options]
    .map((option) => option.value)
    .filter((id) => id && id !== currentId);
}

function syncHotSwapTarget(currentId) {
  const currentTarget = hotSwapTargetSelect.value;
  if (currentTarget && currentTarget !== currentId) return;
  const [next] = availableHotSwapTargets(currentId);
  if (next) hotSwapTargetSelect.value = next;
}

function renderHotSwapMonitor(meter = music.meter()) {
  const hot = meter?.hotSwap || null;
  const currentId = meter?.packId || music.info()?.id || selectedQaPackId;
  syncHotSwapTarget(currentId);

  if (!hot) {
    hotSwapStatus.textContent = "IDLE";
    hotSwapStatus.className = "hot-swap-status idle";
    hotSwapRoute.textContent = `${String(currentId || "—").toUpperCase()} → —`;
    hotSwapProgressValue.textContent = "0%";
    hotSwapProgressBar.style.width = "0%";
    hotSwapCurveValue.textContent = "—";
    hotSwapOutgoingValue.textContent = "—";
    hotSwapIncomingValue.textContent = "—";
    hotSwapPowerValue.textContent = "—";
    cancelHotSwapButton.disabled = true;
    return;
  }

  const phase = String(hot.phase || "scheduled");
  const progress = Math.max(0, Math.min(1, Number(hot.progress || 0)));
  hotSwapStatus.textContent = phase.toUpperCase();
  hotSwapStatus.className = `hot-swap-status ${phase}`;
  hotSwapRoute.textContent =
    `${String(hot.fromId || "—").toUpperCase()} → ${String(hot.toId || "—").toUpperCase()}`;
  hotSwapProgressValue.textContent = `${Math.round(progress * 100)}%`;
  hotSwapProgressBar.style.width = `${Math.round(progress * 100)}%`;
  hotSwapCurveValue.textContent = String(hot.curve || "—").toUpperCase();
  hotSwapOutgoingValue.textContent = Number.isFinite(Number(hot.outgoingGain))
    ? Number(hot.outgoingGain).toFixed(3)
    : "—";
  hotSwapIncomingValue.textContent = Number.isFinite(Number(hot.incomingGain))
    ? Number(hot.incomingGain).toFixed(3)
    : "—";
  hotSwapPowerValue.textContent = Number.isFinite(Number(hot.powerCoefficientSum))
    ? Number(hot.powerCoefficientSum).toFixed(4)
    : "—";
  cancelHotSwapButton.disabled = phase !== "scheduled";
}

async function scheduleQaHotSwap() {
  if (recordingSession && scenarioRun?.status === "running") return;

  if (!music.running) {
    qaBadge.textContent = "STARTING";
    await music.start("normal");
    refreshStaticInfo();
  }

  const info = music.info();
  const currentId = info.id || selectedQaPackId;
  syncHotSwapTarget(currentId);
  const targetId = hotSwapTargetSelect.value;
  if (!targetId || targetId === currentId) return;

  scheduleHotSwapButton.disabled = true;
  hotSwapStatus.textContent = "LOADING";
  hotSwapStatus.className = "hot-swap-status scheduled";

  try {
    await preloadMusicAssets({
      packId: targetId,
      preloadOptions: { stingers: true, transitions: true },
    });
    await music.pack(targetId, {
      quantize: "bar",
      crossfadeBeats: 2,
      crossfadeCurve: hotSwapCurveSelect.value === "exponential"
        ? "exponential-v30"
        : "equal-power-v1",
      mode: "normal",
    });
  } catch (error) {
    console.error(error);
    hotSwapStatus.textContent = "ERROR";
    hotSwapStatus.className = "hot-swap-status fail";
  } finally {
    scheduleHotSwapButton.disabled = false;
  }
}

function cancelQaHotSwap() {
  music.cancel("pack");
  renderHotSwapMonitor();
}

function renderScenario() {
  const now = performance.now();
  const progress = scenarioRun
    ? getQaScenarioProgress(scenarioRun, now)
    : null;
  const summary = scenarioRun
    ? qaScenarioExecutionSummary(scenarioRun)
    : lastScenarioSummary;

  scenarioIdValue.textContent = qaScenario.id;
  scenarioProgressBar.style.width = `${Math.round((progress?.progress || (summary?.status === "completed" ? 1 : 0)) * 100)}%`;
  scenarioTimer.textContent = `${formatTimeMs(progress?.elapsedMs || (summary?.status === "completed" ? qaScenario.durationMs : 0))} / ${formatTimeMs(qaScenario.durationMs)}`;

  const running = scenarioRun?.status === "running";
  const matrixBusy = routeMatrixBusy();
  qaPackSelect.disabled = running || matrixBusy || Boolean(recordingSession);
  runScenarioButton.disabled =
    running ||
    matrixBusy ||
    Boolean(recordingSession && !scenarioRun);
  runScenarioButton.classList.toggle("is-running", running);
  runScenarioButton.textContent = running ? "RUNNING STANDARD 60s…" : "RUN STANDARD 60s";
  cancelScenarioButton.disabled = !running;

  const status = scenarioRun?.status || summary?.status || "idle";
  scenarioRunStatus.textContent = status.toUpperCase();
  scenarioDriftValue.textContent = summary?.executions?.length || scenarioRun?.executions?.length
    ? `${Number(summary?.maxDriftMs ?? qaScenarioExecutionSummary(scenarioRun)?.maxDriftMs ?? 0)} ms`
    : "—";

  if (running) {
    const next = progress?.nextStep;
    scenarioStatus.textContent = next
      ? `RUNNING · NEXT ${String(next.label || next.id).toUpperCase()} @ ${formatTimeMs(next.atMs)}`
      : "RUNNING · FINAL HOLD";
  } else if (summary?.status === "completed") {
    scenarioStatus.textContent = `COMPLETED · ${summary.completedSteps}/${summary.totalSteps} STEPS`;
  } else if (summary?.status === "aborted") {
    scenarioStatus.textContent = `ABORTED · ${summary.abortReason || "unknown"}`;
  } else {
    scenarioStatus.textContent = "READY · SAME TIMELINE EVERY RUN";
  }

  const elapsed = progress?.elapsedMs || (summary?.status === "completed" ? qaScenario.durationMs : -1);
  const executions = new Map(
    (scenarioRun?.executions || summary?.executions || []).map((item) => [item.stepId, item])
  );

  scenarioTimeline.querySelectorAll("[data-scenario-step]").forEach((element) => {
    const id = element.dataset.scenarioStep;
    const step = qaScenario.steps.find((item) => item.id === id);
    const nextStep = qaScenario.steps[
      qaScenario.steps.findIndex((item) => item.id === id) + 1
    ];
    const execution = executions.get(id);
    const active = elapsed >= step.atMs && (!nextStep || elapsed < nextStep.atMs) && running;
    const done = execution?.status === "completed" && !active;
    const failed = execution?.status === "failed" || (
      summary?.status === "aborted" && summary?.abortReason?.includes(id)
    );
    element.classList.toggle("active", active);
    element.classList.toggle("done", Boolean(done));
    element.classList.toggle("failed", Boolean(failed));
  });
}

function attachScenarioMetadata(summary) {
  if (!recordingSession || !summary) return;
  recordingSession.metadata.qaScenarioId = summary.id;
  recordingSession.metadata.qaScenarioVersion = summary.version;
  recordingSession.metadata.qaScenarioStatus = summary.status;
  recordingSession.metadata.qaScenarioExecution = summary;
}

function closeScenarioRun() {
  if (!scenarioRun) return;
  const summary = qaScenarioExecutionSummary(scenarioRun);
  lastScenarioSummary = summary;
  attachScenarioMetadata(summary);

  const shouldFinishRecording = Boolean(recordingSession);
  scenarioRun = null;
  scenarioAdvancing = false;

  if (shouldFinishRecording) finishRecording(Date.now());
  renderScenario();
}

async function advanceScenario(now = performance.now()) {
  if (!scenarioRun || scenarioRun.status !== "running" || scenarioAdvancing) return;
  scenarioAdvancing = true;
  try {
    await advanceQaScenarioRun(scenarioRun, {
      nowMs: now,
      executeStep: (step) => executeQaScenarioStep(music, step),
    });
  } finally {
    scenarioAdvancing = false;
  }

  if (scenarioRun?.status === "completed" || scenarioRun?.status === "aborted") {
    closeScenarioRun();
  }
}

async function startStandardScenario() {
  if (scenarioRun?.status === "running" || routeMatrixBusy() || recordingSession) return;

  lastScenarioSummary = null;
  music.cancel("all");
  if (music.running) music.stop();

  qaBadge.textContent = "STARTING";
  await music.start("normal");
  refreshStaticInfo();

  const startedAt = performance.now();
  scenarioRun = createQaScenarioRun(qaScenario, {
    startedAtMs: startedAt,
  });

  await startRecording({
    targetDurationSeconds: qaScenario.durationMs / 1000,
    metadata: {
      qaScenarioId: qaScenario.id,
      qaScenarioVersion: qaScenario.version,
      qaScenarioSchemaVersion: qaScenario.schemaVersion,
      qaScenarioStatus: "running",
    },
  });

  renderScenario();
  await advanceScenario(startedAt);
}

function abortScenario(reason = "cancelled") {
  if (!scenarioRun || scenarioRun.status !== "running") return;
  cancelQaScenarioRun(scenarioRun, {
    nowMs: performance.now(),
    reason,
  });
  closeScenarioRun();
}

function routeMatrixScenarioPreview() {
  const startId = HOT_SWAP_ROUTE_MATRIX_PACKS.includes(selectedQaPackId)
    ? selectedQaPackId
    : "pulse";
  return createHotSwapRouteMatrixScenario({ startId });
}

function routeMatrixExecutionState() {
  if (routeMatrixRun) {
    const generic = qaScenarioExecutionSummary(routeMatrixRun);
    return {
      scenario: routeMatrixRun.scenario,
      generic,
      matrix: hotSwapRouteMatrixExecutionSummary(routeMatrixRun),
    };
  }

  if (lastRouteMatrixSummary) {
    return {
      scenario: lastRouteMatrixSummary.scenario,
      generic: lastRouteMatrixSummary.generic,
      matrix: lastRouteMatrixSummary.matrix,
    };
  }

  return {
    scenario: routeMatrixScenarioPreview(),
    generic: null,
    matrix: null,
  };
}

function renderRouteMatrix() {
  const { scenario, generic, matrix } = routeMatrixExecutionState();
  const running = routeMatrixIsRunning();
  const busy = routeMatrixBusy();
  const progress = routeMatrixRun
    ? getQaScenarioProgress(routeMatrixRun, performance.now())
    : null;
  const reportSummary = lastRouteMatrixSummary?.reportSummary || null;
  const completedRoutes = matrix?.completedRoutes || 0;
  const elapsedMs = progress?.elapsedMs
    ?? (matrix?.status === "completed" ? scenario.durationMs : 0);
  const progressRatio = progress?.progress
    ?? (matrix?.status === "completed" ? 1 : 0);

  routeMatrixProgressBar.style.width =
    `${Math.round(Math.max(0, Math.min(1, progressRatio)) * 100)}%`;
  routeMatrixTimer.textContent =
    `${formatTimeMs(elapsedMs)} / ${formatTimeMs(scenario.durationMs)}`;
  routeMatrixCompleted.textContent = `${completedRoutes} / ${scenario.routeCount}`;
  routeMatrixStartPack.textContent =
    String(scenario.startPackId || selectedQaPackId || "—").toUpperCase();
  routeMatrixDrift.textContent = generic?.executions?.length
    ? `${Number(generic.maxDriftMs || 0)} ms`
    : "—";

  const hot = music.info()?.hotSwap || null;
  const nextStep = progress?.nextStep || null;
  const currentRouteLabel = hot?.fromId && hot?.toId
    ? `${String(hot.fromId).toUpperCase()} → ${String(hot.toId).toUpperCase()}`
    : running && nextStep
      ? `NEXT · ${String(nextStep.fromId).toUpperCase()} → ${String(nextStep.toId).toUpperCase()}`
      : running
        ? "FINAL HOLD"
        : matrix?.status === "completed"
          ? "COMPLETE · RETURNED TO START"
          : "—";
  routeMatrixCurrentRoute.textContent = currentRouteLabel;

  const executions = new Map(
    (routeMatrixRun?.executions || generic?.executions || [])
      .map((execution) => [execution.stepId, execution])
  );
  const activeKey = hot?.fromId && hot?.toId
    ? `${hot.fromId}->${hot.toId}`
    : null;

  const gridRows = scenario.routes.map((route) => {
    const execution = executions.get(route.id);
    const key = `${route.fromId}->${route.toId}`;
    const active = key === activeKey;
    const failed = execution?.status === "failed";
    const done = execution?.status === "completed" && !active;
    const className = [
      "route-matrix-route",
      active ? "active" : "",
      done ? "done" : "",
      failed ? "failed" : "",
    ].filter(Boolean).join(" ");

    return {
      signature: `${route.id}:${className}`,
      html: `
        <div class="${className}">
          <strong>${String(route.fromId).toUpperCase()} → ${String(route.toId).toUpperCase()}</strong>
          <span>#${String(route.index + 1).padStart(2, "0")} · ${formatTimeMs(scenario.steps[route.index]?.atMs || 0)}</span>
        </div>
      `,
    };
  });
  const gridSignature = gridRows.map((row) => row.signature).join("|");
  if (routeMatrixGrid.dataset.signature !== gridSignature) {
    routeMatrixGrid.dataset.signature = gridSignature;
    routeMatrixGrid.innerHTML = gridRows.map((row) => row.html).join("");
  }

  let status = "IDLE";
  let statusClass = "idle";
  let statusText = "READY · 4 PACKS × 3 TARGETS · 64 SEC";

  if (routeMatrixPreparing) {
    status = "PREPARING";
    statusClass = "preparing";
    statusText = "PRELOADING ALL 4 REAL AUDIO PACKS";
  } else if (running) {
    status = "RUNNING";
    statusClass = "running";
    statusText = `RUNNING · ${completedRoutes}/${scenario.routeCount} ROUTES SCHEDULED`;
  } else if (matrix?.status === "aborted") {
    status = "ABORTED";
    statusClass = "aborted";
    statusText = `ABORTED · ${matrix.abortReason || "unknown"}`;
  } else if (matrix?.status === "completed") {
    const evaluation = lastRouteMatrixSummary?.evaluation || null;
    const observed = Number(evaluation?.observedRouteCount ?? reportSummary?.hotSwapCount ?? 0);
    const gate = String(
      evaluation?.hotSwapQaStatus || reportSummary?.hotSwapQa?.status || "not-applicable"
    );
    status = String(evaluation?.status || "review").toUpperCase();
    statusClass = String(evaluation?.status || "review");
    statusText =
      `COMPLETE · OBSERVED ${observed}/${scenario.routeCount} · HOT SWAP QA ${gate.toUpperCase()}`;
  }

  routeMatrixStatus.textContent = status;
  routeMatrixStatus.className = `route-matrix-status ${statusClass}`;
  routeMatrixStatusText.textContent = statusText;

  runRouteMatrixButton.disabled =
    busy ||
    scenarioRun?.status === "running" ||
    Boolean(recordingSession && !routeMatrixRun);
  runRouteMatrixButton.classList.toggle("is-running", running);
  runRouteMatrixButton.textContent = running
    ? "RUNNING ALL 12 ROUTES…"
    : routeMatrixPreparing
      ? "PREPARING AUDIO…"
      : "RUN ALL 12 ROUTES";
  cancelRouteMatrixButton.disabled = !busy;

  for (const id of ["startButton", "normalButton", "overdriveButton", "stressButton"]) {
    const button = $(`#${id}`);
    if (button) button.disabled = busy;
  }
}

function attachRouteMatrixMetadata(generic, matrix) {
  if (!recordingSession || !generic || !matrix) return;
  recordingSession.metadata.qaScenarioId = generic.id;
  recordingSession.metadata.qaScenarioVersion = generic.version;
  recordingSession.metadata.qaScenarioStatus = generic.status;
  recordingSession.metadata.qaScenarioExecution = generic;
  recordingSession.metadata.qaRouteMatrixExecution = matrix;
}

function closeRouteMatrix() {
  if (!routeMatrixRun) return;

  const scenario = routeMatrixRun.scenario;
  const generic = qaScenarioExecutionSummary(routeMatrixRun);
  const matrix = hotSwapRouteMatrixExecutionSummary(routeMatrixRun);
  attachRouteMatrixMetadata(generic, matrix);

  const shouldFinishRecording = Boolean(recordingSession);
  routeMatrixRun = null;
  routeMatrixAdvancing = false;
  routeMatrixPreparing = false;

  const report = shouldFinishRecording ? finishRecording(Date.now()) : lastReport;
  const evaluation = report
    ? evaluateHotSwapRouteMatrixReport(report)
    : null;
  lastRouteMatrixSummary = {
    scenario,
    generic,
    matrix,
    reportSummary: report?.summary || null,
    evaluation,
  };

  renderRouteMatrix();
  renderScenario();
  renderBaselineRegistry();
}

async function advanceRouteMatrix(now = performance.now()) {
  if (!routeMatrixRun || routeMatrixRun.status !== "running" || routeMatrixAdvancing) return;

  routeMatrixAdvancing = true;
  try {
    await advanceQaScenarioRun(routeMatrixRun, {
      nowMs: now,
      executeStep: async (step) => {
        const info = music.info();
        if (info.hotSwap) {
          throw new Error(
            `previous-hot-swap-still-active:${info.hotSwap.fromId}->${info.hotSwap.toId}`
          );
        }
        if (step.fromId && info.id !== step.fromId) {
          throw new Error(
            `route-pack-mismatch:expected-${step.fromId}:actual-${info.id}`
          );
        }
        return executeQaScenarioStep(music, step);
      },
    });
  } finally {
    routeMatrixAdvancing = false;
  }

  if (
    routeMatrixRun?.status === "completed" ||
    routeMatrixRun?.status === "aborted"
  ) {
    closeRouteMatrix();
  }
}

async function startHotSwapRouteMatrix() {
  if (
    routeMatrixBusy() ||
    scenarioRun?.status === "running" ||
    recordingSession
  ) return;

  const startId = HOT_SWAP_ROUTE_MATRIX_PACKS.includes(selectedQaPackId)
    ? selectedQaPackId
    : "pulse";
  const token = ++routeMatrixToken;
  routeMatrixPreparing = true;
  lastRouteMatrixSummary = null;
  lastReport = null;
  baselineReport = null;
  baselineOrigin = null;
  comparisonReport = null;
  music.cancel("all");

  if (music.info().id !== startId) {
    if (music.running) music.stop();
    music = createQaMusic(startId);
    staticInfo = music.info();
    selectedQaPackId = startId;
    qaPackSelect.value = startId;
    qaScenario = createPackScenario(startId);
    bar = 0;
    beat = 0;
    updateQaPackLabel();
  }

  renderComparison();
  renderBaselineRegistry();
  renderRouteMatrix();
  renderReportSummary();

  // Resume AudioContext directly from the user gesture before waiting on
  // multi-pack network/cache preloading. This preserves iOS autoplay behavior.
  if (music.running) music.stop();
  qaBadge.textContent = "STARTING";
  await music.start("normal");
  refreshStaticInfo();

  await preloadRouteMatrixPacks();
  if (token !== routeMatrixToken || !routeMatrixPreparing) return;

  const scenario = createHotSwapRouteMatrixScenario({ startId });
  const startedAt = performance.now();
  routeMatrixRun = createQaScenarioRun(scenario, { startedAtMs });
  routeMatrixPreparing = false;

  await startRecording({
    targetDurationSeconds: scenario.durationMs / 1000,
    metadata: {
      qaScenarioId: scenario.id,
      qaScenarioVersion: scenario.version,
      qaScenarioSchemaVersion: scenario.schemaVersion,
      qaScenarioStatus: "running",
      qaScenarioKind: "hot-swap-route-matrix",
      qaRouteMatrix: {
        schemaVersion: scenario.routeMatrixSchemaVersion,
        startPackId: scenario.startPackId,
        routeCount: scenario.routeCount,
        routeIntervalMs: scenario.routeIntervalMs,
        crossfadeBeats: scenario.steps[0]?.actions?.[0]?.options?.crossfadeBeats || 2,
        quantize: scenario.steps[0]?.actions?.[0]?.options?.quantize || "bar",
        crossfadeCurve:
          scenario.steps[0]?.actions?.[0]?.options?.crossfadeCurve || "equal-power-v1",
        routes: scenario.routes.map(({ index, id, fromId, toId }) => ({
          index, id, fromId, toId,
        })),
      },
    },
  });

  renderRouteMatrix();
  renderScenario();
  await advanceRouteMatrix(startedAt);
}

function abortRouteMatrix(reason = "cancelled") {
  ++routeMatrixToken;

  if (routeMatrixPreparing && !routeMatrixRun) {
    routeMatrixPreparing = false;
    music.cancel("pack");
    lastRouteMatrixSummary = {
      scenario: routeMatrixScenarioPreview(),
      generic: {
        id: "hot-swap-route-matrix-v1",
        version: "1.0.0",
        status: "aborted",
        abortReason: reason,
        maxDriftMs: 0,
        executions: [],
      },
      matrix: {
        status: "aborted",
        abortReason: reason,
        startPackId: selectedQaPackId,
        routeCount: 12,
        completedRoutes: 0,
        routes: [],
      },
      reportSummary: null,
      evaluation: null,
    };
    renderRouteMatrix();
    renderBaselineRegistry();
    return;
  }

  if (!routeMatrixRun || routeMatrixRun.status !== "running") return;
  music.cancel("pack");
  cancelQaScenarioRun(routeMatrixRun, {
    nowMs: performance.now(),
    reason,
  });
  closeRouteMatrix();
}

function renderReportSummary() {
  const summary = lastReport?.summary;
  const recording = Boolean(recordingSession);
  const now = Date.now();
  const elapsedMs = recording
    ? Math.max(0, now - recordingSession.startedAtMs)
    : Math.max(0, Number(summary?.durationSeconds || 0) * 1000);
  const targetSeconds = Number(
    recordingSession?.targetDurationSeconds
      ?? lastReport?.targetDurationSeconds
      ?? RECORD_DURATION_SECONDS
  );
  const targetMs = targetSeconds * 1000;
  const progress = recording
    ? Math.min(100, elapsedMs / targetMs * 100)
    : lastReport ? 100 : 0;

  recordTimer.textContent = `${formatTimeMs(elapsedMs)} / ${formatTimeMs(targetMs)}`;
  recordProgressBar.style.width = `${progress}%`;
  recordButton.disabled =
    recording ||
    routeMatrixPreparing ||
    routeMatrixIsRunning() ||
    scenarioRun?.status === "running";
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
    reportHotSwapCount.textContent = "—";
    reportHotSwapTime.textContent = "—";
    reportHotSwapPeak.textContent = "—";
    reportHotSwapRms.textContent = "—";
    reportHotSwapReduction.textContent = "—";
    reportHotSwapPower.textContent = "—";
    modeSummary.innerHTML = "";
    scenarioStageSummary.innerHTML = "";
    hotSwapSummary.innerHTML = "";
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
  reportHotSwapCount.textContent = String(summary.hotSwapCount || 0);
  reportHotSwapTime.textContent = `${Number(summary.hotSwapCrossfadeSeconds || 0).toFixed(1)} s`;
  reportHotSwapPeak.textContent = summary.hotSwapMaxOutputPeakDbfs == null
    ? "—"
    : formatDb(summary.hotSwapMaxOutputPeakDbfs);
  reportHotSwapRms.textContent = summary.hotSwapMinOutputRmsDbfs == null
    ? "—"
    : formatDb(summary.hotSwapMinOutputRmsDbfs);
  reportHotSwapReduction.textContent = summary.hotSwapMaxLimiterReductionMagnitudeDb == null
    ? "—"
    : `${Number(summary.hotSwapMaxLimiterReductionMagnitudeDb).toFixed(1)} dB`;
  reportHotSwapPower.textContent = summary.hotSwapMinPowerCoefficientSum == null
    ? "—"
    : Number(summary.hotSwapMinPowerCoefficientSum).toFixed(4);

  modeSummary.innerHTML = Object.entries(summary.modes || {}).map(([mode, value]) => `
    <div class="mode-report-row">
      <strong>MODE ${mode}</strong>
      <span>${Number(value.durationSeconds || 0).toFixed(1)}s</span>
      <span>RMS ${Number(value.averageOutputRmsDbfs || -180).toFixed(1)}</span>
      <span>PK ${Number(value.maxOutputPeakDbfs || -180).toFixed(1)}</span>
      <span>GR ${Number(value.maxLimiterReductionMagnitudeDb || 0).toFixed(1)}</span>
    </div>
  `).join("");

  scenarioStageSummary.innerHTML = Object.entries(summary.scenarioStages || {}).map(([stage, value]) => `
    <div class="mode-report-row">
      <strong>STAGE ${stage}</strong>
      <span>${Number(value.durationSeconds || 0).toFixed(1)}s</span>
      <span>RMS ${Number(value.averageOutputRmsDbfs || -180).toFixed(1)}</span>
      <span>PK ${Number(value.maxOutputPeakDbfs || -180).toFixed(1)}</span>
      <span>GR ${Number(value.maxLimiterReductionMagnitudeDb || 0).toFixed(1)}</span>
    </div>
  `).join("");

  hotSwapSummary.innerHTML = (summary.hotSwaps || []).map((swap) => `
    <div class="mode-report-row hot-swap-report-row">
      <strong>SWAP ${String(swap.fromId || "—").toUpperCase()} → ${String(swap.toId || "—").toUpperCase()}</strong>
      <span>${Number(swap.durationSeconds || 0).toFixed(1)}s</span>
      <span>RMS MIN ${swap.minOutputRmsDbfs == null ? "—" : Number(swap.minOutputRmsDbfs).toFixed(1)}</span>
      <span>PK ${swap.maxOutputPeakDbfs == null ? "—" : Number(swap.maxOutputPeakDbfs).toFixed(1)}</span>
      <span>GR ${Number(swap.maxLimiterReductionMagnitudeDb || 0).toFixed(1)}</span>
      <span>PWR ${swap.minPowerCoefficientSum == null ? "—" : Number(swap.minPowerCoefficientSum).toFixed(4)}</span>
    </div>
  `).join("");
}

function signed(value, digits = 1, suffix = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(digits)}${suffix}`;
}

function signedPercentPoints(rate, digits = 1) {
  const number = Number(rate);
  if (!Number.isFinite(number)) return "—";
  return signed(number * 100, digits, " pp");
}

function renderComparison() {
  const comparison = comparisonReport;
  useCurrentBaselineButton.disabled = !lastReport;
  exportCompareJsonButton.disabled = !comparison?.valid;
  exportCompareCsvButton.disabled = !comparison?.valid;

  if (!baselineReport) {
    baselineStatus.textContent = "NO ACTIVE BASELINE · SAVED PACK BASELINE WILL AUTO-LOAD";
  } else {
    const version = baselineReport.metadata?.packVersion || "?";
    const date = baselineReport.generatedAt
      ? new Date(baselineReport.generatedAt).toLocaleString()
      : "unknown time";
    baselineStatus.textContent =
      `${baselineOriginLabel()} BASELINE · ${baselineReport.metadata?.packName || baselineReport.metadata?.packId || "Music"} v${version} · ${date}`;
  }

  if (!comparison?.valid) {
    const compatibilityStatus = comparison?.compatibility?.status || null;
    compareVerdict.textContent = baselineReport && lastReport
      ? compatibilityStatus === "incompatible" ? "INCOMPATIBLE" : "INVALID"
      : "—";
    compareVerdict.className = compatibilityStatus === "incompatible"
      ? "compare-verdict review"
      : "compare-verdict idle";
    comparePeak.textContent = "—";
    compareRms.textContent = "—";
    compareReduction.textContent = "—";
    compareOver3.textContent = "—";
    compareOver6.textContent = "—";
    compareClip.textContent = "—";
    compareBaseCoverage.textContent = "—";
    compareCurrentCoverage.textContent = "—";
    compareDirections.innerHTML = "";
    compareWarnings.innerHTML = comparison?.errors?.map(
      (message) => `<div class="compare-warning">${message}</div>`
    ).join("") || "";
    compareModes.innerHTML = "";
    compareStages.innerHTML = "";
    compareHotSwaps.innerHTML = "";
    return;
  }

  const metrics = comparison.metrics;
  const status = String(comparison.status || "pass");
  compareVerdict.textContent = status.toUpperCase();
  compareVerdict.className = `compare-verdict ${status}`;
  comparePeak.textContent = signed(metrics.maxOutputPeakDb.delta, 1, " dB");
  compareRms.textContent = signed(metrics.averageOutputRmsDb.delta, 1, " dB");
  compareReduction.textContent = signed(metrics.maxLimiterReductionMagnitudeDb.delta, 1, " dB");
  compareOver3.textContent = signedPercentPoints(metrics.limiterOver3.deltaRate);
  compareOver6.textContent = signedPercentPoints(metrics.limiterOver6.deltaRate);
  compareClip.textContent = signedPercentPoints(metrics.clipRisk.deltaRate);
  compareBaseCoverage.textContent = `${Number(metrics.coveragePercent.baseline || 0).toFixed(0)}%`;
  compareCurrentCoverage.textContent = `${Number(metrics.coveragePercent.current || 0).toFixed(0)}%`;

  compareDirections.innerHTML = [
    ...(comparison.deviceBaselineCompatibility
      ? [`DEVICE BASELINE ${String(comparison.deviceBaselineCompatibility.status || "exact").toUpperCase()}`]
      : []),
    `PEAK ${String(comparison.summary?.peakDirection || "stable").toUpperCase()}`,
    `RMS ${String(comparison.summary?.rmsDirection || "stable").toUpperCase()}`,
    `LIMITER ${String(comparison.summary?.limiterDirection || "stable").toUpperCase()}`,
    `REGRESSION MODES ${comparison.summary?.regressionModeCount || 0}`,
    `IMPROVED MODES ${comparison.summary?.improvedModeCount || 0}`,
    `REGRESSION STAGES ${comparison.summary?.regressionStageCount || 0}`,
    `IMPROVED STAGES ${comparison.summary?.improvedStageCount || 0}`,
    `HOT SWAP ${String(comparison.summary?.hotSwapStatus || "N/A").toUpperCase()}`,
    `SWAP REGRESSIONS ${comparison.summary?.hotSwapRegressionCount || 0}`,
    `SWAP IMPROVEMENTS ${comparison.summary?.hotSwapImprovementCount || 0}`,
    `ROUTE CHANGES ${comparison.summary?.hotSwapRouteChangeCount || 0}`,
  ].map((label) => `<span class="direction-chip">${label}</span>`).join("");

  compareWarnings.innerHTML = (comparison.warnings || []).map((warning) =>
    `<div class="compare-warning ${warning.severity === "info" ? "info" : ""}">${warning.message}</div>`
  ).join("");

  compareModes.innerHTML = Object.entries(comparison.modes || {}).map(([name, mode]) => {
    const peak = mode.delta ? signed(mode.delta.maxOutputPeakDb, 1, " dB") : mode.presence.toUpperCase();
    const rms = mode.delta ? signed(mode.delta.averageOutputRmsDb, 1, " dB") : "—";
    const reduction = mode.delta ? signed(mode.delta.maxLimiterReductionMagnitudeDb, 1, " dB") : "—";
    return `
      <div class="compare-mode-row">
        <strong>MODE ${name}</strong>
        <span class="compare-mode-status ${mode.status}">${mode.status}</span>
        <span>PK ${peak}</span>
        <span>RMS ${rms}</span>
        <span>GR ${reduction}</span>
      </div>
    `;
  }).join("");

  compareStages.innerHTML = Object.entries(comparison.scenarioStages || {}).map(([name, stage]) => {
    const peak = stage.delta ? signed(stage.delta.maxOutputPeakDb, 1, " dB") : stage.presence.toUpperCase();
    const rms = stage.delta ? signed(stage.delta.averageOutputRmsDb, 1, " dB") : "—";
    const reduction = stage.delta ? signed(stage.delta.maxLimiterReductionMagnitudeDb, 1, " dB") : "—";
    return `
      <div class="compare-mode-row">
        <strong>STAGE ${name}</strong>
        <span class="compare-mode-status ${stage.status}">${stage.status}</span>
        <span>PK ${peak}</span>
        <span>RMS ${rms}</span>
        <span>GR ${reduction}</span>
      </div>
    `;
  }).join("");

  compareHotSwaps.innerHTML = (comparison.hotSwaps?.items || []).map((item) => {
    const delta = item.delta || {};
    const peak = delta.maxOutputPeakDb == null ? item.presence.toUpperCase() : signed(delta.maxOutputPeakDb, 1, " dB");
    const midpoint = delta.midpointRmsDeltaDb == null ? "—" : signed(delta.midpointRmsDeltaDb, 1, " dB");
    const reduction = delta.maxLimiterReductionMagnitudeDb == null ? "—" : signed(delta.maxLimiterReductionMagnitudeDb, 1, " dB");
    const power = delta.minPowerCoefficientSum == null ? "—" : signed(delta.minPowerCoefficientSum, 3);
    const duration = delta.durationRelative == null ? "—" : signed(delta.durationRelative * 100, 0, "%");
    const baselineCurve = item.baseline?.curve || null;
    const currentCurve = item.current?.curve || null;
    const curve = baselineCurve && currentCurve && baselineCurve !== currentCurve
      ? baselineCurve + " -> " + currentCurve
      : currentCurve || baselineCurve || "—";
    return `
      <div class="compare-hot-swap-row">
        <strong>${String(item.route || "—").toUpperCase()} #${item.occurrence}</strong>
        <span class="compare-mode-status ${item.status}">${item.status}</span>
        <span>PK ${peak}</span>
        <span>MID ${midpoint}</span>
        <span>GR ${reduction}</span>
        <span>Σ ${power}</span>
        <span>DUR ${duration}</span>
        <small>${String(curve).toUpperCase()}</small>
      </div>
    `;
  }).join("");
}

function runComparison() {
  if (!baselineReport || !lastReport) {
    baselineCompatibility = null;
    comparisonReport = null;
    renderComparison();
    renderBaselineRegistry();
    return null;
  }

  baselineCompatibility = baselineOrigin === "saved" && savedBaselineEntry
    ? getQaBaselineCompatibility(savedBaselineEntry, lastReport)
    : null;

  if (baselineCompatibility && !baselineCompatibility.comparable) {
    comparisonReport = {
      valid: false,
      compatibility: baselineCompatibility,
      errors: [
        "Saved Device Baseline is incompatible with the current run.",
        ...baselineCompatibility.failures,
      ],
    };
    renderComparison();
    renderBaselineRegistry();
    return comparisonReport;
  }

  comparisonReport = compareQaReports(baselineReport, lastReport);

  if (baselineCompatibility) {
    comparisonReport.deviceBaselineCompatibility = baselineCompatibility;

    if (baselineCompatibility.status === "review") {
      comparisonReport.warnings = [
        ...(comparisonReport.warnings || []),
        ...baselineCompatibility.warnings.map((warning) => ({
          code: "device-baseline-" + warning.code,
          severity: "review",
          message: "Device Baseline: " + warning.message,
        })),
      ];
      if (!["fail", "review"].includes(comparisonReport.status)) {
        comparisonReport.status = "review";
      }
    }
  }

  renderComparison();
  renderBaselineRegistry();
  return comparisonReport;
}

function setBaseline(report, { origin = "baseline" } = {}) {
  const validation = validateQaReport(report);
  if (!validation.valid) {
    baselineReport = null;
    baselineOrigin = null;
    baselineCompatibility = null;
    comparisonReport = {
      valid: false,
      errors: validation.errors.map((message) => `baseline: ${message}`),
    };
    renderComparison();
    renderBaselineRegistry();
    return false;
  }
  baselineReport = report;
  baselineOrigin = origin;
  runComparison();
  renderBaselineRegistry();
  return true;
}

async function loadBaselineFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const report = JSON.parse(text);
    if (!setBaseline(report, { origin: "file" })) return;
  } catch (error) {
    baselineReport = null;
    comparisonReport = {
      valid: false,
      errors: [`baseline file: ${error.message}`],
    };
    renderComparison();
  }
}

function finishRecording(endedAtMs = Date.now()) {
  if (!recordingSession) return null;
  lastReport = finalizeQaSession(recordingSession, { endedAtMs });
  recordingSession = null;
  lastRecordSampleAt = 0;
  renderReportSummary();
  runComparison();
  return lastReport;
}

async function startRecording({
  targetDurationSeconds = RECORD_DURATION_SECONDS,
  metadata = {},
} = {}) {
  if (recordingSession) return;

  if (!music.running) {
    qaBadge.textContent = "STARTING";
    await music.start("normal");
  }

  const info = refreshStaticInfo();
  const meter = music.meter();
  const now = Date.now();

  lastReport = null;
  comparisonReport = null;
  renderComparison();
  recordingSession = createQaSession({
    startedAtMs: now,
    targetDurationSeconds,
    sampleIntervalMs: RECORD_SAMPLE_INTERVAL_MS,
    metadata: {
      packId: info.packId || info.id || selectedQaPackId,
      packName: info.packName || info.name || selectedQaPackId,
      packVersion: info.version || null,
      engine: info.engine || null,
      audioFormat: info.audioFormat || null,
      masteringProfile: info.masteringProfile || info.mastering?.profile || null,
      facadeApi: info.facadeApi || null,
      initialSampleRate: meter?.sampleRate || null,
      userAgent: navigator.userAgent,
      platform: navigator.platform || null,
      ...metadata,
    },
  });

  addQaSample(recordingSession, meter, {
    capturedAtMs: now,
    bar,
    beat,
    scenarioStage: activeQaStage(),
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
    scenarioStage: activeQaStage(),
  });
  lastRecordSampleAt = now;

  const targetMs = recordingSession.targetDurationSeconds * 1000;
  if (
    now - recordingSession.startedAtMs >= targetMs &&
    !scenarioRun &&
    !routeMatrixRun
  ) {
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

async function shareOrDownload(contents, {
  mime,
  filename,
  title,
  text,
}) {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });

  if (typeof File === "function" && typeof navigator.share === "function") {
    const file = new File([blob], filename, { type: mime });
    try {
      if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("File share failed; using download fallback", error);
    }
  }

  downloadBlob(blob, filename);
}

async function exportReport(format) {
  if (!lastReport) return;

  const json = format === "json";
  const contents = json
    ? JSON.stringify(lastReport, null, 2)
    : qaReportToCsv(lastReport);
  const mime = json ? "application/json" : "text/csv";
  const filename = qaReportFilename(lastReport, format);

  await shareOrDownload(contents, {
    mime,
    filename,
    title: "Game Music QA Report",
    text: `${lastReport.metadata?.packName || "Music"} · ${lastReport.summary?.verdict || "qa"}`,
  });
}

async function exportComparison(format) {
  if (!comparisonReport?.valid) return;

  const json = format === "json";
  const contents = json
    ? JSON.stringify(comparisonReport, null, 2)
    : qaComparisonToCsv(comparisonReport);
  const mime = json ? "application/json" : "text/csv";
  const filename = qaComparisonFilename(comparisonReport, format);

  await shareOrDownload(contents, {
    mime,
    filename,
    title: "Game Music QA Regression Compare",
    text: `${comparisonReport.current?.packId || "Music"} · ${comparisonReport.status}`,
  });
}

function render() {
  const meter = music.meter();
  const runtimeInfo = music.info();

  if (
    runtimeInfo.id !== staticInfo?.id ||
    runtimeInfo.masteringProfile !== staticInfo?.masteringProfile
  ) {
    staticInfo = runtimeInfo;
  }

  if (
    !meter?.hotSwap &&
    meter?.packId &&
    meter.packId !== selectedQaPackId &&
    scenarioRun?.status !== "running"
  ) {
    selectedQaPackId = meter.packId;
    qaPackSelect.value = selectedQaPackId;
    qaScenario = createPackScenario(selectedQaPackId);
    updateQaPackLabel();
    syncHotSwapTargetOptions(selectedQaPackId);
    if (!recordingSession) restoreSavedPackBaseline(selectedQaPackId);
  }

  const info = staticInfo;
  const mastering = info.mastering;

  transport.textContent = music.running ? `BAR ${bar || 1} · BEAT ${beat || 1}` : "BAR — · BEAT —";
  formatLine.textContent = `${info.name || selectedQaPackId} · ${String(info.audioFormat || "audio").toUpperCase()}`;

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
  renderHotSwap(meter);
  renderStems(meter?.stems || {});
  captureRecorderSample(meter);
  renderReportSummary();

  pushHistory(Number(meter?.output?.peakDbfs ?? -60), reduction);
  drawHistory();
}

function animationFrame(time) {
  if (time - lastRenderAt >= 100) {
    lastRenderAt = time;
    const now = performance.now();
    void advanceScenario(now);
    void advanceRouteMatrix(now);
    renderScenario();
    renderRouteMatrix();
    render();
  }
  requestAnimationFrame(animationFrame);
}

qaPackSelect.addEventListener("change", () => {
  void switchQaPack(qaPackSelect.value);
});


hotSwapTargetSelect.addEventListener("change", () => renderHotSwap());
hotSwapCurveSelect.addEventListener("change", () => renderHotSwap());
scheduleHotSwapButton.addEventListener("click", () => {
  void scheduleHotSwap();
});
cancelHotSwapButton.addEventListener("click", () => {
  music.cancel("pack");
  renderHotSwap();
});

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
  if (routeMatrixBusy()) abortRouteMatrix("audio-stop");
  else if (scenarioRun?.status === "running") abortScenario("audio-stop");
  else if (recordingSession) finishRecording();
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

runRouteMatrixButton.addEventListener("click", () => {
  void startHotSwapRouteMatrix().catch((error) => {
    console.error(error);
    routeMatrixPreparing = false;
    routeMatrixStatus.textContent = "ERROR";
    routeMatrixStatus.className = "route-matrix-status fail";
    routeMatrixStatusText.textContent = `MATRIX ERROR · ${error.message}`;
    if (routeMatrixRun?.status === "running") abortRouteMatrix("start-error");
    else {
      ++routeMatrixToken;
      renderRouteMatrix();
      renderBaselineRegistry();
    }
  });
});
cancelRouteMatrixButton.addEventListener("click", () => {
  abortRouteMatrix("user-cancelled");
});

runScenarioButton.addEventListener("click", () => {
  void startStandardScenario().catch((error) => {
    console.error(error);
    scenarioStatus.textContent = `SCENARIO ERROR · ${error.message}`;
    if (scenarioRun?.status === "running") abortScenario("start-error");
  });
});
cancelScenarioButton.addEventListener("click", () => abortScenario("user-cancelled"));
recordStopButton.addEventListener("click", () => {
  if (routeMatrixIsRunning()) abortRouteMatrix("manual-stop");
  else if (scenarioRun?.status === "running") abortScenario("manual-stop");
  else finishRecording();
});
exportJsonButton.addEventListener("click", () => void exportReport("json"));
exportCsvButton.addEventListener("click", () => void exportReport("csv"));

baselineFile.addEventListener("change", () => {
  const [file] = baselineFile.files || [];
  void loadBaselineFile(file);
  baselineFile.value = "";
});
useCurrentBaselineButton.addEventListener("click", () => {
  if (!lastReport) return;
  setBaseline(
    typeof structuredClone === "function"
      ? structuredClone(lastReport)
      : JSON.parse(JSON.stringify(lastReport)),
    { origin: "current" }
  );
});
exportCompareJsonButton.addEventListener("click", () => void exportComparison("json"));
exportCompareCsvButton.addEventListener("click", () => void exportComparison("csv"));
savePackBaselineButton.addEventListener("click", saveSelectedPackBaseline);
deletePackBaselineButton.addEventListener("click", deleteSelectedPackBaseline);
sharePackBaselineButton.addEventListener("click", () => void shareSavedPackBaseline());

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  if (routeMatrixBusy()) {
    abortRouteMatrix("page-hidden");
  } else if (scenarioRun?.status === "running") {
    abortScenario("page-hidden");
  }
});

updateQaPackLabel();
restoreSavedPackBaseline(selectedQaPackId);
void preloadCurrentQaPack();

renderHotSwapMonitor();
renderReportSummary();
renderComparison();
renderBaselineRegistry();
renderScenario();
renderRouteMatrix();
render();
requestAnimationFrame(animationFrame);
