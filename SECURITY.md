# Security Policy

## Supported Versions

We release patches for security vulnerabilities. The following versions are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

The EyeDaemon team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.

### How to Report a Security Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Email**: Send an email to [INSERT SECURITY EMAIL]

   - Use a descriptive subject line (e.g., "Security Vulnerability: [Brief Description]")
   - Include detailed information about the vulnerability
   - Provide steps to reproduce if possible

2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature
   - Go to the Security tab in the repository
   - Click "Report a vulnerability"
   - Fill out the advisory form

### What to Include in Your Report

To help us better understand and resolve the issue, please include as much of the following information as possible:

- **Type of vulnerability** (e.g., SQL injection, XSS, authentication bypass)
- **Full paths of source file(s)** related to the vulnerability
- **Location of the affected source code** (tag/branch/commit or direct URL)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact of the vulnerability** and how an attacker might exploit it
- **Any potential mitigations** you've identified

### Response Timeline

- **Initial Response**: Within 48 hours of receiving your report
- **Status Update**: Within 5 business days with an assessment of the report
- **Resolution Timeline**: Varies based on severity and complexity
  - Critical: 7-14 days
  - High: 14-30 days
  - Medium: 30-60 days
  - Low: 60-90 days

### What to Expect

1. **Acknowledgment**: We'll confirm receipt of your vulnerability report
2. **Assessment**: We'll investigate and assess the severity
3. **Updates**: We'll keep you informed of our progress
4. **Resolution**: We'll develop and test a fix
5. **Disclosure**: We'll coordinate disclosure timing with you
6. **Credit**: We'll acknowledge your contribution (if desired)

## Security Best Practices

### For Bot Administrators

When deploying and running EyeDaemon, follow these security best practices:

#### Environment Variables

- **Never commit** `.env` files to version control
- Use strong, unique tokens for all services
- Rotate tokens regularly (at least every 90 days)
- Limit token permissions to only what's necessary

#### Bot Permissions

- Grant only the **minimum required permissions**
- Regularly audit bot permissions in your server
- Use role-based access control for sensitive commands
- Enable 2FA for accounts with bot management access

#### Server Configuration

- Keep Node.js and dependencies **up to date**
- Use a process manager (PM2, systemd) for production
- Implement rate limiting for API endpoints
- Enable logging and monitor for suspicious activity
- Use HTTPS for all web interfaces

#### Database Security

- Use **parameterized queries** to prevent SQL injection
- Implement proper access controls
- Regularly backup your database
- Encrypt sensitive data at rest
- Use secure connection strings

#### Discord-Specific Security

- Validate all user input before processing
- Use ephemeral messages for sensitive information
- Implement proper permission checks for commands
- Rate limit command usage to prevent abuse
- Sanitize user-generated content

### For Contributors

When contributing code to EyeDaemon:

- **Never hardcode** credentials or tokens
- Validate and sanitize all user input
- Use prepared statements for database queries
- Follow secure coding practices
- Review dependencies for known vulnerabilities
- Run security tests before submitting PRs

#### Dependency Security

```bash
# Check for vulnerabilities in dependencies
npm audit

# Fix vulnerabilities automatically (when possible)
npm audit fix

# Update dependencies regularly
npm update
```

## Known Security Considerations

### Discord Bot Token

The Discord bot token provides full access to your bot. If compromised:

1. Immediately regenerate the token in Discord Developer Portal
2. Update your `.env` file with the new token
3. Restart the bot
4. Review bot activity logs for unauthorized actions

### Database Access

The bot uses Turso DB (LibSQL) for data storage. Security measures:

- Authentication tokens are required for database access
- Use environment variables to store credentials securely
- Enable encryption at rest with TURSO_ENCRYPTION_KEY
- Implement proper backup strategies (see docs/TURSO_SETUP.md)
- Rotate authentication tokens regularly
- Use read-only replicas for analytics when possible

### Third-Party APIs

The bot integrates with external services (YouTube, etc.):

- API keys should be kept secure
- Monitor API usage for anomalies
- Implement rate limiting
- Handle API errors gracefully

## Security Updates

Security updates will be released as soon as possible after a vulnerability is confirmed. Updates will be announced via:

- GitHub Security Advisories
- Release notes in CHANGELOG.md
- Discord server announcements (if applicable)

To stay informed:

- Watch the repository for security advisories
- Enable GitHub notifications for releases
- Join our Discord server for announcements

## Vulnerability Disclosure Policy

We follow a **coordinated disclosure** approach:

1. Security issues are fixed privately
2. A security advisory is prepared
3. Fixes are released in a new version
4. The advisory is published after users have time to update
5. Credit is given to the reporter (if desired)

### Disclosure Timeline

- **Day 0**: Vulnerability reported
- **Day 1-2**: Initial assessment and acknowledgment
- **Day 3-14**: Fix development and testing
- **Day 15**: Security release published
- **Day 30**: Full public disclosure (if appropriate)

## Bug Bounty Program

We currently do not have a formal bug bounty program. However, we deeply appreciate security researchers who responsibly disclose vulnerabilities and will:

- Acknowledge your contribution in our security advisories
- Credit you in our CHANGELOG (if desired)
- Provide recognition in our README or documentation

## Contact

For security-related questions or concerns:

- **Security Email**: [INSERT SECURITY EMAIL]
- **General Contact**: [INSERT GENERAL EMAIL]
- **Discord**: [INSERT DISCORD INVITE]

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Discord Developer Documentation](https://discord.com/developers/docs/intro)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)

---

Thank you for helping keep EyeDaemon and its users safe! 🔒
