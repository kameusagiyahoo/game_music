import {
  applyMusicSettingsToControls,
  getMusicSettings,
  saveMusicSettings,
} from "./music-registry.js";

const clampVolume = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number / 100));
};

export function bindGameAudioControls({
  getMusic,
  soundButton,
  bgmToggle,
  sfxToggle,
  bgmVolume,
  sfxVolume,
  bgmVolumeValue,
  sfxVolumeValue,
  settings = getMusicSettings(),
  saveSettings = saveMusicSettings,
  cueName = "toggle",
  soundOnLabel = "♪",
  soundOffLabel = "×",
} = {}) {
  const resolveMusic = typeof getMusic === "function"
    ? getMusic
    : () => getMusic || null;

  const controls = {
    bgmToggle,
    sfxToggle,
    bgmVolume,
    sfxVolume,
    bgmVolumeValue,
    sfxVolumeValue,
  };

  applyMusicSettingsToControls(controls, settings);

  let masterSoundEnabled = true;

  const renderMasterButton = () => {
    if (!soundButton) return;
    soundButton.setAttribute?.("aria-pressed", String(masterSoundEnabled));
    soundButton.textContent = masterSoundEnabled ? soundOnLabel : soundOffLabel;
  };

  const apply = async () => {
    renderMasterButton();
    const music = resolveMusic();
    if (!music?.audio) return null;

    return music.audio({
      musicEnabled: masterSoundEnabled && Boolean(bgmToggle?.checked),
      sfxEnabled: masterSoundEnabled && Boolean(sfxToggle?.checked),
    });
  };

  soundButton?.addEventListener?.("click", async () => {
    masterSoundEnabled = !masterSoundEnabled;
    await apply();

    const music = resolveMusic();
    if (masterSoundEnabled && sfxToggle?.checked) {
      music?.cue?.(cueName);
    }
  });

  bgmToggle?.addEventListener?.("change", async () => {
    saveSettings({ bgmEnabled: Boolean(bgmToggle.checked) });
    await apply();
  });

  sfxToggle?.addEventListener?.("change", async () => {
    saveSettings({ sfxEnabled: Boolean(sfxToggle.checked) });
    await apply();
  });

  bgmVolume?.addEventListener?.("input", () => {
    const value = clampVolume(bgmVolume.value);
    if (bgmVolumeValue) bgmVolumeValue.textContent = bgmVolume.value;
    saveSettings({ bgmVolume: value });
    void resolveMusic()?.audio?.({ musicVolume: value });
  });

  sfxVolume?.addEventListener?.("input", () => {
    const value = clampVolume(sfxVolume.value);
    if (sfxVolumeValue) sfxVolumeValue.textContent = sfxVolume.value;
    saveSettings({ sfxVolume: value });
    void resolveMusic()?.audio?.({ sfxVolume: value });
  });

  renderMasterButton();

  return {
    apply,
    isMasterSoundEnabled: () => masterSoundEnabled,
    async setMasterSoundEnabled(enabled) {
      masterSoundEnabled = Boolean(enabled);
      return apply();
    },
  };
}
