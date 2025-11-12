const { PermissionFlagsBits } = require('discord.js');
const CONFIG = require('../config');

/**
 * Base class for all bot commands
 */
class BaseCommand {
  constructor(client, options = {}) {
    this.client = client;
    this.name = options.name;
    this.description = options.description || 'No description provided';
    this.category = options.category || 'General';
    this.usage = options.usage || '';
    this.aliases = options.aliases || [];
    this.cooldown = options.cooldown || CONFIG.RATE_LIMIT.DEFAULT_COOLDOWN;
    this.permissions = options.permissions || [];
    this.botPermissions = options.botPermissions || [];
    this.guildOnly = options.guildOnly !== false;
    this.ownerOnly = options.ownerOnly || false;
    this.premiumOnly = options.premiumOnly || false;
    this.args = options.args || false;
    this.minArgs = options.minArgs || 0;
    this.maxArgs = options.maxArgs || -1;
    this.enabled = options.enabled !== false;
  }

  /**
   * Execute the command
   * @param {Message} message - Discord message object
   * @param {Array} args - Command arguments
   * @returns {Promise<void>}
   */
  async execute(message, args) {
    throw new Error('Execute method must be implemented by subclass');
  }

  /**
   * Validate command execution
   * @param {Message} message - Discord message object
   * @param {Array} args - Command arguments
   * @returns {Object} Validation result
   */
  async validate(message, args) {
    const result = {
      valid: true,
      reason: null
    };

    // Check if command is enabled
    if (!this.enabled) {
      result.valid = false;
      result.reason = 'Command is currently disabled';
      return result;
    }

    // Check guild only
    if (this.guildOnly && !message.guild) {
      result.valid = false;
      result.reason = 'This command can only be used in a server';
      return result;
    }

    // Check owner only
    if (this.ownerOnly && message.author.id !== CONFIG.DISCORD.OWNER_ID) {
      result.valid = false;
      result.reason = 'This command is restricted to bot owners';
      return result;
    }

    // Check arguments
    if (this.args && args.length < this.minArgs) {
      result.valid = false;
      result.reason = `Insufficient arguments. Usage: \`${CONFIG.DISCORD.PREFIX}${this.name} ${this.usage}\``;
      return result;
    }

    if (this.maxArgs >= 0 && args.length > this.maxArgs) {
      result.valid = false;
      result.reason = `Too many arguments. Usage: \`${CONFIG.DISCORD.PREFIX}${this.name} ${this.usage}\``;
      return result;
    }

    // Check user permissions
    if (this.permissions.length > 0 && message.guild) {
      const missingPermissions = this.permissions.filter(permission => 
        !message.member.permissions.has(permission)
      );
      
      if (missingPermissions.length > 0) {
        result.valid = false;
        result.reason = `You need the following permissions: ${missingPermissions.join(', ')}`;
        return result;
      }
    }

    // Check bot permissions
    if (this.botPermissions.length > 0 && message.guild) {
      const missingPermissions = this.botPermissions.filter(permission => 
        !message.guild.members.me.permissions.has(permission)
      );
      
      if (missingPermissions.length > 0) {
        result.valid = false;
        result.reason = `I need the following permissions: ${missingPermissions.join(', ')}`;
        return result;
      }
    }

    return result;
  }

  /**
   * Get command help information
   * @returns {Object} Help information
   */
  getHelp() {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      usage: `${CONFIG.DISCORD.PREFIX}${this.name} ${this.usage}`.trim(),
      aliases: this.aliases,
      cooldown: this.cooldown,
      permissions: this.permissions,
      examples: this.examples || []
    };
  }

  /**
   * Format error message
   * @param {string} message - Error message
   * @returns {Object} Formatted error embed
   */
  formatError(message) {
    return {
      embeds: [{
        color: 0xff0000,
        title: '❌ Error',
        description: message,
        timestamp: new Date()
      }]
    };
  }

  /**
   * Format success message
   * @param {string} message - Success message
   * @returns {Object} Formatted success embed
   */
  formatSuccess(message) {
    return {
      embeds: [{
        color: 0x00ff00,
        title: '✅ Success',
        description: message,
        timestamp: new Date()
      }]
    };
  }
}

/**
 * Base class for slash commands
 */
class BaseSlashCommand extends BaseCommand {
  constructor(client, options = {}) {
    super(client, options);
    this.data = options.data; // Slash command builder data
    this.type = 'CHAT_INPUT';
  }

  /**
   * Execute the slash command
   * @param {CommandInteraction} interaction - Discord interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    throw new Error('Execute method must be implemented by subclass');
  }
}

/**
 * Base class for context menu commands
 */
class BaseContextCommand extends BaseCommand {
  constructor(client, options = {}) {
    super(client, options);
    this.type = options.type || 'USER';
    this.targetType = options.targetType;
  }

  /**
   * Execute the context menu command
   * @param {ContextMenuInteraction} interaction - Discord interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    throw new Error('Execute method must be implemented by subclass');
  }
}

module.exports = {
  BaseCommand,
  BaseSlashCommand,
  BaseContextCommand
};