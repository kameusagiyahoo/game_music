import { defineMusicPackManifest } from "../music-pack-manifest.js";

const audioUrl = (kind, name, ext) => new URL(`../../assets/${kind}/pulse/${name}.${ext}`, import.meta.url).href;
const stemFiles = (ext) => ({
  drums: audioUrl("stems", "drums", ext),
  bass: audioUrl("stems", "bass", ext),
  chords: audioUrl("stems", "chords", ext),
  melody: audioUrl("stems", "melody", ext),
  sparkle: audioUrl("stems", "sparkle", ext),
});
const stingerFiles = (ext) => ({
  victory: audioUrl("stingers", "victory", ext),
  gameover: audioUrl("stingers", "gameover", ext),
});

export const pulsePack = {
  id: "pulse",
  name: "Pulse Forge WAV",
  defaultLayerPreset: "focus",

  audioStems: {
    bpm: 112,
    bars: 4,
    sampleRate: 22050,
    files: stemFiles("wav"),
    formats: {
      m4a: { mime: 'audio/mp4; codecs="mp4a.40.2"', files: stemFiles("m4a") },
      ogg: { mime: 'audio/ogg; codecs="vorbis"', files: stemFiles("ogg") },
      wav: { mime: "audio/wav", files: stemFiles("wav") },
    },
  },

  stingers: {
    files: stingerFiles("wav"),
    formats: {
      m4a: { mime: 'audio/mp4; codecs="mp4a.40.2"', files: stingerFiles("m4a") },
      ogg: { mime: 'audio/ogg; codecs="vorbis"', files: stingerFiles("ogg") },
      wav: { mime: "audio/wav", files: stingerFiles("wav") },
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

export const pulseManifest = defineMusicPackManifest({
  id: pulsePack.id,
  name: pulsePack.name,
  shortName: "Pulse WAV",
  description: "5本の同期Stem / multi-format",
  engine: "wav-stem",
  version: "1.1.0",
  states: ["normal", "build", "overdrive", "result"],
  stems: ["drums", "bass", "chords", "melody", "sparkle"],
  stingers: ["victory", "gameover"],
  formats: ["m4a", "ogg", "wav"],
  tags: ["pulse", "wav", "ogg", "aac", "stems", "adaptive"],
});
