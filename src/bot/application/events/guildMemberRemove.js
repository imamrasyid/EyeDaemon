/**
 * GuildMemberRemove Event Handler
 * 
 * Fired when a member leaves a guild.
 * Handles member cleanup and logging.
 */

const BaseEvent = require('../../system/core/BaseEvent');

class GuildMemberRemoveEvent extends BaseEvent {
    constructor(client) {
        super(client, {
            name: 'guildMemberRemove',
            once: false,
        });
    }

    async execute(member) {
        this.log(`Member left: ${member.user.tag} from guild ${member.guild.name}`, 'info');

        try {
            // Log member leave
            const moderationLoggingService = this.client.moderationLoggingService;
            if (moderationLoggingService) {
                await moderationLoggingService.log_member_leave(member.guild.id, member.user.id);
            }

            // Cleanup member-specific data if needed
            await this.cleanupMemberData(member);
        } catch (error) {
            this.log('Failed to handle member leave', 'error', {
                guildId: member.guild.id,
                userId: member.user.id,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Cleanup member-specific data
     * @param {Object} member - Discord member object
     */
    async cleanupMemberData(member) {
        try {
            // Cleanup voice connection if member was in voice
            if (member.voice.channel) {
                // Member was in voice, cleanup handled by voice state update
            }

            // Cleanup any member-specific caches
            // This can be extended based on your needs
        } catch (error) {
            this.log('Failed to cleanup member data', 'error', {
                guildId: member.guild.id,
                userId: member.user.id,
                error: error.message,
            });
        }
    }

    /**
     * Get error context from member
     * @param {Array} args - Event arguments
     * @returns {Object} Context object
     */
    getErrorContext(args) {
        const member = args[0];
        return {
            guild: member?.guild?.name,
            guildId: member?.guild?.id,
            user: member?.user?.tag,
            userId: member?.user?.id,
        };
    }
}

module.exports = GuildMemberRemoveEvent;
