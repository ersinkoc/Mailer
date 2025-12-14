# Contributing to @oxog/mailer

Thank you for your interest in contributing to @oxog/mailer! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submission Guidelines](#submission-guidelines)
- [Coding Standards](#coding-standards)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## Getting Started

### What We're Looking For

We welcome contributions in the following areas:
- 🐛 Bug fixes
- ✨ New features
- 📚 Documentation improvements
- 🔧 Test coverage improvements
- ⚡ Performance optimizations
- 🎨 Code quality improvements

### Before You Start

- Check existing [issues](https://github.com/ersinkoc/mailer/issues) and [discussions](https://github.com/ersinkoc/mailer/discussions)
- For major changes, open a discussion first
- Zero-dependency policy must be maintained

## Development Setup

### Prerequisites

- Node.js 14.0.0 or higher
- npm 6.0.0 or higher
- Git

### Clone & Install

```bash
# Clone the repository
git clone https://github.com/ersinkoc/mailer.git
cd mailer

# Install dependencies
npm install

# Verify setup
npm test
```

### Available Scripts

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Build package
npm run build

# Serve website locally
npm run serve:website
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `bugfix/description-of-bug`
- `feature/description-of-feature`
- `docs/update-readme`
- `refactor/improvement-area`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting changes
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add support for OAuth2 refresh tokens
fix(types): resolve forward class declaration error
docs(readme): update installation instructions
test(smtp): add connection timeout test cases
```

## Testing

### Test Requirements

- All tests must pass
- Maintain or improve test coverage
- Add tests for new features
- Update tests for bug fixes

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- SMTPClient.test.ts

# Run with coverage
npm run test:coverage

# Watch mode during development
npm run test:watch
```

### Writing Tests

- Use Jest testing framework
- Follow existing test patterns
- Include both positive and negative test cases
- Mock external dependencies
- Keep tests isolated and independent

Example test structure:
```typescript
describe('FeatureName', () => {
  describe('when condition', () => {
    it('should do something', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Submission Guidelines

### Before Submitting

1. **Run all checks**:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

2. **Update documentation** if needed

3. **Add tests** for new functionality

4. **Update CHANGELOG.md** if it's a user-facing change

### Pull Request Process

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Pull Request Template

Fill out the PR template completely:
- Clear description of changes
- Link to related issues
- Testing instructions
- Checklist items checked

## Coding Standards

### TypeScript

- Use strict TypeScript mode
- Avoid `any` types
- Use proper type annotations
- Enable strict null checks
- Use readonly where appropriate

### Code Style

- Use Prettier for formatting (configured in `.prettierrc.json`)
- Follow ESLint rules (configured in `.eslintrc.js`)
- Use meaningful variable and function names
- Keep functions small and focused
- Write self-documenting code

### Zero-Dependency Policy

**IMPORTANT**: This project maintains a strict zero-dependency policy for production code.

- Production code can only use Node.js built-in modules
- Dev dependencies are allowed for development, testing, and building
- If you need a feature, implement it using Node.js built-ins
- Exception: External dependencies require maintainer approval

### Security

- Sanitize all inputs
- Validate all data
- Use secure defaults
- Never log sensitive information
- Follow OWASP guidelines

### Performance

- Avoid unnecessary allocations
- Use appropriate data structures
- Consider memory usage
- Optimize hot paths
- Measure before optimizing

## Documentation

### What to Document

- Public APIs (classes, methods, interfaces)
- Complex algorithms
- Security considerations
- Configuration options
- Breaking changes

### Documentation Standards

- Use JSDoc for inline documentation
- Keep README.md updated
- Document all public exports
- Include usage examples
- Update CHANGELOG.md

### Example Documentation

```typescript
/**
 * Sends an email message via SMTP
 *
 * @param message - The email message to send
 * @returns Promise resolving to send result
 * @throws {MailerError} When sending fails
 *
 * @example
 * ```typescript
 * await mailer.send({
 *   from: 'sender@example.com',
 *   to: 'recipient@example.com',
 *   subject: 'Hello',
 *   text: 'Email body'
 * });
 * ```
 */
public async send(message: Message): Promise<SendResult>
```

## Common Questions

### Q: Can I add a new dependency?
**A**: No. This project maintains a zero-dependency policy for production code. Use Node.js built-in modules only.

### Q: How do I handle edge cases?
**A**: Add tests for edge cases and document them in JSDoc comments.

### Q: What if my change is large?
**A**: Break it into smaller PRs. Discuss major changes in GitHub Discussions first.

### Q: How do I report a bug?
**A**: Use the bug report template in GitHub Issues.

### Q: How do I request a feature?
**A**: Use the feature request template in GitHub Issues.

## Recognition

Contributors will be recognized in:
- README.md contributors section
- CHANGELOG.md for significant contributions
- GitHub contributors page

## Getting Help

- 📖 [Documentation](https://mailer.oxog.dev)
- 💬 [GitHub Discussions](https://github.com/ersinkoc/mailer/discussions)
- 🐛 [Report a Bug](https://github.com/ersinkoc/mailer/issues/new?template=bug_report.yml)
- ✨ [Request a Feature](https://github.com/ersinkoc/mailer/issues/new?template=feature_request.yml)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to @oxog/mailer! 🚀
