export {
  initDriveAuth,
  signInWithGoogle,
  signOutFromGoogle,
  reconnectGoogle,
  isGoogleDriveLinked,
  getGoogleAccountEmail,
  ensureAccessToken,
  warmDriveAccessToken,
  tryRefreshAccessToken,
} from './auth.js';

export {
  isGoogleDriveEnabled,
  isGoogleDriveShareEnabled,
  isDriveAutoSyncEnabled,
  setDriveAutoSyncEnabled,
  getDriveLastSyncAt,
  isDriveNeedsReconnect,
} from './config.js';

export { DriveSyncService } from './DriveSyncService.js';
export { DriveMergeService } from './DriveMergeService.js';
export {
  scheduleDriveVaultSync,
  flushDriveVaultSync,
  setDriveVaultSyncService,
} from './driveVaultSync.js';
export { driveShareService } from './DriveShareService.js';
export {
  parseShareFileIdFromLocation,
  clearShareHashFromLocation,
  buildShareUrl,
} from './shareLink.js';
export { withDriveAccess } from './withDriveAccess.js';
export { DriveAuthError, DriveApiError, DriveNotConfiguredError } from './errors.js';
