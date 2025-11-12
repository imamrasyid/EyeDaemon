# EyeDaemon Discord Bot

A feature-rich, all-in-one Discord bot designed to provide a complete server management and entertainment experience. Built with Discord.js v14 and Node.js, EyeDaemon offers premium-quality features for free.

## 🌟 Features

### 🎵 Music System

- **Multi-platform Support**: Play from YouTube, Spotify, SoundCloud
- **Advanced Queue Management**: Add, remove, shuffle, loop tracks
- **Audio Effects**: Bass boost, nightcore, karaoke mode
- **Playlist Support**: Create and manage personal/server playlists
- **Volume Control**: Precise volume adjustment with audio filters

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

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- Discord Bot Token
- Basic knowledge of Discord.js

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

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your bot token and settings
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

### Development Mode

```bash
npm run dev
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Required
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# Optional (with defaults)
DISCORD_PREFIX=!
DATABASE_TYPE=sqlite
FEATURE_MUSIC=true
FEATURE_MODERATION=true
FEATURE_ECONOMY=true
FEATURE_LEVELING=true
```

### Feature Flags

Enable/disable features by setting these environment variables:

- `FEATURE_MUSIC=true/false`
- `FEATURE_MODERATION=true/false`
- `FEATURE_ECONOMY=true/false`
- `FEATURE_LEVELING=true/false`
- `FEATURE_TICKETS=true/false`
- `FEATURE_LOGGING=true/false`

## 🏗️ Architecture

### Modular Design

The bot follows a modular architecture with clear separation of concerns:

```
src/bot/
├── base/              # Base classes for commands, events, modules
├── commands/          # Command implementations
├── events/            # Event handlers
├── interactions/      # Button, select menu, modal handlers
├── managers/          # Core managers (events, commands, permissions, etc.)
├── modules/           # Feature modules (music, economy, etc.)
├── services/          # Core services (database, logging, etc.)
└── utils/             # Utility functions
```

### Core Components

#### Base Classes

- **BaseCommand**: Foundation for all commands with validation, permissions, and error handling
- **BaseEvent**: Base for all event handlers with error handling and statistics
- **BaseInteraction**: Base for all interactions (buttons, select menus, modals)
- **BaseModule**: Modular system foundation with lifecycle management

#### Managers

- **EventManager**: Handles all Discord events with error handling and statistics
- **CommandHandler**: Processes commands with cooldowns and validation
- **InteractionHandler**: Manages all interactions with proper error handling
- **PermissionManager**: Granular permission system with role-based access
- **RateLimiter**: Advanced rate limiting with burst protection

#### Services

- **DatabaseService**: SQLite/PostgreSQL support with connection pooling
- **LoggingService**: Comprehensive logging with pino and structured data
- **AudioService**: Advanced audio processing with multiple source support

## 🎵 Music System Details

### Supported Platforms

- **YouTube**: Full playlist and video support
- **Spotify**: Track and playlist support (requires API key)
- **SoundCloud**: Track and playlist support
- **Direct URLs**: MP3, AAC, and other audio formats

### Audio Features

- **Volume Control**: 0-100% with smooth transitions
- **Audio Filters**: Bass boost, nightcore, vaporwave, karaoke
- **Queue Management**: Add, remove, move, shuffle, loop
- **Playlist Support**: Save, load, and share playlists
- **Search Integration**: Search across all platforms

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

### Adding New Commands

1. Create command file in appropriate category:

```javascript
const { BaseCommand } = require("../../base/BaseCommand");

class MyCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: "mycommand",
      description: "My command description",
      category: "Utility",
      usage: "<argument>",
    });
  }

  async execute(message, args) {
    // Command logic here
  }
}

module.exports = MyCommand;
```

2. The command will be automatically loaded by the CommandHandler.

### Adding New Modules

1. Create module file in `src/bot/modules/`:

```javascript
const { BaseModule } = require("../base/BaseModule");

class MyModule extends BaseModule {
  constructor(client) {
    super(client, {
      name: "MyModule",
      description: "My module description",
      version: "1.0.0",
    });
  }

  async initializeServices() {
    // Initialize module services
  }

  async registerCommands() {
    // Register module commands
  }
}

module.exports = MyModule;
```

2. The module will be automatically loaded on startup.

### Database Schema

The bot uses a comprehensive database schema with tables for:

- Guilds and member information
- Economy and leveling data
- Music playlists and queue history
- Moderation logs and warnings
- User settings and preferences
- Server configuration and permissions

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- Use consistent indentation (2 spaces)
- Follow existing naming conventions
- Add JSDoc comments for public methods
- Keep functions focused and small
- Handle errors gracefully

## 🐛 Bug Reports

Please report bugs using the GitHub issue tracker. Include:

- Bot version
- Node.js version
- Error messages and stack traces
- Steps to reproduce
- Expected vs actual behavior

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Discord.js team for the excellent library
- Discord API team for the robust platform
- Open source community for various dependencies
- Contributors and testers

## 📞 Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Review the FAQ
- Join our Discord server (if available)

---

**Made with ❤️ by the EyeDaemon Team**
