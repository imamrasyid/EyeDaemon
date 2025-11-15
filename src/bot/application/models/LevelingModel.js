/**
 * LevelingModel
 * 
 * Model for managing leveling data including XP, levels, and leaderboards.
 * Updated for new Turso DB schema with user_levels table.
 */

const Model = require('../../system/core/Model');

class LevelingModel extends Model {
    /**
     * Create a new LevelingModel instance
     * @param {Object} instance - The parent instance
     */
    constructor(instance) {
        super(instance);
        this.tableName = 'user_levels';
    }

    /**
     * Get user level information
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Level information
     */
    async getUserLevel(userId, guildId) {
        try {
            const levelData = await this.findOneBy({
                guild_id: guildId,
                user_id: userId
            });

            if (levelData) {
                const xpForNextLevel = this.calculateXPForLevel(levelData.level + 1);
                const xpForCurrentLevel = this.calculateXPForLevel(levelData.level);
                const xpInCurrentLevel = levelData.xp - xpForCurrentLevel;
                const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
                const progress = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

                return {
                    xp: levelData.xp,
                    level: levelData.level,
                    totalMessages: levelData.total_messages,
                    voiceMinutes: levelData.voice_minutes,
                    lastXpAt: levelData.last_xp_at,
                    xpForNextLevel,
                    xpInCurrentLevel,
                    progress
                };
            }

            return null;
        } catch (error) {
            this.log(`Error getting level for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Add XP to user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} xp - XP to add
     * @returns {Promise<Object>} Level up information
     */
    async addXP(userId, guildId, xp) {
        try {
            await this._ensureLevelRecord(userId, guildId);

            // Apply XP multiplier from guild settings
            let multiplier = 1.0; // Default

            try {
                if (this.instance.client && this.instance.client.modules) {
                    const adminModule = this.instance.client.modules.get('admin');
                    if (adminModule) {
                        const guildConfigService = adminModule.getService('GuildConfigService');
                        if (guildConfigService) {
                            const configuredMultiplier = await guildConfigService.getSetting(guildId, 'leveling_xp_multiplier');
                            if (configuredMultiplier !== undefined && configuredMultiplier !== null) {
                                multiplier = configuredMultiplier;
                            }
                        }
                    }
                }
            } catch (error) {
                this.log(`Error getting XP multiplier from config: ${error.message}`, 'warn');
            }

            // Apply multiplier to XP
            const adjustedXP = Math.floor(xp * multiplier);

            // Get current data
            const levelData = await this.findOneBy({
                guild_id: guildId,
                user_id: userId
            });

            const oldXP = levelData.xp || 0;
            const oldLevel = levelData.level || 1;
            const newXP = oldXP + adjustedXP;
            const newLevel = this.calculateLevelFromXP(newXP);

            const now = Math.floor(Date.now() / 1000);

            // Update XP and level
            await this.updateBy(
                { guild_id: guildId, user_id: userId },
                {
                    xp: newXP,
                    level: newLevel,
                    total_messages: (levelData.total_messages || 0) + 1,
                    last_xp_at: now,
                    updated_at: now
                }
            );

            return {
                leveledUp: newLevel > oldLevel,
                oldLevel,
                newLevel,
                xpGained: adjustedXP,
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
     * Add XP to multiple users (batch operation)
     * @param {Array<Object>} updates - Array of {userId, guildId, xp} objects
     * @returns {Promise<Array>} Array of level up results
     */
    async batchAddXP(updates) {
        try {
            const results = [];

            // Use transaction for atomicity
            await this.db.transaction(async (db) => {
                for (const update of updates) {
                    const { userId, guildId, xp } = update;

                    // Ensure record exists
                    await this._ensureLevelRecord(userId, guildId);

                    // Get current data
                    const levelData = await this.findOneBy({
                        guild_id: guildId,
                        user_id: userId
                    });

                    const oldXP = levelData.xp || 0;
                    const oldLevel = levelData.level || 1;
                    const newXP = oldXP + xp;
                    const newLevel = this.calculateLevelFromXP(newXP);

                    const now = Math.floor(Date.now() / 1000);

                    // Update XP and level
                    await db.query(
                        `UPDATE ${this.tableName} 
                         SET xp = ?, level = ?, total_messages = total_messages + 1, last_xp_at = ?, updated_at = ? 
                         WHERE guild_id = ? AND user_id = ?`,
                        [newXP, newLevel, now, now, guildId, userId]
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
     * Remove XP from user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} xp - XP to remove
     * @returns {Promise<void>}
     */
    async removeXP(userId, guildId, xp) {
        try {
            await this._ensureLevelRecord(userId, guildId);

            const levelData = await this.findOneBy({
                guild_id: guildId,
                user_id: userId
            });

            const currentXP = levelData.xp || 0;
            const newXP = Math.max(0, currentXP - xp);
            const newLevel = this.calculateLevelFromXP(newXP);

            const now = Math.floor(Date.now() / 1000);

            await this.updateBy(
                { guild_id: guildId, user_id: userId },
                {
                    xp: newXP,
                    level: newLevel,
                    updated_at: now
                }
            );

            this.log(`Removed ${xp} XP from user ${userId}`, 'info');
        } catch (error) {
            this.log(`Error removing XP for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Set user level
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} level - Level to set
     * @returns {Promise<void>}
     */
    async setLevel(userId, guildId, level) {
        try {
            await this._ensureLevelRecord(userId, guildId);

            const xp = this.calculateXPForLevel(level);
            const now = Math.floor(Date.now() / 1000);

            await this.updateBy(
                { guild_id: guildId, user_id: userId },
                {
                    xp,
                    level,
                    updated_at: now
                }
            );

            this.log(`Set level for user ${userId} to ${level}`, 'info');
        } catch (error) {
            this.log(`Error setting level for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Reset user XP
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async resetXP(userId, guildId) {
        try {
            await this._ensureLevelRecord(userId, guildId);

            const now = Math.floor(Date.now() / 1000);

            await this.updateBy(
                { guild_id: guildId, user_id: userId },
                {
                    xp: 0,
                    level: 1,
                    updated_at: now
                }
            );

            this.log(`Reset XP for user ${userId}`, 'info');
        } catch (error) {
            this.log(`Error resetting XP for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Add voice activity time
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} minutes - Minutes to add
     * @returns {Promise<void>}
     */
    async addVoiceTime(userId, guildId, minutes) {
        try {
            await this._ensureLevelRecord(userId, guildId);

            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `UPDATE ${this.tableName} 
                 SET voice_minutes = voice_minutes + ?, updated_at = ? 
                 WHERE guild_id = ? AND user_id = ?`,
                [minutes, now, guildId, userId]
            );

            this.log(`Added ${minutes} voice minutes for user ${userId}`, 'info');
        } catch (error) {
            this.log(`Error adding voice time for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get leaderboard
     * @param {string} guildId - Guild ID
     * @param {string} type - Leaderboard type ('xp', 'level', 'messages')
     * @param {number} limit - Number of users to return
     * @returns {Promise<Array>} Leaderboard data
     */
    async getLeaderboard(guildId, type = 'xp', limit = 10) {
        try {
            let orderBy = 'xp DESC';
            switch (type) {
                case 'level':
                    orderBy = 'level DESC, xp DESC';
                    break;
                case 'messages':
                    orderBy = 'total_messages DESC';
                    break;
                case 'voice':
                    orderBy = 'voice_minutes DESC';
                    break;
                default:
                    orderBy = 'xp DESC';
            }

            const results = await this.query(
                `SELECT user_id, xp, level, total_messages, voice_minutes 
                 FROM ${this.tableName} 
                 WHERE guild_id = ? 
                 ORDER BY ${orderBy} 
                 LIMIT ?`,
                [guildId, limit]
            );

            return results.map((row, index) => ({
                rank: index + 1,
                userId: row.user_id,
                xp: row.xp,
                level: row.level,
                totalMessages: row.total_messages,
                voiceMinutes: row.voice_minutes
            }));
        } catch (error) {
            this.log(`Error getting leaderboard: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get user rank in guild
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<number>} User rank (1-based)
     */
    async getUserRank(userId, guildId) {
        try {
            const result = await this.query(
                `SELECT COUNT(*) + 1 as rank 
                 FROM ${this.tableName} 
                 WHERE guild_id = ? AND xp > (
                     SELECT xp FROM ${this.tableName} 
                     WHERE guild_id = ? AND user_id = ?
                 )`,
                [guildId, guildId, userId]
            );

            return result[0]?.rank || 0;
        } catch (error) {
            this.log(`Error getting user rank: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Calculate XP required for a level
     * @param {number} level - Level
     * @returns {number} XP required
     */
    calculateXPForLevel(level) {
        // Formula: XP = 5 * (level^2) + 50 * level + 100
        return 5 * (level ** 2) + 50 * level + 100;
    }

    /**
     * Calculate level from XP
     * @param {number} xp - Total XP
     * @returns {number} Level
     */
    calculateLevelFromXP(xp) {
        let level = 1;
        while (xp >= this.calculateXPForLevel(level + 1)) {
            level++;
        }
        return level;
    }

    /**
     * Ensure level record exists for user
     * @private
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async _ensureLevelRecord(userId, guildId) {
        try {
            const exists = await this.exists({
                guild_id: guildId,
                user_id: userId
            });

            if (exists) {
                return;
            }

            const now = Math.floor(Date.now() / 1000);
            const recordId = `${guildId}-${userId}`;

            await this.insert({
                id: recordId,
                guild_id: guildId,
                user_id: userId,
                xp: 0,
                level: 1,
                total_messages: 0,
                voice_minutes: 0,
                last_xp_at: null,
                created_at: now,
                updated_at: now
            });

            this.log(`Created level record for user ${userId}`, 'info');
        } catch (error) {
            this.log(`Error ensuring level record: ${error.message}`, 'error');
            throw error;
        }
    }
}

module.exports = LevelingModel;
