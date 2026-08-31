import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGoldenCandidate,
  checkGoldenBaseline,
} from "./music_qa_golden.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(ROOT, "qa", "baselines", "pulse-standard-v1.json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const current = buildGoldenCandidate();
const errors = [];

const clone = (value) => JSON.parse(JSON.stringify(value));

const exact = checkGoldenBaseline(baseline, current);
if (!exact.passed) {
  errors.push("current Golden candidate must pass: " + exact.failures.join("; "));
}

const hotOverall = clone(current);
hotOverall.overall.peakDbfs += 1.0;
const hotOverallResult = checkGoldenBaseline(baseline, hotOverall);
if (hotOverallResult.passed) {
  errors.push("overall +1 dB peak regression was not rejected");
}
if (!hotOverallResult.failures.some((message) => message.includes("overall peak"))) {
  errors.push("overall peak failure reason missing");
}

const hotStage = clone(current);
hotStage.stages.overdrive.peakDbfs += 1.0;
const hotStageResult = checkGoldenBaseline(baseline, hotStage);
if (hotStageResult.passed) {
  errors.push("OVERDRIVE +1 dB peak regression was not rejected");
}
if (!hotStageResult.failures.some((message) => message.includes("overdrive peak"))) {
  errors.push("OVERDRIVE peak failure reason missing");
}

const loudStage = clone(current);
loudStage.stages.build.rmsDbfs += 2.0;
const loudStageResult = checkGoldenBaseline(baseline, loudStage);
if (loudStageResult.passed) {
  errors.push("BUILD +2 dB RMS regression was not rejected");
}

const safer = clone(current);
safer.overall.peakDbfs -= 1.0;
safer.stages.overdrive.peakDbfs -= 1.0;
safer.sourceFingerprint = "changed-but-safer";
const saferResult = checkGoldenBaseline(baseline, safer);
if (!saferResult.passed) {
  errors.push("safer candidate should pass Golden policy");
}
if (!saferResult.warnings.some((message) => message.includes("fingerprint"))) {
  errors.push("changed source fingerprint warning missing");
}

const wrongScenario = clone(current);
wrongScenario.scenario.id = "other-scenario";
const wrongScenarioResult = checkGoldenBaseline(baseline, wrongScenario);
if (wrongScenarioResult.passed) {
  errors.push("scenario ID mismatch was not rejected");
}

const wrongRate = clone(current);
wrongRate.audio.sampleRate = 48000;
const wrongRateResult = checkGoldenBaseline(baseline, wrongRate);
if (wrongRateResult.passed) {
  errors.push("sample-rate mismatch was not rejected");
}

if (errors.length) {
  console.error("Music Golden QA Gate Check FAILED");
  errors.forEach((error) => console.error("- " + error));
  process.exit(1);
}

console.log("Music Golden QA Gate Check PASSED");
console.log("- current baseline parity: OK");
console.log("- overall peak regression: BLOCKED");
console.log("- stage peak/RMS regression: BLOCKED");
console.log("- safer source change: ALLOWED + WARNING");
console.log("- scenario/sample-rate mismatch: BLOCKED");
