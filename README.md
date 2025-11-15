# EyeDaemon Discord Bot

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Discord.js](https://img.shields.io/badge/discord.js-v14.24.2-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

**English** | **[Bahasa Indonesia](README.id.md)**

</div>

**EyeDaemon** is a powerful, feature-rich Discord bot that brings premium server management and entertainment features to your Discord server—completely free! Built with modern technologies (Discord.js v14 and Node.js), EyeDaemon combines music streaming, moderation tools, economy systems, leveling, and much more into one comprehensive solution.

> 🎵 **Multi-platform music** • 🔨 **Advanced moderation** • 💰 **Economy & games** • 📈 **Leveling system** • 🎫 **Ticket support** • 📝 **Comprehensive logging**

---

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Configuration](#️-configuration)
- [Architecture](#️-architecture)
- [Commands](#-commands)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

---

## ✨ Why Choose EyeDaemon?

- **🎯 All-in-One Solution** - Everything you need in a single bot
- **🆓 Completely Free** - Premium features without the premium price
- **🏗️ Modern Architecture** - Built with CodeIgniter-inspired MVC pattern for maintainability
- **🔧 Highly Configurable** - Feature flags and extensive customization options
- **📚 Well Documented** - Comprehensive documentation and guides
- **🚀 Active Development** - Regular updates and improvements
- **🤝 Open Source** - Transparent, community-driven development

## 🌟 Features

### 🎵 Music System

- **Multi-platform Support**: Play from YouTube, Spotify, and SoundCloud with automatic platform detection
- **Advanced Queue Management**: Add, remove, move, shuffle, and loop tracks with persistent queue storage
- **Audio Effects**: Real-time FFmpeg filters including bassboost, nightcore, vaporwave, 8D, and karaoke
- **Playlist Support**: Create, save, and load personal or public playlists (max 50 tracks per playlist)
- **Volume Control**: Precise volume adjustment (0-200%) with per-guild persistence
- **Interactive Controls**: Button-based playback controls for easy music management
- **Queue Persistence**: Automatic queue saving and restoration across bot restarts
- **Smart Reconnection**: Automatic voice connection recovery with playback resumption
- **Seek Functionality**: Jump to any position in the current track
- **Metadata Caching**: LRU cache for fast track info retrieval with 10-minute TTL

### 🔨 Moderation Tools

- **User Management**: Kick, ban, mute, timeout with custom durations
- **Warning System**: Track warnings with auto-actions at thresholds
- **Auto-moderation**: Spam detection, word filters, anti-link protection
- **Role Management**: Auto-roles, reaction roles, custom role assignments
- **Server Protection**: Anti-raid, verification systems

### 💰 Economy System

- **Currency Management**: Server currency with balance tracking
- **Gambling Games**: Slots, coinflip, blackjack, roulette
- **Virtual Shop**: Buy roles, colors, badges, and custom items
- **Daily Rewards**: Claim daily bonuses with streak tracking
- **Work System**: Earn currency through various jobs

### 📈 Leveling & XP

- **Automatic XP**: Gain XP from chatting and voice activity
- **Level Rewards**: Unlock roles, channels, and special benefits
- **Leaderboards**: Server-wide rankings and statistics
- **Custom Progression**: Configurable XP rates and level requirements
- **Achievement System**: Unlock badges and special rewards

### 🎫 Ticket System

- **Support Tickets**: Create tickets with categories and priorities
- **Staff Assignment**: Automatic staff assignment based on category
- **Thread Integration**: Modern thread-based ticket system
- **Custom Workflows**: Configurable ticket workflows and automation

### 📝 Logging & Analytics

- **Comprehensive Logging**: Message edits/deletes, member events, moderation
- **Server Analytics**: Growth tracking, activity metrics, engagement stats
- **Audit Trail**: Complete audit trail for all server activities
- **Custom Dashboards**: View server statistics and trends

## 📸 Screenshots & Demo

### Bot in Action

<div align="center">

<!-- Add your screenshots here -->
<!-- Example: ![Bot Interface](docs/images/bot-interface.png) -->
<!-- Example: ![Music Player](docs/images/music-player.png) -->

</div>

### Demo

<!-- Add demo GIF or video here -->
<!-- Example: ![Demo](docs/images/demo.gif) -->

> **Note**: Screenshots and demo GIFs will be added soon. In the meantime, check out the [Commands Reference](docs/COMMANDS.md) to see what EyeDaemon can do!

## 🚀 Quick Start

Get EyeDaemon up and running in minutes!

### Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org/))
- **Discord Bot Token** ([Create a bot](https://discord.com/developers/applications))
- **Turso DB Account** ([Sign up for free](https://turso.tech/))
- **Git** for cloning the repository
- Basic knowledge of Discord.js (optional but helpful)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/imamrasyid/EyeDaemon.git
   cd eyedaemon
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Setup Turso DB**

   Create a Turso database:

   ```bash
   # Install Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash

   # Create a database
   turso db create eyedaemon-bot

   # Get database URL
   turso db show eyedaemon-bot --url

   # Create auth token
   turso db tokens create eyedaemon-bot
   ```

   For detailed setup instructions, see **[Turso DB Setup Guide](docs/TURSO_SETUP.md)**.

4. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:

   ```env
   # Discord Configuration
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here

   # Turso DB Configuration
   TURSO_DATABASE_URL=libsql://your-database-name.turso.io
   TURSO_AUTH_TOKEN=your_turso_auth_token_here
   ```

5. **Run database migrations**

   ```bash
   npm run migrate
   ```

6. **Start the bot**

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

🎉 **That's it!** Your bot should now be online and ready to use.

For detailed setup instructions, see the **[Setup Guide](SETUP_GUIDE.md)** or **[Quick Start Guide](docs/QUICK_START.md)**.

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Required - Discord Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# Required - Turso DB Configuration
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token_here

# Optional (with defaults)
DISCORD_PREFIX=!
FEATURE_MUSIC=true
FEATURE_MODERATION=true
FEATURE_ECONOMY=true
FEATURE_LEVELING=true
```

### Turso DB Configuration

EyeDaemon uses **Turso DB**, a distributed SQLite database with edge deployment capabilities. Turso provides:

- **🌍 Global Distribution**: Edge replicas for low-latency access worldwide
- **📈 Scalability**: Handles thousands of concurrent connections
- **💾 SQLite Compatibility**: Familiar SQL syntax with LibSQL enhancements
- **🔒 Security**: Built-in authentication and encryption
- **🆓 Free Tier**: Generous free tier perfect for getting started

**Setup Steps:**

1. Sign up for a free account at [turso.tech](https://turso.tech/)
2. Create a database using the Turso CLI or dashboard
3. Get your database URL and authentication token
4. Add credentials to your `.env` file

For detailed instructions, see **[Turso DB Setup Guide](docs/TURSO_SETUP.md)**.

### Feature Flags

Enable/disable features by setting these environment variables:

- `FEATURE_MUSIC=true/false`
- `FEATURE_MODERATION=true/false`
- `FEATURE_ECONOMY=true/false`
- `FEATURE_LEVELING=true/false`
- `FEATURE_TICKETS=true/false`
- `FEATURE_LOGGING=true/false`

## 🏗️ Architecture

### CodeIgniter-Inspired MVC Architecture

The bot follows a CodeIgniter-inspired MVC architecture with clear separation between framework code (system layer) and business logic (application layer):

```text
src/bot/
├── system/              # Framework layer (core classes, libraries, helpers)
│   ├── core/           # Base classes (Loader, Controller, Model)
│   ├── libraries/      # Reusable components (VoiceManager, AudioPlayer)
│   └── helpers/        # Utility functions (format, validation)
│
├── application/        # Business logic layer
│   ├── controllers/    # Command handlers (MusicController, EconomyController)
│   ├── models/         # Data operations (MusicModel, EconomyModel)
│   ├── modules/        # Module definitions (music, economy, leveling)
│   └── config/         # Configuration files
│
└── bootstrap.js        # Entry point and initialization
```

### Key Features

- **MVC Pattern**: Controllers handle commands, Models handle data
- **Loader Pattern**: Automatic dependency loading and caching
- **Clear Separation**: Framework code vs business logic
- **Easy to Extend**: Add new features without modifying core
- **Consistent Patterns**: Same approach across all modules

### Core Components

#### System Layer (Framework)

- **Loader**: Dynamic loading of models, libraries, and helpers
- **Controller**: Base class for all command handlers
- **Model**: Base class for all data operations
- **Libraries**: Reusable components (VoiceManager, AudioPlayer, QueueManager)
- **Helpers**: Utility functions (format, validation, logger)

#### Application Layer (Business Logic)

- **Controllers**: Handle Discord commands and interactions
- **Models**: Encapsulate data operations and business logic
- **Modules**: Define features and command mappings
- **Config**: Application configuration and settings

### Documentation

For detailed architecture information and migration guides:

- **[Architecture Documentation](docs/ARCHITECTURE.md)** - Complete architecture overview
- **[Migration Guide](docs/CODEIGNITER_MIGRATION_GUIDE.md)** - Guide for understanding the new structure
- **[API Documentation](docs/API.md)** - API reference and usage examples

## 🎵 Music System Details

### Architecture

The music system uses a unified client-server architecture:

- **Audio Server** (`src/server`): yt-dlp-based streaming server with FFmpeg filter support
- **Audio Service** (`src/bot/services/audio.service.js`): HTTP client with metadata caching and retry logic
- **Player Service** (`src/bot/services/player.service.js`): Queue management, playback control, and voice connection handling
- **Playlist Service** (`src/bot/services/playlist.service.js`): Playlist CRUD operations and track management

### Supported Platforms

- **YouTube**: Full video and playlist support with search integration
- **Spotify**: Track and playlist support (automatically converted to YouTube for streaming)
- **SoundCloud**: Track and playlist support
- **Direct URLs**: MP3, AAC, and other audio formats via HTTP streaming

### Audio Features

- **Volume Control**: 0-200% range with real-time adjustment and per-guild persistence
- **Audio Filters**: Server-side FFmpeg filters (bassboost, nightcore, vaporwave, 8D, karaoke)
- **Queue Management**: Add, remove, move, shuffle, clear with 100-track limit per guild
- **Loop Modes**: Off, track repeat, queue repeat with database persistence
- **Seek Functionality**: Jump to any position in current track with millisecond precision
- **Playlist Support**: Create, save, load, and share playlists (max 50 tracks, 10 playlists per user)
- **Search Integration**: Natural language search across all supported platforms
- **Metadata Caching**: LRU cache with 10-minute TTL and automatic cleanup
- **Queue Persistence**: Automatic saving and restoration of queue state across restarts
- **Smart Reconnection**: Automatic voice connection recovery with exponential backoff
- **Interactive Controls**: Button-based UI for play/pause, skip, stop, loop, and volume
- **Progress Tracking**: Real-time progress bars and elapsed time display
- **Idle Timeout**: Dynamic timeout (5-10 minutes) based on track length

### Performance Optimizations

- **Metadata Caching**: LRU cache (max 50 entries) reduces API calls by ~70%
- **Retry Logic**: Exponential backoff with max 3 retries for transient errors
- **Connection Pooling**: Reuse voice connections to minimize latency
- **Batch Processing**: Efficient playlist loading with progress feedback
- **Resource Cleanup**: Automatic cleanup of idle connections and expired cache entries

## 🔨 Moderation Features

### User Management

- **Kick**: Remove users with reason logging
- **Ban**: Permanent bans with appeal system
- **Mute**: Temporary voice/text restrictions
- **Timeout**: Discord-native timeout support
- **Warn**: Warning system with escalation

### Auto-Moderation

- **Spam Detection**: Message flooding protection
- **Word Filters**: Custom word/phrase blocking
- **Link Filtering**: Block suspicious/NSFW links
- **Caps Lock**: Excessive caps detection
- **Emoji Spam**: Excessive emoji detection

## 💰 Economy System

### Currency Features

- **Starting Balance**: Configurable starting amount
- **Daily Rewards**: Daily claim system with streaks
- **Work System**: Multiple job types with different rewards
- **Transfer System**: User-to-user transfers with tax
- **Bank System**: Secure storage with interest

### Games

- **Slots**: Casino-style slot machine
- **Coinflip**: 50/50 chance game
- **Blackjack**: Classic card game
- **Roulette**: Number/color betting
- **Lottery**: Server-wide jackpot system

## 📈 Leveling System

### XP Sources

- **Text Messages**: XP for active chatting
- **Voice Activity**: XP for time in voice channels
- **Command Usage**: Bonus XP for using commands
- **Server Events**: XP for participating in events

### Level Rewards

- **Role Rewards**: Unlock roles at specific levels
- **Channel Access**: Access to exclusive channels
- **Command Unlock**: Unlock special commands
- **Currency Bonus**: Bonus economy currency
- **Custom Rewards**: Server-specific rewards

## 🔧 Commands

### Music Commands

- `!play <song/url>` - Play music from various sources
- `!skip` - Skip current track
- `!stop` - Stop playback and clear queue
- `!queue` - Show current queue
- `!nowplaying` - Show current track info
- `!volume <0-100>` - Adjust volume
- `!loop` - Toggle loop modes
- `!shuffle` - Shuffle queue

### Moderation Commands

- `!kick <user> [reason]` - Kick user from server
- `!ban <user> [reason]` - Ban user from server
- `!mute <user> <duration>` - Mute user
- `!warn <user> <reason>` - Give warning to user
- `!clear <amount>` - Clear messages
- `!slowmode <seconds>` - Set slowmode

### Economy Commands

- `!balance [user]` - Check balance
- `!daily` - Claim daily reward
- `!work` - Work for currency
- `!transfer <user> <amount>` - Transfer currency
- `!slots <amount>` - Play slots
- `!coinflip <amount> <heads/tails>` - Coinflip game
- `!shop` - View shop items
- `!buy <item>` - Buy item from shop

### Leveling Commands

- `!rank [user]` - Check level and XP
- `!leaderboard [type]` - View leaderboards
- `!givexp <user> <amount>` - Give XP (admin)
- `!resetxp <user>` - Reset user XP (admin)

## 📊 Statistics

The bot tracks comprehensive statistics:

- Command usage statistics
- User activity metrics
- Server growth tracking
- Error rates and performance
- Feature usage analytics

View statistics with:

```bash
npm run stats
```

## 🔒 Security

### Permission System

- **Granular Permissions**: Fine-grained permission control
- **Role-based Access**: Permission inheritance from roles
- **User-specific Permissions**: Override role permissions
- **Guild-specific Settings**: Per-server configuration

### Rate Limiting

- **Command Cooldowns**: Prevent spam with configurable cooldowns
- **Burst Protection**: Protect against rapid command usage
- **Global Limits**: Server-wide rate limiting
- **User-specific Limits**: Individual user rate limiting

### Data Protection

- **Secure Storage**: Encrypted sensitive data storage
- **Audit Logging**: Complete audit trail for all actions
- **Data Sanitization**: Input validation and sanitization
- **Privacy Controls**: User data management tools

## 🛠️ Development

### Adding New Features

The bot uses a CodeIgniter-inspired MVC architecture. To add new features:

#### 1. Create a Model (Data Layer)

```javascript
// application/models/MyModel.js
const Model = require("../../system/core/Model");

class MyModel extends Model {
  constructor(instance) {
    super(instance);
  }

  async getData(id) {
    return await this.db.get("SELECT * FROM table WHERE id = ?", [id]);
  }
}

module.exports = MyModel;
```

#### 2. Create a Controller (Command Handler)

```javascript
// application/controllers/MyController.js
const Controller = require("../../system/core/Controller");

class MyController extends Controller {
  constructor(client) {
    super(client);

    // Load dependencies
    this.myModel = this.load.model("MyModel");
    this.load.helper("format");
  }

  async myCommand(interaction) {
    try {
      await interaction.deferReply();
      const data = await this.myModel.getData(interaction.user.id);
      await interaction.editReply({ content: `✅ ${data}` });
    } catch (error) {
      await interaction.editReply({ content: `❌ ${error.message}` });
    }
  }
}

module.exports = MyController;
```

#### 3. Create a Module Definition

```javascript
// application/modules/mymodule/index.js
module.exports = {
  name: "MyModule",
  description: "My module description",
  controllers: ["MyController"],
  models: ["MyModel"],
  commands: [
    {
      name: "mycommand",
      description: "My command description",
      controller: "MyController",
      method: "myCommand",
      options: [],
    },
  ],
};
```

#### 4. Register the Module

Add your module to the bootstrap loading list in `bootstrap.js`.

For detailed development guides, see:

- **[Architecture Documentation](docs/ARCHITECTURE.md)** - Complete architecture guide
- **[Migration Guide](docs/CODEIGNITER_MIGRATION_GUIDE.md)** - Detailed examples and patterns

### Database Schema

The bot uses a comprehensive database schema with tables for:

- Guilds and member information
- Economy and leveling data
- Music playlists and queue history
- Moderation logs and warnings
- User settings and preferences
- Server configuration and permissions

## 📚 Documentation

Comprehensive documentation is available to help you understand and extend EyeDaemon:

- **[Architecture Documentation](docs/ARCHITECTURE.md)** - Complete architecture overview and design patterns
- **[Detailed Architecture](docs/ARCHITECTURE_DETAILED.md)** - In-depth technical documentation
- **[API Documentation](docs/API.md)** - API reference and usage examples
- **[User Guide](docs/USER_GUIDE.md)** - Complete user guide for all features
- **[Commands Reference](docs/COMMANDS.md)** - Detailed command documentation
- **[Quick Start Guide](docs/QUICK_START.md)** - Get started quickly
- **[Migration Guide](docs/CODEIGNITER_MIGRATION_GUIDE.md)** - Guide for understanding the MVC architecture
- **[Setup Guide](SETUP_GUIDE.md)** - Detailed setup instructions
- **[Migration Guide](MIGRATION_GUIDE.md)** - Migration instructions for updates

### Implementation Guides

- **[Audio Filters Implementation](docs/implementation/AUDIO_FILTERS_IMPLEMENTATION.md)** - Audio filter system details
- **[Error Recovery Implementation](docs/implementation/ERROR_RECOVERY_IMPLEMENTATION.md)** - Error handling and recovery
- **[yt-dlp Optimization](docs/implementation/YTDLP_OPTIMIZATION.md)** - Music system optimizations

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### How to Contribute

1. Read our **[Contributing Guidelines](CONTRIBUTING.md)** for detailed instructions
2. Check our **[Code of Conduct](CODE_OF_CONDUCT.md)** to understand community standards
3. Fork the repository and create a feature branch
4. Make your changes following our coding standards
5. Add tests if applicable
6. Submit a pull request using our **[PR template](.github/PULL_REQUEST_TEMPLATE.md)**

### Reporting Issues

Found a bug or have a feature request? Please use our issue templates:

- **[Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)** - Report bugs and issues
- **[Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)** - Suggest new features
- **[Question](.github/ISSUE_TEMPLATE/question.md)** - Ask questions about the bot

### Code Style

- Use consistent indentation (2 spaces)
- Follow existing naming conventions
- Add JSDoc comments for public methods
- Keep functions focused and small
- Handle errors gracefully

For more details, see our **[Contributing Guidelines](CONTRIBUTING.md)**.

## 📄 License

This project is licensed under the **ISC License**. See the [LICENSE](LICENSE) file for details.

### Legal & Policies

- **[Privacy Policy](PRIVACY_POLICY.md)** - How we handle your data
- **[Terms of Service](TERMS_OF_SERVICE.md)** - Terms and conditions of use
- **[Security Policy](SECURITY.md)** - Security guidelines and vulnerability reporting

## 🙏 Acknowledgments

- Discord.js team for the excellent library
- Discord API team for the robust platform
- Open source community for various dependencies
- All our contributors and testers

## 📞 Support

Need help? We're here for you!

- **[Support Guide](SUPPORT.md)** - Get help and find answers to common questions
- **[Documentation](docs/)** - Browse our comprehensive documentation
- **[Issue Tracker](https://github.com/imamrasyid/EyeDaemon/issues)** - Report bugs or request features
- **[Discussions](https://github.com/imamrasyid/EyeDaemon/discussions)** - Join community discussions

For security vulnerabilities, please see our **[Security Policy](SECURITY.md)**.

---

<div align="center">

Made with ❤️ by the EyeDaemon Team

[Documentation](docs/) • [Contributing](CONTRIBUTING.md) • [Support](SUPPORT.md) • [Changelog](CHANGELOG.md)

</div>
