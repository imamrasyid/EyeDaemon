/**
 * GuildDelete Event Handler
 * 
 * Fired when the bot leaves a guild.
 * Handles cleanup of guild state and voice connections.
 */

const BaseEvent = require('../../system/core/BaseEvent');

class GuildDeleteEvent extends BaseEvent {
    constructor(client) {
        super(client, {
            name: 'guildDelete',
            once: false,
        });
    }

    async execute(guild) {
        this.log(`Left guild: ${guild.name} (${guild.id})`, 'info');

        try {
            // Cleanup guild state
            this.clearGuildState(guild.id);

            // Cleanup voice connection if exists
            await this.cleanupVoiceConnection(guild.id);

            this.log(`Cleaned up guild: ${guild.name}`, 'info');
        } catch (error) {
            this.log('Failed to cleanup guild', 'error', {
                guildId: guild.id,
                guildName: guild.name,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Cleanup voice connection for guild
     * @param {string} guildId - Guild ID
     */
    async cleanupVoiceConnection(guildId) {
        try {
            // Get voice manager from client
            const voiceManager = this.client.voiceManager;

            if (voiceManager && typeof voiceManager.leave === 'function') {
                voiceManager.leave(guildId);
                this.log(`Cleaned up voice connection for guild ${guildId}`, 'debug');
            }
        } catch (error) {
            this.log('Failed to cleanup voice connection', 'error', {
                guildId,
                error: error.message,
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

module.exports = GuildDeleteEvent;
