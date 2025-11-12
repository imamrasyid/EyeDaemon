# 🚀 EyeDaemon Bot Setup Guide

## Quick Start (5 minutes)

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your bot token
nano .env  # or use your favorite editor
```

**Required Configuration:**
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Bot
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

## 🎯 Bot Features Overview

### ✅ Implemented Features
- **Core Architecture**: Modular system with base classes
- **Event Management**: Complete event handling system
- **Command System**: Modular command processing with validation
- **Interaction System**: Button, select menu, and modal handlers
- **Permission System**: Granular permission management
- **Rate Limiting**: Advanced cooldown and spam protection
- **Database System**: SQLite with full schema and migrations
- **Logging System**: Comprehensive logging with pino
- **Music Module**: Basic music playback framework
- **Moderation Module**: Auto-moderation and user management
- **Configuration System**: Environment-based configuration

### 🚧 Ready for Extension
- **Economy Module**: Currency system framework
- **Leveling Module**: XP and level tracking framework
- **Advanced Music**: Full YouTube/Spotify integration
- **Advanced Games**: Casino and mini-games
- **Dashboard Integration**: Web interface ready

## 📋 Configuration Options

### Feature Flags
Enable/disable features in `.env`:
```env
FEATURE_MUSIC=true
FEATURE_MODERATION=true
FEATURE_ECONOMY=true
FEATURE_LEVELING=true
FEATURE_TICKETS=true
FEATURE_LOGGING=true
```

### Rate Limiting
```env
RATE_LIMIT_DEFAULT=3000      # 3 seconds default cooldown
RATE_LIMIT_PREMIUM=1000      # 1 second for premium users
RATE_LIMIT_BURST=5           # Max 5 commands in burst
```

### Economy Settings
```env
ECONOMY_STARTING_BALANCE=1000
ECONOMY_DAILY_REWARD=500
ECONOMY_WORK_MIN=100
ECONOMY_WORK_MAX=500
ECONOMY_TRANSFER_TAX=0.05    # 5% tax on transfers
```

### Leveling Settings
```env
LEVELING_XP_MESSAGE_MIN=5
LEVELING_XP_MESSAGE_MAX=15
LEVELING_XP_VOICE=1          # XP per minute in voice
LEVELING_BASE=100            # Base XP for level 1
LEVELING_MULTIPLIER=1.5      # XP multiplier per level
```

## 🎵 Music System Setup

The music system is ready for integration with:
- YouTube API
- Spotify API  
- SoundCloud API
- Direct audio URLs

To enable full music functionality, you'll need to:
1. Get API keys for your preferred platforms
2. Configure audio endpoints in `.env`
3. Install additional dependencies if needed

## 🔐 Permission System

### Default Roles
- **Owner**: Full access to all commands and settings
- **Administrator**: Access to moderation and management
- **Moderator**: Basic moderation commands
- **Premium Member**: Enhanced features and reduced cooldowns
- **Member**: Basic commands and features

### Custom Permissions
Grant specific permissions to users or roles:
```javascript
// Grant permission to user
await client.permissionManager.grantUserPermission(userId, guildId, 'music.priority');

// Grant permission to role
await client.permissionManager.grantRolePermission(roleId, guildId, 'moderation.kick');
```

## 📊 Monitoring & Logging

### Log Files
Logs are automatically saved to:
- `./logs/bot.log` - Main application logs
- Console output with pretty formatting in development

### Statistics
Get real-time bot statistics:
```javascript
const stats = client.getStats();
console.log(stats);
```

### Health Checks
Built-in health monitoring for:
- Database connectivity
- Discord API status
- Memory usage
- Command execution rates

## 🛠️ Development Guide

### Adding New Commands
1. Create file in `src/bot/commands/[category]/`
2. Extend `BaseCommand` class
3. Implement `execute()` method
4. Commands auto-load on startup

```javascript
const { BaseCommand } = require('../../base/BaseCommand');

class MyCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'mycommand',
      description: 'My command description',
      category: 'Utility',
      usage: '<argument>'
    });
  }

  async execute(message, args) {
    // Command logic here
  }
}

module.exports = MyCommand;
```

### Adding New Modules
1. Create file in `src/bot/modules/`
2. Extend `BaseModule` class
3. Implement required methods
4. Modules auto-load on startup

```javascript
const { BaseModule } = require('../base/BaseModule');

class MyModule extends BaseModule {
  constructor(client) {
    super(client, {
      name: 'MyModule',
      description: 'My module description',
      version: '1.0.0'
    });
  }

  async registerCommands() {
    // Register module commands
  }
}

module.exports = MyModule;
```

## 🔧 Troubleshooting

### Common Issues

**Bot won't start:**
- Check Discord token in `.env`
- Verify Node.js version (18+ required)
- Check for missing dependencies

**Commands not working:**
- Verify bot has necessary permissions
- Check command cooldowns
- Review permission settings

**Database errors:**
- Ensure write permissions for database file
- Check disk space
- Verify SQLite installation

**Music not playing:**
- Check voice channel permissions
- Verify audio dependencies
- Review audio endpoint configuration

### Debug Mode
Enable debug logging:
```env
LOG_LEVEL=debug
LOG_PRETTY=true
```

## 📚 API Documentation

### Command Handler API
```javascript
// Get command by name
const command = client.commandHandler.getCommand('play');

// Get command statistics
const stats = client.commandHandler.getCommandStats('play');

// Reload command
await client.commandHandler.reloadCommand('play');
```

### Event Manager API
```javascript
// Get event statistics
const stats = client.eventManager.getEventStats('messageCreate');

// Enable/disable events
await client.eventManager.enableEvent('messageCreate');
await client.eventManager.disableEvent('messageCreate');
```

### Permission Manager API
```javascript
// Check permissions
const hasPermission = await client.permissionManager.hasPermission(userId, guildId, 'music.play');

// Get user permissions
const permissions = await client.permissionManager.getUserPermissions(userId, guildId);
```

## 🚀 Deployment

### Production Deployment
1. Set `NODE_ENV=production` in `.env`
2. Use process manager (PM2, systemd)
3. Configure log rotation
4. Set up monitoring/alerting
5. Configure backup strategy

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

### Environment Variables for Production
```env
NODE_ENV=production
LOG_LEVEL=info
LOG_PRETTY=false
DATABASE_TYPE=postgresql  # For production scale
```

## 🤝 Contributing

We welcome contributions! Areas for improvement:
- Additional music platform integrations
- Advanced game implementations
- Web dashboard development
- Mobile app integration
- Advanced analytics features
- Multi-language support
- Plugin system development

## 📞 Support

For issues and questions:
1. Check this setup guide
2. Review the comprehensive README
3. Check log files for errors
4. Create GitHub issue for bugs

---

**🎉 Congratulations! Your EyeDaemon bot is ready to serve your Discord community!**