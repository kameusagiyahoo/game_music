const stemUrl = (name) => new URL(`../../assets/stems/pulse/${name}.wav`, import.meta.url).href;

export const pulsePack = {
  id: "pulse",
  name: "Pulse Forge WAV",
  defaultLayerPreset: "focus",

  audioStems: {
    bpm: 112,
    bars: 4,
    sampleRate: 22050,
    files: {
      drums: stemUrl("drums"),
      bass: stemUrl("bass"),
      chords: stemUrl("chords"),
      melody: stemUrl("melody"),
      sparkle: stemUrl("sparkle"),
    },
  },

  layerPresets: {
    focus: { drums: 0.22, bass: 0.42, chords: 0.68, melody: 0.48, sparkle: 0.0 },
    build: { drums: 0.56, bass: 0.74, chords: 0.82, melody: 0.78, sparkle: 0.28 },
    overdrive: { drums: 1.0, bass: 1.0, chords: 0.92, melody: 1.0, sparkle: 0.78 },
    result: { drums: 0.12, bass: 0.32, chords: 0.62, melody: 0.54, sparkle: 0.08 },
  },

  modes: {
    normal: { label: "PERFORMANCE · Pulse Forge", bpm: 112 },
    build: { label: "BUILD · Core Rising", bpm: 112 },
    overdrive: { label: "OVERDRIVE · White Heat", bpm: 112 },
    result: { label: "RESULT · Cooling Steel", bpm: 112 },
  },
};
