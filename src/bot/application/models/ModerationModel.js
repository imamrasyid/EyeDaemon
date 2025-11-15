/**
 * ModerationModel
 * 
 * Model for managing moderation data including warnings, bans, and infractions.
 * Updated for new Turso DB schema with separate tables for warnings, logs, and automod config.
 */

const Model = require('../../system/core/Model');
const { v4: uuidv4 } = require('uuid');

class ModerationModel extends Model {
    /**
     * Create a new ModerationModel instance
     * @param {Object} instance - The parent instance
     */
    constructor(instance) {
        super(instance);
        this.tableName = 'user_warnings';
    }

    /**
     * Add warning to user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} moderatorId - Moderator user ID
     * @param {string} reason - Warning reason
     * @param {number} expiresIn - Expiration time in seconds (optional)
     * @returns {Promise<Object>} Warning information
     */
    async addWarning(userId, guildId, moderatorId, reason, expiresIn = null) {
        try {
            const warningId = uuidv4();
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = expiresIn ? now + expiresIn : null;

            await this.insert({
                id: warningId,
                guild_id: guildId,
                user_id: userId,
                moderator_id: moderatorId,
                reason: reason,
                is_active: true,
                expires_at: expiresAt,
                created_at: now
            });

            // Log the moderation action
            await this.logAction(guildId, 'warn', userId, moderatorId, reason);

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
     * Get user warnings
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {boolean} activeOnly - Return only active warnings
     * @returns {Promise<Array>} List of warnings
     */
    async getWarnings(userId, guildId, activeOnly = true) {
        try {
            // Expire old warnings first
            await this._expireWarnings(guildId);

            const criteria = {
                user_id: userId,
                guild_id: guildId
            };

            if (activeOnly) {
                criteria.is_active = true;
            }

            const results = await this.findBy(criteria, {
                orderBy: 'created_at DESC'
            });

            return results || [];
        } catch (error) {
            this.log(`Error getting warnings for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Remove warning
     * @param {string} warningId - Warning ID
     * @returns {Promise<void>}
     */
    async removeWarning(warningId) {
        try {
            await this.update(warningId, {
                is_active: false
            });

            this.log(`Removed warning ${warningId}`, 'info');
        } catch (error) {
            this.log(`Error removing warning ${warningId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Clear all warnings for a user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async clearWarnings(userId, guildId) {
        try {
            await this.updateBy(
                { user_id: userId, guild_id: guildId },
                { is_active: false }
            );

            this.log(`Cleared warnings for user ${userId}`, 'info');
        } catch (error) {
            this.log(`Error clearing warnings for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Log moderation action
     * @param {string} guildId - Guild ID
     * @param {string} action - Action type (kick, ban, timeout, warn, etc.)
     * @param {string} targetUserId - Target user ID
     * @param {string} moderatorId - Moderator user ID
     * @param {string} reason - Action reason
     * @param {number} duration - Duration in seconds (for temp actions)
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<void>}
     */
    async logAction(guildId, action, targetUserId, moderatorId, reason, duration = null, metadata = {}) {
        try {
            const logId = uuidv4();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO moderation_logs 
                 (id, guild_id, action, target_user_id, moderator_id, reason, duration, metadata, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [logId, guildId, action, targetUserId, moderatorId, reason, duration, JSON.stringify(metadata), now]
            );

            this.log(`Logged ${action} action for user ${targetUserId}`, 'info');
        } catch (error) {
            this.log(`Error logging action: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get user infractions (all moderation actions)
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of infractions to return
     * @returns {Promise<Array>} List of infractions
     */
    async getInfractions(userId, guildId, limit = 50) {
        try {
            const results = await this.query(
                `SELECT * FROM moderation_logs 
                 WHERE target_user_id = ? AND guild_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [userId, guildId, limit]
            );

            return results || [];
        } catch (error) {
            this.log(`Error getting infractions for user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get guild moderation logs
     * @param {string} guildId - Guild ID
     * @param {Object} options - Query options (action, moderatorId, limit)
     * @returns {Promise<Array>} List of moderation logs
     */
    async getModLogs(guildId, options = {}) {
        try {
            const { action, moderatorId, limit = 50 } = options;

            let sql = `SELECT * FROM moderation_logs WHERE guild_id = ?`;
            const params = [guildId];

            if (action) {
                sql += ` AND action = ?`;
                params.push(action);
            }

            if (moderatorId) {
                sql += ` AND moderator_id = ?`;
                params.push(moderatorId);
            }

            sql += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            const results = await this.query(sql, params);

            return results || [];
        } catch (error) {
            this.log(`Error getting mod logs for guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get moderation statistics for guild
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Moderation statistics
     */
    async getModStats(guildId) {
        try {
            const totalResult = await this.query(
                `SELECT COUNT(*) as total FROM moderation_logs WHERE guild_id = ?`,
                [guildId]
            );

            const warningsResult = await this.query(
                `SELECT COUNT(*) as total FROM moderation_logs WHERE guild_id = ? AND action = 'warn'`,
                [guildId]
            );

            const kicksResult = await this.query(
                `SELECT COUNT(*) as total FROM moderation_logs WHERE guild_id = ? AND action = 'kick'`,
                [guildId]
            );

            const bansResult = await this.query(
                `SELECT COUNT(*) as total FROM moderation_logs WHERE guild_id = ? AND action = 'ban'`,
                [guildId]
            );

            const activeWarningsResult = await this.query(
                `SELECT COUNT(*) as total FROM ${this.tableName} WHERE guild_id = ? AND is_active = true`,
                [guildId]
            );

            return {
                totalActions: totalResult[0]?.total || 0,
                warnings: warningsResult[0]?.total || 0,
                kicks: kicksResult[0]?.total || 0,
                bans: bansResult[0]?.total || 0,
                activeWarnings: activeWarningsResult[0]?.total || 0
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
     * Get automod configuration
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Automod configuration
     */
    async getAutomodConfig(guildId) {
        try {
            const result = await this.query(
                `SELECT * FROM automod_config WHERE guild_id = ?`,
                [guildId]
            );

            if (result && result.length > 0) {
                const config = result[0];

                // Parse JSON fields
                if (config.filtered_words && typeof config.filtered_words === 'string') {
                    try {
                        config.filtered_words = JSON.parse(config.filtered_words);
                    } catch (e) {
                        config.filtered_words = [];
                    }
                }

                if (config.allowed_domains && typeof config.allowed_domains === 'string') {
                    try {
                        config.allowed_domains = JSON.parse(config.allowed_domains);
                    } catch (e) {
                        config.allowed_domains = [];
                    }
                }

                if (config.settings && typeof config.settings === 'string') {
                    try {
                        config.settings = JSON.parse(config.settings);
                    } catch (e) {
                        config.settings = {};
                    }
                }

                return config;
            }

            // Return default config
            return {
                guild_id: guildId,
                spam_detection: true,
                spam_threshold: 5,
                word_filter_enabled: false,
                filtered_words: [],
                link_filter_enabled: false,
                allowed_domains: [],
                caps_filter_enabled: false,
                caps_threshold: 70,
                emoji_filter_enabled: false,
                emoji_threshold: 10,
                raid_protection: false,
                settings: {}
            };
        } catch (error) {
            this.log(`Error getting automod config for guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update automod configuration
     * @param {string} guildId - Guild ID
     * @param {Object} config - Configuration object
     * @returns {Promise<void>}
     */
    async updateAutomodConfig(guildId, config) {
        try {
            const now = Math.floor(Date.now() / 1000);

            const updateData = {
                guild_id: guildId,
                updated_at: now
            };

            // Add all config fields
            if (config.spam_detection !== undefined) updateData.spam_detection = config.spam_detection;
            if (config.spam_threshold !== undefined) updateData.spam_threshold = config.spam_threshold;
            if (config.word_filter_enabled !== undefined) updateData.word_filter_enabled = config.word_filter_enabled;
            if (config.filtered_words !== undefined) updateData.filtered_words = JSON.stringify(config.filtered_words);
            if (config.link_filter_enabled !== undefined) updateData.link_filter_enabled = config.link_filter_enabled;
            if (config.allowed_domains !== undefined) updateData.allowed_domains = JSON.stringify(config.allowed_domains);
            if (config.caps_filter_enabled !== undefined) updateData.caps_filter_enabled = config.caps_filter_enabled;
            if (config.caps_threshold !== undefined) updateData.caps_threshold = config.caps_threshold;
            if (config.emoji_filter_enabled !== undefined) updateData.emoji_filter_enabled = config.emoji_filter_enabled;
            if (config.emoji_threshold !== undefined) updateData.emoji_threshold = config.emoji_threshold;
            if (config.raid_protection !== undefined) updateData.raid_protection = config.raid_protection;
            if (config.settings !== undefined) updateData.settings = JSON.stringify(config.settings);

            // Use upsert to insert or update
            await this.query(
                `INSERT INTO automod_config (guild_id, spam_detection, spam_threshold, word_filter_enabled, filtered_words, 
                 link_filter_enabled, allowed_domains, caps_filter_enabled, caps_threshold, emoji_filter_enabled, 
                 emoji_threshold, raid_protection, settings, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                 ON CONFLICT(guild_id) DO UPDATE SET 
                 spam_detection = excluded.spam_detection,
                 spam_threshold = excluded.spam_threshold,
                 word_filter_enabled = excluded.word_filter_enabled,
                 filtered_words = excluded.filtered_words,
                 link_filter_enabled = excluded.link_filter_enabled,
                 allowed_domains = excluded.allowed_domains,
                 caps_filter_enabled = excluded.caps_filter_enabled,
                 caps_threshold = excluded.caps_threshold,
                 emoji_filter_enabled = excluded.emoji_filter_enabled,
                 emoji_threshold = excluded.emoji_threshold,
                 raid_protection = excluded.raid_protection,
                 settings = excluded.settings,
                 updated_at = excluded.updated_at`,
                [
                    updateData.guild_id,
                    updateData.spam_detection !== undefined ? updateData.spam_detection : true,
                    updateData.spam_threshold !== undefined ? updateData.spam_threshold : 5,
                    updateData.word_filter_enabled !== undefined ? updateData.word_filter_enabled : false,
                    updateData.filtered_words !== undefined ? updateData.filtered_words : '[]',
                    updateData.link_filter_enabled !== undefined ? updateData.link_filter_enabled : false,
                    updateData.allowed_domains !== undefined ? updateData.allowed_domains : '[]',
                    updateData.caps_filter_enabled !== undefined ? updateData.caps_filter_enabled : false,
                    updateData.caps_threshold !== undefined ? updateData.caps_threshold : 70,
                    updateData.emoji_filter_enabled !== undefined ? updateData.emoji_filter_enabled : false,
                    updateData.emoji_threshold !== undefined ? updateData.emoji_threshold : 10,
                    updateData.raid_protection !== undefined ? updateData.raid_protection : false,
                    updateData.settings !== undefined ? updateData.settings : '{}',
                    updateData.updated_at
                ]
            );

            this.log(`Updated automod config for guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error updating automod config for guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Expire old warnings based on expires_at timestamp
     * @private
     * @param {string} guildId - Guild ID
     * @returns {Promise<void>}
     */
    async _expireWarnings(guildId) {
        try {
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `UPDATE ${this.tableName} 
                 SET is_active = false 
                 WHERE guild_id = ? AND is_active = true AND expires_at IS NOT NULL AND expires_at <= ?`,
                [guildId, now]
            );
        } catch (error) {
            this.log(`Error expiring warnings: ${error.message}`, 'warn');
            // Don't throw - expiration failure shouldn't break the flow
        }
    }
}

module.exports = ModerationModel;
