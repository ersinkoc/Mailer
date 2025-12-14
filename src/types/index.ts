export interface Address {
  name?: string;
  address: string;
}

export interface Attachment {
  filename?: string;
  content?: string | Buffer | NodeJS.ReadableStream;
  path?: string;
  contentType?: string;
  contentDisposition?: 'attachment' | 'inline';
  cid?: string;
  encoding?: 'base64' | '7bit' | 'quoted-printable';
  headers?: Record<string, string>;
}

export interface Message {
  from: string | Address;
  to: string | Address | Array<string | Address>;
  cc?: string | Address | Array<string | Address>;
  bcc?: string | Address | Array<string | Address>;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  references?: string;
  inReplyTo?: string;
  messageId?: string;
  date?: Date;
  encoding?: string;
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
  envelope: {
    from: string;
    to: string[];
  };
}

export interface MailerOptions {
  host: string;
  port?: number;
  secure?: boolean;
  auth?:
    | {
        type?: 'plain' | 'login' | 'cram-md5' | 'xoauth2';
        user: string;
        pass?: string;
        accessToken?: string;
      }
    | undefined;
  tls?: {
    rejectUnauthorized?: boolean;
    minVersion?: SecureVersion;
    ciphers?: string;
  };
  pool?: boolean | PoolOptions;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
  dnsTimeout?: number;
  maxConnections?: number;
  maxMessages?: number;
  rateLimit?: number;
  logger?: boolean | Logger;
  debug?: boolean;
  name?: string;
}

export interface PoolOptions {
  max?: number;
  min?: number;
  idle?: number;
  acquire?: number;
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// Forward declaration to avoid circular dependency
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export declare class Mailer {}

export interface Plugin {
  name: string;
  version?: string;
  install(mailer: Mailer): void;
  uninstall?(): void;
}

import { SecureVersion } from 'tls';

export interface ConnectionOptions {
  host: string;
  port: number;
  secure: boolean;
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
  tls?: {
    rejectUnauthorized?: boolean;
    minVersion?: SecureVersion;
    ciphers?: string;
  };
}

export interface SMTPCapabilities {
  auth?: string[];
  size?: number;
  enhancedStatusCodes?: boolean;
  '8bitmime'?: boolean;
  pipelining?: boolean;
  starttls?: boolean;
  smtputf8?: boolean;
}
