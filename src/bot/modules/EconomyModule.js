const BaseModule = require('../base/BaseModule');
const { economy: logger } = require('../services/logging.service');
const CONFIG = require('../config');

/**
 * Economy Module - Provides currency system and games
 */
class EconomyModule extends BaseModule {
  constructor(client) {
    super(client, {
      name: 'Economy',
      description: 'Complete economy system with currency, games, and shop',
      version: '1.0.0',
      author: 'EyeDaemon',
      category: 'Economy',
      dependencies: ['Database']
    });

    this.enabled = CONFIG.FEATURES.ECONOMY;
  }

  async initializeServices() {
    logger.info('Economy services initialized');
  }

  async registerCommands() {
    logger.info('Economy commands managed by CommandHandler');
  }

  async registerEvents() {
    logger.info('Economy events registered');
  }

  async registerInteractions() {
    logger.info('Economy interactions registered');
  }

  /**
   * Get user balance
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {Object} Balance information
   */
  async getUserBalance(userId, guildId) {
    try {
      if (!this.client.database) return null;

      const result = await this.client.database.get(
        'SELECT balance, bank_balance FROM economy e JOIN members m ON e.member_id = m.id WHERE m.user_id = ? AND m.guild_id = ?',
        [userId, guildId]
      );

      return result || { balance: CONFIG.ECONOMY.STARTING_BALANCE, bank_balance: 0 };
    } catch (error) {
      logger.error('Failed to get user balance', { error: error.message });
      return { balance: CONFIG.ECONOMY.STARTING_BALANCE, bank_balance: 0 };
    }
  }

  /**
   * Update user balance
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {number} amount - Amount to add (negative for subtract)
   * @param {string} type - Balance type ('balance' or 'bank_balance')
   * @returns {boolean} Success
   */
  async updateBalance(userId, guildId, amount, type = 'balance') {
    try {
      if (!this.client.database) return false;

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

        // Create economy record
        await this.client.database.query(
          'INSERT INTO economy (member_id, balance, bank_balance) VALUES (?, ?, ?)',
          [memberId, CONFIG.ECONOMY.STARTING_BALANCE, 0]
        );

        return true;
      }

      // Update balance
      await this.client.database.query(
        `UPDATE economy SET ${type} = ${type} + ? WHERE member_id = ?`,
        [amount, memberResult.id]
      );

      return true;
    } catch (error) {
      logger.error('Failed to update balance', { error: error.message });
      return false;
    }
  }

  async onShutdown() {
    logger.info('Economy module shutdown complete');
  }

  getStats() {
    return { enabled: this.enabled };
  }
}

module.exports = EconomyModule;
