/** Google Drive sync config — fill client ID / API key after GCP setup (docs/google-oauth). */

export const SITE_URL = 'https://vprava.online';
/** Keep legacy folder name so existing Drive vaults stay found. */
export const DEFAULT_DRIVE_ROOT_FOLDER = 'timer.konashevych.com';
export const OAUTH_PROXY_URL = 'https://timer-api.konashevych.com';

/**
 * OAuth Web client for VPRAVA.ONLINE (GCP Chromium project brand; redirects on vprava.online).
 * Drive API key lives in project vprava-online.
 */
export const GOOGLE_CLIENT_ID =
  '215074085861-g6t9gnmla8adtha1seddcuekau85iea9.apps.googleusercontent.com';

/**
 * Browser API key restricted to Drive API — required for public #share= downloads.
 * Project: vprava-online (referrer-restricted to vprava.online).
 */
export const GOOGLE_API_KEY = 'AIzaSyB_bwckPG02by7w70RPgLUSQpsrFAn1Gww';

/** Set false to hard-disable even when client ID is present. */
export const GOOGLE_DRIVE_ENABLED = true;

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_OPENID_SCOPES = 'openid email profile';
export const DRIVE_OAUTH_SCOPES = `${DRIVE_FILE_SCOPE} ${GOOGLE_OPENID_SCOPES}`;

export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
export const DRIVE_FILE_MIME_TYPE = 'application/json';
export const DRIVE_MANIFEST_VERSION = 1;

export const DRIVE_FOLDER_CACHE_KEY = 'interval-timer:drive-folder-ids-v1';
export const DRIVE_TOKEN_STORAGE_KEY = 'interval-timer:google-access-token';
export const DRIVE_TOKEN_EXPIRY_STORAGE_KEY = 'interval-timer:google-access-token-expiry';
export const DRIVE_LINKED_STORAGE_KEY = 'interval-timer:google-drive-linked';
export const DRIVE_ACCOUNT_EMAIL_STORAGE_KEY = 'interval-timer:google-account-email';
export const DRIVE_AUTO_SYNC_STORAGE_KEY = 'interval-timer:drive-auto-sync';
export const DRIVE_LAST_SYNC_STORAGE_KEY = 'interval-timer:drive-last-sync-at';
export const DRIVE_LAST_PUSH_AT_STORAGE_KEY = 'interval-timer:drive-last-push-at';
export const DRIVE_LAST_PULL_AT_STORAGE_KEY = 'interval-timer:drive-last-pull-at';
export const DRIVE_REMOTE_MANIFEST_AT_STORAGE_KEY = 'interval-timer:drive-remote-manifest-at';
export const DRIVE_NEEDS_RECONNECT_STORAGE_KEY = 'interval-timer:drive-needs-reconnect';

export const DRIVE_VAULT_FOLDER = 'vault';
export const DRIVE_TRAININGS_FOLDER = 'trainings';
export const DRIVE_SHARED_FOLDER = 'shared';
export const DRIVE_MANIFEST_FILENAME = 'manifest.json';

export const getDriveRootFolderName = () => DEFAULT_DRIVE_ROOT_FOLDER;

export const getGoogleClientId = () => (GOOGLE_CLIENT_ID || '').trim() || undefined;

export const getGoogleOAuthProxyUrl = () => (OAUTH_PROXY_URL || '').trim() || undefined;

export const getGoogleApiKey = () => (GOOGLE_API_KEY || '').trim() || undefined;

export const isGoogleDriveEnabled = () =>
  GOOGLE_DRIVE_ENABLED === true && !!getGoogleClientId();

export const isGoogleDriveShareEnabled = () =>
  isGoogleDriveEnabled() && !!getGoogleApiKey();

export const isOAuthProxyEnabled = () => !!getGoogleOAuthProxyUrl();

export const isDriveAutoSyncEnabled = () => {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(DRIVE_AUTO_SYNC_STORAGE_KEY);
  if (raw === null) return true;
  return raw === 'true';
};

export const setDriveAutoSyncEnabled = (enabled) => {
  localStorage.setItem(DRIVE_AUTO_SYNC_STORAGE_KEY, enabled ? 'true' : 'false');
};

export const setDriveLastSyncAt = (ts) => {
  localStorage.setItem(DRIVE_LAST_SYNC_STORAGE_KEY, String(ts));
};

export const getDriveLastSyncAt = () => {
  const raw = localStorage.getItem(DRIVE_LAST_SYNC_STORAGE_KEY);
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const setDriveLastPushAt = (ts) => {
  localStorage.setItem(DRIVE_LAST_PUSH_AT_STORAGE_KEY, String(ts));
};

export const setDriveLastPullAt = (ts) => {
  localStorage.setItem(DRIVE_LAST_PULL_AT_STORAGE_KEY, String(ts));
};

export const setDriveRemoteManifestAt = (ts) => {
  localStorage.setItem(DRIVE_REMOTE_MANIFEST_AT_STORAGE_KEY, String(ts));
};

export const isDriveNeedsReconnect = () =>
  typeof window !== 'undefined' &&
  localStorage.getItem(DRIVE_NEEDS_RECONNECT_STORAGE_KEY) === 'true';

export const setDriveNeedsReconnect = (needed) => {
  if (typeof window === 'undefined') return;
  if (needed) localStorage.setItem(DRIVE_NEEDS_RECONNECT_STORAGE_KEY, 'true');
  else localStorage.removeItem(DRIVE_NEEDS_RECONNECT_STORAGE_KEY);
};

export const driveTrainingFilename = (trainingId) => `${trainingId}.json`;

export const shareFilename = () => `share-${Date.now()}.json`;
