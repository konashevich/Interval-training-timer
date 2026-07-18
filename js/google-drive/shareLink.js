import { SITE_URL } from './config.js';

const SHARE_HASH_PREFIX = '#share=';

const shareOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return SITE_URL.replace(/\/$/, '');
};

export const buildShareUrl = (driveFileId) =>
  `${shareOrigin()}${SHARE_HASH_PREFIX}${encodeURIComponent(driveFileId)}`;

export const parseShareFileIdFromLocation = (
  href = typeof window !== 'undefined' ? window.location.href : '',
) => {
  try {
    const hash = new URL(href).hash;
    if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
    const raw = hash.slice(SHARE_HASH_PREFIX.length).split('&')[0];
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
};

export const clearShareHashFromLocation = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.hash.startsWith(SHARE_HASH_PREFIX)) return;
  url.hash = '';
  history.replaceState(null, '', url.pathname + url.search);
};
