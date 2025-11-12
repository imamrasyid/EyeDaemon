const { BaseCommand } = require('../../base/BaseCommand');
const { commands: logger } = require('../../services/logging.service');
const CONFIG = require('../../config');

/**
 * Help command - Display available commands and usage information
 */
class HelpCommand extends BaseCommand {
  constructor(client) {
    super(client, {
      name: 'help',
      description: 'Display available commands and usage information',
      category: 'Utility',
      usage: '[command]',
      aliases: ['h', 'commands'],
      cooldown: 5000,
      args: false,
      examples: [
        `${CONFIG.DISCORD.PREFIX}help`,
        `${CONFIG.DISCORD.PREFIX}help play`,
        `${CONFIG.DISCORD.PREFIX}help music`
      ]
    });
  }

  async execute(message, args) {
    try {
      const commandHandler = this.client.commandHandler;
      
      if (args.length === 0) {
        // Show general help
        await this.showGeneralHelp(message);
      } else {
        // Show specific command help
        const commandName = args[0].toLowerCase();
        await this.showCommandHelp(message, commandName);
      }

    } catch (error) {
      logger.error('Error in help command', { 
        error: error.message,
        user: message.author.tag,
        guild: message.guild?.name || 'DM'
      });
      
      await message.reply(this.formatError('An error occurred while displaying help information.'));
    }
  }

  /**
   * Show general help with command categories
   * @param {Message} message - Discord message
   */
  async showGeneralHelp(message) {
    const commands = this.client.commandHandler.getAllCommands();
    const categories = this.groupCommandsByCategory(commands);

    const embed = {
      color: 0x3498db,
      title: '📚 EyeDaemon Bot - Help Menu',
      description: `Use \`${CONFIG.DISCORD.PREFIX}help <command>\` for detailed information about a specific command.`,
      fields: [],
      thumbnail: {
        url: this.client.user.displayAvatarURL({ size: 64 })
      },
      footer: {
        text: `Prefix: ${CONFIG.DISCORD.PREFIX} | Total Commands: ${commands.size}`,
        icon_url: this.client.user.displayAvatarURL()
      },
      timestamp: new Date()
    };

    // Add categories
    for (const [category, categoryCommands] of categories) {
      if (categoryCommands.length === 0) continue;

      const commandList = categoryCommands
        .filter(cmd => cmd.enabled)
        .map(cmd => `\`${cmd.name}\``)
        .join(', ');

      embed.fields.push({
        name: `**${category}** (${categoryCommands.length})`,
        value: commandList || 'No commands available',
        inline: false
      });
    }

    // Add feature status
    const features = this.getFeatureStatus();
    if (features.length > 0) {
      embed.fields.push({
        name: '**🚀 Features**',
        value: features.join('\n'),
        inline: false
      });
    }

    await message.reply({ embeds: [embed] });
  }

  /**
   * Show detailed help for specific command
   * @param {Message} message - Discord message
   * @param {string} commandName - Command name
   */
  async showCommandHelp(message, commandName) {
    const command = this.client.commandHandler.findCommand(commandName);
    
    if (!command) {
      return message.reply(this.formatError(`Command "${commandName}" not found. Use \`${CONFIG.DISCORD.PREFIX}help\` to see available commands.`));
    }

    const help = command.getHelp();
    
    const embed = {
      color: 0x3498db,
      title: `📖 Command: ${help.name}`,
      description: help.description,
      fields: [],
      footer: {
        text: `Category: ${help.category} | Cooldown: ${help.cooldown / 1000}s`,
        icon_url: this.client.user.displayAvatarURL()
      },
      timestamp: new Date()
    };

    // Usage
    if (help.usage) {
      embed.fields.push({
        name: '**📋 Usage**',
        value: `\`${help.usage}\``,
        inline: false
      });
    }

    // Aliases
    if (help.aliases && help.aliases.length > 0) {
      embed.fields.push({
        name: '**🔗 Aliases**',
        value: help.aliases.map(alias => `\`${alias}\``).join(', '),
        inline: false
      });
    }

    // Examples
    if (help.examples && help.examples.length > 0) {
      embed.fields.push({
        name: '**💡 Examples**',
        value: help.examples.map(ex => `\`${ex}\``).join('\n'),
        inline: false
      });
    }

    // Permissions
    if (help.permissions && help.permissions.length > 0) {
      embed.fields.push({
        name: '**🔒 Required Permissions**',
        value: help.permissions.join(', '),
        inline: false
      });
    }

    // Bot permissions
    if (help.botPermissions && help.botPermissions.length > 0) {
      embed.fields.push({
        name: '**🤖 Bot Permissions**',
        value: help.botPermissions.join(', '),
        inline: false
      });
    }

    await message.reply({ embeds: [embed] });
  }

  /**
   * Group commands by category
   * @param {Collection} commands - Commands collection
   * @returns {Map} Commands grouped by category
   */
  groupCommandsByCategory(commands) {
    const categories = new Map();
    
    for (const command of commands.values()) {
      const category = command.category || 'General';
      
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      
      categories.get(category).push(command);
    }

    // Sort categories and commands
    const sortedCategories = new Map(
      Array.from(categories.entries()).sort(([a], [b]) => a.localeCompare(b))
    );

    for (const [category, categoryCommands] of sortedCategories) {
      categoryCommands.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sortedCategories;
  }

  /**
   * Get feature status
   * @returns {Array} Feature status messages
   */
  getFeatureStatus() {
    const features = [];
    
    if (CONFIG.FEATURES.MUSIC) features.push('🎵 Music System');
    if (CONFIG.FEATURES.MODERATION) features.push('🔨 Moderation Tools');
    if (CONFIG.FEATURES.ECONOMY) features.push('💰 Economy System');
    if (CONFIG.FEATURES.LEVELING) features.push('📈 Leveling System');
    if (CONFIG.FEATURES.TICKETS) features.push('🎫 Ticket System');
    if (CONFIG.FEATURES.LOGGING) features.push('📝 Logging System');

    return features.map(feature => `✅ ${feature}`);
  }
}

module.exports = HelpCommand;