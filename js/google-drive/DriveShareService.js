import {
  downloadFileText,
  downloadFileTextWithApiKey,
  ensureDriveFolderStructure,
  setFilePermissionAnyoneReader,
  uploadTextFile,
  withDriveFolderRetry,
} from './api.js';
import { ensureAccessToken, getAccessToken, isGoogleDriveLinked } from './auth.js';
import { shareFilename } from './config.js';
import { DriveAuthError } from './errors.js';
import { buildShareUrl } from './shareLink.js';
import { withDriveAccess } from './withDriveAccess.js';

export class DriveShareService {
  async assertReady() {
    if (!isGoogleDriveLinked()) {
      throw new DriveAuthError('Sign in with Google to share.');
    }
    await ensureAccessToken();
    if (!getAccessToken()) {
      throw new DriveAuthError('Sign in with Google to share.');
    }
  }

  async createShareLink(preset) {
    await this.assertReady();
    if (!preset || !preset.segments?.length) {
      throw new Error('Cannot share an empty training.');
    }

    const content = JSON.stringify(
      {
        format: 'interval-timer-training',
        version: 1,
        exportedAt: Date.now(),
        training: preset,
      },
      null,
      2,
    );

    return withDriveAccess(() =>
      withDriveFolderRetry(async () => {
        const folders = await ensureDriveFolderStructure();
        const fileId = await uploadTextFile({
          parentId: folders.sharedId,
          name: shareFilename(),
          content,
        });
        await setFilePermissionAnyoneReader(fileId);
        return { url: buildShareUrl(fileId), fileId };
      }),
    );
  }

  async loadSharedTraining(fileId) {
    let content;
    const token = getAccessToken();
    try {
      content = token
        ? await downloadFileText(fileId)
        : await downloadFileTextWithApiKey(fileId);
    } catch (firstError) {
      if (token) {
        try {
          content = await downloadFileTextWithApiKey(fileId);
        } catch {
          throw new Error(
            'Could not open this shared training. Check the link or sign in with Google.',
          );
        }
      } else {
        throw new Error(
          firstError instanceof Error
            ? firstError.message
            : 'Could not open this shared training.',
        );
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Shared file is not valid JSON.');
    }

    const training = parsed.training || parsed;
    if (!training || !Array.isArray(training.segments)) {
      throw new Error('Shared file does not contain a training.');
    }
    return training;
  }
}

export const driveShareService = new DriveShareService();
