import {
  createEmptyManifest,
  ensureDriveFolderStructure,
  findManifestFileId,
  findTrainingFileInFolder,
  listFilesInParent,
  readDriveManifest,
  trashDriveFile,
  uploadTrainingFile,
  withDriveFolderRetry,
  writeDriveManifest,
  downloadFileText,
} from './api.js';
import { isGoogleDriveLinked } from './auth.js';
import {
  setDriveLastPushAt,
  setDriveLastSyncAt,
  setDriveRemoteManifestAt,
  driveTrainingFilename,
} from './config.js';
import { runDriveIoSerialized } from './driveIoLock.js';
import { DriveAuthError } from './errors.js';
import { withDriveAccess } from './withDriveAccess.js';

/**
 * @typedef {{
 *   listTrainings: () => object[],
 *   getTraining: (id: string) => object|null,
 *   upsertTraining: (preset: object) => void,
 *   listDeletedTrainings: () => { id: string, deletedAt: number }[],
 *   removeTraining: (id: string, deletedAt?: number) => void,
 *   clearDeletedTraining: (id: string) => void,
 *   recordDeletedTraining: (id: string, deletedAt: number) => void,
 * }} TrainingStoreAdapter
 */

const mergeDeletedEntries = (...lists) => {
  const byId = new Map();
  for (const list of lists) {
    for (const entry of list || []) {
      if (!entry?.id || !Number.isFinite(entry.deletedAt)) continue;
      const prev = byId.get(entry.id);
      if (!prev || entry.deletedAt > prev.deletedAt) {
        byId.set(entry.id, { id: entry.id, deletedAt: entry.deletedAt });
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.deletedAt - a.deletedAt);
};

export class DriveSyncService {
  /** @param {TrainingStoreAdapter} store */
  constructor(store) {
    this.store = store;
  }

  assertLinked() {
    if (!isGoogleDriveLinked()) {
      throw new DriveAuthError('Sign in with Google first.');
    }
  }

  async backupVaultToDrive(options = {}) {
    this.assertLinked();
    const run = () =>
      runDriveIoSerialized(() =>
        withDriveFolderRetry(() => this.backupVaultToDriveInner()),
      );
    if (options.skipAccessWrap) return run();
    return withDriveAccess(run, { allowInteractive: options.allowInteractive !== false });
  }

  async backupVaultToDriveInner() {
    const folders = await ensureDriveFolderStructure();
    const trainings = this.store.listTrainings();
    const localDeleted = this.store.listDeletedTrainings();
    const existingManifest =
      (await readDriveManifest(folders.vaultId)) ?? createEmptyManifest();
    const manifestFileId = await findManifestFileId(folders.vaultId);
    const existingById = new Map(
      (existingManifest.trainings || []).map((entry) => [entry.id, entry]),
    );
    const remoteDeletedById = new Map(
      (existingManifest.deleted || []).map((entry) => [entry.id, entry]),
    );
    const localDeletedById = new Map(localDeleted.map((entry) => [entry.id, entry]));
    const manifestById = new Map();
    const localIds = new Set(trainings.map((t) => t.id));
    let uploadedTrainings = 0;

    for (const meta of trainings) {
      const localTombstone = localDeletedById.get(meta.id);
      if (localTombstone && localTombstone.deletedAt >= (meta.updatedAt || 0)) {
        continue;
      }
      const remoteTombstone = remoteDeletedById.get(meta.id);
      if (remoteTombstone && remoteTombstone.deletedAt >= (meta.updatedAt || 0)) {
        continue;
      }

      const training = this.store.getTraining(meta.id);
      if (!training) continue;
      const previous = existingById.get(meta.id);
      const nestedFileId = await findTrainingFileInFolder(
        folders.trainingsId,
        meta.id,
      );
      const previousInNested =
        !!previous?.driveFileId &&
        !!nestedFileId &&
        previous.driveFileId === nestedFileId;

      if (previous && previous.updatedAt >= meta.updatedAt && previousInNested) {
        manifestById.set(meta.id, previous);
        continue;
      }

      const content = JSON.stringify(training, null, 2);
      const driveFileId = await uploadTrainingFile({
        trainingsFolderId: folders.trainingsId,
        trainingId: meta.id,
        content,
        existingFileId: nestedFileId,
      });
      manifestById.set(meta.id, {
        id: meta.id,
        name: meta.name,
        updatedAt: meta.updatedAt,
        sortOrder: typeof meta.sortOrder === 'number' ? meta.sortOrder : 0,
        driveFileId,
      });
      uploadedTrainings += 1;
    }

    const nextTrainings = [...manifestById.values()]
      .filter((entry) => localIds.has(entry.id))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // Drop tombstones for ids we are actively syncing as live trainings.
    const liveIds = new Set(nextTrainings.map((entry) => entry.id));
    const nextDeleted = mergeDeletedEntries(
      existingManifest.deleted,
      localDeleted,
    ).filter((entry) => !liveIds.has(entry.id));

    const priorTrainings = (existingManifest.trainings || []).filter((e) =>
      localIds.has(e.id),
    );
    const priorDeleted = existingManifest.deleted || [];
    const changed =
      uploadedTrainings > 0 ||
      nextTrainings.length !== priorTrainings.length ||
      nextDeleted.length !== priorDeleted.length ||
      nextTrainings.some((entry) => {
        const p = priorTrainings.find((x) => x.id === entry.id);
        return !p || p.updatedAt !== entry.updatedAt || p.driveFileId !== entry.driveFileId;
      }) ||
      nextDeleted.some((entry) => {
        const p = priorDeleted.find((x) => x.id === entry.id);
        return !p || p.deletedAt !== entry.deletedAt;
      });

    let syncedAt = existingManifest.updatedAt;
    if (changed) {
      const nextManifest = {
        version: existingManifest.version || 1,
        updatedAt: Date.now(),
        trainings: nextTrainings,
        deleted: nextDeleted,
      };
      await writeDriveManifest(folders.vaultId, nextManifest, manifestFileId);
      syncedAt = nextManifest.updatedAt;
      setDriveRemoteManifestAt(syncedAt);
      setDriveLastSyncAt(syncedAt);
      setDriveLastPushAt(syncedAt);
    }

    try {
      await this.cleanupOrphanTrainingFiles(folders.trainingsId, nextTrainings);
    } catch (error) {
      console.warn('[google-drive] orphan cleanup failed:', error);
    }

    return {
      uploadedTrainings,
      restoredTrainings: 0,
      syncedAt,
    };
  }

    async cleanupOrphanTrainingFiles(trainingsFolderId, trainings) {
      const keepNames = new Set(trainings.map((entry) => driveTrainingFilename(entry.id)));
      const files = await listFilesInParent(trainingsFolderId);
      for (const file of files) {
        if (!file?.name?.endsWith('.json')) continue;
        if (file.name === 'manifest.json') continue;
        if (keepNames.has(file.name)) continue;
        try {
          await trashDriveFile(file.id);
        } catch (error) {
          console.warn('[google-drive] could not trash', file.name, error);
        }
      }
    }

  async pullVaultFromDrive(options = {}) {
    this.assertLinked();
    const run = () =>
      runDriveIoSerialized(() =>
        withDriveFolderRetry(() => this.pullVaultFromDriveInner()),
      );
    if (options.skipAccessWrap) return run();
    return withDriveAccess(run, { allowInteractive: options.allowInteractive !== false });
  }

  async pullVaultFromDriveInner() {
    const folders = await ensureDriveFolderStructure();
    const manifest = await readDriveManifest(folders.vaultId);
    if (!manifest) {
      return {
        restoredTrainings: 0,
        deletedTrainings: 0,
        pulledTrainingIds: [],
        remoteManifestUpdatedAt: null,
      };
    }

    const remoteDeleted = manifest.deleted || [];
    let deletedTrainings = 0;
    let restoredTrainings = 0;
    const pulledTrainingIds = [];

    for (const entry of remoteDeleted) {
      const local = this.store.getTraining(entry.id);
      if (local && (local.updatedAt || 0) < entry.deletedAt) {
        this.store.removeTraining(entry.id, entry.deletedAt);
        deletedTrainings += 1;
      } else if (!local) {
        this.store.recordDeletedTraining(entry.id, entry.deletedAt);
      }
    }

    const remoteDeletedById = new Map(remoteDeleted.map((e) => [e.id, e]));
    const localDeletedById = new Map(
      this.store.listDeletedTrainings().map((e) => [e.id, e]),
    );

    for (const entry of manifest.trainings || []) {
      const tombstone =
        remoteDeletedById.get(entry.id) || localDeletedById.get(entry.id);
      if (tombstone && tombstone.deletedAt >= entry.updatedAt) {
        continue;
      }

      const local = this.store.getTraining(entry.id);
      if (local && local.updatedAt >= entry.updatedAt) continue;

      const content = await downloadFileText(entry.driveFileId);
      let training;
      try {
        training = JSON.parse(content);
      } catch {
        continue;
      }
      if (!training || !Array.isArray(training.segments)) continue;

      training.id = entry.id;
      training.name = entry.name || training.name || 'Training';
      training.updatedAt = entry.updatedAt;
      if (typeof entry.sortOrder === 'number') training.sortOrder = entry.sortOrder;
      if (!training.createdAt) training.createdAt = entry.updatedAt;

      this.store.clearDeletedTraining(entry.id);
      this.store.upsertTraining(training);
      restoredTrainings += 1;
      pulledTrainingIds.push(entry.id);
    }

    // Merge remote tombstones into local store.
    for (const entry of remoteDeleted) {
      this.store.recordDeletedTraining(entry.id, entry.deletedAt);
    }

    return {
      restoredTrainings,
      deletedTrainings,
      pulledTrainingIds,
      remoteManifestUpdatedAt: manifest.updatedAt,
    };
  }

  async pullAndPushVault(options = {}) {
    this.assertLinked();
    const run = () =>
      runDriveIoSerialized(async () => {
        const pull = await withDriveFolderRetry(() => this.pullVaultFromDriveInner());
        const push = await withDriveFolderRetry(() => this.backupVaultToDriveInner());
        return { pull, push };
      });
    if (options.skipAccessWrap) return run();
    return withDriveAccess(run, { allowInteractive: options.allowInteractive !== false });
  }
}
