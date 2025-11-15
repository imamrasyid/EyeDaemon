/**
 * UtilityModel
 * 
 * Model for managing utility features like reaction roles, auto roles, and event logs.
 * Updated for new Turso DB schema with separate tables for each utility feature.
 */

const Model = require('../../system/core/Model');
const { v4: uuidv4 } = require('uuid');

class UtilityModel extends Model {
    /**
     * Create a new UtilityModel instance
     * @param {Object} instance - The parent instance
     */
    constructor(instance) {
        super(instance);
        this.tableName = 'reaction_roles';
    }

    /**
     * Get bot statistics
     * @param {Object} client - Discord client
     * @returns {Promise<Object>} Bot statistics
     */
    async getBotStats(client) {
        try {
            const memoryUsage = process.memoryUsage();
            const uptime = process.uptime();

            return {
                guilds: client.guilds.cache.size,
                users: client.users.cache.size,
                channels: client.channels.cache.size,
                commands: 0, // This would need to be tracked separately
                uptime: this.formatUptime(uptime),
                memory: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
            };
        } catch (error) {
            this.log(`Error getting bot stats: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get guild statistics
     * @param {Object} guild - Discord guild object
     * @returns {Promise<Object>} Guild statistics
     */
    async getGuildStats(guild) {
        try {
            // Handle edge case where guild is null or undefined
            if (!guild) {
                this.log('Guild object is null or undefined', 'error');
                throw new Error('Invalid guild object');
            }

            // Count members by type (humans vs bots)
            const humanMembers = guild.members.cache.filter(member => !member.user.bot).size;
            const botMembers = guild.members.cache.filter(member => member.user.bot).size;
            const totalMembers = guild.memberCount || guild.members.cache.size;

            // Count channels by type
            const textChannels = guild.channels.cache.filter(channel => channel.type === 0).size; // GUILD_TEXT
            const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2).size; // GUILD_VOICE
            const categories = guild.channels.cache.filter(channel => channel.type === 4).size; // GUILD_CATEGORY
            const totalChannels = guild.channels.cache.size;

            // Get bot join date from guild member cache
            let botJoinedAt = null;
            const botMember = guild.members.cache.get(guild.client.user.id);
            if (botMember && botMember.joinedAt) {
                botJoinedAt = botMember.joinedAt;
            }

            // Get boost information
            const boostLevel = guild.premiumTier || 0;
            const boostCount = guild.premiumSubscriptionCount || 0;

            // Get total roles
            const totalRoles = guild.roles.cache.size;

            return {
                guildName: guild.name || 'Unknown',
                guildIcon: guild.iconURL({ dynamic: true, size: 256 }) || null,
                totalMembers,
                humanMembers,
                botMembers,
                textChannels,
                voiceChannels,
                categories,
                totalChannels,
                totalRoles,
                createdAt: guild.createdAt,
                botJoinedAt,
                boostLevel,
                boostCount,
                ownerId: guild.ownerId
            };
        } catch (error) {
            this.log(`Error getting guild stats: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Create reaction role
     * @param {string} guildId - Guild ID
     * @param {string} messageId - Message ID
     * @param {string} channelId - Channel ID
     * @param {string} emoji - Emoji
     * @param {string} roleId - Role ID
     * @param {string} description - Description
     * @returns {Promise<Object>} Reaction role information
     */
    async createReactionRole(guildId, messageId, channelId, emoji, roleId, description = null) {
        try {
            const reactionRoleId = uuidv4();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO reaction_roles 
                 (id, guild_id, message_id, channel_id, emoji, role_id, description, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [reactionRoleId, guildId, messageId, channelId, emoji, roleId, description, now]
            );

            this.log(`Created reaction role ${reactionRoleId}`, 'info');

            return {
                id: reactionRoleId,
                guildId,
                messageId,
                channelId,
                emoji,
                roleId,
                description
            };
        } catch (error) {
            this.log(`Error creating reaction role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get reaction roles for a message
     * @param {string} messageId - Message ID
     * @returns {Promise<Array>} List of reaction roles
     */
    async getReactionRoles(messageId) {
        try {
            const results = await this.query(
                `SELECT * FROM reaction_roles WHERE message_id = ?`,
                [messageId]
            );

            return results || [];
        } catch (error) {
            this.log(`Error getting reaction roles: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get reaction role by message and emoji
     * @param {string} messageId - Message ID
     * @param {string} emoji - Emoji
     * @returns {Promise<Object|null>} Reaction role or null
     */
    async getReactionRole(messageId, emoji) {
        try {
            const result = await this.query(
                `SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?`,
                [messageId, emoji]
            );

            return result && result.length > 0 ? result[0] : null;
        } catch (error) {
            this.log(`Error getting reaction role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get all reaction roles for a guild
     * @param {string} guildId - Guild ID
     * @returns {Promise<Array>} List of reaction roles
     */
    async getGuildReactionRoles(guildId) {
        try {
            const results = await this.query(
                `SELECT * FROM reaction_roles WHERE guild_id = ?`,
                [guildId]
            );

            return results || [];
        } catch (error) {
            this.log(`Error getting guild reaction roles: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Delete reaction role
     * @param {string} reactionRoleId - Reaction role ID
     * @returns {Promise<void>}
     */
    async deleteReactionRole(reactionRoleId) {
        try {
            await this.query(
                `DELETE FROM reaction_roles WHERE id = ?`,
                [reactionRoleId]
            );

            this.log(`Deleted reaction role ${reactionRoleId}`, 'info');
        } catch (error) {
            this.log(`Error deleting reaction role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Delete reaction roles by message
     * @param {string} messageId - Message ID
     * @returns {Promise<void>}
     */
    async deleteReactionRolesByMessage(messageId) {
        try {
            await this.query(
                `DELETE FROM reaction_roles WHERE message_id = ?`,
                [messageId]
            );

            this.log(`Deleted reaction roles for message ${messageId}`, 'info');
        } catch (error) {
            this.log(`Error deleting reaction roles by message: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Create auto role
     * @param {string} guildId - Guild ID
     * @param {string} roleId - Role ID
     * @param {string} conditionType - Condition type (on_join, on_level, on_boost)
     * @param {Object} conditionData - Condition data
     * @returns {Promise<Object>} Auto role information
     */
    async createAutoRole(guildId, roleId, conditionType, conditionData = {}) {
        try {
            const autoRoleId = uuidv4();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO auto_roles 
                 (id, guild_id, role_id, condition_type, condition_data, is_active, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [autoRoleId, guildId, roleId, conditionType, JSON.stringify(conditionData), true, now]
            );

            this.log(`Created auto role ${autoRoleId}`, 'info');

            return {
                id: autoRoleId,
                guildId,
                roleId,
                conditionType,
                conditionData,
                isActive: true
            };
        } catch (error) {
            this.log(`Error creating auto role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get auto roles for a guild
     * @param {string} guildId - Guild ID
     * @param {string} conditionType - Condition type filter (optional)
     * @param {boolean} activeOnly - Return only active auto roles
     * @returns {Promise<Array>} List of auto roles
     */
    async getAutoRoles(guildId, conditionType = null, activeOnly = true) {
        try {
            let sql = `SELECT * FROM auto_roles WHERE guild_id = ?`;
            const params = [guildId];

            if (conditionType) {
                sql += ` AND condition_type = ?`;
                params.push(conditionType);
            }

            if (activeOnly) {
                sql += ` AND is_active = true`;
            }

            const results = await this.query(sql, params);

            // Parse condition_data JSON
            return (results || []).map(role => {
                if (role.condition_data && typeof role.condition_data === 'string') {
                    try {
                        role.condition_data = JSON.parse(role.condition_data);
                    } catch (e) {
                        role.condition_data = {};
                    }
                }
                return role;
            });
        } catch (error) {
            this.log(`Error getting auto roles: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update auto role
     * @param {string} autoRoleId - Auto role ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<void>}
     */
    async updateAutoRole(autoRoleId, updates) {
        try {
            const updateData = {};

            if (updates.roleId !== undefined) updateData.role_id = updates.roleId;
            if (updates.conditionType !== undefined) updateData.condition_type = updates.conditionType;
            if (updates.conditionData !== undefined) updateData.condition_data = JSON.stringify(updates.conditionData);
            if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

            if (Object.keys(updateData).length === 0) {
                return;
            }

            await this.query(
                `UPDATE auto_roles SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
                [...Object.values(updateData), autoRoleId]
            );

            this.log(`Updated auto role ${autoRoleId}`, 'info');
        } catch (error) {
            this.log(`Error updating auto role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Delete auto role
     * @param {string} autoRoleId - Auto role ID
     * @returns {Promise<void>}
     */
    async deleteAutoRole(autoRoleId) {
        try {
            await this.query(
                `DELETE FROM auto_roles WHERE id = ?`,
                [autoRoleId]
            );

            this.log(`Deleted auto role ${autoRoleId}`, 'info');
        } catch (error) {
            this.log(`Error deleting auto role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Log an event
     * @param {string} guildId - Guild ID
     * @param {string} eventType - Event type
     * @param {string} userId - User ID (optional)
     * @param {string} channelId - Channel ID (optional)
     * @param {Object} eventData - Event data
     * @returns {Promise<void>}
     */
    async logEvent(guildId, eventType, userId = null, channelId = null, eventData = {}) {
        try {
            const eventId = uuidv4();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO event_logs 
                 (id, guild_id, event_type, user_id, channel_id, event_data, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [eventId, guildId, eventType, userId, channelId, JSON.stringify(eventData), now]
            );

            this.log(`Logged event ${eventType} for guild ${guildId}`, 'debug');
        } catch (error) {
            this.log(`Error logging event: ${error.message}`, 'warn');
            // Don't throw - event logging failure shouldn't break the flow
        }
    }

    /**
     * Get event logs
     * @param {string} guildId - Guild ID
     * @param {Object} filters - Filters (eventType, userId, channelId)
     * @param {number} limit - Number of logs to return
     * @returns {Promise<Array>} List of event logs
     */
    async getEventLogs(guildId, filters = {}, limit = 100) {
        try {
            let sql = `SELECT * FROM event_logs WHERE guild_id = ?`;
            const params = [guildId];

            if (filters.eventType) {
                sql += ` AND event_type = ?`;
                params.push(filters.eventType);
            }

            if (filters.userId) {
                sql += ` AND user_id = ?`;
                params.push(filters.userId);
            }

            if (filters.channelId) {
                sql += ` AND channel_id = ?`;
                params.push(filters.channelId);
            }

            sql += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            const results = await this.query(sql, params);

            // Parse event_data JSON
            return (results || []).map(log => {
                if (log.event_data && typeof log.event_data === 'string') {
                    try {
                        log.event_data = JSON.parse(log.event_data);
                    } catch (e) {
                        log.event_data = {};
                    }
                }
                return log;
            });
        } catch (error) {
            this.log(`Error getting event logs: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Clear old event logs
     * @param {string} guildId - Guild ID
     * @param {number} olderThanDays - Delete logs older than this many days
     * @returns {Promise<number>} Number of logs deleted
     */
    async clearOldEventLogs(guildId, olderThanDays = 30) {
        try {
            const cutoffTime = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);

            const result = await this.query(
                `DELETE FROM event_logs WHERE guild_id = ? AND created_at < ?`,
                [guildId, cutoffTime]
            );

            const deleted = result.changes || 0;

            if (deleted > 0) {
                this.log(`Cleared ${deleted} old event logs for guild ${guildId}`, 'info');
            }

            return deleted;
        } catch (error) {
            this.log(`Error clearing old event logs: ${error.message}`, 'error');
            return 0;
        }
    }

    /**
     * Format uptime to readable string
     * @param {number} seconds - Uptime in seconds
     * @returns {string} Formatted uptime
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0) parts.push(`${secs}s`);

        return parts.join(' ') || '0s';
    }
}

module.exports = UtilityModel;
