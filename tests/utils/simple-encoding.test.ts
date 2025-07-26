import { SimpleEncoding } from '../../src/utils/simple-encoding';

describe('SimpleEncoding', () => {
  describe('base64Encode', () => {
    it('should encode strings to base64', () => {
      expect(SimpleEncoding.base64Encode('Hello')).toBe('SGVsbG8=');
      expect(SimpleEncoding.base64Encode('Hello World')).toBe('SGVsbG8gV29ybGQ=');
      expect(SimpleEncoding.base64Encode('')).toBe('');
    });

    it('should encode unicode strings', () => {
      expect(SimpleEncoding.base64Encode('世界')).toBe('5LiW55WM');
      expect(SimpleEncoding.base64Encode('🚀')).toBe('8J+agA==');
    });
  });

  describe('base64Decode', () => {
    it('should decode base64 strings', () => {
      expect(SimpleEncoding.base64Decode('SGVsbG8=')).toBe('Hello');
      expect(SimpleEncoding.base64Decode('SGVsbG8gV29ybGQ=')).toBe('Hello World');
      expect(SimpleEncoding.base64Decode('')).toBe('');
    });

    it('should decode unicode base64 strings', () => {
      expect(SimpleEncoding.base64Decode('5LiW55WM')).toBe('世界');
      expect(SimpleEncoding.base64Decode('8J+agA==')).toBe('🚀');
    });
  });

  describe('base64EncodeWithLineBreaks', () => {
    it('should encode with default line length of 76', () => {
      const longString = 'A'.repeat(100);
      const encoded = SimpleEncoding.base64EncodeWithLineBreaks(longString);
      const lines = encoded.split('\r\n');
      
      expect(lines.length).toBeGreaterThan(1);
      lines.slice(0, -1).forEach(line => {
        expect(line.length).toBe(76);
      });
    });

    it('should encode with custom line length', () => {
      const longString = 'B'.repeat(60);
      const encoded = SimpleEncoding.base64EncodeWithLineBreaks(longString, 40);
      const lines = encoded.split('\r\n');
      
      expect(lines.length).toBeGreaterThan(1);
      lines.slice(0, -1).forEach(line => {
        expect(line.length).toBeLessThanOrEqual(40);
      });
    });

    it('should handle short strings without line breaks', () => {
      const shortString = 'Short';
      const encoded = SimpleEncoding.base64EncodeWithLineBreaks(shortString);
      
      expect(encoded).not.toContain('\r\n');
      expect(encoded).toBe('U2hvcnQ=');
    });
  });

  describe('quotedPrintableEncode', () => {
    it('should encode regular ASCII text unchanged', () => {
      expect(SimpleEncoding.quotedPrintableEncode('Hello World')).toBe('Hello World');
    });

    it('should encode special characters', () => {
      expect(SimpleEncoding.quotedPrintableEncode('=')).toBe('=3D');
      expect(SimpleEncoding.quotedPrintableEncode('\t')).toBe('=09');
      expect(SimpleEncoding.quotedPrintableEncode('\x00')).toBe('=00');
      expect(SimpleEncoding.quotedPrintableEncode('\x1F')).toBe('=1F');
      expect(SimpleEncoding.quotedPrintableEncode('\x7F')).toBe('=7F');
    });

    it('should encode non-ASCII characters', () => {
      expect(SimpleEncoding.quotedPrintableEncode('Café')).toBe('Caf=C3=A9');
      expect(SimpleEncoding.quotedPrintableEncode('世界')).toBe('=E4=B8=96=E7=95=8C');
    });

    it('should handle line breaks', () => {
      expect(SimpleEncoding.quotedPrintableEncode('Line 1\nLine 2')).toBe('Line 1\r\nLine 2');
      expect(SimpleEncoding.quotedPrintableEncode('Line 1\r\nLine 2')).toBe('Line 1\r\nLine 2');
    });

    it('should add soft line breaks for long lines', () => {
      const longString = 'A'.repeat(80);
      const encoded = SimpleEncoding.quotedPrintableEncode(longString);
      
      expect(encoded).toContain('=\r\n');
      const lines = encoded.split('\r\n');
      lines.forEach(line => {
        if (!line.endsWith('=')) {
          expect(line.length).toBeLessThanOrEqual(76);
        }
      });
    });

    it('should handle mixed content with line breaks', () => {
      const text = 'A'.repeat(70) + '\n' + 'B'.repeat(10);
      const encoded = SimpleEncoding.quotedPrintableEncode(text);
      
      expect(encoded).toContain('\r\n');
      expect(encoded).not.toContain('=\r\n'); // No soft breaks needed for this case
    });

    it('should handle carriage return characters', () => {
      const text = 'Line 1\rLine 2';
      const encoded = SimpleEncoding.quotedPrintableEncode(text);
      
      expect(encoded).toBe('Line 1=0DLine 2'); // Standalone CR is encoded
    });

    it('should encode long strings with special characters', () => {
      const text = 'A'.repeat(73) + '=B';
      const encoded = SimpleEncoding.quotedPrintableEncode(text);
      
      expect(encoded).toContain('=\r\n'); // Should have soft break
      expect(encoded).toContain('=3D'); // = should be encoded
    });
  });

  describe('quotedPrintableDecode', () => {
    it('should decode quoted-printable text', () => {
      expect(SimpleEncoding.quotedPrintableDecode('Hello World')).toBe('Hello World');
      expect(SimpleEncoding.quotedPrintableDecode('Hello=3DWorld')).toBe('Hello=World');
      expect(SimpleEncoding.quotedPrintableDecode('Test=09Tab')).toBe('Test\tTab');
    });

    it('should decode non-ASCII characters', () => {
      expect(SimpleEncoding.quotedPrintableDecode('Caf=C3=A9')).toBe('Café');
      expect(SimpleEncoding.quotedPrintableDecode('=E4=B8=96=E7=95=8C')).toBe('世界');
    });

    it('should handle soft line breaks', () => {
      expect(SimpleEncoding.quotedPrintableDecode('Long=\r\nLine')).toBe('LongLine');
      expect(SimpleEncoding.quotedPrintableDecode('Test=\r\nsoft=\r\nbreaks')).toBe('Testsoftbreaks');
    });

    it('should decode hex values case-insensitively', () => {
      expect(SimpleEncoding.quotedPrintableDecode('=3d')).toBe('=');
      expect(SimpleEncoding.quotedPrintableDecode('=3D')).toBe('=');
      expect(SimpleEncoding.quotedPrintableDecode('=c3=a9')).toBe('é');
    });
  });

  describe('needsEncoding', () => {
    it('should detect ASCII-only text', () => {
      expect(SimpleEncoding.needsEncoding('Hello World')).toBe(false);
      expect(SimpleEncoding.needsEncoding('123!@#$%^&*()')).toBe(false);
      expect(SimpleEncoding.needsEncoding('')).toBe(false);
    });

    it('should detect non-ASCII text', () => {
      expect(SimpleEncoding.needsEncoding('Café')).toBe(true);
      expect(SimpleEncoding.needsEncoding('世界')).toBe(true);
      expect(SimpleEncoding.needsEncoding('Hello 🚀')).toBe(true);
    });
  });

  describe('selectBestEncoding', () => {
    it('should select 7bit for ASCII text', () => {
      expect(SimpleEncoding.selectBestEncoding('Hello World')).toBe('7bit');
      expect(SimpleEncoding.selectBestEncoding('Simple ASCII text')).toBe('7bit');
    });

    it('should select quoted-printable for mostly ASCII text', () => {
      expect(SimpleEncoding.selectBestEncoding('Hello Café')).toBe('quoted-printable');
      expect(SimpleEncoding.selectBestEncoding('Mostly ASCII with few 中文 chars')).toBe('quoted-printable');
    });

    it('should select base64 for mostly non-ASCII text', () => {
      expect(SimpleEncoding.selectBestEncoding('世界你好中文测试')).toBe('base64');
      expect(SimpleEncoding.selectBestEncoding('🚀🌍🎉🎊🎁')).toBe('base64');
    });

    it('should use 33% threshold for base64 selection', () => {
      // Less than 33% non-ASCII
      const text1 = 'ABC世'; // 1 multi-byte char out of 4 effective chars
      expect(SimpleEncoding.selectBestEncoding(text1)).toBe('quoted-printable');
      
      // More than 33% non-ASCII - 世界 is 2 multi-byte chars
      const text2 = 'A世界';
      expect(SimpleEncoding.selectBestEncoding(text2)).toBe('base64');
    });

    it('should handle null regex match fallback', () => {
      // Test the || [] fallback on line 106
      const originalMatch = String.prototype.match;
      String.prototype.match = jest.fn().mockReturnValue(null);
      
      // When match returns null, it should fallback to empty array and select 7bit
      expect(SimpleEncoding.selectBestEncoding('test text')).toBe('7bit');
      
      // Restore original match
      String.prototype.match = originalMatch;
    });

    it('should handle empty string', () => {
      // Empty string should have no non-ASCII chars and return 7bit
      expect(SimpleEncoding.selectBestEncoding('')).toBe('7bit');
    });
  });

  describe('encodeContent', () => {
    const testText = 'Hello Café 世界';

    it('should encode with base64', () => {
      const encoded = SimpleEncoding.encodeContent(testText, 'base64');
      const decoded = SimpleEncoding.base64Decode(encoded.replace(/\r\n/g, ''));
      expect(decoded).toBe(testText);
    });

    it('should encode with quoted-printable', () => {
      const encoded = SimpleEncoding.encodeContent(testText, 'quoted-printable');
      const decoded = SimpleEncoding.quotedPrintableDecode(encoded);
      expect(decoded).toBe(testText);
    });

    it('should return unchanged for 7bit', () => {
      const asciiText = 'Hello World';
      expect(SimpleEncoding.encodeContent(asciiText, '7bit')).toBe(asciiText);
    });

    it('should handle long text with base64', () => {
      const longText = 'A'.repeat(100);
      const encoded = SimpleEncoding.encodeContent(longText, 'base64');
      expect(encoded).toContain('\r\n'); // Should have line breaks
    });
  });

  describe('decodeContent', () => {
    it('should decode base64 content', () => {
      const original = 'Hello Café 世界';
      const encoded = SimpleEncoding.base64Encode(original);
      expect(SimpleEncoding.decodeContent(encoded, 'base64')).toBe(original);
      expect(SimpleEncoding.decodeContent(encoded, 'BASE64')).toBe(original);
      expect(SimpleEncoding.decodeContent(encoded, 'Base64')).toBe(original);
    });

    it('should decode base64 with line breaks', () => {
      const original = 'A'.repeat(100);
      const encoded = SimpleEncoding.base64EncodeWithLineBreaks(original);
      expect(SimpleEncoding.decodeContent(encoded, 'base64')).toBe(original);
    });

    it('should decode quoted-printable content', () => {
      const original = 'Hello Café';
      const encoded = SimpleEncoding.quotedPrintableEncode(original);
      expect(SimpleEncoding.decodeContent(encoded, 'quoted-printable')).toBe(original);
      expect(SimpleEncoding.decodeContent(encoded, 'QUOTED-PRINTABLE')).toBe(original);
    });

    it('should return unchanged for 7bit and 8bit', () => {
      const text = 'Hello World';
      expect(SimpleEncoding.decodeContent(text, '7bit')).toBe(text);
      expect(SimpleEncoding.decodeContent(text, '8bit')).toBe(text);
      expect(SimpleEncoding.decodeContent(text, '7BIT')).toBe(text);
      expect(SimpleEncoding.decodeContent(text, '8BIT')).toBe(text);
    });

    it('should return unchanged for unknown encoding', () => {
      const text = 'Hello World';
      expect(SimpleEncoding.decodeContent(text, 'unknown')).toBe(text);
      expect(SimpleEncoding.decodeContent(text, '')).toBe(text);
    });
  });

  describe('round-trip encoding', () => {
    const testStrings = [
      'Hello World',
      'Special chars: !@#$%^&*()',
      'Unicode: Café 世界',
      'Tabs\tand\nspaces ',
      'Equals = signs',
      'Long line that should be wrapped with soft line breaks',
      '',
      'A',
      '\x00\x01\x02\x03',
      'Mixed\r\nline\nbreaks\r',
    ];

    testStrings.forEach(str => {
      it(`should round-trip encode/decode: "${str.substring(0, 20)}..."`, () => {
        // Base64 round-trip
        const base64Encoded = SimpleEncoding.base64Encode(str);
        const base64Decoded = SimpleEncoding.base64Decode(base64Encoded);
        expect(base64Decoded).toBe(str);

        // Base64 with line breaks round-trip
        const base64WithBreaks = SimpleEncoding.base64EncodeWithLineBreaks(str);
        const base64WithBreaksDecoded = SimpleEncoding.base64Decode(base64WithBreaks.replace(/\r\n/g, ''));
        expect(base64WithBreaksDecoded).toBe(str);

        // Quoted-printable round-trip (note: line breaks are normalized)
        const qpEncoded = SimpleEncoding.quotedPrintableEncode(str);
        const qpDecoded = SimpleEncoding.quotedPrintableDecode(qpEncoded);
        // Normalize line breaks for comparison
        // For the mixed breaks case, the trailing \r gets encoded as =0D
        if (str === 'Mixed\r\nline\nbreaks\r') {
          // Expected: CRLF stays as is, LF becomes CRLF, trailing CR is encoded/decoded
          expect(qpDecoded).toBe('Mixed\r\nline\r\nbreaks\r');
        } else {
          const normalizedStr = str.replace(/\r\n/g, '\n').replace(/\r/g, '');
          const normalizedDecoded = qpDecoded.replace(/\r\n/g, '\n');
          expect(normalizedDecoded).toBe(normalizedStr);
        }

        // Content encoding round-trip
        const encoding = SimpleEncoding.selectBestEncoding(str);
        const contentEncoded = SimpleEncoding.encodeContent(str, encoding);
        const contentDecoded = SimpleEncoding.decodeContent(contentEncoded, encoding);
        if (encoding === 'quoted-printable') {
          const normalizedOriginal = str.replace(/\r\n/g, '\n').replace(/\r/g, '');
          expect(contentDecoded.replace(/\r\n/g, '\n')).toBe(normalizedOriginal);
        } else {
          expect(contentDecoded).toBe(str);
        }
      });
    });
  });
});