/**
 * BaseInteraction Class
 * 
 * Base class for all interaction handlers (buttons, modals, select menus).
 * Provides common functionality for handling Discord UI component interactions.
 */

class BaseInteraction {
    /**
     * Create a new BaseInteraction instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Interaction configuration options
     * @param {string} options.customId - Custom ID for the interaction
     * @param {string} options.type - Interaction type ('button', 'modal', 'selectMenu')
     * @param {boolean} options.ephemeral - Whether responses should be ephemeral by default
     */
    constructor(client, options = {}) {
        this.client = client;
        this.customId = options.customId;
        this.type = options.type || 'button';
        this.ephemeral = options.ephemeral !== undefined ? options.ephemeral : false;
        this.logger = client.logger || console;
        this.interactionName = this.constructor.name;
    }

    /**
     * Execute the interaction handler
     * Override this method in child classes to implement interaction logic
     * @param {Object} interaction - Discord interaction object
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        throw new Error(`execute() method must be implemented in ${this.interactionName}`);
    }

    /**
     * Validate the interaction before execution
     * Override this method in child classes for custom validation
     * @param {Object} interaction - Discord interaction object
     * @returns {Promise<boolean>} True if validation passes
     */
    async validate(interaction) {
        // Default validation - check if user is in a guild
        if (!interaction.guild) {
            await this.sendError(interaction, 'This interaction can only be used in a server');
            return false;
        }

        return true;
    }

    /**
     * Handle errors that occur during interaction execution
     * @param {Object} interaction - Discord interaction object
     * @param {Error} error - Error object
     * @returns {Promise<void>}
     */
    async handleError(interaction, error) {
        this.log(
            `Error handling interaction: ${error.message}`,
            'error',
            {
                customId: this.customId,
                type: this.type,
                user: interaction.user?.tag,
                guild: interaction.guild?.name,
                error: error.message,
                stack: error.stack,
            }
        );

        // Send user-friendly error message
        const errorMessage = '❌ An error occurred while processing your interaction. Please try again.';

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage });
            }
        } catch (replyError) {
            this.log(
                `Failed to send error message: ${replyError.message}`,
                'error',
                { error: replyError.message }
            );
        }
    }

    /**
     * Log message with interaction context
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, warn, error, debug)
     * @param {Object} metadata - Additional metadata to log
     */
    log(message, level = 'info', metadata = {}) {
        const prefix = `[${this.interactionName}]`;
        const logMessage = `${prefix} ${message}`;

        if (this.logger && typeof this.logger[level] === 'function') {
            if (Object.keys(metadata).length > 0) {
                this.logger[level](logMessage, metadata);
            } else {
                this.logger[level](logMessage);
            }
        } else {
            console[level](logMessage, metadata);
        }
    }

    /**
     * Send error response to interaction
     * @param {Object} interaction - Discord interaction object
     * @param {string} message - Error message
     * @param {boolean} ephemeral - Whether message should be ephemeral
     * @returns {Promise<void>}
     */
    async sendError(interaction, message, ephemeral = true) {
        const errorMessage = `❌ ${message}`;

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: errorMessage, ephemeral });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral });
            }
        } catch (error) {
            this.log(`Failed to send error message: ${error.message}`, 'error');
        }
    }

    /**
     * Send success response to interaction
     * @param {Object} interaction - Discord interaction object
     * @param {string} message - Success message
     * @param {boolean} ephemeral - Whether message should be ephemeral
     * @returns {Promise<void>}
     */
    async sendSuccess(interaction, message, ephemeral = false) {
        const successMessage = `✅ ${message}`;

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: successMessage, ephemeral });
            } else {
                await interaction.reply({ content: successMessage, ephemeral });
            }
        } catch (error) {
            this.log(`Failed to send success message: ${error.message}`, 'error');
        }
    }

    /**
     * Defer the interaction reply
     * @param {Object} interaction - Discord interaction object
     * @param {boolean} ephemeral - Whether the deferred reply should be ephemeral
     * @returns {Promise<void>}
     */
    async defer(interaction, ephemeral = this.ephemeral) {
        try {
            if (interaction.isButton() || interaction.isStringSelectMenu()) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply({ ephemeral });
            }
        } catch (error) {
            this.log(`Failed to defer interaction: ${error.message}`, 'error');
        }
    }

    /**
     * Check if user has required permissions
     * @param {Object} interaction - Discord interaction object
     * @param {Array<string>} permissions - Required permissions
     * @returns {boolean} True if user has all required permissions
     */
    hasPermissions(interaction, permissions = []) {
        if (!interaction.member || !interaction.guild) {
            return false;
        }

        return permissions.every(permission =>
            interaction.member.permissions.has(permission)
        );
    }

    /**
     * Check if user is in the same voice channel as the bot
     * @param {Object} interaction - Discord interaction object
     * @returns {boolean} True if user is in same voice channel
     */
    isInSameVoiceChannel(interaction) {
        if (!interaction.member?.voice?.channel) {
            return false;
        }

        const botVoiceChannel = interaction.guild?.members?.me?.voice?.channel;
        if (!botVoiceChannel) {
            return false;
        }

        return interaction.member.voice.channel.id === botVoiceChannel.id;
    }

    /**
     * Get guild state
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Guild state or null
     */
    getGuildState(guildId) {
        if (!this.client || !this.client.guildStates) {
            return null;
        }
        return this.client.guildStates.get(guildId) || null;
    }

    /**
     * Set guild state
     * @param {string} guildId - Guild ID
     * @param {Object} state - State object to set
     */
    setGuildState(guildId, state) {
        if (!this.client.guildStates) {
            this.client.guildStates = new Map();
        }
        this.client.guildStates.set(guildId, state);
    }

    /**
     * Get database connection from client
     * @returns {Object|null} Database connection or null
     */
    getDatabase() {
        if (this.client && this.client.database) {
            return this.client.database;
        }
        return null;
    }

    /**
     * Validate required fields in interaction
     * @param {Object} interaction - Discord interaction object
     * @param {Array<string>} fields - Required field names
     * @throws {Error} If required fields are missing
     */
    validateRequired(interaction, fields = []) {
        const missing = fields.filter(field => {
            const value = interaction[field];
            return value === undefined || value === null;
        });

        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
    }
}

module.exports = BaseInteraction;
