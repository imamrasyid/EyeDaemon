/**
 * Message Service
 * 
 * Handles message operations: send, edit, delete, bulk delete, scheduled messages
 */

const logger = require('../helpers/logger_helper');
const { DatabaseError } = require('../core/Errors');

class MessageService {
    /**
     * Create a new MessageService instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.database = client.database;
        this.scheduled_messages = new Map();
    }

    /**
     * Send a message
     * @param {string} channel_id - Channel ID
     * @param {Object|string} content - Message content or options
     * @param {Object} options - Additional options
     * @returns {Promise<Message>} Sent message
     */
    async send_message(channel_id, content, options = {}) {
        try {
            const channel = await this.client.channels.fetch(channel_id);
            if (!channel) {
                throw new Error('Channel not found');
            }

            if (typeof content === 'string') {
                return await channel.send({
                    content,
                    ...options,
                });
            } else {
                return await channel.send({
                    ...content,
                    ...options,
                });
            }
        } catch (error) {
            logger.error('Failed to send message', {
                error: error.message,
                channel_id,
            });
            throw new DatabaseError('Failed to send message', {
                originalError: error.message,
            });
        }
    }

    /**
     * Edit a message
     * @param {string} channel_id - Channel ID
     * @param {string} message_id - Message ID
     * @param {Object|string} content - New message content or options
     * @returns {Promise<Message>} Edited message
     */
    async edit_message(channel_id, message_id, content) {
        try {
            const channel = await this.client.channels.fetch(channel_id);
            if (!channel) {
                throw new Error('Channel not found');
            }

            const message = await channel.messages.fetch(message_id);
            if (!message) {
                throw new Error('Message not found');
            }

            if (typeof content === 'string') {
                return await message.edit({ content });
            } else {
                return await message.edit(content);
            }
        } catch (error) {
            logger.error('Failed to edit message', {
                error: error.message,
                channel_id,
                message_id,
            });
            throw new DatabaseError('Failed to edit message', {
                originalError: error.message,
            });
        }
    }

    /**
     * Delete a message
     * @param {string} channel_id - Channel ID
     * @param {string} message_id - Message ID
     * @param {string} reason - Deletion reason
     * @returns {Promise<void>}
     */
    async delete_message(channel_id, message_id, reason = null) {
        try {
            const channel = await this.client.channels.fetch(channel_id);
            if (!channel) {
                throw new Error('Channel not found');
            }

            const message = await channel.messages.fetch(message_id);
            if (!message) {
                throw new Error('Message not found');
            }

            await message.delete({ reason });
        } catch (error) {
            logger.error('Failed to delete message', {
                error: error.message,
                channel_id,
                message_id,
            });
            throw new DatabaseError('Failed to delete message', {
                originalError: error.message,
            });
        }
    }

    /**
     * Bulk delete messages
     * @param {string} channel_id - Channel ID
     * @param {Array<string>} message_ids - Array of message IDs
     * @param {string} reason - Deletion reason
     * @returns {Promise<number>} Number of deleted messages
     */
    async bulk_delete_messages(channel_id, message_ids, reason = null) {
        try {
            const channel = await this.client.channels.fetch(channel_id);
            if (!channel) {
                throw new Error('Channel not found');
            }

            // Discord API limits bulk delete to 100 messages and messages must be less than 14 days old
            const valid_ids = message_ids.slice(0, 100);
            const deleted_count = await channel.bulkDelete(valid_ids, true);

            logger.info(`Bulk deleted ${deleted_count.size} messages from channel ${channel_id}`);
            return deleted_count.size;
        } catch (error) {
            logger.error('Failed to bulk delete messages', {
                error: error.message,
                channel_id,
                message_count: message_ids.length,
            });
            throw new DatabaseError('Failed to bulk delete messages', {
                originalError: error.message,
            });
        }
    }

    /**
     * Schedule a message
     * @param {string} channel_id - Channel ID
     * @param {Object|string} content - Message content or options
     * @param {Date|number} schedule_time - When to send (Date or timestamp)
     * @param {Object} options - Additional options
     * @returns {Promise<string>} Scheduled message ID
     */
    async schedule_message(channel_id, content, schedule_time, options = {}) {
        try {
            const schedule_timestamp = schedule_time instanceof Date ? schedule_time.getTime() : schedule_time;
            const now = Date.now();

            if (schedule_timestamp <= now) {
                throw new Error('Schedule time must be in the future');
            }

            const scheduled_id = `scheduled-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            this.scheduled_messages.set(scheduled_id, {
                channel_id,
                content,
                schedule_time: schedule_timestamp,
                options,
            });

            // Schedule the message
            const delay = schedule_timestamp - now;
            setTimeout(async () => {
                try {
                    await this.send_message(channel_id, content, options);
                    this.scheduled_messages.delete(scheduled_id);
                } catch (error) {
                    logger.error('Failed to send scheduled message', {
                        error: error.message,
                        scheduled_id,
                    });
                }
            }, delay);

            logger.info(`Scheduled message: ${scheduled_id} (in ${delay}ms)`);
            return scheduled_id;
        } catch (error) {
            logger.error('Failed to schedule message', {
                error: error.message,
                channel_id,
            });
            throw new DatabaseError('Failed to schedule message', {
                originalError: error.message,
            });
        }
    }

    /**
     * Cancel a scheduled message
     * @param {string} scheduled_id - Scheduled message ID
     * @returns {boolean} True if cancelled
     */
    cancel_scheduled_message(scheduled_id) {
        const scheduled = this.scheduled_messages.get(scheduled_id);
        if (!scheduled) {
            return false;
        }

        this.scheduled_messages.delete(scheduled_id);
        logger.info(`Cancelled scheduled message: ${scheduled_id}`);
        return true;
    }

    /**
     * Send ephemeral message (reply)
     * @param {Interaction} interaction - Discord interaction
     * @param {Object|string} content - Message content or options
     * @returns {Promise<Message>} Sent message
     */
    async send_ephemeral(interaction, content) {
        try {
            if (typeof content === 'string') {
                return await interaction.reply({
                    content,
                    ephemeral: true,
                });
            } else {
                return await interaction.reply({
                    ...content,
                    ephemeral: true,
                });
            }
        } catch (error) {
            logger.error('Failed to send ephemeral message', {
                error: error.message,
            });
            throw new DatabaseError('Failed to send ephemeral message', {
                originalError: error.message,
            });
        }
    }

    /**
     * Send silent reply (no notification)
     * @param {Interaction} interaction - Discord interaction
     * @param {Object|string} content - Message content or options
     * @returns {Promise<Message>} Sent message
     */
    async send_silent_reply(interaction, content) {
        try {
            if (typeof content === 'string') {
                return await interaction.reply({
                    content,
                    flags: 64, // SUPPRESS_NOTIFICATIONS
                });
            } else {
                return await interaction.reply({
                    ...content,
                    flags: 64,
                });
            }
        } catch (error) {
            logger.error('Failed to send silent reply', {
                error: error.message,
            });
            throw new DatabaseError('Failed to send silent reply', {
                originalError: error.message,
            });
        }
    }

    /**
     * Get all scheduled messages
     * @returns {Array} Array of scheduled messages
     */
    get_scheduled_messages() {
        return Array.from(this.scheduled_messages.entries()).map(([id, data]) => ({
            id,
            ...data,
        }));
    }
}

module.exports = MessageService;
