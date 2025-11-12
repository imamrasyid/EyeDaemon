const BaseModule = require('../base/BaseModule');
const { moderation: logger } = require('../services/logging.service');
const CONFIG = require('../config');

/**
 * Moderation Module - Provides comprehensive moderation tools
 */
class ModerationModule extends BaseModule {
  constructor(client) {
    super(client, {
      name: 'Moderation',
      description: 'Advanced moderation system with warnings, auto-moderation, and user management',
      version: '1.0.0',
      author: 'EyeDaemon',
      category: 'Moderation',
      dependencies: ['Database']
    });

    this.enabled = CONFIG.FEATURES.MODERATION;
    this.autoModCache = new Map();
  }

  /**
   * Initialize moderation module services
   */
  async initializeServices() {
    // Initialize moderation-specific services here
    logger.info('Moderation services initialized');
  }

  /**
   * Register moderation commands
   */
  async registerCommands() {
    logger.info('Moderation commands managed by CommandHandler');
  }

  /**
   * Register moderation events
   */
  async registerEvents() {
    // Moderation-specific events will be registered here
    logger.info('Moderation events registered');
  }

  /**
   * Register moderation interactions
   */
  async registerInteractions() {
    // Moderation button controls, select menus, etc.
    logger.info('Moderation interactions registered');
  }

  /**
   * Handle auto-moderation for messages
   * @param {Message} message - Discord message
   */
  async handleAutoModeration(message) {
    if (!this.enabled) return;
    if (!message.guild) return;
    if (message.author.bot) return;

    try {
      // Check for spam
      const spamResult = await this.checkSpam(message);
      if (spamResult.violation) {
        await this.handleSpamViolation(message, spamResult);
        return;
      }

      // Check for banned words
      const wordResult = await this.checkBannedWords(message);
      if (wordResult.violation) {
        await this.handleWordViolation(message, wordResult);
        return;
      }

      // Check for excessive caps
      const capsResult = await this.checkExcessiveCaps(message);
      if (capsResult.violation) {
        await this.handleCapsViolation(message, capsResult);
        return;
      }

      // Check for link filtering
      const linkResult = await this.checkLinks(message);
      if (linkResult.violation) {
        await this.handleLinkViolation(message, linkResult);
        return;
      }

      // Check for emoji spam
      const emojiResult = await this.checkEmojiSpam(message);
      if (emojiResult.violation) {
        await this.handleEmojiViolation(message, emojiResult);
        return;
      }

    } catch (error) {
      logger.error('Error in auto-moderation', {
        error: error.message,
        message: message.id,
        author: message.author.tag,
        guild: message.guild.name
      });
    }
  }

  /**
   * Check for spam
   * @param {Message} message - Discord message
   * @returns {Object} Spam check result
   */
  async checkSpam(message) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const key = `${guildId}-${userId}`;
    const now = Date.now();

    // Initialize user spam data
    if (!this.autoModCache.has(key)) {
      this.autoModCache.set(key, {
        messages: [],
        lastMessage: 0
      });
    }

    const userData = this.autoModCache.get(key);

    // Clean old messages (older than 10 seconds)
    userData.messages = userData.messages.filter(timestamp => now - timestamp < 10000);

    // Add current message
    userData.messages.push(now);
    userData.lastMessage = now;

    // Check spam threshold (5 messages in 10 seconds)
    const isSpam = userData.messages.length >= 5;

    return {
      violation: isSpam,
      type: 'spam',
      details: {
        messageCount: userData.messages.length,
        timeWindow: '10 seconds'
      }
    };
  }

  /**
   * Check for banned words
   * @param {Message} message - Discord message
   * @returns {Object} Banned words check result
   */
  async checkBannedWords(message) {
    // Get guild settings from database
    const guildSettings = await this.getGuildSettings(message.guild.id);
    const bannedWords = guildSettings?.bannedWords || [];

    if (bannedWords.length === 0) {
      return { violation: false };
    }

    const content = message.content.toLowerCase();
    const foundWords = [];

    for (const word of bannedWords) {
      if (content.includes(word.toLowerCase())) {
        foundWords.push(word);
      }
    }

    return {
      violation: foundWords.length > 0,
      type: 'banned_words',
      details: {
        foundWords,
        count: foundWords.length
      }
    };
  }

  /**
   * Check for excessive caps
   * @param {Message} message - Discord message
   * @returns {Object} Caps check result
   */
  async checkExcessiveCaps(message) {
    const content = message.content;
    if (content.length < 10) {
      return { violation: false };
    }

    const capsCount = (content.match(/[A-Z]/g) || []).length;
    const capsPercentage = (capsCount / content.length) * 100;

    // Threshold: 70% caps
    const isExcessive = capsPercentage >= 70;

    return {
      violation: isExcessive,
      type: 'excessive_caps',
      details: {
        capsPercentage: Math.round(capsPercentage),
        capsCount
      }
    };
  }

  /**
   * Check for links
   * @param {Message} message - Discord message
   * @returns {Object} Links check result
   */
  async checkLinks(message) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.content.match(urlRegex) || [];

    if (urls.length === 0) {
      return { violation: false };
    }

    // Get guild settings
    const guildSettings = await this.getGuildSettings(message.guild.id);
    const allowLinks = guildSettings?.allowLinks || false;
    const allowedDomains = guildSettings?.allowedDomains || [];

    if (allowLinks) {
      return { violation: false };
    }

    const blockedUrls = [];
    for (const url of urls) {
      const domain = new URL(url).hostname;
      if (!allowedDomains.includes(domain)) {
        blockedUrls.push(url);
      }
    }

    return {
      violation: blockedUrls.length > 0,
      type: 'blocked_links',
      details: {
        blockedUrls,
        count: blockedUrls.length
      }
    };
  }

  /**
   * Check for emoji spam
   * @param {Message} message - Discord message
   * @returns {Object} Emoji spam check result
   */
  async checkEmojiSpam(message) {
    const content = message.content;
    const emojiRegex = /<a?:\w+:\d+>/g;
    const emojis = content.match(emojiRegex) || [];

    if (emojis.length === 0) {
      return { violation: false };
    }

    // Threshold: 5+ emojis
    const isSpam = emojis.length >= 5;

    return {
      violation: isSpam,
      type: 'emoji_spam',
      details: {
        emojiCount: emojis.length,
        emojis
      }
    };
  }

  /**
   * Handle spam violation
   * @param {Message} message - Discord message
   * @param {Object} result - Spam check result
   */
  async handleSpamViolation(message, result) {
    try {
      // Delete the message
      await message.delete();

      // Send warning
      await message.channel.send({
        content: `${message.author}, please avoid sending messages too quickly.`,
        allowedMentions: { users: [message.author.id] }
      });

      // Log to database
      await this.logAutoModAction(message, result);

      logger.info(`Auto-moderation: Spam violation handled for ${message.author.tag}`);

    } catch (error) {
      logger.error('Failed to handle spam violation', { error: error.message });
    }
  }

  /**
   * Handle word violation
   * @param {Message} message - Discord message
   * @param {Object} result - Word check result
   */
  async handleWordViolation(message, result) {
    try {
      // Delete the message
      await message.delete();

      // Send warning
      const words = result.details.foundWords.join(', ');
      await message.channel.send({
        content: `${message.author}, your message contained banned words: ${words}`,
        allowedMentions: { users: [message.author.id] }
      });

      // Log to database
      await this.logAutoModAction(message, result);

      logger.info(`Auto-moderation: Banned words violation handled for ${message.author.tag}`);

    } catch (error) {
      logger.error('Failed to handle word violation', { error: error.message });
    }
  }

  /**
   * Handle caps violation
   * @param {Message} message - Discord message
   * @param {Object} result - Caps check result
   */
  async handleCapsViolation(message, result) {
    try {
      // Send warning (don't delete for caps)
      await message.channel.send({
        content: `${message.author}, please avoid using excessive caps (${result.details.capsPercentage}%).`,
        allowedMentions: { users: [message.author.id] }
      });

      // Log to database
      await this.logAutoModAction(message, result);

      logger.info(`Auto-moderation: Excessive caps violation handled for ${message.author.tag}`);

    } catch (error) {
      logger.error('Failed to handle caps violation', { error: error.message });
    }
  }

  /**
   * Handle link violation
   * @param {Message} message - Discord message
   * @param {Object} result - Link check result
   */
  async handleLinkViolation(message, result) {
    try {
      // Delete the message
      await message.delete();

      // Send warning
      await message.channel.send({
        content: `${message.author}, links are not allowed in this channel.`,
        allowedMentions: { users: [message.author.id] }
      });

      // Log to database
      await this.logAutoModAction(message, result);

      logger.info(`Auto-moderation: Link violation handled for ${message.author.tag}`);

    } catch (error) {
      logger.error('Failed to handle link violation', { error: error.message });
    }
  }

  /**
   * Handle emoji violation
   * @param {Message} message - Discord message
   * @param {Object} result - Emoji check result
   */
  async handleEmojiViolation(message, result) {
    try {
      // Send warning (don't delete for emoji spam)
      await message.channel.send({
        content: `${message.author}, please avoid using too many emojis (${result.details.emojiCount} emojis).`,
        allowedMentions: { users: [message.author.id] }
      });

      // Log to database
      await this.logAutoModAction(message, result);

      logger.info(`Auto-moderation: Emoji spam violation handled for ${message.author.tag}`);

    } catch (error) {
      logger.error('Failed to handle emoji violation', { error: error.message });
    }
  }

  /**
   * Log auto-moderation action to database
   * @param {Message} message - Discord message
   * @param {Object} result - Auto-mod result
   */
  async logAutoModAction(message, result) {
    try {
      if (!this.client.database) return;

      await this.client.database.query(
        `INSERT INTO logs (guild_id, event_type, data) VALUES (?, ?, ?)`,
        [
          message.guild.id,
          'auto_moderation',
          JSON.stringify({
            user_id: message.author.id,
            message_id: message.id,
            channel_id: message.channel.id,
            violation_type: result.type,
            violation_details: result.details,
            timestamp: message.createdTimestamp
          })
        ]
      );

    } catch (error) {
      logger.error('Failed to log auto-moderation action', { error: error.message });
    }
  }

  /**
   * Get guild settings from database
   * @param {string} guildId - Guild ID
   * @returns {Object} Guild settings
   */
  async getGuildSettings(guildId) {
    try {
      if (!this.client.database) return {};

      const result = await this.client.database.get(
        'SELECT value FROM settings WHERE guild_id = ? AND key = ?',
        [guildId, 'moderation']
      );

      if (result && result.value) {
        return JSON.parse(result.value);
      }

      return {};

    } catch (error) {
      logger.error('Failed to get guild settings', { error: error.message });
      return {};
    }
  }

  /**
   * Module cleanup
   */
  async onShutdown() {
    logger.info('Shutting down moderation module');

    this.autoModCache.clear();

    logger.info('Moderation module shutdown complete');
  }

  /**
   * Get module statistics
   */
  getStats() {
    return {
      autoModCacheSize: this.autoModCache.size,
      enabled: this.enabled
    };
  }
}

module.exports = ModerationModule;
