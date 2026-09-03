import { MusicFacade } from "../src/music-facade.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let releaseLayer;
const layerGate = new Promise((resolve) => {
  releaseLayer = resolve;
});

const calls = [];
const manager = {
  running: true,
  context: { currentTime: 10 },
  getQuantizedTime(quantize) {
    calls.push({ type: "quantize", quantize });
    return 12;
  },
  async setLayerPreset(name, options) {
    calls.push({ type: "layer", name, options: { ...options } });
    await layerGate;
  },
  async transitionTo(name, options) {
    calls.push({ type: "transition", name, options: { ...options } });
  },
  async playStinger(name, options) {
    calls.push({ type: "stinger", name, options: { ...options } });
    return {
      format: "m4a",
      quantize: options.quantize,
      scheduledAt: options.scheduledAt,
      delaySeconds: Math.max(0, Number(options.scheduledAt || 0) - this.context.currentTime),
    };
  },
  sfx() {},
  getPackInfo() {
    return { id: "test-pack", name: "Test Pack" };
  },
};

const runtime = {
  engine: "wav-stem",
  entry: {
    id: "test-pack",
    name: "Test Pack",
    pack: {
      modes: {
        result: { label: "RESULT" },
      },
      layerPresets: {
        result: {
          drums: 0,
          bass: 0,
          chords: 0,
          melody: 0,
          sparkle: 0,
        },
      },
    },
  },
  manager,
  capabilities: {
    stingers: true,
    transitionCues: false,
    layerMix: true,
  },
  audioFormatCandidates: [],
};

const music = new MusicFacade(runtime);

const statePromise = music.state("result", { quantize: "bar", fadeBeats: 1 });
const outcomePromise = music.outcome(true);

await Promise.resolve();
assert(
  !calls.some((call) => call.type === "stinger"),
  "Outcome must wait for an in-flight result state before scheduling the stinger",
);

releaseLayer();

const [stateResult, outcomeResult] = await Promise.all([statePromise, outcomePromise]);
const stinger = calls.find((call) => call.type === "stinger");

assert(stateResult?.scheduledAt === 12, "Result state should schedule at the next bar time");
assert(stinger, "Victory stinger should be scheduled");
assert(
  stinger.options.scheduledAt === stateResult.scheduledAt,
  "Result state and stinger must share the exact scheduledAt value",
);
assert(
  stinger.options.quantize === stateResult.quantize,
  "Outcome should inherit the result state's quantize mode when omitted",
);
assert(
  outcomeResult?.scheduledAt === stateResult.scheduledAt,
  "Outcome result should report the shared scheduledAt value",
);

console.log("Music result synchronization check PASSED");
