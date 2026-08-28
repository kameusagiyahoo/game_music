export const AUDIO_FORMATS = Object.freeze({
  M4A: "m4a",
  OGG: "ogg",
  WAV: "wav",
});

export const DEFAULT_FORMAT_PRIORITY = Object.freeze([
  AUDIO_FORMATS.M4A,
  AUDIO_FORMATS.OGG,
  AUDIO_FORMATS.WAV,
]);

const DEFAULT_MIME = Object.freeze({
  [AUDIO_FORMATS.M4A]: 'audio/mp4; codecs="mp4a.40.2"',
  [AUDIO_FORMATS.OGG]: 'audio/ogg; codecs="vorbis"',
  [AUDIO_FORMATS.WAV]: "audio/wav",
});

function createProbe() {
  try {
    if (typeof document !== "undefined") return document.createElement("audio");
    if (typeof Audio !== "undefined") return new Audio();
  } catch (_) {}
  return null;
}

export function detectAudioFormatSupport(formats = DEFAULT_FORMAT_PRIORITY) {
  const probe = createProbe();
  return Object.fromEntries(formats.map((format) => {
    const mime = DEFAULT_MIME[format] || "";
    if (!probe?.canPlayType) return [format, format === AUDIO_FORMATS.WAV ? "fallback" : "unknown"];
    const result = probe.canPlayType(mime);
    return [format, result || "no"];
  }));
}

export function selectAudioFormat(pack, {
  priority = DEFAULT_FORMAT_PRIORITY,
  support = detectAudioFormatSupport(priority),
} = {}) {
  const stemFormats = pack?.audioStems?.formats || {};
  const stingerFormats = pack?.stingers?.formats || {};
  const available = new Set([
    ...Object.keys(stemFormats),
    ...Object.keys(stingerFormats),
  ]);

  if (!available.size) {
    return {
      format: "wav",
      reason: "legacy-files",
      support,
      available: ["wav"],
    };
  }

  for (const format of priority) {
    if (!available.has(format)) continue;
    const status = support[format];
    if (status === "probably" || status === "maybe" || status === "fallback") {
      return { format, reason: `browser-${status}`, support, available: [...available] };
    }
  }

  if (available.has(AUDIO_FORMATS.WAV)) {
    return { format: AUDIO_FORMATS.WAV, reason: "wav-fallback", support, available: [...available] };
  }

  const format = [...available][0];
  return { format, reason: "first-available", support, available: [...available] };
}

export function resolvePackAudioFormat(pack, options = {}) {
  if (!pack?.audioStems?.formats && !pack?.stingers?.formats) {
    return {
      pack,
      selection: selectAudioFormat(pack, options),
    };
  }

  const selection = selectAudioFormat(pack, options);
  const format = selection.format;
  const stemFormat = pack.audioStems?.formats?.[format];
  const stingerFormat = pack.stingers?.formats?.[format];

  const resolved = {
    ...pack,
    selectedAudioFormat: format,
    audioFormatSelection: selection,
    audioStems: pack.audioStems ? {
      ...pack.audioStems,
      files: stemFormat?.files || pack.audioStems.files,
      selectedFormat: format,
      selectedMime: stemFormat?.mime || null,
    } : pack.audioStems,
    stingers: pack.stingers ? {
      ...pack.stingers,
      files: stingerFormat?.files || pack.stingers.files,
      selectedFormat: format,
      selectedMime: stingerFormat?.mime || null,
    } : pack.stingers,
  };

  return { pack: resolved, selection };
}
