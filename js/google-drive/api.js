import {
  DRIVE_API_BASE,
  DRIVE_FILE_MIME_TYPE,
  DRIVE_FOLDER_CACHE_KEY,
  DRIVE_MANIFEST_FILENAME,
  DRIVE_MANIFEST_VERSION,
  DRIVE_SHARED_FOLDER,
  DRIVE_TRAININGS_FOLDER,
  DRIVE_UPLOAD_API_BASE,
  DRIVE_VAULT_FOLDER,
  driveTrainingFilename,
  getDriveRootFolderName,
  getGoogleApiKey,
} from './config.js';
import { getAccessToken, handleDriveAuthFailure } from './auth.js';
import { DriveApiError } from './errors.js';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

const readFolderCache = () => {
  try {
    const raw = localStorage.getItem(DRIVE_FOLDER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeFolderCache = (ids) => {
  localStorage.setItem(DRIVE_FOLDER_CACHE_KEY, JSON.stringify(ids));
};

export const clearDriveFolderCache = () => {
  localStorage.removeItem(DRIVE_FOLDER_CACHE_KEY);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableNetworkError = (error) =>
  error instanceof TypeError &&
  /failed to fetch|networkerror|load failed/i.test(error.message);

const maybeClearSessionOnAuthError = (status, message) => {
  if (status !== 401) return;
  const lower = String(message).toLowerCase();
  if (
    lower.includes('invalid credentials') ||
    lower.includes('unauthorized') ||
    lower.includes('token has been expired') ||
    lower.includes('token has been revoked') ||
    lower.includes('login required')
  ) {
    handleDriveAuthFailure();
  }
};

const driveFetch = async (path, init = {}, attempt = 0) => {
  const token = getAccessToken();
  if (!token) throw new DriveApiError('Not signed in to Google.', 401);

  let response;
  try {
    response = await fetch(`${DRIVE_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (isRetryableNetworkError(error) && attempt < 2) {
      await sleep(400 * 2 ** attempt);
      return driveFetch(path, init, attempt + 1);
    }
    throw error;
  }

  if (!response.ok) {
    let message = `Google Drive request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.error?.message) message = body.error.message;
    } catch {
      // ignore
    }
    if (response.status === 401) maybeClearSessionOnAuthError(response.status, message);
    if (response.status === 404 && readFolderCache()) clearDriveFolderCache();
    throw new DriveApiError(message, response.status);
  }
  return response;
};

const findChildFolder = async (parentId, name) => {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`,
  );
  const response = await driveFetch(
    `/files?q=${q}&fields=files(id,name)&orderBy=createdTime&pageSize=10&spaces=drive`,
  );
  const data = await response.json();
  return data.files?.[0]?.id ?? null;
};

const createFolder = async (name, parentId) => {
  const response = await driveFetch('/files?fields=id', {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    }),
  });
  const data = await response.json();
  return data.id;
};

export const ensureChildFolder = async (parentId, name) => {
  const existing = await findChildFolder(parentId, name);
  if (existing) return existing;
  return createFolder(name, parentId);
};

const listRootFolders = async () => {
  const rootName = getDriveRootFolderName();
  const q = encodeURIComponent(
    `name='${rootName.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false and 'root' in parents`,
  );
  const response = await driveFetch(
    `/files?q=${q}&fields=files(id,name)&orderBy=createdTime&pageSize=100&spaces=drive`,
  );
  const data = await response.json();
  return data.files ?? [];
};

const ensureRootFolder = async () => {
  const roots = await listRootFolders();
  if (roots.length === 0) return createFolder(getDriveRootFolderName(), 'root');
  return roots[0].id;
};

const isCompleteFolderIds = (ids) =>
  !!ids?.rootId && !!ids.vaultId && !!ids.trainingsId && !!ids.sharedId;

const buildDriveFolderStructure = async () => {
  const rootId = await ensureRootFolder();
  const vaultId = await ensureChildFolder(rootId, DRIVE_VAULT_FOLDER);
  const trainingsId = await ensureChildFolder(vaultId, DRIVE_TRAININGS_FOLDER);
  const sharedId = await ensureChildFolder(rootId, DRIVE_SHARED_FOLDER);
  const ids = { rootId, vaultId, trainingsId, sharedId };
  writeFolderCache(ids);
  return ids;
};

let folderStructurePromise = null;

export const ensureDriveFolderStructure = async () => {
  const cached = readFolderCache();
  if (isCompleteFolderIds(cached)) return cached;
  if (!folderStructurePromise) {
    folderStructurePromise = buildDriveFolderStructure()
      .then((ids) => {
        writeFolderCache(ids);
        return ids;
      })
      .finally(() => {
        folderStructurePromise = null;
      });
  }
  return folderStructurePromise;
};

export const withDriveFolderRetry = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DriveApiError && error.status === 404) {
      clearDriveFolderCache();
      return fn();
    }
    throw error;
  }
};

const findFileInParent = async (parentId, name) => {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`,
  );
  const response = await driveFetch(
    `/files?q=${q}&fields=files(id,name)&pageSize=1&spaces=drive`,
  );
  const data = await response.json();
  return data.files?.[0]?.id ?? null;
};

const parseDriveErrorMessage = async (response, fallback) => {
  try {
    const body = await response.json();
    if (body.error?.message) return body.error.message;
  } catch {
    // ignore
  }
  return fallback;
};

export const uploadTextFile = async (options) => {
  const mimeType = options.mimeType ?? DRIVE_FILE_MIME_TYPE;
  const metadata = {
    name: options.name,
    mimeType,
    ...(options.existingFileId ? {} : { parents: [options.parentId] }),
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  );
  form.append(
    'file',
    new Blob([options.content], { type: mimeType }),
    options.name,
  );

  const token = getAccessToken();
  if (!token) throw new DriveApiError('Not signed in to Google.', 401);

  const url = options.existingFileId
    ? `${DRIVE_UPLOAD_API_BASE}/files/${options.existingFileId}?uploadType=multipart&fields=id`
    : `${DRIVE_UPLOAD_API_BASE}/files?uploadType=multipart&fields=id`;

  let response = await fetch(url, {
    method: options.existingFileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  }).catch(async (error) => {
    if (isRetryableNetworkError(error)) {
      await sleep(400);
      return fetch(url, {
        method: options.existingFileId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    }
    throw error;
  });

  if (!response.ok) {
    const message = await parseDriveErrorMessage(
      response,
      `Upload failed (${response.status})`,
    );
    if (response.status === 401) maybeClearSessionOnAuthError(response.status, message);
    throw new DriveApiError(message, response.status);
  }

  const data = await response.json();
  return data.id;
};

export const downloadFileText = async (fileId) => {
  const response = await driveFetch(`/files/${fileId}?alt=media`);
  return response.text();
};

export const downloadFileTextWithApiKey = async (fileId) => {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    throw new DriveApiError(
      'Public share download is not configured (missing API key).',
      0,
    );
  }
  const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new DriveApiError(
      `Could not download shared file (${response.status}).`,
      response.status,
    );
  }
  return response.text();
};

export const readDriveManifest = async (vaultFolderId) => {
  const manifestFileId = await findFileInParent(vaultFolderId, DRIVE_MANIFEST_FILENAME);
  if (!manifestFileId) return null;
  const text = await downloadFileText(manifestFileId);
    try {
      const manifest = JSON.parse(text);
      if (typeof manifest.version !== 'number' || !Array.isArray(manifest.trainings)) {
        return null;
      }
      if (!Array.isArray(manifest.deleted)) manifest.deleted = [];
      return manifest;
    } catch {
      return null;
    }
};

export const writeDriveManifest = async (vaultFolderId, manifest, existingFileId) => {
  const resolvedFileId =
    existingFileId ?? (await findFileInParent(vaultFolderId, DRIVE_MANIFEST_FILENAME));
  return uploadTextFile({
    parentId: vaultFolderId,
    name: DRIVE_MANIFEST_FILENAME,
    content: JSON.stringify(manifest, null, 2),
    mimeType: 'application/json',
    existingFileId: resolvedFileId,
  });
};

export const findManifestFileId = async (vaultFolderId) =>
  findFileInParent(vaultFolderId, DRIVE_MANIFEST_FILENAME);

export const findTrainingFileInFolder = async (folderId, trainingId) =>
  findFileInParent(folderId, driveTrainingFilename(trainingId));

export const uploadTrainingFile = async (options) => {
  const name = driveTrainingFilename(options.trainingId);
  const resolvedFileId =
    options.existingFileId ?? (await findFileInParent(options.trainingsFolderId, name));
  return uploadTextFile({
    parentId: options.trainingsFolderId,
    name,
    content: options.content,
    existingFileId: resolvedFileId,
  });
};

export const createEmptyManifest = () => ({
  version: DRIVE_MANIFEST_VERSION,
  updatedAt: Date.now(),
  trainings: [],
  deleted: [],
});

export const listFilesInParent = async (parentId) => {
  const files = [];
  let pageToken;
  do {
    const q = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
    const pageTokenQuery = pageToken
      ? `&pageToken=${encodeURIComponent(pageToken)}`
      : '';
    const response = await driveFetch(
      `/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=200&spaces=drive${pageTokenQuery}`,
    );
    const data = await response.json();
    if (data.files?.length) files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
};

export const setFilePermissionAnyoneReader = async (fileId) => {
  await driveFetch(`/files/${fileId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ type: 'anyone', role: 'reader' }),
  });
};

export const trashDriveFile = async (fileId) => {
  await driveFetch(`/files/${fileId}`, {
    method: 'PATCH',
    body: JSON.stringify({ trashed: true }),
  });
};
