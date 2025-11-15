# Support

Thank you for using EyeDaemon! This document provides information on how to get help and support for the bot.

## Table of Contents

- [Getting Help](#getting-help)
- [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
- [Community Support](#community-support)
- [Bug Reports](#bug-reports)
- [Feature Requests](#feature-requests)
- [Response Time Expectations](#response-time-expectations)
- [Additional Resources](#additional-resources)

## Getting Help

There are several ways to get help with EyeDaemon:

### 1. Documentation

Before asking for help, please check our comprehensive documentation:

- **[README.md](README.md)** - Overview and quick start guide
- **[User Guide](docs/USER_GUIDE.md)** - Detailed usage instructions
- **[Commands Documentation](docs/COMMANDS.md)** - Complete command reference
- **[Setup Guide](SETUP_GUIDE.md)** - Installation and configuration
- **[FAQ](#frequently-asked-questions-faq)** - Common questions and answers

### 2. Discord Community

Join our Discord server for real-time support and community interaction:

- **Discord Server**: [INSERT DISCORD INVITE LINK]
- Get help from community members and moderators
- Share feedback and suggestions
- Report issues and bugs
- Connect with other users

### 3. GitHub Issues

For bug reports and feature requests, use GitHub Issues:

- **Bug Reports**: [Create a bug report](https://github.com/your-repo/issues/new?template=bug_report.md)
- **Feature Requests**: [Request a feature](https://github.com/your-repo/issues/new?template=feature_request.md)
- **Questions**: [Ask a question](https://github.com/your-repo/issues/new?template=question.md)

### 4. GitHub Discussions

For general questions and discussions:

- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- Ask questions
- Share ideas
- Show off your setup
- Help other users

### 5. Email Support

For private inquiries or sensitive issues:

- **General Support**: [INSERT SUPPORT EMAIL]
- **Security Issues**: See [SECURITY.md](SECURITY.md)

## Frequently Asked Questions (FAQ)

### General Questions

#### Q: What is EyeDaemon?

A: EyeDaemon is a feature-rich Discord bot that provides music playback, moderation tools, economy system, leveling, and more for your Discord server.

#### Q: Is EyeDaemon free to use?

A: Yes, EyeDaemon is open-source and free to use. You can self-host it on your own server.

#### Q: What permissions does the bot need?

A: The bot requires the following permissions:

- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Add Reactions
- Connect (for voice)
- Speak (for voice)
- Use Voice Activity
- Manage Messages (for moderation)
- Kick Members (for moderation)
- Ban Members (for moderation)
- Manage Roles (for auto-roles)

### Setup and Installation

#### Q: What are the system requirements?

A: You need:

- Node.js 18.0.0 or higher
- npm or yarn
- FFmpeg (for audio playback)
- yt-dlp (for YouTube downloads)
- At least 512MB RAM
- Stable internet connection

#### Q: How do I install the bot?

A: Follow the [Setup Guide](SETUP_GUIDE.md) for detailed installation instructions.

#### Q: Where do I get a Discord bot token?

A: Create a bot application at [Discord Developer Portal](https://discord.com/developers/applications) and copy the bot token from the Bot section.

#### Q: How do I configure the bot?

A: Copy `.env.example` to `.env` and fill in your configuration values. See the [Setup Guide](SETUP_GUIDE.md) for details.

### Music Commands

#### Q: Why isn't the music playing?

A: Check the following:

- Bot has permission to connect and speak in voice channels
- FFmpeg is installed correctly
- yt-dlp is installed and up to date
- The YouTube URL is valid
- Check bot logs for error messages

#### Q: How do I add songs to the queue?

A: Use the `/play` command with a YouTube URL or search query:

```text
/play query:Never Gonna Give You Up
/play url:https://youtube.com/watch?v=...
```

#### Q: Can I use Spotify links?

A: Currently, only YouTube is supported. Spotify support may be added in future versions.

#### Q: How do I apply audio filters?

A: Use the `/filter` command:

```text
/filter type:bassboost
/filter type:nightcore
/filter type:off
```

### Moderation

#### Q: Who can use moderation commands?

A: Users with appropriate Discord permissions (Kick Members, Ban Members, Manage Messages) can use moderation commands.

#### Q: How do I set up moderation logging?

A: Use the configuration commands to set a logging channel:

```text
/config set key:log_channel value:#mod-logs
```

#### Q: Can I customize the warning system?

A: Yes, you can configure warning thresholds and actions through the configuration system.

### Economy and Leveling

#### Q: How do users earn XP?

A: Users earn XP by:

- Sending messages (with cooldown to prevent spam)
- Using bot commands
- Participating in activities

#### Q: How do I set up role rewards?

A: Use the leveling configuration commands to assign roles for specific levels.

#### Q: Can I reset someone's balance or level?

A: Yes, administrators can use admin commands to modify user data.

### Troubleshooting

#### Q: The bot is offline. What should I do?

A: Check:

- Bot process is running
- Internet connection is stable
- Discord token is valid
- No rate limiting or API issues
- Check logs for errors

#### Q: Commands aren't working. Why?

A: Verify:

- Commands are registered (use `/help` to check)
- Bot has necessary permissions
- You're using slash commands (not prefix commands)
- Command syntax is correct

#### Q: How do I view bot logs?

A: Logs are stored in the `logs/` directory. Use:

```bash
npm run logs
```

#### Q: The bot crashed. How do I restart it?

A: Use your process manager or run:

```bash
npm start
```

For production, consider using PM2 or systemd for automatic restarts.

## Community Support

### Discord Server

Our Discord server is the best place for:

- **Real-time help** from community members
- **Feature discussions** and suggestions
- **Sharing experiences** and configurations
- **Announcements** about updates and changes
- **Community events** and activities

**Join here**: [INSERT DISCORD INVITE LINK]

### Community Guidelines

When seeking help in the community:

- Be respectful and patient
- Provide relevant information (error messages, logs, configuration)
- Search for existing answers before asking
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)
- Help others when you can

## Bug Reports

Found a bug? Please report it!

### Before Reporting

1. Check if the issue already exists in [GitHub Issues](https://github.com/your-repo/issues)
2. Verify you're using the latest version
3. Try to reproduce the issue
4. Gather relevant information (logs, error messages, steps to reproduce)

### How to Report

Use our [bug report template](https://github.com/your-repo/issues/new?template=bug_report.md) and include:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment information (OS, Node.js version, etc.)
- Error messages and logs
- Screenshots if applicable

## Feature Requests

Have an idea for a new feature?

### Before Requesting

1. Check if the feature already exists or is planned
2. Search existing feature requests
3. Consider if it fits the bot's scope and purpose

### How to Request

Use our [feature request template](https://github.com/your-repo/issues/new?template=feature_request.md) and include:

- Clear description of the feature
- Use case and benefits
- Possible implementation approach
- Alternative solutions considered

## Response Time Expectations

We strive to respond to all support requests in a timely manner:

| Channel             | Response Time     |
| ------------------- | ----------------- |
| Discord (Community) | Minutes to hours  |
| GitHub Issues       | 1-3 business days |
| GitHub Discussions  | 1-3 business days |
| Email               | 3-5 business days |
| Security Issues     | 24-48 hours       |

**Note**: Response times may vary based on:

- Complexity of the issue
- Availability of maintainers
- Time zones and holidays
- Volume of requests

### Priority Levels

- **Critical** (bot down, security issues): 24-48 hours
- **High** (major bugs, broken features): 2-5 business days
- **Medium** (minor bugs, improvements): 1-2 weeks
- **Low** (enhancements, questions): 2-4 weeks

## Additional Resources

### Documentation

- [README.md](README.md) - Project overview
- [User Guide](docs/USER_GUIDE.md) - Comprehensive usage guide
- [API Documentation](docs/API.md) - API reference
- [Architecture](docs/ARCHITECTURE.md) - Technical architecture
- [Contributing Guide](CONTRIBUTING.md) - How to contribute

### External Resources

- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Node.js Documentation](https://nodejs.org/docs/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

### Useful Links

- **GitHub Repository**: [INSERT REPO URL]
- **Issue Tracker**: [INSERT ISSUES URL]
- **Discussions**: [INSERT DISCUSSIONS URL]
- **Discord Server**: [INSERT DISCORD INVITE]
- **Website**: [INSERT WEBSITE URL] (if applicable)

## Contributing

Want to help improve EyeDaemon? Check out our [Contributing Guide](CONTRIBUTING.md) to learn how you can:

- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation
- Help other users

## Contact

For any questions or concerns not covered here:

- **General Support**: [INSERT SUPPORT EMAIL]
- **Security Issues**: [INSERT SECURITY EMAIL]
- **Discord**: [INSERT DISCORD INVITE]
- **GitHub**: [INSERT REPO URL]

---

Thank you for using EyeDaemon! We're here to help. 💙
