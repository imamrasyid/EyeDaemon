/**
 * Command Manager
 * 
 * Manages all command types: slash commands, context menus, and legacy message commands
 */

const { Collection } = require('discord.js');
const { PermissionFlagsBits } = require('discord.js');
const logger = require('../helpers/logger_helper');
const { handleCommandError } = require('../helpers/error_handler_helper');

class CommandManager {
    /**
     * Create a new CommandManager instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.slash_commands = new Collection();
        this.context_menu_commands = new Collection();
        this.message_commands = new Collection();
        this.command_cooldowns = new Collection();
        this.command_stats = new Collection();
    }

    /**
     * Register a slash command
     * @param {Object} command - Command definition
     * @returns {void}
     */
    register_slash_command(command) {
        if (!command.name || !command.execute) {
            throw new Error('Command must have name and execute function');
        }

        this.slash_commands.set(command.name, {
            ...command,
            type: 'slash',
            cooldown: command.cooldown || 0,
            permissions: command.permissions || [],
            localization: command.localization || {},
        });

        logger.debug(`Registered slash command: ${command.name}`);
    }

    /**
     * Register a context menu command
     * @param {Object} command - Command definition
     * @returns {void}
     */
    register_context_menu_command(command) {
        if (!command.name || !command.type || !command.execute) {
            throw new Error('Context menu command must have name, type, and execute function');
        }

        this.context_menu_commands.set(command.name, {
            ...command,
            type: 'context_menu',
            cooldown: command.cooldown || 0,
            permissions: command.permissions || [],
        });

        logger.debug(`Registered context menu command: ${command.name} (${command.type})`);
    }

    /**
     * Register a message command (prefix-based)
     * @param {Object} command - Command definition
     * @returns {void}
     */
    register_message_command(command) {
        if (!command.name || !command.execute) {
            throw new Error('Message command must have name and execute function');
        }

        const aliases = command.aliases || [];
        const all_names = [command.name, ...aliases];

        all_names.forEach((name) => {
            this.message_commands.set(name, {
                ...command,
                type: 'message',
                cooldown: command.cooldown || 0,
                permissions: command.permissions || [],
                prefix: command.prefix || '!',
            });
        });

        logger.debug(`Registered message command: ${command.name} (aliases: ${aliases.join(', ')})`);
    }

    /**
     * Execute a slash command
     * @param {Interaction} interaction - Discord interaction
     * @returns {Promise<void>}
     */
    async execute_slash_command(interaction) {
        const command = this.slash_commands.get(interaction.commandName);

        if (!command) {
            await interaction.reply({
                content: '❌ Command not found.',
                ephemeral: true,
            });
            return;
        }

        // Check permissions
        if (!(await this._check_permissions(interaction, command))) {
            return;
        }

        // Check cooldown
        if (!(await this._check_cooldown(interaction, command))) {
            return;
        }

        // Execute command
        try {
            await command.execute(interaction);
            this._record_command_usage(interaction.commandName, interaction.guildId);
        } catch (error) {
            await handleCommandError(error, interaction, {
                commandType: 'slash',
            });
        }
    }

    /**
     * Execute a context menu command
     * @param {Interaction} interaction - Discord interaction
     * @returns {Promise<void>}
     */
    async execute_context_menu_command(interaction) {
        const command = this.context_menu_commands.get(interaction.commandName);

        if (!command) {
            await interaction.reply({
                content: '❌ Command not found.',
                ephemeral: true,
            });
            return;
        }

        // Check permissions
        if (!(await this._check_permissions(interaction, command))) {
            return;
        }

        // Check cooldown
        if (!(await this._check_cooldown(interaction, command))) {
            return;
        }

        // Execute command
        try {
            await command.execute(interaction);
            this._record_command_usage(interaction.commandName, interaction.guildId);
        } catch (error) {
            await handleCommandError(error, interaction, {
                commandType: 'context_menu',
            });
        }
    }

    /**
     * Execute a message command
     * @param {Message} message - Discord message
     * @param {string} command_name - Command name
     * @param {Array} args - Command arguments
     * @returns {Promise<void>}
     */
    async execute_message_command(message, command_name, args) {
        const command = this.message_commands.get(command_name);

        if (!command) {
            return;
        }

        // Check permissions
        if (!(await this._check_message_permissions(message, command))) {
            return;
        }

        // Check cooldown
        if (!(await this._check_message_cooldown(message, command))) {
            return;
        }

        // Execute command
        try {
            await command.execute(message, args);
            this._record_command_usage(command_name, message.guildId);
        } catch (error) {
            logger.error('Error executing message command', {
                error: error.message,
                command: command_name,
                user: message.author.tag,
            });

            await message.reply('❌ An error occurred while executing this command.');
        }
    }

    /**
     * Check if user has required permissions
     * @param {Interaction} interaction - Discord interaction
     * @param {Object} command - Command definition
     * @returns {Promise<boolean>}
     * @private
     */
    async _check_permissions(interaction, command) {
        if (!command.permissions || command.permissions.length === 0) {
            return true;
        }

        if (!interaction.member) {
            return true; // DMs don't have member
        }

        const member_permissions = interaction.member.permissions;
        const has_permissions = command.permissions.every((perm) =>
            member_permissions.has(perm)
        );

        if (!has_permissions) {
            await interaction.reply({
                content: `❌ You don't have permission to use this command. Required: ${command.permissions.join(', ')}`,
                ephemeral: true,
            });
            return false;
        }

        return true;
    }

    /**
     * Check if user has required permissions for message command
     * @param {Message} message - Discord message
     * @param {Object} command - Command definition
     * @returns {Promise<boolean>}
     * @private
     */
    async _check_message_permissions(message, command) {
        if (!command.permissions || command.permissions.length === 0) {
            return true;
        }

        if (!message.member) {
            return true; // DMs don't have member
        }

        const member_permissions = message.member.permissions;
        const has_permissions = command.permissions.every((perm) =>
            member_permissions.has(perm)
        );

        if (!has_permissions) {
            await message.reply(
                `❌ You don't have permission to use this command.`
            );
            return false;
        }

        return true;
    }

    /**
     * Check command cooldown
     * @param {Interaction} interaction - Discord interaction
     * @param {Object} command - Command definition
     * @returns {Promise<boolean>}
     * @private
     */
    async _check_cooldown(interaction, command) {
        if (!command.cooldown || command.cooldown === 0) {
            return true;
        }

        const cooldown_key = `${command.name}-${interaction.user.id}`;
        const cooldown = this.command_cooldowns.get(cooldown_key);

        if (cooldown && cooldown > Date.now()) {
            const remaining = Math.ceil((cooldown - Date.now()) / 1000);
            await interaction.reply({
                content: `⏳ Please wait ${remaining} second(s) before using this command again.`,
                ephemeral: true,
            });
            return false;
        }

        this.command_cooldowns.set(
            cooldown_key,
            Date.now() + command.cooldown * 1000
        );

        // Clean up old cooldowns
        setTimeout(() => {
            this.command_cooldowns.delete(cooldown_key);
        }, command.cooldown * 1000);

        return true;
    }

    /**
     * Check message command cooldown
     * @param {Message} message - Discord message
     * @param {Object} command - Command definition
     * @returns {Promise<boolean>}
     * @private
     */
    async _check_message_cooldown(message, command) {
        if (!command.cooldown || command.cooldown === 0) {
            return true;
        }

        const cooldown_key = `${command.name}-${message.author.id}`;
        const cooldown = this.command_cooldowns.get(cooldown_key);

        if (cooldown && cooldown > Date.now()) {
            const remaining = Math.ceil((cooldown - Date.now()) / 1000);
            await message.reply(
                `⏳ Please wait ${remaining} second(s) before using this command again.`
            );
            return false;
        }

        this.command_cooldowns.set(
            cooldown_key,
            Date.now() + command.cooldown * 1000
        );

        // Clean up old cooldowns
        setTimeout(() => {
            this.command_cooldowns.delete(cooldown_key);
        }, command.cooldown * 1000);

        return true;
    }

    /**
     * Record command usage for statistics
     * @param {string} command_name - Command name
     * @param {string} guild_id - Guild ID
     * @private
     */
    _record_command_usage(command_name, guild_id) {
        const key = `${command_name}-${guild_id || 'dm'}`;
        const stats = this.command_stats.get(key) || {
            count: 0,
            last_used: null,
        };

        stats.count++;
        stats.last_used = new Date();

        this.command_stats.set(key, stats);
    }

    /**
     * Get command statistics
     * @returns {Object} Command statistics
     */
    get_statistics() {
        return {
            slash_commands: this.slash_commands.size,
            context_menu_commands: this.context_menu_commands.size,
            message_commands: this.message_commands.size,
            total_usage: Array.from(this.command_stats.values()).reduce(
                (sum, stat) => sum + stat.count,
                0
            ),
        };
    }

    /**
     * Get all registered commands
     * @returns {Object} All commands grouped by type
     */
    get_all_commands() {
        return {
            slash: Array.from(this.slash_commands.values()),
            context_menu: Array.from(this.context_menu_commands.values()),
            message: Array.from(this.message_commands.values()),
        };
    }
}

module.exports = CommandManager;
