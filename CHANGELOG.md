# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2025-12-15

### Added
- Comprehensive bug fix report documentation
- Enhanced TypeScript strict mode compatibility

### Fixed
- **CRITICAL**: Fixed TypeScript compilation error in `src/types/index.ts` - Invalid forward class declaration syntax
- Fixed 21+ non-null assertion operators (`!`) throughout the codebase that could cause runtime errors
- Fixed unsafe `any` type usage in event handlers and error callbacks
- Fixed ESLint `prefer-const` violations
- Fixed Prettier formatting violations in multiple files
- Fixed console statement without proper ESLint suppression

### Improved
- Enhanced type safety with proper nullish coalescing (`??`) operators
- Better error handling with explicit type annotations
- Improved code readability and maintainability
- Enhanced compatibility with strict TypeScript configurations

### Security
- No security-related changes in this release

### Testing
- All 277 existing tests continue to pass
- No test coverage changes required

## [1.0.0] - 2025-07-27

### Added
- Initial release of @oxog/mailer
- Zero-dependency SMTP client implementation
- Full TypeScript support with strict typing
- Support for SMTP authentication methods: PLAIN, LOGIN, CRAM-MD5, XOAUTH2
- STARTTLS support for secure connections
- Plugin system with event-driven architecture
- Connection pooling for high-throughput applications
- Comprehensive MIME support with attachments
- Custom encoding implementations (Base64, Quoted-Printable, Header encoding)
- Factory methods for popular email providers (Gmail, Outlook, Yahoo)
- Rate limiting support
- Comprehensive error handling with custom MailerError class
- 100% test coverage with robust test suite
- Event emitter-based architecture

### Features
- **Zero Dependencies**: Everything implemented from scratch using Node.js built-in modules
- **TypeScript First**: Complete TypeScript support with strict mode
- **Modern API**: Clean, Promise-based async/await interface
- **SMTP Compliance**: Full RFC 5321 protocol implementation
- **Security**: Multiple authentication methods and TLS support
- **Extensible**: Plugin system for custom functionality
- **Performance**: Connection pooling and rate limiting

---

## Release Notes

### Version Numbering
We use [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backwards-compatible manner
- **PATCH** version for backwards-compatible bug fixes

### Supported Node.js Versions
- Current release (1.1.x): Node.js 14.0.0 and higher
- Future releases will follow Node.js LTS releases

### Breaking Changes
Major version upgrades may introduce breaking changes. Migration guides will be provided for such releases.

### Contribution
For detailed information about contributing to this project, please see our [Contributing Guidelines](https://github.com/ersinkoc/mailer/blob/main/CONTRIBUTING.md).
