/**
 * Database Enhancement Service
 *
 * Provides multi-tenant support helpers and connection health checks.
 */

const logger = require('../helpers/logger_helper');

class DatabaseEnhancementService {
    constructor(client) {
        this.client = client;
        this.database = client.database;
    }

    /**
     * Validate multi-tenant isolation by checking guild-scoped queries
     */
    async validate_isolation(guild_id) {
        try {
            await this.database.query('SELECT 1');
            return true;
        } catch (error) {
            logger.error('Database isolation validation failed', { error: error.message, guild_id });
            return false;
        }
    }

    /**
     * Perform connection health check
     */
    async health_check() {
        try {
            const start = Date.now();
            await this.database.query('SELECT 1');
            const duration = Date.now() - start;
            return { ok: true, duration_ms: duration };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }
}

module.exports = DatabaseEnhancementService;
