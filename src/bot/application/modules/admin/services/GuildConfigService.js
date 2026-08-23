'use strict';

/**
 * GuildConfigService
 * 
 * Service for managing guild-specific configuration with caching layer.
 * Handles validation, default values, and cache management.
 * Synchronized with consolidated schema: guilds (guild_id, name, config_json, prefix, created_at, updated_at).
 */

const BaseService = require('../../../../system/core/BaseService');

class GuildConfigService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);

        this.cache = new Map();
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000;

        this.cacheStats = {
            hits: 0,
            misses: 0,
        };

        this.settingRegistry = this.initializeSettingRegistry();
    }

    initializeSettingRegistry() {
        const registry = new Map();

        registry.set('prefix', {
            type: 'string',
            default: '!',
            description: 'Command prefix for the bot',
            category: 'general',
            validate: (value) => typeof value === 'string' && value.length > 0 && value.length <= 5,
        });

        registry.set('dj_role', {
            type: 'role',
            default: null,
            description: 'Role required for DJ commands',
            category: 'music',
            validate: (value, guild) => this.validateRole(value, guild),
        });

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

        registry.set('welcome_enabled', {
            type: 'boolean',
            default: false,
            description: 'Enable welcome messages for new members',
            category: 'welcome',
            validate: (value) => value === true || value === false || value === 'true' || value === 'false',
        });

        registry.set('welcome_channel', {
            type: 'channel',
            default: null,
            description: 'Channel for welcome messages',
            category: 'welcome',
            validate: (value, guild) => this.validateChannel(value, guild),
        });

        registry.set('welcome_message', {
            type: 'string',
            default: 'Welcome {user} to {server}!',
            description: 'Welcome message template',
            category: 'welcome',
            validate: (value) => typeof value === 'string' && value.length > 0 && value.length <= 500,
        });

        registry.set('auto_role', {
            type: 'role',
            default: null,
            description: 'Role to automatically assign to new members',
            category: 'welcome',
            validate: (value, guild) => this.validateRole(value, guild),
        });

        registry.set('goodbye_enabled', {
            type: 'boolean',
            default: false,
            description: 'Enable goodbye messages when members leave',
            category: 'welcome',
            validate: (value) => value === true || value === false || value === 'true' || value === 'false',
        });

        registry.set('goodbye_channel', {
            type: 'channel',
            default: null,
            description: 'Channel for goodbye messages',
            category: 'welcome',
            validate: (value, guild) => this.validateChannel(value, guild),
        });

        registry.set('goodbye_message', {
            type: 'string',
            default: 'Goodbye {user}!',
            description: 'Goodbye message template',
            category: 'welcome',
            validate: (value) => typeof value === 'string' && value.length > 0 && value.length <= 500,
        });

        registry.set('moderation_log_channel', {
            type: 'channel',
            default: null,
            description: 'Channel for moderation logs',
            category: 'moderation',
            validate: (value, guild) => this.validateChannel(value, guild),
        });

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

    async initialize() {
        await super.initialize();
        this.log('GuildConfigService initialized with caching enabled', 'info');
    }

    async shutdown() {
        this.cache.clear();
        await super.shutdown();
    }

    cleanupExpiredCache() {
        const now = Date.now();
        for (const [guildId, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.cacheTTL) {
                this.cache.delete(guildId);
            }
        }
    }

    getCacheStats() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        const hitRate = total > 0 ? ((this.cacheStats.hits / total) * 100).toFixed(2) : 0;
        return {
            hits: this.cacheStats.hits,
            misses: this.cacheStats.misses,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
        };
    }

    /**
     * Get guild config
     */
    async getGuildConfig(guildId) {
        try {
            this.validateRequired({ guildId }, ['guildId']);

            const cached = this.getCachedConfig(guildId);
            if (cached) {
                this.cacheStats.hits++;
                return cached;
            }

            this.cacheStats.misses++;

            const db = this.getDatabase();
            if (!db) throw new Error('Database connection not available');

            const result = await db.query('SELECT * FROM guilds WHERE guild_id = ?', [guildId]);
            let config = {};

            if (result && result.length > 0) {
                const row = result[0];
                const rawJson = row.config_json || row.config;
                if (typeof rawJson === 'string') {
                    try {
                        config = JSON.parse(rawJson);
                    } catch {
                        config = {};
                    }
                } else if (typeof rawJson === 'object' && rawJson !== null) {
                    config = rawJson;
                }

                if (row.prefix) {
                    config.prefix = row.prefix;
                }
            }

            const fullConfig = this.mergeWithDefaults(config);
            this.setCachedConfig(guildId, fullConfig);
            return fullConfig;
        } catch (error) {
            this.handleError(error, 'getGuildConfig', { guildId });
            throw error;
        }
    }

    async getSetting(guildId, key) {
        try {
            this.validateRequired({ guildId, key }, ['guildId', 'key']);
            if (!this.settingRegistry.has(key)) {
                throw new Error(`Unknown setting: ${key}`);
            }

            const config = await this.getGuildConfig(guildId);
            return config[key];
        } catch (error) {
            this.handleError(error, 'getSetting', { guildId, key });
            throw error;
        }
    }

    async setSetting(guildId, key, value) {
        try {
            this.validateRequired({ guildId, key }, ['guildId', 'key']);
            const guild = this.getGuild(guildId);

            await this.validateSetting(key, value, guild);
            const parsedValue = this.parseSettingValue(key, value);
            const currentConfig = await this.getGuildConfig(guildId);
            currentConfig[key] = parsedValue;

            const db = this.getDatabase();
            if (!db) throw new Error('Database connection not available');

            const configJson = JSON.stringify(currentConfig);
            const guildName = guild?.name || 'Guild';
            const prefix = currentConfig.prefix || '!';
            const now = Math.floor(Date.now() / 1000);

            await db.query(
                `INSERT INTO guilds (guild_id, name, config_json, prefix, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET
                    name = excluded.name,
                    config_json = excluded.config_json,
                    prefix = excluded.prefix,
                    updated_at = excluded.updated_at`,
                [guildId, guildName, configJson, prefix, now, now]
            );

            this.invalidateCache(guildId);
            this.log(`Set ${key} = ${parsedValue} for guild ${guildId}`, 'info');

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

    async resetSetting(guildId, key) {
        try {
            this.validateRequired({ guildId, key }, ['guildId', 'key']);
            if (!this.settingRegistry.has(key)) {
                throw new Error(`Unknown setting: ${key}`);
            }

            const metadata = this.settingRegistry.get(key);
            const defaultValue = metadata.default;
            const currentConfig = await this.getGuildConfig(guildId);
            delete currentConfig[key];

            const db = this.getDatabase();
            if (!db) throw new Error('Database connection not available');

            const guild = this.getGuild(guildId);
            const guildName = guild?.name || 'Guild';
            const prefix = currentConfig.prefix || '!';
            const configJson = JSON.stringify(currentConfig);
            const now = Math.floor(Date.now() / 1000);

            await db.query(
                `INSERT INTO guilds (guild_id, name, config_json, prefix, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET
                    name = excluded.name,
                    config_json = excluded.config_json,
                    prefix = excluded.prefix,
                    updated_at = excluded.updated_at`,
                [guildId, guildName, configJson, prefix, now, now]
            );

            this.invalidateCache(guildId);
            this.log(`Reset ${key} to default (${defaultValue}) for guild ${guildId}`, 'info');

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

        return settings.reduce((acc, setting) => {
            if (!acc[setting.category]) acc[setting.category] = [];
            acc[setting.category].push(setting);
            return acc;
        }, {});
    }

    mergeWithDefaults(config) {
        const merged = {};
        for (const [key, metadata] of this.settingRegistry.entries()) {
            merged[key] = config[key] !== undefined ? config[key] : metadata.default;
        }
        return merged;
    }

    parseSettingValue(key, value) {
        const metadata = this.settingRegistry.get(key);
        if (!metadata) return value;

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
                if (value === 'null' || value === null) return null;
                if (typeof value === 'string') {
                    const roleMention = value.match(/^<@&(\d+)>$/);
                    if (roleMention) return roleMention[1];
                    const channelMention = value.match(/^<#(\d+)>$/);
                    if (channelMention) return channelMention[1];
                }
                return String(value);
            default:
                return value;
        }
    }

    getCachedConfig(guildId) {
        const entry = this.cache.get(guildId);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.cacheTTL) {
            this.cache.delete(guildId);
            return null;
        }
        return entry.config;
    }

    setCachedConfig(guildId, config) {
        this.cache.set(guildId, {
            config,
            timestamp: Date.now(),
        });
    }

    invalidateCache(guildId) {
        this.cache.delete(guildId);
    }

    async validateSetting(key, value, guild) {
        if (!this.settingRegistry.has(key)) {
            throw new Error(`Unknown setting: ${key}`);
        }
        const metadata = this.settingRegistry.get(key);
        if (metadata.validate) {
            const isValid = await metadata.validate(value, guild);
            if (!isValid) throw new Error(`Invalid value for ${key}: ${value}`);
        }
        return true;
    }

    validateChannel(channelId, guild) {
        if (channelId === null || channelId === 'null') return true;
        if (!guild) return false;

        let actualChannelId = channelId;
        if (typeof channelId === 'string') {
            const match = channelId.match(/^<#(\d+)>$/);
            if (match) actualChannelId = match[1];
        }

        const channel = guild.channels.cache.get(actualChannelId);
        return !!channel;
    }

    validateRole(roleId, guild) {
        if (roleId === null || roleId === 'null') return true;
        if (!guild) return false;

        let actualRoleId = roleId;
        if (typeof roleId === 'string') {
            const match = roleId.match(/^<@&(\d+)>$/);
            if (match) actualRoleId = match[1];
        }

        const role = guild.roles.cache.get(actualRoleId);
        return !!role;
    }
}

module.exports = GuildConfigService;
