/**
 * Simple encoding utilities using Node.js built-in Buffer methods
 * This provides a working baseline while the custom implementations are being fixed
 */

export class SimpleEncoding {
  public static base64Encode(data: string): string {
    return Buffer.from(data, 'utf-8').toString('base64');
  }

  public static base64Decode(data: string): string {
    return Buffer.from(data, 'base64').toString('utf-8');
  }

  public static base64EncodeWithLineBreaks(data: string, lineLength = 76): string {
    const encoded = this.base64Encode(data);
    const lines: string[] = [];

    for (let i = 0; i < encoded.length; i += lineLength) {
      lines.push(encoded.substring(i, i + lineLength));
    }

    return lines.join('\r\n');
  }

  public static quotedPrintableEncode(data: string): string {
    const bytes = Buffer.from(data, 'utf-8');
    let result = '';
    let currentLineLength = 0;
    const maxLineLength = 76;

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]!;
      let encoded = '';

      // Handle line breaks first
      if (byte === 13) {
        // Check if followed by LF
        if (i + 1 < bytes.length && bytes[i + 1] === 10) {
          result += '\r\n';
          currentLineLength = 0;
          i++; // Skip the LF
          continue;
        }
        // Standalone CR - encode it
        encoded = '=0D';
      } else if (byte === 10) {
        // Standalone LF - convert to CRLF
        result += '\r\n';
        currentLineLength = 0;
        continue;
      } else if (byte < 32 || byte > 126 || byte === 61) {
        // Characters that need encoding
        encoded = `=${byte.toString(16).toUpperCase().padStart(2, '0')}`;
      } else {
        encoded = String.fromCharCode(byte);
      }

      if (currentLineLength + encoded.length > maxLineLength) {
        result += '=\r\n';
        currentLineLength = 0;
      }

      result += encoded;
      currentLineLength += encoded.length;
    }

    return result;
  }

  public static quotedPrintableDecode(data: string): string {
    // Remove soft line breaks first
    const withoutSoftBreaks = data.replace(/=\r\n/g, '');

    // Decode hex values to bytes
    const bytes: number[] = [];
    let i = 0;

    while (i < withoutSoftBreaks.length) {
      if (withoutSoftBreaks[i] === '=' && i + 2 < withoutSoftBreaks.length) {
        const hex = withoutSoftBreaks.substring(i + 1, i + 3);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 3;
          continue;
        }
      }
      // Regular character
      bytes.push(withoutSoftBreaks.charCodeAt(i));
      i++;
    }

    // Convert bytes to string using UTF-8 decoding
    return Buffer.from(bytes).toString('utf-8');
  }

  public static needsEncoding(text: string): boolean {
    return /[^\x00-\x7F]/.test(text);
  }

  public static selectBestEncoding(text: string): 'base64' | 'quoted-printable' | '7bit' {
    if (!this.needsEncoding(text)) {
      return '7bit';
    }

    const nonAsciiCount = (text.match(/[^\x00-\x7F]/g) || []).length;
    const totalLength = text.length;

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
        return this.base64EncodeWithLineBreaks(text);
      case 'quoted-printable':
        return this.quotedPrintableEncode(text);
      case '7bit':
      default:
        return text;
    }
  }

  public static decodeContent(text: string, encoding: string): string {
    const normalizedEncoding = encoding.toLowerCase();
    switch (normalizedEncoding) {
      case 'base64':
        return this.base64Decode(text.replace(/\r\n/g, ''));
      case 'quoted-printable':
        return this.quotedPrintableDecode(text);
      case '7bit':
      case '8bit':
      default:
        return text;
    }
  }
}
