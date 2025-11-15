# Contributing to EyeDaemon

Thank you for your interest in contributing to EyeDaemon! We welcome contributions from the community and are grateful for your support.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Commit Message Conventions](#commit-message-conventions)
- [Code Review Process](#code-review-process)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a new branch for your feature or bugfix
4. Make your changes
5. Test your changes thoroughly
6. Submit a pull request

## Development Environment Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn package manager
- Discord Bot Token (for testing)
- FFmpeg (for audio features)
- yt-dlp (for YouTube downloads)

### Installation Steps

1. Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/eyedaemon.git
cd eyedaemon
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Configure your `.env` file with required tokens and settings:

   - `DISCORD_TOKEN`: Your Discord bot token
   - `CLIENT_ID`: Your Discord application client ID
   - `GUILD_ID`: Your test server ID (for development)
   - Other configuration as needed

5. Run database migrations:

```bash
npm run migrate
```

6. Start the bot in development mode:

```bash
npm run dev
```

### Project Structure

```text
eyedaemon/
├── src/
│   ├── bot/           # Bot core logic
│   └── server/        # Web server (if applicable)
├── tests/
│   ├── unit/          # Unit tests
│   └── integration/   # Integration tests
├── docs/              # Documentation
└── .github/           # GitHub templates
```

## Coding Standards

### JavaScript/Node.js Conventions

- Use **CommonJS** module system (`require`/`module.exports`)
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes
- Use **UPPER_SNAKE_CASE** for constants
- Use **2 spaces** for indentation
- Use **single quotes** for strings (unless template literals are needed)
- Always use semicolons
- Maximum line length: 100 characters

### Code Quality

- Write clean, readable, and maintainable code
- Add comments for complex logic
- Follow DRY (Don't Repeat Yourself) principle
- Use meaningful variable and function names
- Handle errors appropriately
- Avoid deeply nested code

### Discord.js Best Practices

- Use slash commands (interactions) instead of prefix commands
- Implement proper error handling for Discord API calls
- Use ephemeral messages for error responses when appropriate
- Follow Discord's rate limits and best practices
- Cache data appropriately to reduce API calls

### Example Code Style

```javascript
const { SlashCommandBuilder } = require("discord.js");

class ExampleCommand {
  constructor() {
    this.data = new SlashCommandBuilder()
      .setName("example")
      .setDescription("An example command");
  }

  async execute(interaction) {
    try {
      await interaction.reply({
        content: "Hello, World!",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error executing example command:", error);
      await interaction.reply({
        content: "An error occurred while executing this command.",
        ephemeral: true,
      });
    }
  }
}

module.exports = ExampleCommand;
```

## Pull Request Process

### Before Submitting

1. Ensure your code follows the coding standards
2. Run all tests and ensure they pass
3. Update documentation if needed
4. Add or update tests for your changes
5. Update CHANGELOG.md with your changes

### Submitting a Pull Request

1. Push your changes to your fork
2. Create a pull request from your branch to the main repository
3. Fill out the pull request template completely
4. Link any related issues
5. Wait for review and address any feedback

### Pull Request Guidelines

- Keep pull requests focused on a single feature or bugfix
- Write clear, descriptive titles
- Provide detailed descriptions of changes
- Include screenshots for UI changes
- Reference related issues using `#issue_number`
- Ensure CI checks pass

### Pull Request Checklist

- [ ] Code follows the project's coding standards
- [ ] Tests have been added or updated
- [ ] Documentation has been updated
- [ ] CHANGELOG.md has been updated
- [ ] All tests pass locally
- [ ] No merge conflicts with main branch
- [ ] Commit messages follow conventions

## Testing Requirements

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- Write tests for all new features
- Write tests for bug fixes to prevent regressions
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies appropriately
- Aim for high code coverage (>80%)

### Test Structure

```javascript
describe("ExampleCommand", () => {
  let command;

  beforeEach(() => {
    command = new ExampleCommand();
  });

  describe("execute", () => {
    it("should reply with greeting message", async () => {
      // Arrange
      const mockInteraction = createMockInteraction();

      // Act
      await command.execute(mockInteraction);

      // Assert
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: "Hello, World!",
        ephemeral: true,
      });
    });
  });
});
```

## Commit Message Conventions

We follow conventional commit format for clear and consistent commit history.

### Format

```text
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```text
feat(music): add queue shuffle command

Implement shuffle functionality for music queue.
Users can now randomize the order of songs in queue.

Closes #123
```

```text
fix(moderation): resolve ban command permission issue

Fixed bug where users without ban permissions could
execute the ban command.
```

## Code Review Process

### For Contributors

- Be responsive to feedback
- Be open to suggestions and improvements
- Ask questions if feedback is unclear
- Make requested changes promptly
- Be patient during the review process

### Review Timeline

- Initial review: Within 3-5 business days
- Follow-up reviews: Within 2-3 business days
- Urgent fixes: Within 24 hours

### Approval Requirements

- At least one maintainer approval required
- All CI checks must pass
- No unresolved conversations
- Code meets quality standards

## Getting Help

If you need help or have questions:

- Check the [documentation](docs/)
- Read the [FAQ](SUPPORT.md)
- Join our [Discord server](https://discord.gg/your-server)
- Open a [discussion](https://github.com/your-repo/discussions)
- Create an [issue](https://github.com/your-repo/issues)

## License

By contributing to EyeDaemon, you agree that your contributions will be licensed under the ISC License.

---

Thank you for contributing to EyeDaemon! 🎉
