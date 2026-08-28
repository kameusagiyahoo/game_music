import { pulsePack } from "../src/music-packs/pulse.js";
import { resolvePackAudioFormat, selectAudioFormat } from "../src/music-format-resolver.js";

const cases = [
  {
    name: "prefer m4a",
    support: { m4a: "probably", ogg: "probably", wav: "probably" },
    expected: "m4a",
  },
  {
    name: "fallback to ogg",
    support: { m4a: "no", ogg: "maybe", wav: "probably" },
    expected: "ogg",
  },
  {
    name: "fallback to wav",
    support: { m4a: "no", ogg: "no", wav: "probably" },
    expected: "wav",
  },
];

const errors = [];
for (const test of cases) {
  const selection = selectAudioFormat(pulsePack, { support: test.support });
  if (selection.format !== test.expected) {
    errors.push(`${test.name}: expected ${test.expected}, got ${selection.format}`);
  }

  const resolved = resolvePackAudioFormat(pulsePack, { support: test.support });
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
cases.forEach((test) => console.log(`- ${test.name} -> ${test.expected}`));
