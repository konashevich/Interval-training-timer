import { ensureAccessToken, handleDriveAuthFailure, tryRefreshAccessToken, getAccessToken } from './auth.js';
import { setDriveNeedsReconnect } from './config.js';
import { DriveApiError, DriveAuthError } from './errors.js';

/**
 * @param {() => Promise<T>} action
 * @param {{ allowInteractive?: boolean }} [options]
 * @returns {Promise<T>}
 * @template T
 */
export const withDriveAccess = async (action, options = {}) => {
  const allowInteractive = options.allowInteractive !== false;

  if (allowInteractive) {
    await ensureAccessToken();
  } else if (!(await tryRefreshAccessToken()) || !getAccessToken()) {
    setDriveNeedsReconnect(true);
    throw new DriveAuthError('Sign in with Google again.');
  }

  try {
    return await action();
  } catch (err) {
    if (err instanceof DriveApiError && err.status === 401) {
      handleDriveAuthFailure();
      if (!allowInteractive) {
        setDriveNeedsReconnect(true);
        throw err;
      }
      await ensureAccessToken();
      return await action();
    }
    throw err;
  }
};

export const isDriveAccessRefreshError = (error) =>
  (error instanceof DriveApiError && error.status === 401) ||
  error instanceof DriveAuthError;
