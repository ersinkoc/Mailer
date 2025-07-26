export class MailerError extends Error {
  public code: string;
  public statusCode?: number;
  public response?: string;
  public solution?: string;
  public documentation?: string;
  public command?: string;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    response?: string,
    solution?: string,
  ) {
    super(message);
    this.name = 'MailerError';
    this.code = code;
    this.statusCode = statusCode;
    this.response = response;
    this.solution = solution;
    this.documentation = `https://github.com/oxog/mailer/docs/errors/${code}`;

    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      response: this.response,
      solution: this.solution,
      documentation: this.documentation,
      stack: this.stack,
    };
  }
}

export const ErrorCodes = {
  CONNECTION_FAILED: 'ECONNECTION',
  CONNECTION_TIMEOUT: 'ECONNTIMEOUT',
  AUTH_FAILED: 'EAUTH',
  TLS_FAILED: 'ETLS',
  INVALID_RECIPIENT: 'ERECIPIENT',
  INVALID_SENDER: 'ESENDER',
  MESSAGE_REJECTED: 'EMESSAGE',
  RATE_LIMIT: 'ERATELIMIT',
  POOL_EXHAUSTED: 'EPOOLEXHAUSTED',
  INVALID_CONFIG: 'ECONFIG',
  ENCODING_ERROR: 'EENCODING',
  PLUGIN_ERROR: 'EPLUGIN',
  SMTP_ERROR: 'ESMTP',
} as const;
