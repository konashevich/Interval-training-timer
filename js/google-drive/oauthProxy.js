import {
  DRIVE_OAUTH_SCOPES,
  getGoogleClientId,
  getGoogleOAuthProxyUrl,
  isOAuthProxyEnabled,
} from './config.js';
import { persistDriveAuthSession } from './authSessionStore.js';
import { DriveAuthError } from './errors.js';

const PKCE_VERIFIER_KEY = 'interval-timer:oauth-pkce-verifier';
const OAUTH_CALLBACK_PATH = '/oauth-callback.html';
const OAUTH_MESSAGE_TYPE = 'interval-timer-oauth';

const proxyUrl = (path) => {
  const base = getGoogleOAuthProxyUrl();
  if (!base) throw new DriveAuthError('OAuth proxy is not configured.');
  return `${base.replace(/\/$/, '')}${path}`;
};

const oauthRedirectUri = () => `${window.location.origin}${OAUTH_CALLBACK_PATH}`;

const randomVerifier = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const sha256Base64Url = async (value) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const waitForOAuthPopupCode = () =>
  new Promise((resolve, reject) => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.type !== OAUTH_MESSAGE_TYPE) return;
      window.removeEventListener('message', onMessage);
      if (data.code) {
        resolve(data.code);
        return;
      }
      reject(new DriveAuthError(data.error || 'Google sign-in was cancelled.'));
    };
    window.addEventListener('message', onMessage);
    setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new DriveAuthError('Google sign-in timed out.'));
    }, 120_000);
  });

const openGoogleAuthPopup = (authUrl) => {
  const width = 500;
  const height = 650;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popup = window.open(
    authUrl,
    'interval-timer-google-oauth',
    `width=${width},height=${height},left=${left},top=${top}`,
  );
  if (!popup) {
    throw new DriveAuthError('Allow pop-ups to sign in with Google.');
  }
};

const postProxy = async (path, body) => {
  const response = await fetch(proxyUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new DriveAuthError(data.error || `OAuth proxy error (${response.status})`);
  }
  return data;
};

const persistProxyTokens = async (data) => {
  const session = await persistDriveAuthSession(data.access_token, data.expires_in);
  return {
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    email: data.email,
  };
};

export { isOAuthProxyEnabled };

export const signInViaOAuthProxy = async (options = {}) => {
  const clientId = getGoogleClientId();
  if (!clientId) throw new DriveAuthError('Google client ID is not configured.');

  const verifier = randomVerifier();
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  const challenge = await sha256Base64Url(verifier);
  const redirectUri = oauthRedirectUri();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_OAUTH_SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: options.forceConsent ? 'consent' : 'select_account',
  });
  if (options.loginHint) params.set('login_hint', options.loginHint);

  const codePromise = waitForOAuthPopupCode();
  openGoogleAuthPopup(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );

  const code = await codePromise;
  const storedVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  if (!storedVerifier) throw new DriveAuthError('OAuth PKCE verifier was lost.');

  const data = await postProxy('/oauth/exchange', {
    code,
    code_verifier: storedVerifier,
    redirect_uri: redirectUri,
  });
  return persistProxyTokens(data);
};

export const refreshViaOAuthProxy = async () => {
  if (!isOAuthProxyEnabled()) return null;
  try {
    const data = await postProxy('/oauth/refresh');
    return persistProxyTokens(data);
  } catch {
    return null;
  }
};

export const revokeOAuthProxySession = async () => {
  if (!isOAuthProxyEnabled()) return;
  try {
    await fetch(proxyUrl('/oauth/revoke'), {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore
  }
};
