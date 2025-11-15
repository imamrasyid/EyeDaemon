/**
 * MessageCreate Event Handler
 * 
 * Fired when a message is created.
 * Handles prefix commands by routing them to appropriate controllers.
 */

const BaseEvent = require('../../system/core/BaseEvent');
const ArgumentParser = require('../../system/helpers/argument_parser_helper');

class MessageCreateEvent extends BaseEvent {
    constructor(client) {
        super(client, {
            name: 'messageCreate',
            once: false,
        });
    }

    async execute(message) {
        // Ignore bot messages
        if (message.author.bot) return;

        // Ignore DMs (no guild)
        if (!message.guild) return;

        try {
            // Get guild-specific prefix from GuildConfigService
            const adminModule = this.client.modules.get('admin');
            const guildConfigService = adminModule?.getService('GuildConfigService');

            let prefix;
            if (guildConfigService) {
                // Get prefix from database (with caching)
                const guildConfig = await guildConfigService.getGuildConfig(message.guild.id);
                prefix = guildConfig.prefix;
            } else {
                // Fallback to default config if service not available
                const config = require('../config/config');
                prefix = config.prefix;
            }

            // Check if message starts with prefix
            if (!message.content.startsWith(prefix)) return;

            // Parse command and arguments
            const args = message.content.slice(prefix.length).trim().split(/\s+/);
            const commandName = args.shift().toLowerCase();

            // Find the command in loaded modules
            await this.handleCommand(message, commandName, args, prefix);
        } catch (error) {
            this.log('Error handling message command', 'error', {
                command: message.content,
                error: error.message,
                stack: error.stack,
            });

            try {
                await message.reply('❌ An error occurred while executing this command');
            } catch (replyError) {
                this.log('Failed to send error message', 'error', {
                    error: replyError.message,
                });
            }
        }
    }

    /**
     * Handle command execution
     * @param {Object} message - Discord message object
     * @param {string} commandName - Command name
     * @param {Array} args - Command arguments
     * @param {string} prefix - Guild-specific prefix
     */
    async handleCommand(message, commandName, args, prefix) {
        const modules = this.client.modules || new Map();
        const controllers = this.client.controllers || new Map();
        let commandFound = false;

        for (const [, module] of modules) {
            const command = module.commands.find(
                (cmd) => cmd.name === commandName || cmd.aliases?.includes(commandName)
            );

            if (command) {
                commandFound = true;

                // Get the controller instance
                const controller = controllers.get(command.controller);

                if (!controller) {
                    this.log(`Controller not found: ${command.controller}`, 'error', {
                        command: commandName,
                        controller: command.controller,
                        user: message.author.tag,
                        guild: message.guild?.name || 'DM',
                    });
                    await message.reply('❌ Command handler not found. Please contact the bot administrator.');
                    break;
                }

                // Check if method exists on controller
                if (typeof controller[command.method] !== 'function') {
                    const actualType = typeof controller[command.method];
                    const availableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller))
                        .filter(m => typeof controller[m] === 'function' && m !== 'constructor');

                    this.log(
                        `Method ${command.method} is ${actualType}, not a function. Available methods: ${availableMethods.join(', ')}`,
                        'error',
                        {
                            command: commandName,
                            controller: command.controller,
                            method: command.method,
                            actualType: actualType,
                            availableMethods: availableMethods,
                            user: message.author.tag,
                            guild: message.guild?.name || 'DM',
                        }
                    );
                    await message.reply('❌ Command method not implemented. Please contact the bot administrator.');
                    break;
                }

                try {
                    // Parse arguments using ArgumentParser
                    const parsedOptions = ArgumentParser.parse(args, command, message.guild);

                    // Validate required options
                    try {
                        ArgumentParser.validate(parsedOptions, command);
                    } catch (validationError) {
                        const usage = ArgumentParser.getUsageString(command, prefix);
                        await message.reply(
                            `❌ ${validationError.message}\n\n**Usage:** \`${usage}\``
                        );
                        return;
                    }

                    // Execute the controller method
                    this.log(
                        `Executing prefix command: ${commandName} (${command.controller}.${command.method})`,
                        'info',
                        {
                            user: message.author.tag,
                            guild: message.guild?.name || 'DM',
                            args: args.join(' '),
                        }
                    );

                    // Create interaction-like adapter for message with parsed options
                    const interactionAdapter = this.createMessageAdapter(message, args, command, parsedOptions);

                    await controller[command.method](interactionAdapter);
                } catch (executionError) {
                    this.log(
                        `Error executing command: ${commandName}`,
                        'error',
                        {
                            command: commandName,
                            controller: command.controller,
                            method: command.method,
                            user: message.author.tag,
                            guild: message.guild?.name || 'DM',
                            error: executionError.message,
                            stack: executionError.stack,
                        }
                    );

                    try {
                        await message.reply(
                            '❌ An error occurred while executing this command. The error has been logged.'
                        );
                    } catch (replyError) {
                        this.log(
                            'Failed to send error message to user',
                            'error',
                            {
                                command: commandName,
                                user: message.author.tag,
                                guild: message.guild?.name || 'DM',
                                error: replyError.message,
                            }
                        );
                    }
                }

                break;
            }
        }

        if (!commandFound) {
            this.log(`Unknown prefix command: ${commandName}`, 'debug');
            // Don't reply for unknown commands to avoid spam
        }
    }

    /**
     * Create interaction-like adapter from message for prefix commands
     * This allows controllers to work with both slash commands and prefix commands
     * @param {Object} message - Discord message
     * @param {Array} args - Command arguments
     * @param {Object} command - Command definition
     * @param {Map<string, any>} parsedOptions - Parsed options from ArgumentParser
     * @returns {Object} Interaction-like object
     */
    createMessageAdapter(message, args, command, parsedOptions = new Map()) {
        let replied = false;
        let deferred = false;

        const adapter = {
            // Basic properties
            user: message.author,
            member: message.member,
            guild: message.guild,
            channel: message.channel,
            channelId: message.channelId,
            guildId: message.guildId,
            commandName: command.name,

            // State flags
            get replied() { return replied; },
            get deferred() { return deferred; },

            // Reply method
            async reply(options) {
                replied = true;
                if (typeof options === 'string') {
                    return await message.reply(options);
                }
                return await message.reply(options);
            },

            // Edit reply method
            async editReply(options) {
                if (typeof options === 'string') {
                    return await message.reply(options);
                }
                return await message.reply(options);
            },

            // Defer reply method
            async deferReply() {
                deferred = true;
                // For messages, we can send a "thinking" message
                await message.channel.sendTyping();
            },

            // Follow up method
            async followUp(options) {
                if (typeof options === 'string') {
                    return await message.reply(options);
                }
                return await message.reply(options);
            },

            // Options getter - simulates interaction.options
            options: {
                getString: (name, required = false) => {
                    const value = parsedOptions.has(name) ? parsedOptions.get(name) : null;
                    if (required && value === null) {
                        throw new Error(`Missing required option: ${name}`);
                    }
                    return value;
                },
                getInteger: (name, required = false) => {
                    const value = parsedOptions.has(name) ? parsedOptions.get(name) : null;
                    if (required && value === null) {
                        throw new Error(`Missing required option: ${name}`);
                    }
                    return value;
                },
                getBoolean: (name, required = false) => {
                    const value = parsedOptions.has(name) ? parsedOptions.get(name) : null;
                    if (required && value === null) {
                        throw new Error(`Missing required option: ${name}`);
                    }
                    return value;
                },
                getNumber: (name, required = false) => {
                    const value = parsedOptions.has(name) ? parsedOptions.get(name) : null;
                    if (required && value === null) {
                        throw new Error(`Missing required option: ${name}`);
                    }
                    return value;
                },
                getUser: (name, required = false) => {
                    const value = parsedOptions.has(name) ? parsedOptions.get(name) : null;
                    if (required && value === null) {
                        throw new Error(`Missing required option: ${name}`);
                    }
                    return value;
                },
                getMember: (name, required = false) => {
                    const user = parsedOptions.get(name);
                    if (required && !user) {
                        throw new Error(`Missing required option: ${name}`);
                    }
                    if (!user) return null;
                    // If we have a user, try to get the member
                    return message.guild?.members.cache.get(user.id) || null;
                },
                getChannel: (name, required = false) => {
                    const value = parsedOptions.has(name) ? parsedOptions.get(name) : null;
                    if (required && value === null) {
                        throw new Error(`Missing required option: ${name}`);
                    }
                    return value;
                },
                getRole: (name, required = false) => {
                    const value = parsedOptions.has(name) ? parsedOptions.get(name) : null;
                    if (required && value === null) {
                        throw new Error(`Missing required option: ${name}`);
                    }
                    return value;
                },
                getSubcommand: (required = false) => {
                    const value = parsedOptions.has('subcommand') ? parsedOptions.get('subcommand') : null;
                    if (required && value === null) {
                        throw new Error('Missing required subcommand');
                    }
                    return value;
                },
                getSubcommandGroup: (required = false) => {
                    const value = parsedOptions.has('subcommandGroup') ? parsedOptions.get('subcommandGroup') : null;
                    if (required && value === null) {
                        throw new Error('Missing required subcommand group');
                    }
                    return value;
                },
            },

            // Check if it's a chat input command
            isChatInputCommand: () => true,

            // Raw message for advanced usage
            _message: message,
            _args: args,
            _parsedOptions: parsedOptions,
        };

        return adapter;
    }

    /**
     * Get error context from message
     * @param {Array} args - Event arguments
     * @returns {Object} Context object
     */
    getErrorContext(args) {
        const message = args[0];
        return {
            user: message?.author?.tag,
            userId: message?.author?.id,
            guild: message?.guild?.name,
            guildId: message?.guild?.id,
            channelId: message?.channel?.id,
        };
    }
}

module.exports = MessageCreateEvent;
