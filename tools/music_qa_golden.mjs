import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { pulsePack, pulseManifest } from "../src/music-packs/pulse.js";
import { STANDARD_QA_SCENARIO } from "../src/music-qa-scenario.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = path.join(ROOT, "qa", "baselines", "pulse-standard-v1.json");
const RENDER_SCHEMA_VERSION = "1.0.0";
const RENDER_PROFILE = "offline-pre-limiter-v1";

const POLICY = Object.freeze({
  maxOverallPeakIncreaseDb: 0.75,
  maxStagePeakIncreaseDb: 0.75,
  maxOverallRmsIncreaseDb: 1.5,
  maxStageRmsIncreaseDb: 1.5,
  maxAbsolutePeakDbfs: 3.0,
});

const STAGE_PROFILE = Object.freeze({
  normal: Object.freeze({ durationSeconds: 10, preset: "focus", oneShots: Object.freeze([]) }),
  build: Object.freeze({
    durationSeconds: 10,
    preset: "build",
    oneShots: Object.freeze([
      Object.freeze({ kind: "transitions", name: "riser", gain: 0.72 }),
    ]),
  }),
  overdrive: Object.freeze({
    durationSeconds: 20,
    preset: "overdrive",
    oneShots: Object.freeze([
      Object.freeze({ kind: "transitions", name: "fill", gain: 0.72 }),
    ]),
  }),
  result: Object.freeze({
    durationSeconds: 20,
    preset: "result",
    oneShots: Object.freeze([
      Object.freeze({ kind: "transitions", name: "impact", gain: 0.72 }),
      Object.freeze({ kind: "stingers", name: "victory", gain: 1.0 }),
    ]),
  }),
});

const round = (value, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};
const dbToGain = (db) => 10 ** (Number(db) / 20);
const amplitudeToDb = (value) => 20 * Math.log10(Math.max(Number(value) || 0, 1e-12));

function readWav(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const bytes = fs.readFileSync(absolutePath);
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Unsupported WAV container: " + relativePath);
  }

  let offset = 12;
  let format = null;
  let data = null;

  while (offset + 8 <= bytes.length) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = Math.min(bytes.length, start + size);

    if (id === "fmt ") {
      format = {
        audioFormat: bytes.readUInt16LE(start),
        channels: bytes.readUInt16LE(start + 2),
        sampleRate: bytes.readUInt32LE(start + 4),
        bitsPerSample: bytes.readUInt16LE(start + 14),
      };
    } else if (id === "data") {
      data = bytes.subarray(start, end);
    }

    offset = start + size + (size % 2);
  }

  if (!format || !data) throw new Error("Missing fmt/data chunk: " + relativePath);
  if (format.audioFormat !== 1 || format.channels !== 2 || format.bitsPerSample !== 16) {
    throw new Error(
      "Golden renderer requires PCM16 stereo: " + relativePath +
      " format=" + format.audioFormat +
      " channels=" + format.channels +
      " bits=" + format.bitsPerSample
    );
  }

  const frameCount = Math.floor(data.length / 4);
  const left = new Float64Array(frameCount);
  const right = new Float64Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const byteOffset = frame * 4;
    left[frame] = data.readInt16LE(byteOffset) / 32768;
    right[frame] = data.readInt16LE(byteOffset + 2) / 32768;
  }

  return {
    relativePath,
    sampleRate: format.sampleRate,
    channels: format.channels,
    frameCount,
    left,
    right,
    bytes,
  };
}

function assetPath(kind, name) {
  if (kind === "stems") return "assets/stems/pulse/" + name + ".wav";
  if (kind === "stingers") return "assets/stingers/pulse/" + name + ".wav";
  if (kind === "transitions") return "assets/transitions/pulse/" + name + ".wav";
  throw new Error("Unknown golden asset kind: " + kind);
}

function loadAssets() {
  const assets = { stems: {}, stingers: {}, transitions: {} };

  for (const name of ["drums", "bass", "chords", "melody", "sparkle"]) {
    assets.stems[name] = readWav(assetPath("stems", name));
  }
  for (const name of ["victory", "gameover"]) {
    assets.stingers[name] = readWav(assetPath("stingers", name));
  }
  for (const name of ["fill", "whoosh", "riser", "impact"]) {
    assets.transitions[name] = readWav(assetPath("transitions", name));
  }

  const rates = new Set(
    Object.values(assets).flatMap((group) =>
      Object.values(group).map((asset) => asset.sampleRate)
    )
  );
  if (rates.size !== 1) {
    throw new Error("Golden assets have mixed sample rates: " + [...rates].join(","));
  }

  return { assets, sampleRate: [...rates][0] };
}

function measureStage({ stage, config, assets, sampleRate, trimGain }) {
  const preset = pulsePack.layerPresets?.[config.preset];
  if (!preset) throw new Error("Missing Pulse layer preset: " + config.preset);

  const totalFrames = Math.round(config.durationSeconds * sampleRate);
  let peak = 0;
  let energy = 0;

  for (let frame = 0; frame < totalFrames; frame += 1) {
    let left = 0;
    let right = 0;

    for (const [name, gain] of Object.entries(preset)) {
      const stem = assets.stems[name];
      if (!stem) throw new Error("Missing stem for preset: " + name);
      const stemFrame = frame % stem.frameCount;
      left += stem.left[stemFrame] * Number(gain);
      right += stem.right[stemFrame] * Number(gain);
    }

    for (const oneShot of config.oneShots) {
      const asset = assets[oneShot.kind]?.[oneShot.name];
      if (!asset) throw new Error("Missing one-shot: " + oneShot.kind + "/" + oneShot.name);
      if (frame < asset.frameCount) {
        left += asset.left[frame] * Number(oneShot.gain ?? 1);
        right += asset.right[frame] * Number(oneShot.gain ?? 1);
      }
    }

    left *= trimGain;
    right *= trimGain;
    peak = Math.max(peak, Math.abs(left), Math.abs(right));
    energy += (left * left + right * right) * 0.5;
  }

  const rms = Math.sqrt(energy / Math.max(1, totalFrames));
  return {
    stage,
    preset: config.preset,
    durationSeconds: config.durationSeconds,
    frameCount: totalFrames,
    peakDbfs: round(amplitudeToDb(peak)),
    rmsDbfs: round(amplitudeToDb(rms)),
    peakLinear: round(peak, 6),
    rmsLinear: round(rms, 6),
    oneShots: config.oneShots.map((item) => ({
      kind: item.kind,
      name: item.name,
      gain: item.gain,
    })),
  };
}

function fingerprintInputs(assets) {
  const hash = crypto.createHash("sha256");
  for (const group of ["stems", "stingers", "transitions"]) {
    for (const name of Object.keys(assets[group]).sort()) {
      const asset = assets[group][name];
      hash.update(group + "/" + name + "\0");
      hash.update(asset.bytes);
    }
  }

  hash.update(JSON.stringify({
    layerPresets: pulsePack.layerPresets,
    mastering: pulsePack.mastering,
    scenario: STANDARD_QA_SCENARIO,
    stageProfile: STAGE_PROFILE,
  }));

  return hash.digest("hex");
}

export function buildGoldenCandidate() {
  const loaded = loadAssets();
  const assets = loaded.assets;
  const sampleRate = loaded.sampleRate;
  const headroomDb = Number(pulsePack.mastering?.headroomDb ?? -3);
  const trimGain = dbToGain(headroomDb);

  const stages = {};
  let totalEnergyFrames = 0;
  let totalFrames = 0;
  let overallPeak = 0;

  for (const [stage, config] of Object.entries(STAGE_PROFILE)) {
    const metrics = measureStage({ stage, config, assets, sampleRate, trimGain });
    stages[stage] = metrics;
    totalFrames += metrics.frameCount;
    overallPeak = Math.max(overallPeak, metrics.peakLinear);
    totalEnergyFrames += (metrics.rmsLinear ** 2) * metrics.frameCount;
  }

  const overallRms = Math.sqrt(totalEnergyFrames / Math.max(1, totalFrames));

  return {
    schemaVersion: RENDER_SCHEMA_VERSION,
    id: "pulse-standard-v1-golden",
    renderProfile: RENDER_PROFILE,
    pack: {
      id: pulseManifest.id,
      version: pulseManifest.version,
      masteringProfile: pulseManifest.masteringProfile,
      facadeApi: pulseManifest.facadeApi,
    },
    scenario: {
      id: STANDARD_QA_SCENARIO.id,
      version: STANDARD_QA_SCENARIO.version,
      durationMs: STANDARD_QA_SCENARIO.durationMs,
    },
    audio: {
      sampleRate,
      channels: 2,
      headroomDb,
    },
    sourceFingerprint: fingerprintInputs(assets),
    policy: { ...POLICY },
    overall: {
      durationSeconds: round(totalFrames / sampleRate),
      peakDbfs: round(amplitudeToDb(overallPeak)),
      rmsDbfs: round(amplitudeToDb(overallRms)),
    },
    stages,
  };
}

function compareNumber(label, baseline, current, limit, failures, notes) {
  const delta = current - baseline;
  notes.push(
    label + ": " + baseline.toFixed(3) + " -> " + current.toFixed(3) +
    " dB (delta " + (delta >= 0 ? "+" : "") + delta.toFixed(3) + " dB)"
  );
  if (delta > limit + 1e-9) {
    failures.push(
      label + " increased by " + delta.toFixed(3) +
      " dB (limit +" + limit.toFixed(3) + " dB)"
    );
  }
}


function summaryMetricStatus(deltaDb, limitDb) {
  if (Number(deltaDb) > Number(limitDb) + 1e-9) return "FAIL";
  if (Number(deltaDb) <= -0.1) return "IMPROVED";
  return "PASS";
}

function metricRow(scope, metric, baselineValue, currentValue, limitDb) {
  const baselineDb = Number(baselineValue);
  const currentDb = Number(currentValue);
  const deltaDb = currentDb - baselineDb;
  return {
    scope,
    metric,
    baselineDb,
    currentDb,
    deltaDb,
    limitDb: Number(limitDb),
    status: summaryMetricStatus(deltaDb, limitDb),
  };
}

export function goldenComparisonRows(baseline, current) {
  const policy = { ...POLICY, ...(baseline?.policy || {}) };
  const rows = [
    metricRow(
      "OVERALL",
      "Peak",
      baseline?.overall?.peakDbfs,
      current?.overall?.peakDbfs,
      policy.maxOverallPeakIncreaseDb,
    ),
    metricRow(
      "OVERALL",
      "RMS",
      baseline?.overall?.rmsDbfs,
      current?.overall?.rmsDbfs,
      policy.maxOverallRmsIncreaseDb,
    ),
  ];

  const stageNames = [...new Set([
    ...Object.keys(baseline?.stages || {}),
    ...Object.keys(current?.stages || {}),
  ])].sort();

  for (const stage of stageNames) {
    const before = baseline?.stages?.[stage];
    const after = current?.stages?.[stage];
    if (!before || !after) continue;

    rows.push(
      metricRow(
        stage.toUpperCase(),
        "Peak",
        before.peakDbfs,
        after.peakDbfs,
        policy.maxStagePeakIncreaseDb,
      ),
      metricRow(
        stage.toUpperCase(),
        "RMS",
        before.rmsDbfs,
        after.rmsDbfs,
        policy.maxStageRmsIncreaseDb,
      ),
    );
  }

  return rows;
}

function markdownDb(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) + " dB" : "—";
}

function markdownDelta(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return (number > 0 ? "+" : "") + number.toFixed(2) + " dB";
}

function markdownStatus(value) {
  if (value === "FAIL") return "**FAIL**";
  if (value === "IMPROVED") return "**IMPROVED**";
  return "PASS";
}

export function buildGoldenQaMarkdown(
  baseline,
  current,
  result = checkGoldenBaseline(baseline, current),
) {
  const rows = goldenComparisonRows(baseline, current);
  const status = result.passed ? "PASS" : "FAIL";
  const fingerprintChanged = baseline?.sourceFingerprint !== current?.sourceFingerprint;

  const lines = [
    "# Music Golden QA",
    "",
    "**Result: " + status + "** · " + (current?.scenario?.id || "unknown") + " · " +
      (current?.overall?.durationSeconds ?? "?") + " sec",
    "",
    "| Scope | Metric | Baseline | Current | Delta | Allowed increase | Result |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const row of rows) {
    lines.push(
      "| " + row.scope +
      " | " + row.metric +
      " | " + markdownDb(row.baselineDb) +
      " | " + markdownDb(row.currentDb) +
      " | " + markdownDelta(row.deltaDb) +
      " | +" + Number(row.limitDb).toFixed(2) + " dB" +
      " | " + markdownStatus(row.status) + " |"
    );
  }

  lines.push(
    "",
    "## Run contract",
    "",
    "| Item | Baseline | Current |",
    "| --- | --- | --- |",
    "| Pack | " + (baseline?.pack?.id || "?") + "@" + (baseline?.pack?.version || "?") +
      " | " + (current?.pack?.id || "?") + "@" + (current?.pack?.version || "?") + " |",
    "| Facade API | " + (baseline?.pack?.facadeApi || "?") +
      " | " + (current?.pack?.facadeApi || "?") + " |",
    "| Scenario | " + (baseline?.scenario?.id || "?") + "@" + (baseline?.scenario?.version || "?") +
      " | " + (current?.scenario?.id || "?") + "@" + (current?.scenario?.version || "?") + " |",
    "| Sample rate | " + (baseline?.audio?.sampleRate || "?") +
      " Hz | " + (current?.audio?.sampleRate || "?") + " Hz |",
    "| Mastering | " + (baseline?.pack?.masteringProfile || "?") +
      " | " + (current?.pack?.masteringProfile || "?") + " |",
    "| Source fingerprint | " + String(baseline?.sourceFingerprint || "?").slice(0, 16) +
      "… | " + String(current?.sourceFingerprint || "?").slice(0, 16) + "… |",
    "",
    "Fingerprint changed: **" + (fingerprintChanged ? "YES" : "NO") + "**",
  );

  if (result.failures.length) {
    lines.push("", "## Blocking regressions", "");
    result.failures.forEach((message) => lines.push("- " + message));
  }

  if (result.warnings.length) {
    lines.push("", "## Warnings", "");
    result.warnings.forEach((message) => lines.push("- " + message));
  }

  lines.push(
    "",
    "## Policy",
    "",
    "- Overall / Stage Peak: block increases above the configured Golden limit.",
    "- Overall / Stage RMS: block increases above the configured Golden limit.",
    "- Absolute pre-limiter peak guard: +" +
      Number(baseline?.policy?.maxAbsolutePeakDbfs ?? POLICY.maxAbsolutePeakDbfs).toFixed(2) +
      " dBFS.",
    "- Post-limiter and device-specific behavior remain covered by the iPhone Audio QA Dashboard.",
    "",
    "_Generated from repository WAV files by tools/music_qa_golden.mjs._",
    "",
  );

  return lines.join("\n");
}

export function appendGoldenGitHubSummary(markdown, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  if (!summaryPath) return false;
  fs.appendFileSync(summaryPath, markdown.endsWith("\n") ? markdown : markdown + "\n");
  return true;
}

export function buildGoldenQaReport(
  baseline,
  current,
  result = checkGoldenBaseline(baseline, current),
) {
  return {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    type: "music-golden-qa",
    passed: Boolean(result.passed),
    baseline: {
      id: baseline?.id || null,
      pack: baseline?.pack || null,
      scenario: baseline?.scenario || null,
      audio: baseline?.audio || null,
      sourceFingerprint: baseline?.sourceFingerprint || null,
      overall: baseline?.overall || null,
      stages: baseline?.stages || {},
    },
    current: {
      id: current?.id || null,
      pack: current?.pack || null,
      scenario: current?.scenario || null,
      audio: current?.audio || null,
      sourceFingerprint: current?.sourceFingerprint || null,
      overall: current?.overall || null,
      stages: current?.stages || {},
    },
    policy: { ...(baseline?.policy || POLICY) },
    metrics: goldenComparisonRows(baseline, current),
    failures: [...result.failures],
    warnings: [...result.warnings],
  };
}

export function writeGoldenQaReport(report, reportPath = process.env.GOLDEN_QA_REPORT_PATH) {
  if (!reportPath) return false;
  const resolved = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(report, null, 2) + "\n");
  return true;
}

function githubCommandEscape(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

export function checkGoldenBaseline(baseline, current) {
  const failures = [];
  const warnings = [];
  const notes = [];

  for (const field of ["schemaVersion", "id", "renderProfile"]) {
    if (baseline?.[field] !== current?.[field]) {
      failures.push(field + " mismatch: " + baseline?.[field] + " -> " + current?.[field]);
    }
  }

  if (baseline?.pack?.id !== current?.pack?.id) {
    failures.push("pack id mismatch: " + baseline?.pack?.id + " -> " + current?.pack?.id);
  }
  if (baseline?.scenario?.id !== current?.scenario?.id) {
    failures.push("scenario id mismatch: " + baseline?.scenario?.id + " -> " + current?.scenario?.id);
  }
  if (baseline?.scenario?.version !== current?.scenario?.version) {
    failures.push(
      "scenario version mismatch: " + baseline?.scenario?.version + " -> " + current?.scenario?.version
    );
  }
  if (baseline?.audio?.sampleRate !== current?.audio?.sampleRate) {
    failures.push(
      "sample rate mismatch: " + baseline?.audio?.sampleRate + " -> " + current?.audio?.sampleRate
    );
  }
  if (baseline?.pack?.masteringProfile !== current?.pack?.masteringProfile) {
    failures.push(
      "mastering profile mismatch: " + baseline?.pack?.masteringProfile +
      " -> " + current?.pack?.masteringProfile
    );
  }

  const policy = { ...POLICY, ...(baseline?.policy || {}) };

  compareNumber(
    "overall peak",
    Number(baseline.overall.peakDbfs),
    Number(current.overall.peakDbfs),
    Number(policy.maxOverallPeakIncreaseDb),
    failures,
    notes,
  );
  compareNumber(
    "overall RMS",
    Number(baseline.overall.rmsDbfs),
    Number(current.overall.rmsDbfs),
    Number(policy.maxOverallRmsIncreaseDb),
    failures,
    notes,
  );

  if (Number(current.overall.peakDbfs) > Number(policy.maxAbsolutePeakDbfs)) {
    failures.push(
      "overall pre-limiter peak " + current.overall.peakDbfs +
      " dBFS exceeds absolute guard " + policy.maxAbsolutePeakDbfs + " dBFS"
    );
  }

  const stageNames = [...new Set([
    ...Object.keys(baseline?.stages || {}),
    ...Object.keys(current?.stages || {}),
  ])].sort();

  for (const stage of stageNames) {
    const before = baseline?.stages?.[stage];
    const after = current?.stages?.[stage];
    if (!before || !after) {
      failures.push(
        "stage set changed: " + stage +
        " baseline=" + Boolean(before) +
        " current=" + Boolean(after)
      );
      continue;
    }

    compareNumber(
      stage + " peak",
      Number(before.peakDbfs),
      Number(after.peakDbfs),
      Number(policy.maxStagePeakIncreaseDb),
      failures,
      notes,
    );
    compareNumber(
      stage + " RMS",
      Number(before.rmsDbfs),
      Number(after.rmsDbfs),
      Number(policy.maxStageRmsIncreaseDb),
      failures,
      notes,
    );
  }

  if (baseline.sourceFingerprint !== current.sourceFingerprint) {
    warnings.push("source fingerprint changed; metrics stayed within the golden policy");
  }
  if (baseline?.pack?.version !== current?.pack?.version) {
    warnings.push(
      "pack version changed: " + baseline?.pack?.version + " -> " + current?.pack?.version
    );
  }
  if (baseline?.pack?.facadeApi !== current?.pack?.facadeApi) {
    warnings.push(
      "Facade API changed: " + baseline?.pack?.facadeApi + " -> " + current?.pack?.facadeApi
    );
  }

  return { passed: failures.length === 0, failures, warnings, notes };
}

function writeBaseline(candidate) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(candidate, null, 2) + "\n");
  console.log("Golden QA baseline written: " + path.relative(ROOT, BASELINE_PATH));
}

function main() {
  const mode = process.argv[2] || "--check";
  const candidate = buildGoldenCandidate();

  if (mode === "--print") {
    console.log(JSON.stringify(candidate, null, 2));
    return;
  }
  if (mode === "--write") {
    writeBaseline(candidate);
    return;
  }
  if (mode !== "--check") {
    throw new Error("Unknown mode: " + mode + ". Use --check, --print, or --write.");
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    console.error("Golden QA baseline missing: " + path.relative(ROOT, BASELINE_PATH));
    console.error("Bootstrap with: node tools/music_qa_golden.mjs --write");
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const result = checkGoldenBaseline(baseline, candidate);
  const markdown = buildGoldenQaMarkdown(baseline, candidate, result);
  const report = buildGoldenQaReport(baseline, candidate, result);
  const summaryWritten = appendGoldenGitHubSummary(markdown);
  const reportWritten = writeGoldenQaReport(report);

  console.log("Music Golden QA Regression Gate");
  result.notes.forEach((line) => console.log("- " + line));
  result.warnings.forEach((line) => console.warn("WARNING: " + line));
  if (summaryWritten) console.log("- GitHub Actions Summary: written");
  if (reportWritten) console.log("- Golden QA JSON Report: written");

  if (!result.passed) {
    console.error("Music Golden QA Regression Gate FAILED");
    result.failures.forEach((line) => {
      console.error("- " + line);
      if (process.env.GITHUB_ACTIONS === "true") {
        console.error("::error title=Music Golden QA::" + githubCommandEscape(line));
      }
    });
    process.exit(1);
  }

  console.log("Music Golden QA Regression Gate PASSED");
  console.log("- baseline: " + path.relative(ROOT, BASELINE_PATH));
  console.log("- fingerprint: " + candidate.sourceFingerprint.slice(0, 16) + "...");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
