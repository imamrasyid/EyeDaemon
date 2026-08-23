/**
 * Controller Base Class
 * 
 * Base class for all controllers in the application.
 * Provides loader instance, config access, and centralized ResponseHelper.
 * Inspired by CodeIgniter's Controller pattern.
 */

const Loader = require('./Loader');
const ResponseHelper = require('../helpers/ResponseHelper');

class Controller {
    /**
     * Create a new Controller instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;

        // Initialize loader for dynamic loading of models, libraries, and helpers
        this.load = new Loader(this);

        // Centralized response & templating engine
        this.response = ResponseHelper;

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
     * Send error response to interaction using standardized visual embed
     * @param {Object} interaction - Discord interaction
     * @param {string} message - Error message
     * @param {boolean} ephemeral - Whether message should be ephemeral
     */
    async sendError(interaction, message, ephemeral = true) {
        try {
            const embed = ResponseHelper.error('Error Occurred', message);
            await ResponseHelper.send(interaction, embed, { ephemeral });
        } catch (error) {
            this.log(`Failed to send error message: ${error.message}`, 'error');
        }
    }

    /**
     * Send success response to interaction using standardized visual embed
     * @param {Object} interaction - Discord interaction
     * @param {string} message - Success message
     * @param {boolean} ephemeral - Whether message should be ephemeral
     */
    async sendSuccess(interaction, message, ephemeral = false) {
        try {
            const embed = ResponseHelper.success('Action Successful', message);
            await ResponseHelper.send(interaction, embed, { ephemeral });
        } catch (error) {
            this.log(`Failed to send success message: ${error.message}`, 'error');
        }
    }
}

module.exports = Controller;
