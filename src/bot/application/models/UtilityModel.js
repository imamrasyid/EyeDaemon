'use strict';

/**
 * UtilityModel
 * 
 * Manages utility features: reaction_roles, auto_roles, event_logs, command_usage, message_stats.
 * Synchronized with consolidated schema.
 */

const Model = require('../../system/core/Model');
const { randomUUID } = require('crypto');

class UtilityModel extends Model {
    constructor(instance) {
        super(instance);
        this.tableName = 'reaction_roles';
    }

    /**
     * Get bot statistics
     * @param {Object} client
     * @returns {Promise<Object>}
     */
    async getBotStats(client) {
        try {
            const memoryUsage = process.memoryUsage();
            const uptime = process.uptime();

            return {
                guilds: client.guilds.cache.size,
                users: client.users.cache.size,
                channels: client.channels.cache.size,
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
     * @param {Object} guild
     * @returns {Promise<Object>}
     */
    async getGuildStats(guild) {
        try {
            if (!guild) throw new Error('Invalid guild object');

            const humanMembers = guild.members.cache.filter(member => !member.user.bot).size;
            const botMembers = guild.members.cache.filter(member => member.user.bot).size;
            const totalMembers = guild.memberCount || guild.members.cache.size;

            const textChannels = guild.channels.cache.filter(channel => channel.type === 0).size;
            const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2).size;
            const categories = guild.channels.cache.filter(channel => channel.type === 4).size;
            const totalChannels = guild.channels.cache.size;
            const totalRoles = guild.roles.cache.size;

            return {
                guildName: guild.name || 'Unknown',
                guildIcon: guild.iconURL?.({ dynamic: true, size: 256 }) || null,
                totalMembers,
                humanMembers,
                botMembers,
                textChannels,
                voiceChannels,
                categories,
                totalChannels,
                totalRoles,
                createdAt: guild.createdAt,
                ownerId: guild.ownerId
            };
        } catch (error) {
            this.log(`Error getting guild stats: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Create reaction role
     */
    async createReactionRole(guildId, messageId, channelId, emoji, roleId, description = null) {
        try {
            const id = randomUUID();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO reaction_roles (id, guild_id, message_id, channel_id, emoji, role_id, description, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, guildId, messageId, channelId, emoji, roleId, description, now]
            );

            return { id, guildId, messageId, channelId, emoji, roleId, description };
        } catch (error) {
            this.log(`Error creating reaction role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get reaction roles for a message
     */
    async getReactionRoles(messageId) {
        try {
            const rows = await this.query(`SELECT * FROM reaction_roles WHERE message_id = ?`, [messageId]);
            return rows || [];
        } catch (error) {
            this.log(`Error getting reaction roles: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get single reaction role
     */
    async getReactionRole(messageId, emoji) {
        try {
            const rows = await this.query(
                `SELECT * FROM reaction_roles WHERE message_id = ? AND emoji = ?`,
                [messageId, emoji]
            );
            return rows?.[0] || null;
        } catch (error) {
            this.log(`Error getting reaction role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Delete reaction role
     */
    async deleteReactionRole(id) {
        try {
            await this.query(`DELETE FROM reaction_roles WHERE id = ?`, [id]);
        } catch (error) {
            this.log(`Error deleting reaction role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Create auto role
     */
    async createAutoRole(guildId, roleId, type = 'join', delayMinutes = 0) {
        try {
            const id = randomUUID();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO auto_roles (id, guild_id, role_id, type, delay_minutes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, guildId, roleId, type, delayMinutes, now]
            );

            return { id, guildId, roleId, type, delayMinutes };
        } catch (error) {
            this.log(`Error creating auto role: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get auto roles
     */
    async getAutoRoles(guildId, type = null) {
        try {
            let sql = `SELECT * FROM auto_roles WHERE guild_id = ?`;
            const params = [guildId];

            if (type) {
                sql += ` AND type = ?`;
                params.push(type);
            }

            const rows = await this.query(sql, params);
            return rows || [];
        } catch (error) {
            this.log(`Error getting auto roles: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Log an event
     */
    async logEvent(guildId, eventType, userId = null, channelId = null, eventData = {}) {
        try {
            const id = randomUUID();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO event_logs (id, guild_id, event_type, user_id, channel_id, data_json, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, guildId, eventType, userId, channelId, JSON.stringify(eventData), now]
            );
        } catch (error) {
            this.log(`Error logging event: ${error.message}`, 'warn');
        }
    }

    /**
     * Format uptime
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
