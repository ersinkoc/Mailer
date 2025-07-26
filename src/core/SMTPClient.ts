import { SMTPConnection, SMTPState } from './SMTPConnection';
import { SMTPAuth } from './SMTPAuth';
import { MailerOptions, Message, SendResult, Address } from '../types';
import { MailerError, ErrorCodes } from '../errors/MailerError';
import { SimpleEncoding } from '../utils/simple-encoding';
import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { basename } from 'path';

export class SMTPClient extends EventEmitter {
  private connection: SMTPConnection | null = null;
  private auth: SMTPAuth | null = null;
  private options: Required<Omit<MailerOptions, 'auth'>> & { auth?: MailerOptions['auth'] };

  constructor(options: MailerOptions) {
    super();
    this.options = this.normalizeOptions(options);
  }

  private normalizeOptions(
    options: MailerOptions,
  ): Required<Omit<MailerOptions, 'auth'>> & { auth?: MailerOptions['auth'] } {
    return {
      host: options.host,
      port: options.port || (options.secure ? 465 : 587),
      secure: options.secure || false,
      auth: options.auth,
      tls: options.tls || { rejectUnauthorized: true },
      pool: options.pool || false,
      connectionTimeout: options.connectionTimeout || 10000,
      greetingTimeout: options.greetingTimeout || 5000,
      socketTimeout: options.socketTimeout || 60000,
      dnsTimeout: options.dnsTimeout || 5000,
      maxConnections: options.maxConnections || 5,
      maxMessages: options.maxMessages || 100,
      rateLimit: options.rateLimit || 0,
      logger: options.logger || false,
      debug: options.debug || false,
      name: options.name || 'localhost',
    };
  }

  public async connect(): Promise<void> {
    if (this.connection && this.connection.getState() !== SMTPState.CLOSED) {
      return;
    }

    this.connection = new SMTPConnection({
      host: this.options.host,
      port: this.options.port,
      secure: this.options.secure,
      connectionTimeout: this.options.connectionTimeout,
      greetingTimeout: this.options.greetingTimeout,
      socketTimeout: this.options.socketTimeout,
    });

    this.setupConnectionHandlers();

    await this.connection.connect();

    // Upgrade to TLS if not secure and STARTTLS is available
    if (!this.options.secure && this.connection.getCapabilities().starttls) {
      await this.connection.upgradeToTLS();
    }

    // Authenticate if credentials provided
    if (this.options.auth) {
      this.auth = new SMTPAuth(this.connection);
      await this.auth.authenticate(this.options.auth);
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    this.connection.on('error', (error) => {
      this.emit('error', error);
    });

    this.connection.on('close', () => {
      this.emit('close');
    });

    if (this.options.debug) {
      this.connection.on('command', (command) => {
        this.log('debug', `> ${command}`);
      });
    }
  }

  public async send(message: Message): Promise<SendResult> {
    if (!this.connection || this.connection.getState() !== SMTPState.READY) {
      await this.connect();
    }

    if (!this.connection) {
      throw new MailerError('Connection not established', ErrorCodes.CONNECTION_FAILED);
    }

    try {
      // Normalize addresses
      const envelope = this.createEnvelope(message);

      // Send MAIL FROM
      await this.sendMailFrom(envelope.from);

      // Send RCPT TO for all recipients
      const accepted: string[] = [];
      const rejected: string[] = [];

      for (const recipient of envelope.to) {
        try {
          await this.sendRcptTo(recipient);
          accepted.push(recipient);
        } catch (error) {
          rejected.push(recipient);
          if (accepted.length === 0 && envelope.to.indexOf(recipient) === envelope.to.length - 1) {
            // All recipients rejected
            throw error;
          }
        }
      }

      if (accepted.length === 0) {
        throw new MailerError(
          'All recipients were rejected',
          ErrorCodes.INVALID_RECIPIENT,
          undefined,
          undefined,
          'Check recipient email addresses',
        );
      }

      // Send DATA
      const messageId = await this.sendData(message, envelope);

      return {
        messageId,
        accepted,
        rejected,
        response: 'Message sent successfully',
        envelope,
      };
    } catch (error) {
      if (error instanceof MailerError) {
        throw error;
      }
      throw new MailerError(
        `Failed to send message: ${(error as Error).message}`,
        ErrorCodes.MESSAGE_REJECTED,
      );
    }
  }

  private createEnvelope(message: Message): { from: string; to: string[] } {
    const from = this.extractAddress(message.from);
    const to: string[] = [];

    // Add TO recipients
    const toAddresses = Array.isArray(message.to) ? message.to : [message.to];
    to.push(...toAddresses.map((addr) => this.extractAddress(addr)));

    // Add CC recipients
    if (message.cc) {
      const ccAddresses = Array.isArray(message.cc) ? message.cc : [message.cc];
      to.push(...ccAddresses.map((addr) => this.extractAddress(addr)));
    }

    // Add BCC recipients
    if (message.bcc) {
      const bccAddresses = Array.isArray(message.bcc) ? message.bcc : [message.bcc];
      to.push(...bccAddresses.map((addr) => this.extractAddress(addr)));
    }

    // Remove duplicates
    const uniqueTo = [...new Set(to)];

    return { from, to: uniqueTo };
  }

  private extractAddress(addr: string | Address): string {
    if (typeof addr === 'string') {
      // Extract email from "Name <email@example.com>" format
      const match = addr.match(/<([^>]+)>/);
      return match ? match[1]! : addr;
    }
    return addr.address;
  }

  private formatAddress(addr: string | Address): string {
    if (typeof addr === 'string') {
      return addr;
    }
    return addr.name ? `"${addr.name}" <${addr.address}>` : addr.address;
  }

  private async sendMailFrom(from: string): Promise<void> {
    if (!this.connection) throw new Error('No connection');

    const response = await this.connection.sendCommand(`MAIL FROM:<${from}>`);
    this.log('debug', `< ${response}`);
  }

  private async sendRcptTo(to: string): Promise<void> {
    if (!this.connection) throw new Error('No connection');

    try {
      const response = await this.connection.sendCommand(`RCPT TO:<${to}>`);
      this.log('debug', `< ${response}`);
    } catch (error) {
      if (error instanceof MailerError) {
        throw new MailerError(
          `Recipient rejected: ${to}`,
          ErrorCodes.INVALID_RECIPIENT,
          error.statusCode,
          error.response,
          'Check recipient email address',
        );
      }
      throw error;
    }
  }

  private async sendData(
    message: Message,
    _envelope: { from: string; to: string[] },
  ): Promise<string> {
    if (!this.connection) throw new Error('No connection');

    // Start DATA command
    await this.connection.sendCommand('DATA');

    // Build message data
    const messageData = this.buildMessageData(message, _envelope);

    // Send message data with dot-stuffing
    const lines = messageData.split('\n');
    for (const line of lines) {
      // Dot-stuffing: prepend dot if line starts with dot
      const stuffedLine = line.startsWith('.') ? `.${line}` : line;
      await this.connection.sendCommand(stuffedLine);
    }

    // End DATA with single dot
    const response = await this.connection.sendCommand('.');
    this.log('debug', `< ${response}`);

    // Extract message ID from response if available
    const messageIdMatch = response.match(/queued as ([A-Za-z0-9]+)/);
    return messageIdMatch ? messageIdMatch[1]! : this.generateMessageId();
  }

  private buildMessageData(message: Message, _envelope: { from: string; to: string[] }): string {
    const headers: string[] = [];

    // Required headers
    headers.push(`From: ${this.formatAddress(message.from)}`);

    if (message.to) {
      const toAddresses = Array.isArray(message.to) ? message.to : [message.to];
      headers.push(`To: ${toAddresses.map((addr) => this.formatAddress(addr)).join(', ')}`);
    }

    if (message.cc) {
      const ccAddresses = Array.isArray(message.cc) ? message.cc : [message.cc];
      headers.push(`Cc: ${ccAddresses.map((addr) => this.formatAddress(addr)).join(', ')}`);
    }

    headers.push(`Subject: ${message.subject}`);
    headers.push(`Date: ${(message.date || new Date()).toUTCString()}`);
    headers.push(`Message-ID: <${message.messageId || this.generateMessageId()}>`);

    // Optional headers
    if (message.priority) {
      const priorityMap = {
        high: '1 (Highest)',
        normal: '3 (Normal)',
        low: '5 (Lowest)',
      };
      headers.push(`X-Priority: ${priorityMap[message.priority]}`);
    }

    if (message.references) {
      headers.push(`References: ${message.references}`);
    }

    if (message.inReplyTo) {
      headers.push(`In-Reply-To: ${message.inReplyTo}`);
    }

    // Custom headers
    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        headers.push(`${key}: ${value}`);
      }
    }

    // MIME headers
    headers.push('MIME-Version: 1.0');

    // Handle attachments if present
    if (message.attachments && message.attachments.length > 0) {
      const boundary = this.generateBoundary();
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

      const parts: string[] = [''];

      // Add message body as the first part
      parts.push(`--${boundary}`);

      if (message.html && message.text) {
        const altBoundary = this.generateBoundary();
        parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
        parts.push('');
        parts.push(`--${altBoundary}`);
        parts.push('Content-Type: text/plain; charset=utf-8');
        parts.push('Content-Transfer-Encoding: quoted-printable');
        parts.push('');
        parts.push(SimpleEncoding.quotedPrintableEncode(message.text));
        parts.push(`--${altBoundary}`);
        parts.push('Content-Type: text/html; charset=utf-8');
        parts.push('Content-Transfer-Encoding: quoted-printable');
        parts.push('');
        parts.push(SimpleEncoding.quotedPrintableEncode(message.html));
        parts.push(`--${altBoundary}--`);
      } else if (message.html) {
        parts.push('Content-Type: text/html; charset=utf-8');
        parts.push('Content-Transfer-Encoding: quoted-printable');
        parts.push('');
        parts.push(SimpleEncoding.quotedPrintableEncode(message.html));
      } else {
        parts.push('Content-Type: text/plain; charset=utf-8');
        parts.push('Content-Transfer-Encoding: quoted-printable');
        parts.push('');
        parts.push(SimpleEncoding.quotedPrintableEncode(message.text || ''));
      }

      // Add attachments
      for (const attachment of message.attachments) {
        parts.push(`--${boundary}`);

        const contentType = attachment.contentType || 'application/octet-stream';
        const disposition = attachment.contentDisposition || 'attachment';
        const encoding = attachment.encoding || 'base64';

        parts.push(
          `Content-Type: ${contentType}${attachment.filename ? `; name="${attachment.filename}"` : ''}`,
        );
        parts.push(`Content-Transfer-Encoding: ${encoding}`);
        parts.push(
          `Content-Disposition: ${disposition}${attachment.filename ? `; filename="${attachment.filename}"` : ''}`,
        );

        if (attachment.cid) {
          parts.push(`Content-ID: <${attachment.cid}>`);
        }

        if (attachment.headers) {
          for (const [key, value] of Object.entries(attachment.headers)) {
            parts.push(`${key}: ${value}`);
          }
        }

        parts.push('');

        // Add attachment content
        let content: Buffer | undefined;

        if (attachment.path) {
          try {
            content = readFileSync(attachment.path);
            // Set filename from path if not provided
            if (!attachment.filename && typeof attachment.path === 'string') {
              const filename = basename(attachment.path);
              // Update the Content-Type and Content-Disposition headers with filename
              const lastIdx = parts.length - 1;
              for (let i = lastIdx; i >= lastIdx - 5 && i >= 0; i--) {
                if (parts[i]!.startsWith('Content-Type:') && !parts[i]!.includes('name=')) {
                  parts[i] += `; name="${filename}"`;
                }
                if (
                  parts[i]!.startsWith('Content-Disposition:') &&
                  !parts[i]!.includes('filename=')
                ) {
                  parts[i] += `; filename="${filename}"`;
                }
              }
            }
          } catch (error) {
            throw new MailerError(
              `Failed to read attachment file: ${attachment.path}`,
              ErrorCodes.INVALID_CONFIG,
              undefined,
              undefined,
              'Check file path and permissions',
            );
          }
        } else if (attachment.content) {
          if (typeof attachment.content === 'string') {
            content = Buffer.from(attachment.content, 'utf-8');
          } else if (Buffer.isBuffer(attachment.content)) {
            content = attachment.content;
          }
        }

        if (content) {
          if (encoding === 'base64') {
            parts.push(
              content
                .toString('base64')
                .match(/.{1,76}/g)
                ?.join('\r\n') || '',
            );
          } else if (encoding === 'quoted-printable') {
            parts.push(SimpleEncoding.quotedPrintableEncode(content.toString('utf-8')));
          } else {
            parts.push(content.toString('utf-8'));
          }
        }
      }

      parts.push(`--${boundary}--`);

      return headers.join('\r\n') + '\r\n' + parts.join('\r\n');
    }

    // No attachments - handle simple messages
    if (message.html && message.text) {
      const boundary = this.generateBoundary();
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

      const body = [
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        SimpleEncoding.quotedPrintableEncode(message.text),
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        SimpleEncoding.quotedPrintableEncode(message.html),
        `--${boundary}--`,
      ].join('\r\n');

      return headers.join('\r\n') + '\r\n' + body;
    } else if (message.html) {
      headers.push('Content-Type: text/html; charset=utf-8');
      headers.push('Content-Transfer-Encoding: quoted-printable');
      return headers.join('\r\n') + '\r\n\r\n' + SimpleEncoding.quotedPrintableEncode(message.html);
    } else {
      headers.push('Content-Type: text/plain; charset=utf-8');
      headers.push('Content-Transfer-Encoding: quoted-printable');
      return (
        headers.join('\r\n') + '\r\n\r\n' + SimpleEncoding.quotedPrintableEncode(message.text || '')
      );
    }
  }

  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const hostname = this.options.name;
    return `${timestamp}.${random}@${hostname}`;
  }

  private generateBoundary(): string {
    return `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private log(level: string, message: string, ...args: unknown[]): void {
    if (!this.options.logger) return;

    if (typeof this.options.logger === 'object') {
      const logger = this.options.logger as any;
      if (typeof logger[level] === 'function') {
        logger[level](message, ...args);
      }
    } else if (this.options.debug) {
      console.log(`[${level.toUpperCase()}] ${message}`, ...args);
    }
  }

  public async verify(): Promise<boolean> {
    try {
      await this.connect();
      if (!this.connection) return false;

      // Try NOOP command to verify connection
      await this.connection.sendCommand('NOOP');
      return true;
    } catch (error) {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
      this.auth = null;
    }
  }
}
