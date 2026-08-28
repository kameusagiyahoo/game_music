import { defineMusicPackManifest } from "../music-pack-manifest.js";

export const neonPack = {
  id: "neon",
  name: "Neon Orbit",
  modes: {
    normal: {
      label: "NORMAL · Neon Orbit",
      bpm: 132,
      melody: [76, null, 79, 83, 81, null, 79, 76, 74, null, 76, 79, 83, 81, 79, null],
      bass: [40, 43, 45, 38],
      chords: [[52, 55, 59], [55, 59, 62], [57, 60, 64], [50, 54, 57]],
      pulseEvery: 2,
      pulseHz: 1320,
    },
    tension: {
      label: "TENSION · Overdrive",
      bpm: 168,
      melody: [76, 79, 83, 86, 83, 81, 79, 76, 79, 83, 86, 88, 86, 83, 81, 79],
      bass: [40, 43, 45, 47],
      chords: [[52, 55, 59], [55, 59, 62], [57, 60, 64], [59, 62, 66]],
      pulseEvery: 1,
      pulseHz: 1580,
    },
    result: {
      label: "RESULT · Cooldown",
      bpm: 100,
      melody: [83, null, 81, null, 79, null, 76, null, 74, null, 76, null, 71, null, 69, null],
      bass: [40, 43, 38, 40],
      chords: [[52, 55, 59], [55, 59, 62], [50, 54, 57], [52, 55, 59]],
      pulseEvery: 8,
      pulseHz: 880,
    },
  },
  voices: {
    melody: { type: "square", gain: 0.046, duration: 0.12 },
    sparkle: { type: "sine", gain: 0.020, duration: 0.07, octave: 12 },
    bass: { type: "sawtooth", gain: 0.038, duration: 0.32 },
    chord: { type: "triangle", gain: 0.013, duration: 0.48, octave: 12 },
    pulse: { type: "square", gain: 0.011, duration: 0.018 },
  },
};


export const neonManifest = defineMusicPackManifest({
  id: neonPack.id,
  name: neonPack.name,
  shortName: "Neon",
  description: "高速シンセ",
  engine: "procedural",
  version: "1.0.0",
  states: ["normal","tension","result"],
  stems: [],
  stingers: [],
  tags: ["neon","synth","procedural"],
});
