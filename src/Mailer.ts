import { EventEmitter } from 'events';
import { SMTPClient } from './core/SMTPClient';
import { MailerOptions, Message, SendResult, Plugin } from './types';
import { MailerError, ErrorCodes } from './errors/MailerError';

export class Mailer extends EventEmitter {
  private client: SMTPClient;
  private plugins: Map<string, Plugin> = new Map();
  private destroyed = false;

  constructor(options: MailerOptions) {
    super();

    this.validateOptions(options);
    this.client = new SMTPClient(options);
    this.setupEventForwarding();
  }

  private validateOptions(options: MailerOptions): void {
    if (!options.host) {
      throw new MailerError(
        'Host is required',
        ErrorCodes.INVALID_CONFIG,
        undefined,
        undefined,
        'Provide a valid SMTP host in options.host',
      );
    }

    if (options.port && (options.port < 1 || options.port > 65535)) {
      throw new MailerError(
        'Invalid port number',
        ErrorCodes.INVALID_CONFIG,
        undefined,
        undefined,
        'Port must be between 1 and 65535',
      );
    }

    if (options.auth) {
      if (!options.auth.user) {
        throw new MailerError(
          'Username is required when auth is specified',
          ErrorCodes.INVALID_CONFIG,
          undefined,
          undefined,
          'Provide auth.user in options',
        );
      }

      if (options.auth.type === 'xoauth2' && !options.auth.accessToken) {
        throw new MailerError(
          'Access token is required for XOAUTH2',
          ErrorCodes.INVALID_CONFIG,
          undefined,
          undefined,
          'Provide auth.accessToken for XOAUTH2',
        );
      } else if (options.auth.type !== 'xoauth2' && !options.auth.pass) {
        throw new MailerError(
          'Password is required for non-XOAUTH2 authentication',
          ErrorCodes.INVALID_CONFIG,
          undefined,
          undefined,
          'Provide auth.pass in options',
        );
      }
    }
  }

  private setupEventForwarding(): void {
    this.client.on('error', (error) => {
      this.emit('error', error);
    });

    this.client.on('close', () => {
      this.emit('close');
    });
  }

  public async send(message: Message): Promise<SendResult> {
    if (this.destroyed) {
      throw new MailerError('Mailer has been destroyed', ErrorCodes.INVALID_CONFIG);
    }

    this.validateMessage(message);

    // Emit beforeSend event for plugins
    await this.emitAsync('beforeSend', message);

    try {
      const result = await this.client.send(message);

      // Emit afterSend event for plugins
      await this.emitAsync('afterSend', result);

      return result;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private validateMessage(message: Message): void {
    if (!message.from) {
      throw new MailerError(
        'From address is required',
        ErrorCodes.INVALID_SENDER,
        undefined,
        undefined,
        'Provide message.from',
      );
    }

    if (!message.to && !message.cc && !message.bcc) {
      throw new MailerError(
        'At least one recipient is required',
        ErrorCodes.INVALID_RECIPIENT,
        undefined,
        undefined,
        'Provide at least one of: to, cc, or bcc',
      );
    }

    if (!message.subject) {
      throw new MailerError(
        'Subject is required',
        ErrorCodes.INVALID_CONFIG,
        undefined,
        undefined,
        'Provide message.subject',
      );
    }

    if (!message.text && !message.html) {
      throw new MailerError(
        'Message body is required',
        ErrorCodes.INVALID_CONFIG,
        undefined,
        undefined,
        'Provide either message.text or message.html',
      );
    }

    // Validate email addresses
    this.validateAddresses('from', [message.from]);

    if (message.to) {
      const toArray = Array.isArray(message.to) ? message.to : [message.to];
      this.validateAddresses('to', toArray);
    }

    if (message.cc) {
      const ccArray = Array.isArray(message.cc) ? message.cc : [message.cc];
      this.validateAddresses('cc', ccArray);
    }

    if (message.bcc) {
      const bccArray = Array.isArray(message.bcc) ? message.bcc : [message.bcc];
      this.validateAddresses('bcc', bccArray);
    }
  }

  private validateAddresses(
    field: string,
    addresses: Array<string | { name?: string; address: string }>,
  ): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const addr of addresses) {
      const email = typeof addr === 'string' ? this.extractEmail(addr) : addr.address;

      if (!emailRegex.test(email)) {
        throw new MailerError(
          `Invalid email address in ${field}: ${email}`,
          ErrorCodes.INVALID_RECIPIENT,
          undefined,
          undefined,
          'Provide valid email addresses',
        );
      }
    }
  }

  private extractEmail(addr: string): string {
    const match = addr.match(/<([^>]+)>/);
    return match ? (match[1] ?? addr) : addr;
  }

  public async verify(): Promise<boolean> {
    if (this.destroyed) {
      return false;
    }

    try {
      return await this.client.verify();
    } catch {
      return false;
    }
  }

  public use(plugin: Plugin): this {
    if (this.plugins.has(plugin.name)) {
      throw new MailerError(
        `Plugin '${plugin.name}' is already installed`,
        ErrorCodes.PLUGIN_ERROR,
        undefined,
        undefined,
        'Use a different plugin name or uninstall the existing plugin first',
      );
    }

    try {
      plugin.install(this);
      this.plugins.set(plugin.name, plugin);
      return this;
    } catch (error) {
      throw new MailerError(
        `Failed to install plugin '${plugin.name}': ${(error as Error).message}`,
        ErrorCodes.PLUGIN_ERROR,
      );
    }
  }

  public unuse(pluginName: string): this {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new MailerError(
        `Plugin '${pluginName}' is not installed`,
        ErrorCodes.PLUGIN_ERROR,
        undefined,
        undefined,
        'Check plugin name or install the plugin first',
      );
    }

    try {
      if (plugin.uninstall) {
        plugin.uninstall();
      }
      this.plugins.delete(pluginName);
      return this;
    } catch (error) {
      throw new MailerError(
        `Failed to uninstall plugin '${pluginName}': ${(error as Error).message}`,
        ErrorCodes.PLUGIN_ERROR,
      );
    }
  }

  public getInstalledPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  public async close(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    try {
      // Uninstall all plugins
      for (const [name, plugin] of this.plugins) {
        try {
          if (plugin.uninstall) {
            plugin.uninstall();
          }
        } catch (error) {
          this.emit(
            'error',
            new MailerError(
              `Error uninstalling plugin '${name}': ${(error as Error).message}`,
              ErrorCodes.PLUGIN_ERROR,
            ),
          );
        }
      }
      this.plugins.clear();

      // Close SMTP client
      await this.client.close();

      this.destroyed = true;
      this.emit('close');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async emitAsync(event: string, ...args: unknown[]): Promise<void> {
    const listeners = this.listeners(event);

    if (listeners.length === 0) {
      return;
    }

    const promises = listeners.map(async (listener) => {
      try {
        const result: unknown = listener.apply(this, args);
        if (result && typeof (result as { then?: unknown }).then === 'function') {
          await (result as Promise<unknown>);
        }
      } catch (error) {
        this.emit(
          'error',
          new MailerError(
            `Error in ${event} event handler: ${(error as Error).message}`,
            ErrorCodes.PLUGIN_ERROR,
          ),
        );
      }
    });

    await Promise.allSettled(promises);
  }

  // Static factory methods for common configurations
  public static createGmailClient(user: string, pass: string): Mailer {
    return new Mailer({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user,
        pass,
      },
    });
  }

  public static createOutlookClient(user: string, pass: string): Mailer {
    return new Mailer({
      host: 'smtp.live.com',
      port: 587,
      secure: false,
      auth: {
        user,
        pass,
      },
    });
  }

  public static createYahooClient(user: string, pass: string): Mailer {
    return new Mailer({
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false,
      auth: {
        user,
        pass,
      },
    });
  }

  // OAuth2 factory methods
  public static createGmailOAuth2Client(user: string, accessToken: string): Mailer {
    return new Mailer({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        type: 'xoauth2',
        user,
        accessToken,
      },
    });
  }

  public static createOutlookOAuth2Client(user: string, accessToken: string): Mailer {
    return new Mailer({
      host: 'smtp.live.com',
      port: 587,
      secure: false,
      auth: {
        type: 'xoauth2',
        user,
        accessToken,
      },
    });
  }
}
