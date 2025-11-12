const { Collection } = require('discord.js');
const { rateLimit: logger } = require('../services/logging.service');
const CONFIG = require('../config');

/**
 * Rate Limiter untuk cooldown dan spam protection
 */
class RateLimiter {
  constructor(client) {
    this.client = client;
    this.cooldowns = new Collection(); // command -> user -> timestamp
    this.burstLimits = new Collection(); // user -> command -> count
    this.globalLimits = new Collection(); // user -> timestamp
    this.userLimits = new Collection(); // user -> type -> data
    this.enabled = true;
    this.cleanupInterval = null;
  }

  /**
   * Initialize rate limiter
   */
  async initialize() {
    logger.info('Initializing rate limiter');
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    logger.info('Rate limiter initialized successfully');
  }

  /**
   * Start cleanup interval to remove old entries
   */
  startCleanupInterval() {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanupOldEntries() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up cooldowns
    for (const [command, userCooldowns] of this.cooldowns) {
      for (const [userId, timestamp] of userCooldowns) {
        if (now - timestamp > maxAge) {
          userCooldowns.delete(userId);
        }
      }
      if (userCooldowns.size === 0) {
        this.cooldowns.delete(command);
      }
    }

    // Clean up burst limits
    for (const [userId, commandCounts] of this.burstLimits) {
      for (const [command, data] of commandCounts) {
        if (now - data.resetTime > maxAge) {
          commandCounts.delete(command);
        }
      }
      if (commandCounts.size === 0) {
        this.burstLimits.delete(userId);
      }
    }

    // Clean up global limits
    for (const [userId, timestamp] of this.globalLimits) {
      if (now - timestamp > maxAge) {
        this.globalLimits.delete(userId);
      }
    }

    // Clean up user limits
    for (const [userId, limitData] of this.userLimits) {
      for (const [type, data] of limitData) {
        if (now - data.resetTime > maxAge) {
          limitData.delete(type);
        }
      }
      if (limitData.size === 0) {
        this.userLimits.delete(userId);
      }
    }

    logger.debug('Cleaned up old rate limit entries');
  }

  /**
   * Check if user is rate limited for command
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   * @param {Object} options - Additional options
   * @returns {Object} Rate limit result
   */
  checkRateLimit(userId, commandName, options = {}) {
    if (!this.enabled) {
      return { limited: false, reason: 'Rate limiter disabled' };
    }

    const now = Date.now();
    const cooldown = options.cooldown || CONFIG.RATE_LIMIT.DEFAULT_COOLDOWN;
    const burstLimit = options.burstLimit || CONFIG.RATE_LIMIT.BURST_LIMIT;

    // Check command cooldown
    const cooldownResult = this.checkCooldown(userId, commandName, cooldown);
    if (cooldownResult.limited) {
      return cooldownResult;
    }

    // Check burst limit
    const burstResult = this.checkBurstLimit(userId, commandName, burstLimit);
    if (burstResult.limited) {
      return burstResult;
    }

    // Check global rate limit
    const globalResult = this.checkGlobalLimit(userId);
    if (globalResult.limited) {
      return globalResult;
    }

    return { limited: false };
  }

  /**
   * Check command cooldown
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   * @param {number} cooldown - Cooldown time in milliseconds
   * @returns {Object} Cooldown result
   */
  checkCooldown(userId, commandName, cooldown) {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }

    const userCooldowns = this.cooldowns.get(commandName);
    const now = Date.now();

    if (userCooldowns.has(userId)) {
      const expirationTime = userCooldowns.get(userId) + cooldown;
      const remainingTime = expirationTime - now;

      if (remainingTime > 0) {
        logger.hit(userId, commandName, expirationTime);
        return {
          limited: true,
          type: 'cooldown',
          reason: `Command on cooldown. Try again in ${Math.ceil(remainingTime / 1000)} seconds.`,
          remainingTime
        };
      }
    }

    return { limited: false };
  }

  /**
   * Check burst limit
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   * @param {number} limit - Burst limit count
   * @param {number} window - Time window in milliseconds (default: 60 seconds)
   * @returns {Object} Burst limit result
   */
  checkBurstLimit(userId, commandName, limit, window = 60 * 1000) {
    if (!this.burstLimits.has(userId)) {
      this.burstLimits.set(userId, new Collection());
    }

    const userBurstLimits = this.burstLimits.get(userId);
    const now = Date.now();

    if (!userBurstLimits.has(commandName)) {
      userBurstLimits.set(commandName, {
        count: 0,
        resetTime: now + window
      });
    }

    const burstData = userBurstLimits.get(commandName);

    // Reset if window has passed
    if (now > burstData.resetTime) {
      burstData.count = 0;
      burstData.resetTime = now + window;
    }

    burstData.count++;

    if (burstData.count > limit) {
      logger.exceeded(userId, commandName, burstData.count);
      return {
        limited: true,
        type: 'burst',
        reason: `Too many attempts. Please slow down and try again later.`,
        attempts: burstData.count
      };
    }

    return { limited: false };
  }

  /**
   * Check global rate limit
   * @param {string} userId - User ID
   * @param {number} limit - Global limit count (default: 100 per hour)
   * @param {number} window - Time window in milliseconds (default: 1 hour)
   * @returns {Object} Global limit result
   */
  checkGlobalLimit(userId, limit = 100, window = 60 * 60 * 1000) {
    const now = Date.now();

    if (!this.globalLimits.has(userId)) {
      this.globalLimits.set(userId, {
        count: 0,
        resetTime: now + window
      });
    }

    const globalData = this.globalLimits.get(userId);

    // Reset if window has passed
    if (now > globalData.resetTime) {
      globalData.count = 0;
      globalData.resetTime = now + window;
    }

    globalData.count++;

    if (globalData.count > limit) {
      return {
        limited: true,
        type: 'global',
        reason: `Global rate limit exceeded. Please try again later.`,
        attempts: globalData.count
      };
    }

    return { limited: false };
  }

  /**
   * Apply cooldown for user and command
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   * @param {number} cooldown - Cooldown time in milliseconds
   */
  applyCooldown(userId, commandName, cooldown = CONFIG.RATE_LIMIT.DEFAULT_COOLDOWN) {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }

    const userCooldowns = this.cooldowns.get(commandName);
    const now = Date.now();

    userCooldowns.set(userId, now);

    // Set cleanup timeout
    setTimeout(() => {
      userCooldowns.delete(userId);
      if (userCooldowns.size === 0) {
        this.cooldowns.delete(commandName);
      }
    }, cooldown);
  }

  /**
   * Reset cooldown for user and command
   * @param {string} userId - User ID
   * @param {string} commandName - Command name
   */
  resetCooldown(userId, commandName) {
    if (this.cooldowns.has(commandName)) {
      const userCooldowns = this.cooldowns.get(commandName);
      userCooldowns.delete(userId);
      
      if (userCooldowns.size === 0) {
        this.cooldowns.delete(commandName);
      }
    }
  }

  /**
   * Reset all cooldowns for user
   * @param {string} userId - User ID
   */
  resetUserCooldowns(userId) {
    // Reset command cooldowns
    for (const userCooldowns of this.cooldowns.values()) {
      userCooldowns.delete(userId);
    }

    // Remove empty cooldown collections
    for (const [commandName, userCooldowns] of this.cooldowns) {
      if (userCooldowns.size === 0) {
        this.cooldowns.delete(commandName);
      }
    }

    // Reset burst limits
    this.burstLimits.delete(userId);

    // Reset global limits
    this.globalLimits.delete(userId);

    logger.info(`Reset all cooldowns for user ${userId}`);
  }

  /**
   * Get user rate limit info
   * @param {string} userId - User ID
   * @returns {Object} User rate limit information
   */
  getUserRateLimitInfo(userId) {
    const info = {
      userId,
      cooldowns: {},
      burstLimits: {},
      globalLimit: null
    };

    // Get active cooldowns
    for (const [commandName, userCooldowns] of this.cooldowns) {
      if (userCooldowns.has(userId)) {
        const timestamp = userCooldowns.get(userId);
        info.cooldowns[commandName] = {
          startTime: new Date(timestamp).toISOString(),
          expiresAt: new Date(timestamp + CONFIG.RATE_LIMIT.DEFAULT_COOLDOWN).toISOString()
        };
      }
    }

    // Get burst limit info
    if (this.burstLimits.has(userId)) {
      const userBurstLimits = this.burstLimits.get(userId);
      for (const [commandName, data] of userBurstLimits) {
        info.burstLimits[commandName] = {
          count: data.count,
          resetTime: new Date(data.resetTime).toISOString()
        };
      }
    }

    // Get global limit info
    if (this.globalLimits.has(userId)) {
      const globalData = this.globalLimits.get(userId);
      info.globalLimit = {
        count: globalData.count,
        resetTime: new Date(globalData.resetTime).toISOString()
      };
    }

    return info;
  }

  /**
   * Get rate limiter statistics
   * @returns {Object} Rate limiter statistics
   */
  getStats() {
    const totalCooldowns = Array.from(this.cooldowns.values()).reduce((sum, userCooldowns) => sum + userCooldowns.size, 0);
    const totalBurstLimits = Array.from(this.burstLimits.values()).reduce((sum, userBurstLimits) => sum + userBurstLimits.size, 0);

    return {
      totalActiveCooldowns: totalCooldowns,
      totalActiveBurstLimits: totalBurstLimits,
      totalActiveGlobalLimits: this.globalLimits.size,
      totalActiveUserLimits: this.userLimits.size,
      enabled: this.enabled
    };
  }

  /**
   * Enable rate limiter
   */
  enable() {
    this.enabled = true;
    logger.info('Rate limiter enabled');
  }

  /**
   * Disable rate limiter
   */
  disable() {
    this.enabled = false;
    logger.warn('Rate limiter disabled');
  }

  /**
   * Shutdown rate limiter
   */
  async shutdown() {
    logger.info('Shutting down rate limiter');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.cooldowns.clear();
    this.burstLimits.clear();
    this.globalLimits.clear();
    this.userLimits.clear();
    
    logger.info('Rate limiter shutdown complete');
  }
}

module.exports = RateLimiter;