const HASH_PREFIX = '#t=';
const FORMAT_VERSION = 1;
const MAX_URL_LENGTH = 8192;
const FALLBACK_ORIGIN = 'https://vprava.online';

const shareOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return FALLBACK_ORIGIN.replace(/\/$/, '');
};

const utf8ToBase64Url = (str) => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlToUtf8 = (raw) => {
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

const compactSegment = (seg, resolveLabel) => {
  const out = {};
  if (seg && seg.kind === 'rest') {
    out.k = 'r';
    out.d = Number(seg.duration) || 0;
  } else if (seg && seg.mode === 'reps') {
    out.k = 'w';
    out.m = 'r';
    out.r = Number(seg.reps != null ? seg.reps : seg.duration) || 1;
    if (seg.phaseOrder === 'up_then_down') out.po = 'ud';
    if (Number.isFinite(Number(seg.downMs))) out.dn = Number(seg.downMs);
    if (Number.isFinite(Number(seg.upMs))) out.up = Number(seg.upMs);
  } else {
    out.k = 'w';
    out.d = Number(seg && seg.duration) || 1;
  }
  const pace = Number(seg && seg.pace);
  if (pace && pace !== 1) out.p = pace;
  const label = resolveLabel
    ? String(resolveLabel(seg) || '').trim()
    : String((seg && seg.label) || '').trim();
  if (label) out.l = label.slice(0, 30);
  return out;
};

const expandSegment = (s) => {
  if (!s || typeof s !== 'object') {
    return { kind: 'work', mode: 'time', duration: 10, pace: 1, label: '' };
  }
  if (s.m === 'r' || s.m === 'reps') {
    return {
      kind: 'work',
      mode: 'reps',
      reps: s.r,
      duration: s.r,
      phaseOrder: s.po === 'ud' ? 'up_then_down' : 'down_then_up',
      downMs: s.dn,
      upMs: s.up,
      pace: s.p || 1,
      label: s.l || ''
    };
  }
  return {
    kind: s.k === 'r' ? 'rest' : 'work',
    mode: 'time',
    duration: s.d,
    pace: s.p || 1,
    label: s.l || ''
  };
};

const compactTraining = (preset, options = {}) => {
  const audio = (preset && preset.audio) || {};
  return {
    v: FORMAT_VERSION,
    n: options.name != null ? String(options.name) : String((preset && preset.name) || ''),
    c: Number(preset && preset.cycles) || 1,
    a: [
      Number(audio.pitchNormal) || 800,
      Number(audio.pitchHeavy) || 1200
    ],
    s: Array.isArray(preset && preset.segments)
      ? preset.segments.map((seg) => compactSegment(seg, options.resolveLabel))
      : []
  };
};

const expandTraining = (compact) => {
  const audio = Array.isArray(compact && compact.a) ? compact.a : [];
  return {
    name: String((compact && compact.n) || ''),
    cycles: Number(compact && compact.c) || 1,
    audio: {
      pitchNormal: Number(audio[0]) || 800,
      pitchHeavy: Number(audio[1]) || 1200
    },
    segments: Array.isArray(compact && compact.s)
      ? compact.s.map(expandSegment)
      : []
  };
};

const stripLabels = (segments) =>
  (segments || []).map((s) => {
    const copy = { ...s };
    delete copy.l;
    return copy;
  });

export const normalizeShareName = (name) => String(name || '').trim().toLowerCase();

export const structureFingerprint = (preset, options = {}) => {
  const compact = compactTraining(preset, options);
  return JSON.stringify({
    c: compact.c,
    a: compact.a,
    s: stripLabels(compact.s)
  });
};

export const identityKey = (preset, displayName, options = {}) =>
  `${normalizeShareName(displayName != null ? displayName : preset && preset.name)}\n${structureFingerprint(preset, options)}`;

export const findMatchingPreset = (presets, incoming, getDisplayName) => {
  if (!incoming || !Array.isArray(presets)) return null;
  const incomingName = normalizeShareName(incoming.name);
  const incomingFp = structureFingerprint(incoming);
  return presets.find((preset) => {
    const name = normalizeShareName(
      typeof getDisplayName === 'function' ? getDisplayName(preset) : preset.name
    );
    return name === incomingName && structureFingerprint(preset) === incomingFp;
  }) || null;
};

export const encodeTrainingUrl = (preset, options = {}) => {
  const compact = compactTraining(preset, options);
  if (!compact.s.length) {
    const err = new Error('SHARE_EMPTY_TRAINING');
    err.code = 'SHARE_EMPTY_TRAINING';
    throw err;
  }
  const payload = utf8ToBase64Url(JSON.stringify(compact));
  const url = `${shareOrigin()}/${HASH_PREFIX}${payload}`;
  if (url.length > MAX_URL_LENGTH) {
    const err = new Error('SHARE_URL_TOO_LONG');
    err.code = 'SHARE_URL_TOO_LONG';
    throw err;
  }
  return url;
};

export const decodeTrainingPayload = (payload) => {
  if (!payload) return null;
  try {
    const compact = JSON.parse(base64UrlToUtf8(payload));
    if (!compact || compact.v !== FORMAT_VERSION || !Array.isArray(compact.s)) return null;
    const training = expandTraining(compact);
    if (!training.segments.length) return null;
    return training;
  } catch {
    return null;
  }
};

export const parseTrainingFromLocation = (
  href = typeof window !== 'undefined' ? window.location.href : ''
) => {
  try {
    const hash = new URL(href).hash;
    if (!hash.startsWith(HASH_PREFIX)) return null;
    const raw = hash.slice(HASH_PREFIX.length).split('&')[0];
    if (!raw) return null;
    return decodeTrainingPayload(raw);
  } catch {
    return null;
  }
};

export const clearTrainingHashFromLocation = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.hash.startsWith(HASH_PREFIX)) return;
  url.hash = '';
  history.replaceState(null, '', url.pathname + url.search);
};

export const buildShareText = (urls) =>
  (Array.isArray(urls) ? urls : []).filter(Boolean).join('\n');

export { HASH_PREFIX, MAX_URL_LENGTH, FORMAT_VERSION };
