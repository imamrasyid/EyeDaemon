const { Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { commands: logger, createRateLimitLogger } = require('../services/logging.service');
const { BaseCommand } = require('../base/BaseCommand');
const CONFIG = require('../config');

/**
 * Command Handler untuk mengelola semua bot commands
 */
class CommandHandler {
  constructor(client) {
    this.client = client;
    this.commands = new Collection();
    this.aliases = new Collection();
    this.cooldowns = new Collection();
    this.commandStats = new Map();
    this.enabled = true;
    this.rateLimitLogger = createRateLimitLogger('COMMANDS');
  }

  /**
   * Initialize command handler
   */
  async initialize() {
    logger.info('Initializing command handler');
    
    // Load built-in commands
    await this.loadBuiltinCommands();
    
    // Load module commands
    await this.loadModuleCommands();
    
    logger.info(`Command handler initialized with ${this.commands.size} commands and ${this.aliases.size} aliases`);
  }

  /**
   * Load built-in commands from commands directory
   */
  async loadBuiltinCommands() {
    const commandsDir = path.join(__dirname, '../commands');
    
    if (!fs.existsSync(commandsDir)) {
      logger.warn('Commands directory not found, creating it');
      fs.mkdirSync(commandsDir, { recursive: true });
      return;
    }

    // Load commands from subdirectories
    const categories = fs.readdirSync(commandsDir).filter(file => 
      fs.statSync(path.join(commandsDir, file)).isDirectory()
    );

    for (const category of categories) {
      const categoryDir = path.join(commandsDir, category);
      const commandFiles = fs.readdirSync(categoryDir).filter(file => 
        file.endsWith('.js') && !file.startsWith('_')
      );

      for (const file of commandFiles) {
        try {
          const commandPath = path.join(categoryDir, file);
          const CommandClass = require(commandPath);
          
          if (typeof CommandClass !== 'function') {
            logger.warn(`Invalid command class in ${file}`);
            continue;
          }

          const command = new CommandClass(this.client);
          
          if (!command.name || !command.execute) {
            logger.warn(`Invalid command structure in ${file}`);
            continue;
          }

          // Set category from directory
          command.category = category;
          
          await this.registerCommand(command);
          logger.debug(`Loaded built-in command: ${command.name} (${category})`);
          
        } catch (error) {
          logger.error(`Failed to load command ${file}`, { error: error.message });
        }
      }
    }

    const rootFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js') && !file.startsWith('_'));
    for (const file of rootFiles) {
      try {
        const commandPath = path.join(commandsDir, file);
        const Exported = require(commandPath);
        let command = null;
        if (typeof Exported === 'function') {
          command = new Exported(this.client);
        } else if (Exported && typeof Exported === 'object' && Exported.name) {
          const adapterData = {
            name: Exported.name,
            description: Exported.description,
            category: Exported.category || 'general',
            usage: Exported.usage,
            aliases: Exported.aliases || [],
            cooldown: Exported.cooldown,
            args: !!Exported.args,
            minArgs: Exported.minArgs || 0,
            maxArgs: typeof Exported.maxArgs === 'number' ? Exported.maxArgs : -1,
            guildOnly: Exported.guildOnly !== false,
            ownerOnly: !!Exported.ownerOnly,
            premiumOnly: !!Exported.premiumOnly
          };
          class ObjectCommandAdapter extends BaseCommand {
            constructor(client, impl) {
              super(client, adapterData);
              this.impl = impl;
            }
            async execute(message, args) {
              if (typeof this.impl.prefix === 'function') {
                return this.impl.prefix(message, args);
              }
              throw new Error('Invalid command implementation');
            }
          }
          command = new ObjectCommandAdapter(this.client, Exported);
        } else {
          logger.warn(`Invalid command class in ${file}`);
          continue;
        }
        await this.registerCommand(command);
        logger.debug(`Loaded built-in command: ${command.name}`);
      } catch (error) {
        logger.error(`Failed to load command ${file}`, { error: error.message });
      }
    }
  }

  /**
   * Load commands from modules
   */
  async loadModuleCommands() {
    for (const [moduleName, module] of this.client.modules) {
      if (!module.enabled) continue;
      
      for (const [commandName, command] of module.commands) {
        try {
          await this.registerCommand(command);
          logger.debug(`Loaded module command: ${moduleName}.${commandName}`);
        } catch (error) {
          logger.error(`Failed to load module command ${moduleName}.${commandName}`, { error: error.message });
        }
      }
    }
  }

  /**
   * Register a command
   * @param {BaseCommand} command - Command instance
   */
  async registerCommand(command) {
    // Check for duplicate command names
    if (this.commands.has(command.name)) {
      throw new Error(`Command '${command.name}' is already registered`);
    }

    // Register command
    this.commands.set(command.name, command);

    // Register aliases
    if (command.aliases && command.aliases.length > 0) {
      for (const alias of command.aliases) {
        if (this.aliases.has(alias)) {
          logger.warn(`Alias '${alias}' for command '${command.name}' conflicts with existing alias`);
          continue;
        }
        this.aliases.set(alias, command.name);
      }
    }

    // Initialize cooldown tracking
    if (!this.cooldowns.has(command.name)) {
      this.cooldowns.set(command.name, new Collection());
    }

    // Initialize stats
    if (!this.commandStats.has(command.name)) {
      this.commandStats.set(command.name, {
        executed: 0,
        success: 0,
        error: 0,
        duration: 0,
        avgDuration: 0
      });
    }
  }

  /**
   * Unregister a command
   * @param {string} name - Command name
   */
  async unregisterCommand(name) {
    const command = this.commands.get(name);
    if (!command) {
      logger.warn(`Command ${name} not found for unregistration`);
      return;
    }

    // Remove command
    this.commands.delete(name);

    // Remove aliases
    if (command.aliases && command.aliases.length > 0) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }
    }

    // Remove cooldowns
    this.cooldowns.delete(name);

    // Remove stats
    this.commandStats.delete(name);

    logger.debug(`Unregistered command: ${name}`);
  }

  /**
   * Handle incoming message as potential command
   * @param {Message} message - Discord message object
   */
  async handleMessage(message) {
    if (!this.enabled) return;
    if (message.author.bot) return;
    if (!message.content.startsWith(CONFIG.DISCORD.PREFIX)) return;

    // Parse command and arguments
    const args = message.content.slice(CONFIG.DISCORD.PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    // Find command
    const command = this.findCommand(commandName);
    if (!command) return;

    // Check cooldown
    if (this.isOnCooldown(command.name, message.author.id)) {
      const remaining = this.getCooldownRemaining(command.name, message.author.id);
      this.rateLimitLogger.hit(message.author.id, command.name, Date.now() + remaining);
      
      return message.reply({
        embeds: [{
          color: 0xffa500,
          title: '⏰ Cooldown',
          description: `Please wait ${Math.ceil(remaining / 1000)} seconds before using this command again.`,
          timestamp: new Date()
        }],
        ephemeral: true
      });
    }

    // Validate command
    const validation = await command.validate(message, args);
    if (!validation.valid) {
      return message.reply(command.formatError(validation.reason));
    }

    // Execute command
    await this.executeCommand(command, message, args);
  }

  /**
   * Handle slash command interaction
   * @param {import('discord.js').CommandInteraction} interaction
   */
  async handleSlashCommand(interaction) {
    if (!this.enabled) return;
    const commandName = interaction.commandName?.toLowerCase();
    const command = this.findCommand(commandName);
    if (!command) return;

    const userId = interaction.user.id;
    const start = process.hrtime.bigint();

    try {
      // Cooldown
      if (this.isOnCooldown(command.name, userId)) {
        const remaining = this.getCooldownRemaining(command.name, userId);
        this.rateLimitLogger.hit(userId, command.name, Date.now() + remaining);
        if (interaction.isRepliable()) {
          await interaction.reply({
            embeds: [{
              color: 0xffa500,
              title: '⏰ Cooldown',
              description: `Tunggu ${Math.ceil(remaining / 1000)} detik sebelum pakai lagi.`,
              timestamp: new Date()
            }],
            ephemeral: true
          });
        }
        return;
      }

      // Validasi dasar
      if (!command.enabled) {
        if (interaction.isRepliable()) {
          await interaction.reply(command.formatError('Command sedang dinonaktifkan'));
        }
        return;
      }

      if (command.guildOnly && !interaction.guild) {
        if (interaction.isRepliable()) {
          await interaction.reply(command.formatError('Command hanya dapat digunakan di server'));
        }
        return;
      }

      if (command.ownerOnly) {
        if (interaction.isRepliable()) {
          await interaction.reply(command.formatError('Command khusus pemilik bot'));
        }
        return;
      }

      if (interaction.guild) {
        if (command.permissions && command.permissions.length > 0) {
          const missing = command.permissions.filter(p => !interaction.memberPermissions?.has(p));
          if (missing.length > 0) {
            await interaction.reply(command.formatError(`Kamu butuh izin: ${missing.join(', ')}`));
            return;
          }
        }

        if (command.botPermissions && command.botPermissions.length > 0) {
          const me = interaction.guild.members.me;
          const missingBot = command.botPermissions.filter(p => !me?.permissions.has(p));
          if (missingBot.length > 0) {
            await interaction.reply(command.formatError(`Bot butuh izin: ${missingBot.join(', ')}`));
            return;
          }
        }
      }

      this.updateCommandStats(command.name, 'executed');
      this.applyCooldown(command.name, userId);

      if (typeof command.slash === 'function') {
        await command.slash(interaction);
      } else {
        await interaction.reply({
          embeds: [{
            color: 0xffa500,
            title: 'ℹ️ Tidak tersedia',
            description: 'Slash untuk command ini belum diimplementasikan.',
            timestamp: new Date()
          }],
          ephemeral: true
        });
      }

      this.updateCommandStats(command.name, 'success');
      logger.info(`Slash command executed: ${command.name} by ${interaction.user.tag}`);
    } catch (error) {
      this.updateCommandStats(command.name, 'error');
      logger.error(`Slash command execution failed: ${command.name}`, {
        error: error.message,
        user: interaction.user.tag,
        guild: interaction.guild?.name || 'DM'
      });
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            embeds: [{
              color: 0xff0000,
              title: '❌ Command Error',
              description: 'Terjadi kesalahan saat menjalankan command.',
              timestamp: new Date()
            }],
            ephemeral: true
          });
        } else {
          await interaction.reply({
            embeds: [{
              color: 0xff0000,
              title: '❌ Command Error',
              description: 'Terjadi kesalahan saat menjalankan command.',
              timestamp: new Date()
            }],
            ephemeral: true
          });
        }
      } catch (replyError) {
        logger.error('Failed to send slash error message', { error: replyError.message });
      }
      this.client.emit('commandError', { command, interaction, error });
    } finally {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.updateCommandStats(command.name, 'duration', duration);
    }
  }

  /**
   * Find command by name or alias
   * @param {string} name - Command name or alias
   * @returns {BaseCommand|null}
   */
  findCommand(name) {
    // Direct command name
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }

    // Alias
    if (this.aliases.has(name)) {
      const commandName = this.aliases.get(name);
      return this.commands.get(commandName);
    }

    return null;
  }

  /**
   * Check if user is on cooldown for command
   * @param {string} commandName - Command name
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  isOnCooldown(commandName, userId) {
    if (!this.cooldowns.has(commandName)) return false;
    
    const cooldowns = this.cooldowns.get(commandName);
    const now = Date.now();
    const cooldownAmount = this.commands.get(commandName)?.cooldown || CONFIG.RATE_LIMIT.DEFAULT_COOLDOWN;

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + cooldownAmount;
      return now < expirationTime;
    }

    return false;
  }

  /**
   * Get remaining cooldown time
   * @param {string} commandName - Command name
   * @param {string} userId - User ID
   * @returns {number} Remaining time in milliseconds
   */
  getCooldownRemaining(commandName, userId) {
    if (!this.cooldowns.has(commandName)) return 0;
    
    const cooldowns = this.cooldowns.get(commandName);
    const now = Date.now();
    const cooldownAmount = this.commands.get(commandName)?.cooldown || CONFIG.RATE_LIMIT.DEFAULT_COOLDOWN;

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + cooldownAmount;
      return Math.max(0, expirationTime - now);
    }

    return 0;
  }

  /**
   * Apply cooldown for user
   * @param {string} commandName - Command name
   * @param {string} userId - User ID
   */
  applyCooldown(commandName, userId) {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }

    const cooldowns = this.cooldowns.get(commandName);
    const now = Date.now();
    const cooldownAmount = this.commands.get(commandName)?.cooldown || CONFIG.RATE_LIMIT.DEFAULT_COOLDOWN;

    cooldowns.set(userId, now);

    // Clean up old cooldowns
    setTimeout(() => {
      cooldowns.delete(userId);
    }, cooldownAmount);
  }

  /**
   * Execute command with error handling and performance monitoring
   * @param {BaseCommand} command - Command instance
   * @param {Message} message - Discord message object
   * @param {Array} args - Command arguments
   */
  async executeCommand(command, message, args) {
    const start = process.hrtime.bigint();
    const userId = message.author.id;
    const commandName = command.name;

    try {
      // Update stats
      this.updateCommandStats(commandName, 'executed');

      // Apply cooldown
      this.applyCooldown(commandName, userId);

      // Execute command
      await command.execute(message, args);

      // Update success stats
      this.updateCommandStats(commandName, 'success');

      logger.info(`Command executed: ${commandName} by ${message.author.tag}`);

    } catch (error) {
      // Update error stats
      this.updateCommandStats(commandName, 'error');

      logger.error(`Command execution failed: ${commandName}`, {
        error: error.message,
        user: message.author.tag,
        guild: message.guild?.name || 'DM',
        args: args.join(' ')
      });

      // Send error message to user
      try {
        await message.reply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Command Error',
            description: 'An error occurred while executing this command. Please try again later.',
            timestamp: new Date()
          }]
        });
      } catch (replyError) {
        logger.error('Failed to send error message', { error: replyError.message });
      }

      // Emit command error event
      this.client.emit('commandError', { command, message, error, args });
    } finally {
      const duration = Number(process.hrtime.bigint() - start) / 1000000;
      this.updateCommandStats(commandName, 'duration', duration);
    }
  }

  /**
   * Update command statistics
   * @param {string} commandName - Command name
   * @param {string} type - Statistic type
   * @param {any} value - Statistic value
   */
  updateCommandStats(commandName, type, value = 1) {
    if (!this.commandStats.has(commandName)) {
      this.commandStats.set(commandName, {
        executed: 0,
        success: 0,
        error: 0,
        duration: 0,
        avgDuration: 0
      });
    }

    const stats = this.commandStats.get(commandName);
    
    switch (type) {
      case 'executed':
        stats.executed += value;
        break;
      case 'success':
        stats.success += value;
        break;
      case 'error':
        stats.error += value;
        break;
      case 'duration':
        stats.duration += value;
        stats.avgDuration = stats.duration / stats.executed;
        break;
    }
    
    this.commandStats.set(commandName, stats);
  }

  /**
   * Get command statistics
   * @param {string} commandName - Command name (optional)
   * @returns {Object} Command statistics
   */
  getCommandStats(commandName = null) {
    if (commandName) {
      return this.commandStats.get(commandName) || null;
    }
    
    return Object.fromEntries(this.commandStats);
  }

  /**
   * Get command by name
   * @param {string} name - Command name
   * @returns {BaseCommand|null}
   */
  getCommand(name) {
    return this.commands.get(name) || null;
  }

  /**
   * Get all commands
   * @returns {Collection} All commands
   */
  getAllCommands() {
    return this.commands;
  }

  /**
   * Get commands by category
   * @param {string} category - Command category
   * @returns {Array} Commands in category
   */
  getCommandsByCategory(category) {
    return Array.from(this.commands.values()).filter(cmd => cmd.category === category);
  }

  /**
   * Reload specific command
   * @param {string} name - Command name
   */
  async reloadCommand(name) {
    const command = this.commands.get(name);
    if (!command) {
      logger.warn(`Command ${name} not found for reloading`);
      return;
    }

    // Get command path
    const commandPath = path.join(__dirname, '../commands', command.category, `${name}.js`);
    if (!fs.existsSync(commandPath)) {
      logger.warn(`Command file not found: ${commandPath}`);
      return;
    }

    // Unregister old command
    await this.unregisterCommand(name);

    // Reload command
    delete require.cache[require.resolve(commandPath)];
    const CommandClass = require(commandPath);
    const newCommand = new CommandClass(this.client);
    newCommand.category = command.category;

    // Register new command
    await this.registerCommand(newCommand);
    logger.debug(`Reloaded command: ${name}`);
  }

  /**
   * Enable command
   * @param {string} name - Command name
   */
  async enableCommand(name) {
    const command = this.commands.get(name);
    if (!command) {
      logger.warn(`Command ${name} not found for enabling`);
      return;
    }

    command.enabled = true;
    logger.debug(`Enabled command: ${name}`);
  }

  /**
   * Disable command
   * @param {string} name - Command name
   */
  async disableCommand(name) {
    const command = this.commands.get(name);
    if (!command) {
      logger.warn(`Command ${name} not found for disabling`);
      return;
    }

    command.enabled = false;
    logger.debug(`Disabled command: ${name}`);
  }

  /**
   * Get command handler status
   * @returns {Object} Status information
   */
  getStatus() {
    const totalCommands = this.commands.size;
    const enabledCommands = Array.from(this.commands.values()).filter(cmd => cmd.enabled).length;
    const totalExecutions = Array.from(this.commandStats.values()).reduce((sum, stats) => sum + stats.executed, 0);
    const totalErrors = Array.from(this.commandStats.values()).reduce((sum, stats) => sum + stats.error, 0);

    return {
      totalCommands,
      enabledCommands,
      disabledCommands: totalCommands - enabledCommands,
      totalAliases: this.aliases.size,
      totalExecutions,
      totalErrors,
      errorRate: totalExecutions > 0 ? (totalErrors / totalExecutions * 100).toFixed(2) + '%' : '0%',
      activeCooldowns: Array.from(this.cooldowns.values()).reduce((sum, cooldown) => sum + cooldown.size, 0),
      enabled: this.enabled
    };
  }

  /**
   * Shutdown command handler
   */
  async shutdown() {
    logger.info('Shutting down command handler');
    
    this.commands.clear();
    this.aliases.clear();
    this.cooldowns.clear();
    this.commandStats.clear();
    
    logger.info('Command handler shutdown complete');
  }
}

module.exports = CommandHandler;
