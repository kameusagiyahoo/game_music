import { defineMusicPackManifest } from "../music-pack-manifest.js";

const audioUrl = (kind, name, ext) =>
  new URL(`../../assets/${kind}/neon/${name}.${ext}`, import.meta.url).href;

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

export const neonPack = {
  id: "neon",
  name: "Neon Orbit WAV",
  defaultLayerPreset: "focus",

  mastering: {
    profile: "neon-drive-v1",
    headroomDb: -3.0,
    limiter: {
      thresholdDb: -1.25,
      kneeDb: 0,
      ratio: 20,
      attack: 0.0025,
      release: 0.10,
    },
    sourceTargets: {
      stems: {
        drums: { rmsDbfs: -20.0, peakDbfs: -4.5 },
        bass: { rmsDbfs: -20.5, peakDbfs: -6.0 },
        chords: { rmsDbfs: -22.0, peakDbfs: -7.0 },
        melody: { rmsDbfs: -20.0, peakDbfs: -5.0 },
        sparkle: { rmsDbfs: -24.0, peakDbfs: -7.0 },
      },
      stingers: {
        victory: { rmsDbfs: -16.0, peakDbfs: -2.5 },
        gameover: { rmsDbfs: -18.0, peakDbfs: -3.0 },
      },
      transitionCues: {
        fill: { rmsDbfs: -18.0, peakDbfs: -3.5 },
        whoosh: { rmsDbfs: -20.0, peakDbfs: -4.5 },
        riser: { rmsDbfs: -18.5, peakDbfs: -3.5 },
        impact: { rmsDbfs: -15.5, peakDbfs: -2.0 },
      },
    },
  },

  audioStems: {
    bpm: 132,
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
    focus: { drums: 0.34, bass: 0.54, chords: 0.42, melody: 0.34, sparkle: 0.18 },
    build: { drums: 0.54, bass: 0.68, chords: 0.54, melody: 0.54, sparkle: 0.30 },
    overdrive: { drums: 0.88, bass: 0.86, chords: 0.66, melody: 0.84, sparkle: 0.54 },
    result: { drums: 0.18, bass: 0.34, chords: 0.44, melody: 0.50, sparkle: 0.28 },
  },

  modes: {
    normal: { label: "CRUISE · Neon Orbit", bpm: 132 },
    build: { label: "CHARGE · Grid Rising", bpm: 132 },
    overdrive: { label: "OVERDRIVE · Neon Orbit", bpm: 132 },
    result: { label: "COOLDOWN · Neon Orbit", bpm: 132 },
  },
};

export const neonManifest = defineMusicPackManifest({
  id: neonPack.id,
  name: neonPack.name,
  shortName: "Neon WAV",
  description: "高速電子音 / 132 BPM / synth bass・arp・digital texture",
  engine: "wav-stem",
  version: "2.0.0",
  states: ["normal", "build", "overdrive", "result"],
  stems: ["drums", "bass", "chords", "melody", "sparkle"],
  stingers: ["victory", "gameover"],
  transitionCues: ["fill", "whoosh", "riser", "impact"],
  masteringProfile: "neon-drive-v1",
  formats: ["m4a", "ogg", "wav"],
  tags: [
    "neon",
    "synth",
    "wav",
    "ogg",
    "aac",
    "stems",
    "adaptive",
    "arpeggio",
    "electronic",
    "stereo",
    "44.1khz",
    "mastered",
  ],
});
