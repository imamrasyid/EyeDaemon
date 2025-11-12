const BaseModule = require('../base/BaseModule');
const { leveling: logger } = require('../services/logging.service');
const CONFIG = require('../config');
const { calculateXPForLevel, getLevelProgress, generateRandomString } = require('../utils/functions');

/**
 * Leveling Module - Provides XP and leveling system
 */
class LevelingModule extends BaseModule {
  constructor(client) {
    super(client, {
      name: 'Leveling',
      description: 'XP and leveling system with rewards and leaderboards',
      version: '1.0.0',
      author: 'EyeDaemon',
      category: 'Leveling',
      dependencies: ['Database']
    });

    this.enabled = CONFIG.FEATURES.LEVELING;
    this.messageCooldowns = new Map();
  }

  async initializeServices() {
    logger.info('Leveling services initialized');
  }

  async registerCommands() {
    logger.info('Leveling commands managed by CommandHandler');
  }

  async registerEvents() {
    logger.info('Leveling events registered');
  }

  async registerInteractions() {
    logger.info('Leveling interactions registered');
  }

  /**
   * Handle message for XP gain
   * @param {Message} message - Discord message
   */
  async handleMessage(message) {
    if (!this.enabled) return;
    if (message.author.bot) return;
    if (!message.guild) return;

    try {
      const userId = message.author.id;
      const guildId = message.guild.id;
      const key = `${guildId}-${userId}`;

      // Check cooldown (1 minute)
      const now = Date.now();
      if (this.messageCooldowns.has(key)) {
        const lastMessage = this.messageCooldowns.get(key);
        if (now - lastMessage < 60 * 1000) {
          return;
        }
      }

      // Update cooldown
      this.messageCooldowns.set(key, now);

      // Calculate XP gain
      const xpGain = CONFIG.LEVELING.XP_PER_MESSAGE_MIN +
        Math.floor(Math.random() * (CONFIG.LEVELING.XP_PER_MESSAGE_MAX - CONFIG.LEVELING.XP_PER_MESSAGE_MIN));

      // Add XP to user
      await this.addXP(userId, guildId, xpGain);

      logger.debug(`Added ${xpGain} XP to ${message.author.tag} for message`);

    } catch (error) {
      logger.error('Failed to handle message XP', { error: error.message });
    }
  }

  /**
   * Add XP to user
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {number} xp - XP to add
   * @returns {Object} Level up information
   */
  async addXP(userId, guildId, xp) {
    try {
      if (!this.client.database) return null;

      // Get member ID
      const memberResult = await this.client.database.get(
        'SELECT id FROM members WHERE user_id = ? AND guild_id = ?',
        [userId, guildId]
      );

      if (!memberResult) {
        // Create member record
        const memberId = generateRandomString(16);
        await this.client.database.query(
          'INSERT INTO members (id, guild_id, user_id) VALUES (?, ?, ?)',
          [memberId, guildId, userId]
        );

        // Create leveling record
        await this.client.database.query(
          'INSERT INTO leveling (member_id, xp, level, total_messages) VALUES (?, ?, ?, ?)',
          [memberId, xp, 1, 1]
        );

        return { leveledUp: false, oldLevel: 1, newLevel: 1 };
      }

      // Get current leveling data
      const levelingResult = await this.client.database.get(
        'SELECT xp, level, total_messages FROM leveling WHERE member_id = ?',
        [memberResult.id]
      );

      if (!levelingResult) {
        // Create leveling record
        await this.client.database.query(
          'INSERT INTO leveling (member_id, xp, level, total_messages) VALUES (?, ?, ?, ?)',
          [memberResult.id, xp, 1, 1]
        );

        return { leveledUp: false, oldLevel: 1, newLevel: 1 };
      }

      const oldXP = levelingResult.xp;
      const oldLevel = levelingResult.level;
      const newXP = oldXP + xp;

      // Calculate new level
      const newLevel = this.calculateLevelFromXP(newXP);
      const leveledUp = newLevel > oldLevel;

      // Update leveling data
      await this.client.database.query(
        'UPDATE leveling SET xp = ?, level = ?, total_messages = total_messages + 1, last_activity = CURRENT_TIMESTAMP WHERE member_id = ?',
        [newXP, newLevel, memberResult.id]
      );

      return {
        leveledUp,
        oldLevel,
        newLevel,
        xpGained: xp,
        oldXP,
        newXP
      };

    } catch (error) {
      logger.error('Failed to add XP', { error: error.message });
      return null;
    }
  }

  /**
   * Get user level info
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {Object} Level information
   */
  async getUserLevel(userId, guildId) {
    try {
      if (!this.client.database) return null;

      const result = await this.client.database.get(
        'SELECT l.xp, l.level, l.total_messages, l.last_activity FROM leveling l JOIN members m ON l.member_id = m.id WHERE m.user_id = ? AND m.guild_id = ?',
        [userId, guildId]
      );

      if (!result) {
        return {
          xp: 0,
          level: 1,
          totalMessages: 0,
          lastActivity: null,
          xpForNextLevel: calculateXPForLevel(2),
          xpInCurrentLevel: 0,
          progress: 0
        };
      }

      const progress = getLevelProgress(result.xp);

      return {
        xp: result.xp,
        level: result.level,
        totalMessages: result.total_messages,
        lastActivity: result.last_activity,
        xpForNextLevel: calculateXPForLevel(result.level + 1),
        xpInCurrentLevel: progress.xpInCurrentLevel,
        progress: progress.percentage
      };

    } catch (error) {
      logger.error('Failed to get user level', { error: error.message });
      return null;
    }
  }

  /**
   * Get leaderboard
   * @param {string} guildId - Guild ID
   * @param {string} type - Leaderboard type ('xp', 'level', 'messages')
   * @param {number} limit - Number of users to return
   * @returns {Array} Leaderboard data
   */
  async getLeaderboard(guildId, type = 'xp', limit = 10) {
    try {
      if (!this.client.database) return [];

      let orderBy = 'l.xp DESC';
      switch (type) {
        case 'level':
          orderBy = 'l.level DESC, l.xp DESC';
          break;
        case 'messages':
          orderBy = 'l.total_messages DESC';
          break;
        default:
          orderBy = 'l.xp DESC';
      }

      const results = await this.client.database.all(
        `SELECT m.user_id, l.xp, l.level, l.total_messages FROM leveling l 
         JOIN members m ON l.member_id = m.id 
         WHERE m.guild_id = ? 
         ORDER BY ${orderBy} 
         LIMIT ?`,
        [guildId, limit]
      );

      return results.map((row, index) => ({
        rank: index + 1,
        userId: row.user_id,
        xp: row.xp,
        level: row.level,
        totalMessages: row.total_messages
      }));

    } catch (error) {
      logger.error('Failed to get leaderboard', { error: error.message });
      return [];
    }
  }

  /**
   * Calculate level from XP
   * @param {number} xp - Total XP
   * @returns {number} Level
   */
  calculateLevelFromXP(xp) {
    let level = 1;
    while (xp >= calculateXPForLevel(level + 1)) {
      level++;
    }
    return level;
  }

  async onShutdown() {
    logger.info('Leveling module shutdown complete');
    this.messageCooldowns.clear();
  }

  getStats() {
    return {
      activeCooldowns: this.messageCooldowns.size,
      enabled: this.enabled
    };
  }
}

module.exports = LevelingModule;
