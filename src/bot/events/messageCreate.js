const { BaseDiscordEvent } = require('../base/BaseEvent');
const { events: logger } = require('../services/logging.service');
const CONFIG = require('../config');

/**
 * Message create event - Fired when a message is created
 */
class MessageCreateEvent extends BaseDiscordEvent {
    constructor(client) {
        super(client, {
            name: 'messageCreate',
            eventName: 'messageCreate',
            description: 'Fired when a message is created in a channel'
        });
    }

    async execute(message) {
        try {
            // Ignore bot messages
            if (message.author.bot) return;

            // Handle command messages
            if (message.content.startsWith(CONFIG.DISCORD.PREFIX)) {
                await this.handleCommand(message);
            }

            // Handle XP gain for regular messages
            if (!message.content.startsWith(CONFIG.DISCORD.PREFIX)) {
                await this.handleMessageXP(message);
            }

            // Handle auto-moderation
            await this.handleAutoModeration(message);

            // Log message for analytics
            await this.logMessage(message);

        } catch (error) {
            logger.error('Error in messageCreate event', {
                error: error.message,
                message: message.id,
                author: message.author.tag,
                guild: message.guild?.name || 'DM'
            });
        }
    }

    /**
     * Handle command messages
     * @param {Message} message - Discord message
     */
    async handleCommand(message) {
        // Delegate to command handler
        if (this.client.commandHandler) {
            await this.client.commandHandler.handleMessage(message);
        }
    }

    /**
     * Handle XP gain for regular messages
     * @param {Message} message - Discord message
     */
    async handleMessageXP(message) {
        // Skip if leveling module is disabled
        if (!CONFIG.FEATURES.LEVELING) return;
        if (!message.guild) return;

        try {
            const levelingModule = this.client.getModule('Leveling');
            if (levelingModule && levelingModule.enabled) {
                await levelingModule.handleMessage(message);
            }
        } catch (error) {
            logger.debug('Failed to handle message XP', { error: error.message });
        }
    }

    /**
     * Handle auto-moderation
     * @param {Message} message - Discord message
     */
    async handleAutoModeration(message) {
        // Skip if moderation module is disabled
        if (!CONFIG.FEATURES.MODERATION) return;
        if (!message.guild) return;

        try {
            const moderationModule = this.client.getModule('Moderation');
            if (moderationModule && moderationModule.enabled) {
                await moderationModule.handleAutoModeration(message);
            }
        } catch (error) {
            logger.debug('Failed to handle auto-moderation', { error: error.message });
        }
    }

    /**
     * Log message for analytics
     * @param {Message} message - Discord message
     */
    async logMessage(message) {
        try {
            // Log to database if available
            if (this.client.database) {
                await this.client.database.query(
                    `INSERT INTO logs (guild_id, event_type, data) VALUES (?, ?, ?)`,
                    [
                        message.guild?.id || '0',
                        'message_create',
                        JSON.stringify({
                            message_id: message.id,
                            author_id: message.author.id,
                            channel_id: message.channel.id,
                            content_length: message.content.length,
                            has_attachments: message.attachments.size > 0,
                            has_embeds: message.embeds.length > 0,
                            timestamp: message.createdTimestamp
                        })
                    ]
                );
            }
        } catch (error) {
            logger.debug('Failed to log message', { error: error.message });
        }
    }
}

module.exports = MessageCreateEvent;
