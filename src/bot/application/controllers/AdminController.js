'use strict';

/**
 * AdminController
 *
 * Handles all admin-related commands.
 * Delegates to specialized handlers for better separation of concerns.
 */

const Controller = require('../../system/core/Controller');
const ResponseHelper = require('../../system/helpers/ResponseHelper');
const ConfigHandler = require('./admin/handlers/ConfigHandler');
const HealthHandler = require('./admin/handlers/HealthHandler');
const PerformanceHandler = require('./admin/handlers/PerformanceHandler');
const LoggingHandler = require('./admin/handlers/LoggingHandler');
const RolesHandler = require('./admin/handlers/RolesHandler');
const FeaturesHandler = require('./admin/handlers/FeaturesHandler');
const BotHandler = require('./admin/handlers/BotHandler');

class AdminController extends Controller {
    /**
     * Create a new AdminController instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        super(client);

        this.guildConfigService = this.client.services.get('GuildConfigService');
        this.performanceService = this.client.services.get('PerformanceService');

        this.configHandler = new ConfigHandler(this);
        this.healthHandler = new HealthHandler(this);
        this.performanceHandler = new PerformanceHandler(this);
        this.loggingHandler = new LoggingHandler(this);
        this.rolesHandler = new RolesHandler(this);
        this.featuresHandler = new FeaturesHandler(this);
        this.botHandler = new BotHandler(this);
    }

    async config(interaction) { return this.configHandler.config(interaction); }
    async health(interaction) { return this.healthHandler.health(interaction); }
    async performance(interaction) { return this.performanceHandler.performance(interaction); }
    async logs(interaction) { return this.loggingHandler.logs(interaction); }
    async roles(interaction) { return this.rolesHandler.roles(interaction); }
    async features(interaction) { return this.featuresHandler.features(interaction); }
    async bot(interaction) { return this.botHandler.bot(interaction); }

    /**
     * Safely reply with error message using consistent embed formatting.
     * Handles cases where interaction is already deferred, replied, or expired.
     * @param {Object} interaction - Discord interaction
     * @param {string} message - Error message
     */
    async safeReplyError(interaction, message) {
        try {
            const embed = ResponseHelper.error('Error', message);

            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ embeds: [embed] });
            } else if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [embed],
                    flags: 64,
                });
            } else if (interaction.replied) {
                await interaction.followUp({
                    embeds: [embed],
                    flags: 64,
                });
            }
        } catch (error) {
            if (error.code !== 10062 && error.code !== 50013) {
                this.log(`Failed to send error message: ${error.message}`, 'error');
            }
        }
    }
}

module.exports = AdminController;
