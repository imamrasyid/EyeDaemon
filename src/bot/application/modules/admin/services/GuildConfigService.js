/**
 * GuildConfigService
 * 
 * Service for managing guild-specific configuration with caching layer.
 * Handles validation, default values, and cache management for performance.
 */

const BaseService = require('../../../../system/core/BaseService');

class GuildConfigService extends BaseService {
    /**
     * Create a new GuildConfigService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);

        // Cache for guild configurations with TTL
        this.cache = new Map();
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes default

        // Cache statistics
        this.cacheStats = {
            hits: 0,
            misses: 0,
        };

        // Setting metadata registry
        this.settingRegistry = this.initializeSettingRegistry();

        // Note: Cache cleanup is handled by CleanupManager
    }

    /**
     * Initialize setting metadata registry
     * Defines all available settings with their types, defaults, and validation rules
     * @returns {Map} Setting registry
     */
    initializeSettingRegistry() {
        const registry = new Map();

        // Prefix setting
        registry.set('prefix', {
            type: 'string',
            default: '!',
            description: 'Command prefix for the bot',
            category: 'general',
            validate: (value) => {
                if (typeof value !== 'string') return false;
                if (value.length === 0 || value.length > 5) return false;
                return true;
            },
        });

        // DJ Role setting
        registry.set('dj_role', {
            type: 'role',
            default: null,
            description: 'Role required for DJ commands',
            category: 'music',
            validate: (value, guild) => this.validateRole(value, guild),
        });

        // Default Volume setting
        registry.set('volume_default', {
            type: 'number',
            default: 80,
            description: 'Default volume for music playback (0-200)',
            category: 'music',
            validate: (value) => {
                const num = Number(value);
                return !isNaN(num) && num >= 0 && num <= 200;
            },
        });

        // Max Queue Size setting
        registry.set('max_queue_size', {
            type: 'number',
            default: 100,
            description: 'Maximum number of tracks in queue',
            category: 'music',
            validate: (value) => {
                const num = Number(value);
                return !isNaN(num) && num >= 1 && num <= 500;
            },
        });

        // Welcome Enabled setting
        registry.set('welcome_enabled', {
            type: 'boolean',
            default: false,
            description: 'Enable welcome messages for new members',
            category: 'welcome',
            validate: (value) => {
                return value === true || value === false || value === 'true' || value === 'false';
            },
        });

        // Welcome Channel setting
        registry.set('welcome_channel', {
            type: 'channel',
            default: null,
            description: 'Channel for welcome messages',
            category: 'welcome',
            validate: (value, guild) => this.validateChannel(value, guild),
        });

        // Welcome Message setting
        registry.set('welcome_message', {
            type: 'string',
            default: 'Welcome {user} to {server}! You are member #{memberCount}.',
            description: 'Welcome message template (use {user}, {server}, {memberCount})',
            category: 'welcome',
            validate: (value) => {
                return typeof value === 'string' && value.length > 0 && value.length <= 500;
            },
        });

        // Auto Role setting
        registry.set('auto_role', {
            type: 'role',
            default: null,
            description: 'Role to automatically assign to new members',
            category: 'welcome',
            validate: (value, guild) => this.validateRole(value, guild),
        });

        // Goodbye Enabled setting
        registry.set('goodbye_enabled', {
            type: 'boolean',
            default: false,
            description: 'Enable goodbye messages when members leave',
            category: 'welcome',
            validate: (value) => {
                return value === true || value === false || value === 'true' || value === 'false';
            },
        });

        // Goodbye Channel setting
        registry.set('goodbye_channel', {
            type: 'channel',
            default: null,
            description: 'Channel for goodbye messages',
            category: 'welcome',
            validate: (value, guild) => this.validateChannel(value, guild),
        });

        // Goodbye Message setting
        registry.set('goodbye_message', {
            type: 'string',
            default: 'Goodbye {user}! Thanks for being part of {server}.',
            description: 'Goodbye message template (use {user}, {server}, {memberCount})',
            category: 'welcome',
            validate: (value) => {
                return typeof value === 'string' && value.length > 0 && value.length <= 500;
            },
        });

        // Moderation Log Channel setting
        registry.set('moderation_log_channel', {
            type: 'channel',
            default: null,
            description: 'Channel for moderation logs',
            category: 'moderation',
            validate: (value, guild) => this.validateChannel(value, guild),
        });

        // Leveling XP Multiplier setting
        registry.set('leveling_xp_multiplier', {
            type: 'number',
            default: 1.0,
            description: 'XP multiplier for leveling (0.1-10.0)',
            category: 'leveling',
            validate: (value) => {
                const num = Number(value);
                return !isNaN(num) && num >= 0.1 && num <= 10.0;
            },
        });

        // Economy Starting Balance setting
        registry.set('economy_starting_balance', {
            type: 'number',
            default: 1000,
            description: 'Starting balance for new members',
            category: 'economy',
            validate: (value) => {
                const num = Number(value);
                return !isNaN(num) && num >= 0 && num <= 1000000;
            },
        });

        return registry;
    }

    /**
     * Initialize service
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();
        this.log('GuildConfigService initialized with caching enabled', 'info');
    }

    /**
     * Shutdown service and cleanup
     * @returns {Promise<void>}
     */
    async shutdown() {
        // Clear cache
        this.cache.clear();

        await super.shutdown();
    }

    /**
     * Cleanup expired cache entries
     */
    cleanupExpiredCache() {
        const now = Date.now();
        let removed = 0;

        for (const [guildId, cacheEntry] of this.cache.entries()) {
            if (now - cacheEntry.timestamp > this.cacheTTL) {
                this.cache.delete(guildId);
                removed++;
            }
        }

        if (removed > 0) {
            this.log(`Cleaned up ${removed} expired cache entries`, 'debug');
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
            ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(2)
            : 0;

        return {
            hits: this.cacheStats.hits,
            misses: this.cacheStats.misses,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
        };
    }

    /**
     * Get all guild configuration settings
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Guild configuration object
     */
    async getGuildConfig(guildId) {
        try {
            this.validateRequired({ guildId }, ['guildId']);

            // Check cache first
            const cached = this.getCachedConfig(guildId);
            if (cached) {
                this.cacheStats.hits++;
                this.log(`Cache hit for guild ${guildId}`, 'debug');
                return cached;
            }

            this.cacheStats.misses++;
            this.log(`Cache miss for guild ${guildId}`, 'debug');

            // Load from database
            const db = this.getDatabase();
            if (!db) {
                throw new Error('Database connection not available');
            }

            const result = await db.query(
                'SELECT * FROM guilds WHERE guild_id = ?',
                [guildId]
            );

            let config = {};

            if (result && result.length > 0) {
                const guildData = result[0];

                // Parse config JSON if it exists
                if (guildData.config && typeof guildData.config === 'string') {
                    try {
                        config = JSON.parse(guildData.config);
                    } catch (parseError) {
                        this.log(`Failed to parse config for guild ${guildId}`, 'warn', {
                            error: parseError.message,
                        });
                        config = {};
                    }
                } else if (guildData.config && typeof guildData.config === 'object') {
                    config = guildData.config;
                }
            }

            // Merge with defaults for any missing settings
            const fullConfig = this.mergeWithDefaults(config);

            // Cache the result
            this.setCachedConfig(guildId, fullConfig);

            return fullConfig;
        } catch (error) {
            this.handleError(error, 'getGuildConfig', { guildId });
            throw error;
        }
    }

    /**
     * Get a specific setting value for a guild
     * @param {string} guildId - Guild ID
     * @param {string} key - Setting key
     * @returns {Promise<*>} Setting value or default
     */
    async getSetting(guildId, key) {
        try {
            this.validateRequired({ guildId, key }, ['guildId', 'key']);

            // Check if setting exists in registry
            if (!this.settingRegistry.has(key)) {
                throw new Error(`Unknown setting: ${key}`);
            }

            // Get full config (uses cache)
            const config = await this.getGuildConfig(guildId);

            // Return setting value or default
            return config[key];
        } catch (error) {
            this.handleError(error, 'getSetting', { guildId, key });
            throw error;
        }
    }

    /**
     * Set a specific setting value for a guild
     * @param {string} guildId - Guild ID
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     * @returns {Promise<void>}
     */
    async setSetting(guildId, key, value) {
        try {
            this.validateRequired({ guildId, key }, ['guildId', 'key']);

            // Get guild for validation
            const guild = this.getGuild(guildId);
            if (!guild) {
                throw new Error(`Guild ${guildId} not found`);
            }

            // Validate setting
            await this.validateSetting(key, value, guild);

            // Parse value based on type
            const parsedValue = this.parseSettingValue(key, value);

            // Get current config
            const currentConfig = await this.getGuildConfig(guildId);

            // Update config
            currentConfig[key] = parsedValue;

            // Save to database
            const db = this.getDatabase();
            if (!db) {
                throw new Error('Database connection not available');
            }

            const configJson = JSON.stringify(currentConfig);
            const guildName = guild.name || 'Unknown Guild';

            const now = Math.floor(Date.now() / 1000);

            await db.query(
                `INSERT INTO guilds (guild_id, guild_name, config, id, updated_at) 
                 VALUES (?, ?, ?, ?, ?) 
                 ON CONFLICT(guild_id) DO UPDATE SET 
                    config = excluded.config,
                    guild_name = excluded.guild_name,
                    id = excluded.id,
                    updated_at = excluded.updated_at`,
                [guildId, guildName, configJson, guildId, now]
            );

            // Invalidate cache
            this.invalidateCache(guildId);

            this.log(`Set ${key} = ${parsedValue} for guild ${guildId}`, 'info');

            // Emit config updated event
            if (this.client.eventManager) {
                this.client.eventManager.emit('configUpdated', {
                    guildId,
                    key,
                    value: parsedValue,
                });
            }
        } catch (error) {
            this.handleError(error, 'setSetting', { guildId, key, value });
            throw error;
        }
    }

    /**
     * Reset a setting to its default value
     * @param {string} guildId - Guild ID
     * @param {string} key - Setting key
     * @returns {Promise<void>}
     */
    async resetSetting(guildId, key) {
        try {
            this.validateRequired({ guildId, key }, ['guildId', 'key']);

            // Check if setting exists in registry
            if (!this.settingRegistry.has(key)) {
                throw new Error(`Unknown setting: ${key}`);
            }

            // Get default value
            const metadata = this.settingRegistry.get(key);
            const defaultValue = metadata.default;

            // Get current config
            const currentConfig = await this.getGuildConfig(guildId);

            // Remove custom value (will fall back to default)
            delete currentConfig[key];

            // Save to database
            const db = this.getDatabase();
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Get guild for guild_name
            const guild = this.getGuild(guildId);
            const guildName = guild?.name || 'Unknown Guild';

            const configJson = JSON.stringify(currentConfig);

            const now = Math.floor(Date.now() / 1000);

            await db.query(
                `INSERT INTO guilds (guild_id, guild_name, config, id, updated_at) 
                 VALUES (?, ?, ?, ?, ?) 
                 ON CONFLICT(guild_id) DO UPDATE SET 
                    config = excluded.config,
                    guild_name = excluded.guild_name,
                    id = excluded.id,
                    updated_at = excluded.updated_at`,
                [guildId, guildName, configJson, guildId, now]
            );

            // Invalidate cache
            this.invalidateCache(guildId);

            this.log(`Reset ${key} to default (${defaultValue}) for guild ${guildId}`, 'info');

            // Emit config updated event
            if (this.client.eventManager) {
                this.client.eventManager.emit('configUpdated', {
                    guildId,
                    key,
                    value: defaultValue,
                    reset: true,
                });
            }
        } catch (error) {
            this.handleError(error, 'resetSetting', { guildId, key });
            throw error;
        }
    }

    /**
     * List all available settings with their metadata
     * @returns {Object} Object with settings grouped by category
     */
    listAvailableSettings() {
        const settings = [];

        for (const [key, metadata] of this.settingRegistry.entries()) {
            settings.push({
                key,
                type: metadata.type,
                default: metadata.default,
                description: metadata.description,
                category: metadata.category,
            });
        }

        // Group by category
        const grouped = settings.reduce((acc, setting) => {
            if (!acc[setting.category]) {
                acc[setting.category] = [];
            }
            acc[setting.category].push(setting);
            return acc;
        }, {});

        return grouped;
    }

    /**
     * Merge config with default values
     * @param {Object} config - Current config
     * @returns {Object} Config with defaults
     */
    mergeWithDefaults(config) {
        const merged = {};

        for (const [key, metadata] of this.settingRegistry.entries()) {
            merged[key] = config[key] !== undefined ? config[key] : metadata.default;
        }

        return merged;
    }

    /**
     * Parse setting value based on type
     * @param {string} key - Setting key
     * @param {*} value - Raw value
     * @returns {*} Parsed value
     */
    parseSettingValue(key, value) {
        const metadata = this.settingRegistry.get(key);

        if (!metadata) {
            return value;
        }

        switch (metadata.type) {
            case 'number':
                return Number(value);
            case 'boolean':
                if (typeof value === 'boolean') return value;
                return value === 'true' || value === true;
            case 'string':
                return String(value);
            case 'role':
            case 'channel':
                if (value === 'null' || value === null) {
                    return null;
                }

                // Extract ID from mention format if needed
                if (typeof value === 'string') {
                    // Role mention: <@&ID>
                    const roleMention = value.match(/^<@&(\d+)>$/);
                    if (roleMention) {
                        return roleMention[1];
                    }

                    // Channel mention: <#ID>
                    const channelMention = value.match(/^<#(\d+)>$/);
                    if (channelMention) {
                        return channelMention[1];
                    }
                }

                return String(value);
            default:
                return value;
        }
    }

    /**
     * Get cached config for a guild
     * @param {string} guildId - Guild ID
     * @returns {Object|null} Cached config or null
     */
    getCachedConfig(guildId) {
        const cacheEntry = this.cache.get(guildId);

        if (!cacheEntry) {
            return null;
        }

        // Check if cache is expired
        const now = Date.now();
        if (now - cacheEntry.timestamp > this.cacheTTL) {
            this.cache.delete(guildId);
            return null;
        }

        return cacheEntry.config;
    }

    /**
     * Set cached config for a guild
     * @param {string} guildId - Guild ID
     * @param {Object} config - Config to cache
     */
    setCachedConfig(guildId, config) {
        this.cache.set(guildId, {
            config,
            timestamp: Date.now(),
        });
    }

    /**
     * Invalidate cache for a guild
     * @param {string} guildId - Guild ID
     */
    invalidateCache(guildId) {
        this.cache.delete(guildId);
        this.log(`Invalidated cache for guild ${guildId}`, 'debug');
    }

    /**
     * Validate a setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     * @param {Object} guild - Discord guild object
     * @returns {Promise<boolean>} True if valid
     * @throws {Error} If validation fails
     */
    async validateSetting(key, value, guild) {
        // Check if setting exists
        if (!this.settingRegistry.has(key)) {
            throw new Error(`Unknown setting: ${key}`);
        }

        const metadata = this.settingRegistry.get(key);

        // Run custom validation if provided
        if (metadata.validate) {
            const isValid = await metadata.validate(value, guild);

            if (!isValid) {
                throw new Error(`Invalid value for ${key}: ${value}`);
            }
        }

        return true;
    }

    /**
     * Validate prefix setting
     * @param {string} prefix - Prefix value
     * @returns {boolean} True if valid
     */
    validatePrefix(prefix) {
        if (typeof prefix !== 'string') {
            return false;
        }

        // Prefix must be 1-5 characters
        if (prefix.length === 0 || prefix.length > 5) {
            return false;
        }

        // Prefix cannot contain only whitespace
        if (prefix.trim().length === 0) {
            return false;
        }

        return true;
    }

    /**
     * Validate channel setting
     * @param {string} channelId - Channel ID or channel mention
     * @param {Object} guild - Discord guild object
     * @returns {boolean} True if valid
     */
    validateChannel(channelId, guild) {
        // Null is valid (means disabled)
        if (channelId === null || channelId === 'null') {
            return true;
        }

        if (!guild) {
            return false;
        }

        // Extract channel ID from mention format <#ID> if needed
        let actualChannelId = channelId;
        if (typeof channelId === 'string') {
            const mentionMatch = channelId.match(/^<#(\d+)>$/);
            if (mentionMatch) {
                actualChannelId = mentionMatch[1];
            }
        }

        // Check if channel exists in guild
        const channel = guild.channels.cache.get(actualChannelId);

        if (!channel) {
            return false;
        }

        // Check if channel is a text channel
        if (channel.type !== 0) { // 0 = GUILD_TEXT
            return false;
        }

        // Check if bot has permissions to send messages
        const botMember = guild.members.cache.get(this.client.user.id);
        if (!botMember) {
            return false;
        }

        const permissions = channel.permissionsFor(botMember);
        if (!permissions || !permissions.has('SendMessages')) {
            return false;
        }

        return true;
    }

    /**
     * Validate role setting
     * @param {string} roleId - Role ID or role mention
     * @param {Object} guild - Discord guild object
     * @returns {boolean} True if valid
     */
    validateRole(roleId, guild) {
        // Null is valid (means disabled)
        if (roleId === null || roleId === 'null') {
            return true;
        }

        if (!guild) {
            return false;
        }

        // Extract role ID from mention format <@&ID> if needed
        let actualRoleId = roleId;
        if (typeof roleId === 'string') {
            const mentionMatch = roleId.match(/^<@&(\d+)>$/);
            if (mentionMatch) {
                actualRoleId = mentionMatch[1];
            }
        }

        // Check if role exists in guild
        const role = guild.roles.cache.get(actualRoleId);

        if (!role) {
            return false;
        }

        // Check if bot can assign this role (role hierarchy)
        const botMember = guild.members.cache.get(this.client.user.id);
        if (!botMember) {
            return false;
        }

        const botHighestRole = botMember.roles.highest;

        // Bot's role must be higher than the role to assign
        if (botHighestRole.position <= role.position) {
            return false;
        }

        // Cannot assign @everyone role
        if (role.id === guild.id) {
            return false;
        }

        // Cannot assign managed roles (bot roles, integration roles)
        if (role.managed) {
            return false;
        }

        return true;
    }
}

module.exports = GuildConfigService;
