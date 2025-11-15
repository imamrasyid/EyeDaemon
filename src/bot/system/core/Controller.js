/**
 * Controller Base Class
 * 
 * Base class for all controllers in the application.
 * Provides loader instance and config access.
 * Inspired by CodeIgniter's Controller pattern.
 */

const Loader = require('./Loader');

class Controller {
    /**
     * Create a new Controller instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;

        // Initialize loader for dynamic loading of models, libraries, and helpers
        this.load = new Loader(this);

        // Load application config
        try {
            this.appConfig = require('../../application/config/config');
        } catch (error) {
            // Config might not exist yet, set to empty object
            this.appConfig = {};
        }
    }

    /**
     * Get guild state for a specific guild
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Guild state or null if not found
     */
    getGuildState(guildId) {
        if (!this.client.guildStates) {
            return null;
        }
        return this.client.guildStates.get(guildId) || null;
    }

    /**
     * Set guild state for a specific guild
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
     * Clear guild state for a specific guild
     * @param {string} guildId - Guild ID
     */
    clearGuildState(guildId) {
        if (this.client.guildStates) {
            this.client.guildStates.delete(guildId);
        }
    }

    /**
     * Get guild from client
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Guild object or null
     */
    getGuild(guildId) {
        return this.client.guilds.cache.get(guildId) || null;
    }

    /**
     * Log message with controller context
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, warn, error)
     */
    log(message, level = 'info') {
        const prefix = `[${this.constructor.name}]`;

        if (this.client.logger) {
            this.client.logger[level](`${prefix} ${message}`);
        } else {
            console[level](`${prefix} ${message}`);
        }
    }

    /**
     * Send error response to interaction
     * @param {Object} interaction - Discord interaction
     * @param {string} message - Error message
     * @param {boolean} ephemeral - Whether message should be ephemeral
     */
    async sendError(interaction, message, ephemeral = false) {
        const errorMessage = `❌ ${message}`;

        try {
            if (interaction.deferred || interaction.replied) {
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
     * @param {Object} interaction - Discord interaction
     * @param {string} message - Success message
     * @param {boolean} ephemeral - Whether message should be ephemeral
     */
    async sendSuccess(interaction, message, ephemeral = false) {
        const successMessage = `✅ ${message}`;

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: successMessage, ephemeral });
            } else {
                await interaction.reply({ content: successMessage, ephemeral });
            }
        } catch (error) {
            this.log(`Failed to send success message: ${error.message}`, 'error');
        }
    }
}

module.exports = Controller;
