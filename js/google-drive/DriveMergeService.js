import {
  setDriveLastPullAt,
  setDriveLastPushAt,
  setDriveLastSyncAt,
  setDriveRemoteManifestAt,
} from './config.js';
import { isGoogleDriveLinked } from './auth.js';
import { DriveAuthError } from './errors.js';
import { withDriveAccess } from './withDriveAccess.js';

export class DriveMergeService {
  /** @param {import('./DriveSyncService.js').DriveSyncService} syncService */
  constructor(syncService) {
    this.syncService = syncService;
  }

  assertLinked() {
    if (!isGoogleDriveLinked()) {
      throw new DriveAuthError('Sign in with Google first.');
    }
  }

  /**
   * @param {{ silent?: boolean }} [options]
   */
  async mergeVaultWithDrive(options = {}) {
    this.assertLinked();
    const allowInteractive = !options.silent;
    return withDriveAccess(async () => {
      const { pull, push } = await this.syncService.pullAndPushVault({
        skipAccessWrap: true,
      });
      const syncedAt = push.syncedAt;
      setDriveLastSyncAt(syncedAt);
      setDriveLastPullAt(syncedAt);
      setDriveLastPushAt(syncedAt);
      setDriveRemoteManifestAt(syncedAt);

      return {
        pulled: pull.restoredTrainings,
        pushed: push.uploadedTrainings,
        deleted: pull.deletedTrainings || 0,
        syncedAt,
        remoteManifestUpdatedAt: syncedAt,
        pulledTrainingIds: pull.pulledTrainingIds,
      };
    }, { allowInteractive });
  }
}
