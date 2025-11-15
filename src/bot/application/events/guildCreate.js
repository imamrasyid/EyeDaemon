/**
 * GuildCreate Event Handler
 * 
 * Fired when the bot joins a new guild.
 * Handles guild initialization using GuildInitializationService.
 */

const BaseEvent = require('../../system/core/BaseEvent');

class GuildCreateEvent extends BaseEvent {
    constructor(client) {
        super(client, {
            name: 'guildCreate',
            once: false,
        });
    }

    async execute(guild) {
        this.log(`Joined new guild: ${guild.name} (${guild.id})`, 'info');

        try {
            // Get GuildInitializationService
            const guildInitService = this.getGuildInitializationService();

            if (!guildInitService) {
                this.log('GuildInitializationService not available, falling back to basic initialization', 'warn');
                await this.fallbackInitialization(guild);
                return;
            }

            // Initialize guild using service
            const result = await guildInitService.initializeGuild(guild);

            if (result.success) {
                if (result.alreadyInitialized) {
                    this.log(`Guild ${guild.name} was already initialized`, 'info');
                } else {
                    this.log(
                        `Guild ${guild.name} initialized successfully with ${result.memberCount} members`,
                        'info',
                        {
                            guildId: result.guildId,
                            guildName: result.guildName,
                            memberCount: result.memberCount,
                        }
                    );
                }
            }
        } catch (error) {
            await this.handleError(error, guild);
        }
    }

    /**
     * Get GuildInitializationService from client
     * @returns {Object|null} GuildInitializationService instance or null
     */
    getGuildInitializationService() {
        try {
            // Service is registered globally on client
            if (this.client.guildInitializationService) {
                return this.client.guildInitializationService;
            }

            // Try to get from services map if available
            if (this.client.services && this.client.services.has('GuildInitializationService')) {
                return this.client.services.get('GuildInitializationService');
            }

            return null;
        } catch (error) {
            this.log(`Error getting GuildInitializationService: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Fallback initialization if service is not available
     * @param {Object} guild - Discord guild object
     */
    async fallbackInitialization(guild) {
        try {
            const GuildModel = require('../models/GuildModel');
            const model = new GuildModel({ client: this.client });
            await model.initializeGuild(guild.id, guild.name);

            this.log(`Guild ${guild.name} initialized with fallback method`, 'info');
        } catch (error) {
            this.log('Fallback initialization failed', 'error', {
                guildId: guild.id,
                guildName: guild.name,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Get error context from guild
     * @param {Array} args - Event arguments
     * @returns {Object} Context object
     */
    getErrorContext(args) {
        const guild = args[0];
        return {
            guild: guild?.name,
            guildId: guild?.id,
        };
    }
}

module.exports = GuildCreateEvent;
