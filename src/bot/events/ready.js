const { BaseDiscordEvent } = require('../base/BaseEvent');
const { events: logger } = require('../services/logging.service');
const { registerCommands } = require('../interactions/register');

/**
 * Ready event - Fired when the bot is ready
 */
class ReadyEvent extends BaseDiscordEvent {
  constructor(client) {
    super(client, {
      name: 'ready',
      eventName: 'ready',
      description: 'Fired when the bot is ready and connected to Discord',
      once: true
    });
  }

  async execute() {
    try {
      logger.info(`Bot is ready! Logged in as ${this.client.user.tag}`);
      logger.info(`Connected to ${this.client.guilds.cache.size} guilds`);
      logger.info(`Serving ${this.client.users.cache.size} users`);

      // Set bot activity
      await this.setBotActivity();

      // Log startup information
      this.logStartupInfo();

      // Emit ready event for other modules
      this.client.emit('botReady', {
        user: this.client.user,
        guilds: this.client.guilds.cache.size,
        users: this.client.users.cache.size,
        timestamp: new Date()
      });

      await registerCommands(this.client);

    } catch (error) {
      logger.error('Error in ready event', { error: error.message });
    }
  }

  /**
   * Set bot activity
   */
  async setBotActivity() {
    const activities = [
      { name: '!help for commands', type: 2 }, // Listening
      { name: `${this.client.guilds.cache.size} servers`, type: 3 }, // Watching
      { name: `${this.client.users.cache.size} users`, type: 3 }, // Watching
      { name: 'EyeDaemon Bot', type: 0 }, // Playing
      { name: 'Discord.js v14', type: 1 } // Streaming
    ];

    let currentIndex = 0;

    // Set initial activity
    await this.client.user.setActivity(activities[currentIndex]);

    // Rotate activities every 30 seconds
    setInterval(async () => {
      currentIndex = (currentIndex + 1) % activities.length;
      await this.client.user.setActivity(activities[currentIndex]);
    }, 30 * 1000);
  }

  /**
   * Log startup information
   */
  logStartupInfo() {
    const stats = this.client.getStats();

    logger.info('=== EyeDaemon Bot Startup Information ===');
    logger.info(`Bot User: ${this.client.user.tag} (${this.client.user.id})`);
    logger.info(`Guilds: ${stats.modules.guilds}`);
    logger.info(`Users: ${stats.modules.users}`);
    logger.info(`Commands: ${stats.commands.totalCommands}`);
    logger.info(`Modules: ${stats.modules.total}`);
    logger.info(`Uptime: ${stats.uptimeFormatted}`);
    logger.info('========================================');
  }
}

module.exports = ReadyEvent;
