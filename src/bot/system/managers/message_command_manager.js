/**
 * Message Command Manager
 * 
 * Handles legacy message commands: prefix, regex, mention-based, aliases
 */

const { Collection } = require('discord.js');
const logger = require('../helpers/logger_helper');
const { handleCommandError } = require('../helpers/error_handler_helper');

class MessageCommandManager {
    /**
     * Create a new MessageCommandManager instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.prefix_commands = new Collection();
        this.regex_commands = new Collection();
        this.mention_commands = new Collection();
        this.command_groups = new Collection();
        this.argument_parser = null;
    }

    /**
     * Register a prefix command
     * @param {string} name - Command name
     * @param {Function} handler - Command handler
     * @param {Object} options - Command options
     * @returns {void}
     */
    register_prefix_command(name, handler, options = {}) {
        const aliases = options.aliases || [];
        const all_names = [name, ...aliases];

        all_names.forEach((cmd_name) => {
            this.prefix_commands.set(cmd_name, {
                name,
                handler,
                prefix: options.prefix || '!',
                aliases,
                cooldown: options.cooldown || 0,
                permissions: options.permissions || [],
                group: options.group || null,
            });
        });

        logger.debug(`Registered prefix command: ${name} (aliases: ${aliases.join(', ')})`);
    }

    /**
     * Register a regex command
     * @param {RegExp} pattern - Regex pattern
     * @param {Function} handler - Command handler
     * @param {Object} options - Command options
     * @returns {void}
     */
    register_regex_command(pattern, handler, options = {}) {
        this.regex_commands.set(pattern.toString(), {
            pattern,
            handler,
            cooldown: options.cooldown || 0,
            permissions: options.permissions || [],
        });

        logger.debug(`Registered regex command: ${pattern.toString()}`);
    }

    /**
     * Register a mention-based command
     * @param {string} trigger - Trigger text (after mention)
     * @param {Function} handler - Command handler
     * @param {Object} options - Command options
     * @returns {void}
     */
    register_mention_command(trigger, handler, options = {}) {
        this.mention_commands.set(trigger.toLowerCase(), {
            trigger,
            handler,
            cooldown: options.cooldown || 0,
            permissions: options.permissions || [],
        });

        logger.debug(`Registered mention command: ${trigger}`);
    }

    /**
     * Create a command group
     * @param {string} group_name - Group name
     * @param {Object} options - Group options
     * @returns {void}
     */
    create_command_group(group_name, options = {}) {
        this.command_groups.set(group_name, {
            name: group_name,
            prefix: options.prefix || null,
            commands: new Collection(),
            permissions: options.permissions || [],
        });

        logger.debug(`Created command group: ${group_name}`);
    }

    /**
     * Add command to group
     * @param {string} group_name - Group name
     * @param {string} command_name - Command name
     * @returns {void}
     */
    add_to_group(group_name, command_name) {
        const group = this.command_groups.get(group_name);
        if (!group) {
            throw new Error(`Group ${group_name} not found`);
        }

        const command = this.prefix_commands.get(command_name);
        if (!command) {
            throw new Error(`Command ${command_name} not found`);
        }

        group.commands.set(command_name, command);
        logger.debug(`Added command ${command_name} to group ${group_name}`);
    }

    /**
     * Parse command arguments
     * @param {string} content - Message content
     * @param {Object} options - Parser options
     * @returns {Object} Parsed arguments
     */
    parse_arguments(content, options = {}) {
        const parser = this.argument_parser || this._default_argument_parser;
        return parser(content, options);
    }

    /**
     * Default argument parser
     * @param {string} content - Message content
     * @param {Object} options - Parser options
     * @returns {Object} Parsed arguments
     * @private
     */
    _default_argument_parser(content, options = {}) {
        const args = [];
        const flags = {};
        let current_arg = '';
        let in_quotes = false;
        let quote_char = null;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const next_char = content[i + 1];

            // Handle quotes
            if ((char === '"' || char === "'") && !in_quotes) {
                in_quotes = true;
                quote_char = char;
                continue;
            }

            if (char === quote_char && in_quotes) {
                in_quotes = false;
                quote_char = null;
                if (current_arg.trim()) {
                    args.push(current_arg.trim());
                    current_arg = '';
                }
                continue;
            }

            // Handle flags (--flag or -f)
            if (!in_quotes && char === '-' && next_char === '-') {
                // Long flag: --flag
                if (current_arg.trim()) {
                    args.push(current_arg.trim());
                    current_arg = '';
                }
                i += 2; // Skip '--'
                let flag_name = '';
                while (i < content.length && content[i] !== ' ' && content[i] !== '=') {
                    flag_name += content[i];
                    i++;
                }
                if (content[i] === '=') {
                    i++;
                    let flag_value = '';
                    while (i < content.length && content[i] !== ' ') {
                        flag_value += content[i];
                        i++;
                    }
                    flags[flag_name] = flag_value || true;
                } else {
                    flags[flag_name] = true;
                }
                i--; // Adjust for loop increment
                continue;
            }

            if (!in_quotes && char === '-' && next_char !== '-') {
                // Short flag: -f
                if (current_arg.trim()) {
                    args.push(current_arg.trim());
                    current_arg = '';
                }
                i++; // Skip '-'
                const flag_name = content[i];
                flags[flag_name] = true;
                continue;
            }

            // Handle spaces
            if (char === ' ' && !in_quotes) {
                if (current_arg.trim()) {
                    args.push(current_arg.trim());
                    current_arg = '';
                }
                continue;
            }

            current_arg += char;
        }

        // Add last argument
        if (current_arg.trim()) {
            args.push(current_arg.trim());
        }

        return {
            args,
            flags,
            raw: content,
        };
    }

    /**
     * Set custom argument parser
     * @param {Function} parser - Custom parser function
     * @returns {void}
     */
    set_argument_parser(parser) {
        this.argument_parser = parser;
    }

    /**
     * Handle message command
     * @param {Message} message - Discord message
     * @returns {Promise<void>}
     */
    async handle_message(message) {
        // Skip bot messages
        if (message.author.bot) {
            return;
        }

        // Check if bot is mentioned
        const bot_mentioned = message.mentions.has(this.client.user);
        const content = message.content.trim();

        // Try mention commands first
        if (bot_mentioned) {
            const mention_text = content
                .replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '')
                .trim()
                .toLowerCase();

            for (const [trigger, command] of this.mention_commands.entries()) {
                if (mention_text.startsWith(trigger)) {
                    const args = mention_text.slice(trigger.length).trim();
                    const parsed = this.parse_arguments(args);
                    await this._execute_command(message, command, parsed);
                    return;
                }
            }
        }

        // Try prefix commands
        for (const [name, command] of this.prefix_commands.entries()) {
            const prefix = command.prefix;
            if (content.startsWith(prefix + name)) {
                const args = content.slice((prefix + name).length).trim();
                const parsed = this.parse_arguments(args);
                await this._execute_command(message, command, parsed);
                return;
            }
        }

        // Try regex commands
        for (const [, command] of this.regex_commands.values()) {
            const match = content.match(command.pattern);
            if (match) {
                await this._execute_command(message, command, { match, groups: match.groups || {} });
                return;
            }
        }
    }

    /**
     * Execute a command
     * @param {Message} message - Discord message
     * @param {Object} command - Command definition
     * @param {Object} parsed - Parsed arguments
     * @private
     */
    async _execute_command(message, command, parsed) {
        try {
            // Check permissions
            if (command.permissions && command.permissions.length > 0) {
                if (!message.member) {
                    return; // DMs don't have member
                }

                const has_permissions = command.permissions.every((perm) =>
                    message.member.permissions.has(perm)
                );

                if (!has_permissions) {
                    await message.reply("❌ You don't have permission to use this command.");
                    return;
                }
            }

            // Check cooldown
            if (command.cooldown && command.cooldown > 0) {
                const cooldown_key = `${command.name || 'regex'}-${message.author.id}`;
                const cooldown = this.client.messageCommandCooldowns?.get(cooldown_key);

                if (cooldown && cooldown > Date.now()) {
                    const remaining = Math.ceil((cooldown - Date.now()) / 1000);
                    await message.reply(`⏳ Please wait ${remaining} second(s) before using this command again.`);
                    return;
                }

                if (!this.client.messageCommandCooldowns) {
                    this.client.messageCommandCooldowns = new Collection();
                }

                this.client.messageCommandCooldowns.set(
                    cooldown_key,
                    Date.now() + command.cooldown * 1000
                );

                setTimeout(() => {
                    this.client.messageCommandCooldowns?.delete(cooldown_key);
                }, command.cooldown * 1000);
            }

            // Execute command
            await command.handler(message, parsed);
        } catch (error) {
            logger.error('Error executing message command', {
                error: error.message,
                command: command.name || 'regex',
                user: message.author.tag,
            });

            await message.reply('❌ An error occurred while executing this command.');
        }
    }

    /**
     * Get all registered commands
     * @returns {Object} All commands grouped by type
     */
    get_all_commands() {
        return {
            prefix: Array.from(this.prefix_commands.values()),
            regex: Array.from(this.regex_commands.values()),
            mention: Array.from(this.mention_commands.values()),
            groups: Array.from(this.command_groups.values()),
        };
    }
}

module.exports = MessageCommandManager;
