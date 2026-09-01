import {
  PACK_CROSSFADE_CURVE,
  PACK_CROSSFADE_CURVE_POINTS,
  buildEqualPowerCrossfadeCurves,
  scheduleEqualPowerCrossfade,
} from "../src/wav-stem-manager.js";

const errors = [];
const near = (a, b, epsilon = 1e-5) =>
  Math.abs(Number(a) - Number(b)) <= epsilon;

const curves = buildEqualPowerCrossfadeCurves();
const last = curves.outgoing.length - 1;
const mid = Math.floor(last / 2);

if (curves.outgoing.length !== PACK_CROSSFADE_CURVE_POINTS) {
  errors.push(`curve point count mismatch: ${curves.outgoing.length}`);
}
if (!near(curves.outgoing[0], 1) || !near(curves.incoming[0], 0)) {
  errors.push("equal-power start point mismatch");
}
if (!near(curves.outgoing[last], 0, 1e-4) || !near(curves.incoming[last], 1)) {
  errors.push("equal-power end point mismatch");
}

const expectedMid = Math.SQRT1_2;
if (!near(curves.outgoing[mid], expectedMid, 2e-4)) {
  errors.push(`outgoing midpoint mismatch: ${curves.outgoing[mid]}`);
}
if (!near(curves.incoming[mid], expectedMid, 2e-4)) {
  errors.push(`incoming midpoint mismatch: ${curves.incoming[mid]}`);
}

let minPower = Infinity;
let maxPower = -Infinity;
for (let index = 0; index < curves.outgoing.length; index += 1) {
  const power =
    curves.outgoing[index] ** 2 +
    curves.incoming[index] ** 2;
  minPower = Math.min(minPower, power);
  maxPower = Math.max(maxPower, power);
  if (!near(power, 1, 2e-5)) {
    errors.push(`power invariant failed at point ${index}: ${power}`);
    break;
  }
}

const linearMidPower = 0.5 ** 2 + 0.5 ** 2;
const legacyFloor = 0.0001;
const legacyExponentialMidGain = Math.sqrt(legacyFloor);
const legacyExponentialMidPower =
  legacyExponentialMidGain ** 2 +
  legacyExponentialMidGain ** 2;
const equalPowerMid =
  curves.outgoing[mid] ** 2 +
  curves.incoming[mid] ** 2;

if (!(equalPowerMid > linearMidPower + 0.49)) {
  errors.push(
    `equal-power midpoint did not preserve constant power: ${equalPowerMid}`
  );
}
if (!(equalPowerMid > legacyExponentialMidPower * 4000)) {
  errors.push(
    `equal-power midpoint did not materially improve v30 exponential power: ${equalPowerMid}`
  );
}

class CurveParam {
  constructor(value) {
    this.value = value;
    this.events = [];
  }
  cancelScheduledValues(time) {
    this.events.push({ type: "cancel", time });
  }
  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "set", value, time });
  }
  setValueCurveAtTime(values, time, duration) {
    this.events.push({
      type: "curve",
      values: Array.from(values),
      time,
      duration,
    });
    this.value = values.at(-1);
  }
  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "exp", value, time });
  }
}

const outgoing = new CurveParam(1);
const incoming = new CurveParam(0);
const scheduled = scheduleEqualPowerCrossfade({
  outgoingParam: outgoing,
  incomingParam: incoming,
  now: 2,
  startTime: 4,
  duration: 1.5,
  outgoingGain: 1,
});

if (scheduled.mode !== PACK_CROSSFADE_CURVE) {
  errors.push(`curve scheduler mode mismatch: ${scheduled.mode}`);
}
if (scheduled.points !== PACK_CROSSFADE_CURVE_POINTS) {
  errors.push(`scheduler curve points mismatch: ${scheduled.points}`);
}
if (!near(scheduled.startTime, 4) || !near(scheduled.endTime, 5.5)) {
  errors.push(`scheduler timing mismatch: ${scheduled.startTime} -> ${scheduled.endTime}`);
}

const outCurve = outgoing.events.find((event) => event.type === "curve");
const inCurve = incoming.events.find((event) => event.type === "curve");
if (!outCurve || !inCurve) {
  errors.push("AudioParam curves were not scheduled");
} else {
  if (!near(outCurve.time, inCurve.time) || !near(outCurve.duration, inCurve.duration)) {
    errors.push("old/new AudioParam curves do not share timing");
  }
  if (!near(outCurve.values[mid], expectedMid, 2e-4)) {
    errors.push("scheduled outgoing midpoint is not equal-power");
  }
  if (!near(inCurve.values[mid], expectedMid, 2e-4)) {
    errors.push("scheduled incoming midpoint is not equal-power");
  }
}

class FallbackParam {
  constructor(value) {
    this.value = value;
    this.events = [];
  }
  cancelScheduledValues(time) {
    this.events.push({ type: "cancel", time });
  }
  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "set", value, time });
  }
  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "exp", value, time });
  }
}

const fallbackOut = new FallbackParam(1);
const fallbackIn = new FallbackParam(0);
const fallback = scheduleEqualPowerCrossfade({
  outgoingParam: fallbackOut,
  incomingParam: fallbackIn,
  now: 1,
  startTime: 1.25,
  duration: 0.5,
});

if (fallback.mode !== "exponential-fallback") {
  errors.push(`fallback mode mismatch: ${fallback.mode}`);
}
if (!fallbackOut.events.some((event) => event.type === "exp")) {
  errors.push("fallback outgoing exponential ramp missing");
}
if (!fallbackIn.events.some((event) => event.type === "exp")) {
  errors.push("fallback incoming exponential ramp missing");
}

if (errors.length) {
  console.error("Equal-Power Pack Crossfade Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Equal-Power Pack Crossfade Check PASSED");
console.log(`- curve: ${PACK_CROSSFADE_CURVE}`);
console.log(`- points: ${PACK_CROSSFADE_CURVE_POINTS}`);
console.log(`- midpoint gains: ${curves.outgoing[mid].toFixed(6)} / ${curves.incoming[mid].toFixed(6)}`);
console.log(`- midpoint power: equal=${equalPowerMid.toFixed(6)} vs linear=${linearMidPower.toFixed(6)} vs v30-exp=${legacyExponentialMidPower.toFixed(6)}`);
console.log(`- power range: ${minPower.toFixed(6)} .. ${maxPower.toFixed(6)}`);
console.log("- AudioParam curve timing: matched");
console.log("- unsupported AudioParam fallback: exponential");
