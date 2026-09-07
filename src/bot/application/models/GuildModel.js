'use strict';

/**
 * GuildModel
 *
 * Manages database operations for Discord guilds.
 * Synchronized with consolidated schema: (guild_id, name, config_json, prefix, created_at, updated_at).
 *
 * Note: Guild config caching is handled by GuildConfigService (single source of truth).
 * This model provides raw DB operations only.
 */

const Model = require('../../system/core/Model');

class GuildModel extends Model {
    constructor(instance) {
        super(instance);
        this.tableName = 'guilds';
        this.primaryKey = 'guild_id';
    }

    /**
     * Get guild record and configuration
     * @param {string} guildId
     * @returns {Promise<Object|null>}
     */
    async getGuildConfig(guildId) {
        try {
            const guild = await this.findById(guildId);
            if (!guild) return null;

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

            return {
                guild_id: guild.guild_id,
                name: guild.name,
                prefix: guild.prefix || '!',
                config: config,
                settings: config,
                created_at: guild.created_at,
                updated_at: guild.updated_at,
            };
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
        return guild?.config?.dj_role || null;
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
     * Initialize guild record with empty config.
     * Defaults are merged at read time by GuildConfigService.mergeWithDefaults().
     * @param {string} guildId
     * @param {string} guildName
     */
    async initializeGuild(guildId, guildName) {
        try {
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO guilds (guild_id, name, config_json, prefix, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET
                    name = excluded.name,
                    updated_at = excluded.updated_at`,
                [guildId, guildName, '{}', '!', now, now]
            );

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
            this.log(`Deleted guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error deleting guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }
}

module.exports = GuildModel;
