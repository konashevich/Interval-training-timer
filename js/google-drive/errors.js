export class DriveNotConfiguredError extends Error {
  constructor() {
    super(
      'Google Drive sync is not configured. Set GOOGLE_CLIENT_ID in js/google-drive/config.js.',
    );
    this.name = 'DriveNotConfiguredError';
  }
}

export class DriveAuthError extends Error {
  constructor(message = 'Google sign-in failed or was cancelled.') {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export class DriveApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
  }
}
