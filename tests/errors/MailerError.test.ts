import { MailerError, ErrorCodes } from '../../src/errors/MailerError';

describe('MailerError', () => {
  it('should create error with all properties', () => {
    const error = new MailerError(
      'Test error message',
      ErrorCodes.CONNECTION_FAILED,
      500,
      '500 Internal Server Error',
      'Check your connection settings'
    );

    expect(error.message).toBe('Test error message');
    expect(error.code).toBe(ErrorCodes.CONNECTION_FAILED);
    expect(error.statusCode).toBe(500);
    expect(error.response).toBe('500 Internal Server Error');
    expect(error.solution).toBe('Check your connection settings');
    expect(error.documentation).toBe('https://github.com/ersinkoc/mailer/docs/errors/ECONNECTION');
    expect(error.name).toBe('MailerError');
  });

  it('should create error with minimal properties', () => {
    const error = new MailerError('Minimal error', ErrorCodes.AUTH_FAILED);

    expect(error.message).toBe('Minimal error');
    expect(error.code).toBe(ErrorCodes.AUTH_FAILED);
    expect(error.statusCode).toBeUndefined();
    expect(error.response).toBeUndefined();
    expect(error.solution).toBeUndefined();
    expect(error.documentation).toBe('https://github.com/ersinkoc/mailer/docs/errors/EAUTH');
  });

  it('should serialize to JSON correctly', () => {
    const error = new MailerError(
      'JSON test error',
      ErrorCodes.SMTP_ERROR,
      550,
      '550 Mailbox not found',
      'Verify the recipient email address'
    );

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'MailerError',
      message: 'JSON test error',
      code: ErrorCodes.SMTP_ERROR,
      statusCode: 550,
      response: '550 Mailbox not found',
      solution: 'Verify the recipient email address',
      documentation: 'https://github.com/ersinkoc/mailer/docs/errors/ESMTP',
      stack: expect.any(String),
    });
  });

  it('should have proper stack trace', () => {
    const error = new MailerError('Stack trace test', ErrorCodes.INVALID_CONFIG);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('MailerError: Stack trace test');
    expect(error.stack).toContain('MailerError.test.ts');
  });
});