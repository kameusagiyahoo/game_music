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

const SESSION_KEY_PREFIX = "game-music-audio-format-v1";

function createProbe() {
  try {
    if (typeof document !== "undefined") return document.createElement("audio");
    if (typeof Audio !== "undefined") return new Audio();
  } catch (_) {}
  return null;
}

function getSessionStorage() {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch (_) {}
  return null;
}

function getPackCacheKey(pack) {
  const id = String(pack?.id || "unknown");
  return `${SESSION_KEY_PREFIX}:${id}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getAvailableAudioFormats(pack) {
  const stemFormats = Object.keys(pack?.audioStems?.formats || {});
  const stingerFormats = Object.keys(pack?.stingers?.formats || {});

  if (!stemFormats.length && !stingerFormats.length) return [AUDIO_FORMATS.WAV];
  if (!stemFormats.length) return unique(stingerFormats);
  if (!stingerFormats.length) return unique(stemFormats);

  const stingerSet = new Set(stingerFormats);
  return stemFormats.filter((format) => stingerSet.has(format));
}

export function getCachedAudioFormat(pack) {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const value = storage.getItem(getPackCacheKey(pack));
    return getAvailableAudioFormats(pack).includes(value) ? value : null;
  } catch (_) {
    return null;
  }
}

export function rememberAudioFormat(pack, format) {
  if (!getAvailableAudioFormats(pack).includes(format)) return false;
  const storage = getSessionStorage();
  if (!storage) return false;
  try {
    storage.setItem(getPackCacheKey(pack), format);
    return true;
  } catch (_) {
    return false;
  }
}

export function clearCachedAudioFormat(pack) {
  const storage = getSessionStorage();
  if (!storage) return false;
  try {
    storage.removeItem(getPackCacheKey(pack));
    return true;
  } catch (_) {
    return false;
  }
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
  preferredFormat = null,
  useSession = true,
} = {}) {
  const available = getAvailableAudioFormats(pack);

  if (!pack?.audioStems?.formats && !pack?.stingers?.formats) {
    return {
      format: AUDIO_FORMATS.WAV,
      reason: "legacy-files",
      support,
      available,
    };
  }

  const cached = useSession ? getCachedAudioFormat(pack) : null;
  if (cached && available.includes(cached)) {
    return {
      format: cached,
      reason: "session-success",
      support,
      available,
    };
  }

  if (preferredFormat && available.includes(preferredFormat)) {
    return {
      format: preferredFormat,
      reason: "preferred-format",
      support,
      available,
    };
  }

  for (const format of priority) {
    if (!available.includes(format)) continue;
    const status = support[format];
    if (status === "probably" || status === "maybe" || status === "fallback") {
      return { format, reason: `browser-${status}`, support, available };
    }
  }

  if (available.includes(AUDIO_FORMATS.WAV)) {
    return { format: AUDIO_FORMATS.WAV, reason: "wav-fallback", support, available };
  }

  const format = available[0];
  return { format, reason: "first-available", support, available };
}

export function getAudioFormatCandidates(pack, {
  priority = DEFAULT_FORMAT_PRIORITY,
  support = detectAudioFormatSupport(priority),
  preferredFormat = null,
  useSession = true,
} = {}) {
  const selection = selectAudioFormat(pack, {
    priority,
    support,
    preferredFormat,
    useSession,
  });
  const available = selection.available || getAvailableAudioFormats(pack);

  // canPlayType() is only a hint. Runtime decode fallback deliberately keeps
  // every declared format in the retry chain, even when the probe says "no".
  // This avoids false negatives while still trying the most likely format first.
  const ordered = unique([
    selection.format,
    ...(useSession ? [getCachedAudioFormat(pack)] : []),
    preferredFormat,
    ...priority,
    ...available,
  ]).filter((format) => available.includes(format));

  return {
    selection,
    candidates: ordered,
  };
}

export function applyAudioFormatToPack(pack, format, selection = null, candidates = null) {
  const stemFormat = pack?.audioStems?.formats?.[format];
  const stingerFormat = pack?.stingers?.formats?.[format];

  return {
    ...pack,
    selectedAudioFormat: format,
    audioFormatSelection: selection,
    audioFormatCandidates: candidates ? [...candidates] : undefined,
    audioStems: pack?.audioStems ? {
      ...pack.audioStems,
      files: stemFormat?.files || pack.audioStems.files,
      selectedFormat: format,
      selectedMime: stemFormat?.mime || null,
    } : pack?.audioStems,
    stingers: pack?.stingers ? {
      ...pack.stingers,
      files: stingerFormat?.files || pack.stingers.files,
      selectedFormat: format,
      selectedMime: stingerFormat?.mime || null,
    } : pack?.stingers,
  };
}

export function resolvePackAudioFormat(pack, options = {}) {
  const { selection, candidates } = getAudioFormatCandidates(pack, options);

  if (!pack?.audioStems?.formats && !pack?.stingers?.formats) {
    return {
      pack: applyAudioFormatToPack(pack, selection.format, selection, candidates),
      selection,
      candidates,
    };
  }

  return {
    pack: applyAudioFormatToPack(pack, selection.format, selection, candidates),
    selection,
    candidates,
  };
}
