// Main exports
export { Mailer } from './Mailer';

// Type exports
export type {
  MailerOptions,
  Message,
  SendResult,
  Address,
  Attachment,
  Plugin,
  Logger,
  PoolOptions,
  ConnectionOptions,
  SMTPCapabilities,
} from './types';

// Error exports
export { MailerError, ErrorCodes } from './errors/MailerError';

// Encoding utilities for advanced users
export { SimpleEncoding } from './utils/simple-encoding';

// Version - BUG-001 fix: Import from package.json to stay in sync
import packageJson from '../package.json';
export const VERSION = packageJson.version;
