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
const transitionFiles = (ext) => ({
  fill: audioUrl("transitions", "fill", ext),
  whoosh: audioUrl("transitions", "whoosh", ext),
  riser: audioUrl("transitions", "riser", ext),
  impact: audioUrl("transitions", "impact", ext),
});

export const pulsePack = {
  id: "pulse",
  name: "Pulse Forge WAV",
  defaultLayerPreset: "focus",

  mastering: {
    profile: "game-balanced-v1",
    headroomDb: -3.0,
    limiter: {
      thresholdDb: -1.5,
      kneeDb: 0,
      ratio: 20,
      attack: 0.003,
      release: 0.12,
    },
    sourceTargets: {
      stems: {
        drums: { rmsDbfs: -20.0, peakDbfs: -5.0 },
        bass: { rmsDbfs: -21.0, peakDbfs: -6.0 },
        chords: { rmsDbfs: -22.0, peakDbfs: -7.0 },
        melody: { rmsDbfs: -21.0, peakDbfs: -6.0 },
        sparkle: { rmsDbfs: -24.0, peakDbfs: -8.0 },
      },
      stingers: {
        victory: { rmsDbfs: -16.5, peakDbfs: -2.5 },
        gameover: { rmsDbfs: -18.0, peakDbfs: -3.0 },
      },
      transitionCues: {
        fill: { rmsDbfs: -18.5, peakDbfs: -4.0 },
        whoosh: { rmsDbfs: -20.0, peakDbfs: -5.0 },
        riser: { rmsDbfs: -19.0, peakDbfs: -4.5 },
        impact: { rmsDbfs: -16.5, peakDbfs: -2.5 },
      },
    },
  },

  audioStems: {
    bpm: 112,
    bars: 4,
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
    channelLayout: "stereo",
    files: stemFiles("wav"),
    formats: {
      m4a: { mime: 'audio/mp4; codecs="mp4a.40.2"', files: stemFiles("m4a") },
      ogg: { mime: 'audio/ogg; codecs="vorbis"', files: stemFiles("ogg") },
      wav: { mime: "audio/wav", files: stemFiles("wav") },
    },
  },

  stingers: {
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
    channelLayout: "stereo",
    files: stingerFiles("wav"),
    formats: {
      m4a: { mime: 'audio/mp4; codecs="mp4a.40.2"', files: stingerFiles("m4a") },
      ogg: { mime: 'audio/ogg; codecs="vorbis"', files: stingerFiles("ogg") },
      wav: { mime: "audio/wav", files: stingerFiles("wav") },
    },
  },

  transitionCues: {
    sampleRate: 44100,
    channels: 2,
    bitDepth: 16,
    channelLayout: "stereo",
    files: transitionFiles("wav"),
    formats: {
      m4a: { mime: 'audio/mp4; codecs="mp4a.40.2"', files: transitionFiles("m4a") },
      ogg: { mime: 'audio/ogg; codecs="vorbis"', files: transitionFiles("ogg") },
      wav: { mime: "audio/wav", files: transitionFiles("wav") },
    },
    modeMap: {
      normal: { cue: "whoosh", position: "before" },
      build: { cue: "riser", position: "before" },
      overdrive: { cue: "fill", position: "before" },
      result: { cue: "impact", position: "at" },
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
  description: "44.1kHz stereo / mastered / 5同期Stem / transition cues",
  engine: "wav-stem",
  version: "1.4.1",
  states: ["normal", "build", "overdrive", "result"],
  stems: ["drums", "bass", "chords", "melody", "sparkle"],
  stingers: ["victory", "gameover"],
  transitionCues: ["fill", "whoosh", "riser", "impact"],
  masteringProfile: "game-balanced-v1",
  formats: ["m4a", "ogg", "wav"],
  tags: ["pulse", "wav", "ogg", "aac", "stems", "adaptive", "transition-cues", "stereo", "44.1khz", "mastered"],
});
