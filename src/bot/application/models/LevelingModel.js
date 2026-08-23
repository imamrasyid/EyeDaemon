'use strict';

/**
 * LevelingModel
 * 
 * Manages user leveling and XP data.
 * Synchronized with consolidated schema: user_levels (user_id, guild_id, xp, level, last_message_at, created_at, updated_at).
 */

const Model = require('../../system/core/Model');

class LevelingModel extends Model {
    constructor(instance) {
        super(instance);
        this.tableName = 'user_levels';
    }

    /**
     * Get user level information
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object|null>}
     */
    async getUserLevel(userId, guildId) {
        try {
            const rows = await this.query(
                `SELECT user_id, guild_id, xp, level, last_message_at, created_at, updated_at
                 FROM user_levels
                 WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            );

            if (rows && rows.length > 0) {
                const levelData = rows[0];
                const xpForNextLevel = this.calculateXPForLevel(levelData.level + 1);
                const xpForCurrentLevel = this.calculateXPForLevel(levelData.level);
                const xpInCurrentLevel = levelData.xp - xpForCurrentLevel;
                const xpNeededForNextLevel = Math.max(1, xpForNextLevel - xpForCurrentLevel);
                const progress = Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNextLevel) * 100));

                return {
                    userId: levelData.user_id,
                    guildId: levelData.guild_id,
                    xp: levelData.xp,
                    level: levelData.level,
                    lastMessageAt: levelData.last_message_at,
                    totalMessages: Math.floor(levelData.xp / 15), // estimate from xp
                    xpForNextLevel,
                    xpInCurrentLevel: Math.max(0, xpInCurrentLevel),
                    progress
                };
            }

            return {
                userId,
                guildId,
                xp: 0,
                level: 0,
                lastMessageAt: null,
                totalMessages: 0,
                xpForNextLevel: this.calculateXPForLevel(1),
                xpInCurrentLevel: 0,
                progress: 0
            };
        } catch (error) {
            this.log(`Error getting level for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Add XP to user atomically
     * @param {string} userId
     * @param {string} guildId
     * @param {number} xp
     * @returns {Promise<Object>}
     */
    async addXP(userId, guildId, xp) {
        try {
            await this._ensureLevelRecord(userId, guildId);

            const now = Math.floor(Date.now() / 1000);
            const beforeRows = await this.query(
                `SELECT xp, level FROM user_levels WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            );

            const oldXP = beforeRows?.[0]?.xp || 0;
            const oldLevel = beforeRows?.[0]?.level || 0;
            const newXP = oldXP + xp;
            const newLevel = this.calculateLevelFromXP(newXP);

            await this.query(
                `UPDATE user_levels
                 SET xp = ?,
                     level = ?,
                     last_message_at = ?,
                     updated_at = ?
                 WHERE user_id = ? AND guild_id = ?`,
                [newXP, newLevel, now, now, userId, guildId]
            );

            return {
                leveledUp: newLevel > oldLevel,
                oldLevel,
                newLevel,
                xpGained: xp,
                oldXP,
                newXP,
                guildId
            };
        } catch (error) {
            this.log(`Error adding XP for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Batch add XP
     * @param {Array<Object>} updates
     * @returns {Promise<Array>}
     */
    async batchAddXP(updates) {
        try {
            for (const { userId, guildId } of updates) {
                await this._ensureLevelRecord(userId, guildId);
            }

            const results = [];
            const now = Math.floor(Date.now() / 1000);

            await this.db.transaction(async (tx) => {
                for (const { userId, guildId, xp } of updates) {
                    const rows = await tx.query(
                        `SELECT xp, level FROM user_levels WHERE user_id = ? AND guild_id = ?`,
                        [userId, guildId]
                    );

                    const oldXP = rows?.[0]?.xp || 0;
                    const oldLevel = rows?.[0]?.level || 0;
                    const newXP = oldXP + xp;
                    const newLevel = this.calculateLevelFromXP(newXP);

                    await tx.query(
                        `UPDATE user_levels
                         SET xp = ?, level = ?, last_message_at = ?, updated_at = ?
                         WHERE user_id = ? AND guild_id = ?`,
                        [newXP, newLevel, now, now, userId, guildId]
                    );

                    results.push({
                        userId,
                        guildId,
                        leveledUp: newLevel > oldLevel,
                        oldLevel,
                        newLevel,
                        xpGained: xp,
                        oldXP,
                        newXP
                    });
                }
            });

            return results;
        } catch (error) {
            this.log(`Error batch adding XP: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Remove XP
     * @param {string} userId
     * @param {string} guildId
     * @param {number} xp
     */
    async removeXP(userId, guildId, xp) {
        try {
            await this._ensureLevelRecord(userId, guildId);

            const beforeRows = await this.query(
                `SELECT xp FROM user_levels WHERE user_id = ? AND guild_id = ?`,
                [userId, guildId]
            );

            const oldXP = beforeRows?.[0]?.xp || 0;
            const newXP = Math.max(0, oldXP - xp);
            const newLevel = this.calculateLevelFromXP(newXP);
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `UPDATE user_levels
                 SET xp = ?, level = ?, updated_at = ?
                 WHERE user_id = ? AND guild_id = ?`,
                [newXP, newLevel, now, userId, guildId]
            );

            this.log(`Removed ${xp} XP from user ${userId}`, 'info');
        } catch (error) {
            this.log(`Error removing XP for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Set level
     * @param {string} userId
     * @param {string} guildId
     * @param {number} level
     */
    async setLevel(userId, guildId, level) {
        try {
            await this._ensureLevelRecord(userId, guildId);
            const xp = this.calculateXPForLevel(level);
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `UPDATE user_levels
                 SET xp = ?, level = ?, updated_at = ?
                 WHERE user_id = ? AND guild_id = ?`,
                [xp, level, now, userId, guildId]
            );

            this.log(`Set level for user ${userId} to ${level}`, 'info');
        } catch (error) {
            this.log(`Error setting level for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Reset XP
     * @param {string} userId
     * @param {string} guildId
     */
    async resetXP(userId, guildId) {
        try {
            await this._ensureLevelRecord(userId, guildId);
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `UPDATE user_levels
                 SET xp = 0, level = 0, updated_at = ?
                 WHERE user_id = ? AND guild_id = ?`,
                [now, userId, guildId]
            );

            this.log(`Reset XP for user ${userId}`, 'info');
        } catch (error) {
            this.log(`Error resetting XP for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Add voice activity time
     * @param {string} userId
     * @param {string} guildId
     * @param {number} minutes
     */
    async addVoiceTime(userId, guildId, minutes) {
        // Awards 5 XP per voice minute
        await this.addXP(userId, guildId, minutes * 5);
    }

    /**
     * Get leaderboard
     * @param {string} guildId
     * @param {string} type
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getLeaderboard(guildId, type = 'xp', limit = 10) {
        try {
            let orderBy = 'xp DESC';
            if (type === 'level') orderBy = 'level DESC, xp DESC';

            const rows = await this.query(
                `SELECT user_id, xp, level, last_message_at
                 FROM user_levels
                 WHERE guild_id = ?
                 ORDER BY ${orderBy}
                 LIMIT ?`,
                [guildId, limit]
            );

            return rows.map((row, index) => ({
                rank: index + 1,
                userId: row.user_id,
                xp: row.xp,
                level: row.level,
                totalMessages: Math.floor(row.xp / 15),
            }));
        } catch (error) {
            this.log(`Error getting leaderboard: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get user rank in guild
     * @param {string} userId
     * @param {string} guildId
     * @returns {Promise<number>}
     */
    async getUserRank(userId, guildId) {
        try {
            const rows = await this.query(
                `SELECT COUNT(*) + 1 as rank
                 FROM user_levels
                 WHERE guild_id = ? AND xp > (
                     SELECT COALESCE(xp, 0) FROM user_levels WHERE guild_id = ? AND user_id = ?
                 )`,
                [guildId, guildId, userId]
            );

            return rows?.[0]?.rank || 1;
        } catch (error) {
            this.log(`Error getting user rank: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Calculate XP required for a level
     * @param {number} level
     * @returns {number}
     */
    calculateXPForLevel(level) {
        if (level <= 0) return 0;
        return 5 * (level ** 2) + 50 * level + 100;
    }

    /**
     * Calculate level from XP
     * @param {number} xp
     * @returns {number}
     */
    calculateLevelFromXP(xp) {
        if (xp <= 0) return 0;
        let level = 0;
        while (xp >= this.calculateXPForLevel(level + 1)) {
            level++;
        }
        return level;
    }

    /**
     * Ensure level record exists
     * @private
     */
    async _ensureLevelRecord(userId, guildId) {
        const now = Math.floor(Date.now() / 1000);

        // Ensure user profile exists for FK
        await this.query(
            `INSERT INTO user_profiles (user_id, created_at, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id) DO NOTHING`,
            [userId, now, now]
        );

        // Ensure user_levels row exists
        await this.query(
            `INSERT INTO user_levels (user_id, guild_id, xp, level, created_at, updated_at)
             VALUES (?, ?, 0, 0, ?, ?)
             ON CONFLICT(user_id, guild_id) DO NOTHING`,
            [userId, guildId, now, now]
        );
    }
}

module.exports = LevelingModel;
