/**
 * InfractionService
 * 
 * Business logic for managing infractions (warnings, bans, kicks, etc.)
 * Handles CRUD operations and infraction queries with filtering.
 */

const BaseService = require('../../../system/core/BaseService');

class InfractionService extends BaseService {
    /**
     * Create a new InfractionService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);

        // Will be set during initialization
        this.moderationModel = null;
    }

    /**
     * Initialize service with dependencies
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();

        // Get model from loader
        const loader = this.client.loader;
        if (loader) {
            this.moderationModel = loader.model('ModerationModel');
        }

        this.log('InfractionService initialized', 'info');
    }

    /**
     * Create a new infraction
     * @param {Object} data - Infraction data
     * @param {string} data.guildId - Guild ID
     * @param {string} data.userId - User ID
     * @param {string} data.moderatorId - Moderator user ID
     * @param {string} data.type - Infraction type (warning, kick, ban, timeout, mute, etc.)
     * @param {string} data.reason - Reason for infraction
     * @param {number} data.duration - Duration in minutes (for timeouts)
     * @param {number} data.expiresAt - Expiration timestamp (for temporary infractions)
     * @returns {Promise<Object>} Created infraction object
     */
    async createInfraction(data) {
        try {
            this.validateRequired(data, ['guildId', 'userId', 'moderatorId', 'type', 'reason']);

            const infractionId = `${data.type}-${Date.now()}-${data.userId}`;
            const timestamp = Date.now();
            const expiresAt = data.expiresAt || null;

            await this.query(
                `INSERT INTO infractions (id, guild_id, user_id, moderator_id, type, reason, timestamp, duration, expires_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    infractionId,
                    data.guildId,
                    data.userId,
                    data.moderatorId,
                    data.type,
                    data.reason,
                    timestamp,
                    data.duration || null,
                    expiresAt
                ]
            );

            this.log(`Created infraction ${infractionId} for user ${data.userId}`, 'info');

            return {
                id: infractionId,
                guildId: data.guildId,
                userId: data.userId,
                moderatorId: data.moderatorId,
                type: data.type,
                reason: data.reason,
                timestamp,
                duration: data.duration || null,
                expiresAt
            };
        } catch (error) {
            this.handleError(error, 'createInfraction', { data });
            throw error;
        }
    }

    /**
     * Get infraction by ID
     * @param {string} infractionId - Infraction ID
     * @returns {Promise<Object|null>} Infraction object or null
     */
    async getInfraction(infractionId) {
        try {
            this.validateRequired({ infractionId }, ['infractionId']);

            const results = await this.query(
                `SELECT * FROM infractions WHERE id = ?`,
                [infractionId]
            );

            return results && results.length > 0 ? results[0] : null;
        } catch (error) {
            this.handleError(error, 'getInfraction', { infractionId });
            return null;
        }
    }

    /**
     * Get infractions with filtering
     * @param {Object} filters - Filter options
     * @param {string} filters.guildId - Guild ID (required)
     * @param {string} filters.userId - User ID (optional)
     * @param {string} filters.moderatorId - Moderator ID (optional)
     * @param {string} filters.type - Infraction type (optional)
     * @param {number} filters.limit - Limit results (default: 50)
     * @param {number} filters.offset - Offset for pagination (default: 0)
     * @returns {Promise<Array>} Array of infractions
     */
    async getInfractions(filters = {}) {
        try {
            this.validateRequired(filters, ['guildId']);

            const { guildId, userId, moderatorId, type, limit = 50, offset = 0 } = filters;

            let sql = `SELECT * FROM infractions WHERE guild_id = ?`;
            const params = [guildId];

            if (userId) {
                sql += ` AND user_id = ?`;
                params.push(userId);
            }

            if (moderatorId) {
                sql += ` AND moderator_id = ?`;
                params.push(moderatorId);
            }

            if (type) {
                sql += ` AND type = ?`;
                params.push(type);
            }

            sql += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const results = await this.query(sql, params);

            return results || [];
        } catch (error) {
            this.handleError(error, 'getInfractions', { filters });
            return [];
        }
    }

    /**
     * Get infraction count for a user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} type - Infraction type (optional, filter by type)
     * @returns {Promise<number>} Count of infractions
     */
    async getInfractionCount(userId, guildId, type = null) {
        try {
            this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

            let sql = `SELECT COUNT(*) as count FROM infractions WHERE user_id = ? AND guild_id = ?`;
            const params = [userId, guildId];

            if (type) {
                sql += ` AND type = ?`;
                params.push(type);
            }

            const results = await this.query(sql, params);

            return results && results.length > 0 ? results[0].count : 0;
        } catch (error) {
            this.handleError(error, 'getInfractionCount', { userId, guildId, type });
            return 0;
        }
    }

    /**
     * Update an infraction
     * @param {string} infractionId - Infraction ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<boolean>} True if updated successfully
     */
    async updateInfraction(infractionId, updates) {
        try {
            this.validateRequired({ infractionId }, ['infractionId']);

            const allowedFields = ['reason', 'duration', 'expires_at'];
            const fields = [];
            const params = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    params.push(value);
                }
            }

            if (fields.length === 0) {
                return false;
            }

            params.push(infractionId);

            await this.query(
                `UPDATE infractions SET ${fields.join(', ')} WHERE id = ?`,
                params
            );

            this.log(`Updated infraction ${infractionId}`, 'info');

            return true;
        } catch (error) {
            this.handleError(error, 'updateInfraction', { infractionId, updates });
            return false;
        }
    }

    /**
     * Delete an infraction
     * @param {string} infractionId - Infraction ID
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteInfraction(infractionId) {
        try {
            this.validateRequired({ infractionId }, ['infractionId']);

            await this.query(
                `DELETE FROM infractions WHERE id = ?`,
                [infractionId]
            );

            this.log(`Deleted infraction ${infractionId}`, 'info');

            return true;
        } catch (error) {
            this.handleError(error, 'deleteInfraction', { infractionId });
            return false;
        }
    }

    /**
     * Clear all infractions for a user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<number>} Number of infractions cleared
     */
    async clearUserInfractions(userId, guildId) {
        try {
            this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

            const result = await this.query(
                `DELETE FROM infractions WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            );

            const count = result ? result.changes || 0 : 0;

            this.log(`Cleared ${count} infractions for user ${userId} in guild ${guildId}`, 'info');

            return count;
        } catch (error) {
            this.handleError(error, 'clearUserInfractions', { userId, guildId });
            return 0;
        }
    }

    /**
     * Check and process expired infractions
     * @param {string} guildId - Guild ID (optional, check all guilds if not provided)
     * @returns {Promise<Array>} Array of expired infractions
     */
    async checkExpiredInfractions(guildId = null) {
        try {
            const now = Date.now();
            let sql = `SELECT * FROM infractions WHERE expires_at IS NOT NULL AND expires_at <= ?`;
            const params = [now];

            if (guildId) {
                sql += ` AND guild_id = ?`;
                params.push(guildId);
            }

            const expiredInfractions = await this.query(sql, params);

            if (!expiredInfractions || expiredInfractions.length === 0) {
                return [];
            }

            this.log(`Found ${expiredInfractions.length} expired infractions`, 'info');

            // Delete expired infractions
            for (const infraction of expiredInfractions) {
                await this.deleteInfraction(infraction.id);
            }

            return expiredInfractions;
        } catch (error) {
            this.handleError(error, 'checkExpiredInfractions', { guildId });
            return [];
        }
    }

    /**
     * Get infraction statistics for a guild
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Statistics object
     */
    async getInfractionStats(guildId) {
        try {
            this.validateRequired({ guildId }, ['guildId']);

            const results = await this.query(
                `SELECT type, COUNT(*) as count FROM infractions WHERE guild_id = ? GROUP BY type`,
                [guildId]
            );

            const stats = {
                total: 0,
                byType: {}
            };

            if (results) {
                for (const row of results) {
                    stats.byType[row.type] = row.count;
                    stats.total += row.count;
                }
            }

            return stats;
        } catch (error) {
            this.handleError(error, 'getInfractionStats', { guildId });
            return { total: 0, byType: {} };
        }
    }

    /**
     * Get recent infractions for a guild
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of recent infractions to fetch (default: 10)
     * @returns {Promise<Array>} Array of recent infractions
     */
    async getRecentInfractions(guildId, limit = 10) {
        try {
            this.validateRequired({ guildId }, ['guildId']);

            const results = await this.query(
                `SELECT * FROM infractions WHERE guild_id = ? ORDER BY timestamp DESC LIMIT ?`,
                [guildId, limit]
            );

            return results || [];
        } catch (error) {
            this.handleError(error, 'getRecentInfractions', { guildId, limit });
            return [];
        }
    }
}

module.exports = InfractionService;
