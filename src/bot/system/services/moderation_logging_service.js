/**
 * Moderation Logging Service
 * 
 * Handles comprehensive logging for moderation actions
 */

const logger = require('../helpers/logger_helper');
const { DatabaseError } = require('../core/Errors');

class ModerationLoggingService {
    /**
     * Create a new ModerationLoggingService instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.database = client.database;
        this.webhook_cache = new Map();
    }

    /**
     * Log moderation action
     * @param {string} guild_id - Guild ID
     * @param {string} moderator_id - Moderator user ID
     * @param {string} target_id - Target user ID
     * @param {string} action - Action type (kick, ban, warn, etc.)
     * @param {string} reason - Action reason
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<void>}
     */
    async log_action(guild_id, moderator_id, target_id, action, reason = null, metadata = {}) {
        try {
            await this.database.query(
                `INSERT INTO moderation_logs 
                (guild_id, moderator_id, target_id, action, reason, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    guild_id,
                    moderator_id,
                    target_id,
                    action,
                    reason,
                    JSON.stringify(metadata),
                    Date.now(),
                ]
            );

            // Send to webhook if configured
            await this.send_to_webhook(guild_id, {
                moderator_id,
                target_id,
                action,
                reason,
                metadata,
            });

            logger.info(`Logged moderation action: ${action}`, {
                guild_id,
                moderator_id,
                target_id,
            });
        } catch (error) {
            logger.error('Failed to log moderation action', {
                error: error.message,
                guild_id,
                action,
            });
            throw new DatabaseError('Failed to log moderation action', {
                originalError: error.message,
            });
        }
    }

    /**
     * Log automated moderation action
     * @param {string} guild_id - Guild ID
     * @param {string} target_id - Target user ID
     * @param {string} action - Action type
     * @param {Array} violations - Array of violations
     * @returns {Promise<void>}
     */
    async log_automated_action(guild_id, target_id, action, violations) {
        return await this.log_action(
            guild_id,
            this.client.user.id,
            target_id,
            `auto_${action}`,
            `Automated moderation: ${violations.map((v) => v.type).join(', ')}`,
            { violations }
        );
    }

    /**
     * Log message deletion
     * @param {string} guild_id - Guild ID
     * @param {string} channel_id - Channel ID
     * @param {string} message_id - Message ID
     * @param {string} author_id - Author ID
     * @param {string} content - Message content
     * @param {string} reason - Deletion reason
     * @returns {Promise<void>}
     */
    async log_message_deletion(guild_id, channel_id, message_id, author_id, content, reason = null) {
        try {
            await this.database.query(
                `INSERT INTO message_logs 
                (guild_id, channel_id, message_id, author_id, content, action, reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    guild_id,
                    channel_id,
                    message_id,
                    author_id,
                    content,
                    'delete',
                    reason,
                    Date.now(),
                ]
            );

            logger.debug(`Logged message deletion: ${message_id}`);
        } catch (error) {
            logger.error('Failed to log message deletion', {
                error: error.message,
                message_id,
            });
        }
    }

    /**
     * Log message edit
     * @param {string} guild_id - Guild ID
     * @param {string} channel_id - Channel ID
     * @param {string} message_id - Message ID
     * @param {string} author_id - Author ID
     * @param {string} old_content - Old content
     * @param {string} new_content - New content
     * @returns {Promise<void>}
     */
    async log_message_edit(guild_id, channel_id, message_id, author_id, old_content, new_content) {
        try {
            await this.database.query(
                `INSERT INTO message_logs 
                (guild_id, channel_id, message_id, author_id, old_content, content, action, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    guild_id,
                    channel_id,
                    message_id,
                    author_id,
                    old_content,
                    new_content,
                    'edit',
                    Date.now(),
                ]
            );

            logger.debug(`Logged message edit: ${message_id}`);
        } catch (error) {
            logger.error('Failed to log message edit', {
                error: error.message,
                message_id,
            });
        }
    }

    /**
     * Log member join
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @returns {Promise<void>}
     */
    async log_member_join(guild_id, user_id) {
        try {
            await this.database.query(
                `INSERT INTO member_logs 
                (guild_id, user_id, action, created_at)
                VALUES (?, ?, ?, ?)`,
                [guild_id, user_id, 'join', Date.now()]
            );

            logger.debug(`Logged member join: ${user_id}`);
        } catch (error) {
            logger.error('Failed to log member join', {
                error: error.message,
                user_id,
            });
        }
    }

    /**
     * Log member leave
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @returns {Promise<void>}
     */
    async log_member_leave(guild_id, user_id) {
        try {
            await this.database.query(
                `INSERT INTO member_logs 
                (guild_id, user_id, action, created_at)
                VALUES (?, ?, ?, ?)`,
                [guild_id, user_id, 'leave', Date.now()]
            );

            logger.debug(`Logged member leave: ${user_id}`);
        } catch (error) {
            logger.error('Failed to log member leave', {
                error: error.message,
                user_id,
            });
        }
    }

    /**
     * Send log to webhook
     * @param {string} guild_id - Guild ID
     * @param {Object} log_data - Log data
     * @private
     */
    async send_to_webhook(guild_id, log_data) {
        try {
            // Get webhook URL from config
            const webhook_url = await this.get_webhook_url(guild_id);
            if (!webhook_url) {
                return;
            }

            // Create embed
            const embed = this.client.embedBuilder?.create({
                title: `Moderation Action: ${log_data.action}`,
                description: log_data.reason || 'No reason provided',
                color: this._get_action_color(log_data.action),
                fields: [
                    { name: 'Moderator', value: `<@${log_data.moderator_id}>`, inline: true },
                    { name: 'Target', value: `<@${log_data.target_id}>`, inline: true },
                    { name: 'Action', value: log_data.action, inline: true },
                ],
                timestamp: new Date(),
            });

            // Send to webhook
            const response = await fetch(webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [embed?.data || {}],
                }),
            });

            if (!response.ok) {
                throw new Error(`Webhook returned ${response.status}`);
            }
        } catch (error) {
            logger.warn('Failed to send log to webhook', {
                error: error.message,
                guild_id,
            });
        }
    }

    /**
     * Get webhook URL for guild
     * @param {string} guild_id - Guild ID
     * @returns {Promise<string|null>} Webhook URL or null
     * @private
     */
    async get_webhook_url(guild_id) {
        if (this.webhook_cache.has(guild_id)) {
            return this.webhook_cache.get(guild_id);
        }

        try {
            const config = await this.database.queryOne(
                'SELECT moderation_webhook_url FROM guild_config WHERE guild_id = ?',
                [guild_id]
            );

            const url = config?.moderation_webhook_url || null;
            if (url) {
                this.webhook_cache.set(guild_id, url);
            }

            return url;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get action color
     * @param {string} action - Action type
     * @returns {number} Color value
     * @private
     */
    _get_action_color(action) {
        const color_map = {
            ban: 0xff0000, // Red
            kick: 0xff8800, // Orange
            warn: 0xffff00, // Yellow
            mute: 0x00ffff, // Cyan
            timeout: 0x0088ff, // Blue
            delete: 0x888888, // Grey
        };

        return color_map[action] || 0x000000;
    }
}

module.exports = ModerationLoggingService;
