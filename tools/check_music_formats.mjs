import { pulsePack } from "../src/music-packs/pulse.js";
import {
  getAudioFormatCandidates,
  resolvePackAudioFormat,
  selectAudioFormat,
} from "../src/music-format-resolver.js";

const cases = [
  {
    name: "prefer m4a",
    support: { m4a: "probably", ogg: "probably", wav: "probably" },
    expected: "m4a",
    candidates: ["m4a", "ogg", "wav"],
  },
  {
    name: "fallback to ogg",
    support: { m4a: "no", ogg: "maybe", wav: "probably" },
    expected: "ogg",
    candidates: ["ogg", "wav", "m4a"],
  },
  {
    name: "fallback to wav",
    support: { m4a: "no", ogg: "no", wav: "probably" },
    expected: "wav",
    candidates: ["wav", "m4a", "ogg"],
  },
];

const errors = [];
for (const test of cases) {
  const options = { support: test.support, useSession: false };
  const selection = selectAudioFormat(pulsePack, options);
  if (selection.format !== test.expected) {
    errors.push(`${test.name}: expected ${test.expected}, got ${selection.format}`);
  }

  const chain = getAudioFormatCandidates(pulsePack, options);
  if (JSON.stringify(chain.candidates) !== JSON.stringify(test.candidates)) {
    errors.push(
      `${test.name}: expected candidate chain ${test.candidates.join(" -> ")}, got ${chain.candidates.join(" -> ")}`
    );
  }

  const resolved = resolvePackAudioFormat(pulsePack, options);
  const stemUrl = resolved.pack.audioStems.files.drums || "";
  const stingerUrl = resolved.pack.stingers.files.victory || "";
  if (!stemUrl.endsWith(`.${test.expected}`)) errors.push(`${test.name}: drums URL does not use ${test.expected}`);
  if (!stingerUrl.endsWith(`.${test.expected}`)) errors.push(`${test.name}: victory URL does not use ${test.expected}`);
}

if (errors.length) {
  console.error("Music Format Resolver Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music Format Resolver Check PASSED");
cases.forEach((test) => {
  console.log(`- ${test.name} -> ${test.expected} [${test.candidates.join(" -> ")}]`);
});
