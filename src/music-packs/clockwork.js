import { defineMusicPackManifest } from "../music-pack-manifest.js";

const audioUrl = (kind, name, ext) =>
  new URL(`../../assets/${kind}/clockwork/${name}.${ext}`, import.meta.url).href;

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

export const clockworkPack = {
  id: "clockwork",
  name: "Clockwork Grove WAV",
  defaultLayerPreset: "focus",

  mastering: {
    profile: "clockwork-balanced-v1",
    headroomDb: -3.5,
    limiter: {
      thresholdDb: -1.75,
      kneeDb: 0,
      ratio: 20,
      attack: 0.0035,
      release: 0.14,
    },
    sourceTargets: {
      stems: {
        drums: { rmsDbfs: -21.5, peakDbfs: -5.5 },
        bass: { rmsDbfs: -22.0, peakDbfs: -7.0 },
        chords: { rmsDbfs: -23.0, peakDbfs: -8.0 },
        melody: { rmsDbfs: -21.5, peakDbfs: -6.0 },
        sparkle: { rmsDbfs: -25.5, peakDbfs: -8.5 },
      },
      stingers: {
        victory: { rmsDbfs: -17.0, peakDbfs: -3.5 },
        gameover: { rmsDbfs: -19.0, peakDbfs: -4.5 },
      },
      transitionCues: {
        fill: { rmsDbfs: -19.5, peakDbfs: -4.5 },
        whoosh: { rmsDbfs: -21.0, peakDbfs: -5.5 },
        riser: { rmsDbfs: -19.5, peakDbfs: -4.5 },
        impact: { rmsDbfs: -17.0, peakDbfs: -3.0 },
      },
    },
  },

  audioStems: {
    bpm: 108,
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
    focus: { drums: 0.22, bass: 0.42, chords: 0.58, melody: 0.46, sparkle: 0.20 },
    build: { drums: 0.40, bass: 0.54, chords: 0.70, melody: 0.62, sparkle: 0.34 },
    overdrive: { drums: 0.68, bass: 0.72, chords: 0.80, melody: 0.78, sparkle: 0.56 },
    result: { drums: 0.12, bass: 0.30, chords: 0.56, melody: 0.52, sparkle: 0.24 },
  },

  modes: {
    normal: { label: "WINDING · Clockwork Grove", bpm: 108 },
    build: { label: "ENGAGE · Gears Turning", bpm: 108 },
    overdrive: { label: "AWAKE · Clockwork Grove", bpm: 108 },
    result: { label: "WINDING DOWN · Clockwork Grove", bpm: 108 },
  },
};

export const clockworkManifest = defineMusicPackManifest({
  id: clockworkPack.id,
  name: clockworkPack.name,
  shortName: "Clockwork WAV",
  description: "機械仕掛け / 108 BPM / music-box・wood・gear ticks",
  engine: "wav-stem",
  version: "2.0.0",
  states: ["normal", "build", "overdrive", "result"],
  stems: ["drums", "bass", "chords", "melody", "sparkle"],
  stingers: ["victory", "gameover"],
  transitionCues: ["fill", "whoosh", "riser", "impact"],
  masteringProfile: "clockwork-balanced-v1",
  formats: ["m4a", "ogg", "wav"],
  tags: [
    "clockwork",
    "mechanical",
    "wav",
    "ogg",
    "aac",
    "stems",
    "adaptive",
    "music-box",
    "wood",
    "gear",
    "stereo",
    "44.1khz",
    "mastered",
  ],
});
