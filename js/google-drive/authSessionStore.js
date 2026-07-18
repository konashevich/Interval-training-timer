import {
  DRIVE_TOKEN_EXPIRY_STORAGE_KEY,
  DRIVE_TOKEN_STORAGE_KEY,
} from './config.js';

const IDB_NAME = 'interval-timer-drive-auth';
const IDB_STORE = 'session';
const IDB_SESSION_KEY = 'oauth-session';

let sessionStoreQueue = Promise.resolve();

const isValidSession = (session) =>
  !!session &&
  !!session.accessToken &&
  Number.isFinite(session.expiresAt) &&
  session.expiresAt > Date.now();

const enqueueSessionStoreOp = (op) => {
  const result = sessionStoreQueue.then(op, op);
  sessionStoreQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const openIdb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const readSessionFromLocalStorage = () => {
  const accessToken = localStorage.getItem(DRIVE_TOKEN_STORAGE_KEY);
  const expiryRaw = localStorage.getItem(DRIVE_TOKEN_EXPIRY_STORAGE_KEY);
  if (!accessToken || !expiryRaw) return null;
  const expiresAt = Number(expiryRaw);
  const session = { accessToken, expiresAt };
  if (!isValidSession(session)) {
    clearSessionFromLocalStorage();
    return null;
  }
  return session;
};

export const writeSessionToLocalStorage = (session) => {
  localStorage.setItem(DRIVE_TOKEN_STORAGE_KEY, session.accessToken);
  localStorage.setItem(DRIVE_TOKEN_EXPIRY_STORAGE_KEY, String(session.expiresAt));
};

export const clearSessionFromLocalStorage = () => {
  localStorage.removeItem(DRIVE_TOKEN_STORAGE_KEY);
  localStorage.removeItem(DRIVE_TOKEN_EXPIRY_STORAGE_KEY);
};

const readSessionFromIdb = async () => {
  try {
    const db = await openIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_SESSION_KEY);
      req.onsuccess = () => {
        const session = req.result || null;
        resolve(isValidSession(session) ? session : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
};

const writeSessionToIdb = async (session) => {
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(session, IDB_SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // private mode
  }
};

const clearSessionFromIdb = async () => {
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
};

export const hydrateDriveAuthSessionFromIdb = async () => {
  if (readSessionFromLocalStorage()) return true;
  const idbSession = await readSessionFromIdb();
  if (!idbSession) return false;
  writeSessionToLocalStorage(idbSession);
  return true;
};

export const persistDriveAuthSession = async (accessToken, expiresInSeconds) => {
  const expiresAt = Date.now() + expiresInSeconds * 1000 - 60_000;
  const session = { accessToken, expiresAt };
  return enqueueSessionStoreOp(async () => {
    writeSessionToLocalStorage(session);
    await writeSessionToIdb(session);
    return session;
  });
};

export const clearDriveAuthSession = async () => {
  await enqueueSessionStoreOp(async () => {
    clearSessionFromLocalStorage();
    await clearSessionFromIdb();
  });
};
