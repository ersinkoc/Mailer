import { Socket } from 'net';
import { TLSSocket, connect as tlsConnect } from 'tls';
import { EventEmitter } from 'events';
import { ConnectionOptions, SMTPCapabilities } from '../types';
import { MailerError, ErrorCodes } from '../errors/MailerError';

export enum SMTPState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  AUTHENTICATED = 'AUTHENTICATED',
  READY = 'READY',
  SENDING = 'SENDING',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  ERROR = 'ERROR',
}

export class SMTPConnection extends EventEmitter {
  private socket: Socket | TLSSocket | null = null;
  private state: SMTPState = SMTPState.CLOSED;
  private capabilities: SMTPCapabilities = {};
  private dataBuffer = '';
  private commandQueue: Array<{
    command: string;
    callback: (error: Error | null, response?: string) => void;
  }> = [];
  private currentCommand: {
    command: string;
    callback: (error: Error | null, response?: string) => void;
  } | null = null;
  private responseBuffer: string[] = [];
  private multilineResponse = false;
  private lastResponseCode = '';
  private destroyed = false;
  private hostname: string;

  constructor(private options: ConnectionOptions) {
    super();
    this.hostname = options.host;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== SMTPState.CLOSED) {
        reject(new MailerError('Connection already established', ErrorCodes.CONNECTION_FAILED));
        return;
      }

      this.state = SMTPState.CONNECTING;
      const connectionTimeout = setTimeout(() => {
        this.destroy();
        reject(
          new MailerError(
            `Connection timeout after ${this.options.connectionTimeout}ms`,
            ErrorCodes.CONNECTION_TIMEOUT,
            undefined,
            undefined,
            'Increase connectionTimeout in options or check network connectivity',
          ),
        );
      }, this.options.connectionTimeout);

      if (this.options.secure) {
        this.socket = tlsConnect({
          host: this.options.host,
          port: this.options.port,
          rejectUnauthorized: true,
          servername: this.options.host,
        });
      } else {
        this.socket = new Socket();
        this.socket.connect(this.options.port, this.options.host);
      }

      this.setupSocketHandlers();

      this.socket.once('connect', () => {
        clearTimeout(connectionTimeout);
        this.state = SMTPState.CONNECTED;
        this.emit('connect');
      });

      this.socket.once('error', (error) => {
        clearTimeout(connectionTimeout);
        this.state = SMTPState.ERROR;
        reject(
          new MailerError(
            `Connection failed: ${error.message}`,
            ErrorCodes.CONNECTION_FAILED,
            undefined,
            undefined,
            'Check host, port, and firewall settings',
          ),
        );
      });

      this.once('greeting', () => {
        this.sendEHLO()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('data', (data: Buffer) => {
      this.dataBuffer += data.toString('utf-8');
      this.processDataBuffer();
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
      this.destroy();
    });

    this.socket.on('close', () => {
      this.state = SMTPState.CLOSED;
      this.emit('close');
      this.cleanup();
    });

    this.socket.on('timeout', () => {
      const error = new MailerError(
        'Socket timeout',
        ErrorCodes.CONNECTION_TIMEOUT,
        undefined,
        undefined,
        'Increase socketTimeout in options',
      );
      this.emit('error', error);
      this.destroy();
    });

    if (this.options.socketTimeout) {
      this.socket.setTimeout(this.options.socketTimeout);
    }
  }

  private processDataBuffer(): void {
    let line: string;
    const lines = this.dataBuffer.split('\r\n');

    this.dataBuffer = lines.pop() || '';

    for (line of lines) {
      this.processLine(line);
    }
  }

  private processLine(line: string): void {
    const match = line.match(/^(\d{3})([- ])(.*)$/);
    if (!match) return;

    const [, code, separator, message] = match;

    if (this.multilineResponse && code === this.lastResponseCode) {
      this.responseBuffer.push(message!);
      if (separator === ' ') {
        this.multilineResponse = false;
        this.handleResponse(parseInt(code, 10), this.responseBuffer.join('\n'));
        this.responseBuffer = [];
        this.lastResponseCode = '';
      }
    } else if (separator === '-') {
      this.multilineResponse = true;
      this.lastResponseCode = code!;
      this.responseBuffer.push(message!);
    } else {
      this.handleResponse(parseInt(code!, 10), message!);
    }
  }

  private handleResponse(code: number, message: string): void {
    if (!this.currentCommand && this.state === SMTPState.CONNECTED && code === 220) {
      this.emit('greeting', message);
      return;
    }

    if (this.currentCommand) {
      const { callback } = this.currentCommand;
      this.currentCommand = null;

      if (code >= 200 && code < 400) {
        callback(null, `${code} ${message}`);
      } else {
        callback(
          new MailerError(
            `SMTP Error: ${message}`,
            ErrorCodes.SMTP_ERROR,
            code,
            `${code} ${message}`,
          ),
        );
      }

      this.processCommandQueue();
    }
  }

  private async sendEHLO(): Promise<void> {
    try {
      const response = await this.sendCommand(`EHLO ${this.hostname}`);
      this.parseEHLOResponse(response);
      this.state = SMTPState.READY;
    } catch (error) {
      await this.sendCommand(`HELO ${this.hostname}`);
      this.state = SMTPState.READY;
    }
  }

  private parseEHLOResponse(response: string): void {
    const lines = response.split('\n');
    lines.slice(1).forEach((line) => {
      const capability = line.trim().toUpperCase();

      if (capability.startsWith('AUTH ')) {
        this.capabilities.auth = capability.substring(5).split(' ');
      } else if (capability.startsWith('SIZE ')) {
        this.capabilities.size = parseInt(capability.substring(5), 10);
      } else if (capability === 'STARTTLS') {
        this.capabilities.starttls = true;
      } else if (capability === '8BITMIME') {
        this.capabilities['8bitmime'] = true;
      } else if (capability === 'PIPELINING') {
        this.capabilities.pipelining = true;
      } else if (capability === 'ENHANCEDSTATUSCODES') {
        this.capabilities.enhancedStatusCodes = true;
      } else if (capability === 'SMTPUTF8') {
        this.capabilities.smtputf8 = true;
      }
    });
  }

  public sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.destroyed || !this.socket) {
        reject(new MailerError('Connection destroyed', ErrorCodes.CONNECTION_FAILED));
        return;
      }

      this.commandQueue.push({
        command,
        callback: (error, response) => {
          if (error) reject(error);
          else resolve(response || '');
        },
      });

      if (!this.currentCommand) {
        this.processCommandQueue();
      }
    });
  }

  private processCommandQueue(): void {
    if (this.currentCommand || this.commandQueue.length === 0) return;

    this.currentCommand = this.commandQueue.shift() || null;
    if (!this.currentCommand || !this.socket) return;

    const { command } = this.currentCommand;
    const logCommand = command.startsWith('AUTH') ? 'AUTH ***' : command;
    this.emit('command', logCommand);

    this.socket.write(`${command}\r\n`, 'utf-8', (error) => {
      if (error && this.currentCommand) {
        const { callback } = this.currentCommand;
        this.currentCommand = null;
        callback(error);
        this.processCommandQueue();
      }
    });
  }

  public async upgradeToTLS(): Promise<void> {
    if (!this.capabilities.starttls || this.options.secure) {
      throw new MailerError('STARTTLS not supported or already using TLS', ErrorCodes.TLS_FAILED);
    }

    await this.sendCommand('STARTTLS');

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new MailerError('No socket available', ErrorCodes.CONNECTION_FAILED));
        return;
      }

      const tlsOptions = {
        socket: this.socket as Socket,
        servername: this.options.host,
        rejectUnauthorized: true,
      };

      const tlsSocket = tlsConnect(tlsOptions, () => {
        this.socket = tlsSocket;
        this.setupSocketHandlers();

        this.sendEHLO()
          .then(() => resolve())
          .catch(reject);
      });

      tlsSocket.on('error', (error) => {
        reject(
          new MailerError(
            `TLS upgrade failed: ${error.message}`,
            ErrorCodes.TLS_FAILED,
            undefined,
            undefined,
            'Check TLS certificate validity',
          ),
        );
      });
    });
  }

  public getCapabilities(): SMTPCapabilities {
    return { ...this.capabilities };
  }

  public getState(): SMTPState {
    return this.state;
  }

  public isSecure(): boolean {
    return this.socket instanceof TLSSocket;
  }

  public async quit(): Promise<void> {
    if (this.state === SMTPState.CLOSED || this.state === SMTPState.CLOSING) return;

    this.state = SMTPState.CLOSING;
    try {
      await this.sendCommand('QUIT');
    } catch {
      // Ignore errors during quit
    }
    this.destroy();
  }

  private destroy(): void {
    this.destroyed = true;
    if (this.socket) {
      this.socket.destroy();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.socket = null;
    this.commandQueue = [];
    this.currentCommand = null;
    this.responseBuffer = [];
    this.dataBuffer = '';
    this.state = SMTPState.CLOSED;
  }
}
