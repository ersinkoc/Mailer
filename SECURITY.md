# Security Policy

## Supported Versions

We actively maintain security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of @oxog/mailer seriously. If you discover a security vulnerability, please follow these steps:

### 1. DO NOT disclose the vulnerability publicly

Please **DO NOT** create a public GitHub issue for security vulnerabilities. Instead, report them privately via email.

### 2. Report the vulnerability

Send your report to: **security@oxog.dev**

Include the following information:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Triage**: Within 5 business days
- **Fix Development**: Depends on severity
- **Disclosure**: Coordinated with reporter

### 4. What to expect

- Acknowledgment of receipt within 48 hours
- Regular updates on progress
- Credit given to reporters (unless requested otherwise)
- Public disclosure after fix is available

## Security Best Practices

### For Users

1. **Keep Updated**: Always use the latest version
2. **Validate Input**: Sanitize all email content and attachments
3. **Secure Credentials**: Use environment variables for sensitive data
4. **Network Security**: Use TLS/SSL in production
5. **Rate Limiting**: Implement rate limiting to prevent abuse

### For Developers

1. **Zero Dependencies**: We maintain a zero-dependency policy to minimize attack surface
2. **Code Review**: All changes require review
3. **Type Safety**: Full TypeScript coverage with strict mode
4. **Testing**: Comprehensive test suite with high coverage
5. **Security Scanning**: Automated vulnerability scanning in CI/CD

## Vulnerability Severity Levels

### Critical
- Remote code execution
- Authentication bypass
- Data exfiltration
- **Fix Timeline**: 24-48 hours

### High
- Privilege escalation
- Cross-site scripting (XSS)
- Injection attacks
- **Fix Timeline**: 5-7 business days

### Medium
- Information disclosure
- Denial of service
- **Fix Timeline**: 10-14 business days

### Low
- Minor security concerns
- Best practice violations
- **Fix Timeline**: Next release cycle

## Security Measures

### Code Protection
- ✅ Zero external dependencies
- ✅ Full TypeScript coverage
- ✅ Strict null checks
- ✅ Input validation
- ✅ Output encoding
- ✅ Secure defaults

### Infrastructure
- ✅ GitHub Security Advisories enabled
- ✅ Dependency vulnerability scanning
- ✅ Automated security testing
- ✅ CodeQL analysis
- ✅ Regular security audits

### Communication
- ✅ Private vulnerability reporting
- ✅ Coordinated disclosure
- ✅ Security advisories
- ✅ CVE assignment when applicable

## Responsible Disclosure

We support responsible disclosure of security vulnerabilities. Reporters who follow this policy can expect:

- No legal action against them
- Credit for discovering the vulnerability (if desired)
- Recognition in our security hall of fame
- Swag or bounty (if applicable)

## Contact

For security-related questions or concerns:
- Email: security@oxog.dev
- GitHub: [@ersinkoc](https://github.com/ersinkoc)

---

**Last Updated**: December 15, 2025
