export const pulsePack = {
  id: "pulse",
  name: "Pulse Forge",
  defaultLayerPreset: "focus",

  layerPresets: {
    focus: {
      drums: 0.22,
      bass: 0.42,
      chords: 0.68,
      melody: 0.48,
      sparkle: 0.0,
    },
    build: {
      drums: 0.56,
      bass: 0.74,
      chords: 0.82,
      melody: 0.78,
      sparkle: 0.28,
    },
    overdrive: {
      drums: 1.0,
      bass: 1.0,
      chords: 0.92,
      melody: 1.0,
      sparkle: 0.78,
    },
    result: {
      drums: 0.12,
      bass: 0.32,
      chords: 0.62,
      melody: 0.54,
      sparkle: 0.08,
    },
  },

  modes: {
    normal: {
      label: "PERFORMANCE · Pulse Forge",
      bpm: 120,
      melody: [69, null, 72, null, 76, null, 72, null, 67, null, 71, null, 74, null, 71, null],
      bass: [45, 41, 43, 40],
      chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
      drumPattern: ["both", "hat", "hat", "hat", "kick", "hat", "hat", "hat", "both", "hat", "hat", "hat", "kick", "hat", "hat", "hat"],
    },
    build: {
      label: "BUILD · Core Rising",
      bpm: 120,
      melody: [69, 72, 76, null, 74, 72, 69, null, 71, 74, 78, null, 76, 74, 71, null],
      bass: [45, 41, 43, 40],
      chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
      drumPattern: ["both", "hat", "hat", "hat", "kick", "hat", "hat", "hat", "both", "hat", "hat", "hat", "kick", "hat", "hat", "hat"],
    },
    overdrive: {
      label: "OVERDRIVE · White Heat",
      bpm: 120,
      melody: [69, 72, 76, 81, 79, 76, 74, 72, 71, 74, 78, 83, 81, 78, 76, 74],
      bass: [45, 48, 43, 40],
      chords: [[57, 60, 64], [60, 64, 67], [55, 59, 62], [52, 55, 59]],
      drumPattern: ["both", "hat", "kick", "hat", "both", "hat", "kick", "hat", "both", "hat", "kick", "hat", "both", "hat", "kick", "hat"],
    },
    result: {
      label: "RESULT · Cooling Steel",
      bpm: 96,
      melody: [76, null, 74, null, 72, null, 69, null, 67, null, 69, null, 64, null, 62, null],
      bass: [45, 41, 40, 45],
      chords: [[57, 60, 64], [53, 57, 60], [52, 55, 59], [57, 60, 64]],
      drumPattern: ["kick", null, null, null, null, null, null, null, "kick", null, null, null, null, null, null, null],
    },
  },

  voices: {
    melody: { type: "triangle", gain: 0.060, duration: 0.17 },
    sparkle: { type: "sine", gain: 0.022, duration: 0.09, octave: 12 },
    bass: { type: "sawtooth", gain: 0.040, duration: 0.38 },
    chord: { type: "sine", gain: 0.016, duration: 0.56, octave: 12 },
    pulse: { type: "square", gain: 0.012, duration: 0.02 },
  },
};
