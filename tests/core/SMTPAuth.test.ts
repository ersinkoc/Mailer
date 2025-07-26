import { SMTPAuth } from '../../src/core/SMTPAuth';
import { SMTPConnection } from '../../src/core/SMTPConnection';
import { MailerError, ErrorCodes } from '../../src/errors/MailerError';
import { createHmac } from 'crypto';

jest.mock('../../src/core/SMTPConnection');

describe('SMTPAuth', () => {
  let auth: SMTPAuth;
  let mockConnection: jest.Mocked<SMTPConnection>;

  beforeEach(() => {
    mockConnection = {
      getCapabilities: jest.fn(),
      sendCommand: jest.fn(),
    } as unknown as jest.Mocked<SMTPConnection>;
    
    auth = new SMTPAuth(mockConnection);
  });

  describe('authenticate', () => {
    it('should throw error if server does not support authentication', async () => {
      mockConnection.getCapabilities.mockReturnValue({});

      await expect(auth.authenticate({ user: 'test', pass: 'password' })).rejects.toThrow(
        MailerError
      );
      await expect(auth.authenticate({ user: 'test', pass: 'password' })).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'Server does not support authentication',
      });
    });

    it('should select PLAIN auth when specified', async () => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['PLAIN', 'LOGIN'],
      });
      mockConnection.sendCommand.mockResolvedValue('235 Authentication successful');

      await auth.authenticate({ type: 'plain', user: 'test', pass: 'password' });

      const authString = `\x00test\x00password`;
      const expectedBase64 = Buffer.from(authString, 'utf-8').toString('base64');
      expect(mockConnection.sendCommand).toHaveBeenCalledWith(`AUTH PLAIN ${expectedBase64}`);
    });

    it('should select LOGIN auth when specified', async () => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['PLAIN', 'LOGIN'],
      });
      mockConnection.sendCommand
        .mockResolvedValueOnce('334 VXNlcm5hbWU6') // Username:
        .mockResolvedValueOnce('334 UGFzc3dvcmQ6') // Password:
        .mockResolvedValueOnce('235 Authentication successful');

      await auth.authenticate({ type: 'login', user: 'test', pass: 'password' });

      expect(mockConnection.sendCommand).toHaveBeenCalledWith('AUTH LOGIN');
      expect(mockConnection.sendCommand).toHaveBeenCalledWith(
        Buffer.from('test', 'utf-8').toString('base64')
      );
      expect(mockConnection.sendCommand).toHaveBeenCalledWith(
        Buffer.from('password', 'utf-8').toString('base64')
      );
    });

    it('should auto-select best available method', async () => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['PLAIN', 'LOGIN', 'CRAM-MD5'],
      });
      
      const challenge = '<12345.67890@example.com>';
      const challengeBase64 = Buffer.from(challenge, 'utf-8').toString('base64');
      
      mockConnection.sendCommand
        .mockResolvedValueOnce(`334 ${challengeBase64}`)
        .mockResolvedValueOnce('235 Authentication successful');

      await auth.authenticate({ user: 'test', pass: 'password' });

      expect(mockConnection.sendCommand).toHaveBeenCalledWith('AUTH CRAM-MD5');
    });

    it('should throw error if requested auth type not supported', async () => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['PLAIN'],
      });

      await expect(
        auth.authenticate({ type: 'login', user: 'test', pass: 'password' })
      ).rejects.toThrow(MailerError);
      await expect(
        auth.authenticate({ type: 'login', user: 'test', pass: 'password' })
      ).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: "Requested auth type 'login' not supported by server",
      });
    });
  });

  describe('PLAIN authentication', () => {
    beforeEach(() => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['PLAIN'],
      });
    });

    it('should authenticate successfully', async () => {
      mockConnection.sendCommand.mockResolvedValue('235 Authentication successful');

      await auth.authenticate({ user: 'test@example.com', pass: 'secret' });

      const authString = `\x00test@example.com\x00secret`;
      const expectedBase64 = Buffer.from(authString, 'utf-8').toString('base64');
      expect(mockConnection.sendCommand).toHaveBeenCalledWith(`AUTH PLAIN ${expectedBase64}`);
    });

    it('should throw error if password missing', async () => {
      await expect(auth.authenticate({ user: 'test' })).rejects.toThrow(MailerError);
      await expect(auth.authenticate({ user: 'test' })).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'Password required for PLAIN authentication',
      });
    });

    it('should handle authentication failure', async () => {
      const smtpError = new MailerError('SMTP Error', ErrorCodes.SMTP_ERROR, 535, '535 Authentication failed');
      mockConnection.sendCommand.mockRejectedValue(smtpError);

      await expect(
        auth.authenticate({ user: 'test', pass: 'wrong' })
      ).rejects.toThrow(MailerError);
      await expect(
        auth.authenticate({ user: 'test', pass: 'wrong' })
      ).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'Authentication failed',
        solution: 'Check username and password',
      });
    });

    it('should throw generic errors unchanged', async () => {
      const genericError = new Error('Network error');
      mockConnection.sendCommand.mockRejectedValue(genericError);

      await expect(
        auth.authenticate({ user: 'test', pass: 'password' })
      ).rejects.toThrow(genericError);
    });
  });

  describe('LOGIN authentication', () => {
    beforeEach(() => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['LOGIN'],
      });
    });

    it('should authenticate successfully', async () => {
      mockConnection.sendCommand
        .mockResolvedValueOnce('334 VXNlcm5hbWU6')
        .mockResolvedValueOnce('334 UGFzc3dvcmQ6')
        .mockResolvedValueOnce('235 Authentication successful');

      await auth.authenticate({ user: 'test@example.com', pass: 'secret' });

      expect(mockConnection.sendCommand).toHaveBeenCalledTimes(3);
      expect(mockConnection.sendCommand).toHaveBeenNthCalledWith(1, 'AUTH LOGIN');
      expect(mockConnection.sendCommand).toHaveBeenNthCalledWith(
        2,
        Buffer.from('test@example.com', 'utf-8').toString('base64')
      );
      expect(mockConnection.sendCommand).toHaveBeenNthCalledWith(
        3,
        Buffer.from('secret', 'utf-8').toString('base64')
      );
    });

    it('should throw error if password missing', async () => {
      await expect(auth.authenticate({ type: 'login', user: 'test' })).rejects.toThrow(
        MailerError
      );
      await expect(auth.authenticate({ type: 'login', user: 'test' })).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'Password required for LOGIN authentication',
      });
    });

    it('should handle authentication failure at any step', async () => {
      const smtpError = new MailerError('SMTP Error', ErrorCodes.SMTP_ERROR, 535, '535 Authentication failed');
      mockConnection.sendCommand
        .mockResolvedValueOnce('334 VXNlcm5hbWU6')
        .mockRejectedValueOnce(smtpError);

      await expect(
        auth.authenticate({ user: 'test', pass: 'wrong' })
      ).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'Authentication failed',
      });
    });

    it('should throw generic errors unchanged', async () => {
      const genericError = new Error('Network error');
      mockConnection.sendCommand
        .mockResolvedValueOnce('334 VXNlcm5hbWU6')
        .mockRejectedValueOnce(genericError);

      await expect(
        auth.authenticate({ user: 'test', pass: 'password' })
      ).rejects.toThrow(genericError);
    });
  });

  describe('CRAM-MD5 authentication', () => {
    beforeEach(() => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['CRAM-MD5'],
      });
    });

    it('should authenticate successfully', async () => {
      const challenge = '<12345.67890@example.com>';
      const challengeBase64 = Buffer.from(challenge, 'utf-8').toString('base64');
      
      mockConnection.sendCommand
        .mockResolvedValueOnce(`334 ${challengeBase64}`)
        .mockResolvedValueOnce('235 Authentication successful');

      await auth.authenticate({ user: 'test@example.com', pass: 'secret' });

      expect(mockConnection.sendCommand).toHaveBeenCalledWith('AUTH CRAM-MD5');
      
      // Verify HMAC calculation
      const hmac = createHmac('md5', 'secret');
      hmac.update(challenge);
      const expectedDigest = hmac.digest('hex');
      const expectedResponse = `test@example.com ${expectedDigest}`;
      const expectedBase64 = Buffer.from(expectedResponse, 'utf-8').toString('base64');
      
      expect(mockConnection.sendCommand).toHaveBeenCalledWith(expectedBase64);
    });

    it('should throw error if password missing', async () => {
      await expect(auth.authenticate({ type: 'cram-md5', user: 'test' })).rejects.toThrow(
        MailerError
      );
      await expect(auth.authenticate({ type: 'cram-md5', user: 'test' })).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'Password required for CRAM-MD5 authentication',
      });
    });

    it('should handle invalid challenge response', async () => {
      mockConnection.sendCommand.mockResolvedValueOnce('334'); // No challenge

      await expect(
        auth.authenticate({ user: 'test', pass: 'secret' })
      ).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
      });
    });

    it('should throw generic errors unchanged', async () => {
      const genericError = new Error('Network error');
      const challenge = '<12345.67890@example.com>';
      const challengeBase64 = Buffer.from(challenge, 'utf-8').toString('base64');
      
      mockConnection.sendCommand
        .mockResolvedValueOnce(`334 ${challengeBase64}`)
        .mockRejectedValueOnce(genericError);

      await expect(
        auth.authenticate({ user: 'test', pass: 'password' })
      ).rejects.toThrow(genericError);
    });
  });

  describe('XOAUTH2 authentication', () => {
    beforeEach(() => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['XOAUTH2'],
      });
    });

    it('should authenticate successfully with access token', async () => {
      mockConnection.sendCommand.mockResolvedValue('235 Authentication successful');

      await auth.authenticate({
        user: 'test@example.com',
        accessToken: 'ya29.a0AfH6SMBx...',
      });

      const authString = [
        'user=test@example.com',
        'auth=Bearer ya29.a0AfH6SMBx...',
        '',
        '',
      ].join('\x01');
      const expectedBase64 = Buffer.from(authString, 'utf-8').toString('base64');
      
      expect(mockConnection.sendCommand).toHaveBeenCalledWith(`AUTH XOAUTH2 ${expectedBase64}`);
    });

    it('should auto-select XOAUTH2 when access token provided', async () => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['PLAIN', 'LOGIN', 'XOAUTH2'],
      });
      mockConnection.sendCommand.mockResolvedValue('235 Authentication successful');

      await auth.authenticate({
        user: 'test@example.com',
        accessToken: 'ya29.a0AfH6SMBx...',
        pass: 'ignored',
      });

      expect(mockConnection.sendCommand).toHaveBeenCalledWith(
        expect.stringContaining('AUTH XOAUTH2')
      );
    });

    it('should throw error if access token missing', async () => {
      await expect(auth.authenticate({ type: 'xoauth2', user: 'test' })).rejects.toThrow(
        MailerError
      );
      await expect(auth.authenticate({ type: 'xoauth2', user: 'test' })).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'Access token required for XOAUTH2 authentication',
      });
    });

    it('should handle 334 response and retry', async () => {
      const error334 = new MailerError('', ErrorCodes.SMTP_ERROR, 334, '334 eyJzdGF0dXMi...');
      mockConnection.sendCommand
        .mockRejectedValueOnce(error334)
        .mockResolvedValueOnce('235 Authentication successful');

      await auth.authenticate({
        user: 'test@example.com',
        accessToken: 'ya29.a0AfH6SMBx...',
      });

      expect(mockConnection.sendCommand).toHaveBeenCalledTimes(2);
      expect(mockConnection.sendCommand).toHaveBeenLastCalledWith('');
    });

    it('should handle 334 response with retry failure', async () => {
      const error334 = new MailerError('', ErrorCodes.SMTP_ERROR, 334, '334 eyJzdGF0dXMi...');
      const retryError = new MailerError('Auth failed', ErrorCodes.SMTP_ERROR, 535, '535 5.7.8 Error');
      mockConnection.sendCommand
        .mockRejectedValueOnce(error334)
        .mockRejectedValueOnce(retryError);

      await expect(
        auth.authenticate({
          user: 'test@example.com',
          accessToken: 'ya29.a0AfH6SMBx...',
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'OAuth2 authentication failed',
      });
    });

    it('should handle 334 response with generic retry error', async () => {
      const error334 = new MailerError('', ErrorCodes.SMTP_ERROR, 334, '334 eyJzdGF0dXMi...');
      const genericError = new Error('Network error');
      mockConnection.sendCommand
        .mockRejectedValueOnce(error334)
        .mockRejectedValueOnce(genericError);

      await expect(
        auth.authenticate({
          user: 'test@example.com',
          accessToken: 'ya29.a0AfH6SMBx...',
        })
      ).rejects.toThrow(genericError);
    });

    it('should handle OAuth2 failure', async () => {
      const smtpError = new MailerError('SMTP Error', ErrorCodes.SMTP_ERROR, 535, '535 5.7.8 Username and Password not accepted');
      mockConnection.sendCommand.mockRejectedValue(smtpError);

      await expect(
        auth.authenticate({
          user: 'test@example.com',
          accessToken: 'invalid-token',
        })
      ).rejects.toThrow(MailerError);
      await expect(
        auth.authenticate({
          user: 'test@example.com',
          accessToken: 'invalid-token',
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'OAuth2 authentication failed',
        solution: 'Check access token validity and scopes',
      });
    });

    it('should throw generic errors unchanged from initial auth attempt', async () => {
      const genericError = new Error('Network error');
      mockConnection.sendCommand.mockRejectedValue(genericError);

      await expect(
        auth.authenticate({
          user: 'test@example.com',
          accessToken: 'ya29.a0AfH6SMBx...',
        })
      ).rejects.toThrow(genericError);
    });
  });

  describe('auth method selection', () => {
    it('should throw error if no compatible method found', async () => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['UNKNOWN'],
      });

      await expect(auth.authenticate({ user: 'test', pass: 'password' })).rejects.toThrow(
        MailerError
      );
      await expect(auth.authenticate({ user: 'test', pass: 'password' })).rejects.toMatchObject({
        code: ErrorCodes.AUTH_FAILED,
        message: 'No compatible authentication method found',
      });
    });

    it('should handle case-insensitive auth methods', async () => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['plain', 'login'], // lowercase
      });
      mockConnection.sendCommand.mockResolvedValue('235 Authentication successful');

      await auth.authenticate({ type: 'plain', user: 'test', pass: 'password' });

      expect(mockConnection.sendCommand).toHaveBeenCalledWith(
        expect.stringContaining('AUTH PLAIN')
      );
    });

    it('should prioritize methods correctly', async () => {
      // CRAM-MD5 > LOGIN > PLAIN
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['PLAIN', 'LOGIN'],
      });
      mockConnection.sendCommand
        .mockResolvedValueOnce('334 VXNlcm5hbWU6')
        .mockResolvedValueOnce('334 UGFzc3dvcmQ6')
        .mockResolvedValueOnce('235 Authentication successful');

      await auth.authenticate({ user: 'test', pass: 'password' });

      expect(mockConnection.sendCommand).toHaveBeenCalledWith('AUTH LOGIN');
    });
  });

  describe('edge cases', () => {
    it('should throw error for unknown auth type returned by selectAuthMethod', async () => {
      mockConnection.getCapabilities.mockReturnValue({
        auth: ['PLAIN'],
      });

      // Mock the private selectAuthMethod to return an unexpected value
      const selectAuthMethodSpy = jest.spyOn(auth as any, 'selectAuthMethod');
      selectAuthMethodSpy.mockReturnValue('unknown-auth-type');

      await expect(
        auth.authenticate({ user: 'test', pass: 'password' })
      ).rejects.toThrow('Unsupported authentication type: unknown-auth-type');

      selectAuthMethodSpy.mockRestore();
    });
  });
});