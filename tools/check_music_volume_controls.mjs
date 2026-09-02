import { MusicManager } from "../src/music-manager.js";
import { WavStemMusicManager } from "../src/wav-stem-manager.js";

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function verifyVolumeClamp(manager, label) {
  manager.setMusicVolume(0);
  assertEqual(manager.musicVolume, 0, `${label} music volume accepts zero`);

  manager.setSfxVolume(0);
  assertEqual(manager.sfxVolume, 0, `${label} sfx volume accepts zero`);

  manager.setMusicVolume(-0.5);
  assertEqual(manager.musicVolume, 0, `${label} music volume clamps negative values`);

  manager.setSfxVolume(-0.5);
  assertEqual(manager.sfxVolume, 0, `${label} sfx volume clamps negative values`);

  manager.setMusicVolume(1.5);
  assertEqual(manager.musicVolume, 1, `${label} music volume clamps values above one`);

  manager.setSfxVolume(1.5);
  assertEqual(manager.sfxVolume, 1, `${label} sfx volume clamps values above one`);
}

const proceduralPack = {
  id: "volume-test-procedural",
  modes: {
    normal: { bpm: 120 },
  },
};

const wavPack = {
  id: "volume-test-wav",
  defaultLayerPreset: "focus",
  modes: {
    normal: { bpm: 120 },
  },
  audioStems: {
    bpm: 120,
  },
  layerPresets: {
    focus: {
      drums: 1,
      bass: 1,
      chords: 1,
      melody: 1,
      sparkle: 1,
    },
  },
};

verifyVolumeClamp(new MusicManager({ pack: proceduralPack }), "procedural");
verifyVolumeClamp(new WavStemMusicManager({ pack: wavPack }), "wav-stem");

console.log("Music volume control check PASSED");
