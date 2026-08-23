'use strict';

/**
 * GuildModel
 * 
 * Manages database operations for Discord guilds.
 * Synchronized with consolidated schema: (guild_id, name, config_json, prefix, created_at, updated_at).
 */

const Model = require('../../system/core/Model');

class GuildModel extends Model {
    constructor(instance) {
        super(instance);
        this.tableName = 'guilds';
        this.primaryKey = 'guild_id';

        // In-memory cache
        this.guildCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes TTL
    }

    /**
     * Get guild record and configuration
     * @param {string} guildId
     * @returns {Promise<Object|null>}
     */
    async getGuildConfig(guildId) {
        try {
            const cached = this._getCachedGuild(guildId);
            if (cached) return cached;

            const guild = await this.findById(guildId);
            if (!guild) return null;

            // Parse config_json
            let config = {};
            if (guild.config_json && typeof guild.config_json === 'string') {
                try {
                    config = JSON.parse(guild.config_json);
                } catch {
                    config = {};
                }
            } else if (guild.config_json && typeof guild.config_json === 'object') {
                config = guild.config_json;
            }

            const result = {
                guild_id: guild.guild_id,
                name: guild.name,
                prefix: guild.prefix || '!',
                config: config,
                settings: config, // alias for backward compatibility
                created_at: guild.created_at,
                updated_at: guild.updated_at,
            };

            this._cacheGuild(guildId, result);
            return result;
        } catch (error) {
            this.log(`Error getting guild config for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update guild configuration JSON
     * @param {string} guildId
     * @param {Object} config
     * @returns {Promise<void>}
     */
    async updateGuildConfig(guildId, config) {
        try {
            const configJson = JSON.stringify(config);
            const now = Math.floor(Date.now() / 1000);
            const prefix = config.prefix || '!';

            await this.query(
                `INSERT INTO guilds (guild_id, config_json, prefix, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET
                    config_json = excluded.config_json,
                    prefix = excluded.prefix,
                    updated_at = excluded.updated_at`,
                [guildId, configJson, prefix, now, now]
            );

            this._invalidateCache(guildId);
            this.log(`Updated config for guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error updating guild config for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get DJ role ID
     * @param {string} guildId
     * @returns {Promise<string|null>}
     */
    async getDJRole(guildId) {
        const guild = await this.getGuildConfig(guildId);
        return guild?.config?.dj_role || guild?.config?.dj_role_id || null;
    }

    /**
     * Set DJ role ID
     * @param {string} guildId
     * @param {string} roleId
     */
    async setDJRole(guildId, roleId) {
        const guild = await this.getGuildConfig(guildId) || {};
        const config = guild.config || {};
        config.dj_role = roleId;
        config.dj_role_id = roleId;
        await this.updateGuildConfig(guildId, config);
    }

    /**
     * Remove DJ role
     * @param {string} guildId
     */
    async removeDJRole(guildId) {
        const guild = await this.getGuildConfig(guildId);
        if (guild?.config) {
            delete guild.config.dj_role;
            delete guild.config.dj_role_id;
            await this.updateGuildConfig(guildId, guild.config);
        }
    }

    /**
     * Get a specific setting value
     * @param {string} guildId
     * @param {string} key
     * @param {*} defaultValue
     * @returns {Promise<*>}
     */
    async getConfigValue(guildId, key, defaultValue = null) {
        const guild = await this.getGuildConfig(guildId);
        if (!guild || !guild.config) return defaultValue;
        return guild.config[key] !== undefined ? guild.config[key] : defaultValue;
    }

    /**
     * Set a specific setting value
     * @param {string} guildId
     * @param {string} key
     * @param {*} value
     */
    async setConfigValue(guildId, key, value) {
        const guild = await this.getGuildConfig(guildId) || {};
        const config = guild.config || {};
        config[key] = value;
        await this.updateGuildConfig(guildId, config);
    }

    /**
     * Initialize guild record
     * @param {string} guildId
     * @param {string} guildName
     */
    async initializeGuild(guildId, guildName) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const defaultConfig = {
                prefix: '!',
                dj_role: null,
                volume_default: 80,
                max_queue_size: 100,
                welcome_enabled: false,
                welcome_channel: null,
                welcome_message: 'Welcome {user} to {server}!',
                auto_role: null,
                goodbye_enabled: false,
                goodbye_channel: null,
                goodbye_message: 'Goodbye {user}!',
                moderation_log_channel: null,
                leveling_xp_multiplier: 1.0,
                economy_starting_balance: 1000,
            };

            await this.query(
                `INSERT INTO guilds (guild_id, name, config_json, prefix, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET
                    name = excluded.name,
                    updated_at = excluded.updated_at`,
                [guildId, guildName, JSON.stringify(defaultConfig), '!', now, now]
            );

            this._invalidateCache(guildId);
            this.log(`Initialized guild ${guildId} (${guildName})`, 'info');
        } catch (error) {
            this.log(`Error initializing guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Delete guild record
     * @param {string} guildId
     */
    async deleteGuild(guildId) {
        try {
            await this.query('DELETE FROM guilds WHERE guild_id = ?', [guildId]);
            this._invalidateCache(guildId);
            this.log(`Deleted guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error deleting guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    _cacheGuild(guildId, guild) {
        this.guildCache.set(guildId, {
            data: guild,
            timestamp: Date.now()
        });
    }

    _getCachedGuild(guildId) {
        const cached = this.guildCache.get(guildId);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.guildCache.delete(guildId);
            return null;
        }
        return cached.data;
    }

    _invalidateCache(guildId) {
        this.guildCache.delete(guildId);
    }

    clearCache() {
        this.guildCache.clear();
    }
}

module.exports = GuildModel;
