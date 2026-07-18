/**
 * Attaches window.TimerDrive for the inline app script in index.html.
 * Expects the host page to call TimerDrive.bindStore(adapter) after loadStore.
 */
import * as Drive from './index.js';
import { DriveMergeService } from './DriveMergeService.js';
import { DriveSyncService } from './DriveSyncService.js';
import { setDriveVaultSyncService } from './driveVaultSync.js';

let syncService = null;
let mergeService = null;

const api = {
  ...Drive,
  bindStore(adapter) {
    syncService = new DriveSyncService(adapter);
    mergeService = new DriveMergeService(syncService);
    setDriveVaultSyncService(syncService);
  },
  async syncNow(options = {}) {
    if (!mergeService) throw new Error('Drive store is not bound.');
    return mergeService.mergeVaultWithDrive(options);
  },
  async backupOnly(options = {}) {
    if (!syncService) throw new Error('Drive store is not bound.');
    return syncService.backupVaultToDrive(options);
  },
  async createShareLink(preset) {
    return Drive.driveShareService.createShareLink(preset);
  },
  async loadSharedTraining(fileId) {
    return Drive.driveShareService.loadSharedTraining(fileId);
  },
};

window.TimerDrive = api;
window.dispatchEvent(new CustomEvent('timer-drive:ready'));
