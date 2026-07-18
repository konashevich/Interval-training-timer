let driveIoQueue = Promise.resolve();

export const runDriveIoSerialized = (fn) => {
  const result = driveIoQueue.then(fn, fn);
  driveIoQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};
