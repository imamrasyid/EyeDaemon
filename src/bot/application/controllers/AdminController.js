/**
 * AdminController
 * 
 * Handles all admin-related commands
 * Delegates to specialized handlers for better separation of concerns
 */

const Controller = require('../../system/core/Controller');
const ConfigHandler = require('./admin/handlers/ConfigHandler');
const HealthHandler = require('./admin/handlers/HealthHandler');
const PerformanceHandler = require('./admin/handlers/PerformanceHandler');

class AdminController extends Controller {
    /**
     * Create a new AdminController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        // Load models
        this.guildModel = this.load.model('GuildModel');

        // Get services
        this.guildConfigService = this.client.services.get('GuildConfigService');
        this.performanceService = this.client.services.get('PerformanceService');

        // Initialize handlers
        this.configHandler = new ConfigHandler(this);
        this.healthHandler = new HealthHandler(this);
        this.performanceHandler = new PerformanceHandler(this);
    }

    // Config commands - delegate to ConfigHandler
    async config(interaction) { return this.configHandler.config(interaction); }

    // Health command - delegate to HealthHandler
    async health(interaction) { return this.healthHandler.health(interaction); }

    // Performance command - delegate to PerformanceHandler
    async performance(interaction) { return this.performanceHandler.performance(interaction); }

    /**
     * Safely reply with error message
     * Handles cases where interaction is already replied or expired
     * @param {Object} interaction - Discord interaction
     * @param {string} message - Error message
     */
    async safeReplyError(interaction, message) {
        try {
            const errorMessage = `❌ ${message}`;

            if (interaction.deferred && !interaction.replied) {
                // Interaction was deferred but not replied yet
                await interaction.editReply({ content: errorMessage });
            } else if (!interaction.replied && !interaction.deferred) {
                // Interaction not deferred and not replied
                await interaction.reply({
                    content: errorMessage,
                    flags: 64 // MessageFlags.Ephemeral
                });
            }
            // If already replied, we can't do anything
        } catch (error) {
            this.log(`Failed to send error message: ${error.message}`, 'error');
        }
    }
}

module.exports = AdminController;
