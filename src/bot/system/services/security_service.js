/**
 * Security Service
 *
 * Provides permission hardening, whitelists/blacklists, feature toggles, and rate limit helpers.
 */

const logger = require('../helpers/logger_helper');
const { PermissionError, ValidationError } = require('../core/Errors');

class SecurityService {
    constructor(client) {
        this.client = client;
        this.database = client.database;
        this.guild_whitelist_cache = new Map();
        this.guild_blacklist_cache = new Map();
        this.feature_toggle_cache = new Map();
    }

    /**
     * Check if guild is allowed
     */
    async is_guild_allowed(guild_id) {
        if (!guild_id) return true;
        const blocked = await this.is_guild_blacklisted(guild_id);
        const allowed_list = await this.get_guild_whitelist();
        if (blocked) return false;
        if (allowed_list.length === 0) return true;
        return allowed_list.includes(guild_id);
    }

    async get_guild_whitelist() {
        if (this.guild_whitelist_cache.size > 0) return Array.from(this.guild_whitelist_cache.keys());
        const rows = await this.database.query('SELECT guild_id FROM guild_whitelist', []);
        rows.forEach(r => this.guild_whitelist_cache.set(r.guild_id, true));
        return rows.map(r => r.guild_id);
    }

    async is_guild_blacklisted(guild_id) {
        if (this.guild_blacklist_cache.has(guild_id)) return true;
        const row = await this.database.queryOne('SELECT guild_id FROM guild_blacklist WHERE guild_id = ?', [guild_id]);
        if (row) this.guild_blacklist_cache.set(guild_id, true);
        return !!row;
    }

    /**
     * Check feature toggle for guild
     */
    async is_feature_enabled(guild_id, feature_key) {
        const cache_key = `${guild_id || 'global'}:${feature_key}`;
        if (this.feature_toggle_cache.has(cache_key)) return this.feature_toggle_cache.get(cache_key);
        const row = await this.database.queryOne(
            'SELECT enabled FROM feature_toggles WHERE (guild_id = ? OR guild_id IS NULL) AND feature_key = ? ORDER BY guild_id DESC LIMIT 1',
            [guild_id, feature_key]
        );
        const enabled = row ? !!row.enabled : true;
        this.feature_toggle_cache.set(cache_key, enabled);
        return enabled;
    }

    /**
     * Validate owner-only command
     */
    validate_owner(user_id) {
        const owner_id = process.env.BOT_OWNER_ID;
        if (owner_id && user_id !== owner_id) {
            throw new PermissionError('Owner-only command');
        }
    }

    /**
     * Validate guild whitelist for command
     */
    async validate_guild_access(guild_id) {
        const allowed = await this.is_guild_allowed(guild_id);
        if (!allowed) {
            throw new PermissionError('This server is not allowed to use the bot');
        }
    }

    /**
     * Validate custom rule (simple expression)
     */
    validate_rule(condition, message = 'Action not allowed') {
        if (!condition) {
            throw new ValidationError(message);
        }
    }
}

module.exports = SecurityService;
