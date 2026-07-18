import {
  DRIVE_ACCOUNT_EMAIL_STORAGE_KEY,
  DRIVE_FOLDER_CACHE_KEY,
  DRIVE_LINKED_STORAGE_KEY,
  isGoogleDriveEnabled,
  setDriveNeedsReconnect,
} from './config.js';
import {
  clearDriveAuthSession,
  hydrateDriveAuthSessionFromIdb,
  readSessionFromLocalStorage,
} from './authSessionStore.js';
import { DriveAuthError, DriveNotConfiguredError } from './errors.js';
import {
  isOAuthProxyEnabled,
  refreshViaOAuthProxy,
  revokeOAuthProxySession,
  signInViaOAuthProxy,
} from './oauthProxy.js';

let driveAuthInitPromise = null;

const readStoredSession = () => {
  const session = readSessionFromLocalStorage();
  if (!session) return null;
  return { accessToken: session.accessToken, expiresAt: session.expiresAt };
};

const readStoredAccountEmail = () =>
  localStorage.getItem(DRIVE_ACCOUNT_EMAIL_STORAGE_KEY)?.trim() || undefined;

const persistAccountEmail = (email) => {
  if (email) localStorage.setItem(DRIVE_ACCOUNT_EMAIL_STORAGE_KEY, email);
  else localStorage.removeItem(DRIVE_ACCOUNT_EMAIL_STORAGE_KEY);
};

const markGoogleDriveLinked = () => {
  localStorage.setItem(DRIVE_LINKED_STORAGE_KEY, 'true');
};

const clearGoogleDriveLinked = () => {
  localStorage.removeItem(DRIVE_LINKED_STORAGE_KEY);
  localStorage.removeItem(DRIVE_ACCOUNT_EMAIL_STORAGE_KEY);
};

const fetchUserEmail = async (accessToken) => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.email;
  } catch {
    return undefined;
  }
};

export const initDriveAuth = () => {
  if (!isGoogleDriveEnabled()) return Promise.resolve(false);
  if (!driveAuthInitPromise) {
    driveAuthInitPromise = hydrateDriveAuthSessionFromIdb();
  }
  return driveAuthInitPromise;
};

export const isGoogleDriveLinked = () => {
  if (localStorage.getItem(DRIVE_LINKED_STORAGE_KEY) === 'true') return true;
  if (readStoredSession()) {
    markGoogleDriveLinked();
    return true;
  }
  return false;
};

export const getAccessToken = () => readStoredSession()?.accessToken ?? null;

export const getGoogleAccountEmail = async () => {
  const cached = readStoredAccountEmail();
  const token = getAccessToken();
  if (!token) return cached;
  const email = await fetchUserEmail(token);
  if (email) persistAccountEmail(email);
  return email ?? cached;
};

const completeProxySignIn = async (session) => {
  markGoogleDriveLinked();
  setDriveNeedsReconnect(false);
  if (session.email) persistAccountEmail(session.email);
  window.dispatchEvent(new CustomEvent('timer-drive:linked'));
  return session;
};

export const warmDriveAccessToken = async () => {
  if (getAccessToken()) return true;
  await initDriveAuth();
  if (getAccessToken()) return true;
  if (!isGoogleDriveLinked()) return false;
  const session = await refreshViaOAuthProxy();
  return !!session?.accessToken;
};

export const signInWithGoogle = async (options = {}) => {
  if (!isGoogleDriveEnabled()) throw new DriveNotConfiguredError();
  if (!isOAuthProxyEnabled()) {
    throw new DriveAuthError('OAuth proxy URL is not configured.');
  }
  const loginHint = readStoredAccountEmail();
  const session = await signInViaOAuthProxy({
    forceConsent: options.forceConsent || !isGoogleDriveLinked(),
    loginHint,
  });
  return completeProxySignIn(session);
};

export const ensureAccessToken = async () => {
  const existing = getAccessToken();
  if (existing) return existing;
  await initDriveAuth();
  const hydrated = getAccessToken();
  if (hydrated) return hydrated;
  if (!isGoogleDriveLinked()) {
    throw new DriveAuthError('Sign in with Google first.');
  }
  const session = await refreshViaOAuthProxy();
  if (session?.accessToken) {
    if (session.email) persistAccountEmail(session.email);
    return session.accessToken;
  }
  const signedIn = await signInViaOAuthProxy({
    loginHint: readStoredAccountEmail(),
  });
  await completeProxySignIn(signedIn);
  return signedIn.accessToken;
};

export const tryRefreshAccessToken = async () => {
  if (getAccessToken()) return true;
  if (!isGoogleDriveLinked()) return false;
  const session = await refreshViaOAuthProxy();
  return !!session?.accessToken;
};

export const signOutFromGoogle = async () => {
  await revokeOAuthProxySession();
  await clearDriveAuthSession();
  clearGoogleDriveLinked();
  setDriveNeedsReconnect(false);
  localStorage.removeItem(DRIVE_FOLDER_CACHE_KEY);
  driveAuthInitPromise = null;
  window.dispatchEvent(new CustomEvent('timer-drive:signed-out'));
};

/** Force consent so a new refresh token is issued after revoke/expiry. */
export const reconnectGoogle = async () =>
  signInWithGoogle({ forceConsent: true });

export const handleDriveAuthFailure = () => {
  void clearDriveAuthSession();
  localStorage.removeItem(DRIVE_FOLDER_CACHE_KEY);
  setDriveNeedsReconnect(true);
  window.dispatchEvent(new CustomEvent('timer-drive:needs-reconnect'));
};
