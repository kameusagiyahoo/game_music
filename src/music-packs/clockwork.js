export const clockworkPack = {
  id: "clockwork",
  name: "Clockwork Grove",
  modes: {
    normal: {
      label: "NORMAL · Clockwork Grove",
      bpm: 108,
      melody: [67, null, 71, 74, 72, null, 71, 67, 64, null, 67, 71, 74, null, 72, 71],
      bass: [43, 40, 45, 38],
      chords: [[55, 59, 62], [52, 55, 59], [57, 60, 64], [50, 54, 57]],
      drumPattern: ["kick", "hat", null, "hat", "kick", "hat", null, "hat", "kick", "hat", null, "hat", "kick", "hat", "hat", "hat"],
    },
    tension: {
      label: "TENSION · Gears Awake",
      bpm: 138,
      melody: [67, 71, 74, 79, 77, 74, 72, 71, 69, 72, 76, 81, 79, 76, 74, 72],
      bass: [43, 45, 40, 42],
      chords: [[55, 59, 62], [57, 60, 64], [52, 55, 59], [54, 57, 61]],
      drumPattern: ["both", "hat", "kick", "hat", "both", "hat", "kick", "hat", "both", "hat", "kick", "hat", "both", "hat", "kick", "hat"],
    },
    result: {
      label: "RESULT · Winding Down",
      bpm: 84,
      melody: [74, null, 72, null, 71, null, 67, null, 64, null, 67, null, 62, null, 59, null],
      bass: [43, 40, 38, 43],
      chords: [[55, 59, 62], [52, 55, 59], [50, 54, 57], [55, 59, 62]],
      drumPattern: ["kick", null, null, "hat", null, null, null, null, "kick", null, null, "hat", null, null, null, null],
    },
  },
  voices: {
    melody: { type: "triangle", gain: 0.058, duration: 0.12 },
    sparkle: { type: "square", gain: 0.010, duration: 0.045, octave: 12 },
    bass: { type: "triangle", gain: 0.044, duration: 0.34 },
    chord: { type: "sine", gain: 0.016, duration: 0.46, octave: 12 },
    pulse: { type: "square", gain: 0.010, duration: 0.018 },
  },
};
