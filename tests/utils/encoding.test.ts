import {
  Base64,
  QuotedPrintable,
  HeaderEncoding,
  EncodingUtils,
} from '../../src/utils/encoding';

describe('Base64', () => {
  describe('encode', () => {
    it('should encode simple strings', () => {
      expect(Base64.encode('Hello')).toBe('SGVsbG8=');
      expect(Base64.encode('Hello World')).toBe('SGVsbG8gV29ybGQ=');
      expect(Base64.encode('')).toBe('');
    });

    it('should encode strings with special characters', () => {
      expect(Base64.encode('Hello, 世界!')).toBe('SGVsbG8sIOS4lueVjCE=');
      expect(Base64.encode('🚀')).toBe('8J+agA==');
    });

    it('should encode binary data', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(Base64.encode(buffer)).toBe('AAECAw==');
    });

    it('should handle padding correctly', () => {
      expect(Base64.encode('A')).toBe('QQ==');
      expect(Base64.encode('AB')).toBe('QUI=');
      expect(Base64.encode('ABC')).toBe('QUJD');
    });
  });

  describe('decode', () => {
    it('should decode base64 strings', () => {
      expect(Base64.decode('SGVsbG8=').toString()).toBe('Hello');
      expect(Base64.decode('SGVsbG8gV29ybGQ=').toString()).toBe('Hello World');
      expect(Base64.decode('').toString()).toBe('');
    });

    it('should decode strings with special characters', () => {
      expect(Base64.decode('SGVsbG8sIOS4lueVjCE=').toString()).toBe('Hello, 世界!');
      expect(Base64.decode('8J+agA==').toString()).toBe('🚀');
    });

    it('should handle padding', () => {
      expect(Base64.decode('QQ==').toString()).toBe('A');
      expect(Base64.decode('QUI=').toString()).toBe('AB');
      expect(Base64.decode('QUJD').toString()).toBe('ABC');
    });

    it('should ignore whitespace and invalid characters', () => {
      expect(Base64.decode('SGVs\nbG8g\rV29y\tbGQ=').toString()).toBe('Hello World');
      expect(Base64.decode('SGVsbG8gV29ybGQ=!@#$').toString()).toBe('Hello World');
    });
  });

  describe('encodeWithLineBreaks', () => {
    it('should add line breaks at specified length', () => {
      const longString = 'A'.repeat(100);
      const encoded = Base64.encodeWithLineBreaks(longString, 76);
      const lines = encoded.split('\r\n');
      
      lines.slice(0, -1).forEach(line => {
        expect(line.length).toBeLessThanOrEqual(76);
      });
    });

    it('should use default line length of 76', () => {
      const longString = 'A'.repeat(100);
      const encoded = Base64.encodeWithLineBreaks(longString);
      const lines = encoded.split('\r\n');
      
      expect(lines.length).toBeGreaterThan(1);
      lines.slice(0, -1).forEach(line => {
        expect(line.length).toBeLessThanOrEqual(76);
      });
    });
  });

  describe('round-trip encoding', () => {
    it('should encode and decode correctly', () => {
      const testStrings = [
        'Hello World',
        'Special chars: !@#$%^&*()',
        'Unicode: 世界 🌍 🚀',
        'Numbers: 1234567890',
        'Mixed: Hello, 世界! 🚀 123',
        '',
        'A',
        'AB',
        'ABC',
      ];

      testStrings.forEach(str => {
        const encoded = Base64.encode(str);
        const decoded = Base64.decode(encoded).toString();
        expect(decoded).toBe(str);
      });
    });
  });
});

describe('QuotedPrintable', () => {
  describe('encode', () => {
    it('should encode regular ASCII text unchanged', () => {
      expect(QuotedPrintable.encode('Hello World')).toBe('Hello World');
    });

    it('should encode special characters', () => {
      expect(QuotedPrintable.encode('Hello=World')).toBe('Hello=3DWorld');
      expect(QuotedPrintable.encode('Test\tTab')).toBe('Test=09Tab');
    });

    it('should encode non-ASCII characters', () => {
      expect(QuotedPrintable.encode('Café')).toBe('Caf=C3=A9');
      expect(QuotedPrintable.encode('世界')).toBe('=E4=B8=96=E7=95=8C');
    });

    it('should handle line breaks', () => {
      expect(QuotedPrintable.encode('Line 1\nLine 2')).toBe('Line 1\r\nLine 2');
      expect(QuotedPrintable.encode('Line 1\r\nLine 2')).toBe('Line 1\r\nLine 2');
    });

    it('should add soft line breaks for long lines', () => {
      const longString = 'A'.repeat(80);
      const encoded = QuotedPrintable.encode(longString, 76);
      
      expect(encoded).toContain('=\r\n');
      
      // Check that no line exceeds the limit
      const lines = encoded.split('\r\n');
      lines.forEach(line => {
        if (!line.endsWith('=')) {
          expect(line.length).toBeLessThanOrEqual(76);
        }
      });
    });

    it('should encode trailing spaces and tabs', () => {
      expect(QuotedPrintable.encode('Text ')).toBe('Text=20');
      expect(QuotedPrintable.encode('Text\t')).toBe('Text=09');
      expect(QuotedPrintable.encode('Text \n')).toBe('Text=20\r\n');
    });
  });

  describe('decode', () => {
    it('should decode quoted-printable text', () => {
      expect(QuotedPrintable.decode('Hello World')).toBe('Hello World');
      expect(QuotedPrintable.decode('Hello=3DWorld')).toBe('Hello=World');
      expect(QuotedPrintable.decode('Test=09Tab')).toBe('Test\tTab');
    });

    it('should decode non-ASCII characters', () => {
      expect(QuotedPrintable.decode('Caf=C3=A9')).toBe('Café');
      expect(QuotedPrintable.decode('=E4=B8=96=E7=95=8C')).toBe('世界');
    });

    it('should handle soft line breaks', () => {
      expect(QuotedPrintable.decode('Long=\r\nLine')).toBe('LongLine');
      expect(QuotedPrintable.decode('Test=\r\nsoft=\r\nbreaks')).toBe('Testsoftbreaks');
    });

    it('should preserve hard line breaks', () => {
      expect(QuotedPrintable.decode('Line 1\r\nLine 2')).toBe('Line 1\nLine 2');
    });
  });

  describe('round-trip encoding', () => {
    it('should encode and decode correctly', () => {
      const testStrings = [
        'Hello World',
        'Special chars: !@#$%^&*()',
        'Unicode: Café 世界',
        'Tabs\tand\nspaces ',
        'Equals = signs',
        'Long line that should be wrapped with soft line breaks to test the encoding',
      ];

      testStrings.forEach(str => {
        const encoded = QuotedPrintable.encode(str);
        const decoded = QuotedPrintable.decode(encoded);
        expect(decoded).toBe(str);
      });
    });
  });
});

describe('HeaderEncoding', () => {
  describe('encode', () => {
    it('should not encode ASCII-only text', () => {
      expect(HeaderEncoding.encode('Hello World')).toBe('Hello World');
    });

    it('should encode non-ASCII text with Base64', () => {
      const result = HeaderEncoding.encode('Café');
      expect(result).toBe('=?utf-8?B?Q2Fmw6k=?=');
    });

    it('should encode non-ASCII text with Q-encoding', () => {
      const result = HeaderEncoding.encode('Café', 'Q');
      expect(result).toBe('=?utf-8?Q?Caf=C3=A9?=');
    });

    it('should use custom charset', () => {
      const result = HeaderEncoding.encode('Café', 'B', 'iso-8859-1');
      expect(result).toMatch(/^=\?iso-8859-1\?B\?.*\?=$/);
    });
  });

  describe('decode', () => {
    it('should decode Base64 encoded headers', () => {
      expect(HeaderEncoding.decode('=?utf-8?B?Q2Fmw6k=?=')).toBe('Café');
      expect(HeaderEncoding.decode('Hello =?utf-8?B?Q2Fmw6k=?= World')).toBe('Hello Café World');
    });

    it('should decode Q-encoded headers', () => {
      expect(HeaderEncoding.decode('=?utf-8?Q?Caf=C3=A9?=')).toBe('Café');
      expect(HeaderEncoding.decode('=?utf-8?Q?Hello_World?=')).toBe('Hello World');
    });

    it('should handle case-insensitive encoding types', () => {
      expect(HeaderEncoding.decode('=?utf-8?b?Q2Fmw6k=?=')).toBe('Café');
      expect(HeaderEncoding.decode('=?utf-8?q?Caf=C3=A9?=')).toBe('Café');
    });

    it('should leave non-encoded text unchanged', () => {
      expect(HeaderEncoding.decode('Hello World')).toBe('Hello World');
    });

    it('should handle multiple encoded words', () => {
      const encoded = '=?utf-8?B?SGVsbG8=?= =?utf-8?B?V29ybGQ=?=';
      expect(HeaderEncoding.decode(encoded)).toBe('Hello World');
    });

    it('should handle invalid encoding gracefully', () => {
      expect(HeaderEncoding.decode('=?utf-8?X?invalid?=')).toBe('=?utf-8?X?invalid?=');
      expect(HeaderEncoding.decode('=?utf-8?B?invalid==')).toBe('=?utf-8?B?invalid==');
    });
  });

  describe('round-trip encoding', () => {
    it('should encode and decode correctly', () => {
      const testStrings = [
        'Café Restaurant',
        '世界 Hello',
        'Müller & Sons',
        'José María',
        'Mixed ASCII and 中文',
      ];

      testStrings.forEach(str => {
        const encodedB = HeaderEncoding.encode(str, 'B');
        const decodedB = HeaderEncoding.decode(encodedB);
        expect(decodedB).toBe(str);

        const encodedQ = HeaderEncoding.encode(str, 'Q');
        const decodedQ = HeaderEncoding.decode(encodedQ);
        expect(decodedQ).toBe(str);
      });
    });
  });
});

describe('EncodingUtils', () => {
  describe('needsEncoding', () => {
    it('should detect ASCII-only text', () => {
      expect(EncodingUtils.needsEncoding('Hello World')).toBe(false);
      expect(EncodingUtils.needsEncoding('123!@#$%^&*()')).toBe(false);
    });

    it('should detect non-ASCII text', () => {
      expect(EncodingUtils.needsEncoding('Café')).toBe(true);
      expect(EncodingUtils.needsEncoding('世界')).toBe(true);
      expect(EncodingUtils.needsEncoding('Hello 🚀')).toBe(true);
    });
  });

  describe('selectBestEncoding', () => {
    it('should select 7bit for ASCII text', () => {
      expect(EncodingUtils.selectBestEncoding('Hello World')).toBe('7bit');
    });

    it('should select quoted-printable for mostly ASCII text', () => {
      expect(EncodingUtils.selectBestEncoding('Hello Café')).toBe('quoted-printable');
      expect(EncodingUtils.selectBestEncoding('Mostly ASCII with few 中文 chars')).toBe('quoted-printable');
    });

    it('should select base64 for mostly non-ASCII text', () => {
      expect(EncodingUtils.selectBestEncoding('世界你好中文测试')).toBe('base64');
      expect(EncodingUtils.selectBestEncoding('🚀🌍🎉🎊🎁')).toBe('base64');
    });
  });

  describe('encodeContent', () => {
    const testText = 'Hello Café 世界';

    it('should encode with base64', () => {
      const encoded = EncodingUtils.encodeContent(testText, 'base64');
      expect(Base64.decode(encoded.replace(/\r\n/g, '')).toString()).toBe(testText);
      
      // Test with longer text that requires line breaks
      const longText = 'A'.repeat(100);
      const longEncoded = EncodingUtils.encodeContent(longText, 'base64');
      expect(longEncoded).toContain('\r\n'); // Should have line breaks
      expect(Base64.decode(longEncoded.replace(/\r\n/g, '')).toString()).toBe(longText);
    });

    it('should encode with quoted-printable', () => {
      const encoded = EncodingUtils.encodeContent(testText, 'quoted-printable');
      expect(QuotedPrintable.decode(encoded)).toBe(testText);
    });

    it('should return unchanged for 7bit', () => {
      const asciiText = 'Hello World';
      expect(EncodingUtils.encodeContent(asciiText, '7bit')).toBe(asciiText);
    });
  });

  describe('decodeContent', () => {
    it('should decode base64 content', () => {
      const original = 'Hello Café 世界';
      const encoded = Base64.encode(original);
      expect(EncodingUtils.decodeContent(encoded, 'base64')).toBe(original);
    });

    it('should decode quoted-printable content', () => {
      const original = 'Hello Café';
      const encoded = QuotedPrintable.encode(original);
      expect(EncodingUtils.decodeContent(encoded, 'quoted-printable')).toBe(original);
    });

    it('should handle case-insensitive encoding names', () => {
      const original = 'Hello World';
      const encoded = Base64.encode(original);
      expect(EncodingUtils.decodeContent(encoded, 'BASE64')).toBe(original);
      expect(EncodingUtils.decodeContent(encoded, 'Base64')).toBe(original);
    });

    it('should return unchanged for 7bit and 8bit', () => {
      const text = 'Hello World';
      expect(EncodingUtils.decodeContent(text, '7bit')).toBe(text);
      expect(EncodingUtils.decodeContent(text, '8bit')).toBe(text);
    });
  });

  describe('foldHeader', () => {
    it('should not fold short headers', () => {
      const header = 'Subject: Short subject';
      expect(EncodingUtils.foldHeader(header)).toBe(header);
    });

    it('should fold long headers', () => {
      const longSubject = 'A'.repeat(100);
      const header = `Subject: ${longSubject}`;
      const folded = EncodingUtils.foldHeader(header);
      
      expect(folded).toContain('\r\n '); // Should have continuation line
      
      const lines = folded.split('\r\n');
      lines.forEach((line, index) => {
        if (index === 0) {
          expect(line.length).toBeLessThanOrEqual(78);
        } else {
          expect(line.startsWith(' ')).toBe(true); // Continuation lines start with space
        }
      });
    });

    it('should handle headers without colons', () => {
      const invalidHeader = 'InvalidHeader';
      expect(EncodingUtils.foldHeader(invalidHeader)).toBe(invalidHeader);
    });

    it('should respect custom max length', () => {
      const longSubject = 'A'.repeat(50);
      const header = `Subject: ${longSubject}`;
      const folded = EncodingUtils.foldHeader(header, 40);
      
      const lines = folded.split('\r\n');
      expect(lines.length).toBeGreaterThan(1);
    });
  });
});

describe('Encoding Integration Tests', () => {
  it('should handle complex mixed content', () => {
    const complexText = `Hello World! 🚀
    
    This is a test with:
    - ASCII text
    - Unicode: Café, 世界, José
    - Emojis: 🌍 🎉
    - Special chars: =?*&
    - Long lines that should be properly wrapped when encoded with quoted-printable encoding to ensure correct line length limits are respected
    
    End of test.`;

    // Test Base64 round-trip
    const base64Encoded = Base64.encodeWithLineBreaks(complexText);
    const base64Decoded = Base64.decode(base64Encoded).toString();
    expect(base64Decoded).toBe(complexText);

    // Test Quoted-Printable round-trip
    const qpEncoded = QuotedPrintable.encode(complexText);
    const qpDecoded = QuotedPrintable.decode(qpEncoded);
    expect(qpDecoded).toBe(complexText);

    // Test automatic encoding selection
    const bestEncoding = EncodingUtils.selectBestEncoding(complexText);
    const autoEncoded = EncodingUtils.encodeContent(complexText, bestEncoding);
    const autoDecoded = EncodingUtils.decodeContent(autoEncoded, bestEncoding);
    expect(autoDecoded).toBe(complexText);
  });

  it('should handle header encoding with various content types', () => {
    const testHeaders = [
      'Simple ASCII Subject',
      'Subject with Café',
      '世界 Chinese Subject',
      'Mixed: Hello 世界 Café 🚀',
      'Very long subject line that might need folding when it contains non-ASCII characters like Café and 世界',
    ];

    testHeaders.forEach(subject => {
      // Test B encoding
      const bEncoded = HeaderEncoding.encode(subject, 'B');
      const bDecoded = HeaderEncoding.decode(bEncoded);
      expect(bDecoded).toBe(subject);

      // Test Q encoding
      const qEncoded = HeaderEncoding.encode(subject, 'Q');
      const qDecoded = HeaderEncoding.decode(qEncoded);
      expect(qDecoded).toBe(subject);

      // Test header folding
      const fullHeader = `Subject: ${subject}`;
      const folded = EncodingUtils.foldHeader(fullHeader);
      expect(folded).toContain('Subject:');
    });
  });

  describe('Edge cases for uncovered lines', () => {
    it('should handle standalone LF in quoted-printable encoding', () => {
      // Test standalone LF (line 81)
      const textWithLF = 'Hello\nWorld';
      const encoded = QuotedPrintable.encode(textWithLF);
      expect(encoded).toBe('Hello\r\nWorld');
    });

    it('should handle CRLF sequences without double conversion', () => {
      // Test CRLF that should trigger line 81 (continue case)
      // We need to test the specific case where we have a LF that's preceded by CR
      // This tests the continue statement on line 81
      const buffer = Buffer.from([72, 101, 108, 108, 111, 13, 10, 87, 111, 114, 108, 100]); // Hello\r\nWorld
      const text = buffer.toString('utf-8');
      const encoded = QuotedPrintable.encode(text);
      expect(encoded).toBe('Hello\r\nWorld'); // Should preserve CRLF as-is
      
      // Also test mixed line endings to ensure LF after CR triggers continue
      const mixedBuffer = Buffer.from([65, 13, 10, 66, 10, 67, 13, 10]); // A\r\nB\nC\r\n
      const mixedText = mixedBuffer.toString('utf-8');
      const mixedEncoded = QuotedPrintable.encode(mixedText);
      expect(mixedEncoded).toBe('A\r\nB\r\nC\r\n'); // LF converted to CRLF, existing CRLF preserved
    });

    it('should specifically test the continue case for LF after CR', () => {
      // This specifically tests line 81 - when we have a LF (10) that's preceded by CR (13)
      // The continue statement should be hit
      const testCases = [
        { input: Buffer.from([13, 10]), expected: '\r\n' }, // CR+LF
        { input: Buffer.from([65, 13, 10, 66]), expected: 'A\r\nB' }, // A+CR+LF+B
        { input: Buffer.from([13, 10, 13, 10]), expected: '\r\n\r\n' }, // Two CRLF sequences
      ];
      
      testCases.forEach(({ input, expected }) => {
        const encoded = QuotedPrintable.encode(input.toString('binary'));
        expect(encoded).toBe(expected);
      });
    });

    it('should handle binary data with CRLF sequences', () => {
      // Test with binary data to ensure exact byte handling
      const buffer = Buffer.from('Binary\r\ndata\r\nwith\r\nCRLF', 'binary');
      const encoded = QuotedPrintable.encode(buffer.toString('utf-8'));
      expect(encoded).toContain('\r\n');
    });

    it('should handle standalone CR in quoted-printable encoding', () => {
      // Test standalone CR (line 97)
      const textWithCR = 'Hello\rWorld';
      const encoded = QuotedPrintable.encode(textWithCR);
      expect(encoded).toBe('Hello=0DWorld');
    });

    it('should handle invalid hex sequences in quoted-printable decoding', () => {
      // Test invalid hex in QP decode (line 146)
      const invalidQP = 'Hello=XYWorld=';
      const decoded = QuotedPrintable.decode(invalidQP);
      expect(decoded).toBe('Hello=XYWorld');
    });

    it('should handle charset decoding errors in header decoding', () => {
      // Test charset decoding error (line 190)
      // Create a base64 encoded string with invalid UTF-8 sequences
      const invalidUtf8 = Buffer.from([0xFF, 0xFE, 0xFD]);
      const base64Invalid = invalidUtf8.toString('base64');
      const encoded = `=?invalid-charset?B?${base64Invalid}?=`;
      const decoded = HeaderEncoding.decode(encoded);
      // Should fall back to UTF-8 and handle gracefully
      expect(decoded).toBeDefined();
    });

    it('should handle header decoding errors', () => {
      // Test header decoding error catch block (line 198)
      const malformedHeader = '=?UTF-8?X?InvalidEncoding?=';
      const decoded = HeaderEncoding.decode(malformedHeader);
      expect(decoded).toBe(malformedHeader);
    });

    it('should handle invalid hex sequences in Q-encoding decoding', () => {
      // Test invalid hex in Q-encoding (line 237)
      const invalidQ = 'Hello=GGWorld';
      const decoded = (HeaderEncoding as any).decodeQEncoding(invalidQ);
      expect(decoded).toBe('Hello=GGWorld');
    });

    it('should handle headers without colon in foldHeader', () => {
      // Test header without colon (line 308)
      const headerWithoutColon = 'InvalidHeaderWithoutColon';
      const folded = EncodingUtils.foldHeader(headerWithoutColon);
      expect(folded).toBe(headerWithoutColon);
    });

    it('should handle empty header in foldHeader', () => {
      // Test edge case that should also trigger line 308
      const emptyHeader = '';
      const folded = EncodingUtils.foldHeader(emptyHeader);
      expect(folded).toBe('');
    });

    it('should handle header with spaces but no colon', () => {
      // Another test for line 308
      const headerWithSpaces = 'Header With Spaces But No Colon';
      const folded = EncodingUtils.foldHeader(headerWithSpaces);
      expect(folded).toBe(headerWithSpaces);
    });

    it('should handle Q-encoding with invalid hex after equals sign', () => {
      // More specific test for line 237
      const qEncodedInvalid = 'Test=ZZInvalid';
      const decoded = (HeaderEncoding as any).decodeQEncoding(qEncodedInvalid);
      expect(decoded).toContain('=ZZ');
    });

    it('should handle Base64 encoding with exception in header decode', () => {
      // Test the catch block more thoroughly
      const mockDecode = jest.spyOn(Base64, 'decode');
      mockDecode.mockImplementationOnce(() => {
        throw new Error('Decode error');
      });
      
      const encoded = '=?UTF-8?B?test?=';
      const decoded = HeaderEncoding.decode(encoded);
      expect(decoded).toBe(encoded);
      
      mockDecode.mockRestore();
    });
  });
});