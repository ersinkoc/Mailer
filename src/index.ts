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

// Version
export const VERSION = '1.0.0';
