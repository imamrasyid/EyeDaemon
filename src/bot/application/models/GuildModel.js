/**
 * GuildModel
 * 
 * Model for managing guild-specific configuration and settings.
 * Handles database operations for guild data including DJ roles and other settings.
 * Updated for new Turso DB schema with JSON settings column.
 */

const Model = require('../../system/core/Model');

class GuildModel extends Model {
    /**
     * Create a new GuildModel instance
     * @param {Object} instance - The parent instance (usually a Controller)
     */
    constructor(instance) {
        super(instance);
        this.tableName = 'guilds';
        this.primaryKey = 'id';

        // In-memory cache for frequently accessed guilds
        this.guildCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes TTL
    }

    /**
     * Get guild configuration
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<Object|null>} Guild configuration or null if not found
     */
    async getGuildConfig(guildId) {
        try {
            // Check cache first
            const cached = this._getCachedGuild(guildId);
            if (cached) {
                return cached;
            }

            const guild = await this.findById(guildId);

            if (guild) {
                // Parse settings JSON if it exists and is a string
                if (guild.settings && typeof guild.settings === 'string') {
                    try {
                        guild.settings = JSON.parse(guild.settings);
                    } catch (parseError) {
                        this.log(`Failed to parse settings for guild ${guildId}: ${parseError.message}`, 'warn');
                        guild.settings = {};
                    }
                }

                // Ensure settings object exists
                if (!guild.settings) {
                    guild.settings = {};
                }

                // Cache the result
                this._cacheGuild(guildId, guild);

                return guild;
            }

            return null;
        } catch (error) {
            this.log(`Error getting guild config for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update guild configuration
     * @param {string} guildId - Discord guild ID
     * @param {Object} settings - Settings object to save
     * @returns {Promise<void>}
     */
    async updateGuildConfig(guildId, settings) {
        try {
            const settingsJson = JSON.stringify(settings);
            const now = Math.floor(Date.now() / 1000);

            await this.upsert(
                {
                    id: guildId,
                    settings: settingsJson,
                    updated_at: now
                },
                ['id']
            );

            // Invalidate cache
            this._invalidateCache(guildId);

            this.log(`Updated config for guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error updating guild config for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get DJ role ID for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<string|null>} DJ role ID or null if not set
     */
    async getDJRole(guildId) {
        try {
            const guildConfig = await this.getGuildConfig(guildId);

            if (!guildConfig || !guildConfig.settings) {
                return null;
            }

            return guildConfig.settings.dj_role_id || null;
        } catch (error) {
            this.log(`Error getting DJ role for guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Set DJ role for a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} roleId - Discord role ID
     * @returns {Promise<void>}
     */
    async setDJRole(guildId, roleId) {
        try {
            const currentConfig = await this.getGuildConfig(guildId);
            const settings = currentConfig?.settings || {};

            settings.dj_role_id = roleId;

            await this.updateGuildConfig(guildId, settings);
            this.log(`Set DJ role for guild ${guildId} to ${roleId}`, 'info');
        } catch (error) {
            this.log(`Error setting DJ role for guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Remove DJ role for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<void>}
     */
    async removeDJRole(guildId) {
        try {
            const currentConfig = await this.getGuildConfig(guildId);

            if (!currentConfig || !currentConfig.settings) {
                return;
            }

            const settings = currentConfig.settings;
            delete settings.dj_role_id;

            await this.updateGuildConfig(guildId, settings);
            this.log(`Removed DJ role for guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error removing DJ role for guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get a specific config value for a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} key - Config key
     * @param {*} defaultValue - Default value if key not found
     * @returns {Promise<*>} Config value or default
     */
    async getConfigValue(guildId, key, defaultValue = null) {
        try {
            const guildConfig = await this.getGuildConfig(guildId);

            if (!guildConfig || !guildConfig.settings) {
                return defaultValue;
            }

            return guildConfig.settings[key] !== undefined ? guildConfig.settings[key] : defaultValue;
        } catch (error) {
            this.log(`Error getting config value ${key} for guild ${guildId}: ${error.message}`, 'error');
            return defaultValue;
        }
    }

    /**
     * Set a specific config value for a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} key - Config key
     * @param {*} value - Config value
     * @returns {Promise<void>}
     */
    async setConfigValue(guildId, key, value) {
        try {
            const currentConfig = await this.getGuildConfig(guildId);
            const settings = currentConfig?.settings || {};

            settings[key] = value;

            await this.updateGuildConfig(guildId, settings);
            this.log(`Set config ${key} for guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error setting config value ${key} for guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Initialize guild with default configuration
     * @param {string} guildId - Discord guild ID
     * @param {string} guildName - Discord guild name
     * @param {string} ownerId - Guild owner ID
     * @param {string} iconUrl - Guild icon URL
     * @param {number} memberCount - Guild member count
     * @returns {Promise<void>}
     */
    async initializeGuild(guildId, guildName, ownerId = null, iconUrl = null, memberCount = 0) {
        try {
            const existing = await this.getGuildConfig(guildId);

            if (existing) {
                this.log(`Guild ${guildId} already initialized`, 'info');
                return;
            }

            const defaultSettings = {
                prefix: '!',
                language: 'en',
                dj_role_id: null,
                welcome_channel_id: null,
                welcome_message: 'Welcome {user}!',
                goodbye_channel_id: null,
                goodbye_message: 'Goodbye {user}!',
                log_channel_id: null,
                mod_role_id: null,
                features: {
                    music: true,
                    economy: true,
                    leveling: true,
                    moderation: true
                }
            };

            const now = Math.floor(Date.now() / 1000);

            await this.insert({
                id: guildId,
                name: guildName,
                owner_id: ownerId,
                icon_url: iconUrl,
                member_count: memberCount,
                settings: JSON.stringify(defaultSettings),
                created_at: now,
                joined_at: now,
                updated_at: now
            });

            this.log(`Initialized guild ${guildId} with default config`, 'info');
        } catch (error) {
            this.log(`Error initializing guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Delete guild configuration
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<void>}
     */
    async deleteGuild(guildId) {
        try {
            await this.delete(guildId);

            // Invalidate cache
            this._invalidateCache(guildId);

            this.log(`Deleted guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error deleting guild ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update a specific guild setting
     * @param {string} guildId - Discord guild ID
     * @param {string} setting - Setting key
     * @param {string} value - Setting value
     * @returns {Promise<void>}
     */
    async updateGuildSetting(guildId, setting, value) {
        try {
            await this.setConfigValue(guildId, setting, value);
            this.log(`Updated guild setting ${setting} for ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error updating guild setting ${setting} for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Reset guild configuration to defaults
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<void>}
     */
    async resetGuildConfig(guildId) {
        try {
            const defaultSettings = {
                prefix: '!',
                language: 'en',
                dj_role_id: null,
                welcome_channel_id: null,
                welcome_message: 'Welcome {user}!',
                goodbye_channel_id: null,
                goodbye_message: 'Goodbye {user}!',
                log_channel_id: null,
                mod_role_id: null,
                features: {
                    music: true,
                    economy: true,
                    leveling: true,
                    moderation: true
                }
            };

            await this.updateGuildConfig(guildId, defaultSettings);
            this.log(`Reset guild config for ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error resetting guild config for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update guild metadata (name, icon, member count)
     * @param {string} guildId - Discord guild ID
     * @param {Object} metadata - Metadata to update
     * @returns {Promise<void>}
     */
    async updateGuildMetadata(guildId, metadata) {
        try {
            const updateData = {
                updated_at: Math.floor(Date.now() / 1000)
            };

            if (metadata.name !== undefined) updateData.name = metadata.name;
            if (metadata.icon_url !== undefined) updateData.icon_url = metadata.icon_url;
            if (metadata.member_count !== undefined) updateData.member_count = metadata.member_count;
            if (metadata.owner_id !== undefined) updateData.owner_id = metadata.owner_id;

            await this.update(guildId, updateData);

            // Invalidate cache
            this._invalidateCache(guildId);

            this.log(`Updated metadata for guild ${guildId}`, 'info');
        } catch (error) {
            this.log(`Error updating guild metadata for ${guildId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Cache a guild configuration
     * @private
     * @param {string} guildId - Guild ID
     * @param {Object} guild - Guild data
     */
    _cacheGuild(guildId, guild) {
        this.guildCache.set(guildId, {
            data: guild,
            timestamp: Date.now()
        });
    }

    /**
     * Get cached guild configuration
     * @private
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Cached guild data or null
     */
    _getCachedGuild(guildId) {
        const cached = this.guildCache.get(guildId);

        if (!cached) {
            return null;
        }

        // Check if cache is expired
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.guildCache.delete(guildId);
            return null;
        }

        return cached.data;
    }

    /**
     * Invalidate cache for a guild
     * @private
     * @param {string} guildId - Guild ID
     */
    _invalidateCache(guildId) {
        this.guildCache.delete(guildId);
    }

    /**
     * Clear all cached guilds
     */
    clearCache() {
        this.guildCache.clear();
        this.log('Cleared guild cache', 'info');
    }
}

module.exports = GuildModel;
