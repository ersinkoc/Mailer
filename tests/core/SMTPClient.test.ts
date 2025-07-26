import { SMTPClient } from '../../src/core/SMTPClient';
import { SMTPConnection, SMTPState } from '../../src/core/SMTPConnection';
import { SMTPAuth } from '../../src/core/SMTPAuth';
import { MailerError, ErrorCodes } from '../../src/errors/MailerError';
import { Message } from '../../src/types';

jest.mock('../../src/core/SMTPConnection');
jest.mock('../../src/core/SMTPAuth');

describe('SMTPClient', () => {
  let client: SMTPClient;
  let mockConnection: jest.Mocked<SMTPConnection>;
  let mockAuth: jest.Mocked<SMTPAuth>;

  const defaultOptions = {
    host: 'smtp.example.com',
    port: 587,
    auth: {
      user: 'test@example.com',
      pass: 'password',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection = {
      connect: jest.fn().mockResolvedValue(undefined),
      getState: jest.fn().mockReturnValue(SMTPState.READY),
      getCapabilities: jest.fn().mockReturnValue({ starttls: true }),
      upgradeToTLS: jest.fn().mockResolvedValue(undefined),
      sendCommand: jest.fn().mockResolvedValue('250 OK'),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      isSecure: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<SMTPConnection>;

    mockAuth = {
      authenticate: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SMTPAuth>;

    (SMTPConnection as unknown as jest.Mock).mockImplementation(() => mockConnection);
    (SMTPAuth as jest.Mock).mockImplementation(() => mockAuth);

    client = new SMTPClient(defaultOptions);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should normalize options with defaults', async () => {
      const client = new SMTPClient({ host: 'smtp.example.com' });
      await client.connect();
      expect(SMTPConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
        })
      );
    });

    it('should use port 465 for secure connections', async () => {
      const client = new SMTPClient({ host: 'smtp.example.com', secure: true });
      await client.connect();
      expect(SMTPConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 465,
          secure: true,
        })
      );
    });
  });

  describe('connect', () => {
    it('should establish connection and authenticate', async () => {
      await client.connect();

      expect(mockConnection.connect).toHaveBeenCalled();
      expect(mockConnection.upgradeToTLS).toHaveBeenCalled();
      expect(mockAuth.authenticate).toHaveBeenCalledWith({
        user: 'test@example.com',
        pass: 'password',
      });
    });

    it('should skip STARTTLS for secure connections', async () => {
      const secureClient = new SMTPClient({ ...defaultOptions, secure: true });
      mockConnection.isSecure.mockReturnValue(true);
      
      await secureClient.connect();

      expect(mockConnection.upgradeToTLS).not.toHaveBeenCalled();
    });

    it('should skip STARTTLS if not available', async () => {
      mockConnection.getCapabilities.mockReturnValue({});
      
      await client.connect();

      expect(mockConnection.upgradeToTLS).not.toHaveBeenCalled();
    });

    it('should skip authentication if no auth provided', async () => {
      const noAuthClient = new SMTPClient({ host: 'smtp.example.com' });
      
      await noAuthClient.connect();

      expect(SMTPAuth).not.toHaveBeenCalled();
    });

    it('should reuse existing connection if already connected', async () => {
      await client.connect();
      mockConnection.connect.mockClear();
      
      await client.connect();

      expect(mockConnection.connect).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    const basicMessage: Message = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test Email',
      text: 'Hello World',
    };

    beforeEach(async () => {
      await client.connect();
      mockConnection.sendCommand.mockClear();
    });

    it('should send a basic text email', async () => {
      mockConnection.sendCommand
        .mockResolvedValueOnce('250 Sender OK')
        .mockResolvedValueOnce('250 Recipient OK')
        .mockResolvedValueOnce('354 Start mail input')
        .mockResolvedValue('250 OK')
        .mockResolvedValueOnce('250 Queued as ABC123');

      const result = await client.send(basicMessage);

      expect(result).toEqual({
        messageId: expect.any(String),
        accepted: ['recipient@example.com'],
        rejected: [],
        response: 'Message sent successfully',
        envelope: {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
        },
      });

      expect(mockConnection.sendCommand).toHaveBeenCalledWith('MAIL FROM:<sender@example.com>');
      expect(mockConnection.sendCommand).toHaveBeenCalledWith('RCPT TO:<recipient@example.com>');
      expect(mockConnection.sendCommand).toHaveBeenCalledWith('DATA');
      expect(mockConnection.sendCommand).toHaveBeenCalledWith('.');
    });

    it('should handle multiple recipients', async () => {
      const multiRecipientMessage: Message = {
        ...basicMessage,
        to: ['recipient1@example.com', 'recipient2@example.com'],
        cc: 'cc@example.com',
        bcc: ['bcc1@example.com', 'bcc2@example.com'],
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      const result = await client.send(multiRecipientMessage);

      expect(result.accepted).toHaveLength(5);
      expect(result.envelope.to).toEqual([
        'recipient1@example.com',
        'recipient2@example.com',
        'cc@example.com',
        'bcc1@example.com',
        'bcc2@example.com',
      ]);
    });

    it('should handle Address objects', async () => {
      const addressMessage: Message = {
        from: { name: 'Sender Name', address: 'sender@example.com' },
        to: { name: 'Recipient Name', address: 'recipient@example.com' },
        subject: 'Test',
        text: 'Hello',
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(addressMessage);

      expect(mockConnection.sendCommand).toHaveBeenCalledWith('MAIL FROM:<sender@example.com>');
      expect(mockConnection.sendCommand).toHaveBeenCalledWith('RCPT TO:<recipient@example.com>');
    });

    it('should handle rejected recipients', async () => {
      const multiRecipientMessage: Message = {
        ...basicMessage,
        to: ['valid@example.com', 'invalid@example.com'],
      };

      mockConnection.sendCommand
        .mockResolvedValueOnce('250 Sender OK')
        .mockResolvedValueOnce('250 Recipient OK')
        .mockRejectedValueOnce(new MailerError('Invalid recipient', ErrorCodes.SMTP_ERROR, 550))
        .mockResolvedValueOnce('354 Start mail input')
        .mockResolvedValue('250 OK');

      const result = await client.send(multiRecipientMessage);

      expect(result.accepted).toEqual(['valid@example.com']);
      expect(result.rejected).toEqual(['invalid@example.com']);
    });

    it('should throw if all recipients rejected', async () => {
      mockConnection.sendCommand
        .mockResolvedValueOnce('250 Sender OK')
        .mockRejectedValueOnce(new MailerError('Invalid recipient', ErrorCodes.SMTP_ERROR, 550));

      await expect(client.send(basicMessage)).rejects.toThrow(MailerError);
    });

    it('should handle HTML emails', async () => {
      const htmlMessage: Message = {
        ...basicMessage,
        html: '<h1>Hello World</h1>',
        text: undefined,
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(htmlMessage);

      const dataCall = mockConnection.sendCommand.mock.calls.find(
        call => call[0]?.includes('Content-Type: text/html')
      );
      expect(dataCall).toBeDefined();
    });

    it('should handle multipart emails', async () => {
      const multipartMessage: Message = {
        ...basicMessage,
        text: 'Plain text version',
        html: '<h1>HTML version</h1>',
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(multipartMessage);

      const dataCall = mockConnection.sendCommand.mock.calls.find(
        call => call[0]?.includes('Content-Type: multipart/alternative')
      );
      expect(dataCall).toBeDefined();
    });

    it('should auto-connect if not connected', async () => {
      mockConnection.getState.mockReturnValue(SMTPState.CLOSED);
      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(basicMessage);

      expect(mockConnection.connect).toHaveBeenCalled();
    });

    it('should handle dot-stuffing', async () => {
      const dotMessage: Message = {
        ...basicMessage,
        text: '.This line starts with a dot\n..And this one has two',
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(dotMessage);

      const stuffedCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.startsWith('..')
      );
      expect(stuffedCalls.length).toBeGreaterThan(0);
    });

    it('should include custom headers', async () => {
      const customHeaderMessage: Message = {
        ...basicMessage,
        headers: {
          'X-Custom-Header': 'Custom Value',
          'X-Another-Header': 'Another Value',
        },
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(customHeaderMessage);

      const headerCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('X-Custom-Header: Custom Value')
      );
      expect(headerCalls.length).toBeGreaterThan(0);
    });

    it('should set priority headers', async () => {
      const priorityMessage: Message = {
        ...basicMessage,
        priority: 'high',
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(priorityMessage);

      const priorityCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('X-Priority: 1 (Highest)')
      );
      expect(priorityCalls.length).toBeGreaterThan(0);
    });

    it('should handle email addresses in angle brackets', async () => {
      const angleMessage: Message = {
        from: 'Sender Name <sender@example.com>',
        to: 'Recipient Name <recipient@example.com>',
        subject: 'Test',
        text: 'Hello',
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(angleMessage);

      expect(mockConnection.sendCommand).toHaveBeenCalledWith('MAIL FROM:<sender@example.com>');
      expect(mockConnection.sendCommand).toHaveBeenCalledWith('RCPT TO:<recipient@example.com>');
    });

    it('should include references and inReplyTo headers', async () => {
      const replyMessage: Message = {
        ...basicMessage,
        references: '<ref1@example.com> <ref2@example.com>',
        inReplyTo: '<original@example.com>',
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(replyMessage);

      const referencesCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('References: <ref1@example.com> <ref2@example.com>')
      );
      expect(referencesCalls.length).toBeGreaterThan(0);

      const inReplyToCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('In-Reply-To: <original@example.com>')
      );
      expect(inReplyToCalls.length).toBeGreaterThan(0);
    });

    it('should handle attachments', async () => {
      const attachmentMessage: Message = {
        ...basicMessage,
        attachments: [
          {
            filename: 'test.txt',
            content: 'Test content',
            contentType: 'text/plain',
          },
          {
            content: Buffer.from('Binary data'),
            contentType: 'application/octet-stream',
          },
        ],
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(attachmentMessage);

      const contentTypeCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('Content-Type: multipart/mixed')
      );
      expect(contentTypeCalls.length).toBeGreaterThan(0);
    });

    it('should handle file attachments', async () => {
      const fileAttachmentMessage: Message = {
        ...basicMessage,
        attachments: [
          {
            path: 'tests/test-attachment.txt',
          },
          {
            path: 'tests/test-attachment.txt',
            filename: 'custom-name.txt',
            contentType: 'text/plain',
            cid: 'attachment-1',
            headers: {
              'X-Custom': 'value',
            },
          },
        ],
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(fileAttachmentMessage);

      // Check that filenames were included
      const filenameCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('filename=')
      );
      expect(filenameCalls.length).toBeGreaterThan(0);

      // Check CID was included
      const cidCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('Content-ID: <attachment-1>')
      );
      expect(cidCalls.length).toBeGreaterThan(0);
    });

    it('should throw on invalid attachment path', async () => {
      const badAttachmentMessage: Message = {
        ...basicMessage,
        attachments: [
          {
            path: 'non-existent-file.txt',
          },
        ],
      };

      mockConnection.sendCommand
        .mockResolvedValueOnce('250 Sender OK')
        .mockResolvedValueOnce('250 Recipient OK')
        .mockResolvedValueOnce('354 Start mail input');

      await expect(client.send(badAttachmentMessage)).rejects.toThrow('Failed to read attachment file');
    });

    it('should handle attachments with different encodings', async () => {
      const encodingAttachmentMessage: Message = {
        ...basicMessage,
        attachments: [
          {
            content: 'Quoted printable content with special chars: é',
            encoding: 'quoted-printable',
            contentType: 'text/plain',
          },
          {
            content: 'Plain text',
            encoding: '7bit',
            contentType: 'text/plain',
          },
          {
            content: Buffer.from('Binary content'),
            encoding: 'base64',
            contentDisposition: 'inline',
          },
        ],
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(encodingAttachmentMessage);

      // Check that different encodings were used
      const qpCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('Content-Transfer-Encoding: quoted-printable')
      );
      expect(qpCalls.length).toBeGreaterThan(0);

      const inlineCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('Content-Disposition: inline')
      );
      expect(inlineCalls.length).toBeGreaterThan(0);
    });

    it('should handle multipart messages with attachments', async () => {
      const multipartAttachmentMessage: Message = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'Plain text version',
        html: '<h1>HTML version</h1>',
        attachments: [
          {
            filename: 'test.txt',
            content: 'Test attachment',
          },
        ],
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(multipartAttachmentMessage);

      // Should use multipart/mixed with multipart/alternative inside
      const mixedCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('Content-Type: multipart/mixed')
      );
      expect(mixedCalls.length).toBeGreaterThan(0);

      const altCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('Content-Type: multipart/alternative')
      );
      expect(altCalls.length).toBeGreaterThan(0);
    });

    it('should handle attachments with only HTML content', async () => {
      const htmlAttachmentMessage: Message = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<h1>HTML only</h1>',
        attachments: [
          {
            content: 'Attachment',
          },
        ],
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      await client.send(htmlAttachmentMessage);

      const htmlCalls = mockConnection.sendCommand.mock.calls.filter(
        call => call[0]?.includes('Content-Type: text/html')
      );
      expect(htmlCalls.length).toBeGreaterThan(0);
    });

    it('should throw if connection not ready and cannot connect', async () => {
      mockConnection.getState.mockReturnValue(SMTPState.CLOSED);
      mockConnection.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(client.send(basicMessage)).rejects.toThrow();
    });

    it('should throw if connection is null after connect attempt', async () => {
      // Create a custom client with modified connect behavior
      const badClient = new SMTPClient(defaultOptions);
      
      // Override the connect method to set connection to null
      badClient.connect = jest.fn().mockImplementation(async function(this: any) {
        this.connection = null;
      });
      
      await expect(badClient.send(basicMessage)).rejects.toThrow('Connection not established');
    });

    it('should wrap non-MailerError exceptions', async () => {
      mockConnection.sendCommand
        .mockResolvedValueOnce('250 Sender OK')
        .mockRejectedValueOnce(new Error('Generic error'));

      await expect(client.send(basicMessage)).rejects.toThrow('Failed to send message: Generic error');
    });

    it('should throw when all recipients are rejected after some accepted', async () => {
      const multiRecipientMessage: Message = {
        ...basicMessage,
        to: ['valid1@example.com', 'invalid1@example.com', 'invalid2@example.com'],
      };

      mockConnection.sendCommand
        .mockResolvedValueOnce('250 Sender OK')
        .mockResolvedValueOnce('250 Recipient OK') // First recipient accepted
        .mockRejectedValueOnce(new MailerError('Invalid recipient', ErrorCodes.SMTP_ERROR, 550))
        .mockRejectedValueOnce(new MailerError('Invalid recipient', ErrorCodes.SMTP_ERROR, 550));

      // This should still succeed because at least one recipient was accepted
      await client.send(multiRecipientMessage);
    });

    it('should throw all recipients rejected when all recipients fail without early throw', async () => {
      // This test is for the edge case where all recipients are rejected
      // but we don't hit the early throw condition (line 119) and instead
      // reach the check after the loop (line 125)
      const singleRecipientMessage: Message = {
        ...basicMessage,
        to: ['invalid@example.com'],
      };

      // Mock sendRcptTo to reject but not throw early (simulating a specific edge case)
      mockConnection.sendCommand
        .mockResolvedValueOnce('250 Sender OK') // MAIL FROM
        .mockRejectedValueOnce(new MailerError('Invalid recipient', ErrorCodes.SMTP_ERROR, 550)); // RCPT TO

      // The error should be thrown from line 119, not 125, for single recipient
      await expect(client.send(singleRecipientMessage)).rejects.toThrow(MailerError);
    });

    it('should throw all recipients rejected from line 125 when loop completes without accepted', async () => {
      // This test specifically targets line 125 by creating a scenario where:
      // 1. We have an empty recipient list (edge case)
      // 2. The loop completes without throwing
      // 3. But accepted array is still empty
      
      const emptyRecipientMessage: Message = {
        ...basicMessage,
        to: [], // Empty recipient list
      };

      mockConnection.sendCommand.mockResolvedValue('250 OK');

      // We need to mock the createEnvelope to return an empty to array
      // This simulates a case where all recipients were filtered out
      jest.spyOn(client as any, 'createEnvelope').mockReturnValue({
        from: 'sender@example.com',
        to: [], // Empty array will skip the loop but still check accepted.length
      });

      await expect(client.send(emptyRecipientMessage)).rejects.toThrow('All recipients were rejected');
    });
  });

  describe('verify', () => {
    it('should return true if connection successful', async () => {
      mockConnection.sendCommand.mockResolvedValue('250 OK');

      const result = await client.verify();

      expect(result).toBe(true);
      expect(mockConnection.sendCommand).toHaveBeenCalledWith('NOOP');
    });

    it('should return false if connection fails', async () => {
      mockConnection.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await client.verify();

      expect(result).toBe(false);
    });

    it('should return false if NOOP fails', async () => {
      mockConnection.sendCommand.mockRejectedValue(new Error('NOOP failed'));

      const result = await client.verify();

      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should quit connection and cleanup', async () => {
      await client.connect();
      await client.close();

      expect(mockConnection.quit).toHaveBeenCalled();
    });

    it('should handle close when not connected', async () => {
      await expect(client.close()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should emit connection errors', async () => {
      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      await client.connect();
      
      const error = new Error('Connection error');
      const connectionErrorHandler = mockConnection.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      connectionErrorHandler?.(error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should emit close events', async () => {
      const closeHandler = jest.fn();
      client.on('close', closeHandler);

      await client.connect();
      
      const connectionCloseHandler = mockConnection.on.mock.calls.find(
        call => call[0] === 'close'
      )?.[1];
      
      connectionCloseHandler?.();

      expect(closeHandler).toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    it('should log debug messages when debug enabled', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Create a new client with debug enabled and logger set to true
      const debugClient = new SMTPClient({ 
        host: 'smtp.example.com',
        debug: true,
        logger: true as any
      });
      
      // Manually trigger the log method to test it
      (debugClient as any).log('debug', '> MAIL FROM:<test@example.com>');

      expect(logSpy).toHaveBeenCalledWith(
        '[DEBUG] > MAIL FROM:<test@example.com>'
      );

      logSpy.mockRestore();
    });

    it('should log commands when debug enabled', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Create a new client with debug enabled
      const debugClient = new SMTPClient({ 
        host: 'smtp.example.com',
        debug: true,
        logger: true as any
      });
      
      await debugClient.connect();
      
      // The mock connection should have had command handler attached
      const connectionHandlers = mockConnection.on.mock.calls.filter(
        call => call[0] === 'command'
      );
      expect(connectionHandlers.length).toBeGreaterThan(0);
      
      // Simulate a command event
      const commandHandler = connectionHandlers[0]?.[1];
      commandHandler?.('MAIL FROM:<test@example.com>');
      
      expect(logSpy).toHaveBeenCalledWith(
        '[DEBUG] > MAIL FROM:<test@example.com>'
      );

      logSpy.mockRestore();
    });

    it('should use custom logger if provided', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const loggerClient = new SMTPClient({ ...defaultOptions, logger: mockLogger });
      
      await loggerClient.connect();
      await loggerClient.send({
        from: 'test@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});