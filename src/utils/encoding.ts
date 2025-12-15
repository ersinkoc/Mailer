/**
 * Base64 encoding implementation from scratch
 */
export class Base64 {
  private static readonly CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  private static readonly PAD = '=';

  public static encode(data: string | Buffer): string {
    const bytes = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    let result = '';

    for (let i = 0; i < bytes.length; i += 3) {
      const b1 = bytes[i] ?? 0;
      const b2 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
      const b3 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;

      const triplet = (b1 << 16) | (b2 << 8) | b3;

      result += this.CHARS[(triplet >> 18) & 63];
      result += this.CHARS[(triplet >> 12) & 63];
      result += i + 1 < bytes.length ? this.CHARS[(triplet >> 6) & 63] : this.PAD;
      result += i + 2 < bytes.length ? this.CHARS[triplet & 63] : this.PAD;
    }

    return result;
  }

  public static decode(data: string): Buffer {
    const cleanData = data.replace(/[^A-Za-z0-9+/]/g, '');
    const bytes: number[] = [];

    for (let i = 0; i < cleanData.length; i += 4) {
      const chunk = [
        this.CHARS.indexOf(cleanData[i] ?? 'A'),
        this.CHARS.indexOf(cleanData[i + 1] ?? 'A'),
        this.CHARS.indexOf(cleanData[i + 2] ?? 'A'),
        this.CHARS.indexOf(cleanData[i + 3] ?? 'A'),
      ];

      const triplet =
        ((chunk[0] ?? 0) << 18) |
        ((chunk[1] ?? 0) << 12) |
        ((chunk[2] ?? 0) << 6) |
        (chunk[3] ?? 0);

      bytes.push((triplet >> 16) & 255);
      // Note: '=' padding is stripped by cleanData regex, so length checks handle padding correctly
      if (i + 2 < cleanData.length) bytes.push((triplet >> 8) & 255);
      if (i + 3 < cleanData.length) bytes.push(triplet & 255);
    }

    return Buffer.from(bytes);
  }

  public static encodeWithLineBreaks(data: string | Buffer, lineLength = 76): string {
    const encoded = this.encode(data);
    const lines: string[] = [];

    for (let i = 0; i < encoded.length; i += lineLength) {
      lines.push(encoded.substring(i, i + lineLength));
    }

    return lines.join('\r\n');
  }
}

/**
 * Quoted-Printable encoding implementation from scratch
 */
export class QuotedPrintable {
  public static encode(data: string, lineLength = 76): string {
    const bytes = Buffer.from(data, 'utf-8');
    let result = '';
    let currentLineLength = 0;

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i] ?? 0;
      let encoded = '';

      // Characters that need encoding
      if (byte === 10) {
        // Line feed - check if preceded by CR
        if (i > 0 && bytes[i - 1] === 13) {
          // Part of CRLF, already handled
          continue;
        }
        // Standalone LF - convert to CRLF
        result += '\r\n';
        currentLineLength = 0;
        continue;
      } else if (byte === 13) {
        // Carriage return - check if followed by LF
        if (i + 1 < bytes.length && bytes[i + 1] === 10) {
          // CR+LF - output as CRLF
          result += '\r\n';
          currentLineLength = 0;
          i++; // Skip the LF
          continue;
        }
        // Standalone CR - encode it
        encoded = '=0D';
      } else if (
        byte < 32 || // Control characters
        byte > 126 || // Non-ASCII
        byte === 61 || // Equal sign (=)
        (byte === 32 && (i === bytes.length - 1 || bytes[i + 1] === 10 || bytes[i + 1] === 13)) || // Trailing space
        (byte === 9 && (i === bytes.length - 1 || bytes[i + 1] === 10 || bytes[i + 1] === 13)) // Trailing tab
      ) {
        encoded = `=${byte.toString(16).toUpperCase().padStart(2, '0')}`;
      } else {
        // Regular character
        encoded = String.fromCharCode(byte);
      }

      // Check if adding this encoded character would exceed line length
      if (currentLineLength + encoded.length > lineLength) {
        result += '=\r\n'; // Soft line break
        currentLineLength = 0;
      }

      result += encoded;
      currentLineLength += encoded.length;
    }

    return result;
  }

  public static decode(data: string): string {
    const lines = data.split('\r\n');
    const bytes: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i] ?? '';

      // Handle soft line breaks (line ending with =)
      const isSoftBreak = line.endsWith('=');
      if (isSoftBreak) {
        line = line.slice(0, -1); // Remove trailing =
      }

      // Decode quoted-printable sequences to bytes
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '=' && j + 2 < line.length) {
          const hex = line.substring(j + 1, j + 3);
          if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
            bytes.push(parseInt(hex, 16));
            j += 2;
          } else {
            bytes.push(line.charCodeAt(j));
          }
        } else {
          bytes.push(line.charCodeAt(j));
        }
      }

      // Add line break if not soft break and not last line
      if (!isSoftBreak && i < lines.length - 1) {
        bytes.push(10); // LF
      }
    }

    // Convert bytes to UTF-8 string
    return Buffer.from(bytes).toString('utf-8');
  }
}

/**
 * RFC 2047 Header encoding for non-ASCII characters in headers
 */
export class HeaderEncoding {
  public static encode(text: string, encoding: 'B' | 'Q' = 'B', charset = 'utf-8'): string {
    // Check if encoding is needed (non-ASCII characters)
    // eslint-disable-next-line no-control-regex
    if (!/[^\x00-\x7F]/.test(text)) {
      return text;
    }

    const encoded = encoding === 'B' ? Base64.encode(text) : this.encodeQEncoding(text);

    return `=?${charset}?${encoding}?${encoded}?=`;
  }

  public static decode(text: string): string {
    return text.replace(
      /=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g,
      (match: string, charset: string, encoding: string, encodedText: string) => {
        try {
          if (encoding.toUpperCase() === 'B') {
            const decoded = Base64.decode(encodedText);
            // Try to decode with the specified charset
            try {
              return decoded.toString(charset.toLowerCase() as BufferEncoding);
            } catch {
              return decoded.toString('utf-8');
            }
          } else if (encoding.toUpperCase() === 'Q') {
            return this.decodeQEncoding(encodedText);
          }
        } catch {
          // Return original if decoding fails
        }
        return match;
      },
    );
  }

  private static encodeQEncoding(text: string): string {
    const bytes = Buffer.from(text, 'utf-8');
    let result = '';

    for (const byte of bytes) {
      // Q-encoding is like quoted-printable but spaces become underscores
      if (
        (byte >= 65 && byte <= 90) || // A-Z
        (byte >= 97 && byte <= 122) || // a-z
        (byte >= 48 && byte <= 57) // 0-9
      ) {
        result += String.fromCharCode(byte);
      } else if (byte === 32) {
        result += '_'; // Space becomes underscore
      } else {
        result += `=${byte.toString(16).toUpperCase().padStart(2, '0')}`;
      }
    }

    return result;
  }

  private static decodeQEncoding(text: string): string {
    const bytes: number[] = [];

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '_') {
        bytes.push(32); // Space
      } else if (text[i] === '=' && i + 2 < text.length) {
        const hex = text.substring(i + 1, i + 3);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 2;
        } else {
          bytes.push(text.charCodeAt(i));
        }
      } else {
        bytes.push(text.charCodeAt(i));
      }
    }

    return Buffer.from(bytes).toString('utf-8');
  }
}

/**
 * Utility functions for encoding detection and conversion
 */
export class EncodingUtils {
  public static needsEncoding(text: string): boolean {
    // eslint-disable-next-line no-control-regex
    return /[^\x00-\x7F]/.test(text);
  }

  public static selectBestEncoding(text: string): 'base64' | 'quoted-printable' | '7bit' {
    if (!this.needsEncoding(text)) {
      return '7bit';
    }

    // Count non-ASCII characters
    // eslint-disable-next-line no-control-regex
    const nonAsciiCount = (text.match(/[^\x00-\x7F]/g) || []).length;
    const totalLength = text.length;

    // If more than 33% non-ASCII, base64 is more efficient
    if (nonAsciiCount / totalLength > 0.33) {
      return 'base64';
    }

    return 'quoted-printable';
  }

  public static encodeContent(
    text: string,
    encoding: 'base64' | 'quoted-printable' | '7bit',
  ): string {
    switch (encoding) {
      case 'base64':
        return Base64.encodeWithLineBreaks(text);
      case 'quoted-printable':
        return QuotedPrintable.encode(text);
      case '7bit':
      default:
        return text;
    }
  }

  public static decodeContent(text: string, encoding: string): string {
    switch (encoding.toLowerCase()) {
      case 'base64':
        return Base64.decode(text).toString('utf-8');
      case 'quoted-printable':
        return QuotedPrintable.decode(text);
      case '7bit':
      case '8bit':
      default:
        return text;
    }
  }

  public static foldHeader(header: string, maxLength = 78): string {
    if (header.length <= maxLength) {
      return header;
    }

    const colonIndex = header.indexOf(':');
    if (colonIndex === -1) {
      return header;
    }

    const headerName = header.substring(0, colonIndex + 1);
    const headerValue = header.substring(colonIndex + 1).trim();

    const result = [headerName];
    let currentLine = ' '; // Start with space for continuation
    const words = headerValue.split(/(\s+)/);

    for (const word of words) {
      const testLine = currentLine + word;

      if (testLine.length > maxLength - headerName.length) {
        if (currentLine.trim()) {
          result.push(currentLine);
        }
        currentLine = ' ' + word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine.trim()) {
      result.push(currentLine);
    }

    return result.join('\r\n');
  }
}
