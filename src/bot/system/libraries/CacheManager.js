/**
 * Cache Manager
 * 
 * Manages database-backed caching with TTL support.
 * Provides cache operations and automatic cleanup of expired entries.
 */

const { DatabaseError } = require('../core/Errors');

class CacheManager {
    /**
     * Create a new CacheManager instance
     * @param {Object} client - Discord client instance (or database library for backward compatibility)
     * @param {Object} options - Cache configuration options
     */
    constructor(client, options = {}) {
        if (!client) {
            throw new DatabaseError('Client instance is required for CacheManager', {
                config: 'missing client'
            });
        }

        // Support both client and database as first parameter for backward compatibility
        if (client.database) {
            // New way: client passed
            this.database = client.database;
            this.logger = client.logger || console;
        } else {
            // Old way: database passed directly
            this.database = client;
            this.logger = client.logger || console;
        }

        // Cache configuration
        this.config = {
            tableName: options.tableName || 'cache_entries',
            defaultTTL: options.defaultTTL || 600000, // 10 minutes default
            cleanupInterval: options.cleanupInterval || 3600000, // 1 hour
            enableAutoCleanup: options.enableAutoCleanup !== false,
            ...options
        };

        // Cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            expirations: 0,
            errors: 0
        };

        this.cleanupTimer = null;
        this.isInitialized = false;
    }

    /**
     * Initialize cache table if not exists
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Create cache table with proper schema
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS ${this.config.tableName} (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    expires_at INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            `;

            await this.database.query(createTableSQL);

            // Create index on expires_at for efficient cleanup
            const createIndexSQL = `
                CREATE INDEX IF NOT EXISTS idx_${this.config.tableName}_expires_at 
                ON ${this.config.tableName}(expires_at)
            `;

            await this.database.query(createIndexSQL);

            this.isInitialized = true;
            this.log('Cache table initialized successfully', 'info');

            // Start automatic cleanup if enabled
            if (this.config.enableAutoCleanup) {
                this.startCleanupJob();
            }
        } catch (error) {
            this.log(`Failed to initialize cache table: ${error.message}`, 'error');
            throw new DatabaseError('Failed to initialize cache table', {
                originalError: error.message,
                tableName: this.config.tableName
            });
        }
    }

    /**
     * Start automatic cleanup job
     * @private
     */
    startCleanupJob() {
        if (this.cleanupTimer) {
            return;
        }

        this.log(`Starting cache cleanup job (interval: ${this.config.cleanupInterval}ms)`, 'info');

        this.cleanupTimer = setInterval(async () => {
            try {
                await this.cleanup();
            } catch (error) {
                this.log(`Cleanup job error: ${error.message}`, 'error');
            }
        }, this.config.cleanupInterval);

        // Don't prevent process from exiting
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }

    /**
     * Stop automatic cleanup job
     */
    stopCleanupJob() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            this.log('Cache cleanup job stopped', 'info');
        }
    }

    /**
     * Get cached value by key
     * @param {string} key - Cache key
     * @returns {Promise<any|null>} Cached value or null if not found/expired
     */
    async get(key) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const now = Date.now();

            // Query cache entry
            const sql = `
                SELECT value, expires_at 
                FROM ${this.config.tableName} 
                WHERE key = ?
            `;

            const entry = await this.database.queryOne(sql, [key]);

            // Check if entry exists and is not expired
            if (!entry) {
                this.stats.misses++;
                return null;
            }

            // Check TTL
            if (entry.expires_at <= now) {
                // Entry expired, delete it
                await this.delete(key);
                this.stats.misses++;
                this.stats.expirations++;
                return null;
            }

            // Cache hit
            this.stats.hits++;

            // Parse and return value
            try {
                return JSON.parse(entry.value);
            } catch (parseError) {
                this.log(`Failed to parse cached value for key: ${key}`, 'warn');
                await this.delete(key);
                this.stats.misses++;
                return null;
            }
        } catch (error) {
            this.stats.errors++;
            this.log(`Error getting cache key ${key}: ${error.message}`, 'error');
            throw new DatabaseError('Failed to get cache entry', {
                originalError: error.message,
                key
            });
        }
    }

    /**
     * Set cached value with TTL
     * @param {string} key - Cache key
     * @param {any} value - Value to cache (will be JSON serialized)
     * @param {number} ttl - Time to live in milliseconds (optional, uses default if not provided)
     * @returns {Promise<void>}
     */
    async set(key, value, ttl = null) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const now = Date.now();
            const expiresAt = now + (ttl || this.config.defaultTTL);

            // Serialize value
            const serializedValue = JSON.stringify(value);

            // Upsert cache entry
            const sql = `
                INSERT INTO ${this.config.tableName} (key, value, expires_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    expires_at = excluded.expires_at,
                    updated_at = excluded.updated_at
            `;

            await this.database.query(sql, [key, serializedValue, expiresAt, now, now]);

            this.stats.sets++;
        } catch (error) {
            this.stats.errors++;
            this.log(`Error setting cache key ${key}: ${error.message}`, 'error');
            throw new DatabaseError('Failed to set cache entry', {
                originalError: error.message,
                key
            });
        }
    }

    /**
     * Delete cached value by key
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async delete(key) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const sql = `DELETE FROM ${this.config.tableName} WHERE key = ?`;
            const result = await this.database.query(sql, [key]);

            const deleted = result.changes > 0;
            if (deleted) {
                this.stats.deletes++;
            }

            return deleted;
        } catch (error) {
            this.stats.errors++;
            this.log(`Error deleting cache key ${key}: ${error.message}`, 'error');
            throw new DatabaseError('Failed to delete cache entry', {
                originalError: error.message,
                key
            });
        }
    }

    /**
     * Clear all cache entries
     * @returns {Promise<number>} Number of entries deleted
     */
    async clear() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const sql = `DELETE FROM ${this.config.tableName}`;
            const result = await this.database.query(sql);

            const deletedCount = result.changes || 0;
            this.stats.deletes += deletedCount;

            this.log(`Cleared ${deletedCount} cache entries`, 'info');

            return deletedCount;
        } catch (error) {
            this.stats.errors++;
            this.log(`Error clearing cache: ${error.message}`, 'error');
            throw new DatabaseError('Failed to clear cache', {
                originalError: error.message
            });
        }
    }

    /**
     * Check if key exists in cache and is not expired
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} True if exists and not expired
     */
    async has(key) {
        const value = await this.get(key);
        return value !== null;
    }

    /**
     * Clean up expired cache entries
     * @returns {Promise<Object>} Cleanup statistics
     */
    async cleanup() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const now = Date.now();
            const startTime = Date.now();

            // Count expired entries before deletion
            const countSQL = `
                SELECT COUNT(*) as count 
                FROM ${this.config.tableName} 
                WHERE expires_at <= ?
            `;

            const countResult = await this.database.queryOne(countSQL, [now]);
            const expiredCount = countResult?.count || 0;

            // Delete expired entries
            const deleteSQL = `
                DELETE FROM ${this.config.tableName} 
                WHERE expires_at <= ?
            `;

            const result = await this.database.query(deleteSQL, [now]);
            const deletedCount = result.changes || 0;

            // Update statistics
            this.stats.expirations += deletedCount;
            this.stats.deletes += deletedCount;

            const duration = Date.now() - startTime;

            const cleanupStats = {
                deletedCount,
                expiredCount,
                duration,
                timestamp: now
            };

            // Log cleanup results
            if (deletedCount > 0) {
                this.log(`Cleanup completed: removed ${deletedCount} expired entries in ${duration}ms`, 'info', cleanupStats);
            } else {
                this.log(`Cleanup completed: no expired entries found`, 'debug', cleanupStats);
            }

            return cleanupStats;
        } catch (error) {
            this.stats.errors++;
            this.log(`Error during cache cleanup: ${error.message}`, 'error');
            throw new DatabaseError('Failed to cleanup cache', {
                originalError: error.message
            });
        }
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>} Cache statistics including hits, misses, size, etc.
     */
    async getStats() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const now = Date.now();

            // Get total cache size
            const sizeSQL = `SELECT COUNT(*) as total FROM ${this.config.tableName}`;
            const sizeResult = await this.database.queryOne(sizeSQL);
            const totalEntries = sizeResult?.total || 0;

            // Get expired entries count
            const expiredSQL = `
                SELECT COUNT(*) as expired 
                FROM ${this.config.tableName} 
                WHERE expires_at <= ?
            `;
            const expiredResult = await this.database.queryOne(expiredSQL, [now]);
            const expiredEntries = expiredResult?.expired || 0;

            // Calculate hit rate
            const totalRequests = this.stats.hits + this.stats.misses;
            const hitRate = totalRequests > 0
                ? ((this.stats.hits / totalRequests) * 100).toFixed(2)
                : 0;

            // Calculate active entries
            const activeEntries = totalEntries - expiredEntries;

            return {
                // Request statistics
                hits: this.stats.hits,
                misses: this.stats.misses,
                hitRate: `${hitRate}%`,
                totalRequests,

                // Operation statistics
                sets: this.stats.sets,
                deletes: this.stats.deletes,
                expirations: this.stats.expirations,
                errors: this.stats.errors,

                // Cache size statistics
                totalEntries,
                activeEntries,
                expiredEntries,

                // Configuration
                tableName: this.config.tableName,
                defaultTTL: this.config.defaultTTL,
                cleanupInterval: this.config.cleanupInterval,
                autoCleanupEnabled: this.config.enableAutoCleanup,

                // Timestamp
                timestamp: now
            };
        } catch (error) {
            this.stats.errors++;
            this.log(`Error getting cache statistics: ${error.message}`, 'error');
            throw new DatabaseError('Failed to get cache statistics', {
                originalError: error.message
            });
        }
    }

    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            expirations: 0,
            errors: 0
        };

        this.log('Cache statistics reset', 'info');
    }

    /**
     * Log cache statistics periodically
     * @param {number} interval - Interval in milliseconds (default: 5 minutes)
     */
    startStatsLogging(interval = 300000) {
        if (this.statsTimer) {
            return;
        }

        this.log(`Starting cache statistics logging (interval: ${interval}ms)`, 'info');

        this.statsTimer = setInterval(async () => {
            try {
                const stats = await this.getStats();
                this.log('Cache statistics', 'info', stats);
            } catch (error) {
                this.log(`Stats logging error: ${error.message}`, 'error');
            }
        }, interval);

        // Don't prevent process from exiting
        if (this.statsTimer.unref) {
            this.statsTimer.unref();
        }
    }

    /**
     * Stop statistics logging
     */
    stopStatsLogging() {
        if (this.statsTimer) {
            clearInterval(this.statsTimer);
            this.statsTimer = null;
            this.log('Cache statistics logging stopped', 'info');
        }
    }

    /**
     * Shutdown cache manager and cleanup resources
     * @returns {Promise<void>}
     */
    async shutdown() {
        this.log('Shutting down cache manager', 'info');

        // Stop cleanup job
        this.stopCleanupJob();

        // Stop stats logging
        this.stopStatsLogging();

        // Log final statistics
        try {
            const finalStats = await this.getStats();
            this.log('Final cache statistics', 'info', finalStats);
        } catch (error) {
            this.log(`Error getting final statistics: ${error.message}`, 'warn');
        }

        this.isInitialized = false;
    }

    /**
     * Log message with CacheManager context
     * @param {string} message - Log message
     * @param {string} level - Log level
     * @param {Object} metadata - Additional metadata
     * @private
     */
    log(message, level = 'info', metadata = {}) {
        if (this.logger && typeof this.logger[level] === 'function') {
            if (Object.keys(metadata).length > 0) {
                this.logger[level](`[CacheManager] ${message}`, metadata);
            } else {
                this.logger[level](`[CacheManager] ${message}`);
            }
        }
    }
}

module.exports = CacheManager;
