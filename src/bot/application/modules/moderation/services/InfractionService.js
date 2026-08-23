'use strict';

/**
 * InfractionService
 * 
 * Business logic for managing infractions (warnings, bans, kicks, etc.)
 * Synchronized with consolidated schema:
 * infractions (id, user_id, guild_id, moderator_id, type, reason, active, expires_at, metadata_json, created_at)
 */

const BaseService = require('../../../../system/core/BaseService');
const { randomUUID } = require('crypto');

class InfractionService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);
        this.moderationModel = null;
    }

    async initialize() {
        await super.initialize();

        const loader = this.client.loader;
        if (loader) {
            this.moderationModel = loader.model('ModerationModel');
        }

        this.log('InfractionService initialized', 'info');
    }

    /**
     * Create a new infraction
     */
    async createInfraction(data) {
        try {
            this.validateRequired(data, ['guildId', 'userId', 'moderatorId', 'type', 'reason']);

            const infractionId = randomUUID();
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = data.expiresAt ? Math.floor(data.expiresAt / 1000) : (data.expiresIn ? now + data.expiresIn : null);

            // Ensure user profile exists for FK
            await this.query(
                `INSERT INTO user_profiles (user_id, created_at, updated_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(user_id) DO NOTHING`,
                [data.userId, now, now]
            );

            await this.query(
                `INSERT INTO infractions (id, user_id, guild_id, moderator_id, type, reason, active, expires_at, metadata_json, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                [
                    infractionId,
                    data.userId,
                    data.guildId,
                    data.moderatorId,
                    data.type,
                    data.reason,
                    expiresAt,
                    JSON.stringify(data.metadata || {}),
                    now
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
                timestamp: now * 1000,
                expiresAt
            };
        } catch (error) {
            this.handleError(error, 'createInfraction', { data });
            throw error;
        }
    }

    /**
     * Get infraction by ID
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

            sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const results = await this.query(sql, params);
            return results || [];
        } catch (error) {
            this.handleError(error, 'getInfractions', { filters });
            return [];
        }
    }

    /**
     * Get infraction count for user
     */
    async getInfractionCount(userId, guildId, type = null) {
        try {
            this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

            let sql = `SELECT COUNT(*) as count FROM infractions WHERE user_id = ? AND guild_id = ? AND active = 1`;
            const params = [userId, guildId];

            if (type) {
                sql += ` AND type = ?`;
                params.push(type);
            }

            const results = await this.query(sql, params);
            return results?.[0]?.count || 0;
        } catch (error) {
            this.handleError(error, 'getInfractionCount', { userId, guildId, type });
            return 0;
        }
    }

    /**
     * Update infraction
     */
    async updateInfraction(infractionId, updates) {
        try {
            this.validateRequired({ infractionId }, ['infractionId']);

            const allowed = ['reason', 'expires_at', 'active'];
            const fields = [];
            const params = [];

            for (const [k, v] of Object.entries(updates)) {
                if (allowed.includes(k)) {
                    fields.push(`${k} = ?`);
                    params.push(v);
                }
            }

            if (fields.length === 0) return false;
            params.push(infractionId);

            await this.query(`UPDATE infractions SET ${fields.join(', ')} WHERE id = ?`, params);
            return true;
        } catch (error) {
            this.handleError(error, 'updateInfraction', { infractionId, updates });
            return false;
        }
    }

    /**
     * Delete infraction
     */
    async deleteInfraction(infractionId) {
        try {
            this.validateRequired({ infractionId }, ['infractionId']);
            await this.query(`DELETE FROM infractions WHERE id = ?`, [infractionId]);
            return true;
        } catch (error) {
            this.handleError(error, 'deleteInfraction', { infractionId });
            return false;
        }
    }

    /**
     * Clear infractions for user
     */
    async clearUserInfractions(userId, guildId) {
        try {
            this.validateRequired({ userId, guildId }, ['userId', 'guildId']);
            const result = await this.query(
                `UPDATE infractions SET active = 0 WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            );
            return result?.changes || 0;
        } catch (error) {
            this.handleError(error, 'clearUserInfractions', { userId, guildId });
            return 0;
        }
    }

    /**
     * Check expired infractions
     */
    async checkExpiredInfractions(guildId = null) {
        try {
            const now = Math.floor(Date.now() / 1000);
            let sql = `SELECT * FROM infractions WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?`;
            const params = [now];

            if (guildId) {
                sql += ` AND guild_id = ?`;
                params.push(guildId);
            }

            const expired = await this.query(sql, params);
            if (expired && expired.length > 0) {
                await this.query(
                    `UPDATE infractions SET active = 0 WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?`,
                    [now]
                );
            }

            return expired || [];
        } catch (error) {
            this.handleError(error, 'checkExpiredInfractions', { guildId });
            return [];
        }
    }

    /**
     * Get infraction statistics
     */
    async getInfractionStats(guildId) {
        try {
            this.validateRequired({ guildId }, ['guildId']);

            const results = await this.query(
                `SELECT type, COUNT(*) as count FROM infractions WHERE guild_id = ? GROUP BY type`,
                [guildId]
            );

            const stats = { total: 0, byType: {} };
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
}

module.exports = InfractionService;
