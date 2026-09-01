import { defineMusicPackManifest } from "../music-pack-manifest.js";

const audioUrl = (kind, name, ext) =>
  new URL(`../../assets/${kind}/fantasy/${name}.${ext}`, import.meta.url).href;

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

export const fantasyPack = {
  id: "fantasy",
  name: "Fantasy Table WAV",
  defaultLayerPreset: "focus",

  mastering: {
    profile: "fantasy-gentle-v1",
    headroomDb: -4.0,
    limiter: {
      thresholdDb: -2.0,
      kneeDb: 0,
      ratio: 20,
      attack: 0.004,
      release: 0.16,
    },
    sourceTargets: {
      stems: {
        drums: { rmsDbfs: -23.0, peakDbfs: -7.0 },
        bass: { rmsDbfs: -23.0, peakDbfs: -8.0 },
        chords: { rmsDbfs: -24.0, peakDbfs: -9.0 },
        melody: { rmsDbfs: -22.5, peakDbfs: -7.0 },
        sparkle: { rmsDbfs: -27.0, peakDbfs: -10.0 },
      },
      stingers: {
        victory: { rmsDbfs: -18.0, peakDbfs: -4.0 },
        gameover: { rmsDbfs: -20.0, peakDbfs: -5.0 },
      },
      transitionCues: {
        fill: { rmsDbfs: -21.0, peakDbfs: -6.0 },
        whoosh: { rmsDbfs: -23.0, peakDbfs: -7.0 },
        riser: { rmsDbfs: -21.5, peakDbfs: -6.0 },
        impact: { rmsDbfs: -19.0, peakDbfs: -4.0 },
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
    focus: { drums: 0.12, bass: 0.30, chords: 0.78, melody: 0.52, sparkle: 0.12 },
    build: { drums: 0.28, bass: 0.46, chords: 0.88, melody: 0.72, sparkle: 0.30 },
    overdrive: { drums: 0.58, bass: 0.66, chords: 0.94, melody: 0.90, sparkle: 0.56 },
    result: { drums: 0.06, bass: 0.22, chords: 0.72, melody: 0.58, sparkle: 0.16 },
  },

  modes: {
    normal: { label: "WANDER · Fantasy Table", bpm: 108 },
    build: { label: "AWAKEN · Lanterns Rising", bpm: 108 },
    overdrive: { label: "QUEST · Ancient Road", bpm: 108 },
    result: { label: "AFTERGLOW · Homeward", bpm: 108 },
  },
};

export const fantasyManifest = defineMusicPackManifest({
  id: fantasyPack.id,
  name: fantasyPack.name,
  shortName: "Fantasy WAV",
  description: "やさしい幻想 / 44.1kHz stereo / harp・flute・frame drum",
  engine: "wav-stem",
  version: "2.0.0",
  states: ["normal", "build", "overdrive", "result"],
  stems: ["drums", "bass", "chords", "melody", "sparkle"],
  stingers: ["victory", "gameover"],
  transitionCues: ["fill", "whoosh", "riser", "impact"],
  masteringProfile: "fantasy-gentle-v1",
  formats: ["m4a", "ogg", "wav"],
  tags: [
    "fantasy",
    "wav",
    "ogg",
    "aac",
    "stems",
    "adaptive",
    "harp",
    "flute",
    "frame-drum",
    "stereo",
    "44.1khz",
    "mastered",
  ],
});
