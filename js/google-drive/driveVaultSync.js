import {
  isDriveAutoSyncEnabled,
  isGoogleDriveEnabled,
  setDriveLastSyncAt,
} from './config.js';
import { getAccessToken, isGoogleDriveLinked, tryRefreshAccessToken } from './auth.js';
import { DriveApiError } from './errors.js';

const DRIVE_SYNC_DEBOUNCE_MS = 2500;

let syncService = null;
let debounceTimer = null;

export const setDriveVaultSyncService = (service) => {
  syncService = service;
};

const runDriveVaultBackup = async () => {
  if (
    !isGoogleDriveEnabled() ||
    !isGoogleDriveLinked() ||
    !isDriveAutoSyncEnabled() ||
    !syncService
  ) {
    return;
  }
  if (!(await tryRefreshAccessToken()) || !getAccessToken()) return;
  try {
    const result = await syncService.backupVaultToDrive();
    setDriveLastSyncAt(result.syncedAt);
    window.dispatchEvent(
      new CustomEvent('timer-drive:synced', { detail: result }),
    );
    return result;
  } catch (error) {
    console.error('[google-drive] auto-sync failed:', error);
    if (error instanceof DriveApiError && (error.status === 401 || error.status === 403)) {
      window.dispatchEvent(new CustomEvent('timer-drive:auto-sync-failed'));
    }
  }
};

export const scheduleDriveVaultSync = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runDriveVaultBackup();
  }, DRIVE_SYNC_DEBOUNCE_MS);
};

export const flushDriveVaultSync = async () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  await runDriveVaultBackup();
};
