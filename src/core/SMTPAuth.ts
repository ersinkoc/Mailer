import { createHmac } from 'crypto';
import { SMTPConnection } from './SMTPConnection';
import { MailerError, ErrorCodes } from '../errors/MailerError';

export interface AuthCredentials {
  type?: 'plain' | 'login' | 'cram-md5' | 'xoauth2';
  user: string;
  pass?: string;
  accessToken?: string;
}

export class SMTPAuth {
  constructor(private connection: SMTPConnection) {}

  public async authenticate(credentials: AuthCredentials): Promise<void> {
    const capabilities = this.connection.getCapabilities();

    if (!capabilities.auth || capabilities.auth.length === 0) {
      throw new MailerError(
        'Server does not support authentication',
        ErrorCodes.AUTH_FAILED,
        undefined,
        undefined,
        'Use a server that supports authentication or remove auth from options',
      );
    }

    const authType = this.selectAuthMethod(credentials, capabilities.auth);

    switch (authType) {
      case 'plain':
        await this.authPlain(credentials);
        break;
      case 'login':
        await this.authLogin(credentials);
        break;
      case 'cram-md5':
        await this.authCramMd5(credentials);
        break;
      case 'xoauth2':
        await this.authXOAuth2(credentials);
        break;
      default:
        throw new MailerError(
          `Unsupported authentication type: ${authType}`,
          ErrorCodes.AUTH_FAILED,
        );
    }
  }

  private selectAuthMethod(credentials: AuthCredentials, supportedMethods: string[]): string {
    const upperMethods = supportedMethods.map((m) => m.toUpperCase());

    if (credentials.type) {
      const requestedType = credentials.type.toUpperCase();
      const mappedType = requestedType === 'CRAM-MD5' ? 'CRAM-MD5' : requestedType;

      if (!upperMethods.includes(mappedType)) {
        throw new MailerError(
          `Requested auth type '${credentials.type}' not supported by server`,
          ErrorCodes.AUTH_FAILED,
          undefined,
          undefined,
          `Server supports: ${supportedMethods.join(', ')}`,
        );
      }
      return credentials.type;
    }

    // Select best available method
    if (credentials.accessToken && upperMethods.includes('XOAUTH2')) {
      return 'xoauth2';
    }

    if (upperMethods.includes('CRAM-MD5')) {
      return 'cram-md5';
    }

    if (upperMethods.includes('LOGIN')) {
      return 'login';
    }

    if (upperMethods.includes('PLAIN')) {
      return 'plain';
    }

    throw new MailerError(
      'No compatible authentication method found',
      ErrorCodes.AUTH_FAILED,
      undefined,
      undefined,
      `Server supports: ${supportedMethods.join(', ')}`,
    );
  }

  private async authPlain(credentials: AuthCredentials): Promise<void> {
    if (!credentials.pass) {
      throw new MailerError('Password required for PLAIN authentication', ErrorCodes.AUTH_FAILED);
    }

    const authString = `\x00${credentials.user}\x00${credentials.pass}`;
    const base64Auth = Buffer.from(authString, 'utf-8').toString('base64');

    try {
      await this.connection.sendCommand(`AUTH PLAIN ${base64Auth}`);
    } catch (error) {
      if (error instanceof MailerError) {
        throw new MailerError(
          'Authentication failed',
          ErrorCodes.AUTH_FAILED,
          error.statusCode,
          error.response,
          'Check username and password',
        );
      }
      throw error;
    }
  }

  private async authLogin(credentials: AuthCredentials): Promise<void> {
    if (!credentials.pass) {
      throw new MailerError('Password required for LOGIN authentication', ErrorCodes.AUTH_FAILED);
    }

    try {
      await this.connection.sendCommand('AUTH LOGIN');

      // Server should respond with base64 encoded "Username:"
      const usernameBase64 = Buffer.from(credentials.user, 'utf-8').toString('base64');
      await this.connection.sendCommand(usernameBase64);

      // Server should respond with base64 encoded "Password:"
      const passwordBase64 = Buffer.from(credentials.pass, 'utf-8').toString('base64');
      await this.connection.sendCommand(passwordBase64);
    } catch (error) {
      if (error instanceof MailerError) {
        throw new MailerError(
          'Authentication failed',
          ErrorCodes.AUTH_FAILED,
          error.statusCode,
          error.response,
          'Check username and password',
        );
      }
      throw error;
    }
  }

  private async authCramMd5(credentials: AuthCredentials): Promise<void> {
    if (!credentials.pass) {
      throw new MailerError(
        'Password required for CRAM-MD5 authentication',
        ErrorCodes.AUTH_FAILED,
      );
    }

    try {
      const challengeResponse = await this.connection.sendCommand('AUTH CRAM-MD5');

      // Extract challenge from response - handle various server response formats
      // Try multiple patterns to find the base64-encoded challenge
      let challenge = '';
      const trimmedResponse = challengeResponse.trim();

      // Pattern 1: "334 <base64>" or "334 <base64> some text"
      const match = trimmedResponse.match(/^334\s+(.+)$/);
      if (match && match[1]) {
        challenge = match[1].trim();
      }

      // Pattern 2: Multiline response - find line with base64-like content
      if (!challenge) {
        const lines = challengeResponse.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          // Check if line looks like base64 (contains base64 characters and no status code)
          // Must be at least 8 characters to be a valid challenge
          if (
            trimmedLine &&
            !/^\d{3}\s/.test(trimmedLine) &&
            /^[A-Za-z0-9+/=]+$/.test(trimmedLine) &&
            trimmedLine.length >= 8
          ) {
            challenge = trimmedLine;
            break;
          }
        }
      }

      if (!challenge) {
        throw new MailerError('Invalid CRAM-MD5 challenge response', ErrorCodes.AUTH_FAILED);
      }

      try {
        challenge = Buffer.from(challenge, 'base64').toString('utf-8');
      } catch {
        throw new MailerError('Invalid CRAM-MD5 challenge response', ErrorCodes.AUTH_FAILED);
      }

      // Calculate HMAC-MD5
      const hmac = createHmac('md5', credentials.pass);
      hmac.update(challenge);
      const digest = hmac.digest('hex');

      // Create response
      const response = `${credentials.user} ${digest}`;
      const responseBase64 = Buffer.from(response, 'utf-8').toString('base64');

      await this.connection.sendCommand(responseBase64);
    } catch (error) {
      if (error instanceof MailerError) {
        throw new MailerError(
          'Authentication failed',
          ErrorCodes.AUTH_FAILED,
          error.statusCode,
          error.response,
          'Check username and password',
        );
      }
      throw error;
    }
  }

  private async authXOAuth2(credentials: AuthCredentials): Promise<void> {
    if (!credentials.accessToken) {
      throw new MailerError(
        'Access token required for XOAUTH2 authentication',
        ErrorCodes.AUTH_FAILED,
      );
    }

    // Build OAuth2 string
    const authString = [
      `user=${credentials.user}`,
      `auth=Bearer ${credentials.accessToken}`,
      '',
      '',
    ].join('\x01');

    const base64Auth = Buffer.from(authString, 'utf-8').toString('base64');

    try {
      await this.connection.sendCommand(`AUTH XOAUTH2 ${base64Auth}`);
    } catch (error) {
      if (error instanceof MailerError && error.statusCode === 334) {
        // Server is asking for more information, send empty response
        try {
          await this.connection.sendCommand('');
        } catch (retryError) {
          if (retryError instanceof MailerError) {
            throw new MailerError(
              'OAuth2 authentication failed',
              ErrorCodes.AUTH_FAILED,
              retryError.statusCode,
              retryError.response,
              'Check access token validity and scopes',
            );
          }
          throw retryError;
        }
      } else if (error instanceof MailerError) {
        throw new MailerError(
          'OAuth2 authentication failed',
          ErrorCodes.AUTH_FAILED,
          error.statusCode,
          error.response,
          'Check access token validity and scopes',
        );
      } else {
        throw error;
      }
    }
  }
}
