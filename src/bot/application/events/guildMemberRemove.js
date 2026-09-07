'use strict';

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
            // Send goodbye message if enabled
            await this.sendGoodbyeMessage(member);

            // Log member leave
            const moderationLoggingService = this.client.moderationLoggingService;
            if (moderationLoggingService) {
                await moderationLoggingService.log_member_leave(member.guild.id, member.user.id);
            }
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
     * Send goodbye message when member leaves
     * @param {Object} member - Discord member object
     */
    async sendGoodbyeMessage(member) {
        try {
            const guildConfigService = this.getGuildConfigService();

            if (!guildConfigService) {
                this.log('GuildConfigService not available, skipping goodbye message', 'debug');
                return;
            }

            const goodbyeEnabled = await guildConfigService.getSetting(member.guild.id, 'goodbye_enabled');

            if (!goodbyeEnabled) {
                this.log(`Goodbye messages disabled for guild ${member.guild.id}`, 'debug');
                return;
            }

            const goodbyeChannelId = await guildConfigService.getSetting(member.guild.id, 'goodbye_channel');

            if (!goodbyeChannelId) {
                this.log(`No goodbye channel configured for guild ${member.guild.id}`, 'debug');
                return;
            }

            const goodbyeChannel = member.guild.channels.cache.get(goodbyeChannelId);

            if (!goodbyeChannel) {
                this.log(`Goodbye channel ${goodbyeChannelId} not found in guild ${member.guild.id}`, 'warn');
                return;
            }

            const permissions = goodbyeChannel.permissionsFor(member.guild.members.me);
            if (!permissions || !permissions.has('SendMessages')) {
                this.log(`Bot lacks SendMessages permission in goodbye channel ${goodbyeChannelId}`, 'warn');
                return;
            }

            let goodbyeMessage = await guildConfigService.getSetting(member.guild.id, 'goodbye_message');

            if (!goodbyeMessage) {
                goodbyeMessage = 'Goodbye {user}! We will miss you.';
            }

            const memberCount = member.guild.memberCount;
            goodbyeMessage = goodbyeMessage
                .replace(/{user}/g, `<@${member.user.id}>`)
                .replace(/{server}/g, member.guild.name)
                .replace(/{memberCount}/g, memberCount.toString());

            await goodbyeChannel.send(goodbyeMessage);

            this.log(`Sent goodbye message for ${member.user.tag} in guild ${member.guild.name}`, 'info');
        } catch (error) {
            this.log('Failed to send goodbye message', 'error', {
                guildId: member.guild.id,
                userId: member.user.id,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Get GuildConfigService from client
     * @returns {Object|null} GuildConfigService instance or null
     */
    getGuildConfigService() {
        try {
            const adminModule = this.client.modules?.get('admin');
            if (adminModule) {
                const service = adminModule.getService('GuildConfigService');
                if (service) {
                    return service;
                }
            }

            if (this.client.services && this.client.services.has('GuildConfigService')) {
                return this.client.services.get('GuildConfigService');
            }

            return null;
        } catch (error) {
            this.log(`Error getting GuildConfigService: ${error.message}`, 'error');
            return null;
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
