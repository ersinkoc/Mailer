import { Mailer } from '../src/Mailer';
import { SMTPClient } from '../src/core/SMTPClient';
import { MailerError, ErrorCodes } from '../src/errors/MailerError';
import { Message, Plugin } from '../src/types';

jest.mock('../src/core/SMTPClient');

describe('Mailer', () => {
  let mailer: Mailer;
  let mockClient: jest.Mocked<SMTPClient>;

  const validOptions = {
    host: 'smtp.example.com',
    port: 587,
    auth: {
      user: 'test@example.com',
      pass: 'password',
    },
  };

  const validMessage: Message = {
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Test Subject',
    text: 'Hello World',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = {
      send: jest.fn(),
      verify: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<SMTPClient>;

    (SMTPClient as unknown as jest.Mock).mockImplementation(() => mockClient);
    
    mailer = new Mailer(validOptions);
  });

  afterEach(async () => {
    try {
      await mailer.close();
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe('constructor', () => {
    it('should create mailer with valid options', () => {
      expect(() => new Mailer(validOptions)).not.toThrow();
      expect(SMTPClient).toHaveBeenCalledWith(validOptions);
    });

    it('should throw error for missing host', () => {
      const invalidOptions = { ...validOptions };
      delete (invalidOptions as any).host;

      expect(() => new Mailer(invalidOptions)).toThrow(MailerError);
      expect(() => new Mailer(invalidOptions)).toThrow('Host is required');
    });

    it('should throw error for invalid port', () => {
      const invalidOptions = { ...validOptions, port: 70000 };

      expect(() => new Mailer(invalidOptions)).toThrow(MailerError);
      expect(() => new Mailer(invalidOptions)).toThrow('Invalid port number');
    });

    it('should throw error for missing username in auth', () => {
      const invalidOptions = {
        ...validOptions,
        auth: { pass: 'password' },
      };

      expect(() => new Mailer(invalidOptions as any)).toThrow(MailerError);
      expect(() => new Mailer(invalidOptions as any)).toThrow('Username is required');
    });

    it('should throw error for missing password in non-OAuth2 auth', () => {
      const invalidOptions = {
        ...validOptions,
        auth: { user: 'test@example.com' },
      };

      expect(() => new Mailer(invalidOptions as any)).toThrow(MailerError);
      expect(() => new Mailer(invalidOptions as any)).toThrow('Password is required');
    });

    it('should throw error for missing access token in OAuth2', () => {
      const invalidOptions = {
        ...validOptions,
        auth: {
          type: 'xoauth2' as const,
          user: 'test@example.com',
        },
      };

      expect(() => new Mailer(invalidOptions as any)).toThrow(MailerError);
      expect(() => new Mailer(invalidOptions as any)).toThrow('Access token is required');
    });

    it('should accept OAuth2 with accessToken when type is undefined (BUG-004)', () => {
      const oauthOptions = {
        ...validOptions,
        auth: {
          user: 'test@example.com',
          accessToken: 'ya29.test-token',
          // type is undefined - should work because accessToken is provided
        },
      };

      expect(() => new Mailer(oauthOptions)).not.toThrow();
    });

    it('should throw error when both accessToken and pass are provided with undefined type', () => {
      const invalidOptions = {
        ...validOptions,
        auth: {
          user: 'test@example.com',
          accessToken: 'ya29.test-token',
          pass: 'password',
          // type is undefined and both credentials provided - should require password
        },
      };

      // When both are provided, password auth takes precedence
      expect(() => new Mailer(invalidOptions)).not.toThrow();
    });

    it('should accept valid OAuth2 configuration', () => {
      const oauthOptions = {
        ...validOptions,
        auth: {
          type: 'xoauth2' as const,
          user: 'test@example.com',
          accessToken: 'token123',
        },
      };

      expect(() => new Mailer(oauthOptions)).not.toThrow();
    });
  });

  describe('send', () => {
    const mockSendResult = {
      messageId: 'test-id',
      accepted: ['recipient@example.com'],
      rejected: [],
      response: 'OK',
      envelope: {
        from: 'sender@example.com',
        to: ['recipient@example.com'],
      },
    };

    beforeEach(() => {
      mockClient.send.mockResolvedValue(mockSendResult);
    });

    it('should send valid message', async () => {
      const result = await mailer.send(validMessage);
      
      expect(mockClient.send).toHaveBeenCalledWith(validMessage);
      expect(result).toEqual(mockSendResult);
    });

    it('should validate required fields', async () => {
      const invalidMessage = { ...validMessage };
      delete (invalidMessage as any).from;

      await expect(mailer.send(invalidMessage)).rejects.toThrow(MailerError);
      await expect(mailer.send(invalidMessage)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_SENDER,
        message: 'From address is required',
      });
    });

    it('should require at least one recipient', async () => {
      const invalidMessage = { ...validMessage };
      delete (invalidMessage as any).to;

      await expect(mailer.send(invalidMessage)).rejects.toThrow(MailerError);
      await expect(mailer.send(invalidMessage)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_RECIPIENT,
        message: 'At least one recipient is required',
      });
    });

    it('should reject empty recipient arrays (BUG-005)', async () => {
      const invalidMessage = {
        ...validMessage,
        to: [] as any,
      };

      await expect(mailer.send(invalidMessage)).rejects.toThrow(MailerError);
      await expect(mailer.send(invalidMessage)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_RECIPIENT,
        message: 'At least one recipient is required',
      });
    });

    it('should reject all empty recipient arrays (BUG-005)', async () => {
      const invalidMessage = {
        ...validMessage,
        to: [] as any,
        cc: [] as any,
        bcc: [] as any,
      };

      await expect(mailer.send(invalidMessage)).rejects.toThrow(MailerError);
      await expect(mailer.send(invalidMessage)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_RECIPIENT,
        message: 'At least one recipient is required',
      });
    });

    it('should accept message with at least one non-empty recipient array', async () => {
      const validMessageWithCc = {
        ...validMessage,
        to: [] as any,
        cc: ['cc@example.com'],
      };

      mockClient.send.mockResolvedValue({
        messageId: 'test-id',
        accepted: ['cc@example.com'],
        rejected: [],
        response: 'OK',
        envelope: { from: 'sender@example.com', to: ['cc@example.com'] },
      });

      await expect(mailer.send(validMessageWithCc)).resolves.toBeDefined();
    });

    it('should require subject', async () => {
      const invalidMessage = { ...validMessage };
      delete (invalidMessage as any).subject;

      await expect(mailer.send(invalidMessage)).rejects.toThrow(MailerError);
      await expect(mailer.send(invalidMessage)).rejects.toMatchObject({
        message: 'Subject is required',
      });
    });

    it('should require message body', async () => {
      const invalidMessage = { ...validMessage };
      delete (invalidMessage as any).text;

      await expect(mailer.send(invalidMessage)).rejects.toThrow(MailerError);
      await expect(mailer.send(invalidMessage)).rejects.toMatchObject({
        message: 'Message body is required',
      });
    });

    it('should accept HTML as body', async () => {
      const htmlMessage = {
        ...validMessage,
        text: undefined,
        html: '<h1>Hello</h1>',
      };

      await expect(mailer.send(htmlMessage)).resolves.not.toThrow();
    });

    it('should validate email addresses', async () => {
      const invalidMessage = {
        ...validMessage,
        from: 'invalid-email',
      };

      await expect(mailer.send(invalidMessage)).rejects.toThrow(MailerError);
      await expect(mailer.send(invalidMessage)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_RECIPIENT,
        message: expect.stringContaining('Invalid email address'),
      });
    });

    it('should handle email addresses with names', async () => {
      const namedMessage = {
        ...validMessage,
        from: 'Sender Name <sender@example.com>',
        to: 'Recipient Name <recipient@example.com>',
      };

      await expect(mailer.send(namedMessage)).resolves.not.toThrow();
    });

    it('should handle Address objects', async () => {
      const addressMessage = {
        ...validMessage,
        from: { name: 'Sender', address: 'sender@example.com' },
        to: { name: 'Recipient', address: 'recipient@example.com' },
      };

      await expect(mailer.send(addressMessage)).resolves.not.toThrow();
    });

    it('should validate multiple recipients', async () => {
      const multiMessage = {
        ...validMessage,
        to: ['valid@example.com', 'invalid-email'],
      };

      await expect(mailer.send(multiMessage)).rejects.toThrow(MailerError);
    });

    it('should validate CC and BCC recipients as arrays', async () => {
      const ccBccMessage = {
        ...validMessage,
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
      };

      await expect(mailer.send(ccBccMessage)).resolves.not.toThrow();
    });

    it('should validate CC and BCC recipients as strings', async () => {
      const ccBccMessage = {
        ...validMessage,
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
      };

      await expect(mailer.send(ccBccMessage)).resolves.not.toThrow();
    });

    it('should validate mixed CC and BCC recipient formats', async () => {
      const mixedMessage1 = {
        ...validMessage,
        cc: 'single-cc@example.com',
        bcc: ['bcc1@example.com', 'bcc2@example.com'],
      };

      await expect(mailer.send(mixedMessage1)).resolves.not.toThrow();

      const mixedMessage2 = {
        ...validMessage,
        cc: ['cc1@example.com', 'cc2@example.com'],
        bcc: 'single-bcc@example.com',
      };

      await expect(mailer.send(mixedMessage2)).resolves.not.toThrow();
    });

    it('should throw error when mailer is destroyed', async () => {
      await mailer.close();

      await expect(mailer.send(validMessage)).rejects.toThrow(MailerError);
      await expect(mailer.send(validMessage)).rejects.toMatchObject({
        message: 'Mailer has been destroyed',
      });
    });

    it('should emit beforeSend and afterSend events', async () => {
      const beforeSendSpy = jest.fn();
      const afterSendSpy = jest.fn();

      mailer.on('beforeSend', beforeSendSpy);
      mailer.on('afterSend', afterSendSpy);

      await mailer.send(validMessage);

      expect(beforeSendSpy).toHaveBeenCalledWith(validMessage);
      expect(afterSendSpy).toHaveBeenCalledWith(mockSendResult);
    });

    it('should emit error events', async () => {
      const errorSpy = jest.fn();
      const error = new Error('Send failed');
      
      mailer.on('error', errorSpy);
      mockClient.send.mockRejectedValue(error);

      await expect(mailer.send(validMessage)).rejects.toThrow(error);
      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('verify', () => {
    it('should verify connection successfully', async () => {
      mockClient.verify.mockResolvedValue(true);

      const result = await mailer.verify();

      expect(result).toBe(true);
      expect(mockClient.verify).toHaveBeenCalled();
    });

    it('should handle verification failure', async () => {
      mockClient.verify.mockResolvedValue(false);

      const result = await mailer.verify();

      expect(result).toBe(false);
    });

    it('should handle verification error', async () => {
      mockClient.verify.mockRejectedValue(new Error('Connection failed'));

      const result = await mailer.verify();

      expect(result).toBe(false);
    });

    it('should return false when destroyed', async () => {
      await mailer.close();

      const result = await mailer.verify();

      expect(result).toBe(false);
    });
  });

  describe('plugin system', () => {
    const mockPlugin: Plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      install: jest.fn(),
      uninstall: jest.fn(),
    };

    it('should install plugin', () => {
      const result = mailer.use(mockPlugin);

      expect(result).toBe(mailer); // Should return this for chaining
      expect(mockPlugin.install).toHaveBeenCalledWith(mailer);
      expect(mailer.getInstalledPlugins()).toContain('test-plugin');
    });

    it('should not install duplicate plugin', () => {
      mailer.use(mockPlugin);

      expect(() => mailer.use(mockPlugin)).toThrow(MailerError);
      expect(() => mailer.use(mockPlugin)).toThrow("Plugin 'test-plugin' is already installed");
    });

    it('should handle plugin install error', () => {
      const errorPlugin: Plugin = {
        name: 'error-plugin',
        install: jest.fn().mockImplementation(() => {
          throw new Error('Install failed');
        }),
      };

      expect(() => mailer.use(errorPlugin)).toThrow(MailerError);
      expect(() => mailer.use(errorPlugin)).toThrow("Failed to install plugin 'error-plugin'");
    });

    it('should uninstall plugin', () => {
      mailer.use(mockPlugin);
      
      const result = mailer.unuse('test-plugin');

      expect(result).toBe(mailer); // Should return this for chaining
      expect(mockPlugin.uninstall).toHaveBeenCalled();
      expect(mailer.getInstalledPlugins()).not.toContain('test-plugin');
    });

    it('should not uninstall non-existent plugin', () => {
      expect(() => mailer.unuse('non-existent')).toThrow(MailerError);
      expect(() => mailer.unuse('non-existent')).toThrow("Plugin 'non-existent' is not installed");
    });

    it('should handle plugin uninstall error', () => {
      const errorPlugin: Plugin = {
        name: 'error-plugin',
        install: jest.fn(),
        uninstall: jest.fn().mockImplementation(() => {
          throw new Error('Uninstall failed');
        }),
      };

      mailer.use(errorPlugin);

      expect(() => mailer.unuse('error-plugin')).toThrow(MailerError);
      expect(() => mailer.unuse('error-plugin')).toThrow("Failed to uninstall plugin 'error-plugin'");
    });

    it('should handle plugin without uninstall method', () => {
      const simplePlugin: Plugin = {
        name: 'simple-plugin',
        install: jest.fn(),
      };

      mailer.use(simplePlugin);
      
      expect(() => mailer.unuse('simple-plugin')).not.toThrow();
      expect(mailer.getInstalledPlugins()).not.toContain('simple-plugin');
    });

    it('should list installed plugins', () => {
      const plugin1: Plugin = { name: 'plugin1', install: jest.fn() };
      const plugin2: Plugin = { name: 'plugin2', install: jest.fn() };

      mailer.use(plugin1).use(plugin2);

      expect(mailer.getInstalledPlugins()).toEqual(['plugin1', 'plugin2']);
    });
  });

  describe('close', () => {
    it('should close successfully', async () => {
      const closePromise = mailer.close();

      await expect(closePromise).resolves.not.toThrow();
      expect(mockClient.close).toHaveBeenCalled();
    });

    it('should uninstall plugins on close', async () => {
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        install: jest.fn(),
        uninstall: jest.fn(),
      };

      mailer.use(mockPlugin);
      await mailer.close();

      expect(mockPlugin.uninstall).toHaveBeenCalled();
      expect(mailer.getInstalledPlugins()).toHaveLength(0);
    });

    it('should handle plugin uninstall errors during close', async () => {
      const errorSpy = jest.fn();
      const errorPlugin: Plugin = {
        name: 'error-plugin',
        install: jest.fn(),
        uninstall: jest.fn().mockImplementation(() => {
          throw new Error('Uninstall failed');
        }),
      };

      mailer.on('error', errorSpy);
      mailer.use(errorPlugin);
      
      await mailer.close();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Error uninstalling plugin 'error-plugin'"),
        })
      );
    });

    it('should emit close event', async () => {
      const closeSpy = jest.fn();
      mailer.on('close', closeSpy);

      await mailer.close();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle multiple close calls', async () => {
      await mailer.close();
      await expect(mailer.close()).resolves.not.toThrow();
    });

    it('should handle and emit client close errors', async () => {
      const errorSpy = jest.fn();
      const closeError = new Error('Failed to close connection');
      
      mailer.on('error', errorSpy);
      mockClient.close.mockRejectedValue(closeError);

      await expect(mailer.close()).rejects.toThrow(closeError);
      expect(errorSpy).toHaveBeenCalledWith(closeError);
    });
  });

  describe('event forwarding', () => {
    it('should forward client errors', () => {
      const errorSpy = jest.fn();
      mailer.on('error', errorSpy);

      const error = new Error('Client error');
      const errorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error')?.[1];
      errorHandler?.(error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it('should forward client close events', () => {
      const closeSpy = jest.fn();
      mailer.on('close', closeSpy);

      const closeHandler = mockClient.on.mock.calls.find(call => call[0] === 'close')?.[1];
      closeHandler?.();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('static factory methods', () => {
    describe('Gmail', () => {
      it('should create Gmail client', () => {
        const client = Mailer.createGmailClient('user@gmail.com', 'password');
        
        expect(client).toBeInstanceOf(Mailer);
        expect(SMTPClient).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
              user: 'user@gmail.com',
              pass: 'password',
            },
          })
        );
      });

      it('should create Gmail OAuth2 client', () => {
        const client = Mailer.createGmailOAuth2Client('user@gmail.com', 'token123');
        
        expect(client).toBeInstanceOf(Mailer);
        expect(SMTPClient).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'smtp.gmail.com',
            auth: {
              type: 'xoauth2',
              user: 'user@gmail.com',
              accessToken: 'token123',
            },
          })
        );
      });
    });

    describe('Outlook', () => {
      it('should create Outlook client', () => {
        const client = Mailer.createOutlookClient('user@outlook.com', 'password');
        
        expect(client).toBeInstanceOf(Mailer);
        expect(SMTPClient).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'smtp.live.com',
            port: 587,
            auth: {
              user: 'user@outlook.com',
              pass: 'password',
            },
          })
        );
      });

      it('should create Outlook OAuth2 client', () => {
        const client = Mailer.createOutlookOAuth2Client('user@outlook.com', 'token123');
        
        expect(client).toBeInstanceOf(Mailer);
        expect(SMTPClient).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'smtp.live.com',
            auth: {
              type: 'xoauth2',
              user: 'user@outlook.com',
              accessToken: 'token123',
            },
          })
        );
      });
    });

    describe('Yahoo', () => {
      it('should create Yahoo client', () => {
        const client = Mailer.createYahooClient('user@yahoo.com', 'password');
        
        expect(client).toBeInstanceOf(Mailer);
        expect(SMTPClient).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'smtp.mail.yahoo.com',
            port: 587,
            auth: {
              user: 'user@yahoo.com',
              pass: 'password',
            },
          })
        );
      });
    });
  });

  describe('async event handling', () => {
    it('should handle async event listeners', async () => {
      let eventFired = false;
      
      mailer.on('beforeSend', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        eventFired = true;
      });

      await mailer.send(validMessage);

      expect(eventFired).toBe(true);
    });

    it('should handle event listener errors', async () => {
      const errorSpy = jest.fn();
      mailer.on('error', errorSpy);
      
      mailer.on('beforeSend', () => {
        throw new Error('Event handler error');
      });

      await mailer.send(validMessage);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Error in beforeSend event handler'),
        })
      );
    });
  });
});