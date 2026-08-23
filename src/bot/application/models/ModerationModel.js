'use strict';

/**
 * ModerationModel
 * 
 * Manages moderation records: user_warnings, infractions, audit_logs, auto_mod_rules.
 * Synchronized with consolidated schema.
 */

const Model = require('../../system/core/Model');
const { randomUUID } = require('crypto');

class ModerationModel extends Model {
    constructor(instance) {
        super(instance);
        this.tableName = 'user_warnings';
        this.primaryKey = 'id';
    }

    /**
     * Add a warning
     * @param {string} userId
     * @param {string} guildId
     * @param {string} moderatorId
     * @param {string} reason
     * @param {number} expiresIn - in seconds
     * @returns {Promise<Object>}
     */
    async addWarning(userId, guildId, moderatorId, reason, expiresIn = null) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = expiresIn ? now + expiresIn : null;

            const res = await this.query(
                `INSERT INTO user_warnings (guild_id, user_id, moderator_id, reason, active, expires_at, created_at)
                 VALUES (?, ?, ?, ?, 1, ?, ?) RETURNING id`,
                [guildId, userId, moderatorId, reason, expiresAt, now]
            );
            const warningId = res?.[0]?.id || 1;

            // Also record in infractions table
            await this.query(
                `INSERT INTO infractions (user_id, guild_id, moderator_id, type, reason, active, expires_at, metadata_json, created_at)
                 VALUES (?, ?, ?, 'warn', ?, 1, ?, '{}', ?)`,
                [userId, guildId, moderatorId, reason, expiresAt, now]
            );

            this.log(`Added warning ${warningId} for user ${userId}`, 'info');

            return {
                id: warningId,
                userId,
                guildId,
                moderatorId,
                reason,
                expiresAt,
                timestamp: now
            };
        } catch (error) {
            this.log(`Error adding warning for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get warnings for user
     * @param {string} userId
     * @param {string} guildId
     * @param {boolean} activeOnly
     * @returns {Promise<Array>}
     */
    async getWarnings(userId, guildId, activeOnly = true) {
        try {
            let sql = `SELECT * FROM user_warnings WHERE user_id = ? AND guild_id = ?`;
            const params = [userId, guildId];

            if (activeOnly) {
                sql += ` AND active = 1`;
            }

            sql += ` ORDER BY created_at DESC`;

            const rows = await this.query(sql, params);
            return (rows || []).map(r => ({
                ...r,
                is_active: Boolean(r.active)
            }));
        } catch (error) {
            this.log(`Error getting warnings for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Remove or deactivate a warning
     * @param {string} warningId
     */
    async removeWarning(warningId) {
        try {
            await this.query(`UPDATE user_warnings SET active = 0 WHERE id = ?`, [warningId]);
            await this.query(`UPDATE infractions SET active = 0 WHERE id = ?`, [warningId]);
            this.log(`Deactivated warning ${warningId}`, 'info');
        } catch (error) {
            this.log(`Error removing warning ${warningId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Clear all warnings for user
     * @param {string} userId
     * @param {string} guildId
     */
    async clearWarnings(userId, guildId) {
        try {
            await this.query(
                `UPDATE user_warnings SET active = 0 WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            );
            await this.query(
                `UPDATE infractions SET active = 0 WHERE user_id = ? AND guild_id = ? AND type = 'warn'`,
                [userId, guildId]
            );
            this.log(`Cleared warnings for user ${userId}`, 'info');
        } catch (error) {
            this.log(`Error clearing warnings for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Log a moderation action / infraction
     * @param {string} guildId
     * @param {string} action - 'warn', 'mute', 'kick', 'ban', etc.
     * @param {string} targetUserId
     * @param {string} moderatorId
     * @param {string} reason
     * @param {number} duration - in seconds
     * @param {Object} metadata
     */
    async logAction(guildId, action, targetUserId, moderatorId, reason, duration = null, metadata = {}) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = duration ? now + duration : null;

            const res = await this.query(
                `INSERT INTO infractions (user_id, guild_id, moderator_id, type, reason, active, expires_at, metadata_json, created_at)
                 VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?) RETURNING id`,
                [targetUserId, guildId, moderatorId, action, reason, expiresAt, JSON.stringify(metadata), now]
            );
            const infractionId = res?.[0]?.id || 1;

            // Also log to audit_logs
            await this.query(
                `INSERT INTO audit_logs (guild_id, actor_id, action, category, target_id, details_json, created_at)
                 VALUES (?, ?, ?, 'moderation', ?, ?, ?)`,
                [guildId, moderatorId, `mod_${action}`, targetUserId, JSON.stringify({ ...metadata, reason }), now]
            );

            this.log(`Logged ${action} action for user ${targetUserId}`, 'info');
            return {
                id: infractionId,
                guildId,
                targetUserId,
                moderatorId,
                action,
                reason,
                expiresAt,
                createdAt: now
            };
        } catch (error) {
            this.log(`Error logging action: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get infractions for a user
     * @param {string} userId
     * @param {string} guildId
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getInfractions(userId, guildId, limit = 50) {
        try {
            const rows = await this.query(
                `SELECT * FROM infractions
                 WHERE user_id = ? AND guild_id = ?
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [userId, guildId, limit]
            );
            return rows || [];
        } catch (error) {
            this.log(`Error getting infractions for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get moderation stats
     * @param {string} guildId
     * @returns {Promise<Object>}
     */
    async getModStats(guildId) {
        try {
            const total = (await this.query(
                `SELECT COUNT(*) as c FROM infractions WHERE guild_id = ?`,
                [guildId]
            ))?.[0]?.c || 0;

            const warnings = (await this.query(
                `SELECT COUNT(*) as c FROM infractions WHERE guild_id = ? AND type = 'warn'`,
                [guildId]
            ))?.[0]?.c || 0;

            const kicks = (await this.query(
                `SELECT COUNT(*) as c FROM infractions WHERE guild_id = ? AND type = 'kick'`,
                [guildId]
            ))?.[0]?.c || 0;

            const bans = (await this.query(
                `SELECT COUNT(*) as c FROM infractions WHERE guild_id = ? AND type = 'ban'`,
                [guildId]
            ))?.[0]?.c || 0;

            const activeWarnings = (await this.query(
                `SELECT COUNT(*) as c FROM user_warnings WHERE guild_id = ? AND active = 1`,
                [guildId]
            ))?.[0]?.c || 0;

            return {
                totalActions: total,
                warnings,
                kicks,
                bans,
                activeWarnings
            };
        } catch (error) {
            this.log(`Error getting mod stats: ${error.message}`, 'error');
            return {
                totalActions: 0,
                warnings: 0,
                kicks: 0,
                bans: 0,
                activeWarnings: 0
            };
        }
    }

    /**
     * Expire old warnings
     * @param {string} guildId
     * @returns {Promise<number>}
     */
    async expireWarnings(guildId = null) {
        try {
            const now = Math.floor(Date.now() / 1000);
            let sql = `UPDATE user_warnings SET active = 0 WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?`;
            const params = [now];

            if (guildId) {
                sql += ` AND guild_id = ?`;
                params.push(guildId);
            }

            const result = await this.query(sql, params);
            return result?.changes || 0;
        } catch (error) {
            this.log(`Error expiring warnings: ${error.message}`, 'warn');
            return 0;
        }
    }
}

module.exports = ModerationModel;
