import * as MailerExports from '../src/index';

describe('index.ts exports', () => {
  it('should export Mailer class', () => {
    expect(MailerExports.Mailer).toBeDefined();
    expect(typeof MailerExports.Mailer).toBe('function');
  });

  it('should export MailerError and ErrorCodes', () => {
    expect(MailerExports.MailerError).toBeDefined();
    expect(typeof MailerExports.MailerError).toBe('function');
    expect(MailerExports.ErrorCodes).toBeDefined();
    expect(typeof MailerExports.ErrorCodes).toBe('object');
  });

  it('should export SimpleEncoding', () => {
    expect(MailerExports.SimpleEncoding).toBeDefined();
    expect(typeof MailerExports.SimpleEncoding).toBe('function');
  });

  it('should export VERSION constant', () => {
    expect(MailerExports.VERSION).toBeDefined();
    expect(typeof MailerExports.VERSION).toBe('string');
    expect(MailerExports.VERSION).toBe('1.0.0');
  });

  it('should have all expected exports', () => {
    const expectedExports = [
      'Mailer',
      'MailerError',
      'ErrorCodes',
      'SimpleEncoding',
      'VERSION',
    ];

    const actualExports = Object.keys(MailerExports);
    
    expectedExports.forEach(exportName => {
      expect(actualExports).toContain(exportName);
    });
  });

  it('should be able to create Mailer instance from export', () => {
    const mailer = new MailerExports.Mailer({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
    });
    
    expect(mailer).toBeInstanceOf(MailerExports.Mailer);
  });

  it('should be able to create MailerError instance from export', () => {
    const error = new MailerExports.MailerError(
      'Test error',
      MailerExports.ErrorCodes.CONNECTION_FAILED
    );
    
    expect(error).toBeInstanceOf(MailerExports.MailerError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(MailerExports.ErrorCodes.CONNECTION_FAILED);
  });

  it('should be able to use SimpleEncoding from export', () => {
    const encoded = MailerExports.SimpleEncoding.base64Encode('Hello World');
    expect(encoded).toBe('SGVsbG8gV29ybGQ=');
    
    const decoded = MailerExports.SimpleEncoding.base64Decode(encoded);
    expect(decoded).toBe('Hello World');
  });

  it('should have correct ErrorCodes values', () => {
    expect(MailerExports.ErrorCodes.CONNECTION_FAILED).toBe('ECONNECTION');
    expect(MailerExports.ErrorCodes.CONNECTION_TIMEOUT).toBe('ECONNTIMEOUT');
    expect(MailerExports.ErrorCodes.AUTH_FAILED).toBe('EAUTH');
    expect(MailerExports.ErrorCodes.TLS_FAILED).toBe('ETLS');
    expect(MailerExports.ErrorCodes.INVALID_RECIPIENT).toBe('ERECIPIENT');
    expect(MailerExports.ErrorCodes.INVALID_SENDER).toBe('ESENDER');
    expect(MailerExports.ErrorCodes.MESSAGE_REJECTED).toBe('EMESSAGE');
    expect(MailerExports.ErrorCodes.RATE_LIMIT).toBe('ERATELIMIT');
    expect(MailerExports.ErrorCodes.POOL_EXHAUSTED).toBe('EPOOLEXHAUSTED');
    expect(MailerExports.ErrorCodes.INVALID_CONFIG).toBe('ECONFIG');
    expect(MailerExports.ErrorCodes.ENCODING_ERROR).toBe('EENCODING');
    expect(MailerExports.ErrorCodes.PLUGIN_ERROR).toBe('EPLUGIN');
    expect(MailerExports.ErrorCodes.SMTP_ERROR).toBe('ESMTP');
  });
});