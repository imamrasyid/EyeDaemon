/**
 * InteractionCreate Event Handler
 * 
 * Fired when an interaction is created (slash commands, buttons, modals, etc.).
 * Routes interactions to appropriate controllers or interaction handlers.
 */

const BaseEvent = require('../../system/core/BaseEvent');
const { replyEphemeral } = require('../../system/helpers/interaction_helper');

class InteractionCreateEvent extends BaseEvent {
    constructor(client) {
        super(client, {
            name: 'interactionCreate',
            once: false,
        });
    }

    async execute(interaction) {
        try {
            // Handle different interaction types
            if (interaction.isChatInputCommand()) {
                await this.handleCommand(interaction);
            } else if (interaction.isButton()) {
                await this.handleButton(interaction);
            } else if (interaction.isModalSubmit()) {
                await this.handleModal(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await this.handleSelectMenu(interaction);
            } else if (interaction.isUserContextMenuCommand()) {
                await this.handleUserContextMenu(interaction);
            } else if (interaction.isMessageContextMenuCommand()) {
                await this.handleMessageContextMenu(interaction);
            }
        } catch (error) {
            this.log('Error handling interaction', 'error', {
                type: interaction.type,
                error: error.message,
                stack: error.stack,
            });

            // Send error response to user
            await this.sendErrorResponse(interaction);
        }
    }

    /**
     * Handle slash command interactions
     * @param {Object} interaction - Discord interaction object
     */
    async handleCommand(interaction) {
        const modules = this.client.modules || new Map();
        const controllers = this.client.controllers || new Map();
        let commandFound = false;

        for (const [, module] of modules) {
            const command = module.commands.find(
                (cmd) => cmd.name === interaction.commandName
            );

            if (command) {
                commandFound = true;

                // Get the controller instance
                const controller = controllers.get(command.controller);

                if (!controller) {
                    this.log(`Controller not found: ${command.controller}`, 'error');
                    await replyEphemeral(interaction, '❌ Command handler not found');
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
                            command: interaction.commandName,
                            controller: command.controller,
                            method: command.method,
                            actualType: actualType,
                            availableMethods: availableMethods,
                            user: interaction.user.tag,
                            guild: interaction.guild?.name || 'DM',
                        }
                    );
                    await replyEphemeral(interaction, '❌ Command method not implemented');
                    break;
                }

                // Execute the controller method
                this.log(
                    `Executing command: ${interaction.commandName} (${command.controller}.${command.method})`,
                    'info',
                    {
                        user: interaction.user.tag,
                        guild: interaction.guild?.name || 'DM',
                    }
                );

                await controller[command.method](interaction);
                break;
            }
        }

        if (!commandFound) {
            this.log(`Unknown command: ${interaction.commandName}`, 'warn');
            await replyEphemeral(interaction, '❌ Unknown command');
        }
    }

    /**
     * Handle button interactions
     * @param {Object} interaction - Discord interaction object
     */
    async handleButton(interaction) {
        this.log(`Button interaction: ${interaction.customId}`, 'debug', {
            user: interaction.user.tag,
            guild: interaction.guild?.name || 'DM',
        });

        // Route to interaction manager
        const interactionManager = this.client.interactionManager;
        if (interactionManager) {
            await interactionManager.handleInteraction(interaction);
        } else {
            await replyEphemeral(interaction, '❌ Interaction manager not initialized');
        }
    }

    /**
     * Handle modal submit interactions
     * @param {Object} interaction - Discord interaction object
     */
    async handleModal(interaction) {
        this.log(`Modal interaction: ${interaction.customId}`, 'debug', {
            user: interaction.user.tag,
            guild: interaction.guild?.name || 'DM',
        });

        // Route to interaction components manager
        const interactionComponentsManager = this.client.interactionComponentsManager;
        if (interactionComponentsManager) {
            await interactionComponentsManager.handle_modal(interaction);
        } else {
            // Fallback to interaction manager
            const interactionManager = this.client.interactionManager;
            if (interactionManager) {
                await interactionManager.handleInteraction(interaction);
            } else {
                await replyEphemeral(interaction, '❌ Interaction manager not initialized');
            }
        }
    }

    /**
     * Handle select menu interactions
     * @param {Object} interaction - Discord interaction object
     */
    async handleSelectMenu(interaction) {
        this.log(`Select menu interaction: ${interaction.customId}`, 'debug', {
            user: interaction.user.tag,
            guild: interaction.guild?.name || 'DM',
        });

        // Route to interaction components manager
        const interactionComponentsManager = this.client.interactionComponentsManager;
        if (interactionComponentsManager) {
            await interactionComponentsManager.handle_select_menu(interaction);
        } else {
            // Fallback to interaction manager
            const interactionManager = this.client.interactionManager;
            if (interactionManager) {
                await interactionManager.handleInteraction(interaction);
            } else {
                await replyEphemeral(interaction, '❌ Interaction manager not initialized');
            }
        }
    }

    /**
     * Handle user context menu interactions
     * @param {Object} interaction - Discord interaction object
     */
    async handleUserContextMenu(interaction) {
        this.log(`User context menu: ${interaction.commandName}`, 'debug', {
            user: interaction.user.tag,
            target: interaction.targetUser.tag,
            guild: interaction.guild?.name || 'DM',
        });

        // Route to command manager
        const commandManager = this.client.commandManager;
        if (commandManager) {
            await commandManager.execute_context_menu_command(interaction);
        } else {
            await replyEphemeral(interaction, '❌ Command manager not initialized');
        }
    }

    /**
     * Handle message context menu interactions
     * @param {Object} interaction - Discord interaction object
     */
    async handleMessageContextMenu(interaction) {
        this.log(`Message context menu: ${interaction.commandName}`, 'debug', {
            user: interaction.user.tag,
            target: interaction.targetMessage.id,
            guild: interaction.guild?.name || 'DM',
        });

        // Route to command manager
        const commandManager = this.client.commandManager;
        if (commandManager) {
            await commandManager.execute_context_menu_command(interaction);
        } else {
            await replyEphemeral(interaction, '❌ Command manager not initialized');
        }
    }

    /**
     * Send error response to user
     * @param {Object} interaction - Discord interaction object
     */
    async sendErrorResponse(interaction) {
        try {
            await replyEphemeral(interaction, '❌ An error occurred while executing this command');
        } catch (replyError) {
            this.log('Failed to send error message', 'error', {
                error: replyError.message,
            });
        }
    }

    /**
     * Get error context from interaction
     * @param {Array} args - Event arguments
     * @returns {Object} Context object
     */
    getErrorContext(args) {
        const interaction = args[0];
        return {
            user: interaction?.user?.tag,
            userId: interaction?.user?.id,
            guild: interaction?.guild?.name,
            guildId: interaction?.guild?.id,
            channelId: interaction?.channel?.id,
            type: interaction?.type,
            customId: interaction?.customId,
        };
    }
}

module.exports = InteractionCreateEvent;
