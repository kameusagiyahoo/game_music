import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGoldenCandidate,
  checkGoldenBaseline,
  goldenComparisonRows,
  buildGoldenQaMarkdown,
  appendGoldenGitHubSummary,
  buildGoldenQaReport,
  writeGoldenQaReport,
} from "./music_qa_golden_fantasy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(ROOT, "qa", "baselines", "fantasy-standard-v1.json");
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

const exactRows = goldenComparisonRows(baseline, current);
if (exactRows.length !== 10) {
  errors.push("Golden summary should contain 10 metric rows, got " + exactRows.length);
}
for (const scope of ["OVERALL", "NORMAL", "BUILD", "OVERDRIVE", "RESULT"]) {
  if (!exactRows.some((row) => row.scope === scope)) {
    errors.push("Golden summary row missing scope: " + scope);
  }
}

const exactMarkdown = buildGoldenQaMarkdown(baseline, current, exact);
if (!exactMarkdown.includes("**Result: PASS**")) {
  errors.push("PASS heading missing from Golden markdown");
}
if (!exactMarkdown.includes("| OVERDRIVE | Peak |")) {
  errors.push("OVERDRIVE Peak row missing from Golden markdown");
}
if (!exactMarkdown.includes("Fingerprint changed: **NO**")) {
  errors.push("unchanged fingerprint marker missing");
}

const hotMarkdown = buildGoldenQaMarkdown(baseline, hotOverall, hotOverallResult);
if (!hotMarkdown.includes("**Result: FAIL**")) {
  errors.push("FAIL heading missing from Golden markdown");
}
if (!hotMarkdown.includes("## Blocking regressions")) {
  errors.push("blocking regressions section missing");
}
const hotRows = goldenComparisonRows(baseline, hotOverall);
if (hotRows.find((row) => row.scope === "OVERALL" && row.metric === "Peak")?.status !== "FAIL") {
  errors.push("overall +1 dB summary row should be FAIL");
}

const saferMarkdown = buildGoldenQaMarkdown(baseline, safer, saferResult);
if (!saferMarkdown.includes("**IMPROVED**")) {
  errors.push("improved metric marker missing from Golden markdown");
}
if (!saferMarkdown.includes("Fingerprint changed: **YES**")) {
  errors.push("changed fingerprint marker missing");
}

const summaryPath = path.join(ROOT, "qa-golden-summary-test.md");
try {
  fs.writeFileSync(summaryPath, "");
  const wrote = appendGoldenGitHubSummary(exactMarkdown, summaryPath);
  if (!wrote) errors.push("appendGoldenGitHubSummary returned false");
  const writtenSummary = fs.readFileSync(summaryPath, "utf8");
  if (!writtenSummary.includes("# Music Golden QA")) {
    errors.push("Golden summary file did not contain heading");
  }
} finally {
  if (fs.existsSync(summaryPath)) fs.unlinkSync(summaryPath);
}

const report = buildGoldenQaReport(baseline, hotOverall, hotOverallResult);
if (report.type !== "music-golden-qa" || report.schemaVersion !== "1.0.0") {
  errors.push("Golden JSON report identity mismatch");
}
if (report.passed !== false) errors.push("regression JSON report should be failed");
if (!report.metrics.some((row) => row.scope === "OVERALL" && row.metric === "Peak" && row.status === "FAIL")) {
  errors.push("Golden JSON report missing failed overall peak metric");
}
if (!report.failures.some((message) => message.includes("overall peak"))) {
  errors.push("Golden JSON report missing failure reason");
}

const reportPath = path.join(ROOT, "qa-golden-report-test.json");
try {
  const wroteReport = writeGoldenQaReport(report, reportPath);
  if (!wroteReport) errors.push("writeGoldenQaReport returned false");
  const diskReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  if (diskReport.type !== "music-golden-qa" || diskReport.metrics.length !== 10) {
    errors.push("Golden JSON report file content mismatch");
  }
} finally {
  if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
}

if (errors.length) {
  console.error("Fantasy Golden QA Gate Check FAILED");
  errors.forEach((error) => console.error("- " + error));
  process.exit(1);
}

console.log("Fantasy Golden QA Gate Check PASSED");
console.log("- current baseline parity: OK");
console.log("- overall peak regression: BLOCKED");
console.log("- stage peak/RMS regression: BLOCKED");
console.log("- safer source change: ALLOWED + WARNING");
console.log("- scenario/sample-rate mismatch: BLOCKED");
console.log("- Actions Summary metric table: OK");
console.log("- PASS / FAIL / IMPROVED rendering: OK");
console.log("- Summary file append: OK");
console.log("- Machine-readable JSON report: OK");
